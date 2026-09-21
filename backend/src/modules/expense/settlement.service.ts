import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { AppException } from '../../common/errors/app.exception';
import { ERROR_CODES } from '../../constants/errors';
import { ExpenseStatus, SettlementStatus, TripStatus } from '../../constants/status';
import { TripEntity } from '../trip/trip.entity';
import { TripMemberEntity } from '../trip/trip-member.entity';
import { ExpenseEntity } from './expense.entity';
import { SettlementShareEntity } from './settlement-share.entity';
import { SettlementEntity } from './settlement.entity';
import { fromCents, splitShares, toCents } from './settlement.calculator';

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(SettlementEntity) private readonly settlements: Repository<SettlementEntity>,
    @InjectRepository(SettlementShareEntity) private readonly shares: Repository<SettlementShareEntity>,
    @InjectRepository(TripMemberEntity) private readonly members: Repository<TripMemberEntity>
  ) {}

  private async detail(manager: EntityManager, settlementId: number) {
    const settlement = await manager.getRepository(SettlementEntity).findOneBy({ id: settlementId });
    const shares = await manager.getRepository(SettlementShareEntity).find({ where: { settlementId }, order: { userId: 'ASC' } });
    return { ...settlement!, shares };
  }

  async generate(userId: number, tripId: number) {
    if (!Number.isInteger(tripId) || tripId <= 0) throw new AppException(ERROR_CODES.VALIDATION_FAILED, '行程参数无效');
    const member = await this.members.findOneBy({ tripId, userId });
    if (!member) throw new AppException(ERROR_CODES.NOT_TRIP_MEMBER, '仅行程成员可生成清算单', 403);
    try {
      return await this.dataSource.transaction(async manager => {
        // 锁定行程行，串行化并发生成请求
        const trips = (await manager.query('SELECT id, status, budget_max AS budgetMax FROM trips WHERE id = ? FOR UPDATE', [tripId])) as any[];
        const trip = trips[0];
        if (!trip) throw new AppException(ERROR_CODES.TRIP_NOT_FOUND, '行程不存在', 404);
        const existing = await manager.getRepository(SettlementEntity).findOneBy({ tripId });
        if (existing) throw new AppException(ERROR_CODES.SETTLEMENT_EXISTS, '清算单已生成，请勿重复生成', 409);
        // 存在待确认或待重提支出时不得生成清算单
        const unresolved = await manager.getRepository(ExpenseEntity).count({
          where: { tripId, status: In([ExpenseStatus.Pending, ExpenseStatus.Rejected]) }
        });
        if (unresolved > 0) {
          throw new AppException(ERROR_CODES.EXPENSES_UNRESOLVED, `存在 ${unresolved} 笔待确认或待重提支出，不能生成清算单`, 409);
        }
        const confirmed = await manager.getRepository(ExpenseEntity).find({ where: { tripId, status: ExpenseStatus.Confirmed } });
        const members = await manager.getRepository(TripMemberEntity).findBy({ tripId });
        if (members.length === 0) throw new AppException(ERROR_CODES.VALIDATION_FAILED, '行程没有成员，无法清算');
        // 整数分计算每人净额，余数确定性分摊，保证零和
        const paidByUser = new Map<number, number>();
        for (const row of members) paidByUser.set(row.userId, 0);
        for (const expense of confirmed) {
          paidByUser.set(expense.payerId, (paidByUser.get(expense.payerId) ?? 0) + toCents(expense.amount));
        }
        const split = splitShares([...paidByUser.entries()].map(([uid, paidCents]) => ({ userId: uid, paidCents })));
        const totalCents = split.reduce((sum, row) => sum + row.paidCents, 0);
        // 计划预算：优先分类预算合计，未设置时回退行程预算上限
        const budgetRows = (await manager.query('SELECT COALESCE(SUM(planned), 0) AS planned FROM budgets WHERE trip_id = ?', [tripId])) as any[];
        const plannedCents = toCents(budgetRows[0]?.planned) || toCents(trip.budgetMax);
        const overBudget = plannedCents > 0 && totalCents > plannedCents;
        // 清算单、支出冻结、行程状态在同一事务落盘
        const settlementRepo = manager.getRepository(SettlementEntity);
        const settlement = await settlementRepo.save(
          settlementRepo.create({
            tripId,
            totalAmount: fromCents(totalCents) as unknown as number,
            plannedBudget: fromCents(plannedCents) as unknown as number,
            memberCount: members.length,
            overBudget,
            status: SettlementStatus.Generated
          })
        );
        await manager.getRepository(SettlementShareEntity).save(
          split.map(row =>
            manager.getRepository(SettlementShareEntity).create({
              settlementId: settlement.id,
              userId: row.userId,
              paid: fromCents(row.paidCents) as unknown as number,
              share: fromCents(row.shareCents) as unknown as number,
              net: fromCents(row.netCents) as unknown as number
            })
          )
        );
        await manager.getRepository(ExpenseEntity).update({ tripId, status: ExpenseStatus.Confirmed }, { status: ExpenseStatus.Settled });
        await manager.getRepository(TripEntity).update({ id: tripId }, { status: TripStatus.Settled });
        this.logger.log(`settlement ${settlement.id} generated for trip ${tripId}: total=${fromCents(totalCents)}, overBudget=${overBudget}`);
        return this.detail(manager, settlement.id);
      });
    } catch (error: any) {
      // 唯一索引兜底：并发生成只成功一次
      if (error?.code === 'ER_DUP_ENTRY') throw new AppException(ERROR_CODES.SETTLEMENT_EXISTS, '清算单已生成，请勿重复生成', 409);
      throw error;
    }
  }

  async findByTrip(userId: number, tripId: number) {
    const member = await this.members.findOneBy({ tripId, userId });
    if (!member) throw new AppException(ERROR_CODES.NOT_TRIP_MEMBER, '仅行程成员可查看清算单', 403);
    const settlement = await this.settlements.findOneBy({ tripId });
    if (!settlement) throw new AppException(ERROR_CODES.SETTLEMENT_NOT_FOUND, '清算单尚未生成', 404);
    const shares = await this.shares.find({ where: { settlementId: settlement.id }, order: { userId: 'ASC' } });
    return { ...settlement, shares };
  }
}
