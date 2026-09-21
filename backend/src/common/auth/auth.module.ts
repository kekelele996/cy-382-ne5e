import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtGuard } from '../guards/jwt.guard';

/** 全局复用同一把 JWT 密钥与守卫，避免各业务模块各自注册 JwtModule 导致验签不一致。 */
@Global()
@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_SECRET ?? 'dev_secret' })],
  providers: [JwtGuard],
  exports: [JwtModule, JwtGuard]
})
export class AuthModule {}
