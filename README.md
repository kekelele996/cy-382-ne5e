# 旅伴匹配与行程共享平台

帮助用户发布旅行计划、匹配旅伴、协作规划行程并在旅途中实时沟通。

## 快速启动

```bash
cp .env.example .env
docker compose up -d --build
```

访问地址：前端 http://localhost:18402 ，后端 http://localhost:19402/health 。

## 项目主要功能

- 发布包含目的地、时间、预算、交通方式和旅伴偏好的行程。
- 根据目的地、时间和预算做旅伴匹配评分。
- 行程协作看板维护每日安排、住宿和交通方案。
- 预算管理展示计划费用和实际花费。
- 行程共享费用清算：成员登记本人垫付支出，其他成员确认后计入，一键生成零和清算单。
- Socket.IO 支持行程成员即时聊天。
- 旅行日记和用户主页为后续扩展预留清晰模块。

## 费用清算规则

- 成员只能登记本人垫付且属于当前行程的支出；同行程同票据号唯一，重复登记会被拒绝。
- 登记人不能确认自己的支出，须由其他成员确认；驳回的支出进入「待重提」，由登记人修改后重新提交。
- 存在待确认或待重提支出时不能生成清算单。
- 生成清算单时按已确认支出均摊计算每人净额（整数分计算，余数确定性分摊，净额严格零和），超出计划预算自动标记超支。
- 清算单、支出冻结（SETTLED）与行程状态在同一数据库事务落盘；行程行锁 + 唯一索引保证并发生成只成功一次，条件更新保证重复确认只成功一次。

### 主要接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | /api/expenses | 登记本人垫付支出（需登录、为行程成员） |
| GET | /api/expenses?tripId= | 查询行程支出列表 |
| POST | /api/expenses/:id/confirm | 确认他人支出（幂等） |
| POST | /api/expenses/:id/reject | 驳回他人支出，进入待重提 |
| POST | /api/expenses/:id/resubmit | 登记人修改并重新提交 |
| POST | /api/settlements | 生成清算单（单事务，幂等） |
| GET | /api/settlements?tripId= | 查询清算单与每人净额 |
| POST | /api/trips/:id/join | 加入行程成为成员 |
| GET/POST | /api/trips/:id/budgets | 查询/设置分类计划预算 |

## 本地开发方式

```bash
cd backend
npm install
npm run start:dev
```

```bash
cd frontend
npm install
npm run dev
```

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | React 18、TypeScript、Ant Design、Vite、高德地图 JS API |
| 后端 | NestJS、TypeScript、TypeORM、JWT、Socket.IO |
| 数据库 | MySQL 8.0 |
| 部署 | Docker Compose、Nginx |

## 项目目录结构

```text
.
├── backend
│   └── src
│       ├── common
│       ├── constants
│       ├── config
│       └── modules
│           ├── user          # 注册登录
│           ├── trip          # 行程、成员、分类预算
│           ├── expense       # 支出登记/确认/驳回/重提、清算单生成
│           ├── companion     # 旅伴匹配
│           ├── chat          # 即时聊天
│           └── diary         # 旅行日记
├── database
├── frontend
│   └── src
│       └── pages             # SettlementPage 费用清算页
└── docker-compose.yml
```

## 环境变量说明

| 变量 | 说明 |
| --- | --- |
| COMPOSE_PROJECT_NAME | Compose 项目名，默认 tripmatch |
| DATABASE_HOST | MySQL 服务主机名 |
| DATABASE_NAME | 数据库名称 |
| DATABASE_USER | 数据库用户 |
| JWT_SECRET | JWT 签名密钥 |
| AMAP_KEY | 高德地图 JS API Key |

## Docker 部署说明

- 前端端口：`18402:80`
- 后端端口：`19402:3000`
- MySQL 数据通过命名卷 `tripmatch-db-data` 持久化。
- Nginx 同时代理 `/api` 与 `/socket.io`，支持 WebSocket Upgrade。

## License

MIT
