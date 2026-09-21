import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { ExpenseService } from './expense.service';

@Controller('api/expenses')
@UseGuards(JwtGuard)
export class ExpenseController {
  constructor(private readonly service: ExpenseService) {}

  @Post() register(@Req() req: any, @Body() body: any) {
    return this.service.register(req.user.userId, body);
  }

  @Get() list(@Req() req: any, @Query('tripId') tripId: string) {
    return this.service.list(req.user.userId, Number(tripId));
  }

  @Post(':id/confirm') confirm(@Req() req: any, @Param('id') id: string) {
    return this.service.confirm(req.user.userId, Number(id));
  }

  @Post(':id/reject') reject(@Req() req: any, @Param('id') id: string) {
    return this.service.reject(req.user.userId, Number(id));
  }

  @Post(':id/resubmit') resubmit(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.resubmit(req.user.userId, Number(id), body);
  }
}
