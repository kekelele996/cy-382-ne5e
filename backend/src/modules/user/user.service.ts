import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { In, Repository } from 'typeorm';
import { ERROR_CODES } from '../../constants/errors';
import { AppException } from '../../common/errors/app.exception';
import { UserEntity } from './user.entity';

@Injectable()
export class UserService {
  constructor(@InjectRepository(UserEntity) private readonly users: Repository<UserEntity>, private readonly jwt: JwtService) {}

  private publicView(user: UserEntity) {
    return { id: user.id, email: user.email, nickname: user.nickname, bio: user.bio ?? null };
  }

  async register(email: string, nickname: string, password: string) {
    if (!email || !nickname || !password) {
      throw new AppException(ERROR_CODES.VALIDATION_FAILED, '邮箱、昵称和密码不能为空');
    }
    const existing = await this.users.findOneBy({ email });
    if (existing) throw new AppException(ERROR_CODES.VALIDATION_FAILED, '该邮箱已注册');
    const user = this.users.create({ email, nickname, passwordHash: await bcrypt.hash(password, 10) });
    const saved = await this.users.save(user);
    return { ...this.publicView(saved), token: this.issueToken(saved) };
  }

  async login(email: string, password: string) {
    const user = await this.users.findOneBy({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppException(ERROR_CODES.INVALID_CREDENTIALS, '邮箱或密码错误', 401);
    }
    return { token: this.issueToken(user), user: this.publicView(user) };
  }

  profile(userId: number) {
    return this.users.findOneBy({ id: userId }).then(user => (user ? this.publicView(user) : null));
  }

  /** 供清算模块批量解析成员昵称，保持页面刷新后展示一致。 */
  async nameMap(ids: number[]): Promise<Record<number, string>> {
    const unique = Array.from(new Set(ids));
    if (unique.length === 0) return {};
    const users = await this.users.find({ where: { id: In(unique) } });
    return Object.fromEntries(users.map(user => [user.id, user.nickname]));
  }

  private issueToken(user: UserEntity) {
    return this.jwt.sign({ userId: user.id, nickname: user.nickname });
  }
}
