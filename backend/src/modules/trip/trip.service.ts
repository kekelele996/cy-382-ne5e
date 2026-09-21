import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { AppException } from '../../common/errors/app.exception';
import { ERROR_CODES } from '../../constants/errors';
import { ExpenseCategory } from '../../constants/status';
import { BudgetEntity } from './budget.entity';
import { TripMemberEntity } from './trip-member.entity';
import { TripEntity } from './trip.entity';

@Injectable()
export class TripService {
  constructor(
    @InjectRepository(TripEntity) private readonly trips: Repository<TripEntity>,
    @InjectRepository(TripMemberEntity) private readonly members: Repository<TripMemberEntity>,
    @InjectRepository(BudgetEntity) private readonly budgets: Repository<BudgetEntity>
  ) {}

  async create(ownerId: number, input: Partial<TripEntity>) {
    if (!input.destination?.trim()) throw new AppException(ERROR_CODES.VALIDATION_FAILED, '目的地必填');
    if (!input.departDate) throw new AppException(ERROR_CODES.VALIDATION_FAILED, '出发时间必填');
    const days = Number(input.days);
    if (!Number.isInteger(days) || days <= 0) throw new AppException(ERROR_CODES.VALIDATION_FAILED, '行程天数无效');
    const trip = await this.trips.save(this.trips.create({ ...input, ownerId, days }));
    // 发布者自动成为行程成员
    await this.members.save(this.members.create({ tripId: trip.id, userId: ownerId }));
    return trip;
  }

  list() { return this.trips.find({ order: { departDate: 'ASC' } }); }

  match(destination: string, date: string, budgetMax: number) {
    return this.trips.find({ where: { destination, departDate: Between(date, date), budgetMax } });
  }

  async join(tripId: number, userId: number) {
    const trip = await this.trips.findOneBy({ id: tripId });
    if (!trip) throw new AppException(ERROR_CODES.TRIP_NOT_FOUND, '行程不存在', 404);
    const existing = await this.members.findOneBy({ tripId, userId });
    if (existing) return existing;
    try {
      return await this.members.save(this.members.create({ tripId, userId }));
    } catch (error: any) {
      // 唯一索引兜底：重复加入只成功一次
      if (error?.code === 'ER_DUP_ENTRY') return this.members.findOneBy({ tripId, userId });
      throw error;
    }
  }

  memberList(tripId: number) {
    return this.members.query(
      'SELECT m.id, m.trip_id AS tripId, m.user_id AS userId, u.nickname FROM trip_members m LEFT JOIN users u ON u.id = m.user_id WHERE m.trip_id = ? ORDER BY m.id ASC',
      [tripId]
    );
  }

  budgetList(tripId: number) {
    return this.budgets.find({ where: { tripId }, order: { id: 'ASC' } });
  }

  async upsertBudget(tripId: number, userId: number, category: string, planned: number) {
    const trip = await this.trips.findOneBy({ id: tripId });
    if (!trip) throw new AppException(ERROR_CODES.TRIP_NOT_FOUND, '行程不存在', 404);
    const member = await this.members.findOneBy({ tripId, userId });
    if (!member) throw new AppException(ERROR_CODES.NOT_TRIP_MEMBER, '仅行程成员可维护预算', 403);
    if (!Object.values(ExpenseCategory).includes(category as ExpenseCategory)) {
      throw new AppException(ERROR_CODES.VALIDATION_FAILED, '费用类别无效');
    }
    const value = Number(planned);
    if (!Number.isFinite(value) || value < 0 || value > 99999999.99) {
      throw new AppException(ERROR_CODES.VALIDATION_FAILED, '预算金额无效');
    }
    const existing = await this.budgets.findOneBy({ tripId, category });
    if (existing) {
      existing.planned = Number(value.toFixed(2));
      return this.budgets.save(existing);
    }
    return this.budgets.save(this.budgets.create({ tripId, category, planned: Number(value.toFixed(2)) }));
  }
}
