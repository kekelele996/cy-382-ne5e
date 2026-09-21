import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeormConfig } from './config/typeorm.config';
import { UserModule } from './modules/user/user.module';
import { TripModule } from './modules/trip/trip.module';
import { CompanionModule } from './modules/companion/companion.module';
import { ChatModule } from './modules/chat/chat.module';
import { DiaryModule } from './modules/diary/diary.module';
import { ExpenseModule } from './modules/expense/expense.module';

@Module({ imports: [TypeOrmModule.forRoot(typeormConfig()), UserModule, TripModule, CompanionModule, ChatModule, DiaryModule, ExpenseModule] })
export class AppModule {}
