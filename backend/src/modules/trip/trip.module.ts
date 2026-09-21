import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BudgetEntity } from './budget.entity';
import { TripMemberEntity } from './trip-member.entity';
import { TripController } from './trip.controller';
import { TripEntity } from './trip.entity';
import { TripService } from './trip.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TripEntity, TripMemberEntity, BudgetEntity]),
    JwtModule.register({ secret: process.env.JWT_SECRET ?? 'dev_secret' })
  ],
  controllers: [TripController],
  providers: [TripService]
})
export class TripModule {}
