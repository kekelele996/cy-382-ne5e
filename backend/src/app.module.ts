import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './common/auth/auth.module';
import { typeormConfig } from './config/typeorm.config';
import { BudgetModule } from './modules/budget/budget.module';
import { ChatModule } from './modules/chat/chat.module';
import { CompanionModule } from './modules/companion/companion.module';
import { DiaryModule } from './modules/diary/diary.module';
import { ExpenseModule } from './modules/expense/expense.module';
import { SettlementModule } from './modules/settlement/settlement.module';
import { TripModule } from './modules/trip/trip.module';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(typeormConfig()),
    AuthModule,
    UserModule,
    TripModule,
    CompanionModule,
    ChatModule,
    DiaryModule,
    BudgetModule,
    ExpenseModule,
    SettlementModule
  ]
})
export class AppModule {}
