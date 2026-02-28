# Plan: Project Scaffolding（项目脚手架技术方案）

**关联 Spec**: [spec.md](./spec.md)
**状态**: Done（回溯记录）
**架构参考**: [docs/architecture/04-tech-stack-recommendations.md]

> ⚠️ **注意**：本文件为事后补写（retroactive）。F001 在未完成 SDD 流程的情况下直接实施。
> 实际实现与方案基本一致，偏差见文末"实际偏差"章节。

---

## Spec Review 摘要

| AC | 结论 |
|----|------|
| AC1 `docker compose up` 启动所有服务 | 需 docker-compose.yml + Dockerfile x2 |
| AC2 前端 `localhost:5173` 正常加载 | 需 Vite dev server + React 入口 |
| AC3 `localhost:8000/docs` Swagger UI | 需 FastAPI app + uvicorn |
| AC4 数据库连接 + Alembic 迁移 | 需 SQLAlchemy async + alembic.ini |
| AC5 热重载 | Vite HMR（前端）+ uvicorn --reload（后端） |
| AC6 `pnpm test` + `pytest` 可执行 | 需测试框架配置，无需实际用例 |

边界确认：不含生产部署、不含 CI/CD。

---

## 架构决策

### AD-1: Monorepo 布局
采用 pnpm workspaces（`pnpm-workspace.yaml`）管理前端工作区，后端独立 uv 项目（`apps/server/pyproject.toml`）。根目录 `package.json` 仅存放 workspace 配置，不含业务依赖。

### AD-2: 后端目录分层
严格遵循 CLAUDE.md 分层规范：
```
apps/server/
├── app/
│   ├── routers/      # HTTP 层
│   ├── services/     # 业务逻辑层（脚手架阶段空占位）
│   ├── storage/      # 存储层（脚手架阶段空占位）
│   ├── domain/       # 领域模型（脚手架阶段空占位）
│   ├── config.py     # Pydantic Settings
│   ├── database.py   # async SQLAlchemy engine + session factory
│   ├── exceptions.py # 全局异常处理
│   └── main.py       # FastAPI app 初始化
├── alembic/          # 迁移脚本目录
├── alembic.ini
├── pyproject.toml    # uv 依赖 + pytest + ruff 配置
└── tests/
    ├── conftest.py   # 测试夹具
    └── test_health.py
```

### AD-3: 前端目录分层
```
apps/web/
├── src/
│   ├── api/          # TanStack Query hooks（空占位）
│   ├── components/   # 可复用组件（空占位）
│   ├── pages/        # 路由级页面（空占位）
│   ├── stores/       # Zustand stores（空占位）
│   ├── locales/      # i18n 翻译文件（zh-CN/en）
│   ├── generated/    # openapi-typescript 输出（DO NOT EDIT）
│   ├── App.tsx       # 路由 + Provider 组合
│   ├── main.tsx      # React 入口
│   └── vite-env.d.ts
├── package.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

### AD-4: Docker Compose 策略
- 每个服务各有独立 `Dockerfile`
- `docker-compose.yml` 放在根目录，挂载源码目录实现热重载
- PostgreSQL 使用官方镜像，数据通过 named volume 持久化

### AD-5: 测试策略（脚手架阶段）
- 后端：pytest-asyncio + httpx ASGITransport 进行集成测试
- DB 依赖：使用 `unittest.mock.AsyncMock` mock SQLAlchemy session，**不连接真实数据库**
- 前端：Vitest + jsdom + @testing-library/react，脚手架阶段仅确保配置可运行

### AD-6: 类型共享管线
FastAPI → `apps/server/openapi.json`（提交到仓库）→ `openapi-typescript` → `apps/web/src/generated/`

---

## 关键实现细节

### 后端：config.py
使用 `pydantic-settings` 的 `BaseSettings`，从环境变量读取 `DATABASE_URL`、`ENVIRONMENT`、`LOG_LEVEL`。

### 后端：database.py
```python
engine = create_async_engine(settings.DATABASE_URL, ...)
async_session_factory = async_sessionmaker(engine, ...)

async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session
```
FastAPI 通过 `Depends(get_db_session)` 注入 session。

### 后端：main.py
- 注册 `/api/v1/health` 路由
- 注册全局异常处理器（`RequestValidationError`、`HTTPException`）
- 错误响应统一格式：`{ "error": { "code": "...", "message": "...", "details": {} } }`
- 开发环境启用 CORS（`allow_origins=["http://localhost:5173"]`）

### 前端：App.tsx
- `QueryClientProvider`（TanStack Query）
- `ConfigProvider`（Ant Design locale）
- `BrowserRouter`（react-router-dom）

### justfile
定义常用任务快捷命令：`dev-server`、`dev-web`、`test-server`、`test-web`、`lint`、`migrate` 等。

---

## 实际偏差（Deviations from Plan）

| 项目 | 原计划 | 实际实现 | 原因 |
|------|--------|----------|------|
| conftest.py DB 夹具 | 连接测试数据库（docker postgres） | `AsyncMock` mock session | 脚手架阶段不需要真实 DB；避免 CI 依赖 |
| tsconfig.node.json | 标准 Vite node 配置 | 额外加 `"composite": true` | TypeScript project references 需要此字段 |
