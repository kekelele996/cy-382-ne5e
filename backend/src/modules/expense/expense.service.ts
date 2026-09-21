import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppException } from '../../common/errors/app.exception';
import { ERROR_CODES } from '../../constants/errors';
import { ExpenseCategory, ExpenseStatus, TripStatus } from '../../constants/status';
import { TripEntity } from '../trip/trip.entity';
import { TripMemberEntity } from '../trip/trip-member.entity';
import { ExpenseEntity } from './expense.entity';
import { SettlementEntity } from './settlement.entity';

export interface RegisterExpenseInput {
  tripId: number;
  receiptNo: string;
  category: string;
  amount: number;
  note?: string;
}

export interface ResubmitExpenseInput {
  receiptNo?: string;
  category?: string;
  amount?: number;
  note?: string;
}

@Injectable()
export class ExpenseService {
  private readonly logger = new Logger(ExpenseService.name);

  constructor(
    @InjectRepository(ExpenseEntity) private readonly expenses: Repository<ExpenseEntity>,
    @InjectRepository(TripEntity) private readonly trips: Repository<TripEntity>,
    @InjectRepository(TripMemberEntity) private readonly members: Repository<TripMemberEntity>,
    @InjectRepository(SettlementEntity) private readonly settlements: Repository<SettlementEntity>
  ) {}

  private async loadTrip(tripId: number) {
    const trip = await this.trips.findOneBy({ id: tripId });
    if (!trip) throw new AppException(ERROR_CODES.TRIP_NOT_FOUND, '行程不存在', 404);
    return trip;
  }

  private async assertMember(tripId: number, userId: number) {
    const member = await this.members.findOneBy({ tripId, userId });
    if (!member) throw new AppException(ERROR_CODES.NOT_TRIP_MEMBER, '仅行程成员可操作该行程支出', 403);
  }

  private validateAmount(amount: number) {
    if (!Number.isFinite(amount) || amount <= 0 || amount > 99999999.99) {
      throw new AppException(ERROR_CODES.VALIDATION_FAILED, '金额必须大于 0 且不超过 99999999.99');
    }
  }

  private validateCategory(category: string) {
    if (!Object.values(ExpenseCategory).includes(category as ExpenseCategory)) {
      throw new AppException(ERROR_CODES.VALIDATION_FAILED, '费用类别无效');
    }
  }

  private validateReceiptNo(receiptNo: string) {
    if (!receiptNo || receiptNo.length > 64) {
      throw new AppException(ERROR_CODES.VALIDATION_FAILED, '票据号必填且不超过 64 个字符');
    }
  }

  async register(userId: number, input: RegisterExpenseInput) {
    const tripId = Number(input.tripId);
    const amount = Number(input.amount);
    const receiptNo = String(input.receiptNo ?? '').trim();
    if (!Number.isInteger(tripId) || tripId <= 0) throw new AppException(ERROR_CODES.VALIDATION_FAILED, '行程参数无效');
    this.validateReceiptNo(receiptNo);
    this.validateCategory(input.category);
    this.validateAmount(amount);
    const trip = await this.loadTrip(tripId);
    // 只能登记本人垫付且属于当前行程的支出：垫付人即当前登录成员
    await this.assertMember(tripId, userId);
    if (trip.status === TripStatus.Settled || (await this.settlements.findOneBy({ tripId }))) {
      throw new AppException(ERROR_CODES.SETTLEMENT_EXISTS, '清算单已生成，支出已冻结，不能再登记', 409);
    }
    const duplicated = await this.expenses.findOneBy({ tripId, receiptNo });
    if (duplicated) throw new AppException(ERROR_CODES.RECEIPT_DUPLICATED, '同行程下该票据号已登记，请勿重复提交', 409);
    const expense = this.expenses.create({
      tripId,
      payerId: userId,
      receiptNo,
      category: input.category,
      amount: Number(amount.toFixed(2)),
      note: input.note?.trim().slice(0, 255) || undefined,
      status: ExpenseStatus.Pending
    });
    try {
      const saved = await this.expenses.save(expense);
      this.logger.log(`expense ${saved.id} registered by user ${userId} for trip ${tripId}`);
      return saved;
    } catch (error: any) {
      // 唯一索引兜底：并发登记同票据号只成功一次
      if (error?.code === 'ER_DUP_ENTRY') {
        throw new AppException(ERROR_CODES.RECEIPT_DUPLICATED, '同行程下该票据号已登记，请勿重复提交', 409);
      }
      throw error;
    }
  }

  async list(userId: number, tripId: number) {
    await this.loadTrip(tripId);
    await this.assertMember(tripId, userId);
    return this.expenses.find({ where: { tripId }, order: { id: 'DESC' } });
  }

  private async loadForReview(userId: number, expenseId: number) {
    const expense = await this.expenses.findOneBy({ id: expenseId });
    if (!expense) throw new AppException(ERROR_CODES.EXPENSE_NOT_FOUND, '支出不存在', 404);
    await this.assertMember(expense.tripId, userId);
    if (expense.payerId === userId) {
      throw new AppException(ERROR_CODES.SELF_CONFIRM_NOT_ALLOWED, '登记人不能确认自己的支出，须由其他成员确认', 403);
    }
    return expense;
  }

  async confirm(userId: number, expenseId: number) {
    await this.loadForReview(userId, expenseId);
    // 条件更新保证重复确认/并发确认只成功一次
    const result = await this.expenses.update(
      { id: expenseId, status: ExpenseStatus.Pending },
      { status: ExpenseStatus.Confirmed, confirmedBy: userId, confirmedAt: new Date() }
    );
    if (!result.affected) throw new AppException(ERROR_CODES.EXPENSE_ALREADY_PROCESSED, '该支出已被处理，请勿重复操作', 409);
    this.logger.log(`expense ${expenseId} confirmed by user ${userId}`);
    return this.expenses.findOneBy({ id: expenseId });
  }

  async reject(userId: number, expenseId: number) {
    await this.loadForReview(userId, expenseId);
    const result = await this.expenses.update(
      { id: expenseId, status: ExpenseStatus.Pending },
      { status: ExpenseStatus.Rejected, confirmedBy: userId, confirmedAt: new Date() }
    );
    if (!result.affected) throw new AppException(ERROR_CODES.EXPENSE_ALREADY_PROCESSED, '该支出已被处理，请勿重复操作', 409);
    this.logger.log(`expense ${expenseId} rejected by user ${userId}`);
    return this.expenses.findOneBy({ id: expenseId });
  }

  async resubmit(userId: number, expenseId: number, input: ResubmitExpenseInput) {
    const expense = await this.expenses.findOneBy({ id: expenseId });
    if (!expense) throw new AppException(ERROR_CODES.EXPENSE_NOT_FOUND, '支出不存在', 404);
    if (expense.payerId !== userId) throw new AppException(ERROR_CODES.VALIDATION_FAILED, '仅登记人可重新提交该支出', 403);
    const receiptNo = String(input.receiptNo ?? expense.receiptNo).trim();
    const category = input.category ?? expense.category;
    const amount = input.amount === undefined ? Number(expense.amount) : Number(input.amount);
    this.validateReceiptNo(receiptNo);
    this.validateCategory(category);
    this.validateAmount(amount);
    if (receiptNo !== expense.receiptNo) {
      const duplicated = await this.expenses.findOneBy({ tripId: expense.tripId, receiptNo });
      if (duplicated) throw new AppException(ERROR_CODES.RECEIPT_DUPLICATED, '同行程下该票据号已登记，请勿重复提交', 409);
    }
    // 仅待重提状态可重提，条件更新保证并发只成功一次
    const result = await this.expenses.update(
      { id: expenseId, status: ExpenseStatus.Rejected, payerId: userId },
      {
        receiptNo,
        category,
        amount: Number(amount.toFixed(2)),
        note: input.note === undefined ? expense.note : input.note.trim().slice(0, 255) || undefined,
        status: ExpenseStatus.Pending,
        confirmedBy: null,
        confirmedAt: null
      }
    );
    if (!result.affected) throw new AppException(ERROR_CODES.EXPENSE_ALREADY_PROCESSED, '该支出不处于待重提状态，请勿重复操作', 409);
    this.logger.log(`expense ${expenseId} resubmitted by user ${userId}`);
    return this.expenses.findOneBy({ id: expenseId });
  }
}
