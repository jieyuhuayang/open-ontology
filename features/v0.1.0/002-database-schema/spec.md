# Feature: Database Schema（数据库表结构设计）

**关联 PRD**: [docs/prd/0_1_0（MVP）/本体管理平台（Ontology Manager） PRD.md §数据模型]
**优先级**: P0
**所属版本**: v0.1.0
**状态**: Done

---

## 用户故事

作为 **后端开发者**，
我希望 **有完整且经过验证的数据库表结构**，
以便 **所有业务实体能够被持久化，并满足 MVP 的查询需求（含变更管理基础设施）**。

---

## 验收标准

### 迁移基础
- **AC1**: Alembic 迁移脚本可在全新数据库上无错误地执行（`alembic upgrade head`）
- **AC2**: 迁移可回滚（`alembic downgrade -1` 不报错）

### 业务实体表
- **AC3**: `object_types` 表包含 PRD 定义的所有必要字段（含 API name、显示名、描述、状态等）
- **AC4**: `link_types` 表包含 PRD 定义的所有必要字段
- **AC5**: `link_type_endpoints` 表包含两端对象类型引用
- **AC6**: `properties` 表支持所有 21 种属性类型（参见 [docs/specs/supported-property-types.md]）

### 基础设施表
- **AC7**: `spaces` 表存在，迁移脚本中包含一条默认 Space 种子数据
- **AC8**: `ontologies` 表存在（含 `version` 整数字段），迁移脚本中包含一条默认 Ontology 种子数据（version=0）
- **AC9**: `working_states` 表存在，结构符合 [docs/architecture/02-domain-model.md §Change Management Model] 中 `WorkingState` 定义
- **AC10**: `change_records` 表存在，结构符合 [docs/architecture/02-domain-model.md §Change Management Model] 中 `ChangeRecord` 定义

### 约束与索引
- **AC11**: 外键约束正确建立，删除父记录时的级联行为符合业务规则
- **AC12**: 包含必要的索引以支持预期查询模式（按 API name 查询、全文搜索）

### RID 工具
- **AC13**: Domain 层包含 RID 生成工具函数（格式：`ri.<namespace>.<type>.<uuid4>`），供所有实体主键使用

---

## 核心实体

参见 [docs/architecture/02-domain-model.md] 和 [docs/specs/]:

### 基础设施表（新增）
- `spaces` — 空间（顶层容器，MVP 仅需种子数据）
- `ontologies` — 本体主表（含 `version` 版本号字段）

### 业务实体表
- `object_types` — 对象类型
- `properties` — 属性（属于 object type）
- `link_types` — 链接类型
- `link_type_endpoints` — 链接类型端点（两端的对象类型引用）

### 变更管理表（新增）
- `working_states` — 工作状态（userId, ontologyRid, changes JSONB, baseVersion）
- `change_records` — 变更记录（ontologyRid, version, changes JSONB, savedBy, savedAt）

---

## 种子数据

MVP 无 Space/Ontology 管理 UI，需在迁移脚本中内置默认数据：

- **默认 Space**: 硬编码 RID（如 `ri.ontology.space.default`），作为所有 Ontology 的容器
- **默认 Ontology**: 硬编码 RID（如 `ri.ontology.ontology.default`），version=0，关联默认 Space
- 所有 CRUD 操作在该默认 Ontology 下进行

---

## 边界情况

- **不支持**：多租户（Space 隔离）—— 延后到 v0.2.0
- **不支持**：软删除（当前直接物理删除）—— 待 PRD 确认
- 属性类型变更（如将 String 改为 Integer）不在本特性范围内
- `working_states.changes` 使用 JSONB 存储，无需单独的 changes 表

---

## 非功能要求

- **可维护性**: 每张表有清晰的注释（PostgreSQL COMMENT ON TABLE/COLUMN）
- **可扩展性**: RID 文本主键（`ri.<namespace>.<type>.<uuid4>` 格式），为分布式扩展预留空间

---

## 相关文档

- 领域模型: [docs/architecture/02-domain-model.md]
- 变更管理架构: [docs/architecture/06-change-management.md]
- 属性类型规范: [docs/specs/supported-property-types.md]
- 对象类型元数据: [docs/specs/object-type-metadata.md]
- 链接类型元数据: [docs/specs/link-type-metadata.md]
- 依赖特性: [features/v0.1.0/001-project-scaffolding]
