# Tasks: 010 Data Connection（数据连接）— Live Connection 补充

**关联规范**: [spec.md](./spec.md)
**版本**: v0.1.0

---

## 状态

| 步骤 | 状态 | 备注 |
|------|------|------|
| spec.md | ✅ 已评审 | 用户确认通过，含 Live Connection 模式 |
| tasks.md | ✅ 已审查 | 自动审查 PASS_WITH_NOTES，已修复 2 个 MEDIUM |
| 实现 | 🔲 未开始 | 0 / 14 完成 |

---

## 背景

Snapshot 模式前后端已完整实现。本轮任务聚焦 **Live Connection 模式补充**，核心变更：

1. `datasets` 表新增 `mode` 字段（`snapshot` / `live`）和 `connection_rid` 引用
2. Live Dataset 注册流程（仅写 schema 元数据，不复制数据）
3. Live Dataset 数据预览（实时查询外部 MySQL）
4. 连接删除保护（有 in-use Live Dataset 时阻止）+ 级联（标记 `disconnected`）
5. 前端 LiveConnectionWizard + DatasetsTab/ConnectionsTab 适配

---

## Tasks

### T001: DB Migration — datasets 表增加 mode 和 connection_rid

- **文件**:
  - `apps/server/alembic/versions/XXXX_add_dataset_mode_and_connection_rid.py` — 新建
- **逻辑**:
  - `datasets` 表新增列 `mode TEXT NOT NULL DEFAULT 'snapshot'`（值域：`snapshot` / `live`）
  - `datasets` 表新增列 `connection_rid TEXT`（可空，Live Dataset 引用 mysql_connections.rid）
  - `datasets` 表新增列 `source_table TEXT`（可空，Live Dataset 记录源表名）
  - 现有 Snapshot Dataset 自动回填 `mode='snapshot'`（DEFAULT 已处理）
  - 新增索引 `idx_datasets_connection_rid` on `connection_rid`
  - 新增索引 `idx_datasets_mode` on `mode`
- **覆盖 AC**: KD-6（复用同一表 + mode 字段）
- **依赖**: 无

### T002: Domain + Storage 模型更新

- **文件**:
  - `apps/server/app/domain/dataset.py` — 修改
    - `Dataset` 增加 `mode: str`（`"snapshot"` / `"live"`）、`connection_rid: str | None`、`source_table: str | None`
    - `DatasetListItem` 增加 `mode: str`
    - 新增 `LiveDatasetCreateRequest(BaseModel)`: `name`, `connection_rid`, `source_table`, `selected_columns` (list[str])
  - `apps/server/app/storage/models.py` — 修改
    - `DatasetModel` 增加 `mode`, `connection_rid`, `source_table` 列
  - `apps/server/app/storage/dataset_storage.py` — 修改
    - `create()` 支持无 rows 创建（Live Dataset 场景）
    - 新增 `list_live_by_connection_rid(connection_rid)` → 返回该连接关联的所有 Live Dataset
    - 新增 `mark_disconnected(connection_rid)` → 批量将指定连接的 Live Dataset status 设为 `disconnected`
    - `count_by_connection_rids()` 更新：同时计入 Snapshot 和 Live Dataset
- **覆盖 AC**: AC-CM09, AC-LC06, AC-LC11, KD-6
- **依赖**: T001

### T003: Service — Live Dataset 注册 + 连接删除保护/级联

- **文件**:
  - `apps/server/app/services/mysql_import_service.py` — 修改
    - 新增 `register_live_dataset(request: LiveDatasetCreateRequest, ontology_rid: str)`:
      - **同步操作**（不使用 ImportTask 异步模型）：Live Dataset 仅写 schema 元数据，不复制行数据，60s 超时内完成
      1. 校验 connection_rid 存在 + 连接可用
      2. 连接外部 MySQL，提取指定表的列元数据（复用 `get_table_columns`，60s 超时）
      3. 按 `selected_columns` 过滤列（主键列强制保留）
      4. 调用 `dataset_storage.create()` 创建 mode=live 的 Dataset（无 rows，status=ready）
      5. 更新 connection 的 `last_used_at`
      6. 同步返回创建的 Dataset（HTTP 201）
    - 修改 `delete_connection(rid)`:
      1. 查询该连接关联的 Live Dataset 中是否有 in-use 的（调用 DatasetService 的 in_use 计算）
      2. 若有 in-use Live Dataset → 抛出 `CONNECTION_HAS_IN_USE_LIVE_DATASETS` (HTTP 409)
      3. 若无 → 调用 `dataset_storage.mark_disconnected(rid)` 标记 Live Dataset 为 `disconnected`
      4. 删除连接
  - `apps/server/app/services/dataset_service.py` — 修改
    - `get_preview()` 增加 Live 模式分支:
      1. 若 dataset.mode == 'live' 且 dataset.connection_rid 存在:
         - 从 mysql_connections 获取连接配置，解密密码
         - 实时连接外部 MySQL，查询 `SELECT * FROM <source_table> LIMIT <limit>`
         - 返回预览数据
      2. 若 dataset.mode == 'live' 且 status == 'disconnected':
         - 抛出 `LIVE_DATASET_DISCONNECTED` 错误
      3. 若外部 MySQL 连接失败:
         - 抛出 `LIVE_DATASET_SOURCE_UNAVAILABLE` 错误（降级：schema 仍可查看）
- **覆盖 AC**: AC-CM06, AC-CM15, AC-LC06, AC-LC09, AC-LC10, AC-LC11, AC-DM05
- **依赖**: T002

### T004: Router — Live Dataset 注册端点 + 连接删除更新

- **文件**:
  - `apps/server/app/routers/imports.py` — 修改
    - 新增 `POST /api/v1/datasets/register/live` → 注册 Live Dataset (HTTP 201)
      - Request:
        ```json
        {
          "connectionRid": "ri.mysql-connection.xxx",
          "tableName": "orders",
          "datasetName": "Orders Live",
          "selectedColumns": ["id", "customer_id", "total", "created_at"]
        }
        ```
      - Response (201):
        ```json
        {
          "rid": "ri.dataset.xxx",
          "name": "Orders Live",
          "mode": "live",
          "sourceType": "mysql",
          "connectionRid": "ri.mysql-connection.xxx",
          "sourceTable": "orders",
          "columnCount": 4,
          "rowCount": null,
          "status": "ready",
          "importedAt": "2026-03-14T10:00:00Z"
        }
        ```
  - `apps/server/app/routers/mysql_connections.py` — 修改（如需）
    - `DELETE /{rid}` 返回 HTTP 409 + `CONNECTION_HAS_IN_USE_LIVE_DATASETS` 场景
  - `apps/server/app/routers/datasets.py` — 修改（如需）
    - `GET /datasets/{rid}/preview` 增加 Live 模式降级错误响应
- **覆盖 AC**: AC-CM15, AC-LC06, AC-LC08, AC-DM05
- **依赖**: T003

### T005: 后端单元测试 — Live Connection 逻辑

- **文件**:
  - `apps/server/tests/unit/test_mysql_import_service.py` — 修改
    - `test_register_live_dataset_success` — 正常注册 Live Dataset
    - `test_register_live_dataset_connection_not_found` — 连接不存在
    - `test_delete_connection_with_in_use_live_dataset` — 阻止删除（AC-CM15）
    - `test_delete_connection_cascade_disconnected` — 级联标记 disconnected（AC-CM06）
    - `test_delete_connection_snapshot_unaffected` — Snapshot Dataset 不受影响
  - `apps/server/tests/unit/test_dataset_service.py` — 修改
    - `test_preview_live_dataset_success` — Live Dataset 实时预览
    - `test_preview_live_dataset_disconnected` — disconnected 状态预览失败
    - `test_preview_live_dataset_source_unavailable` — 外部不可用降级
- **覆盖 AC**: AC-CM06, AC-CM15, AC-LC06, AC-LC10, AC-LC11, AC-DM05
- **依赖**: T003
- **验证**: `cd apps/server && uv run pytest tests/unit/ -v -k "live"`

### T006: 后端集成测试 — Live Connection API

- **文件**:
  - `apps/server/tests/integration/test_live_connection_api.py` — 新建
    - `test_register_live_dataset` — POST /datasets/register/live → 201（AC-LC06）
    - `test_register_live_dataset_duplicate_table` — 同一表注册两次（AC-LC12）
    - `test_delete_connection_blocks_with_in_use_live` — DELETE 连接 → 409（AC-CM15）
    - `test_delete_connection_cascades_disconnected` — DELETE 连接 → Live Dataset disconnected（AC-CM06）
    - `test_live_dataset_in_list` — GET /datasets 列表中显示 mode=live（AC-DM01）
    - `test_delete_live_dataset` — DELETE Live Dataset → 仅删除元数据（AC-DM07）
  - `apps/server/tests/integration/test_dataset_api.py` — 修改
    - 现有测试不受影响（Snapshot 行为不变）
- **覆盖 AC**: AC-CM06, AC-CM15, AC-LC06, AC-LC12, AC-DM01, AC-DM07
- **依赖**: T004
- **验证**: `cd apps/server && uv run pytest tests/integration/test_live_connection_api.py -v`

### T007: openapi.json + TS 类型重新生成

- **文件**:
  - `apps/server/openapi.json` — 重新生成
  - `apps/web/src/generated/api.ts` — 重新生成
- **验证**: 确认新增内容出现在 openapi.json 中:
  - `POST /datasets/register/live` 端点
  - Dataset schema 含 `mode`, `connectionRid`, `sourceTable` 字段
  - `CONNECTION_HAS_IN_USE_LIVE_DATASETS` 错误码
- **依赖**: T004

### T008: 前端 — i18n + Store + API hooks 更新

- **文件**:
  - `apps/web/src/locales/en-US/common.json` — 修改：新增 Live Connection 相关 i18n 键
  - `apps/web/src/locales/zh-CN/common.json` — 修改：新增 Live Connection 相关 i18n 键
    - `liveConnection.title`, `liveConnection.banner`, `liveConnection.testRequired`
    - `liveConnection.noConnections`, `liveConnection.confirmRegister`
    - `liveConnection.resultSummary`, `liveConnection.disconnectedTip`
    - `dataset.modeLive`, `dataset.modeSnapshot`, `dataset.liveLabel`
    - `dataConnection.connectToMySQL`
    - `mysqlConnection.deleteBlockedByLive`
  - `apps/web/src/stores/data-connection-store.ts` — 修改
    - `ModalType` 增加 `'liveConnection'`
  - `apps/web/src/api/imports.ts` — 修改
    - 新增 `useRegisterLiveDataset()` mutation hook → POST /datasets/register/live
- **覆盖 AC**: AC-LC01, AC-LC03, AC-LC07, AC-LC11, AC-DM10
- **依赖**: T007

### T009: 前端 — LiveConnectionWizard 组件（3 步）

- **文件**:
  - `apps/web/src/pages/data-connection/components/LiveConnectionWizard.tsx` — 新建
- **内容**:
  - **Step L1（选择连接）**:
    - 顶部"实时连接模式"Banner（Alert 组件，type=info）
    - 连接下拉选择器（复用 `useMySQLConnections`）
    - 无可用连接时显示引导文案 + 跳转链接（AC-LC03）
    - 选中连接后展示只读预览（连接名称、Host、Database）（AC-LC01）
    - "测试连接"按钮 — **必须测试成功**后"下一步"才可用（AC-LC02）
  - **Step L2（选择表并配置）**:
    - 复用 `useMySQLTables`, `useMySQLTableColumns`, `useMySQLTablePreview` hooks
    - 左右分栏：表列表（带搜索 + `已有快照`/`已有实时连接` 标签）+ 表详情（列结构 + 数据预览）
    - 配置项：Dataset 名称 + 列选择（主键不可取消）（AC-LC05, AC-LC06）
    - 底部提示文案（实时连接模式说明）
    - "确认注册"按钮
  - **Step L3（注册结果）**:
    - 成功：摘要（列数、连接名称、源表名）+ "完成"按钮（AC-LC07）
    - 失败：错误信息 + "重试"按钮（回到 Step L2）+ "取消"按钮（AC-LC08）
- **覆盖 AC**: AC-LC01, AC-LC02, AC-LC03, AC-LC04, AC-LC05, AC-LC06, AC-LC07, AC-LC08, AC-LC12
- **依赖**: T008

### T010: 前端 — DatasetsTab 适配 Live Connection

- **文件**:
  - `apps/web/src/pages/data-connection/components/DatasetsTab.tsx` — 修改
- **变更**:
  - 表格新增"模式"列：`Snapshot` / `Live` Tag（AC-DM01）
  - 行数列：Snapshot 显示数字，Live 显示 `Live` 标签（AC-DM01）
  - "Import Dataset" 下拉菜单增加第三项 "Connect to MySQL（实时连接）"（AC-DM10）
  - 点击"Connect to MySQL" → `setOpenModal('liveConnection')`
  - 删除操作：Live Dataset 删除提示文案差异化（AC-DM07：仅删除元数据）
  - `disconnected` 状态 Live Dataset 在列表中显示警告图标
  - 预览 Drawer：Live 模式增加降级提示处理（AC-DM05, AC-LC10）
- **覆盖 AC**: AC-DM01, AC-DM05, AC-DM07, AC-DM10, AC-LC10
- **依赖**: T008

### T011: 前端 — ConnectionsTab 适配连接删除保护

- **文件**:
  - `apps/web/src/pages/data-connection/components/ConnectionsTab.tsx` — 修改
- **变更**:
  - 删除连接时：若后端返回 409 `CONNECTION_HAS_IN_USE_LIVE_DATASETS`，显示错误提示（AC-CM15）
  - 删除确认弹窗增加提示：若该连接有关联的 Live Dataset，警告删除后 Live Dataset 将变为 disconnected（AC-CM06）
- **覆盖 AC**: AC-CM06, AC-CM15
- **依赖**: T008

### T012: 前端 — DataConnectionPage 集成 LiveConnectionWizard

- **文件**:
  - `apps/web/src/pages/data-connection/DataConnectionPage.tsx` — 修改
- **变更**:
  - 引入 `LiveConnectionWizard` 组件
  - 当 `openModal === 'liveConnection'` 时渲染 LiveConnectionWizard
- **覆盖 AC**: AC-DM10, AC-LC01
- **依赖**: T009, T010, T011

### T013: 前端测试 — LiveConnectionWizard

- **文件**:
  - `apps/web/src/pages/data-connection/__tests__/LiveConnectionWizard.test.tsx` — 新建
- **测试用例**:
  - 渲染 Step L1，显示 Banner 和连接下拉
  - 无连接时显示引导文案
  - 选择连接后显示只读预览
  - 测试连接成功后"下一步"可用
  - 注册成功后显示摘要
- **覆盖 AC**: AC-LC01, AC-LC02, AC-LC03, AC-LC07
- **依赖**: T009

### T014: 全量验证

- **验证步骤**:
  - `cd apps/server && uv run pytest tests/ -v` — 所有后端测试通过
  - `cd apps/web && npx tsc --noEmit` — TypeScript 零错误
  - `cd apps/web && pnpm test --run` — 所有前端测试通过
- **覆盖 AC**: 全量回归
- **依赖**: T012, T013

---

## AC 覆盖追溯矩阵

### 连接管理（Connection Management）

| AC | 覆盖任务 | 说明 |
|----|---------|------|
| AC-CM01 ~ CM05 | 已实现 | Snapshot 阶段已完成 |
| AC-CM06 | T003, T006, T011 | 连接删除级联 — Live Dataset 标记 disconnected |
| AC-CM07 ~ CM14 | 已实现 | Snapshot 阶段已完成 |
| AC-CM15 | T003, T004, T006, T011 | 连接删除保护 — in-use Live Dataset |

### MySQL 快照导入（MySQL Snapshot Import）

| AC | 覆盖任务 | 说明 |
|----|---------|------|
| AC-MI01 ~ MI09 | 已实现 | Snapshot 阶段已完成 |
| AC-MI10 | 已实现 | 向导 Step 0 已是下拉选择器 |

### MySQL 实时连接（MySQL Live Connection）

| AC | 覆盖任务 |
|----|---------|
| AC-LC01 | T008, T009 |
| AC-LC02 | T009 |
| AC-LC03 | T008, T009 |
| AC-LC04 | T009 |
| AC-LC05 | T009 |
| AC-LC06 | T002, T003, T004, T006, T009 |
| AC-LC07 | T008, T009 |
| AC-LC08 | T009 |
| AC-LC09 | T003, T010 |
| AC-LC10 | T003, T010 |
| AC-LC11 | T002, T003, T010 |
| AC-LC12 | T006, T009 |

### 文件上传（File Upload）

| AC | 覆盖任务 | 说明 |
|----|---------|------|
| AC-FU01 ~ FU06 | 已实现 | Snapshot 阶段已完成（FU05 Sheet 选择已支持） |

### Dataset 管理（Dataset Management）

| AC | 覆盖任务 |
|----|---------|
| AC-DM01 | T002, T010 |
| AC-DM02 ~ DM04 | 已实现 |
| AC-DM05 | T003, T010 |
| AC-DM06 | 已实现 |
| AC-DM07 | T002, T006, T010 |
| AC-DM08 | 已实现 |
| AC-DM09 | 已实现 |
| AC-DM10 | T008, T010, T012 |

### 导航与集成（Navigation & Integration）

| AC | 覆盖任务 | 说明 |
|----|---------|------|
| AC-NV01 | 已实现 | |
| AC-NV02 | T002 | Dataset 列表 API 自动包含 mode 字段 |

---

## 任务依赖图

```
T001 (Migration)
  └── T002 (Domain + Storage)
        └── T003 (Service: Live Registration + Deletion Protection)
              └── T004 (Router)
                    ├── T005 (Unit Tests)
                    ├── T006 (Integration Tests)
                    └── T007 (openapi.json + TS types)
                          └── T008 (i18n + Store + API hooks)
                                ├── T009 (LiveConnectionWizard)
                                ├── T010 (DatasetsTab 适配)
                                ├── T011 (ConnectionsTab 适配)
                                └── T012 (DataConnectionPage 集成) ← T009, T010, T011
                                      └── T013 (Frontend Tests)
                                            └── T014 (全量验证)
```
