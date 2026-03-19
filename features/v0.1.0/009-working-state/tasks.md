# Tasks: Change Management（变更管理）

**关联规范**: [spec.md](./spec.md)
**版本**: v0.1.0

---

## 状态

| 步骤 | 状态 | 备注 |
|------|------|------|
| spec.md | ✅ 已评审 | 28 条 AC，用户确认 2026-03-19 |
| tasks.md | 🔲 草稿 | 拆解完成后改为 ✅ 已拆解 |
| 实现 | 🔲 未开始 | 0 / 16 完成 |

---

## 开发模式

**后端 Test-First**：测试 → 实现配对编排。
**前端 Test-Alongside**：每个前端实现任务内含测试，测试文件显式列入文件清单。
**自包含任务**：每个任务内联文件、逻辑、测试上下文。

---

## Phase 1: 后端 — Storage + Domain

### T01: ChangeRecordStorage 新建 + HistoryListResponse 模型

- [ ] **T01**
- 文件:
  - `apps/server/app/storage/change_record_storage.py` — 新建
  - `apps/server/app/domain/working_state.py` — 修改
- 内容:
  - **ChangeRecordStorage** 静态方法：
    - `list_by_ontology(session, ontology_rid, page, page_size) → tuple[list[ChangeRecordModel], int]`
      - `SELECT * FROM change_records WHERE ontology_rid = :rid ORDER BY version DESC LIMIT :limit OFFSET :offset`
      - 同时执行 `SELECT count(*)` 返回总数
    - `get_by_version(session, ontology_rid, version) → ChangeRecordModel | None`
      - `SELECT * FROM change_records WHERE ontology_rid = :rid AND version = :version`
  - **HistoryListResponse** 新增到 `working_state.py`：
    ```python
    class HistoryListResponse(DomainModel):
        items: list[ChangeRecord]
        total: int
        page: int
        page_size: int
    ```
- 依赖: 无
- 覆盖 AC: 无（基础设施）

---

## Phase 2: 后端 — Service + Router（Test-First）

### T02: History + Discard Single 单元测试

- [ ] **T02**
- 文件:
  - `apps/server/tests/unit/test_history_service.py` — 新建
- 内容:
  - **TestListHistory**（3 个）：
    - `test_list_history_returns_paginated` — 返回分页列表，version 降序 → AC-19
    - `test_list_history_empty` — 无记录返回空列表 → AC-22
    - `test_list_history_page_out_of_range` — 超范围页返回空列表 → AC-22
  - **TestGetHistoryVersion**（2 个）：
    - `test_get_history_version_success` — 返回单个 ChangeRecord → AC-20
    - `test_get_history_version_not_found` — 抛出 `CHANGE_RECORD_NOT_FOUND` 404 → AC-21
  - **TestDiscardSingleChange**（4 个）：
    - `test_discard_single_change_success` — 移除指定 change，更新 changes + last_modified_at → AC-26
    - `test_discard_single_change_last_one_deletes_ws` — 移除最后一条后自动删除 WorkingState → AC-26
    - `test_discard_single_change_not_found` — change_id 不存在抛 `CHANGE_NOT_FOUND` 404 → AC-27
    - `test_discard_single_change_no_working_state` — WorkingState 不存在抛 `WORKING_STATE_NOT_FOUND` 404 → AC-27
  - Mock: `mock_db_session`，mock `ChangeRecordStorage` 和 `WorkingStateStorage` 方法
- 依赖: T01（ChangeRecordStorage 已定义）
- 覆盖 AC: AC-19, AC-20, AC-21, AC-22, AC-26, AC-27

---

### T03: Service 层实现 — list_history, get_history_version, discard_single_change

- [ ] **T03**
- 文件:
  - `apps/server/app/services/working_state_service.py` — 修改，新增 3 个方法
- 内容:
  - **`async def list_history(self, ontology_rid, page=1, page_size=20) → HistoryListResponse`**
    - 调用 `ChangeRecordStorage.list_by_ontology(self.session, ontology_rid, page, page_size)`
    - 将 ORM 模型转为 domain `ChangeRecord`，构建 `HistoryListResponse`
  - **`async def get_history_version(self, ontology_rid, version) → ChangeRecord`**
    - 调用 `ChangeRecordStorage.get_by_version(self.session, ontology_rid, version)`
    - 不存在抛 `AppError(code="CHANGE_RECORD_NOT_FOUND", status_code=404)`
  - **`async def discard_single_change(self, ontology_rid, change_id) → None`**
    - 调用 `self.get_working_state(ontology_rid)` 获取 WorkingState（不存在抛 `WORKING_STATE_NOT_FOUND`）
    - 从 `ws.changes` 中查找 `change.id == change_id`（不存在抛 `CHANGE_NOT_FOUND`）
    - 移除匹配项
    - 若 `len(remaining) == 0` → `WorkingStateStorage.delete(session, ws.rid)`
    - 否则 → `WorkingStateStorage.update_changes(session, ws.rid, remaining, now())`
  - 导入 `ChangeRecordStorage`、`HistoryListResponse`
- 测试: T02 全部通过
- 依赖: T01, T02
- 覆盖 AC: AC-19, AC-20, AC-21, AC-22, AC-26, AC-27

---

### T04: History + Discard Single API 集成测试

- [ ] **T04**
- 文件:
  - `apps/server/tests/integration/test_history_api.py` — 新建
- 内容:
  - **History API 测试**（4 个）：
    - `test_list_history_empty` — 无记录返回 200 空列表 → AC-22
    - `test_list_history_after_publish` — 先 publish 再查 history，返回 1 条 ChangeRecord → AC-19
    - `test_get_history_version_success` — 获取 publish 后的 version 返回 200 → AC-20
    - `test_get_history_version_not_found` — 不存在的 version 返回 404 CHANGE_RECORD_NOT_FOUND → AC-21
  - **Discard Single 测试**（3 个）：
    - `test_discard_single_change_success` — 创建 OT（产生 change）→ DELETE change → **204** → AC-26
    - `test_discard_single_change_last_deletes_ws` — discard 最后一条后 GET /working-state 返回 404 → AC-26
    - `test_discard_single_change_not_found` — 不存在的 changeId 返回 404 CHANGE_NOT_FOUND → AC-27
  - 使用 `seeded_client` fixture，每个测试前创建 ontology + object type（触发 WorkingState）
- 依赖: T03（Service 实现）
- 覆盖 AC: AC-19, AC-20, AC-21, AC-22, AC-26, AC-27

---

### T05: Router 层实现 — 3 个新端点 + openapi.json 重生成

- [ ] **T05**
- 文件:
  - `apps/server/app/routers/ontology.py` — 修改，新增 3 个端点
  - `apps/server/openapi.json` — 重新生成
- 内容:
  - **`GET /ontologies/{rid}/history`**
    - Query params: `page: int = Query(1, ge=1)`, `page_size: int = Query(20, ge=1, le=100, alias="pageSize")`
    - 返回 `HistoryListResponse`（response_model）
    - 委托 `service.list_history(rid, page, page_size)`
  - **`GET /ontologies/{rid}/history/{version}`**
    - Path param: `version: int`
    - 返回 `ChangeRecord`（response_model）
    - 委托 `service.get_history_version(rid, version)`
  - **`DELETE /ontologies/{rid}/working-state/changes/{change_id}`**
    - Path param: `change_id: str`
    - 返回 `Response(status_code=204)`
    - 委托 `service.discard_single_change(rid, change_id)`
  - 重新生成 openapi.json：`cd apps/server && PYTHONPATH=. uv run python -c "import json; from app.main import app; ..."`
- 测试: T04 全部通过
- 依赖: T03, T04
- 覆盖 AC: AC-19, AC-20, AC-21, AC-22, AC-26, AC-27

---

## Phase 3: 前端 — 类型 + API Hooks + Store + i18n

### T06: OpenAPI 类型重生成 + API Hooks

- [ ] **T06**
- 文件:
  - `apps/web/src/generated/api.ts` — 自动生成
  - `apps/web/src/api/working-state.ts` — 新建
- 内容:
  - 执行类型生成管线：`cd apps/web && pnpm run generate:api`
  - **`working-state.ts`** hooks:
    - `useWorkingState(ontologyRid)` — `GET /working-state`，`queryKey: ['working-state', ontologyRid]`
    - `usePublish(ontologyRid)` — `POST /save` mutation，onSuccess invalidate `['working-state']` + `['object-types']` + `['link-types']` + `['properties']` + `['history']`
    - `useDiscardAll(ontologyRid)` — `DELETE /working-state` mutation，onSuccess invalidate 同上
    - `useDiscardChange(ontologyRid)` — `DELETE /working-state/changes/{changeId}` mutation，onSuccess invalidate `['working-state']`
  - 确认 TypeScript 编译通过：`cd apps/web && pnpm tsc --noEmit`
- 依赖: T05（后端 API + openapi.json 就绪）
- 覆盖 AC: 无（基础设施）

---

### T07: History Hooks + SaveDialog Store + i18n Keys

- [ ] **T07**
- 文件:
  - `apps/web/src/api/history.ts` — 新建
  - `apps/web/src/stores/save-dialog-store.ts` — 新建
- 内容:
  - **`history.ts`** hooks:
    - `useHistory(ontologyRid, page, pageSize)` — `GET /history`，`queryKey: ['history', ontologyRid, page, pageSize]`
    - `useHistoryVersion(ontologyRid, version)` — `GET /history/{version}`，`queryKey: ['history', ontologyRid, version]`，`enabled: !!version`
  - **save-dialog-store**:
    ```typescript
    interface SaveDialogState {
      open: boolean;
      activeTab: 'changes' | 'errors';
      openDialog: (tab?: 'changes' | 'errors') => void;
      closeDialog: () => void;
      setActiveTab: (tab: 'changes' | 'errors') => void;
    }
    ```
- 依赖: T06
- 覆盖 AC: 无（基础设施）

---

### T08: i18n Keys + Store 测试

- [ ] **T08**
- 文件:
  - `apps/web/src/locales/en-US/common.json` — 修改
  - `apps/web/src/locales/zh-CN/common.json` — 修改
  - `apps/web/src/stores/__tests__/save-dialog-store.test.ts` — 新建
- 内容:
  - **i18n keys**（`changeManagement` 命名空间）:
    - `save`, `discard`, `discardAll`, `reviewEdits`, `changes`, `errors`
    - `saveSuccess`, `saveError`, `discardConfirm`, `discardConfirmMessage`
    - `unsavedChanges`, `unsavedChangesCount`
    - `noErrors`, `openResource`
    - `history`, `historyEmpty`, `version`, `changesCount`
    - `noHistory`, `created`, `modified`, `deleted`
    - `objectTypes`, `properties`, `linkTypes`（分组标题）
  - **save-dialog-store 测试**：
    - `test openDialog sets open=true and activeTab='changes'`
    - `test openDialog('errors') sets activeTab='errors'`
    - `test closeDialog sets open=false`
    - `test setActiveTab updates tab`
- 依赖: T07（store 已定义）
- 覆盖 AC: AC-04（store 控制 tab 切换）

---

## Phase 4: 前端 — ChangeActions + SaveDialog

### T09: ChangeActions 组件 + 测试（TopBar Portal: Save + Discard 按钮）

- [ ] **T09**
- 文件:
  - `apps/web/src/components/ChangeActions.tsx` — 新建
  - `apps/web/src/components/__tests__/ChangeActions.test.tsx` — 新建
- 内容:
  - 使用 `createPortal(content, document.getElementById('change-status-slot')!)` 渲染到 TopBar
  - 调用 `useWorkingState(ontologyRid)` 获取 WorkingState
  - 无 WorkingState 或 `changes.length === 0` → return `null`（Portal 内不渲染）
  - 渲染 `Space` 内两个按钮：
    - **Save 按钮**: `type="primary"`，文字 `t('changeManagement.save') + " (" + changes.length + ")"`，onClick → `useSaveDialogStore.openDialog()`
    - **Discard 按钮**: `danger` text 按钮，onClick → `Modal.confirm({...})` 确认后调用 `useDiscardAll` mutation
  - Discard 确认对话框：title = `t('changeManagement.discardConfirm')`，content = `t('changeManagement.discardConfirmMessage')`
  - **ontologyRid** 来源：与已有 OT/LT 创建方式一致（固定单个 ontology）
  - **测试**：
    - 有变更时渲染 Save + Discard 两个按钮 → AC-01
    - 无变更时不渲染 → AC-02
    - 点击 Save 调用 `openDialog()` → AC-03
    - 点击 Discard 弹出确认框 → AC-28
- 依赖: T06（hooks）、T07（store）、T08（i18n）
- 覆盖 AC: AC-01, AC-02, AC-03, AC-28

---

### T10: ErrorsTab + ChangeItem 叶组件 + 测试

- [ ] **T10**
- 文件:
  - `apps/web/src/components/SaveDialog/ErrorsTab.tsx` — 新建
  - `apps/web/src/components/SaveDialog/ChangeItem.tsx` — 新建
  - `apps/web/src/components/SaveDialog/__tests__/ErrorsTab.test.tsx` — 新建
- 内容:
  - **ErrorsTab.tsx**:
    - 前端基本校验：遍历 changes 中 CREATE/UPDATE 类型，检查必填字段（displayName 非空）
    - 每条错误：描述文字 + `Button type="link"` "Open" → navigate 到资源编辑页
    - 无错误：`Empty` 组件 + `t('changeManagement.noErrors')`
    - 导出 `getValidationErrors(changes)` 纯函数，供 SaveDialog 计算 errorCount
  - **ChangeItem.tsx**:
    - Props：`change: Change`, `onDiscard: (changeId: string) => void`
    - 显示：资源 displayName + `Tag`（Created=green / Modified=blue / Deleted=red）+ 垃圾桶图标
    - 垃圾桶 onClick → `onDiscard(change.id)`
  - **测试**:
    - ErrorsTab 无错误时显示空状态 → AC-06
    - ErrorsTab 有错误时显示错误列表 + "Open" 链接 → AC-06
    - ChangeItem 渲染 displayName + Tag + 垃圾桶
- 依赖: T08（i18n）
- 覆盖 AC: AC-06

---

### T11: SaveDialog 主体 + ChangesTab + 测试

- [ ] **T11**
- 文件:
  - `apps/web/src/components/SaveDialog/SaveDialog.tsx` — 新建
  - `apps/web/src/components/SaveDialog/ChangesTab.tsx` — 新建
  - `apps/web/src/components/SaveDialog/__tests__/SaveDialog.test.tsx` — 新建
- 内容:
  - **SaveDialog.tsx**:
    - Ant Design `Modal`，width 640，open/onCancel 从 `useSaveDialogStore`
    - `Tabs` 组件：`items` = Changes（默认）| Errors（使用 T10 的 ErrorsTab）
    - Errors tab 标题含 badge count（`getValidationErrors(changes).length`）
    - Footer：左侧 "Discard all"（danger text button）→ `Modal.confirm` → `useDiscardAll`；右侧 "Save"（primary）→ `usePublish` mutation
    - Save 按钮：`disabled={errorCount > 0 || publishing}`，loading 状态
    - Save 成功 → `closeDialog()` + toast 成功
    - Save 失败 → Alert 显示后端错误信息，不关闭 Modal
  - **ChangesTab.tsx**:
    - 接收 `changes: Change[]`
    - 按 `resourceType` 分组：Object Types / Properties / Link Types
    - 每组标题含 `Badge count`
    - 渲染每条 `ChangeItem`（来自 T10），传入 `onDiscard` → `useDiscardChange` mutation
  - **测试**:
    - 渲染测试：两个选项卡存在 → AC-04
    - Changes 按 ResourceType 分组 → AC-05
    - 有错误时 Save 按钮 disabled → AC-07
    - Save 成功后关闭 Modal → AC-08
    - Save 失败显示错误 → AC-09
    - Discard all 弹确认框 → AC-11
    - 确认后调用 discard API → AC-12
    - 单条 discard 调用 API 并移除 → AC-10
- 依赖: T06（hooks）、T07（store）、T08（i18n）、T10（ErrorsTab + ChangeItem）
- 覆盖 AC: AC-04, AC-05, AC-07, AC-08, AC-09, AC-10, AC-11, AC-12

---

## Phase 5: 前端 — Sidebar 入口 + 全局挂载

### T12: HomeSidebar 修改 + ChangeActions/SaveDialog 全局挂载

- [ ] **T12**
- 文件:
  - `apps/web/src/components/layout/HomeSidebar.tsx` — 修改
  - `apps/web/src/components/layout/HomeLayout.tsx` — 修改
- 内容:
  - **HomeSidebar.tsx**:
    - `menuItems` 数组新增 History 导航项：`{ key: '/history', icon: <HistoryOutlined />, label: t('changeManagement.history') }`
    - 折叠按钮上方新增 Unsaved Changes 入口区域：
      - 调用 `useWorkingState(ontologyRid)` 获取 changes count
      - `count > 0` 时显示可点击区域：`EditOutlined` + `t('changeManagement.unsavedChangesCount', { count })`
      - onClick → `useSaveDialogStore.openDialog('changes')`
      - 侧边栏折叠时只显示 icon + tooltip
    - `getSelectedKey` 新增：`if (pathname.startsWith('/history')) return '/history';`
    - **影响范围**：仅新增 menu item 和底部区域，不改变现有导航结构
  - **HomeLayout.tsx**（或 AppShell.tsx）:
    - 在 layout 中挂载 `<ChangeActions />` 和 `<SaveDialog />`，使其在所有页面生效
    - ChangeActions 通过 Portal 注入 TopBar，SaveDialog 作为全局 Modal
  - import 新增：`HistoryOutlined`, `EditOutlined`, `useWorkingState`, `useSaveDialogStore`, `ChangeActions`, `SaveDialog`
- 依赖: T09（ChangeActions）、T10（SaveDialog）、T11（ErrorsTab/ChangeItem）
- 覆盖 AC: AC-13, AC-14, AC-15

---

## Phase 6: 前端 — History 页面 + OT History Tab

### T13: HistoryPage — 变更历史列表页 + 测试

- [ ] **T13**
- 文件:
  - `apps/web/src/pages/history/HistoryPage.tsx` — 新建
  - `apps/web/src/pages/history/__tests__/HistoryPage.test.tsx` — 新建
- 内容:
  - **HistoryPage.tsx**:
    - 使用 `useHistory(ontologyRid, page, pageSize)` 获取分页数据
    - 页面标题：`t('changeManagement.history')`
    - Ant Design `Collapse` 组件渲染列表，每个 panel：
      - Header: 版本号 `v{version}`、相对时间（`dayjs(savedAt).fromNow()`，tooltip 完整时间）、savedBy、变更摘要（如 "3 changes: 1 created, 2 modified"）
      - 摘要：按 changeType 分组 count
      - Content（展开后）：变更列表，每条含 resourceType 标签 + displayName + ChangeType Tag
    - 分页：Ant Design `Pagination`
    - 空状态：`Empty` + `t('changeManagement.historyEmpty')`
  - **router.tsx 修改**：HomeLayout children 新增 `{ path: 'history', element: <HistoryPage /> }`
    - **影响范围**：仅新增一个路由条目，不影响现有路由
  - **测试**：
    - 空状态渲染 → AC-22（前端表现）
    - 有数据时显示列表 + 版本号 + 时间 → AC-16, AC-17
    - 展开显示变更详情 → AC-18
- 依赖: T07（history hooks）、T08（i18n）
- 覆盖 AC: AC-16, AC-17, AC-18

---

### T14: ObjectTypeHistoryPage + OT Nav 更新 + 测试

- [ ] **T14**
- 文件:
  - `apps/web/src/pages/object-types/ObjectTypeHistoryPage.tsx` — 新建
  - `apps/web/src/pages/object-types/ObjectTypeDetailLayout.tsx` — 修改
- 内容:
  - **ObjectTypeDetailLayout.tsx**:
    - `OT_NAV_ITEMS` 新增：`{ key: 'history', labelKey: 'changeManagement.history', icon: <HistoryOutlined /> }`
    - **影响范围**：仅在 nav items 数组末尾追加一项，不影响 Overview/Properties/Datasources
  - **ObjectTypeHistoryPage.tsx**:
    - 获取当前 OT rid：`useParams<{ rid: string }>()`
    - **上部 — 未保存变更**：
      - `useWorkingState(ontologyRid)` → 筛选 `changes.filter(c => c.resourceRid === rid)`
      - 有匹配项时渲染 Card："Pending changes"，列出每条变更的 ChangeType Tag
      - 无匹配项时不显示此区域
    - **下部 — 已发布历史**：
      - `useHistory(ontologyRid, 1, 100)` → 从 ChangeRecord 列表中筛选含 `change.resourceRid === rid` 的记录
      - 按 version 降序排列
      - 每条显示：版本号、时间、变更类型
      - 空状态：`Empty` + `t('changeManagement.noHistory')`
  - **router.tsx 修改**：OT detail children 新增 `{ path: 'history', element: <ObjectTypeHistoryPage /> }`
    - **影响范围**：仅在 OT detail children 追加一个路由
  - **测试**（内含于组件文件或 `__tests__/ObjectTypeHistoryPage.test.tsx`）：
    - OT 有历史时显示列表 → AC-24
    - OT 无历史时显示空状态 → AC-25
    - OT nav 含 History 项 → AC-23
- 依赖: T06（working-state hooks）、T07（history hooks）、T08（i18n）
- 覆盖 AC: AC-23, AC-24, AC-25

---

## Phase 7: 全量测试

### T15: 后端全量测试通过

- [ ] **T15**
- 文件: 无新增
- 内容:
  - 运行后端全量测试：`cd apps/server && uv run pytest tests/unit/test_history_service.py tests/integration/test_history_api.py -v`
  - 确认所有测试通过
  - 如有失败，在此任务内修复
- 依赖: T05
- 覆盖 AC: AC-19, AC-20, AC-21, AC-22, AC-26, AC-27

---

### T16: 前端全量测试通过

- [ ] **T16**
- 文件: 无新增
- 内容:
  - 运行前端全量测试：`cd apps/web && pnpm test --run`
  - 确认所有测试通过（包括 T08, T09, T10, T13, T14 中的测试）
  - 如有失败，在此任务内修复
- 依赖: T09, T10, T11, T12, T13, T14
- 覆盖 AC: AC-01, AC-02, AC-03, AC-04, AC-05, AC-06, AC-07, AC-08, AC-09, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, AC-17, AC-18, AC-23, AC-24, AC-25, AC-28

---

## AC 追溯矩阵

| AC | 测试任务 | 实现任务 |
|----|----------|----------|
| AC-01 | T09 | T09 |
| AC-02 | T09 | T09 |
| AC-03 | T09 | T09 |
| AC-04 | T08, T10 | T10 |
| AC-05 | T10 | T10 |
| AC-06 | T11(内含) | T11 |
| AC-07 | T10 | T10 |
| AC-08 | T10 | T10 |
| AC-09 | T10 | T10 |
| AC-10 | T10 | T10 |
| AC-11 | T10 | T10 |
| AC-12 | T10 | T10 |
| AC-13 | T12(内含) | T12 |
| AC-14 | T12(内含) | T12 |
| AC-15 | T12(内含) | T12 |
| AC-16 | T13 | T13 |
| AC-17 | T13 | T13 |
| AC-18 | T13 | T13 |
| AC-19 | T02, T04 | T03, T05 |
| AC-20 | T02, T04 | T03, T05 |
| AC-21 | T02, T04 | T03, T05 |
| AC-22 | T02, T04 | T03, T05 |
| AC-23 | T14 | T14 |
| AC-24 | T14 | T14 |
| AC-25 | T14 | T14 |
| AC-26 | T02, T04 | T03, T05 |
| AC-27 | T02, T04 | T03, T05 |
| AC-28 | T09 | T09 |

---

## 实际偏差记录

> 完成后，在此记录实现与 spec.md 的偏差，供后续参考。
