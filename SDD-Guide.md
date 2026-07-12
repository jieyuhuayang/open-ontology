# Spec-Driven Development (SDD) 完整指南

> 本文档是一套面向 AI 辅助开发的工程方法论，经过多个版本、20+ 个 Feature 的实战验证。
> 可直接复制到新项目使用，根据项目技术栈适配标注 `<!-- ADAPT -->` 的部分即可。

---

## 目录

1. [SDD 是什么](#1-sdd-是什么)
2. [核心产物](#2-核心产物)
3. [完整工作流](#3-完整工作流)
4. [版本契约 Release Contract](#4-版本契约-release-contract)
5. [规格文档 spec.md](#5-规格文档-specmd)
6. [任务清单 tasks.md](#6-任务清单-tasksmd)
7. [三层审查体系](#7-三层审查体系)
8. [测试要求](#8-测试要求)
9. [范围变更传播](#9-范围变更传播)
10. [自动化基础设施](#10-自动化基础设施)
11. [开发工作空间：分支与 Worktree](#11-开发工作空间分支与-worktree)
12. [适配指南](#12-适配指南)

---

## 1. SDD 是什么

### 定义

SDD（Spec-Driven Development）是一套**分层规范驱动**的开发方法论。每个 Feature 在写代码之前，必须先产出两层文档：**规格（spec.md）** 定义做什么和为什么，**任务清单（tasks.md）** 定义怎么做和按什么顺序。

### 核心理念

| 原则 | 说明 |
|------|------|
| **AC 是灵魂** | 验收标准（Acceptance Criteria）是规格的核心，必须可测试、边界清晰 |
| **两层分离** | spec（What + Why）与 tasks（How + When）严格分离 |
| **自包含任务** | 每个 task 内联完整上下文，实现时无需回读 spec |
| **Test-First** | 后端先写测试再写实现，测试驱动开发 |
| **范围严格管制** | release-contract.md 管理跨 Feature 的领域归属和不变量 |
| **递进式审查** | L0 实时守卫 → L1 任务审查 → L2 特性审查，逐层加深 |

---

## 2. 核心产物

SDD 围绕三个核心文档产物展开：

| 产物 | 文件 | 粒度 | 目的 |
|------|------|------|------|
| **版本契约** | `release-contract.md` | 版本级（如 v1.0） | 管理跨 Feature 的领域归属、全局约束和依赖关系 |
| **规格文档** | `spec.md` | Feature 级 | 合并需求规范与技术设计——用户故事、AC 表格、架构决策、API 契约 |
| **任务清单** | `tasks.md` | Feature 级 | 将 spec 拆解为原子任务，每个任务自包含、可独立执行 |

### 三者关系

```
release-contract.md（版本级约束）
    ├── Feature A/spec.md（需求 + 设计）
    │   └── Feature A/tasks.md（原子任务）
    ├── Feature B/spec.md
    │   └── Feature B/tasks.md
    └── Feature C/spec.md
        └── Feature C/tasks.md
```

**信息流向**：PRD → spec.md（提取 AC）→ tasks.md（映射为任务）→ 代码实现（按任务执行）

### 目录结构

```
features/
├── README.md                    # SDD 流程说明
├── _templates/                  # 可复用模板
│   ├── spec.md
│   ├── tasks.md
│   └── release-contract.md
├── v1.0.0/                      # 按版本组织
│   ├── release-contract.md      # 版本契约
│   ├── 001-feature-name/
│   │   ├── spec.md
│   │   └── tasks.md
│   ├── 002-another-feature/
│   │   ├── spec.md
│   │   └── tasks.md
│   └── ...
└── v2.0.0/
    ├── release-contract.md
    └── ...
```

### Feature 编号规范

```
{NNN}-{kebab-case-name}
```

- `NNN` — 零补齐三位数字（001, 002, ...）
- Name — 小写、连字符分隔、描述性名称
- 示例：`001-project-scaffolding`、`007-user-authentication`

---

## 3. 完整工作流

### 流程总览

```
0. release-contract.md（版本开始时，一次性）
   ↓
1. Spec Discovery（架构师提问）
   ↓ ★ 手动暂停点：用户确认
2. 编写 spec.md
   ↓
3. 审查 spec.md（/sdd-review spec）
   ↓ ★ 手动暂停点：用户确认
4. 编写 tasks.md
   ↓
5. 审查 tasks.md（/sdd-review tasks，自动推进）
   ↓
6. 创建 Feature 分支
   ↓
7. 逐任务执行（每任务：实现 → 测试 → /task-review → 打勾）
   ↓
7.5. E2E 测试（/e2e-test，强制）
   ↓
8. 代码审查（/code-review，自动）
   ↓
9. 合并回主分支
```

### 每步详解

#### 步骤 0：创建版本契约（版本开始时，一次性）

在第一个 Feature spec 动笔前，创建 `release-contract.md`，定义：
- **表 1**：领域对象归属（每个对象只有一个 Owner Feature）
- **表 2**：跨 Feature 不变量（全局业务约束）
- **表 3**：Feature 依赖图

#### 步骤 1：Spec Discovery（架构师提问）

**前置条件**：完整阅读 PRD 原文 + release-contract.md + 相关架构文档。

以架构师视角识别 PRD 中的不确定性，向用户提出针对性问题。提问维度：

- **边界条件**：极端值、空状态、超长输入、批量操作上限
- **异常路径**：并发冲突、部分成功、数据不一致、级联影响
- **权限与安全**：角色权限边界、越权行为的预期处理
- **数据约束**：字段上限、唯一性、级联删除、数据量级
- **回滚与降级**：操作失败的恢复策略、迁移的 downgrade 方案
- **跨 Feature 影响**：是否触及 release-contract.md 中其他 Feature 的归属领域

**关键规则**：
- 只就 PRD 未明确的部分提问，已明确的跳过
- PRD 足够清晰时，可声明"无需提问"并说明理由
- **★ 手动暂停点**：必须等待用户确认后方可进入步骤 2

#### 步骤 2：编写 spec.md

合并需求规范与技术设计的完整规格文档（详见 [§5 规格文档](#5-规格文档-specmd)）。

**强制前置**：
- 必须先完整阅读 PRD（长 PRD 也不能只读部分）
- 必须对照 release-contract.md 检查一致性
- AC 表格必须覆盖 PRD 中描述的所有功能点

#### 步骤 3：审查 spec.md

调用 `/sdd-review <feature_dir> spec`，同时检查：
- PRD 功能点是否都有对应 AC？
- AC 是否可测试、边界是否清晰？
- 是否与 release-contract.md 不变量冲突？
- 是否越界进入其他 Feature 的归属领域？
- API 契约是否完整？架构决策是否合规？

**★ 手动暂停点**：用户确认报告后，将 tasks.md 状态表中 spec.md 行更新为 `✅ 已评审`。

#### 步骤 4：编写 tasks.md

将 spec 拆解为自包含的原子任务（详见 [§6 任务清单](#6-任务清单-tasksmd)）。

#### 步骤 5：审查 tasks.md

调用 `/sdd-review <feature_dir> tasks`，自动检查 4 组 17 条规则（无需用户确认，有问题自动修复后重审，最多 2 轮）。

#### 步骤 6：创建 Feature 分支或 Worktree

```bash
git checkout -b feat/<version>/<feature-id>-<short-name>
# 示例：feat/v1.0.0/005-user-authentication
```

**规则**：步骤 1-5 的文档工作在 main 上完成；步骤 7 的代码实现在 Feature 分支上。

**并发场景**：如果你同时推进多个 Feature、有 AI Agent 并行协作、或主开发线需要与紧急 hotfix 共存，推荐使用 `git worktree` 而非纯分支切换。完整说明见 [§11 开发工作空间：分支与 Worktree](#11-开发工作空间分支与-worktree)。

#### 步骤 7：逐任务执行

在 Feature 分支上逐任务实施：

1. 实现任务代码
2. 运行测试并展示通过输出
3. 执行 `/task-review <feature_dir> <task_id>` — L1 约定合规检查
4. PASS 后在 tasks.md 中打勾 `✅`
5. NEEDS_FIX → 修复后重审（最多 1 轮）

#### 步骤 7.5：E2E 测试（强制）

全部任务完成后，调用 `/e2e-test <feature_dir>` 自动生成并运行 E2E 测试：
- 覆盖 spec.md 中 UI 交互类 AC
- 最多 3 轮修复
- 即使是纯后端 Feature，也必须验证相关页面无回归

#### 步骤 8：代码审查

调用 `/code-review`（Claude Code 内置 Skill，审查当前 diff），自动运行多维度深度审查：
- PASS / PASS_WITH_WARNINGS → 可合并
- NEEDS_FIX → 修复 HIGH 问题后重审（最多 2 轮）

**常用参数**：
- `--effort low|medium|high|max`：控制审查深度（低 = 高置信度少量发现；高 = 广覆盖含不确定发现）
- `--comment`：将发现项作为 inline 评论推到 PR

未使用 Claude Code 的项目可参照 [§7.3 L2 审查框架](#l2特性级代码审查code-review)自行实现等效审查工具。

#### 步骤 9：合并

```bash
git checkout main && git merge --no-ff feat/<version>/<branch> && git branch -d feat/<version>/<branch>
```

**Worktree 场景**：若 Feature 使用 worktree 开发，合并前需先回到主工作区（`cd` 回主仓库目录），合并后用 `git worktree remove <path>` 清理工作目录、再 `git branch -d` 删除分支，避免 stale worktree 残留。

### 核心约束

- **每一步只产出该步骤的文件**，不得提前执行后续步骤
- **两个手动暂停点**（步骤 1 和步骤 3）必须等待用户确认
- **tasks 审查和代码审查均为全自动**（无需用户确认）
- 实现偏差必须记录在 tasks.md §实际偏差记录

---

## 4. 版本契约 Release Contract

版本契约是**版本级领域归属与全局约束的权威来源**。所有 spec.md 在动笔前必须先阅读本文件。

### 模板

```markdown
# Release Contract — vX.X.X

> 本文件是版本级领域归属与全局约束的权威来源。
> **所有 spec.md 在动笔前必须先阅读本文件。**
> 每次 spec 评审时，必须对照本文件检查一致性。

---

## 表 1：领域对象归属

每个领域对象只能有一个 Owner Feature，负责定义该对象的写入行为
（创建、更新、删除）。其他 Feature 只能"读取"或"引用"该对象。

| 领域对象 | Owner Feature | 说明 |
|---------|--------------|------|
| <对象名> | F<NNN>-<name> | 包括创建、更新、删除 |
| _（新增对象时在此追加）_ | — | — |

**规则**：
- 非 Owner Feature 的 AC 中不得出现其他对象的"创建/修改/删除"
  行为，只能"读取"或"调用" Owner 的 Service。
- 新增领域对象时必须先更新本表。

---

## 表 2：跨 Feature 不变量（INV-N）

全局业务约束，任何 spec 的 AC **不得与之矛盾**。

| ID | 不变量描述 | 涉及领域对象 | 来源 spec |
|----|-----------|------------|---------|
| INV-1 | <约束描述> | <对象> | F<NNN> |
| _（新增约束时在此追加）_ | — | — | — |

**规则**：
- 新增不变量：先在此表追加，再写 AC。
- 修改不变量：必须列出 Impacted Specs 清单，逐一回写并重新评审。
- 冲突检测：若 AC 与不变量矛盾，spec 评审不通过。

---

## 表 3：Feature 依赖图

| Feature | 依赖（必须先完成） | 说明 |
|---------|-----------------|------|
| F<NNN>-<name> | F<NNN>-<name> | 原因：需要某领域对象/API |
| _（新增 Feature 时在此追加）_ | — | — |

---

## 变更历史

| 日期 | 变更内容 | 影响范围 |
|------|---------|---------|
| YYYY-MM-DD | 初始版本 | — |
```

### 使用要点

1. **唯一 Owner 原则**：每个领域对象只有一个 Feature 负责其写入行为，防止多个 Feature 同时修改同一对象导致冲突
2. **不变量不可违反**：INV-N 是全局红线，任何 spec 的 AC 都不得与之矛盾
3. **变更必须传播**：修改不变量时，所有受影响的 spec 必须同步更新（详见 [§9 范围变更传播](#9-范围变更传播)）

---

## 5. 规格文档 spec.md

spec.md 合并需求规范与技术设计，是 Feature 的完整规格。

### 编写原则

- **需求部分**描述业务能力：用户故事、验收标准、边界情况
- **设计部分**只写契约和决策（Why + What），不写实现步骤（How）
- **禁止**在 spec.md 中写测试策略（由统一测试规范管理）
- 如有跨 Feature 依赖，必须在"依赖与约束"节中声明

### 模板

```markdown
# Feature: <名称>

> **前置步骤**：本文档编写前必须已完成 Spec Discovery（架构师提问），
> 确保 PRD 中的不确定性已与用户对齐。

**关联 PRD**: [<PRD 文件路径> §章节名]
**优先级**: P0 / P1 / P2
**所属版本**: <vX.X.X>

---

## 1. 概述与用户故事

作为 **<角色>**，
我希望 **<目标>**，
以便 **<价值>**。

---

## 2. 验收标准

> AC-ID 在本特性内唯一，格式 `AC-NN`。
> tasks.md 中的测试任务必须通过 `覆盖 AC: AC-NN` 追溯到此表。

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-01 | <角色> | <执行什么操作> | <系统返回/显示什么> |
| AC-02 | <角色> | <边界/错误场景操作> | <错误码/HTTP 状态码> |

---

## 3. 边界情况

- 当 <异常场景> 时，系统应 <预期行为>
- **不支持**：<明确排除的功能>（延后到 vX.X.X）

---

## 4. 架构决策

| ID | 决策 | 选项 | 结论 | 理由 |
|----|------|------|------|------|
| AD-01 | <决策主题> | A: ... / B: ... | 选 A | <理由> |

---

## 5. 数据库 & Domain 模型

<!-- ADAPT: 根据你的技术栈调整数据库和模型定义格式 -->

### 数据库表定义

（SQL DDL 或 ORM 定义）

### Domain 模型

（类型定义 / Schema 定义）

---

## 6. API 契约

### 端点列表

| Method | Path | 描述 |
|--------|------|------|
| GET | `/api/v1/<resource>` | 列表查询 |
| POST | `/api/v1/<resource>` | 创建 |

### 请求/响应示例

（JSON 示例）

### 错误码表

| HTTP Status | Code | 场景 | 关联 AC |
|-------------|------|------|---------|
| 400 | `VALIDATION_ERROR` | 参数不合法 | AC-0X |
| 409 | `CONFLICT` | 唯一性冲突 | AC-0X |

---

## 7. Service 层逻辑

> 描述核心业务逻辑的流程和职责划分，不写具体实现代码。

---

## 8. 前端组件设计（如适用）

### 页面结构

（组件树 / 路由定义）

---

## 9. 文件清单

列出本特性将新建或修改的所有文件。

---

## 10. 非功能要求

- **性能**: <响应时间、吞吐量等>
- **安全**: <权限控制、数据隔离等>

---

## 相关文档

- 版本契约: [features/<版本>/release-contract.md]（写 spec 前必须先阅读）
```

### 验收标准（AC）规范

AC 是 spec 的灵魂，编写时必须遵循以下规范：

| 规则 | 说明 |
|------|------|
| **唯一 ID** | 格式 `AC-NN`（两位数字），在 Feature 内唯一 |
| **可测试** | 每条 AC 必须可以写出对应的自动化测试 |
| **边界清晰** | 明确错误码、HTTP 状态码、UI 反馈 |
| **完整覆盖** | 必须覆盖 PRD 中描述的所有功能点，遗漏会导致后续实现不完整 |
| **不变量一致** | 所有 AC 必须与 release-contract.md 的不变量一致 |
| **不越界** | 不得在 AC 中定义不属于本 Feature 的领域对象的写入行为 |

---

## 6. 任务清单 tasks.md

tasks.md 将 spec 拆解为可独立执行的原子任务。

### 模板

```markdown
# Tasks: <特性名称>

**关联规格**: [spec.md](./spec.md)
**版本**: <vX.X.X>

---

## 状态

| 步骤 | 状态 | 备注 |
|------|------|------|
| spec.md | 🔲 草稿 | 用户确认后改为 ✅ 已评审 |
| tasks.md | 🔲 草稿 | 拆解完成后改为 ✅ 已拆解 |
| 实现 | 🔲 未开始 | X / N 完成 |

---

## 开发模式

**后端 Test-First（测试在前，实现在后）**：后端任务按「测试 → 实现」配对编排。
基础设施任务（数据库迁移、ORM 模型、配置）无测试配对。

**前端 Test-Alongside**：前端实现任务内含测试。

**自包含任务**：每个任务内联文件、逻辑、测试上下文，实现阶段不需要回读 spec.md。

---

## Tasks

### 基础设施

- [ ] **T001**: <数据库迁移 / 配置>
  **文件**: `<file_path>`
  **逻辑**: <具体要做什么>
  **依赖**: 无

### 后端服务层

- [ ] **T002**: <模块>单元测试
  **文件**: `<test_file_path>`
  **逻辑**: 测试 <Service> 的核心方法
  **测试**: `test_create_success` → AC-01, `test_not_found` → AC-02
  **覆盖 AC**: AC-01, AC-02
  **依赖**: T001

- [ ] **T003**: <模块>服务层实现
  **文件**: `<service_file_path>`
  **逻辑**: <业务逻辑描述>
  **测试**: T002 全部通过
  **覆盖 AC**: AC-01, AC-02
  **依赖**: T001

### 后端 API 层

- [ ] **T004**: API 路由集成测试
  **文件**: `<test_file_path>`
  **逻辑**: 测试 HTTP 端点请求/响应
  **覆盖 AC**: AC-01, AC-02
  **依赖**: T003

- [ ] **T005**: API 路由实现
  **文件**: `<router_file_path>`
  **逻辑**: HTTP 解析 + 委托给 service
  **测试**: T004 全部通过
  **覆盖 AC**: AC-01, AC-02
  **依赖**: T003

### 前端

- [ ] **T006**: 前端页面实现 + 测试
  **文件**: `<page_file_path>`, `<test_file_path>`
  **逻辑**: <组件结构、数据获取方式、用户交互流程>
  **覆盖 AC**: AC-01, AC-02
  **依赖**: T005

---

## 实际偏差记录

> 完成后，在此记录实现与 spec.md 的偏差，供后续参考。

- **偏差 1**: <描述实际做了什么，以及为何偏离原计划>
```

### 任务粒度规则

每个任务必须满足以下条件：

| 维度 | 要求 |
|------|------|
| **完成时间** | 单次 AI 会话可完成（约 30 分钟） |
| **文件范围** | 目标 1 个文件（至多 2 个紧密相关的文件） |
| **显式依赖** | 列出前置任务（哪些任务必须先完成） |
| **自包含** | 内联文件路径、逻辑描述、测试上下文；实现时无需回读 spec.md |
| **AC 追溯** | 每个测试任务必须标注 `覆盖 AC: AC-NN, AC-NN` |

### Test-First 配对规则

```
基础设施任务（无测试配对）
  T001: 数据库迁移

后端服务层（测试 → 实现 配对）
  T002: 单元测试（先写，红）    ← 覆盖 AC: AC-01, AC-02
  T003: 服务层实现（后写，绿）  ← 依赖 T002 通过

后端 API 层（测试 → 实现 配对）
  T004: 集成测试（先写，红）    ← 覆盖 AC: AC-01, AC-02
  T005: 路由实现（后写，绿）    ← 依赖 T004 通过

前端（实现与测试同任务）
  T006: 页面实现 + 渲染测试     ← 覆盖 AC: AC-01, AC-02
```

**关键规则**：
- 缺少 `覆盖 AC` 标注的测试任务视为规格不完整，禁止开始配对的实现任务
- AC 标注必须逐条列举 `AC-01, AC-02`，禁止范围写法 `AC-01~AC-05`
- 测试任务不得混入实现逻辑

---

## 7. 三层审查体系

SDD 采用递进式三层审查，越早发现问题修复成本越低。

```
L0 ─── 每次文件变更 ──→ 架构守卫脚本（即时、自动、同步）
 │
L1 ─── 每个任务完成 ──→ 约定合规审查（轻量、6 项检查）
 │
L2 ─── Feature 全部完成 ──→ 多维度深度审查（全面、6 维度）
```

### L0：实时架构守卫（arch-guard）

**触发时机**：每次文件写入/编辑后，通过 IDE hook 同步执行。无违规时完全静默。

**检查项示例**（根据项目架构定制）：

<!-- ADAPT: 以下检查项需根据你的项目架构红线定制 -->

| # | 检查项 | 严重度 | 说明 |
|---|--------|--------|------|
| 1 | 禁止跨层直接导入 | P0 | 如 Router 不得直接导入 Storage 层 |
| 2 | 禁止反向依赖 | P0 | 如 Storage 不得导入 Service 层 |
| 3 | Domain 层禁止 I/O | P0 | 纯逻辑层不得包含异步/IO 操作 |
| 4 | 禁止手动编辑生成文件 | P0 | 自动生成的类型文件会被覆盖 |
| 5 | 前端 Store 禁止服务端状态 | 约定 | 服务端数据应由查询缓存管理 |

**实现方式**：shell 脚本 + IDE/Claude Code 的 PostToolUse hook（详见 [§10 自动化基础设施](#10-自动化基础设施)）。

### L1：任务级审查（/task-review）

**触发时机**：每个 SDD 任务完成后、打勾前。

**调用方式**：`/task-review <feature_dir> <task_id>`

**6 项检查清单**：

| # | 检查项 | 适用范围 | 严重度 |
|---|--------|---------|--------|
| 1 | **架构分层** | 后端代码 | HIGH |
| 2 | **命名规范** | 全部 | MEDIUM |
| 3 | **序列化约定** | Domain 模型 | HIGH |
| 4 | **数据库约定** | 存储/迁移 | HIGH |
| 5 | **前端约定** | 前端代码 | MEDIUM |
| 6 | **信息泄漏** | 全部 | HIGH |

**差异化处理**：

| 任务类型 | 适用检查项 |
|---------|-----------|
| 测试任务 | #2 命名 + #5 前端约定 + AC 标注格式 |
| 实现任务 | 完整 #1~#6 + 验证配对测试已完成 |
| 基础设施任务 | #1 架构分层 + #4 数据库约定 + #6 信息泄漏 |

**判定规则**：

| 结果 | 条件 | 动作 |
|------|------|------|
| **PASS** | 全部通过 | 打勾，继续下一任务 |
| **PASS_WITH_NOTES** | 仅 MEDIUM 级提醒 | 打勾 + 记录，继续 |
| **NEEDS_FIX** | 任何 HIGH 违规 | 修复 → 重审（最多 1 轮） |

### L2：特性级代码审查（/code-review）

**触发时机**：Feature 全部任务完成后。

**调用方式**：`/code-review`（Claude Code 内置 Skill，默认审查当前 diff）
- `--effort low|medium|high|max`：控制审查深度
- `--comment`：发现项作为 inline 评论推到 PR

> **实现说明**：Claude Code 用户直接使用内置 Skill，无需自定义实现。其他环境可参照下方 **6 维度审查框架** 自行实现等效工具（如 CI 中跑 SAST + LLM-based review）。维度本身是方法论规范，与具体工具无关。

**6 维度审查框架**：

| 维度 | 检查内容 |
|------|---------|
| **边界条件** | null 处理、空集合、数值边界、分页、超时 |
| **权限与认证** | 权限检查、角色验证、越权防护 |
| **并发安全** | 竞态条件、死锁、事务完整性 |
| **信息泄漏** | 日志中的敏感数据、错误信息过详 |
| **测试覆盖** | 单元/集成测试覆盖、错误路径、mock 质量 |
| **代码风格** | 项目约定、命名规范、代码结构 |

**报告格式**：

```markdown
# Code Review Report

**Review scope**: <描述>
**Changed files**: <数量>

## Summary
| Dimension | High | Medium | Low | Status |
|-----------|------|--------|-----|--------|
| Boundary Conditions | 0 | 0 | 0 | PASS |
| Permission & Auth | 0 | 0 | 0 | PASS |
| ...

**Overall**: PASS / PASS_WITH_WARNINGS / NEEDS_FIX
```

**判定规则**：
- **PASS**：无 HIGH 或 MEDIUM → 可合并
- **PASS_WITH_WARNINGS**：仅 MEDIUM → 可合并，记录待改进
- **NEEDS_FIX**：有 HIGH → 修复后重审（最多 2 轮）

---

## 8. 测试要求

### 后端：Test-First（测试在前，实现在后）

- **开发顺序**：先写测试（红），再写实现（绿）
- tasks.md 中后端测试任务必须排在对应实现任务之前
- 新增 Service 函数 → 必须有单元测试（mock 数据库）
- 新增 API 路由 → 必须有集成测试（覆盖 happy path + 主要 error path）
- 完成前运行测试并展示通过输出

### 前端：Test-Alongside（实现与测试同步）

- 新增页面 → 必须有渲染 + 核心交互测试
- 新增 Store → 必须覆盖核心状态转换
- 新增可复用组件 → 必须有渲染测试
- 前端测试与实现可在同一任务内完成
- 完成前运行测试并确认无失败

### E2E：Feature 完成后（强制）

- 每个 Feature 全部任务完成后，必须生成并运行 E2E 测试
- E2E 测试覆盖 spec.md 中的 **UI 交互流程类 AC**
- 纯 API 行为的 AC 由后端集成测试覆盖
- 即使是纯后端 Feature，也需验证相关页面无回归

**E2E 数据隔离（红线）**：

| 规则 | 说明 |
|------|------|
| **禁止无条件删除所有资源** | cleanup 必须按前缀或白名单过滤 |
| **测试数据前缀** | 统一 `e2e-<feature>-` 前缀（最短 5 字符） |
| **双重 cleanup** | setup 阶段清理上次残留 + 末尾清理本次数据 |
| **非测试数据保持不变** | E2E 运行前后，非测试数据必须完好 |

### 禁止行为

- 禁止未运行测试就标记任务完成 — 必须运行并展示输出
- 禁止将测试拆分为独立后续任务 — 测试与实现属于同一任务

---

## 9. 范围变更传播

当一个 Feature 的范围决策影响另一个 Feature 时，**必须**按以下顺序处理：

```
1. 先更新 release-contract.md 不变量表
   ↓ 新增或修改 INV-N
2. 列出 Impacted Specs 清单
   ↓ 哪些 Feature 的哪些 AC 受影响
3. 逐一回写受影响的 spec.md
   ↓ 修改矛盾的 AC
4. 重新评审所有受影响的 spec
   ↓ 走 /sdd-review spec 流程
5. 全部完成后才能进入实现
```

**违反后果**：仅更新当前 spec 而跳过回写，会导致 Feature 间 AC 矛盾，产生实现断裂。

**实际案例**：Feature A 决定"不支持某功能"，而 Feature B 的 AC 已依赖该功能。此时必须：
1. 更新 release-contract.md（记录新约束）
2. 修改 Feature B 的 AC（移除对该功能的依赖）
3. 重新评审 Feature B 的 spec

---

## 10. 自动化基础设施

### Claude Code Hook 配置

<!-- ADAPT: 根据你的项目调整文件路径和格式化工具 -->

在 `.claude/settings.json` 中配置 PostToolUse hook，实现两个自动化：

#### 1. 自动格式化 + 自动提交（异步）

每次文件变更后：
- 前端文件（ts/tsx/js/json/css）→ Prettier 格式化
- 后端文件（py）→ Ruff / Black 格式化
- `git add -A && git commit -m "chore: auto-save <filename>"`

#### 2. 架构守卫检查（同步，阻塞）

每次文件变更后，同步执行 `arch-guard.sh`，在 AI 下次操作前就输出违规警告。

> **多 Worktree 注意**：Hook 命令和 arch-guard 脚本路径建议使用 `$CLAUDE_PROJECT_DIR` 或相对路径，以便在任意 worktree 根目录下独立加载正确的脚本，避免绝对路径跨 worktree 失效（详见 [§11.6 常见坑](#116-常见坑与规避)）。

### 配置示例

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "<自动格式化 + git commit 脚本>",
            "async": true
          },
          {
            "type": "command",
            "command": "bash -c '... arch-guard.sh \"$FILE\" ...'",
            "async": false
          }
        ]
      }
    ]
  }
}
```

### arch-guard.sh 脚本模板

<!-- ADAPT: 以下检查项需根据你的项目架构红线定制 -->

```bash
#!/bin/bash
# arch-guard.sh — 架构守卫脚本
# 触发时机：Claude Code 使用 Write/Edit 工具后立即执行（同步）
# 无违规时完全静默，不产生噪音
# 注意：脚本应能在任意 worktree 根目录下独立运行，不假设绝对路径

FILE="$1"
[ -z "$FILE" ] && exit 0
[ ! -f "$FILE" ] && exit 0

# ── 检查 1：禁止跨层导入（根据你的架构定制）──────────────────────
# 示例：Router 层不得直接导入 Storage 层
if [[ "$FILE" == *"/routers/"*.py ]]; then
    if grep -qE "^from app\.storage" "$FILE" 2>/dev/null; then
        echo "⚠️  [arch-guard] VIOLATION: $(basename "$FILE") 直接导入 storage 层"
    fi
fi

# ── 检查 2：禁止反向依赖 ──────────────────────────────────────
# 示例：Storage 层不得导入 Service 层
if [[ "$FILE" == *"/storage/"*.py ]]; then
    if grep -qE "^from app\.services" "$FILE" 2>/dev/null; then
        echo "⚠️  [arch-guard] VIOLATION: $(basename "$FILE") 反向导入 service 层"
    fi
fi

# ── 检查 3：Domain 层禁止 I/O ─────────────────────────────────
if [[ "$FILE" == *"/domain/"*.py ]]; then
    if grep -qE "^(import (asyncio|aiohttp)|from (sqlalchemy\.ext|asyncio))" "$FILE" 2>/dev/null; then
        echo "⚠️  [arch-guard] VIOLATION: $(basename "$FILE") domain 层包含 I/O"
    fi
fi

# ── 检查 4：禁止编辑自动生成文件 ──────────────────────────────
if [[ "$FILE" == *"/generated/"* ]]; then
    echo "⚠️  [arch-guard] 正在编辑自动生成文件 — 该文件会被覆盖"
fi

# ── 检查 5：信息泄漏 ──────────────────────────────────────────
# （可扩展更多检查项）

exit 0
```

### Skill 定义

SDD 的审查能力通过 Claude Code Skill 实现。以下是需要的 Skill：

| Skill | 触发方式 | 功能 | 实现来源 |
|-------|---------|------|---------|
| `sdd-review` | `/sdd-review <dir> spec/tasks` | 审查 spec.md 或 tasks.md | **项目自定义** |
| `task-review` | `/task-review <dir> <task_id>` | L1 任务级约定合规审查 | **项目自定义** |
| `code-review` | `/code-review` | L2 多维度代码审查（审当前 diff） | **Claude Code 内置**，无需自定义 |
| `e2e-test` | `/e2e-test <dir>` | 生成并运行 E2E 测试 | **项目自定义** |

每个 Skill 的详细定义参见 `.claude/skills/<skill-name>/SKILL.md`。

---

## 11. 开发工作空间：分支与 Worktree

> SDD 工作流的步骤 6-9 涉及"在隔离的工作空间里实现 Feature"。本章节给出两种工作空间方案的选型依据、与九步法的嵌合方式、以及多 worktree 并发的实操要点。

### 11.1 为什么需要 Worktree

**痛点驱动**：
- AI Agent 并发开发——多个 Claude 实例同时推进不同 Feature，分支切换会互相打断
- 长跑测试 / E2E / 数据迁移占用工作区时，紧急 bugfix 必须切分支但不能丢失现场
- 大型 monorepo 切分支成本高：重装依赖（venv / node_modules）、重启 dev server、前端冷编译可能耗时数分钟

**一句话定义**：`git worktree` 让同一个仓库拥有多个独立工作目录，**共享同一个 `.git`** 但各自 checkout 不同分支。所有提交历史、远端配置、git hooks 都自动共享，工作目录、依赖、运行进程完全隔离。

**和分支模型的关系**：worktree **并存而非替代**分支。Feature 分支仍然按 `feat/<version>/<id>-<name>` 命名，只是承载它的工作目录可以是主仓库本身，也可以是一个独立 worktree。

### 11.2 决策树：何时分支、何时 Worktree

| 场景 | 推荐方案 | 理由 |
|------|---------|------|
| 单人单任务、串行开发 | 普通分支 | 切换成本低，worktree 反而增加管理负担 |
| 并发 ≥2 个 Feature | Worktree | 避免相互 stash / context switch |
| 多 AI Agent 同时工作 | Worktree（一 agent 一 worktree） | 避免多 agent 同时写同一文件 |
| 长跑任务运行中需切分支（E2E / 训练 / 数据迁移） | Worktree | 不中断长跑、不丢失环境状态 |
| 主开发线 + 紧急 hotfix 共存 | Worktree | 主分支保留工作树，hotfix 在新 worktree 即开即用 |
| 大型 monorepo（依赖装载 / 前端编译成本高） | Worktree | 每个 worktree 一套独立 build cache |

**口诀**：**"并发数 ≥ 2 或单任务长跑 >10 分钟"** 是 worktree 的甜区。

### 11.3 与 SDD 九步法的嵌合

| 步骤 | 在哪里执行 |
|------|----------|
| 步骤 0-5（版本契约、Spec Discovery、spec.md、tasks.md、文档审查）| **主工作区**（main 分支）|
| 步骤 6 创建工作空间 | `git worktree add ../<repo>-<feature-id> -b feat/<version>/<id>-<name>` |
| 步骤 7（逐任务实现）+ 7.5（E2E 测试） | **Feature worktree 内**，进程、端口、依赖、AI Agent 都隔离 |
| 步骤 8 `/code-review` | Feature worktree 内执行（Claude Code 内置，审当前 diff） |
| 步骤 9 合并 | 回主工作区 → `git merge --no-ff` → `git worktree remove <path>` → `git branch -d` |

**规则**：文档阶段（步骤 1-5）始终在主工作区完成，只有进入"代码实现"才创建 worktree。这确保 spec/tasks 审查不会被多 worktree 切换分散注意力。

### 11.4 核心命令速查

```bash
# 创建新 worktree（同时新建分支）
git worktree add ../<repo>-<feature-id> -b feat/<version>/<id>-<name>

# 把已有分支 checkout 到新 worktree
git worktree add ../<repo>-<feature-id> <existing-branch>

# 列出所有 worktree（路径 / 分支 / HEAD）
git worktree list

# 移除 worktree（要求工作目录干净）
git worktree remove <path>

# 强制移除（含未提交变更，慎用）
git worktree remove --force <path>

# 清理已被外部删除的 worktree 注册记录
git worktree prune
```

**命名约定**：worktree 路径用 `../<repo>-<feature-id>`（如 `../bisheng-005-user-auth`），与分支名 `feat/<version>/<feature-id>-<name>` 对齐，扫一眼 `git worktree list` 就能定位是哪个 Feature。

### 11.5 隔离边界：什么共享、什么必须独立 <!-- ADAPT -->

| 资源类型 | 默认行为 | 推荐做法 |
|---------|---------|---------|
| `.git/` 仓库元数据、提交历史、远端配置、git hooks | **自动共享** | 接受默认 |
| 语言依赖目录（Python `.venv` / Node `node_modules` / Go `vendor` / Rust `target` 等） | 每 worktree 各自一份 | 每 worktree 创建后立即重装依赖 |
| `.env` / `.envrc` 等本地配置 | 每 worktree 各自一份 | 从主工作区复制后按需改端口/路径 |
| 构建产物（`dist/` `build/` `target/` 等） | 每 worktree 各自一份 | 接受默认；可在 `.gitignore` 已排除 |
| IDE 工作区设置（`.idea/` `.vscode/`） | 每 worktree 各自一份 | 按需复制；用户级配置无需迁移 |
| AI Agent 本地配置（如 `.claude/settings.local.json`） | 每 worktree 各自一份 | **不应进 git**；按需复制后调整 |
| 本地数据库 / Redis / 文件存储（如本机 MySQL、Docker compose 起的中间件） | **默认共享，可能互相污染** ⚠️ | 每 worktree 用独立端口 + 独立数据目录，或用 Docker compose project name 隔离 |
| 本地端口（dev server / debugger / test server） | **默认冲突** ⚠️ | 参数化端口或用环境变量区分 |

**核心原则**：凡是"写入"到工作目录外的副作用（数据库、文件存储、监听端口），都必须显式隔离，否则多 worktree 会互相覆盖。

### 11.6 常见坑与规避

| 坑 | 真相 | 规避 |
|----|------|------|
| **同一分支拒绝 double-checkout** | git 强制拒绝同一分支同时存在于两个 worktree | 这是 feature 不是 bug；想并发改同一分支，请先拉新分支 |
| **端口冲突** | dev server / 测试服务 / 调试器默认监听固定端口，多 worktree 同启即冲突 | 端口参数化（如 `PORT=4001 npm run dev`），或在每 worktree 的 `.env` 里写死不同端口 |
| **Hook 路径陷阱** | `.claude/settings.json` 中脚本路径若写成绝对路径，跨 worktree 会指错文件 | 使用 `$CLAUDE_PROJECT_DIR` 或相对路径（联动 [§10 自动化基础设施](#10-自动化基础设施)）|
| **长跑进程忘 kill** | 切到新 worktree 干活时，旧 worktree 的 celery / dev server / queue worker 还在跑，占资源 / 占端口 | 切之前先 `ps`/`lsof` 核对；为每个 worktree 用 `tmux` / `screen` 命名会话便于回切 |
| **`git worktree remove` 拒绝删** | 工作目录有未提交变更时 remove 会拒绝 | 先 commit 或 stash，或显式 `--force`（确认要丢弃改动） |
| **`.claude/settings.local.json` 误进 git** | 该文件包含本机/本 worktree 专属配置（如端口、本地路径） | `.gitignore` 排除，每 worktree 各自维护一份 |
| **prune 未执行导致 stale 列表** | 手动 `rm -rf` 某个 worktree 目录后，`git worktree list` 仍然显示 | 用 `git worktree remove` 走正规清理；事后用 `git worktree prune` 兜底 |

### 11.7 AI Agent 并发开发实践

**一 Agent 一 Worktree**：每个 Claude Code 实例绑定一个 worktree，避免多 Agent 同时改同一文件造成"最后写入者获胜"覆盖。Claude Code 启动时自动识别当前根目录，hook / skill / settings 各自独立加载，开箱即用。

**用 Agent 工具的 `isolation: "worktree"`**：在主 Agent 内 spawn 子 Agent 时传入 `isolation: "worktree"`，运行时会自动创建临时 worktree、agent 在隔离副本里工作、无改动时自动清理。适合并行试验型任务。

**合并顺序建议**：多 Feature 并发完成后合并到主线时，**先合 `release-contract.md` 影响小的、再合改动大的**，让冲突域逐步收敛。被依赖的 Feature 应该先合并、依赖它的 Feature 在合并前先 `git fetch && git rebase main` 同步。

**清理时机**：Feature 合并并删除分支后**立刻** `git worktree remove`，避免 stale 目录长期累积；周期性运行 `git worktree prune` 清理外部删除的注册。

---

## 12. 适配指南

将 SDD 规范适配到新项目时，按以下步骤操作：

### Step 1：建立目录结构

```bash
mkdir -p features/_templates
# 复制三个模板文件到 _templates/
# 创建 features/README.md
```

### Step 2：定义架构红线

根据你的项目架构，确定 L0 守卫需要检查的红线。常见模式：

| 架构模式 | 红线示例 |
|---------|---------|
| **分层架构** | 禁止反向导入（Controller → Service → Repository） |
| **DDD** | Domain 层无 I/O，Repository 不导入 Service |
| **微服务** | 服务间禁止直接数据库访问 |
| **前端** | Store 禁止服务端数据、禁止手编生成文件 |

### Step 3：配置 Hook 和 arch-guard

1. 创建 `scripts/arch-guard.sh`，编写项目特定的红线检查
2. 在 `.claude/settings.json` 配置 PostToolUse hook
3. 测试 hook 能正确触发和输出

### Step 4：定义审查检查清单

根据项目约定，定制 L1 任务审查的 6 项检查：

<!-- ADAPT: 以下是示例，根据你的项目约定替换 -->

| # | 检查项 | 你的项目具体规则 |
|---|--------|----------------|
| 1 | 架构分层 | <你的分层规则> |
| 2 | 命名规范 | <你的命名约定> |
| 3 | 序列化约定 | <你的序列化规则> |
| 4 | 数据库约定 | <你的数据库规则> |
| 5 | 前端约定 | <你的前端规则> |
| 6 | 信息泄漏 | 无硬编码密钥/密码/token |

### Step 5：写入 CLAUDE.md

将以下关键规则写入项目的 `CLAUDE.md`：

1. **SDD 工作流**：完整 9 步流程描述
2. **强制约束**：架构红线、命名规范、测试要求
3. **代码分层规则**：每层的职责和可导入范围
4. **测试要求**：Test-First / Test-Alongside / E2E 强制

### Step 6：创建第一个版本契约

```bash
cp features/_templates/release-contract.md features/v1.0.0/release-contract.md
# 编辑，填入你的版本的领域对象和不变量
```

### Step 7：开始第一个 Feature

按 SDD 工作流执行：Spec Discovery → spec.md → 审查 → tasks.md → 审查 → 执行。

建议从一个**中等复杂度**的 Feature 开始（如单个 CRUD 端点），而非最简单的脚手架或最复杂的核心功能。这样能充分验证流程而不至于被复杂度淹没。

---

## 附录 A：SDD 审查检查清单速查

### spec.md 审查（11 项）

**需求分析维度**：
1. PRD 功能点 → spec AC 覆盖？
2. PRD 边界条件/错误场景 → spec 覆盖？
3. PRD UI 交互细节 → spec 有对应 AC？
4. AC 表格格式正确？（`| ID | 角色 | 操作 | 预期结果 |`）
5. AC 可测试（不模糊）？
6. 与 release-contract.md 不变量冲突？

**架构合规维度**：
7. 每条 AC 有技术覆盖（API/数据/组件）？
8. 未越界进入其他 Feature 的领域？
9. API 契约完整（端点 + 示例 + 错误码）？
10. 架构决策合规？
11. 设计部分只写 Why+What（不写 How）？

### tasks.md 审查（17 项，4 组）

**A. 形式合规（6 项）**：
1. AC 追溯完整（每条 AC 都有测试任务覆盖）
2. 测试任务都有 `覆盖 AC:` 标注
3. Test-First 顺序（测试先于实现）
4. 依赖关系正确
5. 原子化（每任务 ≤ 2 文件）
6. 自包含（内联上下文）

**B. 拆解质量（6 项）**：
7. 粒度合理（不超 3 文件、不跨前后端）
8. 顺序高效（无返工）
9. 无重复工作
10. spec 覆盖完整
11. 任务间接口清晰
12. 无过度工程

**C. AC 标注规范（2 项）**：
13. AC 逐条列举（禁止范围写法）
14. 测试任务纯净（不混入实现逻辑）

**D. 技术债预防（3 项）**：
15. 无延迟 TODO/FIXME
16. 迁移有 downgrade 方案
17. 跨 Feature 副作用已检查

---

## 附录 B：常见问题

### Q: 小改动也要走完整 SDD 流程吗？

不需要。根据变更规模选择：

| 变更规模 | 所需产物 |
|---------|---------|
| **复杂 Feature** — 跨多层、引入新领域概念 | spec.md + tasks.md |
| **中等 Feature** — 单个 CRUD 或独立 UI 组件 | spec.md（简要）+ tasks.md |
| **小改动** — Bug fix、样式调整 | tasks.md only |

### Q: spec.md 和 PRD 什么关系？

- **PRD** 是需求的权威来源（产品视角，描述"做什么"）
- **spec.md** 是 PRD 的工程化翻译（架构视角，描述"做什么 + 怎么设计"）
- spec 的 AC 必须覆盖 PRD 的所有功能点，但可以更精确（加入错误码、HTTP 状态码等技术细节）

### Q: 多人协作时怎么用 SDD？

- 每个 Feature 由一个人负责（Owner），从 spec 到实现
- release-contract.md 是协作的核心——避免多人修改同一领域对象
- spec 评审可以由团队其他成员进行（步骤 3 的手动暂停点）
- 实现阶段各 Feature 在独立分支上并行；并行人数 ≥2 时推荐每人一个 worktree（详见 [§11.3](#113-与-sdd-九步法的嵌合)）

### Q: AI 和人各负责什么？

| 角色 | AI 负责 | 人负责 |
|------|--------|--------|
| **Spec Discovery** | 提出技术问题 | 回答业务决策 |
| **spec.md** | 起草完整规格 | 确认验收标准 |
| **tasks.md** | 拆解为原子任务 | 确认粒度合理 |
| **审查** | 自动执行检查清单 | 决定是否修复 |
| **实现** | 逐任务写代码 | 验证功能正确 |
| **E2E 测试** | 生成并运行 | 处理 3 轮修复后的遗留问题 |

### Q: worktree 多大场景才划算？

**收益显著**：
- 同时推进 ≥2 个 Feature 时
- 任一任务长跑 >10 分钟（E2E、数据迁移、训练、大规模重构）
- 多个 AI Agent 并发开发同一仓库
- 主开发分支正在跑长任务，又需要紧急 hotfix

**不必引入**：
- 单人单任务串行开发，普通分支足够
- 仓库小、切分支几乎无成本（不重装依赖、不重启 dev server）

权衡点：worktree 占磁盘（每个 worktree 都是完整 checkout + 独立依赖），收益在于"避免上下文切换 + 并发"。完整决策树见 [§11.2](#112-决策树何时分支何时-worktree)。

---

## 附录 C：版本变更适用规模

| 版本任务量 | Features | 是否需要 Release Contract |
|-----------|----------|------------------------|
| 1-3 个 Feature | 小版本 | 可选（但建议有） |
| 4-10 个 Feature | 中版本 | 推荐 |
| 10+ 个 Feature | 大版本 | 强制 |

Release Contract 的价值随 Feature 数量增长而显著增加——Feature 越多，跨域冲突的风险越高。

---

*本文档基于实际项目 20+ 个 Feature 的实战经验总结。SDD 不是银弹，但它能显著降低 AI 辅助开发中的需求遗漏、范围漂移和架构违规风险。*
