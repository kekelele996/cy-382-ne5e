import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { DecimalTransformer } from '../../common/transformers/decimal.transformer';

/**
 * 清算单成员明细。
 * net = paid - share：正数代表应收（垫付多于均摊），负数代表应付，全员净额之和为 0。
 */
@Entity('settlement_items')
@Index(['settlementId', 'userId'], { unique: true })
export class SettlementItemEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'settlement_id' }) settlementId!: number;
  @Column({ name: 'trip_id' }) tripId!: number;
  @Column({ name: 'user_id' }) userId!: number;
  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: new DecimalTransformer() })
  paid!: number;
  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: new DecimalTransformer() })
  share!: number;
  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: new DecimalTransformer() })
  net!: number;
}
