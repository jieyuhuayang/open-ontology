# Feature: Object Instance Sync（对象实例同步）

**关联 PRD**: [docs/prd/0.1.0（MVP）/本体管理平台（Ontology Manager） PRD.md §2 对象类型管理]
**架构参考**: [docs/architecture/02-domain-model.md], [docs/architecture/06-change-management.md]
**优先级**: P0
**所属版本**: v0.1.0

---

## 相关文档

| 文档 | 路径 |
|------|------|
| 领域模型 | `docs/architecture/02-domain-model.md` |
| 变更管理 | `docs/architecture/06-change-management.md` |
| PRD §2 对象类型管理 | `docs/prd/0.1.0（MVP）/本体管理平台（Ontology Manager） PRD.md` |
| 版本合约 | `features/v0.1.0/release-contract.md` |

| 依赖特性 | 说明 |
|----------|------|
| 003-object-type-crud | ObjectType 基础 CRUD + WorkingState 基础设施 |
| 007-property-management | Property 管理（backing_column 映射） |
| 009-working-state | Publish 流程（F011 在 publish 末尾触发同步） |
| 010-data-connection | Dataset/DatasetColumn 创建和管理 |

---

## 1. 概述与用户故事

作为 **本体管理员**，
我希望 **在 Publish 后自动将 backing datasource 的数据同步为对象实例，并能手动触发重新同步、查看同步状态和实例列表**，
以便 **验证数据映射正确性，并在实例层面查看和管理对象数据**。

---

## 2. MVP 范围决策

以下范围决策由产品方在 Spec Discovery 阶段确认：

| # | 决策项 | MVP 范围 | 说明 |
|---|--------|----------|------|
| D1 | 增量同步策略 | 真正增量 diff | 基于 `primary_key_value` + `data_hash` 对比，检测 INSERT/UPDATE/DELETE |
| D2 | 触发方式 | Publish 后自动 + 手动 Sync Now | Publish 成功后自动触发；OT 详情页提供 Sync Now 按钮 |
| D3 | 查询能力 | 分页列表 + 详情 | MVP 最简，无筛选/排序/搜索 |
| D4 | Schema 变更处理 | Publish 时自动重新同步 | Property 映射变更后自动触发完整重新同步 |

---

## 3. 验收标准

### 同步核心逻辑

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-01 | 系统 | Publish 成功后，某 OT 有 backing datasource 且有 mapped properties | 系统自动触发同步，创建 SyncJob（status=running），将 Dataset 行映射为 ObjectInstance 并持久化 |
| AC-02 | 系统 | 首次同步（OT 无现有实例） | 全部行 INSERT，SyncJob 记录 inserted_count = 行数，sync_type = incremental（有主键时）或 full（无主键时） |
| AC-03 | 系统 | 增量同步——数据源新增行 | 新行 INSERT 为新实例，existing 行不变，SyncJob 记录 inserted_count + unchanged_count |
| AC-04 | 系统 | 增量同步——数据源修改行（primary_key 不变，其他值变） | 对应实例 UPDATE（properties + data_hash + synced_at），SyncJob 记录 updated_count |
| AC-05 | 系统 | 增量同步——数据源删除行 | 对应实例 DELETE，SyncJob 记录 deleted_count |
| AC-06 | 系统 | OT 没有设置 `primary_key_property_id` 时同步 | 退化为全量替换（DELETE ALL + INSERT ALL），sync_type = full |
| AC-07 | 系统 | 同步过程中发生异常（如数据源连接失败） | SyncJob 状态设为 failed，error_message 记录错误信息，不阻塞 Publish 返回 |

### API 端点

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-08 | 系统 | `GET /api/v1/object-types/{ot_rid}/instances?page=1&pageSize=20` | 200，返回 `{ items: ObjectInstance[], total, page, pageSize }`，按 created_at 排序 |
| AC-09 | 系统 | `GET /api/v1/object-types/{ot_rid}/instances/{rid}` | 200，返回单个 ObjectInstance |
| AC-10 | 系统 | `GET /api/v1/object-types/{ot_rid}/instances/nonexistent` | 404，`{ "error": { "code": "OBJECT_INSTANCE_NOT_FOUND" } }` |
| AC-11 | 系统 | `POST /api/v1/object-types/{ot_rid}/sync`（OT 有 backing datasource） | 200，触发手动同步，返回 SyncJob |
| AC-12 | 系统 | `POST /api/v1/object-types/{ot_rid}/sync`（OT 无 backing datasource） | 400，`{ "error": { "code": "SYNC_NO_DATASOURCE" } }` |
| AC-13 | 系统 | `POST /api/v1/object-types/{ot_rid}/sync`（OT 不存在） | 404，`{ "error": { "code": "OBJECT_TYPE_NOT_FOUND" } }` |
| AC-14 | 系统 | `GET /api/v1/object-types/{ot_rid}/sync/status`（有同步记录） | 200，返回最新 SyncJob |
| AC-21 | 系统 | `GET /api/v1/object-types/{ot_rid}/sync/status`（无同步记录） | 200，返回 null |

### 前端 UI

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-15 | 本体管理员 | 进入 OT 详情页 | 左侧导航新增 "Instances" 项（TableOutlined 图标） |
| AC-16 | 本体管理员 | 进入 Instances Tab（有同步记录） | 顶部显示同步状态栏：最后同步时间 + 状态 badge + 统计信息 + "Sync Now" 按钮 |
| AC-17 | 本体管理员 | 进入 Instances Tab（无同步记录） | 顶部显示提示："配置 backing datasource 并发布以触发同步" |
| AC-18 | 本体管理员 | 查看实例表格 | 表格列头根据 OT 的 mapped properties 动态生成，分页显示 |
| AC-19 | 本体管理员 | 点击 "Sync Now" 按钮 | 触发手动同步，按钮显示 loading 状态，完成后刷新实例列表和同步状态 |
| AC-20 | 本体管理员 | OT 无 backing datasource 时查看 Instances Tab | "Sync Now" 按钮 disabled |

---

## 4. 边界情况

- 当 Publish 的 changes 中不包含有 backing datasource 的 OT 时，不触发任何同步
- 当同步失败时（如 Live Dataset 的 MySQL 连接断开），SyncJob 记录 failed 状态但不阻塞 Publish 返回——Publish 已完成的变更不回滚
- 当 OT 被删除时（DELETE CASCADE），其所有 ObjectInstance 和 SyncJob 记录自动级联删除
- 当 Dataset 被删除时（ON DELETE SET NULL），ObjectInstance 的 `source_dataset_rid` 置为 NULL，实例数据保留
- 当同一 OT 下多个 primary_key_value 重复时，由唯一索引 `ix_oi_ot_pk` 阻止插入（应在同步逻辑中 deduplicate）
- 当 Dataset 为空（0 行）时，增量同步删除所有现有实例；全量同步结果为 0 条实例
- **不支持**：筛选、排序、搜索实例（延后到 v0.2.0）
- **不支持**：实例编辑/手动创建（延后到 v0.2.0）
- **不支持**：异步后台同步/进度通知（MVP 同步为同步执行，数据量小）

---

## 5. 架构决策

| ID | 决策 | 选项 | 结论 | 理由 |
|----|------|------|------|------|
| AD-01 | 增量 diff 策略 | A: 基于时间戳 / B: 基于 primary_key + hash diff | 选 B | 时间戳依赖源数据有 updated_at 列（不保证），pk + hash 是通用方案，与数据源结构无关 |
| AD-02 | 无主键时的同步策略 | A: 拒绝同步 / B: 退化为全量替换（DELETE ALL + INSERT ALL） | 选 B | 用户可能先映射数据再设主键，全量替换保证数据可用性；前端提示设置主键以获得增量能力 |
| AD-03 | 同步触发与 Publish 的关系 | A: 阻塞 Publish（同步失败则 Publish 失败）/ B: 非阻塞（同步失败不影响 Publish） | 选 B | Publish 是 Schema 变更的核心操作，不应因实例同步失败而阻塞；同步失败记录到 SyncJob 供用户排查 |
| AD-04 | 属性值存储方式 | A: 每个属性一列（宽表）/ B: JSONB 存储 `{api_name: value}` | 选 B | ObjectType 的属性动态变化，JSONB 灵活免 DDL；GIN 索引支持未来查询；MVP 无复杂查询需求 |
| AD-05 | data_hash 算法 | A: MD5 / B: SHA-256 | 选 B | SHA-256 碰撞率更低，长度可接受（64 chars），开销对 MVP 数据量无影响 |

---

## 6. 数据库 & Domain 模型

### PostgreSQL 表定义

```sql
CREATE TABLE object_instances (
    rid              TEXT PRIMARY KEY,              -- ri.ontology.object-instance.<uuid>
    object_type_rid  TEXT NOT NULL REFERENCES object_types(rid) ON DELETE CASCADE,
    primary_key_value TEXT,                         -- 主键属性值（字符串化），用于增量 diff 和去重
    title_value      TEXT,                          -- titleKey 属性值，用于列表展示
    properties       JSONB NOT NULL DEFAULT '{}',   -- {property_api_name: value, ...}
    source_dataset_rid TEXT REFERENCES datasets(rid) ON DELETE SET NULL,
    source_row_index INTEGER,                       -- 来源行号（溯源）
    data_hash        TEXT,                          -- SHA-256(sorted properties JSON)
    synced_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_oi_ot ON object_instances(object_type_rid);
CREATE UNIQUE INDEX ix_oi_ot_pk ON object_instances(object_type_rid, primary_key_value)
    WHERE primary_key_value IS NOT NULL;
CREATE INDEX ix_oi_properties ON object_instances USING GIN (properties);
```

```sql
CREATE TABLE sync_jobs (
    rid              TEXT PRIMARY KEY,              -- ri.ontology.sync-job.<uuid>
    object_type_rid  TEXT NOT NULL REFERENCES object_types(rid) ON DELETE CASCADE,
    dataset_rid      TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'running',  -- running | completed | failed
    sync_type        TEXT NOT NULL DEFAULT 'full',     -- full | incremental
    total_rows       INTEGER DEFAULT 0,
    inserted_count   INTEGER DEFAULT 0,
    updated_count    INTEGER DEFAULT 0,
    deleted_count    INTEGER DEFAULT 0,
    unchanged_count  INTEGER DEFAULT 0,
    error_message    TEXT,
    started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at     TIMESTAMPTZ,
    triggered_by     TEXT NOT NULL DEFAULT 'system'  -- system | manual
);

CREATE INDEX ix_sj_ot ON sync_jobs(object_type_rid);
```

**设计要点**：
- `properties` JSONB key = Property.api_name，value = 序列化值
- `primary_key_value` 提取到顶层做条件唯一约束（同一 OT 内主键值唯一，WHERE primary_key_value IS NOT NULL）
- `data_hash` = SHA-256(canonical JSON of sorted properties)，用于增量同步时快速检测行是否变更
- ON DELETE CASCADE on `object_type_rid`：删除 OT 级联删除实例和同步任务
- `sync_jobs.dataset_rid` 不设外键引用：即使 Dataset 被删，历史同步记录仍保留

### Pydantic Domain 模型

```python
# app/domain/object_instance.py

class ObjectInstance(DomainModel):
    rid: str
    object_type_rid: str
    primary_key_value: str | None = None
    title_value: str | None = None
    properties: dict = {}
    source_dataset_rid: str | None = None
    source_row_index: int | None = None
    data_hash: str | None = None
    synced_at: datetime
    created_at: datetime

class ObjectInstanceListResponse(DomainModel):
    items: list[ObjectInstance]
    total: int
    page: int
    page_size: int

class SyncJob(DomainModel):
    rid: str
    object_type_rid: str
    dataset_rid: str
    status: str = "running"           # running | completed | failed
    sync_type: str = "full"           # full | incremental
    total_rows: int = 0
    inserted_count: int = 0
    updated_count: int = 0
    deleted_count: int = 0
    unchanged_count: int = 0
    error_message: str | None = None
    started_at: datetime
    completed_at: datetime | None = None
    triggered_by: str = "system"      # system | manual
```

---

## 7. API 契约

### 端点列表

| Method | Path | 描述 |
|--------|------|------|
| GET | `/api/v1/object-types/{ot_rid}/instances` | 分页查询实例列表 |
| GET | `/api/v1/object-types/{ot_rid}/instances/{rid}` | 实例详情 |
| POST | `/api/v1/object-types/{ot_rid}/sync` | 手动触发同步 |
| GET | `/api/v1/object-types/{ot_rid}/sync/status` | 最新同步状态 |

### 请求/响应示例

```json
// GET /api/v1/object-types/{ot_rid}/instances?page=1&pageSize=20
// Response 200
{
  "items": [
    {
      "rid": "ri.ontology.object-instance.abc123",
      "objectTypeRid": "ri.ontology.object-type.xyz",
      "primaryKeyValue": "EMP001",
      "titleValue": "John Doe",
      "properties": {
        "employeeId": "EMP001",
        "name": "John Doe",
        "department": "Engineering"
      },
      "sourceDatasetRid": "ri.ontology.dataset.ds1",
      "sourceRowIndex": 0,
      "dataHash": "a1b2c3...",
      "syncedAt": "2026-03-19T10:00:00Z",
      "createdAt": "2026-03-19T10:00:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "pageSize": 20
}
```

```json
// POST /api/v1/object-types/{ot_rid}/sync
// Response 200
{
  "rid": "ri.ontology.sync-job.job123",
  "objectTypeRid": "ri.ontology.object-type.xyz",
  "datasetRid": "ri.ontology.dataset.ds1",
  "status": "completed",
  "syncType": "incremental",
  "totalRows": 100,
  "insertedCount": 5,
  "updatedCount": 2,
  "deletedCount": 1,
  "unchangedCount": 92,
  "errorMessage": null,
  "startedAt": "2026-03-19T10:00:00Z",
  "completedAt": "2026-03-19T10:00:05Z",
  "triggeredBy": "manual"
}
```

### 错误码表

| HTTP Status | Code | 场景 | 关联 AC |
|-------------|------|------|---------|
| 404 | `OBJECT_INSTANCE_NOT_FOUND` | 指定 rid 的实例不存在 | AC-10 |
| 400 | `SYNC_NO_DATASOURCE` | OT 未配置 backing datasource | AC-12 |
| 404 | `OBJECT_TYPE_NOT_FOUND` | OT 不存在 | AC-13 |

---

## 8. Service / Router 层逻辑

### ObjectSyncService（新建）

核心同步逻辑，主入口 `sync()`：

- **`sync(ot_rid, dataset_rid, triggered_by, ...)`**：
  1. 创建 SyncJob（status=running）
  2. 读取数据源（snapshot → dataset_rows；live → MySQL query）
  3. 通过 Property.backing_column 映射生成 `{api_name: value}` dict
  4. 提取 primary_key_value、title_value，计算 data_hash
  5. 判断增量/全量，执行 diff + 应用变更
  6. 更新 SyncJob 统计，标记 completed/failed

- **增量 diff 算法**（有 primary_key 时）：
  1. 查询现有实例：`{pk_value: (rid, hash)}`
  2. 构建新数据：`{pk_value: (properties, hash, title, row_index)}`
  3. 计算差集：to_insert = new - existing, to_delete = existing - new, to_update = intersection where hash differs
  4. 执行批量 DELETE / INSERT / UPDATE

- **全量替换**（无 primary_key 时）：
  DELETE ALL + INSERT ALL

### ObjectInstanceService（新建）

查询逻辑：
- **`list_by_object_type(ot_rid, page, page_size)`** → 委托 Storage 分页查询
- **`get_by_rid(rid)`** → 不存在抛 AppError(OBJECT_INSTANCE_NOT_FOUND, 404)

### WorkingStateService（修改）

在 `publish()` 末尾（`flush()` 之后、return 之前）新增 `_trigger_post_publish_sync(changes)` 方法：
- 遍历 changes，收集有 backing datasource 的 OT rids（CREATE/UPDATE 类型）
- 对每个 OT 调用 ObjectSyncService.sync()
- 用 try/except 包裹，失败不阻塞 publish 返回

### Router（新建 object_instances.py）

- `GET /object-types/{ot_rid}/instances` → ObjectInstanceService.list_by_object_type()
- `GET /object-types/{ot_rid}/instances/{rid}` → ObjectInstanceService.get_by_rid()
- `POST /object-types/{ot_rid}/sync` → 验证 OT 存在 + 有 datasource → ObjectSyncService.sync()
- `GET /object-types/{ot_rid}/sync/status` → SyncJobStorage.get_latest_by_ot()

---

## 9. 前端组件设计

### OT 详情页新增 Instances Tab

修改 `ObjectTypeDetailLayout.tsx` 的 `OT_NAV_ITEMS`：
```typescript
{ key: 'instances', labelKey: 'detail.instances', icon: <TableOutlined /> }
```

### ObjectTypeInstancesPage

```
ObjectTypeInstancesPage
├── SyncStatusBar                    # 同步状态栏
│   ├── StatusBadge + 最后同步时间    # 同步状态
│   ├── SyncStats                    # +N / ~N / -N 统计
│   └── SyncNowButton               # 手动触发同步
└── Table<ObjectInstance>            # 动态列头实例表格
    └── 列头 = OT 的 mapped properties（有 backingColumn 的属性）
```

**关键行为**：
- 表格列头根据 OT Properties（有 backing_column）动态生成
- 分页查询 API，每页 20 条
- 无同步记录时显示 Alert 提示配置 datasource
- Sync Now 按钮点击后 loading，完成刷新列表和状态

### API Hooks（TanStack Query）

```typescript
// src/api/object-instances.ts
useObjectInstances(otRid, page, pageSize)  // GET /instances
useObjectInstance(otRid, rid)               // GET /instances/{rid}
useTriggerSync(otRid)                       // POST /sync (mutation)
useSyncStatus(otRid)                        // GET /sync/status
```

### i18n Keys

```
detail.instances = "Instances" / "实例"
instances.title = "Object Instances" / "对象实例"
instances.noSyncYet = "No sync has been performed yet" / "尚未执行同步"
instances.publishToSync = "Publish your changes to trigger the first sync" / "发布变更以触发首次同步"
instances.configureDatasource = "Configure a backing datasource and publish to sync" / "配置底层数据源并发布以触发同步"
instances.syncNow = "Sync Now" / "立即同步"
instances.lastSynced = "Last synced: {{time}}" / "上次同步：{{time}}"
instances.syncStats = "+{{inserted}} / ~{{updated}} / -{{deleted}}" (共用)
instances.syncStatus.running = "Syncing" / "同步中"
instances.syncStatus.completed = "Synced" / "已同步"
instances.syncStatus.failed = "Failed" / "同步失败"
```

---

## 10. 文件清单

```
apps/server/
├── alembic/versions/0010_add_object_instances_and_sync_jobs.py  # 新建 — 迁移
├── app/domain/object_instance.py                                 # 新建 — Domain 模型
├── app/storage/models.py                                         # 修改 — 新增 ORM 模型
├── app/storage/object_instance_storage.py                        # 新建 — 实例 Storage
├── app/storage/sync_job_storage.py                               # 新建 — SyncJob Storage
├── app/services/object_sync_service.py                           # 新建 — 同步核心逻辑
├── app/services/object_instance_service.py                       # 新建 — 查询逻辑
├── app/services/working_state_service.py                         # 修改 — publish() 触发同步
├── app/routers/object_instances.py                               # 新建 — REST API
├── app/main.py                                                   # 修改 — 注册 router
├── tests/unit/test_object_sync_service.py                        # 新建 — 同步逻辑单测
├── tests/integration/test_object_instance_api.py                 # 新建 — 集成测试
└── openapi.json                                                  # 重新生成

apps/web/src/
├── api/object-instances.ts                                       # 新建 — API hooks
├── pages/object-types/ObjectTypeInstancesPage.tsx                # 新建 — 实例页面
├── pages/object-types/ObjectTypeDetailLayout.tsx                 # 修改 — 追加 tab
├── router.tsx                                                    # 修改 — 新增路由
├── locales/en-US/common.json                                     # 修改 — i18n
├── locales/zh-CN/common.json                                     # 修改 — i18n
└── generated/api.ts                                              # 重新生成
```

---

## 非功能要求

- **性能**: 同步执行上限 10,000 行（MVP 数据量），实例列表查询 < 200ms
- **可靠性**: 同步失败不阻塞 Publish，SyncJob 记录错误信息供排查
- **一致性**: 增量同步在单事务内执行（DELETE + INSERT + UPDATE），保证原子性
- **安全**: 同步逻辑复用现有 Dataset 访问层和 MySQL 连接加密机制

---

## 相关文档

- 架构参考: [docs/architecture/02-domain-model.md], [docs/architecture/06-change-management.md]
- 依赖特性: [features/v0.1.0/003-object-type-crud], [features/v0.1.0/009-working-state], [features/v0.1.0/010-data-connection]
- 版本契约: [features/v0.1.0/release-contract.md]
