import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** 行程成员：只有同行程成员才能登记、确认支出并参与清算均摊。 */
@Entity('trip_members')
@Index(['tripId', 'userId'], { unique: true })
export class TripMemberEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'trip_id' }) tripId!: number;
  @Column({ name: 'user_id' }) userId!: number;
  @CreateDateColumn({ name: 'joined_at', type: 'datetime' }) joinedAt!: Date;
}
