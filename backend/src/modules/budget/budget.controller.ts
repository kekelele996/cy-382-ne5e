import { Body, Controller, Get, Param, ParseIntPipe, Put, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { BudgetService } from './budget.service';

@Controller('api/trips/:tripId/budgets')
@UseGuards(JwtGuard)
export class BudgetController {
  constructor(private readonly service: BudgetService) {}

  @Get()
  summary(@Param('tripId', ParseIntPipe) tripId: number) {
    return this.service.summary(tripId);
  }

  @Put()
  setPlans(
    @Param('tripId', ParseIntPipe) tripId: number,
    @CurrentUser() user: AuthUser,
    @Body() body: { items: Array<{ category: string; planned: number }> }
  ) {
    return this.service.setPlans(tripId, user.userId, body.items ?? []);
  }
}
