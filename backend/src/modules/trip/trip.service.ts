import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, Repository } from 'typeorm';
import { ERROR_CODES } from '../../constants/errors';
import { AppException } from '../../common/errors/app.exception';
import { TripEntity } from './trip.entity';
import { TripMemberEntity } from './trip-member.entity';
import { TripMemberService } from './trip-member.service';

export interface CreateTripInput {
  destination: string;
  departDate: string;
  days: number;
  budgetMin?: number;
  budgetMax?: number;
  transport: string;
  companionCount: number;
  genderPreference?: string;
}

@Injectable()
export class TripService {
  constructor(
    @InjectRepository(TripEntity) private readonly trips: Repository<TripEntity>,
    private readonly memberService: TripMemberService,
    private readonly dataSource: DataSource
  ) {}

  /** 发布行程与发布者入组成员在同一事务内落盘，避免出现无主理人的行程。 */
  async create(input: CreateTripInput, ownerId: number) {
    if (!input.destination || !input.departDate || !input.transport) {
      throw new AppException(ERROR_CODES.VALIDATION_FAILED, '目的地、出发时间和出行方式不能为空');
    }
    if (!Number.isFinite(input.days) || input.days <= 0) {
      throw new AppException(ERROR_CODES.VALIDATION_FAILED, '行程天数必须为正整数');
    }
    return this.dataSource.transaction(async manager => {
      const trip = await manager.save(manager.create(TripEntity, { ...input, ownerId, status: 'OPEN' }));
      await manager.save(manager.create(TripMemberEntity, { tripId: trip.id, userId: ownerId }));
      return trip;
    });
  }

  list() {
    return this.trips.find({ order: { departDate: 'ASC' } });
  }

  /** 当前用户加入或主理的行程，供清算工作台切换。 */
  async listForUser(userId: number) {
    const rows = await this.trips
      .createQueryBuilder('trip')
      .innerJoin(TripMemberEntity, 'member', 'member.tripId = trip.id')
      .where('member.userId = :userId', { userId })
      .orderBy('trip.departDate', 'ASC')
      .getMany();
    return rows;
  }

  async getById(tripId: number): Promise<TripEntity | null> {
    return this.trips.findOneBy({ id: tripId });
  }

  async requireTrip(tripId: number): Promise<TripEntity> {
    const trip = await this.getById(tripId);
    if (!trip) throw new AppException(ERROR_CODES.TRIP_NOT_FOUND, '行程不存在', 404);
    return trip;
  }

  match(destination: string, date: string, budgetMax: number) {
    return this.trips.find({ where: { destination, departDate: Between(date, date), budgetMax } });
  }
}
