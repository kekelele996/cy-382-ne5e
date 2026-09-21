import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ERROR_CODES } from '../../constants/errors';
import { AppException } from '../../common/errors/app.exception';
import { ExpenseStatus } from '../../constants/status';
import { ExpenseEntity } from '../expense/expense.entity';
import { SettlementEntity } from '../settlement/settlement.entity';
import { TripMemberService } from '../trip/trip-member.service';
import { TripService } from '../trip/trip.service';
import { BudgetEntity } from './budget.entity';

@Injectable()
export class BudgetService {
  constructor(
    @InjectRepository(BudgetEntity) private readonly budgets: Repository<BudgetEntity>,
    @InjectRepository(ExpenseEntity) private readonly expenses: Repository<ExpenseEntity>,
    @InjectRepository(SettlementEntity) private readonly settlements: Repository<SettlementEntity>,
    private readonly trips: TripService,
    private readonly members: TripMemberService
  ) {}

  /** 设置/覆盖某行程的分品类计划预算（upsert），清算冻结后禁止修改。 */
  async setPlans(tripId: number, userId: number, items: Array<{ category: string; planned: number }>) {
    await this.trips.requireTrip(tripId);
    await this.members.assertMember(tripId, userId);
    const settled = await this.settlements.findOne({ where: { tripId } });
    if (settled) throw new AppException(ERROR_CODES.TRIP_ALREADY_SETTLED, '清算单已生成，预算已冻结不能修改');

    const normalized = (items ?? []).map(item => {
      const category = (item.category ?? '').trim();
      const planned = Number(item.planned);
      if (!category) throw new AppException(ERROR_CODES.BUDGET_CATEGORY_EMPTY, '预算类别不能为空');
      if (!Number.isFinite(planned) || planned < 0) throw new AppException(ERROR_CODES.BUDGET_AMOUNT_INVALID, '预算金额不能为负');
      return { category, planned: Math.round((planned + Number.EPSILON) * 100) / 100 };
    });

    await this.budgets.delete({ tripId });
    if (normalized.length > 0) {
      await this.budgets.save(normalized.map(item => this.budgets.create({ tripId, ...item })));
    }
    return this.summary(tripId);
  }

  /**
   * 预算执行情况：以「已确认 + 已冻结」支出为准（待确认/已驳回不计入已花费）。
   * 返回总额与分品类超支标记，供页面异常区和清算单使用。
   */
  async summary(tripId: number) {
    const trip = await this.trips.requireTrip(tripId);
    const budgets = await this.budgets.find({ where: { tripId }, order: { id: 'ASC' } });
    const effective = await this.expenses.find({
      where: { tripId, status: In([ExpenseStatus.Confirmed, ExpenseStatus.Frozen]) }
    });

    const spentByCategory: Record<string, number> = {};
    let totalSpent = 0;
    for (const expense of effective) {
      spentByCategory[expense.category] = this.round2((spentByCategory[expense.category] ?? 0) + Number(expense.amount));
      totalSpent = this.round2(totalSpent + Number(expense.amount));
    }

    const categories = budgets.map(budget => {
      const spent = spentByCategory[budget.category] ?? 0;
      return {
        category: budget.category,
        planned: Number(budget.planned),
        spent,
        overBudget: spent - Number(budget.planned) > 0.005,
        overAmount: this.round2(Math.max(0, spent - Number(budget.planned)))
      };
    });
    const totalPlanned = this.round2(budgets.reduce((sum, item) => sum + Number(item.planned), 0));
    const categoryOver = categories.filter(item => item.overBudget);

    // 总额口径：维护了分品类预算则用品类计划之和，否则退回行程发布时的预算上限。
    const totalLimit = budgets.length > 0 ? totalPlanned : Number(trip.budgetMax ?? 0);
    const totalOverAmount = this.round2(Math.max(0, totalSpent - totalLimit));
    const totalExceeded = totalSpent - totalLimit > 0.005;
    // 任一品类超支或总额超支都标记为超计划预算。
    const totalOverBudget = categoryOver.length > 0 || totalExceeded;

    return {
      totalPlanned: budgets.length > 0 ? totalPlanned : Number(trip.budgetMax ?? 0),
      totalSpent,
      totalOverBudget,
      totalExceeded,
      totalOverAmount,
      categoryOverAmount: this.round2(categoryOver.reduce((sum, item) => sum + item.overAmount, 0)),
      budgetSource: budgets.length > 0 ? 'CATEGORY' : 'TRIP_MAX',
      categories
    };
  }

  private round2(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
