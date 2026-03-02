# 技术方案: Object Type CRUD（对象类型增删改查）— 扩展版

**关联 Spec**: `features/v0.1.0/003-object-type-crud/spec.md`
**架构参考**: `docs/architecture/02-domain-model.md`, `docs/specs/object-type-metadata.md`

---

## 实施状态

本方案分为两个阶段：

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 1 | ObjectType CRUD + WorkingState + 变更合并 | ✅ 已实现 |
| Phase 2 | Dataset 管理 + MySQL 导入 + Excel/CSV 上传 + 不完整创建 + 完整性校验 + intended_actions | 🆕 待实现 |

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

### AD-8: Dataset 作为平台内部存储实体

- 新建 `datasets`、`dataset_columns`、`dataset_rows` 三张表存储导入的数据快照
- Dataset 不进入 Working State（是实际数据，非 schema 元数据）
- ObjectType 通过现有 `backing_datasource` JSONB 字段引用 Dataset RID：`{"rid": "<dataset_rid>", "name": "...", "type": "mysql|excel|csv"}`
- **Dataset in-use 判定通过合并计算实现**：扫描已发布 ObjectType 的 `backing_datasource` + Working State 中 CREATE/UPDATE 变更的 `backingDatasource.rid`（排除 DELETE），运行时合并得出哪些 Dataset 正在被使用（AC-V3, KD-5）
- 同一 Dataset 只能关联一个 ObjectType 的约束改为**运行时校验**：创建/更新 ObjectType 绑定 Dataset 时，检查合并计算结果中是否已有其他 ObjectType 引用该 Dataset
- Publish 时 `backing_datasource` 随 ObjectType 自然落库；Discard 时无需补偿写——草稿丢弃后合并计算自动排除未发布的引用

### AD-9: MySQL 连接管理

- 新建 `mysql_connections` 表存储连接配置，可跨导入复用
- 密码使用 AES-256-GCM 加密存储（`cryptography` 库的 Fernet），密钥从环境变量 `ENCRYPTION_KEY` 读取
- 使用 `aiomysql` 异步连接 MySQL
- 连接配置不绑定特定 ObjectType

### AD-10: 文件上传两阶段处理

- **第一阶段**：`POST /upload/preview` — 上传文件 → 存临时目录 → 解析返回预览（列名、推断类型、前 50 行、Sheet 列表）→ 返回 `file_token`（UUID）
- **第二阶段**：`POST /upload/confirm` — 携带 `file_token` + 用户配置（选中 Sheet、首行表头、列选择、类型修改、Dataset 名称）→ 触发后台导入任务
- 临时文件存储在 `{UPLOAD_TEMP_DIR}/{file_token}/` 目录，TTL 30 分钟
- 清理机制：后台 asyncio 定时任务每 10 分钟扫描过期文件

### AD-11: 不完整 ObjectType 支持

- `ObjectTypeCreateRequest` **所有字段均为可选**；`display_name` 为空时服务端自动生成占位名 `"Untitled Object Type"`，追加 4 位随机后缀避免冲突（如 `"Untitled Object Type a3b2"`）
- `id` 和 `api_name` 可选，为空时从 `display_name`（含占位名）自动推断：
  - `id` ← display_name 转 kebab-case 小写（`slugify`）
  - `api_name` ← display_name 转 PascalCase
- 若自动推断值与已有资源冲突，追加随机后缀（如 `employee-2a3b`）
- 完整性校验仅在 **publish 时** 执行（AC-V4），不在创建时拦截
- 创建请求新增可选字段 `backing_datasource_rid`、`intended_actions`、`project_rid`
- `project_rid` 可选，为空时回退 AD-5 默认值（`ri.ontology.space.default`）；MVP 单 Project 场景下前端自动选中默认 Project，后续多 Project 时扩展校验即可

### AD-12: intended_actions 元数据字段

- ObjectType 新增 `intended_actions: list[str] | None` 字段
- ORM 层为 JSONB 列
- 有效值为 `["create", "modify", "delete"]` 的子集
- 不创建 ActionType 实体（KD-3），仅记录勾选意图

### AD-13: 后台任务 + 轮询（导入模式）

- MySQL 导入和 Excel/CSV 导入均采用**后台任务**模式
- POST 导入请求立即返回 `{ taskId, status: "pending" }`（HTTP 202 Accepted）
- 前端通过 `GET /api/v1/import-tasks/{taskId}` 轮询任务状态
- 任务状态机：`pending → running → completed | failed`
- 任务完成后携带结果：`{ status: "completed", datasetRid, rowCount, columnCount, duration }`
- 任务失败后携带错误：`{ status: "failed", error: { code, message } }`
- 内部使用 `asyncio.create_task()` 在后台执行导入逻辑
- 任务状态存储在内存 dict（MVP 单进程足够）；后续版本可迁移到 Redis
- 任务 TTL 1 小时，过期后自动从内存清理

---

## Phase 2 — 数据库设计

### 新增表

#### `datasets` — 数据集快照

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
// MySQL 导入
{
  "connectionRid": "ri.ontology.mysql-connection.abc123",
  "connectionName": "Production DB",
  "host": "db.example.com",
  "database": "sales",
  "table": "orders"
}

// Excel 上传
{
  "sourceFilename": "employees.xlsx",
  "sheetName": "Sheet1",
  "hasHeader": true
}

// CSV 上传
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

#### `dataset_rows` — 数据集行数据

```sql
CREATE TABLE dataset_rows (
    dataset_rid TEXT      NOT NULL REFERENCES datasets(rid) ON DELETE CASCADE,
    row_index   INTEGER   NOT NULL,
    data        JSONB     NOT NULL,  -- {"column_name": value, ...}
    PRIMARY KEY (dataset_rid, row_index)
);

CREATE INDEX ix_dataset_rows_dataset ON dataset_rows(dataset_rid);
```

#### `mysql_connections` — MySQL 连接配置

```sql
CREATE TABLE mysql_connections (
    rid                 TEXT PRIMARY KEY,
    name                VARCHAR(255) NOT NULL,
    host                VARCHAR(255) NOT NULL,
    port                INTEGER      NOT NULL DEFAULT 3306,
    database_name       VARCHAR(255) NOT NULL,
    username            VARCHAR(255) NOT NULL,
    encrypted_password  TEXT         NOT NULL,  -- AES-256-GCM 加密
    ssl_enabled         BOOLEAN      NOT NULL DEFAULT false,
    ontology_rid        TEXT         NOT NULL REFERENCES ontologies(rid) ON DELETE CASCADE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by          VARCHAR(255) NOT NULL,
    last_used_at        TIMESTAMPTZ
);
```

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
    rows = relationship(
        "DatasetRowModel", back_populates="dataset", cascade="all, delete-orphan"
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


class DatasetRowModel(Base):
    __tablename__ = "dataset_rows"

    dataset_rid = Column(
        String, ForeignKey("datasets.rid", ondelete="CASCADE"), nullable=False, primary_key=True
    )
    row_index = Column(Integer, nullable=False, primary_key=True)
    data = Column(JSONB, nullable=False)

    dataset = relationship("DatasetModel", back_populates="rows")

    __table_args__ = (
        Index("ix_dataset_rows_dataset", "dataset_rid"),
    )


class MySQLConnectionModel(Base):
    __tablename__ = "mysql_connections"

    rid = Column(String, primary_key=True)
    name = Column(String(255), nullable=False)
    host = Column(String(255), nullable=False)
    port = Column(Integer, nullable=False, server_default="3306")
    database_name = Column(String(255), nullable=False)
    username = Column(String(255), nullable=False)
    encrypted_password = Column(Text, nullable=False)
    ssl_enabled = Column(Boolean, nullable=False, server_default="false")
    ontology_rid = Column(
        String, ForeignKey("ontologies.rid", ondelete="CASCADE"), nullable=False
    )
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_by = Column(String(255), nullable=False)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
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


class DatasetPreviewResponse(DomainModel):
    """数据集预览：列定义 + 前 N 行"""
    rid: str
    name: str
    columns: list[DatasetColumn]
    rows: list[dict]  # [{"col_name": value, ...}, ...]
    total_rows: int
```

### MySQL 连接模型（`app/domain/mysql_connection.py`）

```python
from datetime import datetime
from app.domain.common import DomainModel


class MySQLConnection(DomainModel):
    rid: str
    name: str
    host: str
    port: int = 3306
    database_name: str
    username: str
    ssl_enabled: bool = False
    ontology_rid: str
    created_at: datetime
    created_by: str
    last_used_at: datetime | None = None
    # 注意: encrypted_password 不出现在 domain 模型中（安全）


class MySQLConnectionCreateRequest(DomainModel):
    name: str
    host: str
    port: int = 3306
    database_name: str
    username: str
    password: str  # 明文，仅在请求中，写入前加密
    ssl_enabled: bool = False


class MySQLConnectionTestRequest(DomainModel):
    """测试连接请求，不保存"""
    host: str
    port: int = 3306
    database_name: str
    username: str
    password: str
    ssl_enabled: bool = False
    # 可选：复用已保存连接（此时 password 可选）
    connection_rid: str | None = None


class MySQLTableInfo(DomainModel):
    name: str
    row_count: int | None = None  # 预估行数，可能为 None


class MySQLColumnInfo(DomainModel):
    name: str
    data_type: str           # MySQL 原始类型，如 "varchar(255)", "int"
    is_nullable: bool
    is_primary_key: bool
    inferred_property_type: str  # 映射后的 PropertyBaseType 值


class MySQLTablePreview(DomainModel):
    columns: list[MySQLColumnInfo]
    rows: list[dict]
    total_rows: int | None = None
```

### 导入任务模型（`app/domain/import_task.py`）

```python
import enum
from datetime import datetime
from app.domain.common import DomainModel


class ImportTaskStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ImportTask(DomainModel):
    task_id: str
    status: ImportTaskStatus = ImportTaskStatus.PENDING
    dataset_rid: str | None = None    # 成功后填充
    row_count: int | None = None
    column_count: int | None = None
    duration_ms: int | None = None
    error_code: str | None = None
    error_message: str | None = None
    created_at: datetime
```

### 类型映射规则（`app/domain/type_mapping.py`）

```python
"""MySQL 和 Excel/CSV 数据类型到 PropertyBaseType 的映射规则。"""

# --- MySQL → PropertyBaseType ---
# 按 PRD §8.7 统一映射规则：
#   BIGINT/INT/TINYINT → integer（MVP 不引入 long/short）
#   DECIMAL/FLOAT/DOUBLE → double（MVP 不引入 float/decimal）
#   BOOLEAN/BIT(1) → boolean
# 已知限制：BIGINT 超 32 位精度损失、DECIMAL 高精度丢失；后续版本可引入 long/decimal 类型支持
MYSQL_TYPE_MAP: dict[str, str] = {
    # 整数类型 → 统一为 integer（PRD §8.7）
    "tinyint":    "integer",
    "smallint":   "integer",
    "mediumint":  "integer",
    "int":        "integer",
    "integer":    "integer",
    "bigint":     "integer",
    # 浮点 / 定点 → 统一为 double（PRD §8.7）
    "float":      "double",
    "double":     "double",
    "decimal":    "double",
    "numeric":    "double",
    # 字符串
    "char":       "string",
    "varchar":    "string",
    "tinytext":   "string",
    "text":       "string",
    "mediumtext": "string",
    "longtext":   "string",
    "enum":       "string",
    "set":        "string",
    # 二进制
    "binary":     "string",
    "varbinary":  "string",
    "blob":       "string",
    "tinyblob":   "string",
    "mediumblob": "string",
    "longblob":   "string",
    # 日期时间
    "date":       "date",
    "datetime":   "timestamp",
    "timestamp":  "timestamp",
    "time":       "string",
    "year":       "integer",
    # 布尔（PRD §8.7: BOOLEAN/BIT(1) → boolean）
    "bit":        "boolean",
    "boolean":    "boolean",
    # JSON
    "json":       "string",
}


def mysql_type_to_property_type(mysql_type: str) -> str:
    """将 MySQL 列类型映射为 PropertyBaseType。

    mysql_type 为 INFORMATION_SCHEMA.COLUMNS.DATA_TYPE 的值（小写）。
    未知类型回退为 "string"。
    """
    return MYSQL_TYPE_MAP.get(mysql_type.lower().split("(")[0].strip(), "string")


# --- Excel/CSV 值推断 ---
# 扫描前 1000 行，按优先级匹配（AC-EX7）:
#   全整数 → integer
#   含小数 → double
#   ISO 日期 (YYYY-MM-DD) → date
#   ISO 时间戳 (YYYY-MM-DDTHH:MM:SS) → timestamp
#   true/false (不区分大小写) → boolean
#   其他 → string
# 某列超过 5% 值不匹配推断类型时回退为 string

import re
from datetime import date as date_type, datetime as datetime_type

_INTEGER_RE = re.compile(r"^-?\d+$")
_FLOAT_RE = re.compile(r"^-?\d+\.\d+$")
_ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_ISO_TIMESTAMP_RE = re.compile(r"^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?")
_BOOLEAN_VALUES = frozenset({"true", "false", "1", "0"})

INFER_SAMPLE_SIZE = 1000
INFER_MISMATCH_THRESHOLD = 0.05  # 5%


def infer_column_type(values: list[str | None]) -> str:
    """从一列值（字符串形式）推断 PropertyBaseType。

    跳过 None 和空字符串。若有效值为空，返回 "string"。
    """
    non_empty = [v for v in values[:INFER_SAMPLE_SIZE] if v is not None and v.strip() != ""]
    if not non_empty:
        return "string"

    total = len(non_empty)
    threshold = int(total * INFER_MISMATCH_THRESHOLD)

    # 尝试各类型，按优先级
    checks: list[tuple[str, re.Pattern]] = [
        ("integer", _INTEGER_RE),
        ("double", _FLOAT_RE),
        ("date", _ISO_DATE_RE),
        ("timestamp", _ISO_TIMESTAMP_RE),
    ]

    for prop_type, pattern in checks:
        mismatches = sum(1 for v in non_empty if not pattern.match(v.strip()))
        if mismatches <= threshold:
            return prop_type

    # Boolean 检查
    bool_mismatches = sum(1 for v in non_empty if v.strip().lower() not in _BOOLEAN_VALUES)
    if bool_mismatches <= threshold:
        return "boolean"

    return "string"
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

---

## Phase 2 — API 端点

### Dataset 管理

| Method | Path | 描述 | 状态码 |
|--------|------|------|--------|
| GET | `/api/v1/datasets` | 列表（含 in-use 状态 + `?search=` 搜索） | 200 |
| GET | `/api/v1/datasets/{rid}` | 详情（metadata + columns） | 200 |
| GET | `/api/v1/datasets/{rid}/preview` | 预览（前 N 行，`?limit=50`） | 200 |
| DELETE | `/api/v1/datasets/{rid}` | 删除（in-use 则 403） | 204 |

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

#### GET /api/v1/datasets/{rid}/preview

```jsonc
// Response 200
{
  "rid": "ri.ontology.dataset.abc123",
  "name": "orders",
  "columns": [...],
  "rows": [
    { "id": 1, "customer_name": "Alice" },
    { "id": 2, "customer_name": "Bob" }
  ],
  "totalRows": 5432
}
```

### MySQL 连接管理

| Method | Path | 描述 | 状态码 |
|--------|------|------|--------|
| GET | `/api/v1/mysql-connections` | 列表已保存连接 | 200 |
| POST | `/api/v1/mysql-connections` | 保存连接 | 201 |
| POST | `/api/v1/mysql-connections/test` | 测试连接（不保存） | 200 |
| GET | `/api/v1/mysql-connections/{rid}/tables` | 浏览表列表 | 200 |
| GET | `/api/v1/mysql-connections/{rid}/tables/{table}/columns` | 表列结构 | 200 |
| GET | `/api/v1/mysql-connections/{rid}/tables/{table}/preview` | 表数据预览（前 50 行） | 200 |

#### POST /api/v1/mysql-connections

```jsonc
// Request
{
  "name": "Production DB",
  "host": "db.example.com",
  "port": 3306,
  "databaseName": "sales",
  "username": "reader",
  "password": "s3cret",
  "sslEnabled": false
}

// Response 201
{
  "rid": "ri.ontology.mysql-connection.def456",
  "name": "Production DB",
  "host": "db.example.com",
  "port": 3306,
  "databaseName": "sales",
  "username": "reader",
  "sslEnabled": false,
  "createdAt": "2026-03-01T10:00:00Z"
  // 注意: password 不在响应中返回
}
```

#### POST /api/v1/mysql-connections/test

```jsonc
// Request
{
  "host": "db.example.com",
  "port": 3306,
  "databaseName": "sales",
  "username": "reader",
  "password": "s3cret",
  "sslEnabled": false
}

// Response 200 — 成功
{ "success": true }

// Response 422 — 连接失败（统一错误格式）
{
  "error": {
    "code": "MYSQL_CONNECTION_FAILED",
    "message": "Access denied for user 'reader'@'...' (using password: YES)"
  }
}
```

#### GET /api/v1/mysql-connections/{rid}/tables

```jsonc
// Response 200
{
  "tables": [
    { "name": "orders", "rowCount": 5432 },
    { "name": "customers", "rowCount": 1200 }
  ]
}
```

#### GET /api/v1/mysql-connections/{rid}/tables/{table}/columns

```jsonc
// Response 200
{
  "columns": [
    {
      "name": "id",
      "dataType": "int",
      "isNullable": false,
      "isPrimaryKey": true,
      "inferredPropertyType": "integer"
    },
    {
      "name": "created_at",
      "dataType": "datetime",
      "isNullable": true,
      "isPrimaryKey": false,
      "inferredPropertyType": "timestamp"
    }
  ]
}
```

#### GET /api/v1/mysql-connections/{rid}/tables/{table}/preview

```jsonc
// Response 200
{
  "columns": [...],
  "rows": [ { "id": 1, "created_at": "2026-01-01 00:00:00" }, ... ],
  "totalRows": 5432
}
```

### MySQL 导入

| Method | Path | 描述 | 状态码 |
|--------|------|------|--------|
| POST | `/api/v1/datasets/import/mysql` | 触发 MySQL 导入 → 后台任务 | 202 |

#### POST /api/v1/datasets/import/mysql

```jsonc
// Request — 使用已保存连接（服务端解密密码，不再由客户端传递）
{
  "connectionRid": "ri.ontology.mysql-connection.def456",
  "table": "orders",
  "datasetName": "orders_snapshot_2026",
  "selectedColumns": ["id", "customer_name", "amount", "created_at"]  // null = 全选
}

// Response 202
{
  "taskId": "import-a1b2c3d4",
  "status": "pending"
}
```

### 文件上传

| Method | Path | 描述 | 状态码 |
|--------|------|------|--------|
| POST | `/api/v1/datasets/upload/preview` | 上传文件 → 解析预览 | 200 |
| POST | `/api/v1/datasets/upload/confirm` | 确认导入 → 后台任务 | 202 |

#### POST /api/v1/datasets/upload/preview

```jsonc
// Request: multipart/form-data
// file: <binary>

// Response 200
{
  "fileToken": "uuid-token-here",
  "filename": "employees.xlsx",
  "fileSize": 1048576,
  "sheets": ["Sheet1", "Sheet2"],       // Excel 才有; CSV 为 null
  "defaultSheet": "Sheet1",
  "preview": {
    "columns": [
      { "name": "name", "inferredType": "string", "sampleValues": ["Alice", "Bob", "Charlie"] },
      { "name": "age", "inferredType": "integer", "sampleValues": ["30", "25", "35"] }
    ],
    "rows": [ { "name": "Alice", "age": "30" }, ... ],
    "totalRows": 1000,
    "hasHeader": true
  }
}
```

#### POST /api/v1/datasets/upload/confirm

```jsonc
// Request
{
  "fileToken": "uuid-token-here",
  "datasetName": "Employees",
  "sheetName": "Sheet1",         // Excel 才需要; CSV 可省略
  "hasHeader": true,
  "selectedColumns": ["name", "age"],  // null = 全选
  "columnTypeOverrides": {       // 用户手动修改的类型
    "age": "string"
  }
}

// Response 202
{
  "taskId": "import-e5f6g7h8",
  "status": "pending"
}
```

### 导入任务轮询

| Method | Path | 描述 | 状态码 |
|--------|------|------|--------|
| GET | `/api/v1/import-tasks/{taskId}` | 查询任务状态 | 200 |

#### GET /api/v1/import-tasks/{taskId}

```jsonc
// pending
{ "taskId": "import-a1b2c3d4", "status": "pending" }

// running
{ "taskId": "import-a1b2c3d4", "status": "running" }

// completed
{
  "taskId": "import-a1b2c3d4",
  "status": "completed",
  "datasetRid": "ri.ontology.dataset.xyz789",
  "rowCount": 5432,
  "columnCount": 12,
  "durationMs": 3200
}

// failed
{
  "taskId": "import-a1b2c3d4",
  "status": "failed",
  "error": {
    "code": "MYSQL_IMPORT_CONNECTION_LOST",
    "message": "Connection lost during import at row 3200"
  }
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

发布时对每个 CREATE/UPDATE 的 ObjectType 执行完整性校验（AC-V4）。不完整的 ObjectType 阻止发布。

```jsonc
// 校验失败响应 400
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
| `list(ontology_rid, search?)` | 列表查询，默认过滤 `status='ready'`（不展示 importing 中的 Dataset）；in-use 通过 `is_in_use()` 合并计算 |
| `get_by_rid(rid)` | 详情（含 columns） |
| `get_preview(rid, limit=50)` | 前 N 行数据预览 |
| `create(name, source_type, source_metadata, columns, rows, ontology_rid)` | 创建 Dataset（内部方法，由 import service 调用）；在独立事务中执行 |
| `delete(rid)` | 删除（in-use 检查：通过 `is_in_use()` 合并计算 → 403） |
| `is_in_use(dataset_rid, ontology_rid)` | **合并计算** Dataset 是否被占用：扫描已发布 ObjectType 的 `backing_datasource` + Working State 中 CREATE/UPDATE 变更的 `backingDatasource.rid`（排除 DELETE） |
| `get_in_use_map(ontology_rid)` | 批量版本：返回 `{dataset_rid: object_type_display_name}` 映射，供列表查询使用 |

### MySQLImportService（`app/services/mysql_import_service.py`）

| 方法 | 说明 |
|------|------|
| `test_connection(req)` | 测试 MySQL 连接（不保存）；成功返回 200 `{success: true}`；失败抛出 `MYSQL_CONNECTION_FAILED`（422） |
| `save_connection(req)` | 保存连接配置（密码加密后存储） |
| `list_connections(ontology_rid)` | 列表已保存连接 |
| `browse_tables(connection_rid)` | 使用已保存连接的加密密码（服务端解密）连接 MySQL，获取表列表 |
| `get_table_columns(connection_rid, table)` | 使用已保存连接，获取表列结构 + 类型映射 |
| `preview_table(connection_rid, table, limit=50)` | 使用已保存连接，预览表数据 |
| `start_import(connection_rid, table, dataset_name, selected_columns)` | 启动后台导入任务，返回 task_id；使用已保存连接 |

导入逻辑（后台执行，**单事务保证**）：
1. 在独立 async session 中开启事务
2. INSERT `datasets` 记录（`status='importing'`）
3. 连接 MySQL，执行 `SELECT {columns} FROM {table}` 游标查询
4. 创建 `dataset_columns` 记录（类型通过 `mysql_type_to_property_type` 映射）
5. 批量 INSERT 到 `dataset_rows`（每批 1000 行）
6. UPDATE `datasets.row_count`、`column_count`、`status='ready'`
7. 更新 `mysql_connections.last_used_at`
8. COMMIT 事务
9. **异常处理**：任何步骤失败 → ROLLBACK 全部（包括 datasets、columns、rows），不产生残留数据

### FileImportService（`app/services/file_import_service.py`）

| 方法 | 说明 |
|------|------|
| `upload_and_preview(file)` | 保存临时文件 → 解析预览 → 返回 file_token + 预览数据 |
| `confirm_import(file_token, config)` | 启动后台导入任务，返回 task_id |

解析逻辑（按文件格式分派）：
- **`.xlsx`**：使用 `openpyxl`（只读模式）读取指定 Sheet
- **`.xls`**：使用 `python-calamine`（Rust 实现，安全高效）读取
- **`.csv`**：使用 Python 标准库 `csv` 读取
- 类型推断调用 `infer_column_type()` 处理前 1000 行

导入逻辑（后台执行，**单事务保证**）：
1. 在独立 async session 中开启事务
2. INSERT `datasets` 记录（`status='importing'`）
3. 从临时文件重新读取完整数据（按用户选择的 Sheet、列、类型）
4. 创建 `dataset_columns`（使用用户确认/修改后的类型）
5. 批量 INSERT 到 `dataset_rows`（每批 1000 行）
6. UPDATE `datasets.row_count`、`column_count`、`status='ready'`
7. COMMIT 事务
8. 删除临时文件
9. **异常处理**：任何步骤失败 → ROLLBACK 全部（包括 datasets、columns、rows），不产生残留数据；临时文件保留以便重试

### ImportTaskService（`app/services/import_task_service.py`）

| 方法 | 说明 |
|------|------|
| `create_task()` | 创建任务，返回 task_id |
| `get_task(task_id)` | 查询任务状态 |
| `update_status(task_id, status, **kwargs)` | 更新任务状态（running/completed/failed） |
| `_cleanup_expired()` | 清理过期任务（TTL 1 小时） |

内部存储：

```python
# 内存存储（MVP 单进程足够）
_tasks: dict[str, ImportTask] = {}
```

### CryptoService（`app/services/crypto_service.py`）

| 方法 | 说明 |
|------|------|
| `encrypt(plaintext)` | AES-256-GCM 加密，返回 Base64 密文 |
| `decrypt(ciphertext)` | 解密，返回明文 |

实现：

```python
from cryptography.fernet import Fernet
import os

# 密钥从环境变量读取；Fernet 要求 32 字节 URL-safe base64 编码
_KEY = os.environ.get("ENCRYPTION_KEY", Fernet.generate_key().decode())
_fernet = Fernet(_KEY)


class CryptoService:
    @staticmethod
    def encrypt(plaintext: str) -> str:
        return _fernet.encrypt(plaintext.encode()).decode()

    @staticmethod
    def decrypt(ciphertext: str) -> str:
        return _fernet.decrypt(ciphertext.encode()).decode()
```

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
# GET  /datasets/{rid}/preview → DatasetService.get_preview()
# DELETE /datasets/{rid}   → DatasetService.delete()
```

### MySQL Connection Router（`app/routers/mysql_connections.py`）

```python
router = APIRouter(prefix="/api/v1", tags=["mysql-connections"])

# GET  /mysql-connections         → MySQLImportService.list_connections()
# POST /mysql-connections         → MySQLImportService.save_connection()
# POST /mysql-connections/test    → MySQLImportService.test_connection()
# GET  /mysql-connections/{rid}/tables  → MySQLImportService.browse_tables()
# GET  /mysql-connections/{rid}/tables/{table}/columns → MySQLImportService.get_table_columns()
# GET  /mysql-connections/{rid}/tables/{table}/preview → MySQLImportService.preview_table()
```

### Import Router（`app/routers/imports.py`）

```python
router = APIRouter(prefix="/api/v1", tags=["imports"])

# POST /datasets/import/mysql      → MySQLImportService.start_import()    → 202
# POST /datasets/upload/preview    → FileImportService.upload_and_preview()
# POST /datasets/upload/confirm    → FileImportService.confirm_import()    → 202
# GET  /import-tasks/{task_id}     → ImportTaskService.get_task()
```

**注意**：浏览/预览 MySQL 表的端点**使用已保存连接的加密密码**（服务端解密），不再要求客户端传递密码。用户流程为：test → save → browse/preview/import。这避免了通过 Header 传递明文密码的安全风险。

```python
@router.get("/mysql-connections/{rid}/tables")
async def browse_tables(rid: str):
    # 服务端从 mysql_connections 表读取加密密码并解密连接
    ...
```

---

## Phase 2 — 错误码

| HTTP | Code | 触发场景 |
|------|------|----------|
| 400 | `INCOMPLETE_OBJECT_TYPE` | 发布时 ObjectType 不满足完整性条件 |
| 400 | `FIELD_TYPE_INCOMPATIBLE` | 发布时 Property baseType 与 Dataset 列 inferredType 不兼容（AC-V6）；details 含 propertyId、propertyType、columnType |
| 400 | `OBJECT_TYPE_ACTIVE_CANNOT_DELETE` | 删除 active 状态的 ObjectType（已发布或 Working State 中 status=active） |
| 400 | `DATASET_ALREADY_IN_USE` | Dataset 已被其他 ObjectType 引用（合并计算：已发布 + Working State 草稿）（AC-V3） |
| 400 | `INVALID_INTENDED_ACTIONS` | intended_actions 包含无效值 |
| 400 | `UPLOAD_FILE_TOO_LARGE` | 上传文件超过 50MB |
| 400 | `UPLOAD_INVALID_FORMAT` | 上传文件格式不支持 |
| 400 | `UPLOAD_TOKEN_EXPIRED` | file_token 已过期（30 分钟） |
| 400 | `MYSQL_IMPORT_NO_COLUMNS` | 未选择任何列 |
| 403 | `DATASET_IN_USE` | 删除已被 ObjectType 引用的 Dataset（合并计算判定） |
| 404 | `DATASET_NOT_FOUND` | Dataset RID 不存在 |
| 404 | `MYSQL_CONNECTION_NOT_FOUND` | MySQL 连接 RID 不存在 |
| 404 | `IMPORT_TASK_NOT_FOUND` | 任务 ID 不存在 |
| 422 | `MYSQL_CONNECTION_FAILED` | MySQL 测试连接失败（统一错误格式） |
| 500 | `MYSQL_IMPORT_CONNECTION_LOST` | 导入过程中连接断开 |
| 500 | `MYSQL_IMPORT_FAILED` | MySQL 导入失败（通用） |
| 500 | `FILE_IMPORT_FAILED` | 文件导入失败（通用） |

---

## Phase 2 — 配置项

新增环境变量（`app/config.py`）：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `ENCRYPTION_KEY` | 自动生成（仅开发） | Fernet 对称加密密钥（32 字节 base64） |
| `UPLOAD_TEMP_DIR` | `/tmp/open-ontology-uploads` | 临时文件存储路径 |
| `UPLOAD_MAX_SIZE_MB` | `50` | 上传文件最大大小（MB） |
| `UPLOAD_TOKEN_TTL_MINUTES` | `30` | 临时文件过期时间 |

---

## Phase 2 — 新增 Python 依赖

| 包 | 用途 |
|----|------|
| `aiomysql` | 异步 MySQL 连接 |
| `openpyxl` | 读取 .xlsx 文件 |
| `python-calamine` | 读取 .xls 文件（Rust 实现，安全高效，替代 xlrd） |
| `cryptography` | Fernet 对称加密（密码存储） |
| `python-multipart` | FastAPI 文件上传支持 |

---

## Phase 2 — 文件变更清单

### 新建文件（~16 个）

| 文件路径 | 说明 |
|----------|------|
| `apps/server/app/domain/dataset.py` | Dataset 领域模型 + 请求/响应 |
| `apps/server/app/domain/mysql_connection.py` | MySQLConnection 模型 + 请求/响应 |
| `apps/server/app/domain/import_task.py` | ImportTask 模型（状态、结果） |
| `apps/server/app/domain/type_mapping.py` | MySQL 类型映射 + Excel/CSV 类型推断 |
| `apps/server/app/storage/dataset_storage.py` | Dataset 数据访问 |
| `apps/server/app/storage/mysql_connection_storage.py` | MySQL 连接数据访问 |
| `apps/server/app/services/dataset_service.py` | Dataset 业务逻辑 |
| `apps/server/app/services/mysql_import_service.py` | MySQL 导入逻辑 |
| `apps/server/app/services/file_import_service.py` | 文件上传/解析/导入 |
| `apps/server/app/services/import_task_service.py` | 后台任务管理 |
| `apps/server/app/services/crypto_service.py` | AES-256 加解密 |
| `apps/server/app/routers/datasets.py` | Dataset 路由 |
| `apps/server/app/routers/mysql_connections.py` | MySQL 连接路由 |
| `apps/server/app/routers/imports.py` | 导入任务路由（MySQL 导入 + 文件上传 + 任务轮询） |
| `apps/server/alembic/versions/0004_add_dataset_and_import_tables.py` | 数据库迁移 |
| `apps/server/tests/unit/test_type_mapping.py` | 类型映射 + 推断单元测试 |

### 修改文件（~5 个）

| 文件路径 | 修改内容 |
|----------|----------|
| `apps/server/app/storage/models.py` | 新增 DatasetModel、DatasetColumnModel、DatasetRowModel、MySQLConnectionModel；ObjectTypeModel 新增 `intended_actions` 列 |
| `apps/server/app/domain/object_type.py` | ObjectType 新增 `intended_actions` 字段；ObjectTypeCreateRequest 改为全部可选 + 新增 `intended_actions`/`backing_datasource_rid`/`project_rid`；ObjectTypeUpdateRequest 新增字段 |
| `apps/server/app/services/object_type_service.py` | `create()` 支持不完整创建（display_name 可选 + 占位名）+ 自动推断 + project_rid；`update()` 新增字段处理；`delete()` 新增 active 状态校验 |
| `apps/server/app/services/working_state_service.py` | `publish()` 新增完整性校验 + 类型兼容性校验；`_apply_object_type_change()` 的 key_map 新增字段 |
| `apps/server/app/main.py` | 注册 datasets、mysql_connections、imports 三个新 router |
| `apps/server/app/config.py` | 新增 ENCRYPTION_KEY、UPLOAD_TEMP_DIR、UPLOAD_MAX_SIZE_MB、UPLOAD_TOKEN_TTL_MINUTES |

---

## 验证方式

### 单元测试

| 测试 | 覆盖 |
|------|------|
| `test_type_mapping.py` | MySQL 类型映射（全部 MySQL 类型 → PropertyBaseType，按 PRD §8.7 规则）|
| `test_type_mapping.py` | Excel/CSV 类型推断（整数、浮点、日期、时间戳、布尔、混合回退） |
| `test_crypto_service.py` | 加密/解密往返 + 密钥缺失处理 |
| `test_validators.py` | intended_actions 校验（有效值、无效值） |
| `test_completeness.py` | 完整性校验（7 项条件的各种组合） |
| `test_type_compatibility.py` | 类型兼容性校验（兼容矩阵、不兼容报错含 details） |
| `test_auto_infer.py` | display_name → id/api_name 自动推断 + 冲突后缀 + 占位名生成 |
| `test_active_delete.py` | active 状态 ObjectType 拒绝删除（已发布 + Working State 草稿场景） |

### 集成测试

| 测试 | 覆盖 |
|------|------|
| `test_dataset_api.py` | Dataset CRUD API（创建、列表含 in-use 合并计算、预览、删除、in-use 拒绝删除） |
| `test_mysql_import_api.py` | MySQL 连接保存/测试（422 错误格式）/浏览表（使用已保存连接）/导入流程（事务化） |
| `test_file_upload_api.py` | Excel(.xlsx/.xls)/CSV 上传预览 + 确认导入流程（事务化） |
| `test_incomplete_object_type.py` | 不完整创建（display_name 可空 + 占位名）+ 补全 + 发布完整性校验 + 类型兼容性校验 |
| `test_import_task_api.py` | 任务创建 + 轮询状态转换 |

---

## 评审意见处理记录

> 评审文档：`features/v0.1.0/003-object-type-crud/review.md`（2026-03-02）

### Blocker（3 条，全部采纳）

| # | 评审意见 | 处理结果 | 涉及章节 |
|---|----------|----------|----------|
| 1 | Working State 与 Dataset 关联状态冲突 | **采纳**：移除 `datasets.linked_object_type_rid` 列；Dataset in-use 状态改为运行时合并计算（扫描已发布 ObjectType + Working State 草稿）；移除 `link_to_object_type`/`unlink_from_object_type` 方法；publish 时随 ObjectType 自然落库，discard 无需补偿 | AD-8、数据库设计、ORM、Domain、DatasetService |
| 2 | 导入失败无事务化保证 | **采纳**：Dataset 新增 `status` 字段（`importing` → `ready`）；导入在独立 session 以单事务执行，失败时 rollback 全部；列表查询默认过滤 `status='ready'` | 数据库设计、ORM、Domain、MySQLImportService、FileImportService |
| 3 | 数据库主键违反仓库硬约束 | **采纳**：`dataset_columns` 改为 `rid TEXT PRIMARY KEY`（格式 `ri.ontology.dataset-column.<uuid>`）；`dataset_rows` 改为复合主键 `(dataset_rid, row_index)`，移除自增 id | 数据库设计、ORM |

### Major（5 条，4 采纳 1 部分采纳）

| # | 评审意见 | 处理结果 | 涉及章节 |
|---|----------|----------|----------|
| 4 | Save Location（Project 选择）未覆盖 | **部分采纳**：ObjectTypeCreateRequest 新增可选字段 `project_rid`，默认回退 AD-5 默认值。不新增 Project 列表接口（属于 Space/Project 管理模块）。MVP 单 Project 场景下前端自动选中 | AD-11、Domain ObjectTypeCreateRequest、API 示例 |
| 5 | 任意步骤退出与 display_name 必填冲突 | **采纳**：`display_name` 改为可选，为空时服务端自动生成占位名 `"Untitled Object Type xxxx"`（4 位随机后缀），`id` 和 `api_name` 从占位名推断 | AD-11、Domain ObjectTypeCreateRequest、ObjectTypeService、API 示例 |
| 6 | 类型兼容性校验（AC-V6）缺失 | **采纳**：publish 校验新增 Property baseType 与 Dataset 列 inferredType 兼容性检查；定义兼容矩阵；新增错误码 `FIELD_TYPE_INCOMPATIBLE` | WorkingStateService、错误码表 |
| 7 | .xls 支持声明与实现不一致 | **采纳**：新增 `python-calamine` 依赖（Rust 实现），解析策略：.xlsx → openpyxl、.xls → python-calamine、.csv → csv 标准库 | FileImportService、依赖列表 |
| 8 | active 状态不可删除未落地 | **采纳**：ObjectTypeService.delete() 新增 status 校验（已发布检查主表、未发布检查 Working State）；active 拒绝删除；新增错误码 `OBJECT_TYPE_ACTIVE_CANNOT_DELETE` | ObjectTypeService、错误码表 |

### Medium（3 条，全部采纳）

| # | 评审意见 | 处理结果 | 涉及章节 |
|---|----------|----------|----------|
| 9 | MySQL 测试连接返回格式不统一 | **采纳**：失败改为 `422 { "error": { "code": "MYSQL_CONNECTION_FAILED", "message": "..." } }`，与全局错误格式统一 | API 端点、错误码表 |
| 10 | 明文密码通过 Header 传递 | **采纳**：移除 `X-MySQL-Password` Header。browse/preview/import 端点统一使用已保存连接的加密密码（服务端解密）。用户流程：test → save → browse/preview/import | API 端点、Router 层、MySQLImportService |
| 11 | MySQL 类型映射与 PRD 不一致 | **采纳**：按 PRD §8.7 统一：BIGINT/INT/TINYINT → `integer`、DECIMAL/FLOAT/DOUBLE → `double`、BOOLEAN/BIT(1) → `boolean`。精度损失（BIGINT 超 32 位、DECIMAL 高精度）记为已知限制 | 类型映射规则（MYSQL_TYPE_MAP） |
