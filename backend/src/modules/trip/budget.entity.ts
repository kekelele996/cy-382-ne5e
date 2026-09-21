import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('budgets')
export class BudgetEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'trip_id' }) tripId!: number;
  @Column({ length: 40 }) category!: string;
  @Column({ type: 'decimal', precision: 10, scale: 2 }) planned!: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) spent!: number;
}
