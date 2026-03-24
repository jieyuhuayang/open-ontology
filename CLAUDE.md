# CLAUDE.md

## 项目概述

Open Ontology 是一个受 Palantir Ontology 启发的开源项目，目标是构建面向 Agent 时代的本体平台，提供以业务为中心的统一数据建模框架。v0.1.0 MVP（**Ontology Manager** 本体管理后台）已完成。当前处于 **v0.2.0（AI-Assisted Ontology Building）** 开发阶段，聚焦 Agent 辅助本体构建能力，包括 deepagents 引擎、`oo` CLI 统一能力层、素材分析与蓝图生成。

规格文档仍是意图的权威来源；新特性必须遵循 SDD 工作流。
## 目录结构

```
apps/
├── web/src/                          # 前端（React + TypeScript）
│   ├── api/                          # TanStack Query hooks + 生成的类型
│   ├── components/                   # 可复用 UI 组件
│   ├── pages/                        # 路由级页面组件
│   ├── stores/                       # Zustand stores（仅 UI 状态）
│   ├── utils/                        # 工具函数（naming、validation 等）
│   ├── locales/                      # i18n 翻译文件
│   └── generated/                    # openapi-typescript 输出（禁止手动编辑）
├── server/                           # 后端（FastAPI + Python）
│   ├── app/routers/                  # HTTP 层——委托给 services
│   ├── app/services/                 # 业务逻辑，事务边界
│   ├── app/domain/                   # Pydantic 模型，纯逻辑，无 I/O
│   ├── app/storage/                  # SQLAlchemy 查询，返回 domain 模型
│   ├── app/agent/                    # Agent 引擎（deepagents + SSE + prompts + skills）
│   ├── cli/                          # `oo` CLI 入口（Typer，8 个命令模块）
│   ├── alembic/                      # 数据库迁移
│   ├── tests/                        # 测试（unit/ + integration/）
│   └── openapi.json                  # 提交产物——路由变更后重新生成
docs/
├── architecture/                     # 00~06 架构设计文档 + README
├── operations/                       # 运维操作文档
├── prd/                              # 产品需求文档 + UI 设计截图
├── review/                           # 代码审查记录
├── specs/                            # 领域模型规格（术语、属性类型、元数据等）
└── research/                         # 技术调研笔记
features/                             # SDD 特性目录
├── _templates/                       # spec / tasks 模板
├── v0.1.0/                           # 001 ~ 011 特性包（已完成）
└── v0.2.0/                           # 012 ~ 019 特性包 + release-contract.md
e2e/                                  # Playwright E2E 测试
├── helpers/                          # 共享工具（antd.ts, api.ts, fixtures.ts）
└── *.spec.ts                         # 测试文件
ops/mysql-sample/                     # 本地 MySQL 样本副本脚本
justfile                              # Monorepo 任务运行器
```

## 技术栈

> 完整论证：`docs/architecture/04-tech-stack-recommendations.md`

| 层 | 技术 | 包管理 |
|---|------|--------|
| 前端 | React 18+ TS, Ant Design 5.x, TanStack Query v5, Zustand v5, Vite | pnpm |
| 后端 | Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2.0 async + asyncpg | uv |
| Agent/CLI | deepagents, LangGraph checkpoint, Typer, Rich | uv |
| 数据库 | PostgreSQL 16+, PG 全文搜索（不引入 Elasticsearch） | — |
| 测试 | pytest + pytest-asyncio（后端）, Vitest（前端单元）, Playwright（E2E） | — |
| Monorepo | Just（justfile）任务运行器 | — |

**类型共享管道**：FastAPI → `openapi.json` → `openapi-typescript` → TS 类型。禁止手写 API 类型。

## 本地开发启动（Docker 模式）

> PostgreSQL 16 通过 Docker Compose 运行（`docker-compose.yml` 中的 `db` 服务），无需本地安装。
> 连接数据库：`docker exec -it openontology-db-1 psql -U ontology -d open_ontology`

```bash
# 1. 启动 PostgreSQL（后台运行）
docker compose up -d db

# 2. 数据库迁移（幂等，每次启动前跑一下确保表结构最新）
cd apps/server && PYTHONPATH=. uv run alembic upgrade head

# 3. 启动后端（必须在 apps/server 目录下，必须设 PYTHONPATH=.）
cd apps/server && PYTHONPATH=. uv run uvicorn app.main:app --reload --port 8000

# 4. 启动前端（另开终端）
cd apps/web && pnpm dev

# 5. Agent 功能需要 LLM API Key（可选，不影响 v0.1.0 功能）
#    在 apps/server/.env 中配置：ANTHROPIC_API_KEY=sk-...
```

- 后端默认连接：`postgresql+asyncpg://ontology:ontology@localhost:5432/open_ontology`
- 前端默认：http://localhost:5173（端口被占则自动递增）
- CLI 工具：`cd apps/server && uv run oo --help`
- 3D 星空 Demo 路由：`/demo/canvas`

## 领域术语

在代码和文档中统一使用以下双语术语：

| 中文 | English | 说明 |
|------|---------|------|
| 本体 | Ontology | 组织的完整语义模型 |
| 对象类型 | Object Type | 对现实实体或事件的抽象 |
| 属性 | Property | 对象类型的特征、状态或度量 |
| 链接类型 | Link Type | 对象类型之间的语义关系 |
| 动作类型 | Action Type | 带写回能力的事务操作 |
| 函数 / 接口 | Function / Interface | 自定义逻辑 / 多态形状描述符 |
| 共享属性 | Shared Property | 可跨对象类型复用的属性 |
| 对象集 / 空间 | Object Set / Space | 对象实例集合 / 顶层项目容器 |

## MVP 优先级（v0.1.0）

- **P0**：UI 框架、Object Type CRUD、Link Type CRUD、本体搜索、变更管理/版本控制
- **P1**：属性值格式化、对象关联链接、~~对象类型复制~~（延后到 v0.2.0）、~~本体导入导出（JSON）~~（延后到 v0.2.0）
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
- UI 必须支持国际化

## 测试要求

以下规则在编写或修改任何 backend/frontend 源代码时**强制生效**。

**后端（Test-First）**

- **开发顺序：先写测试（红），再写实现（绿）** — tasks.md 中后端测试任务必须排在对应实现任务之前
- 新增 service function → 必须在 `tests/unit/` 中有单元测试（通过 `mock_db_session` mock 数据库）
- 新增 API route → 必须在 `tests/integration/` 中有集成测试（用 `seeded_client`，覆盖 happy path + 主要 error path）
- 完成前执行 `cd apps/server && uv run pytest <test_file> -v` 并展示通过输出

**前端（Test-Alongside）**

- 新增 page → 必须在 `pages/<Resource>/__tests__/` 中有渲染 + 核心交互测试（Testing Library）
- 新增 Zustand store → 必须在 `stores/__tests__/` 中覆盖核心状态转换
- 新增可复用 component → 必须在 `components/__tests__/` 中有渲染测试（Testing Library）
- 前端测试与实现可在同一任务内完成（无需 test-first 分离）
- 完成前执行 `cd apps/web && pnpm test --run` 并确认无失败

**E2E（Feature 完成后，强制）**

- **每个 feature 全部任务完成后，必须调用 `/e2e-test <feature_dir>` 生成并运行 E2E 测试** — 即使是纯后端改动也可能影响端到端流程，不得跳过
- E2E 测试覆盖 spec.md 中的 **UI 交互流程类 AC**（表单、wizard、批量操作、跨页面导航）
- 纯 API 行为的 AC 由后端集成测试覆盖，但仍需 E2E 验证相关页面未因后端变更产生回归
- 共享 Ant Design 交互函数在 `e2e/helpers/antd.ts`，禁止在 spec 文件中重复定义
- 测试数据 ID 统一 `e2e-<feature>-` 前缀，确保跨套件隔离
- 完成前执行 `npx playwright test e2e/<test_file>.spec.ts --reporter=list` 并确认通过

**E2E 数据隔离（强制）**

- **禁止无条件删除所有资源** — cleanup 必须按前缀或白名单过滤，只删除本套件创建的数据
- **前缀最短 5 字符** — `cleanupByPrefix()` 内置安全检查，短前缀会抛错
- **cleanup 必须双重执行** — setup 阶段清理上次残留 + 末尾任务清理本次数据
- **E2E 测试运行前后，非测试数据必须保持不变** — 这是不可违反的红线
- 使用共享 helper `cleanupByPrefix(request, 'e2e-<suite>-')` 进行清理（`e2e/helpers/fixtures.ts`）

**禁止行为**

- 禁止未运行测试就标记任务完成 — 必须运行并展示输出
- 禁止将测试拆分为独立后续任务 — 测试与实现属于同一任务

## 任务级审查（L1）

在每个 SDD 任务完成后、打勾前，必须执行 `/task-review <feature_dir> <task_id>` 进行 L1 轻量审查。

**三层审查架构**：

| 层 | 触发 | 执行者 | 覆盖 |
|---|------|--------|------|
| **L0** | 每次 Write/Edit | arch-guard.sh | 反向导入、Domain I/O、Zustand 服务端状态、生成文件保护 |
| **L1** | 每个任务完成后 | Claude（`/task-review`） | 约定合规 + 架构红线 + 任务元数据一致性 |
| **L2** | 全部任务完成后 | Codex + Gemini（`/code-review`） | 完整 6 维度深度审查 |

**L1 检查清单**（6 项）：

| # | 检查项 | 严重度 |
|---|--------|--------|
| 1 | 层级导入（services→routers、domain I/O、storage→services） | HIGH |
| 2 | 命名规范（文件名、类名、API 路径、错误码） | MEDIUM |
| 3 | 序列化约定（Pydantic alias_generator + populate_by_name） | HIGH |
| 4 | 数据库约定（rid 主键、Alembic 迁移、async session） | HIGH |
| 5 | 前端约定（i18n `t()`、服务端数据不入 Zustand、API 类型自动生成） | MEDIUM |
| 6 | 信息泄漏（无硬编码密钥/凭据） | HIGH |

**判定规则**：PASS → 打勾 | PASS_WITH_NOTES → 打勾+记录 | NEEDS_FIX → 修复后重审（最多 1 轮）

## 开发工作流（SDD）

所有新特性必须按以下顺序执行（详见 `features/README.md`）：

> **⚠️ 前提条件（强制）**：写 spec.md 前，必须**完整准确理解 PRD**。
> - 必须先读取 PRD 原文（`docs/prd/` 下对应文件）和 `release-contract.md`
> - 对 PRD 中的功能点、用户场景、边界条件、UI 交互逐一理解，不能遗漏
> - 如果 PRD 内容较长（如主 PRD 约 67KB），必须完整读取，不能只读部分
> - AC 表格必须覆盖 PRD 中描述的所有功能点，遗漏会导致后续实现不完整
> - 技术设计部分必须基于对 PRD 业务逻辑的准确理解，不能凭假设设计

0. **（版本开始时执行一次）release-contract.md** — 在第一个 feature spec 动笔前，创建版本级领域归属表和不变量表（模板：`features/_templates/release-contract.md`）
1. **Spec Discovery（架构师提问）** — 完整阅读 PRD + release-contract.md + 相关架构文档后，**禁止直接写 spec.md**，必须先以架构师视角识别 PRD 中的不确定性，向用户提出针对性问题。
   - 目的是**对齐不确定性**，不是逐条确认已明确的内容
   - 提问维度参考（仅就 PRD 未明确的部分提问，已明确的跳过）：
     · 边界条件：极端值、空状态、超长输入、批量操作上限等
     · 异常路径：并发冲突、部分成功、数据不一致、级联影响等
     · 权限与安全：角色权限边界、越权行为的预期处理
     · 数据约束：字段上限、唯一性、级联删除、数据量级等
     · 回滚与降级：操作失败的恢复策略、迁移的 downgrade 方案
     · 跨 Feature 影响：是否触及 release-contract.md 中其他 feature 的归属领域
   - 如果 PRD 已经足够清晰、无不确定性，可声明"无需提问"并说明理由，跳过此步骤
   - **手动暂停点**：必须使用 `AskUserQuestion` 工具向用户提出问题并等待确认。用户回答后，将澄清内容更新回 PRD 原文（保持 PRD 作为需求权威来源），然后方可进入步骤 2 编写 spec.md
2. **spec.md** — 合并需求规范与技术设计的完整规格文档
   - **需求部分**：用户故事、验收标准（AC 表格）、边界情况
   - **设计部分**：架构决策、数据库 & Domain 模型、API 契约、前端组件设计、错误码表
   - 验收标准必须用表格格式：`| ID | 角色 | 操作 | 预期结果 |`，AC-ID 在特性内唯一
   - 设计部分只写契约和决策（Why + What），不写实现步骤（How）
   - 禁止在 spec.md 中写测试策略（由本文件 §测试要求统一管理）
   - 写 spec 前必须先阅读版本的 `release-contract.md`
3. **审查 spec** — 写完 spec.md 后，调用 `/sdd-review <feature_dir> spec`；Claude 同时检查 PRD gap 和架构合规性，生成报告供用户参考；必须使用 `AskUserQuestion` 工具请求用户确认，用户确认后将 tasks.md 状态表中 spec.md 行更新为 ✅ 已评审（手动暂停点）
4. **tasks.md** — 将 spec 拆解为自包含的原子任务（模板：`features/_templates/tasks.md`）
   - **后端 Test-First**：后端任务按「测试 → 实现」配对编排；基础设施任务（迁移、ORM、配置）无测试配对
   - **前端 Test-Alongside**：前端实现任务内含测试，或在同 phase 末尾补充测试任务
   - 每个任务内联必要实现上下文（文件、逻辑、测试），实现阶段不需要回读 spec.md
   - 每个测试任务必须标注 `覆盖 AC: AC-NN, AC-NN`，追溯到 spec.md 的 AC 表格
   - 缺少 AC 标注的测试任务视为规格不完整，禁止开始对应的实现任务
5. **审查 tasks** — 写完 tasks.md 后自动调用 `/sdd-review <feature_dir> tasks`；检查 AC 追溯、任务拆解质量和技术债预防；通过则自动推进；有 high/medium 问题时自动修复后重审（最多 2 轮）
6. **创建 Feature 分支** — `git checkout -b feat/<version>/<feature-id>-<short-name>`
   - 分支命名示例：`feat/v0.1.0/005-object-type-crud-frontend`
   - 步骤 1-5 的文档工作在 main 上完成；步骤 7 的代码实现在 feature 分支上
7. **执行** — 在 feature 分支上逐任务实施：
   - 实现代码 → 运行测试 → `/task-review <feature_dir> <task_id>` → PASS 后打勾
7.5. **E2E 测试**（强制）— 全部任务完成后：
   - 调用 `/e2e-test <feature_dir>` 自动生成并运行 E2E 测试
   - 覆盖 spec.md 中 UI 交互类 AC，最多 3 轮修复
   - 即使是纯后端 feature，也必须运行 E2E 验证相关页面无回归
8. **代码审查** — 全部任务完成后，调用 `/code-review --base main`
   - 自动运行（Codex + Gemini 并行），无需用户确认
   - PASS / PASS_WITH_WARNINGS → 可合并
   - NEEDS_FIX → 修复 HIGH 问题后重审（最多 2 轮）
9. **合并** — `git checkout main && git merge --no-ff feat/<version>/<branch> && git branch -d feat/<version>/<branch>`

**核心约束**：每一步只产出该步骤的文件，不得提前执行后续步骤。有**两个手动暂停点**：步骤 1（Spec Discovery 用户确认）和步骤 3（spec 评审用户确认），暂停点必须使用 `AskUserQuestion` 工具与用户交互，禁止直接输出文本等待手动输入；`tasks.md` 审查和代码审查均为全自动（无需用户确认）。执行阶段在 feature 分支上进行，审查通过后合并回 main。写 spec 前必须先阅读版本的 `release-contract.md` 和完整的 PRD 原文。

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
| UI 设计/交互流程 | PRD + `docs/prd/0.1.0（MVP）/images/` |
| 完整技术栈论证 | `docs/architecture/04-tech-stack-recommendations.md` |
