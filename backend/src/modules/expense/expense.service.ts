import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ERROR_CODES } from '../../constants/errors';
import { ExpenseStatus } from '../../constants/status';
import { AppException } from '../../common/errors/app.exception';
import { UserService } from '../user/user.service';
import { SettlementEntity } from '../settlement/settlement.entity';
import { TripMemberService } from '../trip/trip-member.service';
import { TripService } from '../trip/trip.service';
import { ExpenseEntity } from './expense.entity';

export interface RegisterExpenseInput {
  tripId: number;
  receiptNo: string;
  title: string;
  category: string;
  amount: number;
}

export interface ResubmitExpenseInput {
  receiptNo?: string;
  title?: string;
  category?: string;
  amount?: number;
}

@Injectable()
export class ExpenseService {
  constructor(
    @InjectRepository(ExpenseEntity) private readonly expenses: Repository<ExpenseEntity>,
    @InjectRepository(SettlementEntity) private readonly settlements: Repository<SettlementEntity>,
    private readonly trips: TripService,
    private readonly members: TripMemberService,
    private readonly users: UserService,
    private readonly dataSource: DataSource
  ) {}

  /** 登记本人垫付且属于当前行程的支出；同行程同票据号不得重复；清算冻结后不得再登记。 */
  async register(input: RegisterExpenseInput, userId: number): Promise<ExpenseEntity> {
    const tripId = Number(input.tripId);
    const receiptNo = (input.receiptNo ?? '').trim();
    const title = (input.title ?? '').trim();
    const category = (input.category ?? '').trim();
    const amount = Number(input.amount);
    if (!Number.isInteger(tripId) || tripId <= 0) throw new AppException(ERROR_CODES.EXPENSE_TRIP_REQUIRED, '必须指定所属行程');
    if (!receiptNo) throw new AppException(ERROR_CODES.EXPENSE_RECEIPT_EMPTY, '票据号不能为空');
    if (!title) throw new AppException(ERROR_CODES.EXPENSE_TITLE_EMPTY, '支出说明不能为空');
    if (!category) throw new AppException(ERROR_CODES.EXPENSE_CATEGORY_EMPTY, '费用类别不能为空');
    if (!Number.isFinite(amount) || amount <= 0) throw new AppException(ERROR_CODES.EXPENSE_AMOUNT_INVALID, '金额必须为大于 0 的数字');

    await this.trips.requireTrip(tripId);
    await this.members.assertMember(tripId, userId);
    await this.assertNotSettled(tripId);

    const duplicate = await this.expenses.findOne({ where: { tripId, receiptNo } });
    if (duplicate) {
      throw new AppException(
        ERROR_CODES.RECEIPT_DUPLICATED,
        duplicate.status === ExpenseStatus.Rejected
          ? '该票据号对应支出已被驳回，请在原记录上重提，不要重复登记'
          : '同行程下该票据号已登记，不能重复报销'
      );
    }

    const entity = this.expenses.create({
      tripId,
      payerId: userId,
      receiptNo,
      title,
      category,
      amount: this.round2(amount),
      status: ExpenseStatus.Pending
    });
    try {
      return await this.expenses.save(entity);
    } catch (error) {
      throw this.mapDuplicateReceipt(error);
    }
  }

  /** 其他成员确认支出；登记人不能确认本人支出；重复确认或并发确认只成功一次。 */
  async confirm(tripId: number, expenseId: number, userId: number): Promise<ExpenseEntity> {
    await this.members.assertMember(tripId, userId);
    const expense = await this.requireExpense(tripId, expenseId);
    if (expense.payerId === userId) {
      throw new AppException(ERROR_CODES.CANNOT_CONFIRM_OWN, '登记人不能确认自己的支出，请等待其他成员确认', 403);
    }
    if (expense.status !== ExpenseStatus.Pending) {
      throw new AppException(ERROR_CODES.EXPENSE_NOT_PENDING, `当前状态为${this.statusLabel(expense.status)}，无需重复确认`);
    }
    // 条件更新保证幂等：仅 PENDING -> CONFIRMED 生效，并发/重复提交 affected 为 0。
    const result = await this.expenses.update(
      { id: expenseId, tripId, status: ExpenseStatus.Pending },
      { status: ExpenseStatus.Confirmed, confirmedBy: userId }
    );
    if (!result.affected) throw new AppException(ERROR_CODES.EXPENSE_NOT_PENDING, '该支出已被处理，请勿重复确认');
    return this.requireExpense(tripId, expenseId);
  }

  /** 其他成员驳回存疑支出，驳回后登记人可修正重提。 */
  async reject(tripId: number, expenseId: number, userId: number, reason: string): Promise<ExpenseEntity> {
    await this.members.assertMember(tripId, userId);
    const expense = await this.requireExpense(tripId, expenseId);
    if (expense.payerId === userId) {
      throw new AppException(ERROR_CODES.CANNOT_CONFIRM_OWN, '登记人不能审核自己的支出', 403);
    }
    if (expense.status !== ExpenseStatus.Pending) {
      throw new AppException(ERROR_CODES.EXPENSE_NOT_PENDING, `当前状态为${this.statusLabel(expense.status)}，无法驳回`);
    }
    const result = await this.expenses.update(
      { id: expenseId, tripId, status: ExpenseStatus.Pending },
      { status: ExpenseStatus.Rejected, rejectedBy: userId, rejectReason: (reason ?? '').slice(0, 255) }
    );
    if (!result.affected) throw new AppException(ERROR_CODES.EXPENSE_NOT_PENDING, '该支出已被处理');
    return this.requireExpense(tripId, expenseId);
  }

  /** 登记人就被驳回的支出修改后重提，重新进入待确认；仅本人、仅 REJECTED 可操作。 */
  async resubmit(tripId: number, expenseId: number, userId: number, input: ResubmitExpenseInput): Promise<ExpenseEntity> {
    await this.members.assertMember(tripId, userId);
    const expense = await this.requireExpense(tripId, expenseId);
    if (expense.payerId !== userId) {
      throw new AppException(ERROR_CODES.NOT_EXPENSE_OWNER, '只有登记人可以重提该支出', 403);
    }
    if (expense.status !== ExpenseStatus.Rejected) {
      throw new AppException(ERROR_CODES.EXPENSE_NOT_REJECTED, '仅被驳回的支出可以重提');
    }
    await this.assertNotSettled(tripId);

    const patch: Partial<ExpenseEntity> = {
      status: ExpenseStatus.Pending,
      confirmedBy: null,
      rejectedBy: null,
      rejectReason: null
    };
    if (input.receiptNo !== undefined) {
      const receiptNo = input.receiptNo.trim();
      if (!receiptNo) throw new AppException(ERROR_CODES.EXPENSE_RECEIPT_EMPTY, '票据号不能为空');
      if (receiptNo !== expense.receiptNo) {
        const clash = await this.expenses.findOne({ where: { tripId, receiptNo } });
        if (clash && clash.id !== expense.id) throw new AppException(ERROR_CODES.RECEIPT_DUPLICATED, '该票据号在本行程已存在');
      }
      patch.receiptNo = receiptNo;
    }
    if (input.title !== undefined) {
      const title = input.title.trim();
      if (!title) throw new AppException(ERROR_CODES.EXPENSE_TITLE_EMPTY, '支出说明不能为空');
      patch.title = title;
    }
    if (input.category !== undefined) {
      const category = input.category.trim();
      if (!category) throw new AppException(ERROR_CODES.EXPENSE_CATEGORY_EMPTY, '费用类别不能为空');
      patch.category = category;
    }
    if (input.amount !== undefined) {
      const amount = Number(input.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new AppException(ERROR_CODES.EXPENSE_AMOUNT_INVALID, '金额必须为大于 0 的数字');
      }
      patch.amount = this.round2(amount);
    }

    try {
      await this.expenses.update({ id: expenseId, tripId, status: ExpenseStatus.Rejected }, patch);
    } catch (error) {
      throw this.mapDuplicateReceipt(error);
    }
    return this.requireExpense(tripId, expenseId);
  }

  async listForTrip(tripId: number): Promise<ExpenseEntity[]> {
    return this.expenses.find({ where: { tripId }, order: { id: 'ASC' } });
  }

  async requireExpense(tripId: number, expenseId: number): Promise<ExpenseEntity> {
    const expense = await this.expenses.findOne({ where: { id: expenseId, tripId } });
    if (!expense) throw new AppException(ERROR_CODES.EXPENSE_NOT_FOUND, '支出记录不存在', 404);
    return expense;
  }

  /** 清算一旦生成，全部已确认支出被冻结，不允许再增改。 */
  async assertNotSettled(tripId: number) {
    const settled = await this.settlements.findOne({ where: { tripId } });
    if (settled) throw new AppException(ERROR_CODES.TRIP_ALREADY_SETTLED, '清算单已生成并冻结，不能再修改支出');
  }

  /** 附带登记人/审核人昵称，刷新页面后展示仍与数据库一致。 */
  async decorate(expenses: ExpenseEntity[]) {
    const ids = new Set<number>();
    expenses.forEach(item => {
      ids.add(item.payerId);
      if (item.confirmedBy) ids.add(item.confirmedBy);
      if (item.rejectedBy) ids.add(item.rejectedBy);
    });
    const names = await this.users.nameMap(Array.from(ids));
    return expenses.map(item => ({
      ...item,
      payerName: names[item.payerId] ?? `用户${item.payerId}`,
      confirmerName: item.confirmedBy ? names[item.confirmedBy] ?? `用户${item.confirmedBy}` : null,
      rejecterName: item.rejectedBy ? names[item.rejectedBy] ?? `用户${item.rejectedBy}` : null
    }));
  }

  private round2(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private statusLabel(status: ExpenseStatus) {
    return ({ PENDING: '待确认', CONFIRMED: '已确认', REJECTED: '已驳回', FROZEN: '已冻结' } as Record<string, string>)[status] ?? status;
  }

  private mapDuplicateReceipt(error: unknown): never {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'ER_DUP_ENTRY') {
      throw new AppException(ERROR_CODES.RECEIPT_DUPLICATED, '同行程下该票据号已登记，不能重复报销');
    }
    throw error;
  }
}
