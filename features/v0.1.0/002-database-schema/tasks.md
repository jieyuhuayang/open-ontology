# Tasks: Database Schema（原子任务清单）

**关联 Plan**: [plan.md](./plan.md)
**状态**: Done

> ⚠️ **注意**：本文件为事后补写（retroactive）。所有任务均已完成。

---

## Group 1：ORM 模型

- [x] **T001** `apps/server/app/storage/models.py` — 创建 `Base` 声明基类 + 6 个 Python Enum（`ResourceStatus`, `Visibility`, `Cardinality`, `JoinMethod`, `LinkSide`, `PropertyBaseType`）+ 8 个 ORM Model
  - 依赖：F001 脚手架就绪
  - AC 覆盖：AC3–AC10（模型定义与表结构一一对应）

---

## Group 2：Alembic 迁移

- [x] **T002** `apps/server/alembic/versions/0002_create_schema.py` — 建表 + ENUM 类型 + 触发器 + 索引 + 种子数据
  - 依赖：T001
  - 包含：
    - 6 个 PostgreSQL ENUM 类型（`resource_status`, `visibility`, `cardinality`, `join_method`, `link_side`, `property_base_type`）
    - 8 张表（`spaces`, `ontologies`, `object_types`, `properties`, `link_types`, `link_type_endpoints`, `working_states`, `change_records`）
    - 外键约束：组合关系 CASCADE，引用关系 RESTRICT
    - GIN 索引：`ix_object_types_search_vector`, `ix_properties_search_vector`
    - 全文搜索触发器：`object_types_search_vector_update()`, `properties_search_vector_update()`
    - 种子数据：默认 Space + 默认 Ontology
    - 完整的 `downgrade()` 回滚逻辑
  - AC 覆盖：AC1, AC2, AC7, AC8, AC11, AC12

---

## Group 3：Alembic 配置更新

- [x] **T003** `apps/server/alembic/env.py` — 将 `target_metadata = None` 改为 `from app.storage.models import Base; target_metadata = Base.metadata`
  - 依赖：T001
  - AC 覆盖：支持 Alembic autogenerate 检测模型漂移

---

## AC 覆盖对照

| AC | 描述 | 覆盖任务 |
|----|------|---------|
| AC1 | `alembic upgrade head` 无错误 | T002 |
| AC2 | `alembic downgrade -1` 无错误 | T002 |
| AC3 | `object_types` 表字段完整 | T001, T002 |
| AC4 | `link_types` 表字段完整 | T001, T002 |
| AC5 | `link_type_endpoints` 表含两端引用 | T001, T002 |
| AC6 | `properties` 表支持 21 种属性类型 | T001, T002 |
| AC7 | `spaces` 表 + 种子数据 | T002 |
| AC8 | `ontologies` 表 + 种子数据 | T002 |
| AC9 | `working_states` 表结构符合设计 | T001, T002 |
| AC10 | `change_records` 表结构符合设计 | T001, T002 |
| AC11 | FK 级联行为正确 | T002 |
| AC12 | GIN 索引 + 全文搜索 | T002 |
| AC13 | RID 生成工具 | F001 已实现（`app/domain/common.py`） |
