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
11. [适配指南](#11-适配指南)

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

### 为什么适合 AI 辅助开发

SDD 的设计特别适合人机协作和 AI 编程场景：

1. **上下文可控**：每个任务限定在 1-2 个文件，AI 单次会话即可完成
2. **验收明确**：AC 表格提供精确的测试目标，AI 不会偏离需求
3. **知识蒸馏**：spec + tasks 充当"知识蒸馏层"，AI 无需理解完整项目即可执行单个任务
4. **质量可验证**：三层审查体系自动检测违规，不依赖人工逐行 review
5. **范围防漂移**：release-contract 防止 AI 在实现时引入超出范围的变更

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

#### 步骤 6：创建 Feature 分支

```bash
git checkout -b feat/<version>/<feature-id>-<short-name>
# 示例：feat/v1.0.0/005-user-authentication
```

**规则**：步骤 1-5 的文档工作在 main 上完成；步骤 7 的代码实现在 Feature 分支上。

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

调用 `/code-review --base main`，自动运行多维度深度审查：
- PASS / PASS_WITH_WARNINGS → 可合并
- NEEDS_FIX → 修复 HIGH 问题后重审（最多 2 轮）

#### 步骤 9：合并

```bash
git checkout main && git merge --no-ff feat/<version>/<branch> && git branch -d feat/<version>/<branch>
```

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

**调用方式**：`/code-review --base main`

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

SDD 的审查能力通过 Claude Code Skill 实现。以下是需要定义的 Skill：

| Skill | 触发方式 | 功能 |
|-------|---------|------|
| `sdd-review` | `/sdd-review <dir> spec/tasks` | 审查 spec.md 或 tasks.md |
| `task-review` | `/task-review <dir> <task_id>` | L1 任务级约定合规审查 |
| `code-review` | `/code-review --base main` | L2 多维度代码审查 |
| `e2e-test` | `/e2e-test <dir>` | 生成并运行 E2E 测试 |

每个 Skill 的详细定义参见 `.claude/skills/<skill-name>/SKILL.md`。

---

## 11. 适配指南

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
- 实现阶段各 Feature 在独立分支上并行

### Q: AI 和人各负责什么？

| 角色 | AI 负责 | 人负责 |
|------|--------|--------|
| **Spec Discovery** | 提出技术问题 | 回答业务决策 |
| **spec.md** | 起草完整规格 | 确认验收标准 |
| **tasks.md** | 拆解为原子任务 | 确认粒度合理 |
| **审查** | 自动执行检查清单 | 决定是否修复 |
| **实现** | 逐任务写代码 | 验证功能正确 |
| **E2E 测试** | 生成并运行 | 处理 3 轮修复后的遗留问题 |

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
