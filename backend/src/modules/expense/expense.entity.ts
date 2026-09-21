import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { ExpenseStatus } from '../../constants/status';

@Entity('expenses')
@Unique('uk_expense_trip_receipt', ['tripId', 'receiptNo'])
export class ExpenseEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'trip_id' }) tripId!: number;
  @Column({ name: 'payer_id' }) payerId!: number;
  @Column({ name: 'receipt_no', length: 64 }) receiptNo!: string;
  @Column({ length: 40 }) category!: string;
  @Column({ type: 'decimal', precision: 10, scale: 2 }) amount!: number;
  @Column({ length: 255, nullable: true }) note?: string;
  @Column({ length: 20, default: ExpenseStatus.Pending }) status!: string;
  @Column({ name: 'confirmed_by', nullable: true }) confirmedBy?: number | null;
  @Column({ name: 'confirmed_at', type: 'timestamp', nullable: true }) confirmedAt?: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}
