import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripEntity } from '../trip/trip.entity';
import { TripMemberEntity } from '../trip/trip-member.entity';
import { ExpenseController } from './expense.controller';
import { ExpenseEntity } from './expense.entity';
import { ExpenseService } from './expense.service';
import { SettlementShareEntity } from './settlement-share.entity';
import { SettlementController } from './settlement.controller';
import { SettlementEntity } from './settlement.entity';
import { SettlementService } from './settlement.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExpenseEntity, SettlementEntity, SettlementShareEntity, TripEntity, TripMemberEntity]),
    JwtModule.register({ secret: process.env.JWT_SECRET ?? 'dev_secret' })
  ],
  controllers: [ExpenseController, SettlementController],
  providers: [ExpenseService, SettlementService]
})
export class ExpenseModule {}
