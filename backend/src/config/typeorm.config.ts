import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * 默认连接 MySQL 8.0（docker-compose）。
 * 本地集成测试可通过 DB_TYPE=sqlite 切到内存库，CI/无 Docker 环境也能跑通业务流。
 */
export const typeormConfig = (): TypeOrmModuleOptions => {
  if (process.env.DB_TYPE === 'sqlite') {
    return {
      type: 'better-sqlite3',
      database: process.env.SQLITE_PATH ?? ':memory:',
      autoLoadEntities: true,
      synchronize: true
    };
  }
  return {
    type: 'mysql',
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: Number(process.env.DATABASE_PORT ?? 3306),
    username: process.env.DATABASE_USER ?? 'tripmatch',
    password: process.env.DATABASE_PASSWORD ?? 'tripmatch_pass',
    database: process.env.DATABASE_NAME ?? 'tripmatch',
    autoLoadEntities: true,
    synchronize: true
  };
};
