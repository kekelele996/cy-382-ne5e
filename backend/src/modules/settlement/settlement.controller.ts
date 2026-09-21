import { Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { DashboardService } from './dashboard.service';
import { SettlementService } from './settlement.service';

@Controller('api/trips/:tripId')
@UseGuards(JwtGuard)
export class SettlementController {
  constructor(private readonly settlements: SettlementService, private readonly dashboard: DashboardService) {}

  /** 工作台：待办、异常、净额（预估/最终）、超支。 */
  @Get('overview')
  overview(@Param('tripId', ParseIntPipe) tripId: number, @CurrentUser() user: AuthUser) {
    return this.dashboard.overview(tripId, user.userId);
  }

  /** 查看清算单（不存在返回 null）。 */
  @Get('settlement')
  get(@Param('tripId', ParseIntPipe) tripId: number, @CurrentUser() user: AuthUser) {
    return this.settlements.getByTrip(tripId, user.userId);
  }

  /** 生成清算单：有待确认/待重提支出时拒绝；重复或并发只成功一次。 */
  @Post('settlement/generate')
  generate(@Param('tripId', ParseIntPipe) tripId: number, @CurrentUser() user: AuthUser) {
    return this.settlements.generate(tripId, user.userId);
  }
}
