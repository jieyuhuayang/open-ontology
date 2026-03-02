# Plan: Database Schema（数据库表结构设计）

**关联 Spec**: `features/v0.1.0/002-database-schema/spec.md`
**架构参考**: `docs/architecture/02-domain-model.md`, `docs/architecture/06-change-management.md`

---

## Context

MVP 需要完整的数据库表结构来持久化所有业务实体（ObjectType、Property、LinkType）以及变更管理基础设施（WorkingState、ChangeRecord）。F001 脚手架已就绪，本特性在空数据库上建立所有表、索引、全文搜索触发器和种子数据。

---

## 架构决策

### AD-1: ORM 模型位置

`apps/server/app/storage/models.py` 单文件，包含 `Base` 声明基类 + 所有模型。遵循 CLAUDE.md 分层规则：storage 层拥有 ORM 模型，domain 层拥有 Pydantic 模型。

### AD-2: Enum 策略 — PostgreSQL 原生 ENUM

创建 6 个 PG ENUM 类型：`resource_status`、`visibility`、`cardinality`、`join_method`、`link_side`、`property_base_type`。Python 端使用 `str, enum.Enum` 子类镜像。

理由：DB 层类型安全，这些枚举值域稳定。

### AD-3: 级联规则

| 父表 | 子表 | ON DELETE |
|------|------|-----------|
| `spaces` | `ontologies` | RESTRICT |
| `ontologies` | `object_types` | CASCADE |
| `ontologies` | `link_types` | CASCADE |
| `ontologies` | `working_states` | CASCADE |
| `ontologies` | `change_records` | CASCADE |
| `object_types` | `properties` | CASCADE |
| `object_types` | `link_type_endpoints` | RESTRICT |
| `link_types` | `link_type_endpoints` | CASCADE |

组合关系用 CASCADE，引用关系用 RESTRICT。

### AD-4: Space ↔ Ontology 关系

避免循环外键。仅保留 `ontologies.space_rid → spaces.rid` 单向 FK。Domain 模型中 `Space.ontologyRid` 由服务层查询获得。

### AD-5: link_type_endpoints 主键

使用自增整数 `id` 作为 PK（非 RID），因为 endpoint 不是一等资源。通过 `UNIQUE(link_type_rid, side)` 约束确保每个 LinkType 恰好有 A/B 两端。

### AD-6: 全文搜索策略

使用 `tsvector` 列 + PostgreSQL 触发器 + GIN 索引。选用 `'simple'` 配置（不做词干提取），因为内容混合中英文和技术术语。

权重分配：A=display_name/api_name, B=id/aliases, C=description。

---

## 表结构总览

### 1. `spaces`（空间）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `rid` | VARCHAR | PK | `ri.ontology.space.<hex>` |
| `name` | VARCHAR(255) | NOT NULL | 空间名称 |
| `description` | TEXT | nullable | 描述 |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| `created_by` | VARCHAR(255) | NOT NULL | |

### 2. `ontologies`（本体）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `rid` | VARCHAR | PK | `ri.ontology.ontology.<hex>` |
| `space_rid` | VARCHAR | FK→spaces(rid) RESTRICT, NOT NULL | |
| `display_name` | VARCHAR(255) | NOT NULL | |
| `description` | TEXT | nullable | |
| `version` | INTEGER | NOT NULL, DEFAULT 0 | 当前发布版本号 |
| `last_modified_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| `last_modified_by` | VARCHAR(255) | NOT NULL | |

### 3. `object_types`（对象类型）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `rid` | VARCHAR | PK | |
| `id` | VARCHAR(255) | NOT NULL, UNIQUE | 用户可见 ID |
| `api_name` | VARCHAR(255) | NOT NULL, UNIQUE | PascalCase |
| `display_name` | VARCHAR(255) | NOT NULL | |
| `plural_display_name` | VARCHAR(255) | nullable | |
| `description` | TEXT | nullable | |
| `aliases` | JSONB | nullable | JSON 数组 |
| `icon` | JSONB | NOT NULL | `{"name":"...","color":"#..."}` |
| `status` | resource_status | NOT NULL, DEFAULT 'experimental' | |
| `visibility` | visibility | NOT NULL, DEFAULT 'normal' | |
| `backing_datasource` | JSONB | nullable | 数据源引用 |
| `primary_key_property_id` | VARCHAR(255) | nullable | |
| `title_key_property_id` | VARCHAR(255) | nullable | |
| `project_rid` | VARCHAR | NOT NULL | |
| `ontology_rid` | VARCHAR | FK→ontologies CASCADE, NOT NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| `created_by` | VARCHAR(255) | NOT NULL | |
| `last_modified_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| `last_modified_by` | VARCHAR(255) | NOT NULL | |
| `search_vector` | TSVECTOR | 触发器维护 | 全文搜索 |

### 4. `properties`（属性）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `rid` | VARCHAR | PK | |
| `id` | VARCHAR(255) | NOT NULL | ObjectType 内唯一 |
| `api_name` | VARCHAR(255) | NOT NULL | camelCase, ObjectType 内唯一 |
| `object_type_rid` | VARCHAR | FK→object_types CASCADE, NOT NULL | |
| `display_name` | VARCHAR(255) | NOT NULL | |
| `description` | TEXT | nullable | |
| `base_type` | property_base_type | NOT NULL | 21 种基础类型 |
| `array_inner_type` | property_base_type | nullable | baseType=Array 时使用 |
| `struct_schema` | JSONB | nullable | baseType=Struct 时使用 |
| `backing_column` | VARCHAR(255) | nullable | |
| `status` | resource_status | NOT NULL, DEFAULT 'experimental' | |
| `visibility` | visibility | NOT NULL, DEFAULT 'normal' | |
| `value_formatting` | JSONB | nullable | 值格式化配置 |
| `conditional_formatting` | JSONB | nullable | 条件格式化规则 |
| `is_primary_key` | BOOLEAN | NOT NULL, DEFAULT false | |
| `is_title_key` | BOOLEAN | NOT NULL, DEFAULT false | |
| `shared_property_rid` | VARCHAR | nullable | P2 共享属性 |
| `search_vector` | TSVECTOR | 触发器维护 | 全文搜索 |

唯一约束：`UNIQUE(object_type_rid, api_name)`, `UNIQUE(object_type_rid, id)`

### 5. `link_types`（链接类型）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `rid` | VARCHAR | PK | |
| `id` | VARCHAR(255) | NOT NULL, UNIQUE | |
| `cardinality` | cardinality | NOT NULL | |
| `join_method` | join_method | NOT NULL | |
| `status` | resource_status | NOT NULL, DEFAULT 'experimental' | |
| `project_rid` | VARCHAR | NOT NULL | |
| `ontology_rid` | VARCHAR | FK→ontologies CASCADE, NOT NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| `created_by` | VARCHAR(255) | NOT NULL | |
| `last_modified_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| `last_modified_by` | VARCHAR(255) | NOT NULL | |

### 6. `link_type_endpoints`（链接类型端点）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | SERIAL | PK (自增) | 非一等资源，不用 RID |
| `link_type_rid` | VARCHAR | FK→link_types CASCADE, NOT NULL | |
| `side` | link_side | NOT NULL | 'A' 或 'B' |
| `object_type_rid` | VARCHAR | FK→object_types RESTRICT, NOT NULL | |
| `display_name` | VARCHAR(255) | NOT NULL | |
| `plural_display_name` | VARCHAR(255) | nullable | |
| `api_name` | VARCHAR(255) | NOT NULL | |
| `visibility` | visibility | NOT NULL, DEFAULT 'normal' | |
| `foreign_key_property_id` | VARCHAR(255) | nullable | 外键连接时使用 |

唯一约束：`UNIQUE(link_type_rid, side)`

### 7. `working_states`（工作状态）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `rid` | VARCHAR | PK | |
| `user_id` | VARCHAR(255) | NOT NULL | |
| `ontology_rid` | VARCHAR | FK→ontologies CASCADE, NOT NULL | |
| `changes` | JSONB | NOT NULL, DEFAULT '[]'::jsonb | Change[] 数组 |
| `base_version` | INTEGER | NOT NULL | 基于的 Ontology 版本 |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| `last_modified_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

唯一约束：`UNIQUE(user_id, ontology_rid)` — 每用户每 Ontology 最多一个

### 8. `change_records`（变更记录）

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `rid` | VARCHAR | PK | |
| `ontology_rid` | VARCHAR | FK→ontologies CASCADE, NOT NULL | |
| `version` | INTEGER | NOT NULL | 对应 Ontology 版本号 |
| `changes` | JSONB | NOT NULL | Change[] 数组 |
| `saved_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| `saved_by` | VARCHAR(255) | NOT NULL | |
| `description` | TEXT | nullable | 变更说明 |

唯一约束：`UNIQUE(ontology_rid, version)` — 版本号唯一

---

## 全文搜索触发器

为 `object_types` 和 `properties` 表创建触发器维护 `search_vector` 列：

**object_types**: 合并 display_name(A), api_name(A), id(B), aliases(B), description(C)
**properties**: 合并 display_name(A), api_name(A), description(C)

使用 `'simple'` 配置，适用于中英文混合术语。GIN 索引加速全文搜索查询。

---

## 种子数据

在迁移脚本中插入：

1. **默认 Space**: `rid='ri.ontology.space.default'`, `name='Default Space'`
2. **默认 Ontology**: `rid='ri.ontology.ontology.default'`, `space_rid='ri.ontology.space.default'`, `version=0`

---

## 文件变更清单

| 操作 | 文件路径 | 说明 |
|------|---------|------|
| **新建** | `apps/server/app/storage/models.py` | Base + 6 个 Python Enum + 8 个 ORM Model |
| **新建** | `apps/server/alembic/versions/0002_create_schema.py` | 建表 + ENUM + 触发器 + 索引 + 种子数据 |
| **修改** | `apps/server/alembic/env.py` | `target_metadata = None` → `from app.storage.models import Base; target_metadata = Base.metadata` |

AC13（RID 生成工具）已在 `apps/server/app/domain/common.py` 中实现，无需改动。

---

## 验证方式

1. **AC1**: 在全新数据库上执行 `alembic upgrade head`，确认无错误
2. **AC2**: 执行 `alembic downgrade -1`，确认无错误；再 `alembic upgrade head` 确认可重新升级
3. **AC3-AC10**: 连接数据库，使用 `\d+ <table_name>` 检查每张表的列、类型、约束是否与 spec 一致
4. **AC11**: 尝试删除被 link_type_endpoints 引用的 object_type，确认 RESTRICT 阻止删除
5. **AC12**: 执行 `\di` 检查索引存在；执行全文搜索查询确认 GIN 索引生效
6. **AC13**: Python 单元测试验证 `generate_rid()` 格式正确（已存在）
7. **种子数据**: 查询 `spaces` 和 `ontologies` 表确认默认记录存在
