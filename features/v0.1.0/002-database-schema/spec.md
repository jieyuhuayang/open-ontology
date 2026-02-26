# Feature: Database Schema（数据库表结构设计）

**关联 PRD**: [docs/prd/0_1_0（MVP）/本体管理平台（Ontology Manager） PRD.md §数据模型]
**优先级**: P0
**所属版本**: v0.1.0
**状态**: Draft

---

## 用户故事

作为 **后端开发者**，
我希望 **有完整且经过验证的数据库表结构**，
以便 **所有业务实体能够被持久化，并满足 MVP 的查询需求**。

---

## 验收标准

- **AC1**: Alembic 迁移脚本可在全新数据库上无错误地执行（`alembic upgrade head`）
- **AC2**: `object_types` 表包含 PRD 定义的所有必要字段（含 API name、显示名、描述、状态等）
- **AC3**: `link_types` 表包含 PRD 定义的所有必要字段（含两端对象类型引用）
- **AC4**: `properties` 表支持所有 21 种属性类型（参见 [docs/specs/supported-property-types.md]）
- **AC5**: 外键约束正确建立，删除父记录时的级联行为符合业务规则
- **AC6**: 包含必要的索引以支持预期查询模式（按 API name 查询、全文搜索）
- **AC7**: 迁移可回滚（`alembic downgrade -1` 不报错）

---

## 核心实体

参见 [docs/architecture/02-domain-model.md] 和 [docs/specs/]:

- `object_types` — 对象类型
- `properties` — 属性（属于 object type）
- `link_types` — 链接类型
- `link_type_endpoints` — 链接类型端点（两端的对象类型引用）
- `ontology_versions` — 本体版本（Working State 相关）

---

## 边界情况

- **不支持**：多租户（Space 隔离）—— 延后到 v0.2.0
- **不支持**：软删除（当前直接物理删除）—— 待 PRD 确认
- 属性类型变更（如将 String 改为 Integer）不在本特性范围内

---

## 非功能要求

- **可维护性**: 每张表有清晰的注释（PostgreSQL COMMENT ON TABLE/COLUMN）
- **可扩展性**: UUID 主键，为分布式扩展预留空间

---

## 相关文档

- 领域模型: [docs/architecture/02-domain-model.md]
- 属性类型规范: [docs/specs/supported-property-types.md]
- 对象类型元数据: [docs/specs/object-type-metadata.md]
- 链接类型元数据: [docs/specs/link-type-metadata.md]
- 依赖特性: [features/v0.1.0/001-project-scaffolding]
