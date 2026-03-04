# 技术方案: 010 Data Connection（数据连接）

> **本文档只写契约和决策（Why + What），不写实现步骤（How）。**
> 测试策略由 CLAUDE.md §测试要求统一管理，此处不重复。

**关联规范**: [features/v0.1.0/010-data-connection/spec.md]
**架构参考**: [docs/architecture/05-data-connectivity.md]

---

## 实施状态声明

> 本特性后端核心已实现并已完成 Critical/Major 修复。前端已实现但存在与 PRD 的体验偏差需要重构。
>
> 本次更新聚焦：
> 1. **Connections Tab 职责修正**：移除导入按钮，新增 New Connection 按钮、Dataset 数列、Schema 浏览器 Drawer
> 2. **Datasets Tab 职责修正**：新增 Import Dataset 下拉入口
> 3. **MySQL 向导修正**：选择已有连接时自动填充表单（密码除外）
> 4. **连接状态修正**：默认显示 untested（非空 —）
> 5. **Dataset 状态修正**：未关联时显示 Available（非空）
> 6. **后端补充**：GET 单连接详情 + 连接列表增加 datasetCount

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

### 已完成的修复决策

| ID | 决策 | 状态 |
|----|------|------|
| AD-6 | CryptoService 改为模块级单例 `get_crypto_service()` | ✅ 已修复 |
| AD-7 | MySQL 表名白名单校验（`SHOW TABLES` + 正则） | ✅ 已修复 |
| AD-8 | 后台任务 `logger.exception()` 日志记录 | ✅ 已修复 |
| AD-9 | `ConnectionTestResponse`、`FileUploadPreviewResponse` 等 response_model 补齐 | ✅ 已修复 |
| AD-10 | 文件预览缓存 TTL 30分钟清理 | ✅ 已修复 |
| AD-11 | MySQL 导入 10万行上限 | ✅ 已修复 |

### 新增决策（本次重构）

| ID | 决策 | 理由 |
|----|------|------|
| AD-12 | Schema 浏览器使用 Drawer 侧抽屉（非路由页面）展示 | 无需新路由，保持 SPA 流畅体验；Drawer 宽度 900px+ 足以容纳左右分栏布局（表列表 + 列结构/预览） |
| AD-13 | 连接列表 `datasetCount` 通过后端聚合查询返回（非前端计算） | 避免前端多次请求；通过 `SELECT source_metadata->>'connectionRid', COUNT(*) FROM datasets GROUP BY ...` 批量计算 |
| AD-14 | 导入入口从 Connections Tab 迁移到 Datasets Tab | 对齐 PRD §3.2/§3.3 职责分离：Connections 管连接，Datasets 管数据导入 |
| AD-15 | New Connection 使用独立 Modal（非向导 Step 1 复用） | 从 MySQLImportWizard Step 1 抽取连接表单为独立组件，仅包含连接配置 + Test + Save，不触发导入流程 |

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

### Pydantic Schema

**Domain 模型分布**：

| 文件 | 模型 | 用途 |
|------|------|------|
| `domain/dataset.py` | `Dataset`, `DatasetColumn`, `DatasetListItem`, `DatasetListResponse`, `DatasetPreviewResponse` | Dataset 读取/列表/预览 |
| `domain/mysql_connection.py` | `MySQLConnection`, `MySQLConnectionCreateRequest`, `MySQLConnectionTestRequest`, `MySQLTableInfo`, `MySQLColumnInfo`, `MySQLTablePreview`, `ConnectionTestResponse` | MySQL 连接管理 |
| `domain/import_task.py` | `ImportTask`, `ImportTaskStatus`, `FileUploadPreviewResponse`, `FilePreviewColumn`, `MySQLImportRequest`, `FileConfirmRequest` | 导入任务 |
| `domain/type_mapping.py` | `MYSQL_TYPE_MAP`, `mysql_type_to_property_type()`, `infer_column_type()` | 类型映射 |

**本次新增字段**：

```python
# domain/mysql_connection.py — MySQLConnection 新增字段
class MySQLConnection(DomainModel):
    # ... 现有字段 ...
    dataset_count: int = 0  # 关联 Dataset 数量（AC-CM04, AC-CM09）
```

---

## API 契约

### 端点列表

#### MySQL 连接管理

| Method | Path | 描述 | 关联 AC | 状态 |
|--------|------|------|---------|------|
| GET | `/api/v1/mysql-connections` | 列出所有连接（含 `datasetCount`） | AC-CM04, AC-CM09 | ✅ 需修改：增加 datasetCount |
| POST | `/api/v1/mysql-connections` | 保存新连接（密码加密） | AC-CM01, AC-CM08 | ✅ 已实现 |
| POST | `/api/v1/mysql-connections/test` | 测试连接（不保存） | AC-CM02, AC-CM03, AC-CM05 | ✅ 已实现 |
| DELETE | `/api/v1/mysql-connections/{rid}` | 删除连接 | AC-CM06, AC-CM07 | ✅ 已实现 |
| **GET** | **`/api/v1/mysql-connections/{rid}`** | **获取单个连接详情（含 datasetCount）** | **AC-CM14** | **🆕 新增** |
| GET | `/api/v1/mysql-connections/{rid}/tables` | 浏览表列表 | AC-MI01, AC-CM10 | ✅ 已实现 |
| GET | `/api/v1/mysql-connections/{rid}/tables/{table}/columns` | 获取表列结构 | AC-MI02, AC-CM11 | ✅ 已实现 |
| GET | `/api/v1/mysql-connections/{rid}/tables/{table}/preview` | 预览表数据 | AC-MI03, AC-CM12 | ✅ 已实现 |

#### 导入操作

| Method | Path | 描述 | 关联 AC | 状态 |
|--------|------|------|---------|------|
| POST | `/api/v1/datasets/import/mysql` | 发起 MySQL 导入 | AC-MI04 | ✅ 已实现 |
| POST | `/api/v1/datasets/upload/preview` | 上传文件并预览 | AC-FU01 | ✅ 已实现 |
| POST | `/api/v1/datasets/upload/confirm` | 确认文件导入 | AC-FU02 | ✅ 已实现 |
| GET | `/api/v1/import-tasks/{task_id}` | 查询导入任务状态 | AC-MI05, AC-MI06, AC-MI08 | ✅ 已实现 |

#### Dataset 管理

| Method | Path | 描述 | 关联 AC | 状态 |
|--------|------|------|---------|------|
| GET | `/api/v1/datasets` | 列出 Dataset（支持搜索） | AC-DM01, AC-DM02 | ✅ 已实现 |
| GET | `/api/v1/datasets/{rid}` | 获取 Dataset 详情 | AC-DM03 | ✅ 已实现 |
| GET | `/api/v1/datasets/{rid}/preview` | 预览 Dataset 数据 | AC-DM04 | ✅ 已实现 |
| DELETE | `/api/v1/datasets/{rid}` | 删除 Dataset | AC-DM05, AC-DM06, AC-DM07 | ✅ 已实现 |

### GET `/api/v1/mysql-connections/{rid}` 响应契约

```json
{
  "rid": "ri.ontology.mysql-connection.xxx",
  "name": "Production DB",
  "host": "localhost",
  "port": 3306,
  "databaseName": "mydb",
  "username": "user",
  "sslEnabled": false,
  "ontologyRid": "ri.ontology.ontology.xxx",
  "createdAt": "2024-01-01T00:00:00Z",
  "createdBy": "default-user",
  "lastUsedAt": null,
  "datasetCount": 3
}
```

### GET `/api/v1/mysql-connections` 响应变更

每个连接对象新增 `datasetCount` 字段（int）。计算方式：`SELECT COUNT(*) FROM datasets WHERE source_metadata->>'connectionRid' = ? AND status = 'ready'`

### 错误码

| HTTP Status | Code | 场景 | 关联 AC |
|-------------|------|------|---------|
| 403 | `DATASET_IN_USE` | 删除已被 OT 引用的 Dataset | AC-DM06 |
| 404 | `DATASET_NOT_FOUND` | Dataset RID 不存在 | AC-DM07 |
| 404 | `IMPORT_TASK_NOT_FOUND` | 任务 ID 不存在 | AC-MI08 |
| 404 | `CONNECTION_NOT_FOUND` | 连接 RID 不存在 | AC-CM07, AC-CM14 |
| 404 | `FILE_TOKEN_EXPIRED` | fileToken 无效或过期 | — |
| 422 | `FILE_TOO_LARGE` | 上传文件超过 50MB | AC-FU03 |
| 422 | `UNSUPPORTED_FILE_FORMAT` | 文件格式不支持 | AC-FU04 |
| 422 | `INVALID_TABLE_NAME` | MySQL 表名不合法（AD-7 校验） | — |
| 422 | `ROW_LIMIT_EXCEEDED` | 表行数超过 10 万行上限 | AC-MI09 |

---

## 服务依赖关系

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
│- get_preview │ │- confirm_    │ │- get_connection ←新│
│- delete      │ │  import      │ │- test_connection   │
└──────┬───────┘ └──────┬───────┘ │- browse_tables     │
       │                │         │- start_import      │
       │                │         └──────────┬─────────┘
       │         ┌──────▼──────────┐         │
       │         │ImportTaskService│◄────────┘
       │         │(内存单例)       │
       │         └────────────────┘
       │                │                    │
       ▼                ▼                    ▼
┌──────────────┐ ┌──────────────┐ ┌────────────────────┐
│DatasetStorage│ │              │ │MySQLConnection     │
│+ count_by_   │ │              │ │Storage             │
│  conn_rids ←新│ │CryptoService │ └────────────────────┘
└──────────────┘ └──────────────┘
```

---

## 跨 Feature 契约：INV-3 Dataset 1:1 绑定

| 职责 | Owner Feature | 实现方式 |
|------|--------------|---------|
| 只读 in_use 计算 | 010-data-connection | `DatasetService.get_in_use_map()` 合并已发布 OT + WS 草稿中的 `backingDatasource` 引用 |
| 占用者名称返回 | 010-data-connection | `DatasetListItem.linked_object_type_name` 字段（已实现） |
| 保存时唯一性校验 | 003-object-type-crud | OT Service 在绑定 Dataset 时校验该 Dataset 未被其他 OT 绑定，冲突返回 `DATASET_ALREADY_BOUND`（HTTP 409） |
| DB 级兜底约束 | 003-object-type-crud | 建议对 `object_types.backing_datasource->>'datasetRid'` 建唯一部分索引（WHERE backing_datasource IS NOT NULL），防并发写入 |

> 010 只负责"展示谁在用"，不负责"阻止重复绑定"。写入唯一性由 003 在保存 ObjectType 时保障。

---

## 后端补充方案

### B1: Domain model `MySQLConnection` 新增 `dataset_count` 字段

```python
class MySQLConnection(DomainModel):
    # ... 现有字段 ...
    dataset_count: int = 0
```

### B2: `DatasetStorage.count_by_connection_rids()` 新增方法

```python
@staticmethod
async def count_by_connection_rids(
    session: AsyncSession, connection_rids: list[str]
) -> dict[str, int]:
    """返回 {connectionRid: count} 映射"""
    # SELECT source_metadata->>'connectionRid' AS conn_rid, COUNT(*)
    # FROM datasets
    # WHERE status = 'ready'
    #   AND source_metadata->>'connectionRid' IN (:rids)
    # GROUP BY conn_rid
```

### B3: `MySQLImportService.list_connections()` 填充 dataset_count

在查询连接列表后，调用 `DatasetStorage.count_by_connection_rids()` 批量计算每个连接的 Dataset 数量，填充到 `MySQLConnection.dataset_count`。

### B4: 新增 `MySQLImportService.get_connection()` 方法

```python
async def get_connection(self, rid: str) -> MySQLConnection:
    """获取单个连接详情 + dataset_count"""
```

### B5: Router 新增 `GET /api/v1/mysql-connections/{rid}`

```python
@router.get("/mysql-connections/{rid}", response_model=MySQLConnection)
async def get_connection(rid: str, service=Depends(_get_service)):
    return await service.get_connection(rid)
```

---

## 前端设计

### 路由（不变）

```
/ontology/data-connection              → DataConnectionPage（Connections Tab）
/ontology/data-connection?tab=datasets → DataConnectionPage（Datasets Tab）
```

### 页面结构（重构后）

```
DataConnectionPage
├── PageHeader                         # "Data Connection" 标题
├── Tabs                               # Ant Design Tabs
│   ├── Tab: "Connections"
│   │   ├── ConnectionsToolbar         # [+ New Connection] 按钮（AC-CM08）
│   │   └── ConnectionsTable           # Ant Design Table
│   │       ├── 名称（可点击→开 Drawer）  # AC-CM10
│   │       ├── 类型（MySQL）
│   │       ├── 状态（untested/connected/failed）# AC-CM13
│   │       ├── Dataset 数              # AC-CM09
│   │       ├── 最近使用
│   │       └── 操作（Test | Delete）    # 无 Import 按钮（AD-14）
│   └── Tab: "Datasets"
│       ├── DatasetsToolbar            # 搜索框 + [Import Dataset ▼] 下拉按钮（AC-DM08）
│       │   └── 菜单项: From MySQL / Upload File
│       └── DatasetsTable              # Ant Design Table
│           ├── 状态列: In use / Available  # AC-DM01 修正
│           └── 操作列: Preview | Delete
├── NewConnectionModal (Modal)          # 新建（AD-15）—— 仅创建连接
│   ├── 连接配置表单（复用 MySQLImportWizard Step 1 的字段）
│   ├── Test Connection 按钮
│   └── Save 按钮
├── ConnectionDetailDrawer (Drawer)     # 新建（AD-12）—— Schema 浏览器
│   ├── 连接基本信息
│   └── 左右分栏布局
│       ├── 左：表列表 + 搜索框
│       └── 右：选中表后 → 列结构 Tab + 数据预览 Tab
├── MySQLImportWizard (Modal)          # 从 Datasets Tab 触发
│   ├── Step 1: ConfigureConnection    # 修正：选择已有连接→填充表单（AC-MI10）
│   ├── Step 2: SelectTable
│   ├── Step 3: ConfigureImport
│   └── Step 4: ImportResult
├── FileUploadWizard (Modal)           # 从 Datasets Tab 触发
│   ├── Step F1: UploadFile
│   ├── Step F2: PreviewAndConfigure
│   └── Step F3: ImportResult
└── DatasetPreviewDrawer               # 已有
```

### Zustand Store

```typescript
// stores/data-connection-store.ts — 仅 UI 状态
interface DataConnectionStore {
  // Tab 状态
  activeTab: 'connections' | 'datasets';
  setActiveTab: (tab: ActiveTab) => void;

  // Modal 状态（统一管理）
  openModal: 'mysqlImport' | 'fileUpload' | 'newConnection' | null;  // 新增 'newConnection'
  setOpenModal: (modal: ModalType) => void;

  // 连接选中状态
  selectedConnectionRid: string | null;
  setSelectedConnectionRid: (rid: string | null) => void;

  // 连接详情 Drawer（新增）
  detailConnectionRid: string | null;
  setDetailConnectionRid: (rid: string | null) => void;

  // Dataset 预览抽屉
  previewDatasetRid: string | null;
  setPreviewDatasetRid: (rid: string | null) => void;
}
```

### TanStack Query Hooks

```typescript
// api/mysql-connections.ts — 新增
useMySQLConnection(rid)                          // GET /mysql-connections/{rid}（AC-CM14）

// 现有 hooks 不变
useMySQLConnections()                            // GET /mysql-connections（响应含 datasetCount）
useCreateMySQLConnection()                       // POST /mysql-connections
useTestMySQLConnection()                         // POST /mysql-connections/test
useDeleteMySQLConnection()                       // DELETE /mysql-connections/{rid}
useMySQLTables(connectionRid)                    // GET /mysql-connections/{rid}/tables
useMySQLTableColumns(connectionRid, table)       // GET /mysql-connections/{rid}/tables/{table}/columns
useMySQLTablePreview(connectionRid, table)       // GET /mysql-connections/{rid}/tables/{table}/preview

// api/imports.ts — 不变
useMySQLImport()
useFileUploadPreview()
useFileConfirmImport()
useImportTask(taskId)

// api/datasets.ts — 不变
useDatasets(search?)
useDatasetPreview(rid, limit?)
useDeleteDataset()
```

### i18n 新增键

```
# Connections Tab 新增
dataConnection.newConnection          # "New Connection" 按钮
dataConnection.type                   # "Type" 列标题
dataConnection.datasetCount           # "Datasets" 列标题
dataConnection.untested               # "Untested" 状态标签
dataConnection.schemaDrawerTitle      # "Schema Browser" Drawer 标题
dataConnection.searchTables           # "Search tables..." 占位符
dataConnection.tableStructure         # "Structure" Tab 标签
dataConnection.tablePreview           # "Preview" Tab 标签
dataConnection.noTables               # "No tables found" 空状态

# Datasets Tab 新增
dataset.importDataset                 # "Import Dataset" 下拉按钮
dataset.fromMySQL                     # "From MySQL" 菜单项
dataset.uploadFile                    # "Upload Excel/CSV" 菜单项
dataset.available                     # "Available" 状态标签

# 新建连接 Modal
dataConnection.newConnectionTitle     # "New Connection" Modal 标题
dataConnection.saveConnection         # "Save" 按钮
dataConnection.saveSuccess            # "Connection saved" 成功提示
```

### 侧边栏导航入口（已实现）

已在 `layout/Sidebar` 组件中添加 "Data Connection" 一级菜单项。

---

## 文件清单

### 后端（需修改）

```
apps/server/
├── app/domain/mysql_connection.py             # 修改：MySQLConnection 增加 dataset_count 字段
├── app/storage/dataset_storage.py             # 修改：新增 count_by_connection_rids() 方法
├── app/services/mysql_import_service.py       # 修改：list_connections 填充 dataset_count；新增 get_connection
├── app/routers/mysql_connections.py           # 修改：新增 GET /{rid} 端点
├── tests/unit/test_mysql_import_service.py    # 修改：覆盖新方法
├── tests/integration/test_mysql_connections.py # 修改：覆盖新端点
└── openapi.json                               # 重新生成
```

### 前端（需修改/新建）

```
apps/web/src/
├── pages/data-connection/
│   ├── components/
│   │   ├── ConnectionsTab.tsx             # 修改：移除导入按钮，新增列，名称可点击
│   │   ├── DatasetsTab.tsx                # 修改：新增 Import Dataset 下拉按钮，Available 状态
│   │   ├── MySQLImportWizard.tsx          # 修改：handleSelectExisting 改为 form.setFieldsValue
│   │   ├── NewConnectionModal.tsx         # 新建：独立的连接创建 Modal
│   │   └── ConnectionDetailDrawer.tsx     # 新建：Schema 浏览器 Drawer
├── api/
│   └── mysql-connections.ts               # 修改：新增 useMySQLConnection hook
├── stores/
│   └── data-connection-store.ts           # 修改：新增 detailConnectionRid + newConnection modal 类型
├── locales/
│   ├── en-US.json                         # 修改：新增 i18n 键
│   └── zh-CN.json                         # 修改：新增 i18n 键
└── generated/api.ts                       # 重新生成
```
