# Tasks: Project Scaffolding（原子任务清单）

**关联 Plan**: [design.md](./design.md)
**状态**: Done（回溯记录，所有任务已完成）

> ⚠️ **注意**：本文件为事后补写（retroactive）。实际实施顺序可能与列出顺序略有不同。
> 所有任务均已完成，偏差记录在每个任务的备注中。

---

## Group 1：根目录配置

- [x] **T001** `pnpm-workspace.yaml` — 声明 `apps/web` 为 pnpm workspace 成员
- [x] **T002** `package.json`（根目录）— workspace root，含 `"private": true`，无业务依赖
- [x] `pnpm-lock.yaml` — 随 `pnpm install` 自动生成
- [x] **T003** `docker-compose.yml` — 定义 `api`、`web`、`db` 三个服务；db 使用 named volume
- [x] **T004** `justfile` — 定义 `dev-server`、`dev-web`、`test-server`、`test-web`、`lint`、`migrate` 等快捷命令
- [x] **T005** `README.md` — 本地启动说明（前置依赖版本、`docker compose up` 步骤）

---

## Group 2：后端脚手架

- [x] **T010** `apps/server/pyproject.toml` — uv 依赖（fastapi, uvicorn, sqlalchemy[asyncio], asyncpg, alembic, pydantic, pydantic-settings）+ dev 依赖（pytest, pytest-asyncio, httpx, ruff）+ ruff/pytest 配置
- [x] `apps/server/uv.lock` — 随 `uv sync` 自动生成
- [x] **T011** `apps/server/app/__init__.py` — 空文件，标记为 Python package
- [x] **T012** `apps/server/app/config.py` — `pydantic-settings` BaseSettings，读取 `DATABASE_URL`、`ENVIRONMENT`、`LOG_LEVEL`
- [x] **T013** `apps/server/app/database.py` — async SQLAlchemy engine + `async_sessionmaker` + `get_db_session` 依赖注入函数
- [x] **T014** `apps/server/app/exceptions.py` — 全局异常处理器；统一错误格式 `{ "error": { "code", "message", "details" } }`
- [x] **T015** `apps/server/app/main.py` — FastAPI app 初始化，注册路由、异常处理器、CORS 中间件
- [x] **T016** `apps/server/app/routers/__init__.py` + `apps/server/app/routers/health.py` — `/api/v1/health` GET 端点
- [x] **T017** `apps/server/app/domain/__init__.py` + `apps/server/app/domain/common.py` — 空占位（PaginatedResponse 等公共模型）
- [x] **T018** `apps/server/app/storage/__init__.py` — 空占位
- [x] **T019** `apps/server/app/services/` — 目录结构占位（services 层在后续特性中实现）
- [x] **T020** `apps/server/alembic/` — `alembic init` 生成；修改 `env.py` 使用 async engine
- [x] **T021** `apps/server/alembic.ini` — 配置 `script_location`，`sqlalchemy.url` 由环境变量覆盖
- [x] **T022** `apps/server/Dockerfile` — Python 3.12 slim 镜像；uvicorn `--reload` 开发模式
- [x] **T023** `apps/server/tests/__init__.py` — 空文件
- [x] **T024** `apps/server/tests/conftest.py` — `client` fixture（AsyncMock db session + ASGITransport）
  - *偏差*：原计划使用真实测试 DB，实际改为 `AsyncMock` mock，避免脚手架阶段的 DB 依赖
- [x] **T025** `apps/server/tests/test_health.py` — 验证 `/api/v1/health` 返回 200

---

## Group 3：前端脚手架

- [x] **T030** `apps/web/package.json` — 依赖：react 18, antd 5, @tanstack/react-query v5, zustand v5, react-router-dom v6, i18next, axios, dayjs；devDeps：vite 6, vitest 2, typescript 5.7, openapi-typescript
- [x] **T031** `apps/web/tsconfig.json` — 主 TypeScript 配置（`"composite": true`，strict mode）
- [x] **T032** `apps/web/tsconfig.node.json` — Vite node 环境 TS 配置
  - *偏差*：加入 `"composite": true`，满足 TypeScript project references 要求
- [x] **T033** `apps/web/vite.config.ts` — Vite + React 插件；dev proxy `/api` → `localhost:8000`；test 配置（jsdom environment）
- [x] **T034** `apps/web/index.html` — Vite 入口 HTML
- [x] **T035** `apps/web/src/vite-env.d.ts` — Vite 客户端类型声明
- [x] **T036** `apps/web/src/main.tsx` — React 18 `createRoot` 入口
- [x] **T037** `apps/web/src/App.tsx` — `QueryClientProvider` + `ConfigProvider`（Ant Design）+ `BrowserRouter` + 路由占位
- [x] **T038** `apps/web/src/api/` — 目录占位（TanStack Query hooks 在后续特性中实现）
- [x] **T039** `apps/web/src/components/` — 目录占位
- [x] **T040** `apps/web/src/pages/` — 目录占位
- [x] **T041** `apps/web/src/stores/` — 目录占位
- [x] **T042** `apps/web/src/generated/` — 目录占位（openapi-typescript 输出，DO NOT EDIT）
- [x] **T043** `apps/web/src/locales/` — i18n 翻译文件（`zh-CN.json`、`en.json`）
- [x] **T044** `apps/web/Dockerfile` — Node 镜像；`pnpm dev --host` 开发模式
- [x] **T045** `apps/web/tests/` — 测试目录占位（Vitest 配置在 vite.config.ts 中）

---

## Group 4：集成验证

- [x] **T050** 验证 `docker compose up` 启动无报错（AC1）
- [x] **T051** 验证 `http://localhost:5173` 前端页面加载（AC2）
- [x] **T052** 验证 `http://localhost:8000/docs` Swagger UI（AC3）
- [x] **T053** 验证 `alembic upgrade head` 可执行（AC4）
- [x] **T054** 验证 `pytest` 通过（AC6 后端）
- [x] **T055** 验证 `pnpm test` 通过（AC6 前端）

---

## 偏差汇总

| Task | 偏差描述 |
|------|---------|
| T024 | conftest.py 使用 `AsyncMock` mock DB session，而非连接真实测试数据库 |
| T032 | tsconfig.node.json 增加 `"composite": true` 字段 |
