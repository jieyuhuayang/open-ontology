# Tasks: Object Instance Sync（对象实例同步）

**关联规格**: [spec.md](./spec.md)
**版本**: v0.1.0

---

## 状态

| 步骤 | 状态 | 备注 |
|------|------|------|
| spec.md | ✅ 已评审 | 2026-03-23 用户确认 |
| tasks.md | ✅ 已拆解 | 2026-03-23 审查通过（1 medium 已修复，2 low 跳过） |
| 实现 | 🔄 进行中 | 11 / 12 完成（T012 前端测试待补） |

---

## 开发模式

**后端 Test-First（测试在前，实现在后）**：后端任务按「测试 → 实现」配对编排，先写测试（红），再写实现（绿）。
基础设施任务（数据库迁移、ORM 模型、配置）无测试配对，单独编号。

**前端 Test-Alongside**：前端实现任务内含测试，或在同 phase 末尾补充测试任务。

**自包含任务**：每个任务内联文件、逻辑、测试上下文，实现阶段不需要回读 spec.md。

---

## Tasks

### Phase 1：基础设施

- [x] **T001**: 数据库迁移 + ORM 模型
  **文件**: `apps/server/alembic/versions/0010_add_object_instances_and_sync_jobs.py`, `apps/server/app/storage/models.py`
  **逻辑**:
  - 创建 `object_instances` 表：rid(PK), object_type_rid(FK→object_types CASCADE), primary_key_value, title_value, properties(JSONB DEFAULT '{}'), source_dataset_rid(FK→datasets SET NULL), source_row_index, data_hash, synced_at, created_at
  - 创建索引：`ix_oi_ot`(object_type_rid), `ix_oi_ot_pk`(object_type_rid, primary_key_value UNIQUE WHERE NOT NULL), `ix_oi_properties`(GIN)
  - 创建 `sync_jobs` 表：rid(PK), object_type_rid(FK→object_types CASCADE), dataset_rid(TEXT, 无外键), status, sync_type, total_rows, inserted/updated/deleted/unchanged_count, error_message, started_at, completed_at, triggered_by
  - 创建索引：`ix_sj_ot`(object_type_rid)
  - 在 `models.py` 新增 `ObjectInstanceModel` 和 `SyncJobModel` ORM 类
  - 运行 `alembic upgrade head` 验证
  - Downgrade 方案：`drop table sync_jobs; drop table object_instances;`（含索引），标准可逆迁移
  **依赖**: 无

- [x] **T002**: Domain 模型 + Storage 层
  **文件**: `apps/server/app/domain/object_instance.py`, `apps/server/app/storage/object_instance_storage.py`, `apps/server/app/storage/sync_job_storage.py`
  **逻辑**:
  - Domain: `ObjectInstance`(DomainModel), `ObjectInstanceListResponse`, `SyncJob`(DomainModel)
  - ObjectInstanceStorage 静态方法：`_to_domain`, `list_by_object_type`(分页+总数), `get_by_rid`, `get_pk_hash_map`(返回 {pk: (rid, hash)}), `bulk_insert`, `bulk_update`, `bulk_delete_by_rids`, `delete_by_object_type`
  - SyncJobStorage 静态方法：`_to_domain`, `create`, `update_status`, `get_latest_by_ot`, `list_by_ot`
  **依赖**: T001

### Phase 2：后端核心逻辑（Test-First）

- [x] **T003**: ObjectSyncService 单元测试
  **文件**: `apps/server/tests/unit/test_object_sync_service.py`
  **逻辑**: 用 mock_db_session mock 数据库，测试同步核心逻辑：
  - `test_sync_incremental_first_time` — 首次同步全部 INSERT（AC-02）
  - `test_sync_incremental_new_rows` — 新增行 INSERT，旧行 unchanged（AC-03）
  - `test_sync_incremental_modified_rows` — hash 变化行 UPDATE（AC-04）
  - `test_sync_incremental_deleted_rows` — 源中消失行 DELETE（AC-05）
  - `test_sync_full_replace_no_primary_key` — 无主键时全量替换（AC-06）
  - `test_sync_failure_records_error` — 异常时 SyncJob 标记 failed（AC-07）
  - `test_compute_hash_deterministic` — 相同属性产生相同 hash
  - `test_compute_hash_order_independent` — key 顺序不影响 hash
  **覆盖 AC**: AC-02, AC-03, AC-04, AC-05, AC-06, AC-07
  **依赖**: T002

- [x] **T004**: ObjectSyncService 实现
  **文件**: `apps/server/app/services/object_sync_service.py`
  **逻辑**:
  - `sync(ot_rid, dataset_rid, triggered_by, has_primary_key, pk_api_name, title_api_name, property_column_map)` — 主入口
  - 创建 SyncJob(running) → 读取源数据 → 映射行 → 判断增量/全量 → 执行 → 更新 SyncJob
  - `_read_source_data(dataset_rid, property_column_map)` — snapshot 从 dataset_rows 读取，live 通过 MySQLImportService.fetch_table_data 读取；按 property_column_map 映射列名→api_name
  - `_compute_hash(properties)` — SHA-256(json.dumps(properties, sort_keys=True, default=str))
  - `_sync_incremental(ot_rid, dataset_rid, mapped_rows)` — 用 get_pk_hash_map 获取现有数据，集合运算求 diff，批量 DELETE/INSERT/UPDATE
  - `_sync_full_replace(ot_rid, dataset_rid, mapped_rows)` — delete_by_object_type + bulk_insert
  - 异常 try/except 包裹，失败更新 SyncJob(failed, error_message)
  **测试**: T003 全部通过
  **覆盖 AC**: AC-02, AC-03, AC-04, AC-05, AC-06, AC-07
  **依赖**: T002

- [x] **T005**: ObjectInstanceService 实现
  **文件**: `apps/server/app/services/object_instance_service.py`
  **逻辑**:
  - `list_by_object_type(ot_rid, page, page_size)` → 委托 ObjectInstanceStorage.list_by_object_type，返回 ObjectInstanceListResponse
  - `get_by_rid(rid)` → 委托 ObjectInstanceStorage.get_by_rid，不存在抛 AppError(OBJECT_INSTANCE_NOT_FOUND, 404)
  **依赖**: T002

### Phase 3：Publish 触发同步

- [ ] **T006**: WorkingStateService 扩展——publish 后触发同步
  **文件**: `apps/server/app/services/working_state_service.py`
  **逻辑**:
  - 在 `publish()` 方法末尾（flush 之后、return record 之前）调用 `_trigger_post_publish_sync(changes)`
  - `_trigger_post_publish_sync(changes)`: 遍历 changes，收集 OT rids（ResourceType.OBJECT_TYPE + CREATE/UPDATE 有 backingDatasource，或 ResourceType.PROPERTY + CREATE/UPDATE 的 objectTypeRid）
  - 对每个 ot_rid：读取 published OT → 检查 backing_datasource → 读取 properties 构建 property_column_map → 调用 ObjectSyncService.sync(triggered_by="system")
  - 整个过程 try/except，失败 logger.exception 不阻塞 publish
  **覆盖 AC**: AC-01
  **依赖**: T004

### Phase 4：后端 API 层（Test-First）

- [ ] **T007**: API 集成测试
  **文件**: `apps/server/tests/integration/test_object_instance_api.py`
  **逻辑**: 使用 seeded_client fixture，测试 4 个 API 端点：
  - `test_list_instances_empty` — 无实例时返回空列表 200（AC-08）
  - `test_list_instances_paginated` — 分页参数正确传递（AC-08）
  - `test_get_instance_success` — 200 返回单个实例（AC-09）
  - `test_get_instance_not_found` — 404 OBJECT_INSTANCE_NOT_FOUND（AC-10）
  - `test_trigger_sync_success` — OT 有 datasource 时 200 返回 SyncJob（AC-11）
  - `test_trigger_sync_no_datasource` — 400 SYNC_NO_DATASOURCE（AC-12）
  - `test_trigger_sync_ot_not_found` — 404 OBJECT_TYPE_NOT_FOUND（AC-13）
  - `test_sync_status_with_job` — 200 返回最新 SyncJob（AC-14）
  - `test_sync_status_no_job` — 200 返回 null（AC-21）
  **覆盖 AC**: AC-08, AC-09, AC-10, AC-11, AC-12, AC-13, AC-14, AC-21
  **依赖**: T005, T006

- [ ] **T008**: API Router 实现 + main.py 注册
  **文件**: `apps/server/app/routers/object_instances.py`, `apps/server/app/main.py`
  **逻辑**:
  - `router = APIRouter(prefix="/api/v1", tags=["object-instances"])`
  - `GET /object-types/{ot_rid}/instances` → ObjectInstanceService.list_by_object_type()
  - `GET /object-types/{ot_rid}/instances/{rid}` → ObjectInstanceService.get_by_rid()
  - `POST /object-types/{ot_rid}/sync` → 验证 OT 存在（404 OBJECT_TYPE_NOT_FOUND）+ 有 datasource（400 SYNC_NO_DATASOURCE）→ 构建 property_column_map → ObjectSyncService.sync(triggered_by="manual")
  - `GET /object-types/{ot_rid}/sync/status` → SyncJobStorage.get_latest_by_ot()
  - 在 `main.py` 导入并 `app.include_router(object_instances.router)`
  **测试**: T007 全部通过
  **覆盖 AC**: AC-08, AC-09, AC-10, AC-11, AC-12, AC-13, AC-14, AC-21
  **依赖**: T005, T006

### Phase 5：OpenAPI + TS 类型重生成

- [ ] **T009**: 重生成 openapi.json + TypeScript 类型
  **文件**: `apps/server/openapi.json`, `apps/web/src/generated/api.ts`
  **逻辑**:
  - 后端：`PYTHONPATH=. uv run python -c "..."` 重生成 openapi.json
  - 前端：`pnpm exec openapi-typescript ../server/openapi.json -o src/generated/api.ts`
  **依赖**: T008

### Phase 6：前端

- [ ] **T010**: API Hooks + i18n
  **文件**: `apps/web/src/api/object-instances.ts`, `apps/web/src/locales/en-US/common.json`, `apps/web/src/locales/zh-CN/common.json`
  **逻辑**:
  - API hooks：`useObjectInstances(otRid, page, pageSize)`, `useObjectInstance(otRid, rid)`, `useTriggerSync(otRid)`, `useSyncStatus(otRid)`
  - Query keys：`instanceKeys = { all, lists, list, details, detail, syncStatus }`
  - useTriggerSync 的 onSuccess 中 invalidate instances lists + syncStatus
  - i18n 新增：`detail.instances`, `instances.title`, `instances.noSyncYet`, `instances.publishToSync`, `instances.configureDatasource`, `instances.syncNow`, `instances.lastSynced`, `instances.syncStats`, `instances.syncStatus.running/completed/failed`（中英文各约 11 个 key）
  **依赖**: T009

- [ ] **T011**: ObjectTypeInstancesPage + 路由 + Tab 注册
  **文件**: `apps/web/src/pages/object-types/ObjectTypeInstancesPage.tsx`, `apps/web/src/pages/object-types/ObjectTypeDetailLayout.tsx`, `apps/web/src/router.tsx`
  **逻辑**:
  - ObjectTypeInstancesPage：
    - 同步状态栏：useSyncStatus → 无记录时 Alert 提示（AC-17）；有记录时 StatusBadge + lastSynced + syncStats（AC-16）
    - Sync Now 按钮：useTriggerSync mutation，无 datasource 时 disabled（AC-20），loading 状态（AC-19）
    - 实例表格：useObjectInstances 分页查询，列头根据 useProperties 动态生成（有 backingColumn 的属性）（AC-18）
    - 分页 Ant Design Table，每页 20 条（AC-08）
  - ObjectTypeDetailLayout.tsx：OT_NAV_ITEMS 新增 `{ key: 'instances', labelKey: 'detail.instances', icon: <TableOutlined /> }`（AC-15），新增 TableOutlined import
  - router.tsx：新增 `{ path: 'instances', element: <ObjectTypeInstancesPage /> }` 在 OT detail children 中，新增 import
  **测试**: 渲染测试 + Sync Now 交互测试（可在同 phase 补充或内含）
  **覆盖 AC**: AC-15, AC-16, AC-17, AC-18, AC-19, AC-20
  **依赖**: T010

- [ ] **T012**: 前端测试
  **文件**: `apps/web/src/pages/object-types/__tests__/ObjectTypeInstancesPage.test.tsx`
  **逻辑**:
  - `test_renders_instances_tab` — 验证 Instances Tab 出现在导航中（AC-15）
  - `test_renders_sync_status_bar` — 有同步记录时显示状态栏（AC-16）
  - `test_renders_empty_state` — 无同步记录时显示提示（AC-17）
  - `test_renders_dynamic_columns` — 表格列头根据 properties 动态生成（AC-18）
  - `test_sync_now_button_triggers_sync` — 点击 Sync Now 触发 mutation（AC-19）
  - `test_sync_now_disabled_no_datasource` — 无 datasource 时按钮 disabled（AC-20）
  **覆盖 AC**: AC-15, AC-16, AC-17, AC-18, AC-19, AC-20
  **依赖**: T011

---

## AC 覆盖矩阵

| AC | 测试任务 | 实现任务 |
|----|---------|---------|
| AC-01 | T007 | T006 |
| AC-02 | T003 | T004 |
| AC-03 | T003 | T004 |
| AC-04 | T003 | T004 |
| AC-05 | T003 | T004 |
| AC-06 | T003 | T004 |
| AC-07 | T003 | T004 |
| AC-08 | T007 | T008 |
| AC-09 | T007 | T008 |
| AC-10 | T007 | T008 |
| AC-11 | T007 | T008 |
| AC-12 | T007 | T008 |
| AC-13 | T007 | T008 |
| AC-14 | T007 | T008 |
| AC-15 | T012 | T011 |
| AC-16 | T012 | T011 |
| AC-17 | T012 | T011 |
| AC-18 | T012 | T011 |
| AC-19 | T012 | T011 |
| AC-20 | T012 | T011 |
| AC-21 | T007 | T008 |

---

## 实际偏差记录

> 完成后，在此记录实现与 spec.md 的偏差，供后续参考。

- （暂无）
