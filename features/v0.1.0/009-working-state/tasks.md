# Tasks: Change Management（变更管理）

**关联规范**: [spec.md](./spec.md)
**版本**: v0.1.0

---

## 状态

| 步骤 | 状态 | 备注 |
|------|------|------|
| spec.md | ✅ 已评审 | 28 条 AC，用户确认 2026-03-19 |
| tasks.md | 🔲 草稿 | 拆解完成后改为 ✅ 已拆解 |
| 实现 | 🔲 未开始 | 0 / 14 完成 |

---

## 开发模式

**后端 Test-First**：测试 → 实现配对编排。
**前端 Test-Alongside**：实现任务内含测试。
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
- 依赖: T01
- 覆盖 AC: AC-19, AC-20, AC-21, AC-22, AC-26, AC-27

---

### T04: History + Discard Single API 集成测试

- [ ] **T04**
- 文件:
  - `apps/server/tests/integration/test_history_api.py` — 新建
- 内容:
  - **History API 测试**（4 个）：
    - `test_list_history_empty` — 无记录返回 200 空列表 → AC-22
    - `test_list_history_after_publish` — 先 publish 再查 history，返回 1 条记录 → AC-19
    - `test_get_history_version_success` — 获取 publish 后的 version 返回 200 → AC-20
    - `test_get_history_version_not_found` — 不存在的 version 返回 404 CHANGE_RECORD_NOT_FOUND → AC-21
  - **Discard Single 测试**（3 个）：
    - `test_discard_single_change_success` — 创建 OT（产生 change）→ DELETE change → 200 → AC-26
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
- 依赖: T03
- 覆盖 AC: AC-19, AC-20, AC-21, AC-22, AC-26, AC-27

---

## Phase 3: 前端 — 类型 + API Hooks + Store

### T06: OpenAPI 类型重生成 + API Hooks

- [ ] **T06**
- 文件:
  - `apps/web/src/generated/api.ts` — 自动生成
  - `apps/web/src/api/working-state.ts` — 新建
  - `apps/web/src/api/history.ts` — 新建
- 内容:
  - 执行类型生成管线：`cd apps/web && pnpm run generate:api`
  - **`working-state.ts`** hooks:
    - `useWorkingState(ontologyRid)` — `GET /working-state`，`queryKey: ['working-state', ontologyRid]`，enabled 时轮询或 staleTime 短
    - `usePublish(ontologyRid)` — `POST /save` mutation，onSuccess invalidate `['working-state']` + `['object-types']` + `['link-types']` + `['properties']` + `['history']`
    - `useDiscardAll(ontologyRid)` — `DELETE /working-state` mutation，onSuccess invalidate 同上
    - `useDiscardChange(ontologyRid)` — `DELETE /working-state/changes/{changeId}` mutation，onSuccess invalidate `['working-state']`
  - **`history.ts`** hooks:
    - `useHistory(ontologyRid, page, pageSize)` — `GET /history`，`queryKey: ['history', ontologyRid, page, pageSize]`
    - `useHistoryVersion(ontologyRid, version)` — `GET /history/{version}`，`queryKey: ['history', ontologyRid, version]`，`enabled: !!version`
  - 确认 TypeScript 编译通过：`cd apps/web && pnpm tsc --noEmit`
- 依赖: T05（后端 API + openapi.json 就绪）
- 覆盖 AC: 前端所有 AC 的类型/数据基础

---

### T07: SaveDialog Zustand Store + i18n Keys

- [ ] **T07**
- 文件:
  - `apps/web/src/stores/save-dialog-store.ts` — 新建
  - `apps/web/src/locales/en-US/common.json` — 修改
  - `apps/web/src/locales/zh-CN/common.json` — 修改
- 内容:
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
    - `openDialog(tab)` — set `open: true`, `activeTab: tab ?? 'changes'`
    - `closeDialog()` — set `open: false`
  - **i18n keys**（`changeManagement` 命名空间）:
    - `save`, `discard`, `discardAll`, `reviewEdits`, `changes`, `errors`
    - `saveSuccess`, `saveError`, `discardConfirm`, `discardConfirmMessage`
    - `unsavedChanges`, `unsavedChangesCount`
    - `noErrors`, `openResource`
    - `history`, `historyEmpty`, `version`, `changesCount`
    - `noHistory`, `created`, `modified`, `deleted`
    - `objectTypes`, `properties`, `linkTypes`（分组标题）
- 依赖: 无
- 覆盖 AC: 无（基础设施）

---

## Phase 4: 前端 — ChangeActions + SaveDialog

### T08: ChangeActions 组件（TopBar Portal: Save + Discard 按钮）

- [ ] **T08**
- 文件:
  - `apps/web/src/components/ChangeActions.tsx` — 新建
- 内容:
  - 使用 `createPortal(content, document.getElementById('change-status-slot')!)` 渲染到 TopBar
  - 调用 `useWorkingState(ontologyRid)` 获取 WorkingState
  - 无 WorkingState 或 `changes.length === 0` → return `null`（Portal 内不渲染）
  - 渲染 `Space` 内两个按钮：
    - **Save 按钮**: `type="primary"`，文字 `t('changeManagement.save') + " (" + changes.length + ")"`，onClick → `useSaveDialogStore.openDialog()`
    - **Discard 按钮**: `danger` text 按钮，onClick → `Modal.confirm({...})` 确认后调用 `useDiscardAll` mutation
  - Discard 确认对话框：title = `t('changeManagement.discardConfirm')`，content = `t('changeManagement.discardConfirmMessage')`
  - Discard 成功后：刷新缓存（mutation onSuccess 已处理）
  - **ontologyRid** 来源：当前 MVP 固定单个 ontology，从环境或 context 获取（与已有 OT/LT 创建方式一致）
  - 测试: `components/__tests__/ChangeActions.test.tsx`
    - 渲染测试：有变更时显示 Save + Discard；无变更时不渲染
    - 点击 Save 打开 dialog（mock store）
- 依赖: T06（hooks）、T07（store + i18n）
- 覆盖 AC: AC-01, AC-02, AC-03, AC-28

---

### T09: SaveDialog 组件（Modal + ChangesTab + ErrorsTab）

- [ ] **T09**
- 文件:
  - `apps/web/src/components/SaveDialog/SaveDialog.tsx` — 新建
  - `apps/web/src/components/SaveDialog/ChangesTab.tsx` — 新建
  - `apps/web/src/components/SaveDialog/ErrorsTab.tsx` — 新建
  - `apps/web/src/components/SaveDialog/ChangeItem.tsx` — 新建
- 内容:
  - **SaveDialog.tsx**:
    - Ant Design `Modal`，width 640，open/onCancel 从 `useSaveDialogStore`
    - `Tabs` 组件：`items` = Changes（默认）| Errors
    - Errors tab 标题含 badge count（errorCount > 0 时显示）
    - Footer：左侧 "Discard all"（danger text button）→ `Modal.confirm` → `useDiscardAll`；右侧 "Save"（primary）→ `usePublish` mutation
    - Save 按钮：`disabled={errorCount > 0 || publishing}`，loading 状态
    - Save 成功 → `closeDialog()` + toast 成功
    - Save 失败 → Alert 显示后端错误信息，不关闭 Modal
  - **ChangesTab.tsx**:
    - 接收 `changes: Change[]`
    - 按 `resourceType` 分组：Object Types / Properties / Link Types
    - 每组使用 `Collapse` 或标题 + 列表，标题含 `Badge count`
    - 渲染每条 `ChangeItem`
  - **ChangeItem.tsx**:
    - 显示：资源 displayName（从 `change.after?.displayName ?? change.before?.displayName ?? change.resourceRid`）
    - `Tag` 颜色：Created=green / Modified=blue / Deleted=red
    - 垃圾桶 `DeleteOutlined` → `useDiscardChange` mutation → 成功后从列表移除
  - **ErrorsTab.tsx**:
    - 前端基本校验：遍历 changes 中 CREATE/UPDATE 类型，检查必填字段（displayName 非空）
    - 每条错误：描述文字 + `Button type="link"` "Open" → navigate 到资源编辑页
    - 无错误：`Empty` 组件 + `t('changeManagement.noErrors')`
  - 测试: `components/SaveDialog/__tests__/SaveDialog.test.tsx`
    - 渲染测试：两个选项卡存在
    - Changes 分组展示
    - Errors 阻止 Save
- 依赖: T06（hooks）、T07（store + i18n）、T08（ChangeActions 触发 openDialog）
- 覆盖 AC: AC-04, AC-05, AC-06, AC-07, AC-08, AC-09, AC-10, AC-11, AC-12

---

## Phase 5: 前端 — Sidebar 入口 + History 页面

### T10: HomeSidebar 修改 — History 导航 + Unsaved Changes 入口

- [ ] **T10**
- 文件:
  - `apps/web/src/components/layout/HomeSidebar.tsx` — 修改
- 内容:
  - **History 导航项**：在 `menuItems` 数组中新增 group 或项：
    ```typescript
    { key: '/history', icon: <HistoryOutlined />, label: t('changeManagement.history') }
    ```
    放在 DataConnection group 之后，或作为独立导航项
  - **Unsaved Changes 入口**：在折叠按钮上方（`<nav>` 底部，collapse toggle 之前）新增条件渲染区域：
    - 调用 `useWorkingState(ontologyRid)` 获取 changes count
    - `count > 0` 时显示可点击区域：`EditOutlined` + `t('changeManagement.unsavedChangesCount', { count })`
    - onClick → `useSaveDialogStore.openDialog('changes')`
    - 侧边栏折叠时只显示 icon，tooltip 显示数字
  - **getSelectedKey** 函数新增：`if (pathname.startsWith('/history')) return '/history';`
  - import 新增：`HistoryOutlined`, `EditOutlined`, `useWorkingState`, `useSaveDialogStore`
- 依赖: T06（hooks）、T07（store + i18n）
- 覆盖 AC: AC-13, AC-14, AC-15

---

### T11: HistoryPage — 变更历史列表页

- [ ] **T11**
- 文件:
  - `apps/web/src/pages/history/HistoryPage.tsx` — 新建
  - `apps/web/src/router.tsx` — 修改
- 内容:
  - **HistoryPage.tsx**:
    - 使用 `useHistory(ontologyRid, page, pageSize)` 获取分页数据
    - 页面标题：`t('changeManagement.history')`
    - Ant Design `Collapse` 组件渲染列表，每个 panel：
      - Header: 版本号 `v{version}`、相对时间（`dayjs(savedAt).fromNow()`，tooltip 完整时间）、savedBy、变更摘要（如 "3 changes: 1 created, 2 modified"）
      - 摘要计算：按 changeType 分组 count
      - Content（展开后）：变更列表，每条含 resourceType 标签 + displayName（从 after/before 提取）+ ChangeType Tag
    - 分页：Ant Design `Pagination`，total/page/pageSize 从响应获取
    - 空状态：`Empty` + `t('changeManagement.historyEmpty')`
    - Loading：`Spin`
  - **router.tsx 修改**：HomeLayout children 新增
    ```typescript
    { path: 'history', element: <HistoryPage /> }
    ```
    import `HistoryPage`
  - 测试: `pages/history/__tests__/HistoryPage.test.tsx`（可选，Test-Alongside）
    - 渲染测试：空状态 / 有数据时显示列表
- 依赖: T06（hooks）、T07（i18n）、T10（sidebar 导航）
- 覆盖 AC: AC-16, AC-17, AC-18

---

## Phase 6: 前端 — OT 详情页 History Tab

### T12: ObjectTypeDetailLayout 新增 History Nav + ObjectTypeHistoryPage

- [ ] **T12**
- 文件:
  - `apps/web/src/pages/object-types/ObjectTypeDetailLayout.tsx` — 修改
  - `apps/web/src/pages/object-types/ObjectTypeHistoryPage.tsx` — 新建
  - `apps/web/src/router.tsx` — 修改
- 内容:
  - **ObjectTypeDetailLayout.tsx**:
    - `OT_NAV_ITEMS` 新增：`{ key: 'history', labelKey: 'changeManagement.history', icon: <HistoryOutlined /> }`
    - import `HistoryOutlined`
  - **ObjectTypeHistoryPage.tsx**:
    - 获取当前 OT rid：`useParams<{ rid: string }>()`
    - **上部 — 未保存变更**：
      - `useWorkingState(ontologyRid)` → 筛选 `changes.filter(c => c.resourceRid === rid)`
      - 有匹配项时渲染 Card："Pending changes"，列出每条变更的 ChangeType Tag
      - 无匹配项时不显示此区域
    - **下部 — 已发布历史**：
      - `useHistory(ontologyRid, 1, 100)` → 从所有 ChangeRecord 中筛选含 `change.resourceRid === rid` 的记录
      - 按 version 降序排列
      - 每条显示：版本号、时间、变更类型
      - 空状态：`Empty` + `t('changeManagement.noHistory')`
  - **router.tsx 修改**：OT detail children 新增
    ```typescript
    { path: 'history', element: <ObjectTypeHistoryPage /> }
    ```
    import `ObjectTypeHistoryPage`
- 依赖: T06（hooks）、T07（i18n）
- 覆盖 AC: AC-23, AC-24, AC-25

---

## Phase 7: 集成验证

### T13: SaveDialog 全局挂载 + 端到端联调

- [ ] **T13**
- 文件:
  - `apps/web/src/components/layout/AppShell.tsx`（或 `HomeLayout.tsx`）— 修改
- 内容:
  - 确保 `<ChangeActions />` 和 `<SaveDialog />` 在应用根层级挂载（AppShell 或 HomeLayout 中），使 Portal 和 Modal 在所有页面生效
  - **联调验证清单**：
    1. 创建 OT → TopBar 显示 Save (1) + Discard → AC-01
    2. 点击 Save → Modal 打开，Changes 列表显示 OT → AC-03, AC-04, AC-05
    3. 点击 Modal Save → 发布成功，按钮消失 → AC-08
    4. 刷新后 History 页面显示 1 条记录 → AC-16, AC-17
    5. 再次创建 OT → 点击 TopBar Discard → 确认 → 按钮消失 → AC-28
    6. 创建多条变更 → 单条 discard（垃圾桶）→ 列表更新 → AC-10
    7. Sidebar "Unsaved changes" 入口可见并可点击 → AC-13, AC-14
    8. OT 详情页 History tab → AC-23, AC-24, AC-25
  - 修复联调过程中发现的 UI 问题
- 依赖: T08~T12 全部完成
- 覆盖 AC: AC-01, AC-02, AC-03, AC-04, AC-05, AC-08, AC-10, AC-13, AC-14, AC-16, AC-17, AC-23, AC-24, AC-25, AC-28

---

### T14: 前端测试补全 + 全量测试通过

- [ ] **T14**
- 文件:
  - `apps/web/src/stores/__tests__/save-dialog-store.test.ts` — 新建
  - 各组件测试文件（T08, T09 中已列出）
- 内容:
  - **save-dialog-store 测试**：
    - `openDialog()` 设置 open=true, activeTab='changes'
    - `openDialog('errors')` 设置 activeTab='errors'
    - `closeDialog()` 设置 open=false
  - 补全 T08、T09 中标注但未完成的组件测试
  - 运行全量前端测试：`cd apps/web && pnpm test --run`
  - 确认无失败
- 依赖: T08, T09, T11, T12
- 覆盖 AC: AC-01, AC-02, AC-03, AC-04, AC-05, AC-06, AC-07, AC-28

---

## AC 追溯矩阵

| AC | 测试任务 | 实现任务 |
|----|----------|----------|
| AC-01 | T14 | T08 |
| AC-02 | T14 | T08 |
| AC-03 | T14 | T08 |
| AC-04 | T14 | T09 |
| AC-05 | T14 | T09 |
| AC-06 | T14 | T09 |
| AC-07 | T14 | T09 |
| AC-08 | T13 | T09 |
| AC-09 | T09(内含) | T09 |
| AC-10 | T13 | T09 |
| AC-11 | T09(内含) | T09 |
| AC-12 | T09(内含) | T09 |
| AC-13 | T13 | T10 |
| AC-14 | T13 | T10 |
| AC-15 | T13 | T10 |
| AC-16 | T13 | T11 |
| AC-17 | T13 | T11 |
| AC-18 | T13 | T11 |
| AC-19 | T02, T04 | T03, T05 |
| AC-20 | T02, T04 | T03, T05 |
| AC-21 | T02, T04 | T03, T05 |
| AC-22 | T02, T04 | T03, T05 |
| AC-23 | T13 | T12 |
| AC-24 | T13 | T12 |
| AC-25 | T13 | T12 |
| AC-26 | T02, T04 | T03, T05 |
| AC-27 | T02, T04 | T03, T05 |
| AC-28 | T14 | T08 |

---

## 实际偏差记录

> 完成后，在此记录实现与 spec.md 的偏差，供后续参考。
