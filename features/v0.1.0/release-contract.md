# Release Contract — v0.1.0

> 本文件是版本级领域归属与全局约束的权威来源。
> **所有 spec.md 在动笔前必须先阅读本文件。**
> 每次 spec 评审时，必须对照本文件检查一致性。

---

## 表 1：领域对象归属

每个领域对象只能有一个 Owner Feature，负责定义该对象的写入行为（创建、更新、删除）。
其他 feature 的 spec 只能描述"读取"或"引用"该对象，不得在 AC 中定义其写入行为。

| 领域对象 | Owner Feature | 说明 |
|---------|--------------|------|
| Ontology | 003-object-type-crud | 顶层容器，包括创建、切换 |
| ObjectType | 003-object-type-crud | CRUD + WorkingState |
| Property（对象类型属性） | 007-property-management | 属性定义、类型、默认值、格式化规则 |
| LinkType | 006-link-type-crud | 链接类型 CRUD，包括端点定义、基数约束 |
| WorkingState / Change | 003-object-type-crud (Phase 1) | 草稿/已发布状态机，变更管理 |
| DataSource / Connection | 010-data-connection | 连接注册、测试、Schema 提取 |
| Dataset / DatasetColumn | 010-data-connection（写入）/ 003-object-type-crud（查询） | Dataset 由 DC 创建，OT 查询 + in-use 判定 |

**规则**：
- 若某 spec 需要描述一个不属于自己 Owner 的领域对象的写入行为，必须先提出变更申请（更新本表），经用户确认后方可写 AC。
- 非 Owner feature 的 AC 中如出现"创建/修改/删除 X"，视为越界，评审不通过。

---

## 表 2：跨 feature 不变量（INV-N）

全局业务约束，任何 spec 的 AC **不得与之矛盾**。
Feature spec 只能引用不变量 ID，不能重新定义或覆盖。

| ID | 不变量描述 | 涉及领域对象 | 来源 spec |
|----|-----------|------------|---------|
| INV-1 | ObjectType 的 `apiName` 在同一 Ontology 内唯一 | ObjectType | 003 |
| INV-2 | ObjectType 的 `id` 在同一 Ontology 内唯一 | ObjectType | 003 |
| INV-3 | 同一 Dataset 只能关联一个 ObjectType（1:1 绑定） | Dataset ↔ ObjectType | 003 + 010 |
| INV-4 | 状态为 `active` 的 ObjectType 不可删除 | ObjectType | 003 |
| INV-5 | 保留关键字不可用作 apiName | ObjectType | 003 |
| INV-6 | 密码使用 AES-256 加密存储，API 响应和日志中不得出现明文 | DataSource Connection | 010 |

**规则**：
- 新增不变量：任何 spec 评审时如识别出新的全局约束，先在此表追加，再写 AC。
- 修改不变量：必须列出 Impacted Specs 清单，逐一回写并重新评审，全部完成后才能进入实现。
- 冲突检测：若某 spec 的 AC 与不变量矛盾，该 spec 评审不通过，必须先修改 AC 或更新不变量（两者不可并存矛盾）。

---

## 表 3：Feature 依赖图

集中管理跨 feature 依赖，与 README.md 保持同步。

| Feature | 依赖（必须先完成） | 说明 |
|---------|-----------------|------|
| 003-object-type-crud | 001-scaffolding, 002-db-schema | 需要 scaffolding 和 DB schema |
| 010-data-connection | 001-scaffolding, 002-db-schema | 需要 scaffolding 和 DB schema |
| 005-object-type-crud-frontend | 003-object-type-crud, 004-app-shell | 需要后端 API + App Shell |
| 005-object-type-crud-frontend | 010-data-connection | 需要 Dataset 列表 API（向导 Step 1） |

**规则**：
- spec 的"相关文档 → 依赖特性"字段必须与此表一致。
- 新增依赖关系时，先更新本表，再更新 spec 的依赖声明。

---

## 变更历史

| 日期 | 变更内容 | 影响范围 |
|------|---------|---------|
| 2026-03-03 | 初始版本：从 PRD 需求拆分中创建，确立 003/006/007/010 领域归属 | — |
