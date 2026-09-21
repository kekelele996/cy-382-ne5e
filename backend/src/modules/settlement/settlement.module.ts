import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BudgetModule } from '../budget/budget.module';
import { ExpenseModule } from '../expense/expense.module';
import { TripModule } from '../trip/trip.module';
import { UserModule } from '../user/user.module';
import { DashboardService } from './dashboard.service';
import { SettlementController } from './settlement.controller';
import { SettlementEntity } from './settlement.entity';
import { SettlementItemEntity } from './settlement-item.entity';
import { SettlementService } from './settlement.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SettlementEntity, SettlementItemEntity]),
    TripModule,
    UserModule,
    ExpenseModule,
    BudgetModule
  ],
  controllers: [SettlementController],
  providers: [SettlementService, DashboardService],
  exports: [SettlementService, DashboardService]
})
export class SettlementModule {}
