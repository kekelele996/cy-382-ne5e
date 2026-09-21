import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { SettlementStatus } from '../../constants/status';

@Entity('settlements')
@Unique('uk_settlement_trip', ['tripId'])
export class SettlementEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'trip_id' }) tripId!: number;
  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2 }) totalAmount!: number;
  @Column({ name: 'planned_budget', type: 'decimal', precision: 12, scale: 2, default: 0 }) plannedBudget!: number;
  @Column({ name: 'member_count' }) memberCount!: number;
  @Column({ name: 'over_budget', type: 'boolean', default: false }) overBudget!: boolean;
  @Column({ length: 20, default: SettlementStatus.Generated }) status!: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}
