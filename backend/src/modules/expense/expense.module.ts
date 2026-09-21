import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettlementEntity } from '../settlement/settlement.entity';
import { TripModule } from '../trip/trip.module';
import { UserModule } from '../user/user.module';
import { ExpenseController } from './expense.controller';
import { ExpenseEntity } from './expense.entity';
import { ExpenseService } from './expense.service';

@Module({
  imports: [TypeOrmModule.forFeature([ExpenseEntity, SettlementEntity]), TripModule, UserModule],
  controllers: [ExpenseController],
  providers: [ExpenseService],
  exports: [ExpenseService, TypeOrmModule]
})
export class ExpenseModule {}
