import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('settlement_shares')
@Unique('uk_share_settlement_user', ['settlementId', 'userId'])
export class SettlementShareEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'settlement_id' }) settlementId!: number;
  @Column({ name: 'user_id' }) userId!: number;
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 }) paid!: number;
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 }) share!: number;
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 }) net!: number;
}
