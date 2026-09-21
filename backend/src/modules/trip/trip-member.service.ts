import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERROR_CODES } from '../../constants/errors';
import { AppException } from '../../common/errors/app.exception';
import { TripMemberEntity } from './trip-member.entity';

@Injectable()
export class TripMemberService {
  constructor(@InjectRepository(TripMemberEntity) private readonly members: Repository<TripMemberEntity>) {}

  /** 发布行程时发布者自动成为成员（行程主理人）。 */
  async join(tripId: number, userId: number) {
    const exists = await this.members.findOne({ where: { tripId, userId } });
    if (exists) return exists;
    return this.members.save(this.members.create({ tripId, userId }));
  }

  async listMemberIds(tripId: number): Promise<number[]> {
    const rows = await this.members.find({ where: { tripId }, order: { id: 'ASC' } });
    return rows.map(row => row.userId);
  }

  async isMember(tripId: number, userId: number): Promise<boolean> {
    return (await this.members.count({ where: { tripId, userId } })) > 0;
  }

  /** 登记支出、确认、生成清算等操作的统一鉴权入口：非同行程成员一律拒绝。 */
  async assertMember(tripId: number, userId: number) {
    if (!(await this.isMember(tripId, userId))) {
      throw new AppException(ERROR_CODES.NOT_TRIP_MEMBER, '仅行程成员可操作', 403);
    }
  }
}
