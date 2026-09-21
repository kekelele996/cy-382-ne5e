import { Injectable } from '@nestjs/common';
import { ExpenseStatus } from '../../constants/status';
import { BudgetService } from '../budget/budget.service';
import { ExpenseService } from '../expense/expense.service';
import { UserService } from '../user/user.service';
import { TripMemberService } from '../trip/trip-member.service';
import { TripService } from '../trip/trip.service';
import { calculateNetAmounts } from './net-calc';
import { SettlementService } from './settlement.service';

export type AnomalyType = 'REJECTED' | 'OVER_BUDGET' | 'PENDING_BLOCKER';

@Injectable()
export class DashboardService {
  constructor(
    private readonly trips: TripService,
    private readonly members: TripMemberService,
    private readonly expenses: ExpenseService,
    private readonly budgets: BudgetService,
    private readonly settlements: SettlementService,
    private readonly users: UserService
  ) {}

  /** 工作台聚合数据：待办、异常、净额（清算后）、超支，全部来自数据库，刷新后保持一致。 */
  async overview(tripId: number, userId: number) {
    await this.trips.requireTrip(tripId);
    await this.members.assertMember(tripId, userId);

    const [trip, memberIds, rawExpenses, budget, settlement] = await Promise.all([
      this.trips.requireTrip(tripId),
      this.members.listMemberIds(tripId),
      this.expenses.listForTrip(tripId),
      this.budgets.summary(tripId),
      this.settlements.getByTrip(tripId, userId)
    ]);
    const [expenses, names] = await Promise.all([
      this.expenses.decorate(rawExpenses),
      this.users.nameMap(memberIds)
    ]);

    const pending = expenses.filter(item => item.status === ExpenseStatus.Pending);
    const rejected = expenses.filter(item => item.status === ExpenseStatus.Rejected);
    const confirmed = expenses.filter(item => item.status === ExpenseStatus.Confirmed);
    const frozen = expenses.filter(item => item.status === ExpenseStatus.Frozen);

    // 待办：需要我确认的（别人垫付）+ 我登记后被驳回、等待重提的。
    const todos = [
      ...pending
        .filter(item => item.payerId !== userId)
        .map(item => ({ type: 'CONFIRM' as const, expenseId: item.id, title: item.title, amount: item.amount, payerName: item.payerName })),
      ...rejected
        .filter(item => item.payerId === userId)
        .map(item => ({
          type: 'RESUBMIT' as const,
          expenseId: item.id,
          title: item.title,
          amount: item.amount,
          reason: item.rejectReason
        }))
    ];

    // 异常：阻断清算的待重提记录、待确认数量、超计划预算。
    const anomalies: Array<{ type: AnomalyType; level: 'warning' | 'danger'; message: string; expenseId?: number }> = [];
    rejected.forEach(item => {
      anomalies.push({
        type: 'REJECTED',
        level: 'danger',
        expenseId: item.id,
        message: `「${item.title}」被${item.rejecterName ?? '其他成员'}驳回${item.rejectReason ? `：${item.rejectReason}` : ''}，需登记人重提`
      });
    });
    if (pending.length > 0) {
      anomalies.push({
        type: 'PENDING_BLOCKER',
        level: 'warning',
        message: `有 ${pending.length} 笔支出待其他成员确认，清算单暂不能生成`
      });
    }
    if (budget.totalOverBudget) {
      const details = budget.categories.filter(item => item.overBudget);
      const categoryText =
        details.length > 0 ? `${details.map(item => `${item.category}超支 ¥${item.overAmount.toFixed(2)}`).join('；')}` : '';
      const totalText = budget.totalExceeded
        ? `总花费超计划预算 ¥${budget.totalOverAmount.toFixed(2)}`
        : '总额未超总预算，但存在品类超支';
      anomalies.push({
        type: 'OVER_BUDGET',
        level: budget.totalExceeded ? 'danger' : 'warning',
        message: [totalText, categoryText].filter(Boolean).join('；')
      });
    }

    // 清算前按当前已确认支出预估净额（仅供参考）；清算后以冻结的清算单为准。
    const projected = this.projection(memberIds, confirmed.map(item => ({ payerId: item.payerId, amount: item.amount })));

    return {
      trip,
      members: memberIds.map(id => ({ userId: id, nickname: names[id] ?? `用户${id}` })),
      counts: {
        pending: pending.length,
        confirmed: confirmed.length,
        rejected: rejected.length,
        frozen: frozen.length,
        total: expenses.length
      },
      todos,
      anomalies,
      budget,
      expenses,
      settlement,
      projectedNet: projected,
      canSettle: !settlement && pending.length === 0 && rejected.length === 0 && memberIds.length > 0,
      frozen: Boolean(settlement)
    };
  }

  private projection(memberIds: number[], confirmed: Array<{ payerId: number; amount: number }>) {
    const paidMap: Record<number, number> = {};
    for (const item of confirmed) {
      paidMap[item.payerId] = Math.round(((paidMap[item.payerId] ?? 0) + Number(item.amount)) * 100) / 100;
    }
    const { total, perPerson, items } = calculateNetAmounts(memberIds, paidMap);
    return { total, perPerson, items };
  }
}
