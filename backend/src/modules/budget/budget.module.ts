import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpenseEntity } from '../expense/expense.entity';
import { SettlementEntity } from '../settlement/settlement.entity';
import { TripModule } from '../trip/trip.module';
import { BudgetController } from './budget.controller';
import { BudgetEntity } from './budget.entity';
import { BudgetService } from './budget.service';

@Module({
  imports: [TypeOrmModule.forFeature([BudgetEntity, ExpenseEntity, SettlementEntity]), TripModule],
  controllers: [BudgetController],
  providers: [BudgetService],
  exports: [BudgetService]
})
export class BudgetModule {}
