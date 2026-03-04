# 技术方案: Object Type CRUD（对象类型增删改查）— 扩展版

**关联 Spec**: `features/v0.1.0/003-object-type-crud/spec.md`
**架构参考**: `docs/architecture/02-domain-model.md`, `docs/specs/object-type-metadata.md`

---

## 实施状态

本方案分为两个阶段：

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 1 | ObjectType CRUD + WorkingState + 变更合并 | ✅ 已实现 |
| Phase 2 | Dataset 查询 + 不完整创建 + 完整性校验 + 类型兼容性校验 + intended_actions | 🆕 待实现 |

Phase 1 的已实现代码位于 `apps/server/app/` 各层，详见下方"Phase 1（已实现）"章节。

---

## Phase 1（已实现）

> 以下内容记录已实现的架构决策和数据结构，作为 Phase 2 的基础参考。

### 架构决策

**AD-1: F009 与 F003 合并实施** — WorkingStateService 作为 F003 的前置 Phase 实现。所有写操作先写入 WorkingState 草稿，不直接修改主表。

**AD-2: 合并视图在应用层实现** — Python 层合并已发布资源与 WorkingState 中的变更，返回带 `changeState` 标注的合并视图。

**AD-3: 变更合并（Change Collapsing）** — `_collapse_change()` 实现同一 `resourceRid` 的变更合并：CREATE+UPDATE→CREATE（更新 after）; CREATE+DELETE→抵消移除; UPDATE+UPDATE→保留最早 before + 最新 after; UPDATE+DELETE→DELETE（保留原始 before）。

**AD-4: 级联删除策略** — 删除 ObjectType 时为关联 LinkTypes 生成 DELETE 变更。

**AD-5: MVP 默认值** — `user_id="default"`, `ontology_rid="ri.ontology.ontology.default"`, `project_rid="ri.ontology.space.default"`。

**AD-6: 唯一性校验范围** — `id` 和 `api_name` 同时检查主表和 WorkingState 中的 CREATE 变更。

**AD-7: 保留关键字比较** — apiName 转小写后与保留字列表比较。

### 已实现的 API 端点

| Method | Path | 描述 |
|--------|------|------|
| GET | `/api/v1/object-types` | 列表查询（合并视图，分页） |
| POST | `/api/v1/object-types` | 创建（写入草稿） |
| GET | `/api/v1/object-types/{rid}` | 详情查询 |
| PUT | `/api/v1/object-types/{rid}` | 更新（写入草稿） |
| DELETE | `/api/v1/object-types/{rid}` | 删除（写入草稿） |
| POST | `/api/v1/ontologies/{rid}/save` | 发布草稿 |
| DELETE | `/api/v1/ontologies/{rid}/working-state` | 丢弃草稿 |
| GET | `/api/v1/ontologies/{rid}/working-state` | 查看草稿状态 |

### 已实现的文件清单

| 文件 | 说明 |
|------|------|
| `app/domain/object_type.py` | ObjectType 模型 + 请求/响应 schema |
| `app/domain/working_state.py` | Change、WorkingState、ChangeRecord 模型 |
| `app/domain/constants.py` | 默认值常量 |
| `app/domain/validators.py` | apiName/id 格式校验 + 保留字 |
| `app/domain/common.py` | DomainModel 基类, generate_rid() |
| `app/storage/models.py` | 全部 ORM 模型（单文件） |
| `app/storage/object_type_storage.py` | ObjectType 数据访问 |
| `app/storage/working_state_storage.py` | WorkingState 数据访问 |
| `app/storage/ontology_storage.py` | Ontology 版本管理 |
| `app/services/object_type_service.py` | ObjectType CRUD 业务逻辑 |
| `app/services/working_state_service.py` | 变更管理核心逻辑 |
| `app/routers/object_types.py` | ObjectType REST 端点 |
| `app/routers/ontology.py` | 变更管理端点 |
| `app/exceptions.py` | AppError + handler |

---

## Phase 2（新增）— 架构决策

### AD-8: Dataset 查询能力（只读）

- 003 特性仅保留 Dataset 的**查询能力**：列表、详情（含列结构）、in-use 判定
- Dataset 的数据写入（创建、删除、MySQL 导入、Excel/CSV 上传）由 Data Connection 特性负责
- `datasets` 和 `dataset_columns` 表的 DDL 仍在 003 的迁移中创建（因为 ObjectType 创建依赖 Dataset 查询），但**不创建 `dataset_rows` 表**（数据存储由 Data Connection 负责）
- **Dataset in-use 判定通过合并计算实现**：扫描已发布 ObjectType 的 `backing_datasource` + Working State 中 CREATE/UPDATE 变更的 `backingDatasource.rid`（排除 DELETE），运行时合并得出哪些 Dataset 正在被使用（AC-V3, KD-5）
- 同一 Dataset 只能关联一个 ObjectType 的约束改为**运行时校验**：创建/更新 ObjectType 绑定 Dataset 时，检查合并计算结果中是否已有其他 ObjectType 引用该 Dataset
- Publish 时 `backing_datasource` 随 ObjectType 自然落库；Discard 时无需补偿写——草稿丢弃后合并计算自动排除未发布的引用
- in-use 判定在**表（Dataset）粒度**，非数据库粒度

### AD-9: 不完整 ObjectType 支持

- `ObjectTypeCreateRequest` **所有字段均为可选**；`display_name` 为空时服务端自动生成占位名 `"Untitled Object Type"`，追加 4 位随机后缀避免冲突（如 `"Untitled Object Type a3b2"`）
- `id` 和 `api_name` 可选，为空时从 `display_name`（含占位名）自动推断：
  - `id` ← display_name 转 kebab-case 小写（`slugify`）
  - `api_name` ← display_name 转 PascalCase
- 若自动推断值与已有资源冲突，追加随机后缀（如 `employee-2a3b`）
- 完整性校验仅在 **publish 时** 执行（AC-V4），不在创建时拦截
- 创建请求新增可选字段 `backing_datasource_rid`、`intended_actions`、`project_rid`
- `project_rid` 可选，为空时回退 AD-5 默认值（`ri.ontology.space.default`）；MVP 单 Project 场景下前端自动选中默认 Project，后续多 Project 时扩展校验即可

### AD-10: intended_actions 元数据字段

- ObjectType 新增 `intended_actions: list[str] | None` 字段
- ORM 层为 JSONB 列
- 有效值为 `["create", "modify", "delete"]` 的子集
- 不创建 ActionType 实体（KD-3），仅记录勾选意图

### AD-11: 类型兼容性校验（AC-V6）

- Publish 时对每个 CREATE/UPDATE 的 ObjectType 执行类型兼容性检查
- 校验 Property 的 `baseType` 与关联 Dataset 列的 `inferredType` 是否在兼容矩阵中
- 类型推断逻辑（MySQL 类型映射、Excel/CSV 值推断）由 Data Connection 特性负责，003 仅消费已推断的 `inferredType`
- 不兼容时抛出 `FIELD_TYPE_INCOMPATIBLE` 错误，details 含 propertyId、propertyType、columnType

---

## Phase 2 — 数据库设计

### 新增表

#### `datasets` — 数据集元数据

```sql
CREATE TABLE datasets (
    rid                     TEXT PRIMARY KEY,
    name                    VARCHAR(255) NOT NULL,
    source_type             VARCHAR(20)  NOT NULL,  -- 'mysql' | 'excel' | 'csv'
    source_metadata         JSONB        NOT NULL DEFAULT '{}'::jsonb,
    row_count               INTEGER      NOT NULL DEFAULT 0,
    column_count            INTEGER      NOT NULL DEFAULT 0,
    status                  VARCHAR(20)  NOT NULL DEFAULT 'ready',  -- 'importing' | 'ready'
    imported_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
    ontology_rid            TEXT         NOT NULL REFERENCES ontologies(rid) ON DELETE CASCADE,
    created_by              VARCHAR(255) NOT NULL,
    CONSTRAINT fk_datasets_ontology FOREIGN KEY (ontology_rid) REFERENCES ontologies(rid)
);
```

`source_metadata` JSONB 格式示例：

```jsonc
// MySQL 导入（由 Data Connection 写入）
{
  "connectionName": "Production DB",
  "host": "db.example.com",
  "database": "sales",
  "table": "orders"
}

// Excel 上传（由 Data Connection 写入）
{
  "sourceFilename": "employees.xlsx",
  "sheetName": "Sheet1",
  "hasHeader": true
}

// CSV 上传（由 Data Connection 写入）
{
  "sourceFilename": "transactions.csv",
  "hasHeader": true
}
```

#### `dataset_columns` — 数据集列定义

```sql
CREATE TABLE dataset_columns (
    rid             TEXT    PRIMARY KEY,  -- 格式: ri.ontology.dataset-column.<uuid>
    dataset_rid     TEXT    NOT NULL REFERENCES datasets(rid) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    inferred_type   VARCHAR(50)  NOT NULL,  -- 推断的 PropertyBaseType 值
    is_nullable     BOOLEAN NOT NULL DEFAULT true,
    is_primary_key  BOOLEAN NOT NULL DEFAULT false,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uq_dataset_columns_name UNIQUE (dataset_rid, name)
);
```

> **注意**：`dataset_rows` 表（数据行存储）由 Data Connection 特性负责创建，003 不涉及。

### 修改现有表

#### `object_types` — 新增 `intended_actions` 列

```sql
ALTER TABLE object_types ADD COLUMN intended_actions JSONB;
-- 值示例: ["create", "modify", "delete"] 或 null
```

---

## Phase 2 — ORM 模型（`app/storage/models.py` 新增）

```python
class DatasetModel(Base):
    __tablename__ = "datasets"

    rid = Column(String, primary_key=True)
    name = Column(String(255), nullable=False)
    source_type = Column(String(20), nullable=False)  # mysql | excel | csv
    source_metadata = Column(JSONB, nullable=False, server_default="'{}'::jsonb")
    row_count = Column(Integer, nullable=False, server_default="0")
    column_count = Column(Integer, nullable=False, server_default="0")
    status = Column(String(20), nullable=False, server_default="'ready'")  # importing | ready
    imported_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    ontology_rid = Column(
        String, ForeignKey("ontologies.rid", ondelete="CASCADE"), nullable=False
    )
    created_by = Column(String(255), nullable=False)

    columns = relationship(
        "DatasetColumnModel", back_populates="dataset", cascade="all, delete-orphan"
    )


class DatasetColumnModel(Base):
    __tablename__ = "dataset_columns"

    rid = Column(String, primary_key=True)  # ri.ontology.dataset-column.<uuid>
    dataset_rid = Column(
        String, ForeignKey("datasets.rid", ondelete="CASCADE"), nullable=False
    )
    name = Column(String(255), nullable=False)
    inferred_type = Column(String(50), nullable=False)
    is_nullable = Column(Boolean, nullable=False, server_default="true")
    is_primary_key = Column(Boolean, nullable=False, server_default="false")
    sort_order = Column(Integer, nullable=False, server_default="0")

    dataset = relationship("DatasetModel", back_populates="columns")

    __table_args__ = (
        UniqueConstraint("dataset_rid", "name", name="uq_dataset_columns_name"),
    )
```

### ObjectTypeModel 修改

```python
# 在 ObjectTypeModel 中新增:
intended_actions = Column(JSONB, nullable=True)
```

---

## Phase 2 — Domain 模型

### Dataset 领域模型（`app/domain/dataset.py`）

```python
from datetime import datetime
from app.domain.common import DomainModel


class DatasetColumn(DomainModel):
    name: str
    inferred_type: str
    is_nullable: bool = True
    is_primary_key: bool = False
    sort_order: int = 0


class Dataset(DomainModel):
    rid: str
    name: str
    source_type: str  # "mysql" | "excel" | "csv"
    source_metadata: dict
    row_count: int = 0
    column_count: int = 0
    status: str = "ready"  # "importing" | "ready"
    imported_at: datetime
    ontology_rid: str
    created_by: str
    columns: list[DatasetColumn] = []


class DatasetListItem(DomainModel):
    """列表项，in_use 通过合并计算得出（扫描已发布 ObjectType + Working State 草稿）"""
    rid: str
    name: str
    source_type: str
    row_count: int
    column_count: int
    imported_at: datetime
    in_use: bool = False
    linked_object_type_name: str | None = None  # 合并计算时同时获取关联的 ObjectType 名称


class DatasetListResponse(DomainModel):
    items: list[DatasetListItem]
    total: int
```

### ObjectType 模型修改（`app/domain/object_type.py`）

```python
# --- 修改 ObjectType 类，新增字段 ---

class ObjectType(DomainModel):
    # ... 现有字段 ...
    intended_actions: list[str] | None = None  # 新增: ["create", "modify", "delete"] 的子集


# --- 修改 ObjectTypeCreateRequest ---

class ObjectTypeCreateRequest(DomainModel):
    display_name: str | None = None             # 可选，为空时生成占位名 "Untitled Object Type xxxx"
    id: str | None = None                       # 可选，为空时自动推断
    api_name: str | None = None                 # 可选，为空时自动推断
    plural_display_name: str | None = None
    description: str | None = None
    icon: Icon | None = None                    # 可选，为空时使用默认图标
    intended_actions: list[str] | None = None   # 新增
    backing_datasource_rid: str | None = None   # 新增: 关联的 Dataset RID
    project_rid: str | None = None              # 新增: 保存位置，为空回退 AD-5 默认值


# --- 修改 ObjectTypeUpdateRequest ---

class ObjectTypeUpdateRequest(DomainModel):
    # ... 现有字段 ...
    intended_actions: list[str] | None = None           # 新增
    backing_datasource_rid: str | None = None           # 新增
    primary_key_property_id: str | None = None          # 新增
    title_key_property_id: str | None = None            # 新增
```

### 校验器修改（`app/domain/validators.py`）

```python
# 新增 intended_actions 校验
VALID_INTENDED_ACTIONS = frozenset({"create", "modify", "delete"})

def validate_intended_actions(actions: list[str] | None) -> None:
    """校验 intended_actions 值的有效性。"""
    if actions is None:
        return
    invalid = set(actions) - VALID_INTENDED_ACTIONS
    if invalid:
        raise ValueError(f"Invalid intended_actions: {invalid}")
```

---

## Phase 2 — API 端点

### Dataset 查询（只读）

| Method | Path | 描述 | 状态码 |
|--------|------|------|--------|
| GET | `/api/v1/datasets` | 列表（含 in-use 状态 + `?search=` 搜索） | 200 |
| GET | `/api/v1/datasets/{rid}` | 详情（metadata + columns） | 200 |

> **注意**：Dataset 的创建（POST）、删除（DELETE）、数据预览（preview）端点由 Data Connection 特性负责。003 仅提供查询能力。

#### GET /api/v1/datasets

```jsonc
// Response 200
{
  "items": [
    {
      "rid": "ri.ontology.dataset.abc123",
      "name": "orders",
      "sourceType": "mysql",
      "rowCount": 5432,
      "columnCount": 12,
      "importedAt": "2026-03-01T10:00:00Z",
      "inUse": true,
      "linkedObjectTypeName": "Order"
    }
  ],
  "total": 1
}
```

#### GET /api/v1/datasets/{rid}

```jsonc
// Response 200
{
  "rid": "ri.ontology.dataset.abc123",
  "name": "orders",
  "sourceType": "mysql",
  "sourceMetadata": { "connectionName": "Prod DB", "host": "...", "database": "sales", "table": "orders" },
  "rowCount": 5432,
  "columnCount": 12,
  "importedAt": "2026-03-01T10:00:00Z",
  "columns": [
    { "name": "id", "inferredType": "integer", "isNullable": false, "isPrimaryKey": true, "sortOrder": 0 },
    { "name": "customer_name", "inferredType": "string", "isNullable": true, "isPrimaryKey": false, "sortOrder": 1 }
  ]
}
```

### ObjectType CRUD 修改

#### POST /api/v1/object-types — 不完整创建

```jsonc
// 最小请求（空 body，displayName 自动生成占位名）
{}
// 服务端自动生成: displayName="Untitled Object Type a3b2", id="untitled-object-type-a3b2", apiName="UntitledObjectTypeA3b2"

// 仅 displayName
{
  "displayName": "Employee"
  // id, apiName 自动推断为 "employee" 和 "Employee"
  // icon 使用默认值
}

// 完整请求（含新字段）
{
  "displayName": "Employee",
  "id": "employee",
  "apiName": "Employee",
  "description": "Company employees",
  "icon": { "name": "person", "color": "#4A90D9" },
  "intendedActions": ["create", "modify", "delete"],
  "backingDatasourceRid": "ri.ontology.dataset.xyz789",
  "projectRid": "ri.ontology.space.default"
}
```

#### PUT /api/v1/object-types/{rid} — 新增字段

```jsonc
// 新增可更新字段
{
  "intendedActions": ["create", "modify"],
  "backingDatasourceRid": "ri.ontology.dataset.new123",
  "primaryKeyPropertyId": "id",
  "titleKeyPropertyId": "name"
}
```

#### POST /api/v1/ontologies/{rid}/save — 完整性校验

发布时对每个 CREATE/UPDATE 的 ObjectType 执行完整性校验（AC-V4）+ 类型兼容性校验（AC-V6）。不完整的 ObjectType 阻止发布。

```jsonc
// 完整性校验失败响应 400
{
  "error": {
    "code": "INCOMPLETE_OBJECT_TYPE",
    "message": "Object type 'Employee' is incomplete and cannot be published",
    "details": {
      "objectTypeRid": "ri.ontology.object-type.abc123",
      "missingFields": ["backingDatasource", "primaryKeyPropertyId", "titleKeyPropertyId"]
    }
  }
}

// 类型兼容性校验失败响应 400
{
  "error": {
    "code": "FIELD_TYPE_INCOMPATIBLE",
    "message": "Property 'age' type 'integer' is incompatible with column 'age' type 'string'",
    "details": {
      "propertyId": "age",
      "propertyType": "integer",
      "columnType": "string"
    }
  }
}
```

完整性条件：
1. `display_name` 非空
2. `id` 非空
3. `api_name` 非空
4. `backing_datasource` 非空
5. 至少一个已映射属性（`backingColumn` 非空的 Property）
6. `primary_key_property_id` 非空
7. `title_key_property_id` 非空

---

## Phase 2 — Service 层设计

### DatasetService（`app/services/dataset_service.py`）

| 方法 | 说明 |
|------|------|
| `list(ontology_rid, search?)` | 列表查询，默认过滤 `status='ready'`；in-use 通过 `get_in_use_map()` 合并计算 |
| `get_by_rid(rid)` | 详情（含 columns） |
| `is_in_use(dataset_rid, ontology_rid)` | **合并计算** Dataset 是否被占用：扫描已发布 ObjectType 的 `backing_datasource` + Working State 中 CREATE/UPDATE 变更的 `backingDatasource.rid`（排除 DELETE） |
| `get_in_use_map(ontology_rid)` | 批量版本：返回 `{dataset_rid: object_type_display_name}` 映射，供列表查询使用 |

> **注意**：Dataset 的 `create()`、`delete()` 方法由 Data Connection 特性负责实现。003 的 DatasetService 仅提供查询和 in-use 判定。

### ObjectTypeService 修改（`app/services/object_type_service.py`）

新增/修改的方法：

| 方法 | 修改说明 |
|------|----------|
| `create(req)` | 支持不完整创建：`display_name` 为空时生成占位名 `"Untitled Object Type xxxx"`（4 位随机后缀）；`id`/`api_name`/`icon` 自动推断；处理 `backing_datasource_rid`（查询 Dataset → 构建 `backing_datasource` JSONB）；处理 `intended_actions`；处理 `project_rid`（为空回退 AD-5 默认值） |
| `update(rid, req)` | 新增 `intended_actions`、`backing_datasource_rid`、`primary_key_property_id`、`title_key_property_id` 字段更新逻辑 |
| `delete(rid)` | **新增 status 校验**：已发布的 ObjectType 检查主表 `status` 字段；未发布（Working State CREATE）检查 `change.after.status`；`status == 'active'` 时拒绝删除，抛出 `OBJECT_TYPE_ACTIVE_CANNOT_DELETE`（HTTP 400） |
| `_auto_infer_id(display_name)` | 新增：将 display_name 转为 kebab-case 小写 ID |
| `_auto_infer_api_name(display_name)` | 新增：将 display_name 转为 PascalCase API name |
| `_generate_placeholder_name()` | 新增：生成占位名 `"Untitled Object Type"` + 4 位随机十六进制后缀 |
| `_ensure_unique(ontology_rid, id, api_name)` | 新增：检查唯一性，冲突时追加随机后缀 |

自动推断逻辑：

```python
import re
import secrets

def _generate_placeholder_name(self) -> str:
    """生成占位名：Untitled Object Type + 4 位随机十六进制后缀。"""
    suffix = secrets.token_hex(2)  # 4 位 hex，如 "a3b2"
    return f"Untitled Object Type {suffix}"

def _auto_infer_id(self, display_name: str) -> str:
    """将 display_name 转为 kebab-case 小写 ID。"""
    # 移除非字母数字字符，用连字符分隔
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", display_name).strip("-").lower()
    if not slug or not slug[0].isalpha():
        slug = "obj-" + slug
    return slug

def _auto_infer_api_name(self, display_name: str) -> str:
    """将 display_name 转为 PascalCase API name。"""
    words = re.sub(r"[^a-zA-Z0-9]+", " ", display_name).split()
    if not words:
        return "UnnamedObject"
    return "".join(w.capitalize() for w in words)
```

### WorkingStateService 修改（`app/services/working_state_service.py`）

| 方法 | 修改说明 |
|------|----------|
| `publish(ontology_rid)` | 新增完整性校验 + **类型兼容性校验**：遍历变更中的 ObjectType CREATE/UPDATE，检查 7 项完整性条件（AC-V4）+ Property baseType 与 Dataset 列 inferredType 的兼容性（AC-V6）；不完整则抛出 `INCOMPLETE_OBJECT_TYPE`，类型不兼容则抛出 `FIELD_TYPE_INCOMPATIBLE` |
| `_apply_object_type_change(change)` | `key_map` 新增 `intendedActions → intended_actions`、`backingDatasource → backing_datasource`、`primaryKeyPropertyId → primary_key_property_id`、`titleKeyPropertyId → title_key_property_id` |

完整性校验逻辑（在 `publish()` 中调用）：

```python
async def _validate_completeness(self, changes: list[Change]) -> None:
    """校验所有将被创建或更新的 ObjectType 是否完整。"""
    for change in changes:
        if change.resource_type != ResourceType.OBJECT_TYPE:
            continue
        if change.change_type == ChangeType.DELETE:
            continue

        data = change.after or {}
        missing = []

        if not data.get("displayName"):
            missing.append("displayName")
        if not data.get("id"):
            missing.append("id")
        if not data.get("apiName"):
            missing.append("apiName")
        if not data.get("backingDatasource"):
            missing.append("backingDatasource")
        if not data.get("primaryKeyPropertyId"):
            missing.append("primaryKeyPropertyId")
        if not data.get("titleKeyPropertyId"):
            missing.append("titleKeyPropertyId")

        # 检查至少一个已映射属性
        ot_rid = change.resource_rid
        has_mapped = await self._has_mapped_properties(ot_rid, changes)
        if not has_mapped:
            missing.append("mappedProperties")

        if missing:
            raise AppError(
                code="INCOMPLETE_OBJECT_TYPE",
                message=f"Object type '{data.get('displayName', ot_rid)}' is incomplete",
                status_code=400,
                details={
                    "objectTypeRid": ot_rid,
                    "missingFields": missing,
                },
            )
```

类型兼容性校验逻辑（在 `publish()` 中、完整性校验之后调用）：

```python
# Property baseType 与 Dataset 列 inferredType 的兼容矩阵
TYPE_COMPATIBILITY: dict[str, set[str]] = {
    "string":    {"string", "integer", "short", "long", "float", "double", "decimal", "boolean", "date", "timestamp"},  # string 兼容所有
    "integer":   {"integer", "short"},
    "long":      {"integer", "short", "long"},
    "short":     {"short"},
    "float":     {"float"},
    "double":    {"float", "double"},
    "decimal":   {"float", "double", "decimal"},
    "boolean":   {"boolean"},
    "date":      {"date"},
    "timestamp": {"timestamp", "date"},
}


async def _validate_type_compatibility(self, changes: list[Change]) -> None:
    """校验 Property baseType 与 Dataset 列 inferredType 是否兼容（AC-V6）。"""
    for change in changes:
        if change.resource_type != ResourceType.OBJECT_TYPE:
            continue
        if change.change_type == ChangeType.DELETE:
            continue

        data = change.after or {}
        backing = data.get("backingDatasource")
        if not backing or not backing.get("rid"):
            continue

        dataset = await self._dataset_storage.get_by_rid(backing["rid"])
        if not dataset:
            continue

        # 构建列名→推断类型映射
        col_type_map = {col.name: col.inferred_type for col in dataset.columns}

        # 检查每个已映射 Property 的类型兼容性
        properties = await self._get_properties_for_object_type(change.resource_rid, changes)
        for prop in properties:
            if not prop.get("backingColumn"):
                continue
            col_name = prop["backingColumn"]
            col_type = col_type_map.get(col_name)
            if col_type is None:
                continue

            prop_type = prop.get("baseType", "string")
            compatible_types = TYPE_COMPATIBILITY.get(prop_type, {prop_type})
            if col_type not in compatible_types:
                raise AppError(
                    code="FIELD_TYPE_INCOMPATIBLE",
                    message=f"Property '{prop.get('id')}' type '{prop_type}' is incompatible with column '{col_name}' type '{col_type}'",
                    status_code=400,
                    details={
                        "propertyId": prop.get("id"),
                        "propertyType": prop_type,
                        "columnType": col_type,
                    },
                )
```

---

## Phase 2 — Router 层设计

### Dataset Router（`app/routers/datasets.py`）

```python
router = APIRouter(prefix="/api/v1", tags=["datasets"])

# GET  /datasets           → DatasetService.list()
# GET  /datasets/{rid}     → DatasetService.get_by_rid()
```

> **注意**：Dataset 的 POST（创建）、DELETE（删除）、预览端点由 Data Connection 特性负责。

---

## Phase 2 — 错误码

| HTTP | Code | 触发场景 |
|------|------|----------|
| 400 | `INCOMPLETE_OBJECT_TYPE` | 发布时 ObjectType 不满足完整性条件 |
| 400 | `FIELD_TYPE_INCOMPATIBLE` | 发布时 Property baseType 与 Dataset 列 inferredType 不兼容（AC-V6）；details 含 propertyId、propertyType、columnType |
| 400 | `OBJECT_TYPE_ACTIVE_CANNOT_DELETE` | 删除 active 状态的 ObjectType（已发布或 Working State 中 status=active） |
| 400 | `DATASET_ALREADY_IN_USE` | Dataset 已被其他 ObjectType 引用（合并计算：已发布 + Working State 草稿）（AC-V3） |
| 400 | `INVALID_INTENDED_ACTIONS` | intended_actions 包含无效值 |
| 404 | `DATASET_NOT_FOUND` | Dataset RID 不存在 |

---

## Phase 2 — 新增 Python 依赖

| 包 | 用途 |
|----|------|
| `python-multipart` | FastAPI 文件上传支持（现有依赖，确认已安装） |

> **注意**：`aiomysql`、`openpyxl`、`python-calamine`、`cryptography` 等导入相关依赖由 Data Connection 特性负责添加。

---

## Phase 2 — 文件变更清单

### 新建文件（~5 个）

| 文件路径 | 说明 |
|----------|------|
| `apps/server/app/domain/dataset.py` | Dataset 领域模型（查询侧） |
| `apps/server/app/storage/dataset_storage.py` | Dataset 数据访问（查询侧） |
| `apps/server/app/services/dataset_service.py` | Dataset 查询 + in-use 计算 |
| `apps/server/app/routers/datasets.py` | Dataset 查询路由 |
| `apps/server/alembic/versions/0004_add_dataset_tables.py` | 数据库迁移（datasets + dataset_columns + object_types.intended_actions） |

### 修改文件（~5 个）

| 文件路径 | 修改内容 |
|----------|----------|
| `apps/server/app/storage/models.py` | 新增 DatasetModel、DatasetColumnModel；ObjectTypeModel 新增 `intended_actions` 列 |
| `apps/server/app/domain/object_type.py` | ObjectType 新增 `intended_actions` 字段；ObjectTypeCreateRequest 改为全部可选 + 新增 `intended_actions`/`backing_datasource_rid`/`project_rid`；ObjectTypeUpdateRequest 新增字段 |
| `apps/server/app/domain/validators.py` | 新增 `validate_intended_actions()` |
| `apps/server/app/services/object_type_service.py` | `create()` 支持不完整创建 + 自动推断 + project_rid；`update()` 新增字段处理；`delete()` 新增 active 状态校验 |
| `apps/server/app/services/working_state_service.py` | `publish()` 新增完整性校验 + 类型兼容性校验；`_apply_object_type_change()` 的 key_map 新增字段 |
| `apps/server/app/main.py` | 注册 datasets router |
| `apps/server/app/config.py` | 无新增配置（导入相关配置由 Data Connection 负责） |

---

## Phase 2 — 前端设计

### 前端组件树

```
CreateObjectTypeWizard (Modal + Steps，替代现有 CreateObjectTypeModal)
├── WizardStepDatasource (Step 1)
│   ├── DatasetList (已有 Dataset 列表 + 搜索 + in-use 标记)
│   ├── DatasetPreview (选中后展开：列结构 + 前 5 行)
│   └── "Continue without datasource" 按钮
├── WizardStepMetadata (Step 2)
│   ├── IconSelector (复用已有)
│   ├── DisplayName 输入框（必填）
│   ├── Description 文本域
│   └── ID 输入框（自动推断 kebab-case，可编辑，带校验）
├── WizardStepProperties (Step 3)
│   ├── DatasourceColumnPane (左侧：数据源列，映射状态，操作按钮)
│   └── PropertyPane (右侧：属性列表，手动添加，PK/TK 设置)
├── WizardStepActions (Step 4)
│   └── ActionCheckboxGroup (Create/Modify/Delete 3 个 Checkbox + 说明文案)
└── WizardStepSaveLocation (Step 5)
    └── ProjectSelector (下拉选择，单 Project 自动选中)
```

### 前端状态管理

```typescript
// stores/create-wizard-store.ts — 替代 create-object-type-modal-store.ts
interface WizardProperty {
  id: string;
  displayName: string;
  baseType: string;
  backingColumn?: string;
  isPrimaryKey: boolean;
  isTitleKey: boolean;
}

interface CreateWizardState {
  isOpen: boolean;
  currentStep: number; // 0-4
  // Step 1
  selectedDatasetRid: string | null;
  // Step 2
  displayName: string;
  description: string;
  icon: Icon;
  objectTypeId: string;
  // Step 3
  properties: WizardProperty[];
  // Step 4
  intendedActions: string[];
  // Step 5
  projectRid: string;
  // Actions
  open: () => void;
  close: () => void;
  reset: () => void;
  nextStep: () => void;
  prevStep: () => void;
  // ... field setters
}
```

### 新增 API Hooks

| 文件 | Hook | 用途 |
|------|------|------|
| `api/datasets.ts` | `useDatasets(search?)` | Dataset 列表（含 inUse） |
| | `useDataset(rid)` | Dataset 详情（含 columns） |

### 修改现有组件

| 组件 | 变更 |
|------|------|
| `CreateObjectTypeModal.tsx` | 删除，替换为 `CreateObjectTypeWizard.tsx` |
| `create-object-type-modal-store.ts` | 删除，替换为 `create-wizard-store.ts` |
| `ObjectTypeOverviewPage.tsx` | 新增 backing datasource 区域、incomplete 提示 |
| `MetadataSection.tsx` | 新增 Status/Visibility 下拉、intended_actions 展示 |
| `ObjectTypeDetailLayout.tsx` | Active 状态删除置灰 |
| `CreateMenu.tsx` | 更新引用 |
| `HomeLayout.tsx` | 更新引用 |

### WizardStepDatasource 改动（问题 1.1–1.5）

- `useDatasets` 添加 `staleTime: 0` 防止缓存显示已删除数据集
- 移除 `MySQLImportWizard`、`FileUploadWizard` 导入及相关 state/handler
- 移除底部「上传 Excel/CSV」「从 MySQL 导入」「使用此数据集」三个按钮
- 数据集列表按可用在前（按导入时间降序）、已使用沉底排序
- 底部替换为引导文字：「需要导入新数据？请前往 数据连接」
- `CreateObjectTypeWizard` 移除 `isNextDisabled`（允许不选数据源直接下一步）

### ObjectTypeOverviewPage 属性/动作类型区域（问题 2）

- 替换第一个 `PlaceholderCard` 为属性列表 Card：
  - 使用 `useProperties(rid)` 加载属性
  - Card 标题：`属性 (N)` + 右上角「添加」按钮
  - 列表每行：`<PropertyTypeIcon baseType={p.baseType} /> {p.displayName}` + PK/Title Tag
  - 空状态：`<Empty description="暂未定义属性" />`
- 替换第二个 `PlaceholderCard` 为动作类型 Card：
  - 从 `data.intendedActions` 读取
  - Card 标题：`动作类型 (N)`
  - 有值时显示 Tag 列表（Create/Modify/Delete）
  - 空时显示 Empty

### PropertyTypeIcon 新组件

- 文件：`apps/web/src/components/PropertyTypeIcon.tsx`
- 为每种 `baseType` 映射 Ant Design 图标（string→FontSizeOutlined, number→NumberOutlined, boolean→CheckOutlined, date/timestamp→CalendarOutlined 等）
- 组件接口：`<PropertyTypeIcon baseType="string" />`，带 Tooltip 显示类型名称

### DiscoverPage 延迟通知 + 卡片导航（问题 3）

- 移除 `useEffect` 中的 `message.info()` 和 `removeItem()` — 不再自动通知和清理
- 保留 `useQueries` 用于检测已删除项
- Card 添加 `onClick`：若 query 报错则提示已删除并移除；否则导航到详情页
- 已删除项卡片加淡灰处理（opacity: 0.6）

### i18n 新增 keys

wizard.*、dataset.*、step.* 命名空间

---

## 验证方式

### 单元测试

| 测试 | 覆盖 |
|------|------|
| `test_domain_models_phase2.py` | Dataset / DatasetColumn / DatasetListItem 序列化、默认值 |
| `test_validators.py` | intended_actions 校验（有效值、无效值） |
| `test_completeness_validation.py` | 完整性校验（7 项条件的各种组合）+ DELETE 类型变更跳过校验 |
| `test_type_compatibility.py` | 类型兼容性校验（兼容矩阵、不兼容报错含 details） |
| `test_auto_infer.py` | display_name → id/api_name 自动推断 + 冲突后缀 + 占位名生成 |
| `test_active_delete.py` | active 状态 ObjectType 拒绝删除（已发布 + Working State 草稿场景） |
| `test_dataset_service.py` | is_in_use 合并计算、get_in_use_map 批量版本、list 含 in-use 标记 |
| `test_dataset_storage.py` | _to_domain() ORM→Domain 转换、_to_list_item() 列表项转换 |

### 集成测试

| 测试 | 覆盖 |
|------|------|
| `test_dataset_api.py` | Dataset 列表（含 in-use 合并计算标记） |
| `test_incomplete_object_type.py` | 不完整创建 + 补全 + 发布完整性校验 + 类型兼容性校验 |

---

## 评审意见处理记录

> 评审文档：`features/v0.1.0/003-object-type-crud/review.md`（2026-03-02）

### Blocker（3 条）

| # | 评审意见 | 处理结果 | 涉及章节 |
|---|----------|----------|----------|
| 1 | Working State 与 Dataset 关联状态冲突 | **采纳**：Dataset in-use 状态改为运行时合并计算（扫描已发布 ObjectType + Working State 草稿）；publish 时随 ObjectType 自然落库，discard 无需补偿 | AD-8、DatasetService |
| 2 | 导入失败无事务化保证 | **需求变更消解**：导入功能已移至 Data Connection 特性，003 不涉及导入操作 | — |
| 3 | 数据库主键违反仓库硬约束 | **采纳**：`dataset_columns` 使用 `rid TEXT PRIMARY KEY`（格式 `ri.ontology.dataset-column.<uuid>`） | 数据库设计、ORM |

### Major（5 条）

| # | 评审意见 | 处理结果 | 涉及章节 |
|---|----------|----------|----------|
| 4 | Save Location（Project 选择）未覆盖 | **部分采纳**：ObjectTypeCreateRequest 新增可选字段 `project_rid`，默认回退 AD-5 默认值。MVP 单 Project 场景下前端自动选中 | AD-9、Domain |
| 5 | 任意步骤退出与 display_name 必填冲突 | **采纳**：`display_name` 改为可选，为空时服务端自动生成占位名 | AD-9、ObjectTypeService |
| 6 | 类型兼容性校验（AC-V6）缺失 | **采纳**：publish 校验新增兼容矩阵检查；新增错误码 `FIELD_TYPE_INCOMPATIBLE` | AD-11、WorkingStateService、错误码表 |
| 7 | .xls 支持声明与实现不一致 | **需求变更消解**：文件上传已移至 Data Connection 特性 | — |
| 8 | active 状态不可删除未落地 | **采纳**：ObjectTypeService.delete() 新增 status 校验；新增错误码 `OBJECT_TYPE_ACTIVE_CANNOT_DELETE` | ObjectTypeService、错误码表 |

### Medium（3 条）

| # | 评审意见 | 处理结果 | 涉及章节 |
|---|----------|----------|----------|
| 9 | MySQL 测试连接返回格式不统一 | **需求变更消解**：MySQL 连接管理已移至 Data Connection 特性 | — |
| 10 | 明文密码通过 Header 传递 | **需求变更消解**：MySQL 连接管理已移至 Data Connection 特性 | — |
| 11 | MySQL 类型映射与 PRD 不一致 | **需求变更消解**：类型映射由 Data Connection 特性负责 | — |
