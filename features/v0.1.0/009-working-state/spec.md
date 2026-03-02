> **已归档**：本特性的核心逻辑已在 003-object-type-crud 中实现（T005–T006）。
> 后续如需扩展 Working State 能力，在各资源 CRUD 特性中增量完成。
> 状态：Archived (merged into F003)

# Feature: Working State 服务层

**关联 PRD**: [docs/prd/0_1_0（MVP）/本体管理平台（Ontology Manager） PRD.md §变更管理与版本控制]
**优先级**: P0
**所属版本**: v0.1.0
**状态**: Draft

---

## 用户故事

作为 **后端开发者**，
我希望 **有一个 Working State 服务层，所有 CRUD 操作通过它写入草稿而非直接修改主表**，
以便 **CRUD 特性（F003a/F004a/F005a）可以在此基础上实现，无需关心变更管理细节**。

作为 **本体管理员**，
我希望 **我的所有编辑操作都安全地保存在草稿中，不会立即影响已发布的本体**，
以便 **我可以在确认无误后再统一发布变更**。

---

## 验收标准

### Working State 生命周期
- **AC1**: 当 Ontology 没有活跃的 WorkingState 时，首次编辑操作自动创建一个新的 WorkingState
- **AC2**: WorkingState 记录 `baseVersion`（创建时的 `ontology.version`）
- **AC3**: 每次编辑操作（创建/修改/删除资源）追加一条 `Change` 记录到 `WorkingState.changes`

### 变更写入
- **AC4**: `add_change()` 接口支持三种变更类型：CREATE、UPDATE、DELETE
- **AC5**: CREATE 变更记录 `after` 字段（新资源的完整状态）
- **AC6**: UPDATE 变更记录 `before`（变更前状态）和 `after`（变更后状态）
- **AC7**: DELETE 变更记录 `before` 字段（被删除资源的完整状态）
- **AC8**: 对同一资源的多次 UPDATE 合并为单条变更（保留最早的 `before` 和最新的 `after`）
- **AC9**: CREATE 后再 DELETE 同一资源，两条变更相互抵消（从 changes 中移除）

### 合并视图查询
- **AC10**: `get_merged_view()` 返回已发布状态 + 草稿变更的合并结果
- **AC11**: 合并逻辑：查询主表（已发布）→ 加入 CREATE 的资源 → 应用 UPDATE → 排除 DELETE 的资源
- **AC12**: 合并视图中的每个资源标注状态：`published`、`created`、`modified`、`deleted`

### 发布（Save/Publish）
- **AC13**: 发布操作在单个数据库事务中原子完成
- **AC14**: 发布流程：应用所有 Changes 到主表 → 创建 ChangeRecord → 递增 `ontology.version` → 删除 WorkingState
- **AC15**: 发布成功后返回新创建的 ChangeRecord（含版本号）

### 丢弃（Discard）
- **AC16**: 丢弃操作删除 WorkingState 及其所有 Changes
- **AC17**: 丢弃后，合并视图查询返回纯粹的已发布状态

### 透明 Working State 模式
- **AC18**: CRUD API 端点保持标准 REST 风格（如 `POST /api/v1/object-types`），Working State 是服务层的实现细节
- **AC19**: 前端调用 CRUD API 时无需感知 Working State 的存在
- **AC20**: 变更管理相关操作通过独立端点暴露：`POST /api/v1/ontologies/{rid}/save`、`DELETE /api/v1/ontologies/{rid}/working-state`

---

## 核心接口设计

```python
class WorkingStateService:
    async def get_or_create(self, ontology_rid: str) -> WorkingState
    async def add_change(self, ontology_rid: str, change: Change) -> WorkingState
    async def publish(self, ontology_rid: str) -> ChangeRecord  # 原子事务
    async def discard(self, ontology_rid: str) -> None
    async def get_merged_view(self, ontology_rid: str, resource_type: str) -> list
```

> 此接口为概念性设计，具体参数和返回类型在 design.md 中细化。

---

## 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 合并视图实现方式 | 应用层合并（Python 代码） | MVP 数据量小（< 10,000 条），无需数据库视图 |
| 并发模型 | 单用户模型，无冲突检测 | MVP 简化；多用户协作延后到 v0.2.0 |
| WorkingState 粒度 | 每个 Ontology 一个全局 WorkingState | MVP 无多用户，无需 per-user WorkingState |
| CRUD API 感知 Working State | 透明模式（CRUD API 不暴露 Working State 概念） | 简化前端，保持 REST 语义纯粹 |

---

## 边界情况

- **不支持**：多用户并发编辑同一 WorkingState（MVP 单用户模型）
- **不支持**：冲突检测与 rebase（延后到 v0.2.0，参见 [docs/architecture/06-change-management.md §3.2]）
- **不支持**：WorkingState 过期策略（7 天 stale 标记）—— 延后到 v0.2.0
- **不支持**：版本回滚 —— 延后到 v0.2.0
- WorkingState 中不存在的资源类型视为无变更（返回纯已发布数据）
- 发布空的 WorkingState（无任何 Changes）应返回错误而非创建空版本

---

## 非功能要求

- **数据安全**: 发布操作在数据库事务中执行，任何步骤失败整个事务回滚
- **性能**: 合并视图查询响应时间 < 200ms（10,000 条资源以内）
- **可测试性**: WorkingStateService 可独立于 HTTP 层测试（纯服务层逻辑）

---

## 相关文档

- 领域模型（Change Management Model）: [docs/architecture/02-domain-model.md §Change Management Model]
- 变更管理架构: [docs/architecture/06-change-management.md]
- 依赖特性: [features/v0.1.0/002-database-schema]（需要 working_states、change_records 表）
- 被依赖: [features/v0.1.0/003-object-type-crud]（后端部分）、[features/v0.1.0/004-link-type-crud]（后端部分）、[features/v0.1.0/005-property-management]（后端部分）
