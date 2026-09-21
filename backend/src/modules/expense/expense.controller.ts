import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { ExpenseService } from './expense.service';

@Controller('api/trips/:tripId/expenses')
@UseGuards(JwtGuard)
export class ExpenseController {
  constructor(private readonly service: ExpenseService) {}

  @Get()
  async list(@Param('tripId', ParseIntPipe) tripId: number, @CurrentUser() user: AuthUser) {
    const rows = await this.service.listForTrip(tripId);
    return this.service.decorate(rows);
  }

  /** 登记本人垫付且属于当前行程的支出。 */
  @Post()
  register(
    @Param('tripId', ParseIntPipe) tripId: number,
    @CurrentUser() current: AuthUser,
    @Body() body: { receiptNo: string; title: string; category: string; amount: number }
  ) {
    return this.service.register({ ...body, tripId }, current.userId);
  }

  /** 由其他成员确认（登记人确认本人支出会被拒绝）。 */
  @Post(':expenseId/confirm')
  confirm(
    @Param('tripId', ParseIntPipe) tripId: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @CurrentUser() current: AuthUser
  ) {
    return this.service.confirm(tripId, expenseId, current.userId);
  }

  /** 由其他成员驳回，驳回后登记人可重提。 */
  @Post(':expenseId/reject')
  reject(
    @Param('tripId', ParseIntPipe) tripId: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @CurrentUser() current: AuthUser,
    @Body() body: { reason?: string }
  ) {
    return this.service.reject(tripId, expenseId, current.userId, body?.reason ?? '');
  }

  /** 登记人就被驳回的支出修正后重提。 */
  @Post(':expenseId/resubmit')
  resubmit(
    @Param('tripId', ParseIntPipe) tripId: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @CurrentUser() current: AuthUser,
    @Body() body: { receiptNo?: string; title?: string; category?: string; amount?: number }
  ) {
    return this.service.resubmit(tripId, expenseId, current.userId, body ?? {});
  }
}
