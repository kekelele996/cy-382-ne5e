import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { TripMemberService } from './trip-member.service';
import { TripService } from './trip.service';

@Controller('api/trips')
export class TripController {
  constructor(private readonly service: TripService, private readonly memberService: TripMemberService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get('my')
  @UseGuards(JwtGuard)
  listMine(@CurrentUser() user: AuthUser) {
    return this.service.listForUser(user.userId);
  }

  @Get('match')
  match(
    @Query('destination') destination: string,
    @Query('date') date: string,
    @Query('budgetMax') budgetMax: string
  ) {
    return this.service.match(destination, date, Number(budgetMax));
  }

  @Get(':tripId')
  @UseGuards(JwtGuard)
  async detail(@Param('tripId', ParseIntPipe) tripId: number, @CurrentUser() user: AuthUser) {
    await this.memberService.assertMember(tripId, user.userId);
    const trip = await this.service.requireTrip(tripId);
    const memberIds = await this.memberService.listMemberIds(tripId);
    return { ...trip, memberIds };
  }

  @Post()
  @UseGuards(JwtGuard)
  create(@Body() body: any, @CurrentUser() user: AuthUser) {
    return this.service.create(
      {
        destination: body.destination,
        departDate: body.departDate,
        days: Number(body.days),
        budgetMin: body.budgetMin === undefined || body.budgetMin === null ? undefined : Number(body.budgetMin),
        budgetMax: body.budgetMax === undefined || body.budgetMax === null ? undefined : Number(body.budgetMax),
        transport: body.transport,
        companionCount: Number(body.companionCount ?? 1),
        genderPreference: body.genderPreference
      },
      user.userId
    );
  }

  /** 加入行程成为成员，之后才能登记/确认支出并参与清算。 */
  @Post(':tripId/join')
  @UseGuards(JwtGuard)
  async join(@Param('tripId', ParseIntPipe) tripId: number, @CurrentUser() user: AuthUser) {
    await this.service.requireTrip(tripId);
    return this.memberService.join(tripId, user.userId);
  }
}
