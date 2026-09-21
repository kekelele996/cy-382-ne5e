import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { SettlementService } from './settlement.service';

@Controller('api/settlements')
@UseGuards(JwtGuard)
export class SettlementController {
  constructor(private readonly service: SettlementService) {}

  @Post() generate(@Req() req: any, @Body() body: any) {
    return this.service.generate(req.user.userId, Number(body.tripId));
  }

  @Get() findByTrip(@Req() req: any, @Query('tripId') tripId: string) {
    return this.service.findByTrip(req.user.userId, Number(tripId));
  }
}
