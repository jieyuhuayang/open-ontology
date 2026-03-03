# Release Contract — vX.X.X

> 本文件是版本级领域归属与全局约束的权威来源。
> **所有 spec.md 在动笔前必须先阅读本文件。**
> 每次 spec 评审时，必须对照本文件检查一致性。

---

## 表 1：领域对象归属

每个领域对象只能有一个 Owner Feature，负责定义该对象的写入行为（创建、更新、删除）。
其他 feature 的 spec 只能描述"读取"或"引用"该对象，不得在 AC 中定义其写入行为。

| 领域对象 | Owner Feature | 说明 |
|---------|--------------|------|
| Object Type | FNN-xxx | 包括创建、更新、删除、属性结构 |
| Link Type | FNN-xxx | 包括端点定义、基数约束 |
| Property（对象类型属性） | FNN-xxx | 包括属性类型、默认值、格式化规则 |
| Shared Property | FNN-xxx | 跨对象类型复用属性的定义权 |
| Action Type | FNN-xxx | 动作定义、参数、写回目标 |
| Working State | FNN-xxx | 草稿/已发布状态机 |
| _（新增对象时在此追加）_ | — | — |

**规则**：
- 若某 spec 需要描述一个不属于自己 Owner 的领域对象的写入行为，必须先提出变更申请（更新本表），经用户确认后方可写 AC。
- 非 Owner feature 的 AC 中如出现"创建/修改/删除 X"，视为越界，评审不通过。

---

## 表 2：跨 feature 不变量（INV-N）

全局业务约束，任何 spec 的 AC **不得与之矛盾**。
Feature spec 只能引用不变量 ID，不能重新定义或覆盖。

| ID | 不变量描述 | 涉及领域对象 | 来源 spec |
|----|-----------|------------|---------|
| INV-1 | Object Type 的 `apiName` 在同一 Ontology 内唯一 | Object Type | FNN-xxx |
| INV-2 | Link Type 两端的 Object Type 必须已存在 | Link Type, Object Type | FNN-xxx |
| INV-3 | 处于 Working State（草稿）的变更不对外可见，必须发布后生效 | Working State | FNN-xxx |
| _（新增约束时在此追加）_ | — | — | — |

**规则**：
- 新增不变量：任何 spec 评审时如识别出新的全局约束，先在此表追加，再写 AC。
- 修改不变量：必须列出 Impacted Specs 清单，逐一回写并重新评审，全部完成后才能进入实现。
- 冲突检测：若某 spec 的 AC 与不变量矛盾，该 spec 评审不通过，必须先修改 AC 或更新不变量（两者不可并存矛盾）。

---

## 表 3：Feature 依赖图

集中管理跨 feature 依赖，与 README.md 保持同步。

| Feature | 依赖（必须先完成） | 说明 |
|---------|-----------------|------|
| FNN-xxx | FNN-yyy | 原因：需要 yyy 提供的领域对象/API |
| _（新增 feature 时在此追加）_ | — | — |

**规则**：
- spec 的"相关文档 → 依赖特性"字段必须与此表一致。
- 新增依赖关系时，先更新本表，再更新 spec 的依赖声明。

---

## 变更历史

| 日期 | 变更内容 | 影响范围 |
|------|---------|---------|
| YYYY-MM-DD | 初始版本 | — |
