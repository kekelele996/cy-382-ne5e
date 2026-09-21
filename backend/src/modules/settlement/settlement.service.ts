import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, DataSource, Repository } from 'typeorm';
import { ERROR_CODES } from '../../constants/errors';
import { AppException } from '../../common/errors/app.exception';
import { KeyedMutex } from '../../common/locking/keyed-mutex';
import { ExpenseStatus, SettlementStatus } from '../../constants/status';
import { BudgetService } from '../budget/budget.service';
import { ExpenseEntity } from '../expense/expense.entity';
import { TripEntity } from '../trip/trip.entity';
import { TripMemberEntity } from '../trip/trip-member.entity';
import { TripMemberService } from '../trip/trip-member.service';
import { TripService } from '../trip/trip.service';
import { calculateNetAmounts } from './net-calc';
import { SettlementEntity } from './settlement.entity';
import { SettlementItemEntity } from './settlement-item.entity';

@Injectable()
export class SettlementService {
  constructor(
    @InjectRepository(SettlementEntity) private readonly settlements: Repository<SettlementEntity>,
    @InjectRepository(SettlementItemEntity) private readonly items: Repository<SettlementItemEntity>,
    private readonly members: TripMemberService,
    private readonly tripLookup: TripService,
    private readonly budgets: BudgetService,
    private readonly dataSource: DataSource
  ) {}

  /** 同一行程的生成请求进程内串行；不同行程互不阻塞。 */
  private readonly generateLocks = new KeyedMutex();

  /**
   * 生成清算单（一次落盘）：
   * 1. 存在待确认或待重提（已驳回）支出时拒绝；
   * 2. 行级锁定行程 + 唯一索引兜底，重复/并发生成只成功一次；
   * 3. 只按已确认支出计算每人净额并修正为零和；
   * 4. 超计划预算在清算单上标记；
   * 5. 清算单、支出冻结状态同一事务提交。
   */
  async generate(tripId: number, userId: number) {
    await this.tripLookup.requireTrip(tripId);
    await this.members.assertMember(tripId, userId);

    return this.generateLocks.run(`settle:${tripId}`, () => this.runGeneration(tripId, userId));
  }

  private async runGeneration(tripId: number, userId: number) {
    return this.dataSource.transaction(async manager => {
      // 行锁串行化同一行程的并发生成（MySQL）；不支持锁的驱动（如内存 SQLite）
      // 自身写操作串行，且由 trip_id 唯一索引兜底，故跳过 FOR UPDATE。
      if (this.dataSource.options.type !== 'better-sqlite3' && this.dataSource.options.type !== 'sqlite') {
        await manager
          .getRepository(TripEntity)
          .createQueryBuilder('trip')
          .setLock('pessimistic_write')
          .where('trip.id = :id', { tripId })
          .getRawOne();
      }

      const existing = await manager.findOne(SettlementEntity, { where: { tripId } });
      if (existing) throw new AppException(ERROR_CODES.TRIP_ALREADY_SETTLED, '清算单已生成，不能重复生成', 409);

      const memberRows = await manager.find(TripMemberEntity, { where: { tripId }, order: { id: 'ASC' } });
      const memberIds = memberRows.map(row => row.userId);
      if (memberIds.length === 0) throw new AppException(ERROR_CODES.NO_TRIP_MEMBERS, '行程尚无成员，无法清算');

      const all = await manager.find(ExpenseEntity, { where: { tripId }, order: { id: 'ASC' } });
      const pending = all.filter(item => item.status === ExpenseStatus.Pending);
      const rejected = all.filter(item => item.status === ExpenseStatus.Rejected);
      if (pending.length > 0) {
        throw new AppException(ERROR_CODES.EXPENSES_PENDING, `还有 ${pending.length} 笔支出待确认，暂不能生成清算单`, 409);
      }
      if (rejected.length > 0) {
        throw new AppException(ERROR_CODES.EXPENSES_REJECTED, `还有 ${rejected.length} 笔被驳回支出待重提，暂不能生成清算单`, 409);
      }

      const confirmed = all.filter(item => item.status === ExpenseStatus.Confirmed);
      const paidMap: Record<number, number> = {};
      for (const expense of confirmed) {
        paidMap[expense.payerId] = Math.round(((paidMap[expense.payerId] ?? 0) + Number(expense.amount)) * 100) / 100;
      }
      const { total, perPerson, items: netItems } = calculateNetAmounts(memberIds, paidMap);
      const netSum = Math.round(netItems.reduce((sum, item) => sum + item.net, 0) * 100) / 100;

      const budgetSummary = await this.budgets.summary(tripId);

      const savedSettlement = await this.saveSettlement(manager, {
        tripId,
        userId,
        total,
        perPerson,
        netSum,
        memberCount: memberIds.length,
        overBudget: budgetSummary.totalOverBudget,
        overBudgetDetail: {
          totalExceeded: budgetSummary.totalExceeded,
          totalOverAmount: budgetSummary.totalOverAmount,
          categoryOverAmount: budgetSummary.categoryOverAmount,
          categories: budgetSummary.categories.filter(item => item.overBudget)
        }
      });

      await manager.save(
        netItems.map(item =>
          manager.create(SettlementItemEntity, {
            settlementId: savedSettlement.id,
            tripId,
            userId: item.userId,
            paid: item.paid,
            share: item.share,
            net: item.net
          })
        )
      );

      // 清算、冻结状态一次落盘：已确认支出批量冻结。
      if (confirmed.length > 0) {
        await manager.update(
          ExpenseEntity,
          { tripId, status: ExpenseStatus.Confirmed },
          { status: ExpenseStatus.Frozen, frozenAt: () => 'CURRENT_TIMESTAMP' }
        );
      }
      return this.detailInTransaction(manager, savedSettlement.id);
    });
  }

  async getByTrip(tripId: number, userId: number) {
    await this.members.assertMember(tripId, userId);
    const settlement = await this.settlements.findOne({ where: { tripId } });
    if (!settlement) return null;
    const items = await this.items.find({ where: { settlementId: settlement.id }, order: { id: 'ASC' } });
    return { ...settlement, items };
  }

  /** 唯一索引兜底：并发事务中第二个提交方收到 ER_DUP_ENTRY，转换为幂等冲突。 */
  private async saveSettlement(
    manager: EntityManager,
    data: {
      tripId: number;
      userId: number;
      total: number;
      perPerson: number;
      netSum: number;
      memberCount: number;
      overBudget: boolean;
      overBudgetDetail: SettlementEntity['overBudgetDetail'];
    }
  ) {
    try {
      return await manager.save(
        manager.create(SettlementEntity, {
          tripId: data.tripId,
          createdBy: data.userId,
          status: SettlementStatus.Settled,
          totalAmount: data.total,
          perPerson: data.perPerson,
          netSum: data.netSum,
          overBudget: data.overBudget,
          overBudgetDetail: data.overBudgetDetail,
          memberCount: data.memberCount
        })
      );
    } catch (error) {
      if (isDuplicateEntry(error)) {
        throw new AppException(ERROR_CODES.SETTLEMENT_IN_PROGRESS, '清算单正在生成或已生成，重复请求只生效一次', 409);
      }
      throw error;
    }
  }

  private async detailInTransaction(manager: EntityManager, settlementId: number) {
    const settlement = await manager.findOneOrFail(SettlementEntity, { where: { id: settlementId } });
    const items = await manager.find(SettlementItemEntity, { where: { settlementId }, order: { id: 'ASC' } });
    return { ...settlement, items };
  }
}

function isDuplicateEntry(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'ER_DUP_ENTRY';
}
