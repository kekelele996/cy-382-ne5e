import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { DecimalTransformer } from '../../common/transformers/decimal.transformer';

/** 行程分品类计划预算（交通/住宿/餐饮/门票等），用于清算时判定是否超计划预算。 */
@Entity('budgets')
@Index(['tripId', 'category'], { unique: true })
export class BudgetEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'trip_id' }) tripId!: number;
  @Column({ length: 40 }) category!: string;
  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: new DecimalTransformer() })
  planned!: number;
}
