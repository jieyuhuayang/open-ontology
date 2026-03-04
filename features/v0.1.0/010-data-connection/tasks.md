# Tasks: 010 Data Connection（数据连接）— 重构

**关联规范**: [spec.md](./spec.md)
**技术方案**: [design.md](./design.md)
**版本**: v0.1.0

---

## 状态

| 步骤 | 状态 | 备注 |
|------|------|------|
| spec.md | ✅ 已评审 | 用户确认"可以写 design 了" |
| design.md | ✅ 已评审 | 自动审查通过 |
| tasks.md | ✅ 已拆解 | 自动审查通过 |
| 实现 | 🔲 未开始 | 0 / 10 完成 |

---

## 开发模式

本次为已有功能的**重构补充**，后端新增逻辑少（主要是 datasetCount + GET 单连接），前端修改多。
采用 Test-Implementation 配对模式。

---

## Tasks

### 后端补充

- [ ] **T001**: 后端 — Domain + Storage + Service 补充
  - 文件:
    - `apps/server/app/domain/mysql_connection.py` — `MySQLConnection` 增加 `dataset_count: int = 0`
    - `apps/server/app/storage/dataset_storage.py` — 新增 `count_by_connection_rids()` 方法
    - `apps/server/app/services/mysql_import_service.py` — `list_connections` 填充 dataset_count；新增 `get_connection` 方法
    - `apps/server/app/routers/mysql_connections.py` — 新增 `GET /{rid}` 端点
  - 覆盖 AC: AC-CM04, AC-CM09, AC-CM14
  - 依赖: 无

- [ ] **T002**: 后端测试 — 覆盖新增逻辑
  - 文件:
    - `apps/server/tests/unit/test_mysql_import_service.py` — 新增 `test_list_connections_with_dataset_count`, `test_get_connection_success`, `test_get_connection_not_found`
    - `apps/server/tests/integration/test_mysql_connections.py` — 新增 `test_get_connection_endpoint`, `test_list_connections_has_dataset_count`
  - 覆盖 AC: AC-CM04, AC-CM09, AC-CM14
  - 依赖: T001
  - 验证: `cd apps/server && uv run pytest tests/ -v -k "dataset_count or get_connection"`

- [ ] **T003**: openapi.json 重新生成 + TS 类型重新生成
  - 文件:
    - `apps/server/openapi.json` — 重新生成
    - `apps/web/src/generated/api.ts` — 重新生成
  - 依赖: T001
  - 验证: `diff` 确认 `datasetCount` 和 `GET /mysql-connections/{rid}` 出现在 openapi.json 中

### 前端 — i18n + Store 更新

- [ ] **T004**: i18n 新增键 + Store 更新
  - 文件:
    - `apps/web/src/locales/en-US.json` — 新增 i18n 键
    - `apps/web/src/locales/zh-CN.json` — 新增 i18n 键
    - `apps/web/src/stores/data-connection-store.ts` — 新增 `detailConnectionRid`、`openModal` 增加 `'newConnection'` 类型
    - `apps/web/src/api/mysql-connections.ts` — 新增 `useMySQLConnection` hook
  - 覆盖 AC: AC-CM08, AC-CM10, AC-DM08
  - 依赖: T003

### 前端 — ConnectionsTab 重构

- [ ] **T005**: ConnectionsTab 重构
  - 文件: `apps/web/src/pages/data-connection/components/ConnectionsTab.tsx`
  - 变更:
    - 移除顶部 "Import from MySQL" 和 "Upload File" 按钮（AD-14）
    - 新增 "New Connection" 按钮 → 打开 NewConnectionModal（AC-CM08）
    - 新增列：Type（固定 "MySQL"）、Dataset 数（`datasetCount`，AC-CM09）
    - 状态列：默认显示 `untested` Tag（AC-CM13）
    - 名称列：可点击，`onClick` 设置 `detailConnectionRid`（AC-CM10）
  - 覆盖 AC: AC-CM08, AC-CM09, AC-CM10, AC-CM13
  - 依赖: T004

### 前端 — NewConnectionModal（新建）

- [ ] **T006**: NewConnectionModal 新建
  - 文件: `apps/web/src/pages/data-connection/components/NewConnectionModal.tsx`
  - 内容: 从 MySQLImportWizard Step 1 表单抽取为独立组件。包含：连接配置表单 + Test Connection 按钮 + Save 按钮。保存成功后关闭弹窗，invalidate connections query。
  - 覆盖 AC: AC-CM01, AC-CM02, AC-CM08
  - 依赖: T004

### 前端 — ConnectionDetailDrawer（新建）

- [ ] **T007**: ConnectionDetailDrawer 新建
  - 文件: `apps/web/src/pages/data-connection/components/ConnectionDetailDrawer.tsx`
  - 内容: 宽 Drawer（width=900+），展示 Schema 浏览器。复用 `useMySQLTables`、`useMySQLTableColumns`、`useMySQLTablePreview`。左右分栏：表列表（带搜索）+ 选中表后列结构 & 数据预览。
  - 覆盖 AC: AC-CM10, AC-CM11, AC-CM12
  - 依赖: T004

### 前端 — DatasetsTab 重构

- [ ] **T008**: DatasetsTab 重构
  - 文件: `apps/web/src/pages/data-connection/components/DatasetsTab.tsx`
  - 变更:
    - 新增 "Import Dataset" Dropdown.Button（菜单项：From MySQL / Upload File），AC-DM08
    - 非 in_use 时显示 `<Tag>Available</Tag>`，AC-DM01
  - 覆盖 AC: AC-DM01, AC-DM08
  - 依赖: T004

### 前端 — MySQLImportWizard 微调

- [ ] **T009**: MySQLImportWizard Step 1 微调
  - 文件: `apps/web/src/pages/data-connection/components/MySQLImportWizard.tsx`
  - 变更: `handleSelectExisting` 改为 `form.setFieldsValue({ name, host, port, databaseName, username, sslEnabled })`，不直接 `setStep(1)`；密码字段不填充；用户可修改后再点"下一步"。
  - 覆盖 AC: AC-MI10
  - 依赖: T004

### 前端 — 集成 + DataConnectionPage 更新

- [ ] **T010**: DataConnectionPage 集成 + 前端验证
  - 文件: `apps/web/src/pages/data-connection/DataConnectionPage.tsx`
  - 变更: 引入 NewConnectionModal 和 ConnectionDetailDrawer 组件
  - 验证:
    - `cd apps/web && npx tsc --noEmit` 零错误
    - `cd apps/web && pnpm test --run` 无新增失败
  - 覆盖 AC: AC-CM08, AC-CM10, AC-DM08
  - 依赖: T005, T006, T007, T008, T009

---

## AC 覆盖追溯矩阵

| AC | 覆盖任务 |
|----|---------|
| AC-CM01 | T001, T006 |
| AC-CM02 | T006 |
| AC-CM04 | T001, T002 |
| AC-CM08 | T005, T006, T010 |
| AC-CM09 | T001, T002, T005 |
| AC-CM10 | T005, T007, T010 |
| AC-CM11 | T007 |
| AC-CM12 | T007 |
| AC-CM13 | T005 |
| AC-CM14 | T001, T002 |
| AC-MI10 | T009 |
| AC-DM01 | T008 |
| AC-DM08 | T008, T010 |

---

## 实际偏差记录

> 完成后，在此记录实现与 design.md 的偏差，供后续参考。
