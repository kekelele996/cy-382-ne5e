import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ExpenseStatus } from '../../constants/status';
import { DecimalTransformer } from '../../common/transformers/decimal.transformer';

/**
 * 行程垫付支出。
 * 同行程同票据号唯一（PENDING/CONFIRMED/FROZEN 均占用票据号，被驳回的不占用，允许修正后重提）。
 */
@Entity('expenses')
@Index(['tripId', 'receiptNo'], { unique: true })
export class ExpenseEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'trip_id' }) tripId!: number;
  @Column({ name: 'payer_id' }) payerId!: number;
  @Column({ name: 'receipt_no', length: 80 }) receiptNo!: string;
  @Column({ length: 160 }) title!: string;
  @Column({ length: 40 }) category!: string;
  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: new DecimalTransformer() })
  amount!: number;
  @Column({ type: 'varchar', length: 20, default: ExpenseStatus.Pending })
  status!: ExpenseStatus;
  @Column({ name: 'confirmed_by', type: 'int', nullable: true }) confirmedBy?: number | null;
  @Column({ name: 'rejected_by', type: 'int', nullable: true }) rejectedBy?: number | null;
  @Column({ name: 'reject_reason', type: 'varchar', length: 255, nullable: true }) rejectReason?: string | null;
  @Column({ name: 'frozen_at', type: 'datetime', nullable: true }) frozenAt?: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'datetime' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' }) updatedAt!: Date;
}
