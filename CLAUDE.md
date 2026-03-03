# CLAUDE.md

## 项目概述

Open Ontology 是一个受 Palantir Ontology 启发的开源项目，目标是构建面向 Agent 时代的本体平台，提供以业务为中心的统一数据建模框架。当前版本 v0.1.0（MVP），聚焦第一个应用——**Ontology Manager**（本体管理后台）。

仓库处于 **MVP v0.1.0 实现阶段**。规格文档仍是意图的权威来源；新特性必须遵循 SDD 工作流。

## 目录结构

```
apps/
├── web/                              # 前端（React + TypeScript）
│   ├── src/
│   │   ├── api/                      # TanStack Query hooks + 生成的类型
│   │   ├── components/               # 可复用 UI 组件
│   │   ├── pages/                    # 路由级页面组件
│   │   ├── stores/                   # Zustand stores（仅 UI 状态）
│   │   ├── utils/                    # 工具函数（naming、validation 等）
│   │   ├── locales/                  # i18n 翻译文件
│   │   └── generated/                # openapi-typescript 输出（禁止手动编辑）
│   └── package.json
├── server/                           # 后端（FastAPI + Python）
│   ├── app/
│   │   ├── routers/                  # HTTP 层——解析请求，委托给 services
│   │   ├── services/                 # 业务逻辑，事务边界
│   │   ├── domain/                   # Pydantic 模型，纯逻辑，无 I/O
│   │   └── storage/                  # SQLAlchemy 查询，返回 domain 模型
│   ├── alembic/                      # 数据库迁移
│   ├── tests/                        # 测试（unit/ + integration/）
│   └── openapi.json                  # 提交产物——路由变更后重新生成
docs/
├── architecture/                     # 架构设计文档
│   ├── 00-design-principles.md
│   ├── 01-system-architecture.md
│   ├── 02-domain-model.md
│   ├── 03-agent-context-architecture.md
│   ├── 04-tech-stack-recommendations.md
│   ├── 05-data-connectivity.md
│   └── 06-change-management.md
├── prd/                              # 产品需求文档
│   ├── 0 概念定义/
│   └── 0_1_0（MVP）/                 # MVP PRD + UI 设计截图
├── specs/                            # 领域模型规格
│   ├── terminology.md
│   ├── supported-property-types.md
│   ├── object-type-metadata.md
│   ├── link-type-metadata.md
│   └── property-value-formatting.md
└── research/
features/                             # SDD 特性目录
├── _templates/                       # spec / design / tasks 模板
└── v0.1.0/                           # 001 ~ 009 特性包
ops/
└── mysql-sample/                     # 本地 MySQL 样本副本脚本
justfile                              # Monorepo 任务运行器
```

## 技术栈

> 完整论证：`docs/architecture/04-tech-stack-recommendations.md`

| 层 | 技术 | 包管理 |
|---|------|--------|
| 前端 | React 18+ TS, Ant Design 5.x, TanStack Query v5, Zustand v5, Vite | pnpm |
| 后端 | Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2.0 async + asyncpg | uv |
| 数据库 | PostgreSQL 16+, PG 全文搜索（MVP 不引入 Elasticsearch） | — |
| 测试 | pytest + pytest-asyncio（后端）, Vitest（前端单元）, Playwright（E2E） | — |
| Monorepo | Just（justfile）任务运行器 | — |

**类型共享管道**：FastAPI → `openapi.json` → `openapi-typescript` → TS 类型。禁止手写 API 类型。

## 领域术语

在代码和文档中统一使用以下双语术语：

| 中文 | English | 说明 |
|------|---------|------|
| 本体 | Ontology | 组织的完整语义模型 |
| 对象类型 | Object Type | 对现实实体或事件的抽象 |
| 属性 | Property | 对象类型的特征、状态或度量 |
| 链接类型 | Link Type | 对象类型之间的语义关系 |
| 动作类型 | Action Type | 带写回能力的事务操作 |
| 函数 | Function | 自定义业务逻辑（Python/ML） |
| 接口 | Interface | 对象类型的多态形状描述符 |
| 共享属性 | Shared Property | 可跨多个对象类型复用的属性 |
| 对象集 | Object Set | 对象实例的集合 |
| 空间 | Space | 共享一个本体的顶层项目容器 |

## MVP 优先级（v0.1.0）

- **P0**：UI 框架、Object Type CRUD、Link Type CRUD、本体搜索、变更管理/版本控制
- **P1**：属性值格式化、对象关联链接、对象类型复制、本体导入导出（JSON）
- **P2（延后）**：Discover 页定制、对象类型分组、共享属性、Action Type CRUD

## 代码分层规则

### 后端（严格自顶向下，禁止反向导入）

| 层 | 目录 | 职责 | 可导入 |
|---|------|------|--------|
| Routers | `app/routers/` | HTTP 解析、请求校验，委托给 services | services, domain |
| Services | `app/services/` | 业务逻辑，事务边界 | domain, storage |
| Domain | `app/domain/` | Pydantic 模型，纯逻辑，无 I/O | 无（叶子层） |
| Storage | `app/storage/` | SQLAlchemy 查询，返回 domain 模型 | domain |

### 前端

| 层 | 目录 | 职责 |
|---|------|------|
| Pages | `pages/` | 组合组件 + 调用 API hooks + 读取 Zustand stores |
| Components | `components/` | Props 驱动；可使用 API hooks 实现自包含数据组件 |
| API | `api/` | TanStack Query hooks + 自动生成的类型 |
| Stores | `stores/` | 仅 UI 状态（弹窗开关、选中行等） |

## 强制约束

以下规则**不可违反**，违反会产生累积性技术债。

### 架构红线

- **禁止在 routers 中编写业务逻辑** — routers 只负责 HTTP 解析并委托给 services
- **禁止反向导入** — storage 不得导入 services；services 不得导入 routers
- **禁止同步 SQLAlchemy** — 必须使用 async session + asyncpg
- **禁止在前端手写 API 类型** — 必须从 openapi.json 生成
- **禁止将服务端数据放入 Zustand** — 服务端状态属于 TanStack Query cache

### 命名规范

| 场景 | 规范 | 示例 |
|------|------|------|
| Python 文件 | `snake_case.py` | `object_type_service.py` |
| Python 类 | `PascalCase` | `ObjectTypeService` |
| TS 工具文件 | `kebab-case.ts` | `use-object-types.ts` |
| React 组件 | `PascalCase.tsx` | `ObjectTypeTable.tsx` |
| 数据库表 | `snake_case`，复数 | `object_types` |
| API 路径 | `/api/v1/kebab-case` | `/api/v1/object-types` |
| 错误码 | `UPPER_SNAKE`，模块前缀 | `OBJECT_TYPE_API_NAME_CONFLICT` |

### 序列化

- Python 内部：`snake_case`。API JSON 输出：`camelCase`。
- 通过 Pydantic `model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)` 配置，禁止手动重命名字段。

### 数据库

- Schema 变更必须通过 **Alembic 迁移** — 禁止裸 DDL
- 主键使用 `rid`（text，格式：`ri.<namespace>.<type>.<uuid4>`）— 不使用自增 ID
- 错误响应格式：`{ "error": { "code": "...", "message": "...", "details": {} } }`

### i18n

- **禁止在组件中硬编码用户可见字符串** — 必须使用 `t('key')`
- Ant Design 国际化通过 `ConfigProvider` 配置
- PRD 为简体中文；UI 必须支持国际化

## 测试要求

以下规则在编写或修改任何 backend/frontend 源代码时**强制生效**。

**后端**

- 新增 service function → 必须在 `tests/unit/` 中有单元测试（通过 `mock_db_session` mock 数据库）
- 新增 API route → 必须在 `tests/integration/` 中有集成测试（用 `seeded_client`，覆盖 happy path + 主要 error path）
- 完成前执行 `cd apps/server && uv run pytest <test_file> -v` 并展示通过输出

**前端**

- 新增 Zustand store → 必须在 `stores/__tests__/` 中覆盖核心状态转换
- 新增可复用 component → 必须在 `components/__tests__/` 中有渲染测试（Testing Library）
- 完成前执行 `cd apps/web && pnpm test --run` 并确认无失败

**禁止行为**

- 禁止未运行测试就标记任务完成 — 必须运行并展示输出
- 禁止将测试拆分为独立后续任务 — 测试与实现属于同一任务

## 开发工作流（SDD）

所有新特性必须按以下顺序执行（详见 `features/README.md`）：

1. **spec.md** — 定义用户故事、验收标准、边界
2. **评审** — 确认 AC 可测试、边界清晰
3. **design.md** — 设计数据结构、API 契约、组件树、架构决策
4. **tasks.md** — 将 design 拆解为原子任务（每个任务一次 AI 会话可完成）
5. **执行** — 逐任务实施，完成后在 tasks.md 打勾

**核心约束**：每一步只产出该步骤的文件，不得提前执行后续步骤。`design.md` 和 `tasks.md` 未完成前禁止写代码。只有用户明确要求"执行任务"或"开始实现"时，才可编写源代码。

## 外部 MySQL 策略

Open Ontology 主存储为 PostgreSQL；MVP 阶段 MySQL 仅作为外部导入源。

- **禁止**直接对生产级外部数据库执行导入测试
- 统一使用本地样本副本流程：`ops/mysql-sample/refresh.sh`
- 凭据仅存放在 `ops/mysql-sample/.env.mysql-sample.local`，不得提交到仓库
- `ops/mysql-sample/runtime/` 下产物仅用于本地调试，不入 Git

## 自动格式化与提交

`.claude/settings.json` 中的 `PostToolUse` hook 在每次文件变更后自动执行格式化和提交：

- **触发时机**：`Write`、`Edit`、`NotebookEdit` 工具调用后
- **自动格式化**：JS/TS/JSON/CSS/HTML 文件通过 Prettier 格式化；Python 文件通过 Ruff 格式化
- **自动提交**：`git add -A` 后以 `chore: auto-save <filename> (HH:MM:SS)` 为消息提交
- 无变更时跳过提交（幂等）；异步运行不阻塞响应

## 参考文档索引

实现特性前，**先阅读相关文档**：

| 实现内容 | 先阅读 |
|---------|--------|
| Object Type CRUD | `docs/architecture/02-domain-model.md` + `docs/specs/object-type-metadata.md` |
| Link Type CRUD | `docs/architecture/02-domain-model.md`（LinkType 部分）+ `docs/specs/link-type-metadata.md` |
| 属性类型 | `docs/specs/supported-property-types.md` |
| 属性值格式化 | `docs/specs/property-value-formatting.md` |
| 数据连接 | `docs/architecture/05-data-connectivity.md` |
| 变更管理/版本控制 | `docs/architecture/06-change-management.md` |
| UI 设计/交互流程 | PRD + `docs/prd/0_1_0（MVP）/images/` |
| 完整技术栈论证 | `docs/architecture/04-tech-stack-recommendations.md` |
