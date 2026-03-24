# Release Contract — v0.2.0

> 本文件是版本级领域归属与全局约束的权威来源。
> **所有 spec.md 在动笔前必须先阅读本文件。**
> 每次 spec 评审时，必须对照本文件检查一致性。

---

## 表 1：领域对象归属

每个领域对象只能有一个 Owner Feature，负责定义该对象的写入行为（创建、更新、删除）。
其他 feature 的 spec 只能描述"读取"或"引用"该对象，不得在 AC 中定义其写入行为。

### v0.1.0 继承（保持不变）

| 领域对象 | Owner Feature（v0.1.0） | 说明 |
|---|---|---|
| Ontology | 003-object-type-crud | 顶层容器，包括创建、切换 |
| ObjectType | 003-object-type-crud | CRUD + WorkingState |
| Property（对象类型属性） | 007-property-management | 属性定义、类型、默认值、格式化规则 |
| LinkType | 006-link-type-crud | 链接类型 CRUD，包括端点定义、基数约束 |
| WorkingState / Change | 003-object-type-crud (基础) + 009-working-state (扩展) | 草稿/已发布状态机，变更管理 |
| DataSource / Connection | 010-data-connection | 连接注册、测试、Schema 提取 |
| Dataset / DatasetColumn | 010-data-connection（写入）/ 003-object-type-crud（查询） | Dataset 由 DC 创建，OT 查询 + in-use 判定 |
| ObjectInstance | 011-object-instance-sync | 对象实例 CRUD（同步写入 + 查询） |
| SyncJob | 011-object-instance-sync | 同步任务记录（创建 + 状态更新 + 查询） |

### v0.2.0 新增

| 领域对象 | Owner Feature | 说明 |
|---|---|---|
| AgentSession | 012-agent-foundation | Agent 会话创建/管理/删除 |
| AgentMessage | 012-agent-foundation | 对话消息持久化（user/assistant/system） |
| AgentAuditLog | 012-agent-foundation | Agent 操作审计日志 |
| AgentMaterial | 014-material-and-blueprint | 上传资料管理（上传/解析/删除） |
| Blueprint | 014-material-and-blueprint | 蓝图 CRUD + 状态管理（draft→pending_review→applied/discarded） |
| BlueprintItem | 014-material-and-blueprint | 蓝图项 CRUD + 审查操作（accept/edit/reject） |

**规则**：

- 若某 spec 需要描述一个不属于自己 Owner 的领域对象的写入行为，必须先提出变更申请（更新本表），经用户确认后方可写 AC。
- 非 Owner feature 的 AC 中如出现"创建/修改/删除 X"，视为越界，评审不通过。
- v0.2.0 feature 对 v0.1.0 领域对象仅有**读取/调用**权限（通过 Service 层），不得修改其写入逻辑。
- 例外：F017-hitl-review-and-apply 通过调用 v0.1.0 的 ObjectTypeService/PropertyService/LinkTypeService 创建实体，这属于**调用**而非**重新定义写入行为**。

---

## 表 2：跨 feature 不变量（INV-N）

全局业务约束，任何 spec 的 AC **不得与之矛盾**。
Feature spec 只能引用不变量 ID，不能重新定义或覆盖。

### v0.1.0 继承（保持不变）

| ID | 不变量描述 | 涉及领域对象 | 来源 spec |
|---|---|---|---|
| INV-1 | ObjectType 的 `apiName` 在同一 Ontology 内唯一 | ObjectType | 003 |
| INV-2 | ObjectType 的 `id` 在同一 Ontology 内唯一 | ObjectType | 003 |
| INV-3 | 同一 Dataset 只能关联一个 ObjectType（1:1 绑定） | Dataset ↔ ObjectType | 003 + 010 |
| INV-4 | 状态为 `active` 的 ObjectType 不可删除 | ObjectType | 003 |
| INV-5 | 保留关键字不可用作 apiName | ObjectType | 003 |
| INV-6 | 密码使用 AES-256 加密存储，API 响应和日志中不得出现明文 | DataSource Connection | 010 |
| INV-7 | LinkType 一端的 `apiName` 在关联 OT 的所有链接类型中唯一 | LinkType | 006 |
| INV-8 | `many-to-many` 基数的 LinkType 必须关联一个 `joinTableDatasetRid` | LinkType, Dataset | 006 |
| INV-9 | LinkType 的 `id` 在同一 Ontology 内唯一 | LinkType | 006 |

### v0.2.0 新增

| ID | 不变量描述 | 涉及领域对象 | 来源 Feature |
|---|---|---|---|
| INV-10 | Blueprint 只能从 `pending_review` 转为 `applied`，且至少有一个 accepted/edited 项 | Blueprint | 014 |
| INV-11 | BlueprintItem 的 userDecision 只能从 null → accepted/edited/rejected，不可逆 | BlueprintItem | 014 |
| INV-12 | 单用户同一时间仅允许一个活跃分析会话（status=active 且 Agent 正在执行） | AgentSession | 012 |
| INV-13 | 上传资料单文件 ≤ 10MB，单会话 ≤ 20 个文件 | AgentMaterial | 014 |
| INV-14 | Agent 所有破坏性操作（删除/级联更新）必须通过 `oo` CLI 执行，且触发人工授权确认 | Agent | 012, 013 |
| INV-15 | Blueprint apply 按依赖顺序创建：先 ObjectType → 再 Property → 最后 LinkType | Blueprint, BlueprintItem | 017 |
| INV-16 | 所有 Agent 建议（蓝图项）必须携带置信度分值（0.0-1.0）和至少一个推理来源标签 | BlueprintItem | 014 |

**规则**：

- 新增不变量：任何 spec 评审时如识别出新的全局约束，先在此表追加，再写 AC。
- 修改不变量：必须列出 Impacted Specs 清单，逐一回写并重新评审，全部完成后才能进入实现。
- 冲突检测：若某 spec 的 AC 与不变量矛盾，该 spec 评审不通过，必须先修改 AC 或更新不变量（两者不可并存矛盾）。

---

## 表 3：Feature 依赖图

集中管理跨 feature 依赖，与 README.md 保持同步。

### v0.2.0 Feature 依赖

| Feature | 依赖（必须先完成） | 说明 |
|---|---|---|
| 012-agent-foundation | v0.1.0 全部完成 | 需要现有 DB 基础设施和 Service 层 |
| 013-cli-and-skills | v0.1.0 全部完成 | 封装 v0.1.0 Service 层为 CLI 命令 |
| 014-material-and-blueprint | 012-agent-foundation, 013-cli-and-skills | 需要 Agent Engine + SSE + CLI 框架 |
| 015-workshop-foundation | 012-agent-foundation | 需要 Agent SSE 端点和会话数据 |
| 016-workshop-enhancement | 015-workshop-foundation | 需要工坊基础布局和画布组件 |
| 017-hitl-review-and-apply | 014-material-and-blueprint, 015-workshop-foundation, 013-cli-and-skills | 需要蓝图 API + 工坊布局 + CLI apply 命令 |
| 018-agent-sidekick | 012-agent-foundation | 需要 Agent Engine（P1，可延后） |
| 019-ontology-import-export | 013-cli-and-skills | 需要 CLI 框架（P1，可延后） |

### 并行开发说明

| 并行组 | Feature | 说明 |
|---|---|---|
| Phase 1 | F012 ∥ F013 | 完全独立，可并行 |
| Phase 3 | F015 完成后 F016 启动 | 串行依赖 |
| Phase 5 | F018 ∥ F019 | 完全独立，可并行 |

**规则**：

- spec 的"相关文档 → 依赖特性"字段必须与此表一致。
- 新增依赖关系时，先更新本表，再更新 spec 的依赖声明。

---

## 延后到 v0.3.0 的功能

| 功能 | 原优先级 | 延后原因 | 决策日期 |
|---|---|---|---|
| 对象类型复制（Copy Configuration） | P1→P2 | PRD v0.2.0 未提及，非 Agent 辅助构建核心路径 | 2026-03-24 |

---

## 变更历史

| 日期 | 变更内容 | 影响范围 |
|---|---|---|
| 2026-03-24 | 初始版本：从 v0.2.0 PRD 拆分，确立 8 个 feature、6 个新领域对象、7 个新不变量 | — |
