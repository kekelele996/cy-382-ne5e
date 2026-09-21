import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripController } from './trip.controller';
import { TripEntity } from './trip.entity';
import { TripMemberEntity } from './trip-member.entity';
import { TripMemberService } from './trip-member.service';
import { TripService } from './trip.service';

@Module({
  imports: [TypeOrmModule.forFeature([TripEntity, TripMemberEntity])],
  controllers: [TripController],
  providers: [TripService, TripMemberService],
  exports: [TripService, TripMemberService, TypeOrmModule]
})
export class TripModule {}
