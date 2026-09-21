import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('trip_members')
@Unique('uk_trip_member', ['tripId', 'userId'])
export class TripMemberEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'trip_id' }) tripId!: number;
  @Column({ name: 'user_id' }) userId!: number;
  @CreateDateColumn({ name: 'joined_at' }) joinedAt!: Date;
}
