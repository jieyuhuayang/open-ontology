# 05 - Data Connectivity & Integration / 数据连接与集成

## Overview

Open Ontology 的核心架构原则是 **Schema-Data Separation**（见 [00-design-principles.md](./00-design-principles.md) P1）— Ontology Manager 管理语义模型（Schema），而实际数据存储在外部数据源中。每个 ObjectType 通过 `backingDatasource` 引用底层数据源，每个 Property 通过 `backingColumn` 映射到数据源中的列。

本文档定义 Data Source Layer 的技术方案：如何连接外部数据源、提取 Schema、自动映射属性、预览数据，以及未来的数据同步。

---

## 1. 市面方案评估

### 1.1 评估的方案

| 方案 | 类型 | 连接器数量 | 可嵌入? | 协议 | Stars | 适用性 |
|------|------|-----------|---------|------|-------|--------|
| **OpenMetadata** | 元数据平台 | 84+ | 部分（Python SDK） | REST | 8.8k | 中高 |
| **DataHub** | 元数据平台 | 70+ | 否 | GraphQL | 11.6k | 中 |
| **Apache Atlas** | 元数据平台 | ~5 (Hadoop) | 否 | REST+Kafka | ~2k | 低 |
| **Amundsen** | 元数据发现 | ~15 | 部分 | REST | 4.7k | 低 |
| **PyAirbyte** | 数据集成库 | 600+ | **是（Python 库）** | Python API | 17k+ | **高** |

### 1.2 关键发现

1. **元数据平台（OpenMetadata/DataHub）**：功能全面但架构重，本质是独立平台（需要 Kafka/ES/MySQL 等基础设施），不适合嵌入到 Open Ontology 中。它们解决的问题（数据目录、数据治理）与 Open Ontology 的需求（连接数据源 → 提取 Schema → 映射到本体属性）有交集但不完全吻合。

2. **PyAirbyte**：**首选方案，直接集成**。MIT 协议，600+ 连接器，设计为 Python 库可直接在进程中使用。Open Ontology 后端采用 Python (FastAPI)，PyAirbyte 可作为 Connector 层的核心组件无缝集成，无需额外的进程间通信。

3. **知识图谱平台（Stardog/Ontotext/Timbr）**：采用"数据虚拟化"方式（通过本体层直接查询数据源），概念上最契合 Open Ontology 的愿景，但均为商业产品。

### 1.3 结论

**PyAirbyte + SQLAlchemy 组合满足需求**。PyAirbyte 提供 600+ 数据源连接器的即用生态，SQLAlchemy 提供统一的数据库 Schema 提取能力（`inspect()` API），两者结合覆盖了 Open Ontology 的全部数据连接需求。通过 Connector 抽象层封装，保持架构的灵活性和可扩展性。

---

## 2. PyAirbyte-Native Connector Architecture

### 2.1 核心策略

**PyAirbyte 作为 Connector 层核心组件 + Connector 抽象层**

理由：
- PyAirbyte 提供 600+ 连接器，覆盖主流数据库、SaaS、文件存储等数据源
- Python 后端直接调用 PyAirbyte Python API，无需 sidecar 或进程间通信
- SQLAlchemy `inspect()` 为 Database 类型提供更精确的 Schema 提取（含外键、约束等元数据）
- pandas 为 CSV/Excel 提供强大的类型推断能力
- 通过抽象接口封装，可灵活选择底层实现（PyAirbyte source vs 直接 SQLAlchemy）

### 2.2 架构总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Service Layer（服务层）                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              DataSourceService（编排层）                      │   │
│  │   连接测试 · Schema 提取 · 映射建议 · 数据预览                │   │
│  └────────────────────────────┬─────────────────────────────────┘   │
└───────────────────────────────┼─────────────────────────────────────┘
                                │
┌───────────────────────────────┼─────────────────────────────────────┐
│                     Domain Layer（领域层）                           │
│  ┌────────────────────────────┴─────────────────────────────────┐   │
│  │              MappingEngine（自动映射引擎）                     │   │
│  │   名称推断 · 类型兼容矩阵 · 主键/外键推断                     │   │
│  └──────────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
┌───────────────────────────────┼─────────────────────────────────────┐
│                     Connector Layer（连接器层）                      │
│  ┌────────────────────────────┴─────────────────────────────────┐   │
│  │              ConnectorRegistry（连接器注册表）                 │   │
│  │                                                              │   │
│  │  ┌──────────────────────────────────────────┐                │   │
│  │  │         PyAirbyte Sources                │  ← 600+ 连接器 │   │
│  │  │   (Database / SaaS / File / API ...)     │                │   │
│  │  └──────────────────────────────────────────┘                │   │
│  │  ┌──────────────────┐  ┌──────────────────┐                  │   │
│  │  │ SQLAlchemy-based │  │  pandas-based    │  ← 精细 Schema   │   │
│  │  │ Schema Inspector │  │  Type Inferrer   │    提取 & 推断   │   │
│  │  │ (PG/MySQL/...)   │  │  (CSV/Excel)     │                  │   │
│  │  └──────────────────┘  └──────────────────┘                  │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Connector 接口定义

### 3.1 核心接口

```python
from abc import ABC, abstractmethod
from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class DataSourceConnector(ABC):
    """
    DataSourceConnector — 所有数据源连接器必须实现的接口。

    连接器负责与外部数据源通信，提取 Schema 信息、测试连接、预览数据。
    每种数据源类型（postgresql, mysql, csv, rest-api 等）对应一个连接器实现。
    """

    @property
    @abstractmethod
    def type(self) -> "DataSourceType":
        """连接器标识符，与 DataSourceType 枚举一一对应"""
        ...

    @property
    @abstractmethod
    def display_name(self) -> str:
        """在 UI 中显示的名称"""
        ...

    @abstractmethod
    async def test_connection(self, config: "ConnectionConfig") -> "ConnectionTestResult":
        """
        测试连接可用性。
        对于 Database 类型：尝试建立连接并执行 SELECT 1。
        对于 CSV/Excel：校验文件路径可访问且格式正确。
        对于 REST API：尝试 HEAD 请求或获取 OpenAPI spec。
        """
        ...

    @abstractmethod
    async def extract_schema(self, config: "ConnectionConfig") -> "ExtractedSchema":
        """
        提取数据源的 Schema 信息。MVP 核心操作。
        返回表名、列名、列类型、约束、外键等元数据。
        Database 类型通过 SQLAlchemy inspect() 查询。
        CSV/Excel 通过 pandas 采样推断类型。
        """
        ...

    @abstractmethod
    async def preview_data(
        self,
        config: "ConnectionConfig",
        table: str,
        options: Optional["PreviewOptions"] = None,
    ) -> "DataPreview":
        """
        预览样本数据，用于映射时的人工验证。
        默认返回前 50 行。
        """
        ...

    async def detect_schema_drift(
        self,
        config: "ConnectionConfig",
        baseline: "ExtractedSchema",
    ) -> "SchemaDrift":
        """
        [Post-MVP] 检测 Schema 变化（Schema Drift）。
        将当前 Schema 与基线进行比较，返回差异。
        """
        raise NotImplementedError
```

### 3.2 数据源类型枚举

```python
class DataSourceType(str, Enum):
    POSTGRESQL = "postgresql"
    MYSQL = "mysql"
    CSV = "csv"
    EXCEL = "excel"
    REST_API = "rest-api"
    OBJECT_STORE = "object-store"  # S3, OSS 等 — Phase 3
```

### 3.3 连接配置

```python
from pydantic import BaseModel, Field
from typing import Literal, Optional, Union
from annotated_types import Annotated


class SslConfig(BaseModel):
    enabled: bool = False
    ca: Optional[str] = None  # CA 证书 PEM
    reject_unauthorized: Optional[bool] = None


class DatabaseConnectionConfig(BaseModel):
    kind: Literal["database"] = "database"
    host: str
    port: int
    database: str
    schema_name: Optional[str] = Field(default="public", alias="schema")  # PostgreSQL schema
    username: str
    password: str
    ssl: Optional[SslConfig] = None


class CsvOptions(BaseModel):
    delimiter: str = ","
    encoding: str = "utf-8"
    has_header: bool = True


class ExcelOptions(BaseModel):
    sheet_name: Optional[str] = None  # 默认读取第一个 sheet
    header_row: int = 1


class FileConnectionConfig(BaseModel):
    kind: Literal["file"] = "file"
    file_path: str  # 文件路径或 URL（支持 http:// 远程文件）
    format: Literal["csv", "excel"]
    csv_options: Optional[CsvOptions] = None
    excel_options: Optional[ExcelOptions] = None


class RestApiAuth(BaseModel):
    type: Literal["bearer", "api-key", "basic"]
    token: Optional[str] = None
    api_key: Optional[str] = None
    api_key_header: str = "X-API-Key"
    username: Optional[str] = None
    password: Optional[str] = None


class RestApiConnectionConfig(BaseModel):
    kind: Literal["rest-api"] = "rest-api"
    base_url: str
    spec_url: Optional[str] = None  # OpenAPI spec URL（若有）
    auth: Optional[RestApiAuth] = None


class ObjectStoreConnectionConfig(BaseModel):
    kind: Literal["object-store"] = "object-store"
    provider: Literal["s3", "oss", "gcs"]
    bucket: str
    prefix: Optional[str] = None
    region: Optional[str] = None
    access_key_id: str
    secret_access_key: str
    endpoint: Optional[str] = None  # 自定义 endpoint（MinIO 等）


ConnectionConfig = Annotated[
    Union[
        DatabaseConnectionConfig,
        FileConnectionConfig,
        RestApiConnectionConfig,
        ObjectStoreConnectionConfig,
    ],
    Field(discriminator="kind"),
]
```

### 3.4 Schema 提取结果

```python
class TypeDetails(BaseModel):
    max_length: Optional[int] = None      # varchar(255) → 255
    precision: Optional[int] = None       # numeric(10,2) → 10
    scale: Optional[int] = None           # numeric(10,2) → 2
    dimensions: Optional[int] = None      # vector(1536) → 1536


class ExtractedColumn(BaseModel):
    """数据源中提取的列信息"""
    name: str
    native_type: str  # 数据源原生类型，如 "varchar(255)"、"int8"、"TEXT"
    inferred_base_type: str  # 推断的 Open Ontology PropertyBaseType
    nullable: bool
    type_details: Optional[TypeDetails] = None


class ForeignKeyConstraint(BaseModel):
    columns: list[str]        # 本表的列名
    ref_table: str            # 引用的目标表
    ref_columns: list[str]    # 引用的目标列


class ExtractedTable(BaseModel):
    name: str  # 表名（CSV 为文件名，Excel 为 sheet 名）
    columns: list[ExtractedColumn]
    primary_key: Optional[list[str]] = None
    foreign_keys: Optional[list[ForeignKeyConstraint]] = None
    estimated_row_count: Optional[int] = None


class ExtractedSchema(BaseModel):
    """从数据源提取的 Schema 信息。这是连接器的核心输出，驱动后续的自动映射流程。"""
    datasource_name: str
    extracted_at: datetime
    tables: list[ExtractedTable]
```

### 3.5 连接测试结果

```python
class ConnectionError(BaseModel):
    code: str          # 标准化错误码
    message: str       # 人类可读消息
    details: Optional[str] = None  # 技术细节（不暴露给终端用户）


class ConnectionTestResult(BaseModel):
    success: bool
    latency_ms: Optional[int] = None       # 连接耗时（毫秒）
    server_version: Optional[str] = None   # 数据源版本信息（如 "PostgreSQL 16.1"）
    error: Optional[ConnectionError] = None
```

### 3.6 数据预览

```python
from typing import Any


class PreviewOptions(BaseModel):
    limit: int = Field(default=50, le=500)  # 返回行数
    offset: int = 0
    columns: Optional[list[str]] = None     # 只返回指定列


class DataPreview(BaseModel):
    columns: list[str]
    rows: list[list[Any]]
    total_rows: Optional[int] = None  # 总行数（若可低成本获取）
    has_more: bool
```

### 3.7 Schema Drift 检测（Post-MVP）

```python
class ColumnTypeChange(BaseModel):
    column: str
    old_native_type: str
    new_native_type: str
    old_base_type: str
    new_base_type: str


class TableColumnChanges(BaseModel):
    table: str
    added_columns: list[ExtractedColumn]
    removed_columns: list[str]
    type_changes: list[ColumnTypeChange]


class SchemaDrift(BaseModel):
    has_drift: bool
    detected_at: datetime
    added_tables: list[str]
    removed_tables: list[str]
    column_changes: list[TableColumnChanges]
```

### 3.8 ConnectorRegistry

```python
class ConnectorRegistry:
    """
    ConnectorRegistry — 连接器注册表，管理所有已注册的连接器实例。
    通过数据源类型查找对应的连接器。
    集成 PyAirbyte source catalog，支持动态发现可用连接器。
    """

    def __init__(self) -> None:
        self._connectors: dict[DataSourceType, DataSourceConnector] = {}

    def register(self, connector: DataSourceConnector) -> None:
        """注册一个连接器"""
        self._connectors[connector.type] = connector

    def get(self, source_type: DataSourceType) -> DataSourceConnector:
        """根据类型获取连接器"""
        connector = self._connectors.get(source_type)
        if connector is None:
            raise ValueError(f"No connector registered for type: {source_type}")
        return connector

    def list_types(self) -> list[DataSourceType]:
        """列出所有已注册的连接器类型"""
        return list(self._connectors.keys())

    @staticmethod
    def list_airbyte_sources() -> list[str]:
        """列出 PyAirbyte 可用的 source 名称（动态发现）"""
        import airbyte as ab
        return ab.get_available_connectors()
```

---

## 4. 类型兼容矩阵（Type Mapping）

连接器将数据源原生类型映射到 Open Ontology 的 21 种 `PropertyBaseType`（见 [02-domain-model.md](./02-domain-model.md)）。

### 4.1 PostgreSQL → PropertyBaseType

| 原生类型 | → PropertyBaseType | 备注 |
|---------|-------------------|------|
| `varchar`, `text`, `char`, `character varying`, `name` | String | |
| `uuid` | String | UUID 存储为 String |
| `int2`, `smallint` | Short | |
| `int4`, `integer`, `serial` | Integer | |
| `int8`, `bigint`, `bigserial` | Long | |
| `float4`, `real` | Float | |
| `float8`, `double precision` | Double | |
| `numeric`, `decimal` | Decimal | 保留 precision/scale 信息 |
| `boolean`, `bool` | Boolean | |
| `date` | Date | |
| `timestamp`, `timestamp without time zone` | Timestamp | |
| `timestamptz`, `timestamp with time zone` | Timestamp | |
| `json`, `jsonb` | String | 可手动改为 Struct |
| `bytea` | Attachment | 二进制数据 |
| `point` | Geopoint | `(lon, lat)` |
| `geometry`, `geography` (PostGIS) | Geoshape | 需要 PostGIS 扩展 |
| `vector` (pgvector) | Vector | 保留 dimensions 信息 |
| `_int4`, `integer[]` 等数组类型 | Array | `arrayInnerType` 根据元素类型推断 |
| `interval`, `money`, `xml` 等其他类型 | String | fallback |

### 4.2 MySQL → PropertyBaseType

| 原生类型 | → PropertyBaseType | 备注 |
|---------|-------------------|------|
| `varchar`, `text`, `char`, `tinytext`, `mediumtext`, `longtext` | String | |
| `tinyint(1)` | Boolean | MySQL 惯例 |
| `tinyint` (非 1 位) | Byte | |
| `smallint` | Short | |
| `int`, `integer`, `mediumint` | Integer | |
| `bigint` | Long | |
| `float` | Float | |
| `double`, `double precision` | Double | |
| `decimal`, `numeric` | Decimal | |
| `date` | Date | |
| `datetime`, `timestamp` | Timestamp | |
| `json` | String | 可手动改为 Struct |
| `blob`, `mediumblob`, `longblob` | Attachment | |
| `point` | Geopoint | |
| `geometry`, `polygon`, `linestring` 等 | Geoshape | |
| `enum`, `set` | String | |
| 其他类型 | String | fallback |

### 4.3 CSV / Excel → PropertyBaseType（类型推断）

CSV 和 Excel 没有显式类型声明，需要通过采样推断。

**推断算法**（基于 pandas dtype 推断）：

```python
import pandas as pd


def infer_column_types(df: pd.DataFrame, sample_size: int = 100) -> dict[str, str]:
    """
    基于 pandas dtype 推断列的 PropertyBaseType。
    利用 pandas 内置的类型推断能力，避免手写 regex。
    """
    sample = df.head(sample_size)
    # 尝试让 pandas 推断更精确的类型
    sample = sample.convert_dtypes()

    result: dict[str, str] = {}
    for col in sample.columns:
        non_null = sample[col].dropna()

        if len(non_null) < 10:
            result[col] = "string"  # 样本不足，降级为 String
            continue

        dtype = non_null.dtype

        if pd.api.types.is_bool_dtype(dtype):
            result[col] = "boolean"
        elif pd.api.types.is_integer_dtype(dtype):
            max_val = non_null.abs().max()
            if max_val <= 2_147_483_647:
                result[col] = "integer"
            else:
                result[col] = "long"
        elif pd.api.types.is_float_dtype(dtype):
            result[col] = "double"
        elif pd.api.types.is_datetime64_any_dtype(dtype):
            # 检查是否所有值都没有时间部分
            if all(non_null.dt.time == pd.Timestamp("00:00:00").time()):
                result[col] = "date"
            else:
                result[col] = "timestamp"
        else:
            # 对 string/object 列，尝试进一步推断
            result[col] = _try_infer_string_column(non_null)

    return result


def _try_infer_string_column(series: pd.Series) -> str:
    """对 string 类型列尝试进一步推断（日期、布尔等）"""
    sample_values = series.astype(str).str.strip().str.lower()

    # 检查布尔值
    bool_values = {"true", "false", "1", "0", "yes", "no"}
    if sample_values.isin(bool_values).all():
        return "boolean"

    # 尝试解析为日期
    try:
        parsed = pd.to_datetime(series, format="ISO8601", errors="coerce")
        if parsed.notna().sum() / len(series) > 0.9:
            return "timestamp"
    except Exception:
        pass

    return "string"
```

**采样策略**：
- 默认采样前 100 行（可配置）
- 利用 `pandas.DataFrame.convert_dtypes()` 自动推断最佳类型
- 忽略空值 / 空字符串
- 若样本不足 10 个非空值，降级为 String
- pandas 自动处理混合类型列（如部分 Integer、部分 Double → Double）

### 4.4 REST API → PropertyBaseType

解析 OpenAPI 3.x spec 中的 schema 定义：

| OpenAPI `type` + `format` | → PropertyBaseType |
|--------------------------|-------------------|
| `string` | String |
| `string` + `date` | Date |
| `string` + `date-time` | Timestamp |
| `string` + `uuid` | String |
| `string` + `binary` | Attachment |
| `integer` | Integer |
| `integer` + `int64` | Long |
| `number` | Double |
| `number` + `float` | Float |
| `number` + `double` | Double |
| `boolean` | Boolean |
| `array` | Array |
| `object` | Struct |

---

## 5. 自动映射引擎（Auto-Mapping Engine）

当用户为 ObjectType 选择数据源时，MappingEngine 自动生成映射建议。

### 5.1 映射流程

```
ExtractedSchema                      ObjectType (已有属性)
      │                                      │
      ▼                                      ▼
┌──────────────┐                    ┌──────────────────┐
│  列名 + 类型  │───→ MappingEngine ←──│ 属性 ID + BaseType│
└──────────────┘         │          └──────────────────┘
                         ▼
                  MappingResult
                  ├── auto_mapped[]     — 自动映射成功
                  ├── conflicts[]       — 类型不兼容
                  ├── unmapped[]        — 失去映射的属性
                  ├── new_columns[]     — 未映射的新列
                  └── suggested_links[] — 基于外键的链接建议
```

### 5.2 映射结果类型

```python
from typing import Literal


class PropertyMapping(BaseModel):
    """自动映射成功的属性"""
    column_name: str
    property_id: str
    base_type: str
    is_new_property: bool
    confidence: Literal["high", "medium", "low"]
    reason: str


class MappingConflict(BaseModel):
    """类型不兼容的冲突"""
    column_name: str
    property_id: str
    column_base_type: str   # 列推断的类型
    property_base_type: str  # 属性声明的类型
    lossy_conversion_possible: bool


class UnmappedProperty(BaseModel):
    """在新 Schema 中失去映射的已有属性"""
    property_id: str
    property_display_name: str
    previous_column_name: Optional[str] = None


class LinkSuggestion(BaseModel):
    """基于外键约束推断的 LinkType 建议"""
    foreign_key_column: str
    ref_table: str
    ref_column: str
    suggested_link_id: str
    suggested_cardinality: Literal["one-to-one", "many-to-one"]


class MappingResult(BaseModel):
    auto_mapped: list[PropertyMapping]
    conflicts: list[MappingConflict]
    unmapped: list[UnmappedProperty]
    new_columns: list[ExtractedColumn]
    suggested_links: list[LinkSuggestion]
```

### 5.3 列名 → 属性标识推断算法

```
输入: column_name（如 "employee_id", "firstName", "CREATED_AT"）

1. 规范化:
   - 检测命名风格: snake_case / camelCase / PascalCase / UPPER_SNAKE_CASE
   - 统一转为 token 数组: ["employee", "id"]

2. 生成 Property 标识:
   - id:           "-".join(tokens)                  → "employee-id"
   - api_name:     camel_case(tokens)                → "employeeId"
   - display_name: " ".join(t.capitalize() for t in tokens) → "Employee Id"

3. 冲突处理:
   - 若生成的 id 与已有属性冲突，检查类型兼容性
   - 若类型兼容 → 映射到已有属性（confidence: "high"）
   - 若类型不兼容 → 加入 conflicts 列表
```

### 5.4 主键与外键推断

```
主键推断:
  - 若数据源有 PRIMARY KEY 约束 → 建议为 ObjectType 的 primaryKeyProperty
  - 若无显式主键但存在名为 "id" / "<table>_id" 的唯一非空列 → 推断为主键

外键 → LinkType 建议:
  - 对每个 FOREIGN KEY (col) REFERENCES other_table(other_col):
    - suggested_link_id = "<this_table>-<other_table>"
    - suggested_cardinality = "many-to-one"（FK 端为 many）
    - 若 FK 列同时有 UNIQUE 约束 → "one-to-one"
```

### 5.5 类型兼容性校验

```python
from enum import Enum


class Compatibility(str, Enum):
    COMPATIBLE = "compatible"
    LOSSY = "lossy"
    INCOMPATIBLE = "incompatible"


# 无损拓宽（widening）规则
WIDENING_RULES: dict[str, list[str]] = {
    "byte":      ["short", "integer", "long", "double", "decimal", "string"],
    "short":     ["integer", "long", "double", "decimal", "string"],
    "integer":   ["long", "double", "decimal", "string"],
    "long":      ["decimal", "string"],
    "float":     ["double", "string"],
    "double":    ["string"],
    "decimal":   ["string"],
    "boolean":   ["string"],
    "date":      ["timestamp", "string"],
    "timestamp": ["string"],
}


def is_type_compatible(source_type: str, target_type: str) -> Compatibility:
    """
    判断 source_type 是否可以无损映射到 target_type。
    用于校验列类型与属性 BaseType 的兼容性。
    """
    # 相同类型总是兼容
    if source_type == target_type:
        return Compatibility.COMPATIBLE

    # 无损拓宽
    if target_type in WIDENING_RULES.get(source_type, []):
        return Compatibility.COMPATIBLE

    # 有损收窄 — 可能丢失精度
    if source_type in WIDENING_RULES.get(target_type, []):
        return Compatibility.LOSSY

    # 所有类型都可以映射到 String（fallback）
    if target_type == "string":
        return Compatibility.COMPATIBLE

    return Compatibility.INCOMPATIBLE
```

#### Mapping Contract Rules / 映射契约规则

| 兼容性级别 | 行为 |
|-----------|------|
| `COMPATIBLE` | 自动映射，直接落地 |
| `LOSSY` | 生成警告，**必须用户手动确认**后才能保存 |
| `INCOMPATIBLE` | 阻断，不允许建立映射 |

---

## 6. 数据源管理

### 6.1 数据源实体模型

```python
class DataSourceStatus(str, Enum):
    PENDING = "pending"            # 待测试连接
    CONNECTED = "connected"        # 连接正常
    DISCONNECTED = "disconnected"  # 连接断开
    ERROR = "error"                # 连接错误


class DataSource(BaseModel):
    """
    DataSource — 数据源实体，对应 ObjectType.backingDatasource。
    一个数据源只能绑定到一个 ObjectType（1:1 约束，与 Palantir 一致）。
    """
    rid: str
    name: str
    type: DataSourceType
    connection_config: ConnectionConfig  # 加密存储，运行时解密
    status: DataSourceStatus
    cached_schema: Optional[ExtractedSchema] = None
    bound_object_type_rid: Optional[str] = None
    bound_table_name: Optional[str] = None
    space_rid: str
    created_at: datetime
    created_by: str
    updated_at: datetime
```

### 6.2 数据库 Schema

```sql
-- 数据源注册表
CREATE TABLE data_sources (
  rid                TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  type               TEXT NOT NULL,               -- postgresql, mysql, csv, excel, rest-api, object-store
  connection_config  BYTEA NOT NULL,              -- AES-256-GCM 加密的连接配置（JSON）
  status             TEXT NOT NULL DEFAULT 'pending',  -- pending | connected | disconnected | error
  cached_schema      JSONB,                       -- 缓存的 ExtractedSchema
  bound_object_type  TEXT UNIQUE,                  -- 绑定的 ObjectType RID（UNIQUE 保证 1:1）
  bound_table_name   TEXT,                         -- 绑定的表名
  space_rid          TEXT NOT NULL REFERENCES spaces(rid),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by         TEXT NOT NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_data_sources_space ON data_sources(space_rid);
CREATE INDEX idx_data_sources_type ON data_sources(type);
CREATE INDEX idx_data_sources_status ON data_sources(status);
```

### 6.3 凭证安全

**MVP 方案**：AES-256-GCM 加密存储。

```
加密流程:
  1. 从环境变量 DATASOURCE_ENCRYPTION_KEY 读取 32 字节密钥
  2. 生成随机 12 字节 IV
  3. AES-256-GCM 加密 JSON 序列化的 connectionConfig
  4. 存储: IV (12B) || AuthTag (16B) || Ciphertext → BYTEA 字段

解密流程:
  1. 从 BYTEA 字段读取，分割 IV / AuthTag / Ciphertext
  2. AES-256-GCM 解密
  3. JSON 反序列化 → ConnectionConfig
```

**安全扩展接口**（为后续对接 Vault/AWS Secrets Manager 预留）：

```python
from abc import ABC, abstractmethod


class SecretProvider(ABC):
    """凭证加密/解密的抽象接口"""

    @abstractmethod
    async def encrypt(self, config: ConnectionConfig) -> bytes:
        """加密连接配置"""
        ...

    @abstractmethod
    async def decrypt(self, encrypted: bytes) -> ConnectionConfig:
        """解密连接配置"""
        ...


class LocalSecretProvider(SecretProvider):
    """MVP 实现：基于 Python cryptography 库的本地加密"""

    def __init__(self, key: bytes):
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        self._aesgcm = AESGCM(key)

    async def encrypt(self, config: ConnectionConfig) -> bytes:
        import os, json
        nonce = os.urandom(12)
        plaintext = json.dumps(config.model_dump()).encode()
        ciphertext = self._aesgcm.encrypt(nonce, plaintext, None)
        return nonce + ciphertext  # nonce (12B) || ciphertext+tag

    async def decrypt(self, encrypted: bytes) -> ConnectionConfig:
        import json
        nonce, ciphertext = encrypted[:12], encrypted[12:]
        plaintext = self._aesgcm.decrypt(nonce, ciphertext, None)
        data = json.loads(plaintext)
        # 根据 kind 字段反序列化为具体类型
        return ConnectionConfig.model_validate(data)


# 后续实现：HashiCorp Vault
# class VaultSecretProvider(SecretProvider): ...
```

**演进路线:**
- **MVP**: `LocalSecretProvider` + 环境变量密钥，适用于单实例部署
- **v0.2.0**: 支持密钥轮换——新密钥加密，旧密钥保留解密列表；提供重加密迁移脚本
- **v0.3.0+**: `VaultSecretProvider` / `AwsKmsSecretProvider`，适用于多环境多租户部署

### 6.4 连接管理

MVP 阶段使用**短连接**（Short-lived Connections）：

- Schema 提取、连接测试、数据预览均为低频管理操作
- 每次操作按需创建连接，操作完成后立即关闭
- 无需连接池，减少资源占用和连接泄露风险
- 后续数据同步阶段（Phase 4）引入连接池

#### Connector Execution Boundaries / 连接器执行边界

PyAirbyte 和 SQLAlchemy 的连接操作可能阻塞或耗时较长，必须与 FastAPI 异步事件循环隔离：

| 策略 | 规则 |
|------|------|
| **线程隔离** | 所有连接器操作通过 `asyncio.to_thread()` 在线程池中执行，不占用主事件循环 |
| **超时** | `test_connection`: 30s；`extract_schema`: 60s；`preview_data`: 30s |
| **并发限制** | 全局 `asyncio.Semaphore(3)`，最多 3 个并发连接器操作 |
| **失败处理** | 超时或异常返回标准错误响应，不崩溃服务器 |

MVP 阶段采用进程内线程池隔离。如果连接器操作频率和资源消耗增长，Phase 4 可迁移到独立任务队列（Celery/ARQ）。

---

## 7. REST API 规格

### 7.1 数据源管理 API

```
POST   /api/datasources                   — 注册数据源
GET    /api/datasources                   — 列出数据源（支持 ?space_rid= 过滤）
GET    /api/datasources/{rid}             — 获取数据源详情
PUT    /api/datasources/{rid}             — 更新数据源配置
DELETE /api/datasources/{rid}             — 删除数据源（需先解除 ObjectType 绑定）
```

### 7.2 连接与 Schema API

```
POST   /api/datasources/{rid}/test        — 测试连接
POST   /api/datasources/{rid}/extract     — 提取 Schema（刷新 cached_schema）
GET    /api/datasources/{rid}/schema      — 获取缓存的 Schema
POST   /api/datasources/{rid}/preview     — 预览数据
```

### 7.3 映射 API

```
POST   /api/mapping/auto-map              — 生成自动映射建议
POST   /api/mapping/validate              — 校验类型兼容性
```

### 7.4 FastAPI 路由示例

```python
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/datasources", tags=["datasources"])


@router.post("", status_code=201)
async def create_datasource(body: CreateDataSourceRequest) -> DataSourceResponse:
    """注册数据源"""
    ...


@router.get("")
async def list_datasources(space_rid: str | None = None) -> list[DataSourceResponse]:
    """列出数据源"""
    ...


@router.post("/{rid}/test")
async def test_connection(rid: str) -> ConnectionTestResult:
    """测试数据源连接"""
    ds = await get_datasource_or_404(rid)
    connector = registry.get(DataSourceType(ds.type))
    config = await secret_provider.decrypt(ds.connection_config)
    return await connector.test_connection(config)


@router.post("/{rid}/extract")
async def extract_schema(rid: str) -> ExtractedSchema:
    """提取 Schema"""
    ds = await get_datasource_or_404(rid)
    connector = registry.get(DataSourceType(ds.type))
    config = await secret_provider.decrypt(ds.connection_config)
    schema = await connector.extract_schema(config)
    # 缓存 schema 到 data_sources.cached_schema
    await update_cached_schema(rid, schema)
    return schema
```

### 7.5 API 详细规格

#### POST /api/datasources — 注册数据源

**Request Body:**
```json
{
  "name": "Production PostgreSQL",
  "type": "postgresql",
  "connectionConfig": {
    "kind": "database",
    "host": "db.example.com",
    "port": 5432,
    "database": "production",
    "schema": "public",
    "username": "readonly_user",
    "password": "***"
  },
  "spaceRid": "ri.space.abc123"
}
```

**Response: 201 Created**
```json
{
  "rid": "ri.datasource.xyz789",
  "name": "Production PostgreSQL",
  "type": "postgresql",
  "status": "pending",
  "spaceRid": "ri.space.abc123",
  "createdAt": "2026-02-26T10:00:00Z"
}
```

#### POST /api/datasources/{rid}/test — 测试连接

**Response: 200 OK**
```json
{
  "success": true,
  "latencyMs": 45,
  "serverVersion": "PostgreSQL 16.1"
}
```

#### POST /api/datasources/{rid}/extract — 提取 Schema

**Response: 200 OK**
```json
{
  "datasourceName": "Production PostgreSQL",
  "extractedAt": "2026-02-26T10:01:00Z",
  "tables": [
    {
      "name": "employees",
      "columns": [
        { "name": "id", "nativeType": "serial", "inferredBaseType": "integer", "nullable": false },
        { "name": "name", "nativeType": "varchar(255)", "inferredBaseType": "string", "nullable": false },
        { "name": "department_id", "nativeType": "integer", "inferredBaseType": "integer", "nullable": true },
        { "name": "salary", "nativeType": "numeric(10,2)", "inferredBaseType": "decimal", "nullable": true },
        { "name": "hired_at", "nativeType": "timestamptz", "inferredBaseType": "timestamp", "nullable": false }
      ],
      "primaryKey": ["id"],
      "foreignKeys": [
        { "columns": ["department_id"], "refTable": "departments", "refColumns": ["id"] }
      ],
      "estimatedRowCount": 15000
    }
  ]
}
```

#### POST /api/mapping/auto-map — 自动映射建议

**Request Body:**
```json
{
  "datasourceRid": "ri.datasource.xyz789",
  "tableName": "employees",
  "objectTypeRid": "ri.object-type.employee"
}
```

**Response: 200 OK**
```json
{
  "autoMapped": [
    {
      "columnName": "id",
      "propertyId": "id",
      "baseType": "integer",
      "isNewProperty": false,
      "confidence": "high",
      "reason": "Name match with existing primary key property"
    },
    {
      "columnName": "name",
      "propertyId": "name",
      "baseType": "string",
      "isNewProperty": true,
      "confidence": "high",
      "reason": "Direct name match, type compatible"
    }
  ],
  "conflicts": [],
  "unmapped": [],
  "newColumns": [],
  "suggestedLinks": [
    {
      "foreignKeyColumn": "department_id",
      "refTable": "departments",
      "refColumn": "id",
      "suggestedLinkId": "employee-department",
      "suggestedCardinality": "many-to-one"
    }
  ]
}
```

#### POST /api/mapping/validate — 类型兼容性校验

**Request Body:**
```json
{
  "mappings": [
    { "columnNativeType": "varchar(255)", "columnBaseType": "string", "targetBaseType": "string" },
    { "columnNativeType": "bigint", "columnBaseType": "long", "targetBaseType": "integer" }
  ]
}
```

**Response: 200 OK**
```json
{
  "results": [
    { "index": 0, "compatibility": "compatible" },
    { "index": 1, "compatibility": "lossy", "warning": "Long → Integer: values > 2,147,483,647 will overflow" }
  ]
}
```

### 7.6 Authorization Requirements / 授权要求

> 完整 RBAC 执行是 post-MVP（Security Service 尚未实现），以下矩阵作为规范定义。

| Operation | Owner | Editor | Viewer |
|-----------|-------|--------|--------|
| 注册数据源 | ✅ | ❌ | ❌ |
| 测试连接 | ✅ | ✅ | ❌ |
| 提取 Schema | ✅ | ✅ | ❌ |
| 预览数据 | ✅ | ✅ (行数限制) | ❌ |
| 删除数据源 | ✅ | ❌ | ❌ |

Agent 操作继承调用用户的角色权限。审计日志必填字段：`actor_type`（user/agent）、`delegated_from`（代理来源用户 rid）、`operation`、`resource_rid`。

---

## 8. MCP Tools（Agent 接口，Phase 2+）

为 AI Agent 提供数据源管理能力，通过 MCP Server 暴露为 Tools。

| Tool | 描述 | 参数 |
|------|------|------|
| `list_datasources` | 列出空间内所有可用数据源 | `spaceRid` |
| `test_datasource` | 测试数据源连接是否可用 | `datasourceRid` |
| `extract_datasource_schema` | 提取数据源 Schema | `datasourceRid` |
| `suggest_property_mappings` | 获取自动映射建议 | `datasourceRid`, `tableName`, `objectTypeRid` |
| `preview_datasource_data` | 预览数据源的样本数据 | `datasourceRid`, `tableName`, `limit?` |

---

## 9. 分阶段交付路线

### Phase 1: Schema Binding（MVP v0.1.0）

**范围**：手动声明数据源元数据和属性映射，无实际连接。

| 交付物 | 说明 |
|--------|------|
| `DataSource` 实体 + `data_sources` 表 | 数据源元数据存储 |
| Property `backingColumn` 支持 | 属性与列的映射关系 |
| UI：数据源面板 | PRD 描述的左栏列、右栏属性的映射交互 |
| UI：4 种映射方式 | 列→新属性、列→已有属性、属性→列、批量映射 |
| 映射校验 | 类型兼容性检查 |

### Phase 2: Live Schema Extraction + PyAirbyte（v0.2.0）

**范围**：Connector 框架上线，集成 PyAirbyte，实际连接数据源。

| 交付物 | 说明 |
|--------|------|
| `DataSourceConnector` ABC + `ConnectorRegistry` | 连接器抽象框架（Python） |
| PyAirbyte 集成 | 600+ 连接器即用，覆盖主流数据库、SaaS、文件源 |
| SQLAlchemy Schema Inspector | 通过 `inspect()` 精细提取 PG/MySQL Schema（含外键、约束） |
| pandas 类型推断器 | CSV/Excel 类型推断，基于 `convert_dtypes()` |
| `test_connection()` + `extract_schema()` | 核心连接器操作 |
| MappingEngine | 自动映射引擎 |
| 凭证加密存储 | AES-256-GCM（Python `cryptography` 库） |
| UI：测试连接、Schema 浏览器、映射预览 | 交互式数据源管理 |
| REST API（7.1-7.3） | 数据源管理 + 映射 API（FastAPI） |
| MCP Tools | Agent 接口（Python MCP SDK） |

### Phase 3: Data Preview & Drift Detection（v0.3.0）

| 交付物 | 说明 |
|--------|------|
| `preview_data()` | 样本数据预览 |
| `detect_schema_drift()` | Schema 变化检测 |
| 定时 Drift 检查 | 周期性比较缓存与实际 Schema |
| REST API 连接器 | OpenAPI spec 解析（`prance` / `openapi-spec-validator`） |
| Object Store 连接器 | S3/OSS 文件元数据提取（PyAirbyte S3 source 或 boto3） |
| Drift 通知 | UI + webhook 通知 |

### Phase 4: Data Sync & Advanced（v0.4.0+）

| 交付物 | 说明 |
|--------|------|
| 增量数据同步引擎 | CDC for DB, polling for API/文件 |
| 对象实例存储层 | 查询层 + 缓存层 |
| Action Type 写回机制 | 通过 Action 回写数据源 |
| 连接池 | 高频数据同步场景（SQLAlchemy async pool） |
| `SecretProvider` 扩展 | Vault / AWS Secrets Manager |

---

## 10. 技术选型总结

| 组件 | 技术 | 理由 |
|------|------|------|
| 连接器框架 | [PyAirbyte](https://github.com/airbytehq/PyAirbyte) | 600+ 连接器即用，MIT 协议，Python 库直接集成 |
| Database Schema 提取 | [SQLAlchemy 2.0](https://www.sqlalchemy.org/) + asyncpg/PyMySQL | `inspect()` API 提供统一的 Schema 提取（含外键、约束、索引），异步支持 |
| CSV 解析 + 类型推断 | [pandas](https://pandas.pydata.org/) | `read_csv()` + `convert_dtypes()` 自动推断类型，处理大文件可用 chunksize |
| Excel 解析 | [openpyxl](https://openpyxl.readthedocs.io/) / pandas | `pd.read_excel()` 读取 .xlsx，提取 sheet 和列头 |
| REST API Schema | [prance](https://github.com/jfinkhaeuser/prance) / [openapi-spec-validator](https://github.com/python-openapi/openapi-spec-validator) | 解析 OpenAPI 3.x spec |
| 凭证加密 | [cryptography](https://cryptography.io/) | AES-256-GCM，Python 标准加密库 |
| Schema Diff | 自建 Python | 两个 `ExtractedSchema` 的集合比较，逻辑简单 |

---

## 11. 关键设计决策

| # | 决策 | 选择 | 理由 | 替代方案 |
|---|------|------|------|----------|
| DD-1 | 自建 vs 采用现成方案 | 混合：PyAirbyte 为核心 + SQLAlchemy/pandas 补充精细提取 | PyAirbyte 提供 600+ 连接器生态；SQLAlchemy 提供更精确的 Schema 元数据（外键、约束）；pandas 提供强大的类型推断 | 直接嵌入 OpenMetadata（太重）/ 纯自建连接器（重复造轮子） |
| DD-2 | 连接器语言 | Python | 后端采用 Python (FastAPI)，PyAirbyte/SQLAlchemy/pandas 均为 Python 原生库，无需跨语言通信 | TypeScript（缺少连接器生态，需自建或引入 Python sidecar） |
| DD-3 | 连接管理 | 短连接（MVP） | Schema 提取是低频操作，连接池留给数据同步阶段 | 预建连接池（MVP 不需要） |
| DD-4 | 凭证存储 | AES-256-GCM（Python `cryptography` 库） | MVP 最简方案，无外部依赖 | Vault（运维成本高，MVP 不需要） |
| DD-5 | 自动映射方式 | 规则驱动（名称推断 + 类型矩阵） | 确定性强、可调试、可解释 | ML 模型（需要训练数据，可后期叠加） |
| DD-6 | 数据源:ObjectType 关系 | 1:1 严格约束 | 与 Palantir 一致，语义清晰 | N:1（一个数据源支撑多个 ObjectType，增加复杂度） |
| DD-7 | PyAirbyte 集成方式 | 直接进程内集成 | Python 后端消除 sidecar 架构，PyAirbyte 作为 Python 库直接 import 使用，无需额外的 HTTP/gRPC 通信层 | Python sidecar（增加部署和运维复杂度） |
| DD-8 | 连接器执行隔离 | 线程池 + 超时 + 信号量 | 防止连接器操作阻塞 API 主路径 | 无隔离（风险）、任务队列（过度设计） |

---

## References

- [00-design-principles.md](./00-design-principles.md) — P1: Semantic Abstraction, P7: Open and Extensible
- [01-system-architecture.md](./01-system-architecture.md) — Data Source Layer, AD-1: Schema-Data Separation
- [02-domain-model.md](./02-domain-model.md) — ObjectType.backingDatasource, Property.backingColumn, PropertyBaseType enum
- [04-tech-stack-recommendations.md](./04-tech-stack-recommendations.md) — Backend: Python (FastAPI), PyAirbyte integration
- [../specs/supported-property-types.md](../specs/supported-property-types.md) — 21 种 PropertyBaseType 的完整规格
