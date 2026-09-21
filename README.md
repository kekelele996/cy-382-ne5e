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
- **行程共享费用清算**：成员登记本人垫付支出（同行程票据号唯一），由其他成员确认或驳回（驳回可重提）；待确认/待重提清空后才能一键生成清算单，系统按确认支出计算每人净额（正应收、负应付）并保证严格零和，超出计划预算自动标记；清算、冻结状态一次落盘，重复或并发生成只成功一次。
- 预算管理按品类（交通/住宿/餐饮/门票）展示计划费用、实际花费与超支提醒。
- Socket.IO 支持行程成员即时聊天。
- 旅行日记和用户主页为后续扩展预留清晰模块。

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

## 费用清算模块说明

| 规则 | 实现 |
| --- | --- |
| 登记范围 | 仅行程成员可登记，且只能登记**本人垫付、属于当前行程**的支出 |
| 票据去重 | 数据库 `(trip_id, receipt_no)` 唯一索引 + 服务端预检，同行程同票据号不能重复；票据号唯一性按行程隔离 |
| 确认约束 | 登记人**不能确认自己的支出**，须由其他成员确认后才计入；条件更新保证重复/并发确认只成功一次 |
| 驳回重提 | 其他成员可驳回并填写原因，登记人在原记录上修改后重提，重新进入待确认 |
| 清算前置 | 存在「待确认」或「待重提（已驳回）」支出时拒绝生成清算单 |
| 净额零和 | `net = 本人垫付 - 人均均摊`，均摊除不尽时把分位余数补给垫付最多者，净额之和严格为 0 |
| 超支标记 | 支持分品类计划预算（未设置时退回行程预算上限），任一品类或总额超支都在清算单上标记 |
| 一次落盘 | 清算单、成员明细、确认支出批量冻结在**同一事务**提交；进程内互斥 + MySQL `FOR UPDATE` 行锁 + `trip_id` 唯一索引三重保障，重复/并发生成只成功一次 |
| 冻结只读 | 清算后支出与预算全部冻结，不可再增改 |
| 页面一致 | 「费用清算」页的待办、异常、净额、超支全部来自接口聚合数据，刷新后保持一致 |

主要接口（均需 `Authorization: Bearer <token>`，`409/4xx` 返回统一错误码）：

- `POST /api/trips` 发布行程（发布者自动入组）、`POST /api/trips/:id/join` 加入行程
- `GET/PUT /api/trips/:id/budgets` 预算执行情况 / 设置分品类计划预算
- `POST /api/trips/:id/expenses` 登记支出
- `POST /api/trips/:id/expenses/:eid/confirm|reject|resubmit` 确认 / 驳回 / 重提
- `GET /api/trips/:id/overview` 工作台聚合（待办、异常、预估净额、超支、成员）
- `POST /api/trips/:id/settlement/generate` 生成清算单、`GET /api/trips/:id/settlement` 查看

无 Docker/MySQL 环境下可用内存 SQLite 跑业务流测试：

```bash
cd backend
npm run test:all        # 净额零和算法 510 例 + 端到端清算规则 55 项
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
│       │   ├── auth/          # 全局 JwtModule 与守卫
│       │   ├── decorators/    # @CurrentUser
│       │   ├── filters/       # 统一异常过滤器
│       │   ├── guards/        # JWT 守卫
│       │   ├── locking/       # 清算生成按行程互斥
│       │   ├── logger/
│       │   └── transformers/  # DECIMAL <-> number
│       ├── constants
│       ├── config
│       └── modules
│           ├── budget/        # 分品类计划预算与超支判定
│           ├── expense/       # 垫付支出登记/确认/驳回/重提
│           ├── settlement/    # 清算单、净额零和、工作台聚合
│           ├── trip/          # 行程与成员
│           ├── user/
│           ├── companion/
│           ├── chat/
│           └── diary/
├── database
├── frontend
│   └── src
│       └── components/        # 费用清算工作台等组件
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
