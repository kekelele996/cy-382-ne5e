import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { SettlementStatus } from '../../constants/status';
import { DecimalTransformer } from '../../common/transformers/decimal.transformer';

/** 行程清算单：每行程至多一份，生成即冻结，为零和。 */
@Entity('settlements')
@Index(['tripId'], { unique: true })
export class SettlementEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'trip_id' }) tripId!: number;
  @Column({ name: 'created_by' }) createdBy!: number;
  @Column({ type: 'varchar', length: 20, default: SettlementStatus.Settled })
  status!: SettlementStatus;
  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2, transformer: new DecimalTransformer() })
  totalAmount!: number;
  @Column({ name: 'per_person', type: 'decimal', precision: 12, scale: 2, transformer: new DecimalTransformer() })
  perPerson!: number;
  /** 净额合计，正常为 0.00；落盘留存以便核验。 */
  @Column({ name: 'net_sum', type: 'decimal', precision: 12, scale: 2, transformer: new DecimalTransformer() })
  netSum!: number;
  @Column({ name: 'over_budget', type: 'boolean', default: false }) overBudget!: boolean;
  @Column({ name: 'over_budget_detail', type: 'simple-json', nullable: true })
  overBudgetDetail?: {
    totalExceeded: boolean;
    totalOverAmount: number;
    categoryOverAmount: number;
    categories: Array<{ category: string; planned: number; spent: number; overAmount: number }>;
  } | null;
  @Column({ name: 'member_count' }) memberCount!: number;
  @CreateDateColumn({ name: 'created_at', type: 'datetime' }) createdAt!: Date;
}
