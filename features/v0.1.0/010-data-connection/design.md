# 技术方案: 010 Data Connection（数据连接）

> **本文档只写契约和决策（Why + What），不写实现步骤（How）。**
> 测试策略由 CLAUDE.md §测试要求统一管理，此处不重复。

**关联规范**: [features/v0.1.0/010-data-connection/spec.md]
**架构参考**: [docs/architecture/05-data-connectivity.md]

---

## 实施状态声明

> 本特性后端核心已实现（MySQL 连接管理、Excel/CSV 上传、Dataset CRUD、导入任务、加密服务），代码评审发现 3 个 Critical + 5 个 Major 问题需修复。前端尚未开始。
>
> 本文档采用**追认 + 补充**风格：追认已有架构决策和 API 契约，补充修复方案和前端设计。

---

## 架构决策

### 追认决策（已实现）

| ID | 决策 | 理由 |
|----|------|------|
| AD-1 | MySQL 连接使用专用 `mysql_connections` 表，不使用架构文档的通用 `data_sources` 表 | MVP 只支持 MySQL，通用抽象在引入更多连接器时再做（对应 KD-5） |
| AD-2 | 密码加密使用 Fernet（AES-256 对称加密），密钥通过 `settings.ENCRYPTION_KEY` 注入 | Fernet 同时提供加密和完整性校验，API 简单；密钥从环境变量读取（对应 KD-2） |
| AD-3 | 导入任务状态使用进程内存 `ImportTaskService` 单例跟踪（TTL 1h），不引入 Redis/Celery。**部署约束：MVP 仅支持单 worker（`uvicorn --workers 1`）** | MVP 单 worker 部署，内存方案足够；任务状态短暂且不需持久化；多 worker 需迁移到 DB/Redis（对应 KD-3） |
| AD-4 | Dataset 行数据以 JSONB 存储在 `dataset_rows` 表（每行一条记录） | Schema-free 灵活性，避免为每个 Dataset 动态建表；MVP 数据量有限（对应 KD-4） |
| AD-5 | 文件上传采用两步模式：preview（返回 fileToken）→ confirm（触发导入） | 用户需先预览列结构和数据类型再确认导入，两步模式提供更好的交互体验 |

### 补充决策（修复方案）

| ID | 决策 | 理由 |
|----|------|------|
| AD-6 | CryptoService 改为模块级单例，自动生成的开发密钥缓存到模块变量 | 修复 C2：当前每次实例化生成不同密钥，导致加密的密码在下次请求时无法解密 |
| AD-7 | MySQL 表名安全校验：**必选方案** — 先通过 `SHOW TABLES` 获取连接内真实表名列表，验证用户输入的 table 参数存在于该列表中；辅助方案 — 正则格式校验 `^[a-zA-Z_][a-zA-Z0-9_]{0,63}$`。任何含 `table` 参数的 service 方法入口必须先完成白名单校验 | 修复 C1：当前 SQL 拼接表名存在注入风险，白名单校验比纯正则更可靠 |
| AD-8 | 后台导入任务添加 `try/except` + `logger.exception()` 日志记录 | 修复：当前异常只更新任务状态，无日志输出，生产环境难以排查 |
| AD-9 | 缺少类型化的 response_model 统一补齐 Pydantic 模型 | 修复 M3/M4：`upload/preview` 和 `test-connection` 端点返回无类型 dict，违反类型共享管道 |
| AD-10 | 文件预览缓存添加 TTL 清理（30 分钟过期） | 修复 M2：当前 `_previews` dict 只增不减，存在内存泄漏风险 |
| AD-11 | MySQL 全表导入添加行数上限（MVP 10万行） | 修复 M6：当前 `SELECT * FROM table` 无限制，大表会导致 OOM |

---

## 数据结构

### PostgreSQL 表定义（追认 — 已在 0004 迁移中实现）

```sql
-- 数据集
CREATE TABLE datasets (
    rid             VARCHAR NOT NULL PRIMARY KEY,
    name            VARCHAR NOT NULL,
    source_type     VARCHAR NOT NULL,       -- 'mysql' | 'csv' | 'excel'
    source_metadata JSONB,                  -- 来源信息快照
    row_count       INTEGER NOT NULL DEFAULT 0,
    column_count    INTEGER NOT NULL DEFAULT 0,
    status          VARCHAR NOT NULL DEFAULT 'importing', -- 'importing' | 'ready' | 'failed'
    imported_at     TIMESTAMP WITH TIME ZONE,
    ontology_rid    VARCHAR NOT NULL REFERENCES ontologies(rid) ON DELETE CASCADE,
    created_by      VARCHAR
);

-- 数据集列定义
CREATE TABLE dataset_columns (
    rid             VARCHAR NOT NULL PRIMARY KEY,
    dataset_rid     VARCHAR NOT NULL REFERENCES datasets(rid) ON DELETE CASCADE,
    name            VARCHAR NOT NULL,
    inferred_type   VARCHAR NOT NULL,       -- PropertyBaseType 值
    is_nullable     BOOLEAN NOT NULL DEFAULT true,
    is_primary_key  BOOLEAN NOT NULL DEFAULT false,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    UNIQUE (dataset_rid, name)
);

-- 数据集行（JSONB 存储）
CREATE TABLE dataset_rows (
    dataset_rid     VARCHAR NOT NULL REFERENCES datasets(rid) ON DELETE CASCADE,
    row_index       INTEGER NOT NULL,
    data            JSONB NOT NULL,
    PRIMARY KEY (dataset_rid, row_index)
);
CREATE INDEX ix_dataset_rows_dataset ON dataset_rows (dataset_rid);

-- MySQL 连接配置
CREATE TABLE mysql_connections (
    rid                VARCHAR NOT NULL PRIMARY KEY,
    name               VARCHAR NOT NULL,
    host               VARCHAR NOT NULL,
    port               INTEGER NOT NULL,
    database_name      VARCHAR NOT NULL,
    username           VARCHAR NOT NULL,
    encrypted_password TEXT NOT NULL,        -- Fernet 加密
    ssl_enabled        BOOLEAN NOT NULL DEFAULT false,
    ontology_rid       VARCHAR NOT NULL REFERENCES ontologies(rid) ON DELETE CASCADE,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by         VARCHAR,
    last_used_at       TIMESTAMP WITH TIME ZONE
);

-- object_types 表扩展（Phase 2 字段）
ALTER TABLE object_types
    ADD COLUMN intended_actions         JSONB,
    ADD COLUMN backing_datasource       JSONB,    -- {"datasetRid": "...", "syncMode": "snapshot"}
    ADD COLUMN primary_key_property_id  VARCHAR,
    ADD COLUMN title_key_property_id    VARCHAR;
```

### Pydantic Schema（追认 — 已实现）

**Domain 模型分布**：

| 文件 | 模型 | 用途 |
|------|------|------|
| `domain/dataset.py` | `Dataset`, `DatasetColumn`, `DatasetListItem`, `DatasetListResponse`, `DatasetPreviewResponse` | Dataset 读取/列表/预览 |
| `domain/mysql_connection.py` | `MySQLConnection`, `MySQLConnectionCreateRequest`, `MySQLConnectionTestRequest`, `MySQLTableInfo`, `MySQLColumnInfo`, `MySQLTablePreview` | MySQL 连接管理 |
| `domain/import_task.py` | `ImportTask`, `ImportTaskStatus` | 导入任务状态跟踪 |
| `domain/type_mapping.py` | `MYSQL_TYPE_MAP`, `mysql_type_to_property_type()`, `infer_column_type()` | 类型映射 |

**需新增的 Pydantic 模型**（修复 AD-9）：

```python
# domain/mysql_connection.py — 新增
class ConnectionTestResponse(DomainModel):
    success: bool
    latency_ms: int | None = None
    error: str | None = None

# domain/import_task.py — 新增
class FileUploadPreviewResponse(DomainModel):
    file_token: str
    file_name: str
    file_size: int
    sheet_names: list[str] | None = None  # Excel only
    columns: list[FilePreviewColumn]
    preview_rows: list[dict[str, Any]]
    total_rows: int

class FilePreviewColumn(DomainModel):
    name: str
    inferred_type: str
    sample_values: list[str]

# domain/import_task.py — 新增（从 router 移出）
class MySQLImportRequest(DomainModel):
    connection_rid: str
    table: str
    dataset_name: str
    selected_columns: list[str] | None = None

class FileConfirmRequest(DomainModel):
    file_token: str
    dataset_name: str
    sheet_name: str | None = None
    has_header: bool = True
    selected_columns: list[str] | None = None
    column_type_overrides: dict[str, str] | None = None
```

---

## API 契约

### 端点列表（追认 — 已实现）

#### MySQL 连接管理

| Method | Path | 描述 | 关联 AC |
|--------|------|------|---------|
| GET | `/api/v1/mysql-connections` | 列出所有 MySQL 连接 | AC-CM04 |
| POST | `/api/v1/mysql-connections` | 保存新连接（密码加密） | AC-CM01 |
| POST | `/api/v1/mysql-connections/test` | 测试连接（不保存） | AC-CM02, AC-CM03, AC-CM05 |
| GET | `/api/v1/mysql-connections/{rid}/tables` | 浏览表列表 | AC-MI01 |
| GET | `/api/v1/mysql-connections/{rid}/tables/{table}/columns` | 获取表列结构 | AC-MI02 |
| GET | `/api/v1/mysql-connections/{rid}/tables/{table}/preview` | 预览表数据 | AC-MI03 |

#### 导入操作

| Method | Path | 描述 | 关联 AC |
|--------|------|------|---------|
| POST | `/api/v1/datasets/import/mysql` | 发起 MySQL 导入 | AC-MI04 |
| POST | `/api/v1/datasets/upload/preview` | 上传文件并预览 | AC-FU01 |
| POST | `/api/v1/datasets/upload/confirm` | 确认文件导入 | AC-FU02 |
| GET | `/api/v1/import-tasks/{task_id}` | 查询导入任务状态 | AC-MI05, AC-MI06, AC-MI08 |

#### Dataset 管理

| Method | Path | 描述 | 关联 AC |
|--------|------|------|---------|
| GET | `/api/v1/datasets` | 列出 Dataset（支持搜索） | AC-DM01, AC-DM02 |
| GET | `/api/v1/datasets/{rid}` | 获取 Dataset 详情 | AC-DM03 |
| GET | `/api/v1/datasets/{rid}/preview` | 预览 Dataset 数据 | AC-DM04 |
| DELETE | `/api/v1/datasets/{rid}` | 删除 Dataset | AC-DM05, AC-DM06, AC-DM07 |

#### 需新增的端点

| Method | Path | 描述 | 关联 AC |
|--------|------|------|---------|
| DELETE | `/api/v1/mysql-connections/{rid}` | 删除连接 | （PRD 要求） |

### 错误码

| HTTP Status | Code | 场景 | 关联 AC |
|-------------|------|------|---------|
| 403 | `DATASET_IN_USE` | 删除已被 OT 引用的 Dataset | AC-DM06 |
| 404 | `DATASET_NOT_FOUND` | Dataset RID 不存在 | AC-DM07 |
| 404 | `IMPORT_TASK_NOT_FOUND` | 任务 ID 不存在 | AC-MI08 |
| 404 | `CONNECTION_NOT_FOUND` | 连接 RID 不存在 | — |
| 404 | `FILE_TOKEN_EXPIRED` | fileToken 无效或过期 | — |
| 422 | `FILE_TOO_LARGE` | 上传文件超过 50MB | AC-FU03 |
| 422 | `UNSUPPORTED_FILE_FORMAT` | 文件格式不支持 | AC-FU04 |
| 422 | `INVALID_TABLE_NAME` | MySQL 表名不合法（AD-7 校验） | — |
| 422 | `ROW_LIMIT_EXCEEDED` | 表行数超过 10 万行上限 | — |

---

## 服务依赖关系（追认）

```
┌─────────────────────────────────────────────────────┐
│                     Routers                          │
│  datasets.py  │  imports.py  │  mysql_connections.py │
└──────┬────────┴──────┬───────┴──────────┬───────────┘
       │               │                  │
       ▼               ▼                  ▼
┌──────────────┐ ┌──────────────┐ ┌────────────────────┐
│DatasetService│ │FileImport    │ │MySQLImport         │
│              │ │Service       │ │Service             │
│- list        │ │- upload_and_ │ │- save_connection   │
│- get_by_rid  │ │  preview     │ │- list_connections  │
│- get_preview │ │- confirm_    │ │- test_connection   │
│- delete      │ │  import      │ │- browse_tables     │
└──────┬───────┘ └──────┬───────┘ │- start_import      │
       │                │         └──────────┬─────────┘
       │                │                    │
       │         ┌──────▼──────────┐         │
       │         │ImportTaskService│◄────────┘
       │         │(内存单例)       │
       │         └────────────────┘
       │                │                    │
       ▼                ▼                    ▼
┌──────────────┐ ┌──────────────┐ ┌────────────────────┐
│DatasetStorage│ │              │ │MySQLConnection     │
│              │ │              │ │Storage             │
└──────────────┘ │CryptoService │ └────────────────────┘
                 └──────────────┘
```

---

## 后端修复方案

### Critical 修复

**C1: SQL 注入 — 表名校验（AD-7）**
- 位置：`MySQLImportService.preview_table()`, `_run_import()`, `get_table_columns()`
- 方案：在所有接受 `table` 参数的方法入口添加正则校验 `^[a-zA-Z_][a-zA-Z0-9_]{0,63}$`，不匹配时抛出 422
- 额外方案：`browse_tables` 已通过 `SHOW TABLE STATUS` 获取真实表名列表，可用作二次白名单验证

**C2: CryptoService 密钥不稳定（AD-6）**
- 位置：`CryptoService.__init__()`
- 方案：添加模块级 `_shared_crypto_service: CryptoService | None` 缓存；首次实例化后缓存，后续复用同一实例
- 或：改为 `get_crypto_service()` 工厂函数 + 模块级缓存

**C3: 后台任务异常无日志（AD-8）**
- 位置：`MySQLImportService._run_import()`, `FileImportService._run_import()`
- 方案：在 `except Exception as e` 块中添加 `logger.exception("Import task failed")`

### Major 修复

**M2: 文件预览缓存无 TTL（AD-10）**
- 方案：在 `_previews` dict 中存储 `(data, created_at)` 元组；`upload_and_preview` 入口调用清理逻辑，删除超过 30 分钟的条目

**M3/M4: 缺少 response_model（AD-9）**
- 方案：新增 `ConnectionTestResponse`、`FileUploadPreviewResponse` 等 Pydantic 模型，并在路由装饰器中声明 `response_model=`

**M6: MySQL 全表导入无行数限制（AD-11）**
- 方案：`start_import` 入口先查 `SELECT COUNT(*) FROM table`，超过 10 万行返回 422 `ROW_LIMIT_EXCEEDED`

**M8: 冗余级联删除**
- 方案：`DatasetStorage.delete()` 只删除 dataset 主记录，依赖 `ON DELETE CASCADE` 清理子表

---

## 前端设计

### 路由

```
/ontology/data-connection              → DataConnectionPage（Connections Tab）
/ontology/data-connection?tab=datasets → DataConnectionPage（Datasets Tab）
```

### 页面结构

```
DataConnectionPage
├── PageHeader                         # "Data Connection" 标题
├── Tabs                               # Ant Design Tabs
│   ├── Tab: "Connections"
│   │   ├── ConnectionsToolbar         # [+ New Connection] 按钮
│   │   └── ConnectionsTable           # Ant Design Table
│   │       └── 操作列                 # Test | Import | Delete
│   └── Tab: "Datasets"
│       ├── DatasetsToolbar            # 搜索框 + [Import Dataset ▼] 按钮（下拉：From MySQL / Upload File）
│       └── DatasetsTable              # Ant Design Table
│           └── 操作列                 # Preview | Delete（in_use 时 Delete 置灰）
├── MySQLImportWizard (Modal)          # 4 步向导
│   ├── Step 1: ConfigureConnection    # 连接配置表单 + 测试连接
│   ├── Step 2: SelectTable            # 表列表 + 列预览 + 数据预览
│   ├── Step 3: ConfigureImport        # Dataset 名称 + 列选择
│   └── Step 4: ImportResult           # 进度/结果
├── FileUploadWizard (Modal)           # 3 步向导
│   ├── Step F1: UploadFile            # Ant Design Upload（拖拽区）
│   ├── Step F2: PreviewAndConfigure   # 列预览 + 类型选择 + 数据预览
│   └── Step F3: ImportResult          # 进度/结果
└── DatasetPreviewDrawer               # Dataset 数据预览抽屉
```

### Zustand Store

```typescript
// stores/data-connection-store.ts — 仅 UI 状态
interface DataConnectionStore {
  // MySQL 导入向导
  mysqlWizardOpen: boolean;
  mysqlWizardStep: 0 | 1 | 2 | 3;
  openMySQLWizard: () => void;
  closeMySQLWizard: () => void;
  setMySQLWizardStep: (step: number) => void;

  // 文件上传向导
  fileWizardOpen: boolean;
  fileWizardStep: 0 | 1 | 2;
  openFileWizard: () => void;
  closeFileWizard: () => void;
  setFileWizardStep: (step: number) => void;

  // Dataset 预览抽屉
  previewDatasetRid: string | null;
  openPreview: (rid: string) => void;
  closePreview: () => void;
}
```

### TanStack Query Hooks

```typescript
// api/mysql-connections.ts
useListMySQLConnections()                        // GET /mysql-connections
useSaveMySQLConnection()                         // POST /mysql-connections
useTestMySQLConnection()                         // POST /mysql-connections/test
useDeleteMySQLConnection()                       // DELETE /mysql-connections/{rid}
useBrowseTables(connectionRid)                   // GET /mysql-connections/{rid}/tables
useTableColumns(connectionRid, table)            // GET /mysql-connections/{rid}/tables/{table}/columns
useTablePreview(connectionRid, table)            // GET /mysql-connections/{rid}/tables/{table}/preview

// api/imports.ts
useMySQLImport()                                 // POST /datasets/import/mysql
useFileUploadPreview()                           // POST /datasets/upload/preview
useFileConfirmImport()                           // POST /datasets/upload/confirm
useImportTaskStatus(taskId, { refetchInterval })  // GET /import-tasks/{task_id}（轮询）

// api/datasets.ts
useListDatasets(search?)                          // GET /datasets
useDataset(rid)                                   // GET /datasets/{rid}
useDatasetPreview(rid, limit?)                    // GET /datasets/{rid}/preview
useDeleteDataset()                                // DELETE /datasets/{rid}
```

### i18n 命名空间

```
dataConnection.page.title
dataConnection.tabs.connections / .datasets
dataConnection.connections.table.name / .host / .database / .createdAt / .actions
dataConnection.connections.actions.test / .import / .delete
dataConnection.connections.newConnection
dataConnection.connections.testSuccess / .testFailed
dataConnection.datasets.table.name / .sourceType / .rowCount / .columnCount / .importedAt / .status / .actions
dataConnection.datasets.actions.preview / .delete
dataConnection.datasets.inUse / .inUseTooltip
dataConnection.datasets.importDataset / .fromMySQL / .uploadFile
dataConnection.mysql.wizard.title
dataConnection.mysql.step1.title / ... (每步标题 + 表单标签)
dataConnection.mysql.step2.title / ...
dataConnection.mysql.step3.title / ...
dataConnection.mysql.step4.title / ...
dataConnection.file.wizard.title
dataConnection.file.step1.title / ...
dataConnection.file.step2.title / ...
dataConnection.file.step3.title / ...
dataConnection.common.snapshotWarning  # "此操作为快照，不自动同步"
dataConnection.common.importing / .ready / .failed
dataConnection.errors.datasetInUse / .fileTooLarge / .unsupportedFormat / ...
```

### 侧边栏导航入口

在现有 `layout/Sidebar` 组件中添加 "Data Connection" 一级菜单项，图标使用 Ant Design `ApiOutlined` 或 `DatabaseOutlined`，路由指向 `/ontology/data-connection`。

---

## 文件清单

### 后端（已存在 — 需修复）

```
apps/server/
├── app/services/crypto_service.py             # 修改：单例化
├── app/services/mysql_import_service.py       # 修改：表名校验、行数限制、日志
├── app/services/file_import_service.py        # 修改：预览缓存 TTL、日志
├── app/storage/dataset_storage.py             # 修改：简化 delete
├── app/routers/imports.py                     # 修改：response_model、请求模型迁出
├── app/routers/mysql_connections.py           # 修改：response_model、新增 DELETE
├── app/domain/mysql_connection.py             # 修改：新增 ConnectionTestResponse
├── app/domain/import_task.py                  # 修改：新增 FileUploadPreviewResponse 等
└── openapi.json                               # 重新生成
```

### 前端（全部新建）

```
apps/web/src/
├── pages/data-connection/
│   ├── DataConnectionPage.tsx                 # 新建：主页面（Tabs）
│   ├── components/
│   │   ├── ConnectionsTab.tsx                 # 新建：连接列表 Tab
│   │   ├── DatasetsTab.tsx                    # 新建：Dataset 列表 Tab
│   │   ├── MySQLImportWizard.tsx              # 新建：4 步导入向导 Modal
│   │   ├── FileUploadWizard.tsx               # 新建：3 步上传向导 Modal
│   │   ├── DatasetPreviewDrawer.tsx           # 新建：数据预览抽屉
│   │   └── ImportProgress.tsx                 # 新建：导入进度组件（复用于两个向导）
│   └── __tests__/
│       ├── ConnectionsTab.test.tsx            # 新建
│       └── DatasetsTab.test.tsx               # 新建
├── api/
│   ├── mysql-connections.ts                   # 已存在 — 更新 hooks
│   ├── imports.ts                             # 已存在 — 更新 hooks
│   └── datasets.ts                            # 已存在 — 更新 hooks
├── stores/
│   ├── data-connection-store.ts               # 新建：向导/抽屉 UI 状态
│   └── __tests__/
│       └── data-connection-store.test.ts      # 新建
├── locales/
│   ├── en/dataConnection.json                 # 新建
│   └── zh/dataConnection.json                 # 新建
└── generated/api.ts                           # 重新生成
```
