import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { TripService } from './trip.service';

@Controller('api/trips')
export class TripController {
  constructor(private readonly service: TripService) {}

  @Get() list() { return this.service.list(); }

  @Get('match') match(@Query('destination') destination: string, @Query('date') date: string, @Query('budgetMax') budgetMax: string) {
    return this.service.match(destination, date, Number(budgetMax));
  }

  @Post() @UseGuards(JwtGuard) create(@Req() req: any, @Body() body: any) {
    return this.service.create(req.user.userId, body);
  }

  @Post(':id/join') @UseGuards(JwtGuard) join(@Req() req: any, @Param('id') id: string) {
    return this.service.join(Number(id), req.user.userId);
  }

  @Get(':id/members') @UseGuards(JwtGuard) members(@Param('id') id: string) {
    return this.service.memberList(Number(id));
  }

  @Get(':id/budgets') @UseGuards(JwtGuard) budgets(@Param('id') id: string) {
    return this.service.budgetList(Number(id));
  }

  @Post(':id/budgets') @UseGuards(JwtGuard) upsertBudget(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.upsertBudget(Number(id), req.user.userId, body.category, body.planned);
  }
}
