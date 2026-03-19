# Feature: Change Management（变更管理）

**关联 PRD**: [docs/prd/0.1.0（MVP）/本体管理平台（Ontology Manager） PRD.md §6 变更管理]
**架构参考**: [docs/architecture/06-change-management.md]
**优先级**: P0
**所属版本**: v0.1.0

---

## 相关文档

| 文档 | 路径 |
|------|------|
| 变更管理架构 | `docs/architecture/06-change-management.md` |
| PRD §6 变更管理 | `docs/prd/0.1.0（MVP）/本体管理平台（Ontology Manager） PRD.md` |
| 版本合约 | `features/v0.1.0/release-contract.md` |

| 依赖特性 | 说明 |
|----------|------|
| 003-object-type-crud | WorkingState 基础设施（Domain, Storage, Service）|
| 004-app-shell | UI 框架、TopBar、HomeSidebar |
| 005-object-type-crud-frontend | OT 详情页布局 |
| 006-link-type-crud | LinkType WorkingState 集成 |
| 007-property-management | Property WorkingState 集成 |

---

## 用户故事

作为 **本体管理员**，
我希望 **能够审阅、保存或丢弃对本体的未保存变更，并查看历史变更记录**，
以便 **确保每次发布都经过审查，且可追溯所有历史修改**。

---

## MVP 范围决策

以下范围决策由产品方在 Spec Discovery 阶段确认：

| # | 决策项 | MVP 范围 | 说明 |
|---|--------|----------|------|
| D1 | Save Dialog | 纳入 | Changes/Errors 选项卡 + Save/Discard |
| D2 | Discard 功能 | 纳入 | 单条丢弃 + 全部丢弃 |
| D3 | Unsaved Changes 入口 | 纳入 | HomeSidebar 底部入口，点击打开 Save Dialog |
| D4 | History 列表/详情 | 纳入 | History 页面 + 展开详情 |
| D5 | 单资源 History | 纳入 | OT 详情页新增 History Tab |
| D6 | 冲突检测 | 排除 | 单用户 MVP 无需冲突检测 |
| D7 | Rollback | 排除 | 延后到 P1 |
| D8 | Export/Import | 排除 | 延后到 P1 |
| D9 | 破坏性变更警告 | 排除 | 延后到 P1 |

---

## 现有代码基础

本 feature 是全栈特性，补充后端 History API + 全部前端变更管理 UI。已有代码：

**后端已实现**：
- Domain 模型：`Change`, `ChangeType`, `ResourceType`, `ChangeState`, `WorkingState`, `ChangeRecord`（`app/domain/working_state.py`）
- ORM 模型：`WorkingStateModel`, `ChangeRecordModel`（`app/storage/models.py`）
- Service：`publish()`, `discard()`, `get_working_state()`, `add_change()`, `get_merged_view()` 等（`app/services/working_state_service.py`）
- Storage：`working_state_storage.py`（CRUD for WorkingState）
- Router：`POST /save`, `DELETE /working-state`, `GET /working-state`（`app/routers/ontology.py`）

**前端已实现**：
- `TopBar.tsx:35` — `<div id="change-status-slot" />` Portal 插槽
- `ChangeStateBadge.tsx` — 变更状态标签组件
- `HomeSidebar.tsx` — 导航菜单
- `ObjectTypeDetailLayout.tsx` — OT 详情页 + `OT_NAV_ITEMS`

**缺失部分**：
- 后端：History API（list/detail）、Discard 单条 API
- 前端：SaveButton、SaveDialog、HistoryPage、Unsaved Changes 入口、OT History Tab

---

## 验收标准

### Save 按钮与状态指示

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-01 | 本体管理员 | 对本体进行任何修改（创建/编辑/删除 OT/Property/LinkType）后查看 TopBar | TopBar 右侧 `#change-status-slot` 显示 Save 按钮（含变更计数 badge，如 "Save (3)"）和 Discard 按钮 |
| AC-02 | 本体管理员 | 无未保存变更时查看 TopBar | Save 和 Discard 按钮均不显示（`#change-status-slot` 为空） |
| AC-03 | 本体管理员 | 点击 Save 按钮 | 打开 Review Edits Modal |
| AC-28 | 本体管理员 | 点击 TopBar Discard 按钮 | 弹出确认对话框："确定要丢弃所有未保存的变更吗？此操作不可撤销。"确认后调用 `DELETE /ontologies/{rid}/working-state`，成功后刷新缓存、两个按钮消失 |

### Save Dialog

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-04 | 本体管理员 | 打开 Review Edits Modal | Modal 顶部包含 Changes 和 Errors 两个选项卡，默认选中 Changes |
| AC-05 | 本体管理员 | 查看 Changes 选项卡 | 变更按 ResourceType 分组展示（Object Types / Properties / Link Types），每条含资源名称、ChangeType 标签（Created/Modified/Deleted）；组标题含该组变更数 |
| AC-06 | 本体管理员 | 切换到 Errors 选项卡 | 展示校验错误列表（每条含错误描述 + "Open" 链接可跳转到对应资源编辑页）；无错误时显示空状态 |
| AC-07 | 本体管理员 | Changes 中存在校验错误时查看 Modal 底部 | Save 按钮置灰不可点击，Errors 选项卡标题显示错误计数 badge |
| AC-08 | 本体管理员 | 无错误时点击 Save 按钮 | 调用 `POST /ontologies/{rid}/save`，成功后：关闭 Modal → 刷新 TanStack Query 缓存（invalidate OT/LT/Property 列表）→ Save 按钮从 TopBar 消失 |
| AC-09 | 本体管理员 | Save 请求后端返回错误（如验证失败） | Modal 内显示后端错误信息（toast 或 Alert），不关闭 Modal |

### Discard 功能

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-10 | 本体管理员 | 在 Changes 选项卡中某条变更旁点击垃圾桶图标 | 调用 `DELETE /working-state/changes/{changeId}`，成功后从列表移除该条，变更计数更新 |
| AC-11 | 本体管理员 | 点击 Modal 底部 "Discard all" 按钮 | 弹出确认对话框："确定要丢弃所有未保存的变更吗？此操作不可撤销。" |
| AC-12 | 本体管理员 | 在确认对话框中点击确认 | 调用 `DELETE /ontologies/{rid}/working-state`，成功后：关闭确认框 → 关闭 Save Dialog → 刷新缓存 → Save 按钮消失 |

### Unsaved Changes 侧边栏入口

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-13 | 本体管理员 | 有未保存变更时查看 HomeSidebar | 侧边栏底部（折叠按钮上方）显示 "Unsaved changes (N)" 入口，N 为变更计数 |
| AC-14 | 本体管理员 | 点击 "Unsaved changes (N)" 入口 | 打开 Save Dialog（Review Edits Modal），默认在 Changes 选项卡 |

### History 页面

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-15 | 本体管理员 | 查看 HomeSidebar | 导航菜单中显示 "History" 项（HistoryOutlined 图标） |
| AC-16 | 本体管理员 | 进入 History 页面 | 显示 ChangeRecord 列表，按 version 降序排列，分页 20 条/页 |
| AC-17 | 本体管理员 | 查看 History 列表单条记录 | 显示：版本号（如 "v3"）、保存时间（相对时间 + tooltip 完整时间）、操作者、变更摘要（如 "3 changes: 1 created, 2 modified"） |
| AC-18 | 本体管理员 | 点击某条 ChangeRecord | 展开显示详细变更列表：每条含资源类型、资源名称、ChangeType 标签 |

### 后端 History API

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-19 | 系统 | `GET /api/v1/ontologies/{rid}/history?page=1&pageSize=20` | 200，返回 `{ items: ChangeRecord[], total: number, page: number, pageSize: number }` |
| AC-20 | 系统 | `GET /api/v1/ontologies/{rid}/history/{version}` | 200，返回单个 ChangeRecord（含完整 changes 数组） |
| AC-21 | 系统 | `GET /api/v1/ontologies/{rid}/history/999`（不存在的 version） | 404，`{ "error": { "code": "CHANGE_RECORD_NOT_FOUND", "message": "..." } }` |
| AC-22 | 系统 | `GET /api/v1/ontologies/{rid}/history`（无记录） | 200，`{ items: [], total: 0, page: 1, pageSize: 20 }` |

### 单资源 History

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-23 | 本体管理员 | 进入 OT 详情页 | 左侧导航新增 "History" 项（HistoryOutlined 图标） |
| AC-24 | 本体管理员 | 进入 OT History Tab | 上部显示该 OT 的未保存变更（如有），下部显示该 OT 的已发布历史变更（从 ChangeRecord.changes 中筛选 resource_rid 匹配的条目） |
| AC-25 | 本体管理员 | 该 OT 无任何历史记录 | 显示空状态："No history yet" |

### Discard 单条 API

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-26 | 系统 | `DELETE /api/v1/ontologies/{rid}/working-state/changes/{changeId}` | 204，从 WorkingState.changes 中移除匹配 changeId 的条目；若移除后 changes 为空则自动删除整个 WorkingState |
| AC-27 | 系统 | `DELETE /api/v1/ontologies/{rid}/working-state/changes/nonexistent-id` | 404，`{ "error": { "code": "CHANGE_NOT_FOUND", "message": "..." } }` |

---

## 边界情况

- 当 WorkingState 不存在时（无未保存变更），TopBar Save 按钮不显示，Sidebar Unsaved Changes 入口不显示
- 当 Discard 单条变更后 `changes` 数组变空时，自动删除整个 WorkingState（调用 `working_state_storage.delete`）
- 当 `publish()` 成功后，前端 invalidate 所有相关 query key（object-types、link-types、properties、working-state），确保缓存一致
- 当 ChangeRecord 中引用的资源已被后续删除时，History 详情中以 resource_rid 作为显示名（前端 best-effort 解析，不阻塞渲染）
- 当 History 页面无任何 ChangeRecord 时，显示空状态插图 + "No changes have been published yet"
- 当分页请求 `page` 超出范围时，返回空列表（与其他列表 API 行为一致）
- **不支持**：Warnings 选项卡（PRD 6.1.2 提到非阻塞建议类警告，MVP 无 warning 来源，延后到 v0.2.0）
- **不支持**：冲突检测与合并（单用户 MVP 不需要，延后到 v0.2.0）
- **不支持**：Rollback 功能（延后到 P1）
- **不支持**：Export/Import（延后到 P1）
- **不支持**：破坏性变更警告（延后到 P1）

---

## 架构决策

| ID | 决策 | 选项 | 结论 | 理由 |
|----|------|------|------|------|
| AD-01 | SaveButton 在 TopBar 中的渲染方式 | A: 直接修改 TopBar 组件 / B: Portal 渲染到 `#change-status-slot` | 选 B | TopBar 保持通用，SaveButton 作为独立组件通过 Portal 注入，职责单一；`#change-status-slot` 已预留 |
| AD-02 | Unsaved Changes 入口点击行为 | A: 导航到独立页面 / B: 打开 SaveDialog Modal | 选 B | 复用 SaveDialog 组件，减少重复实现；PRD 中 "Unsaved changes" 视图即 Review Edits 对话框 |
| AD-03 | 单资源 History 数据获取方式 | A: 后端新增按资源 RID 过滤的 API / B: 前端从完整 ChangeRecord 列表中筛选 | 选 B | MVP 数据量小（单个 Ontology 变更记录有限），前端筛选足够；未来数据量增大时再加后端过滤 |
| AD-04 | Discard 单条变更 API 设计 | A: PUT /working-state（更新整个 changes 数组）/ B: DELETE /working-state/changes/{changeId} | 选 B | 语义清晰，原子操作，避免并发覆盖；changeId 已在 Change model 中存在 |
| AD-05 | Save 前校验分工 | A: 仅后端校验 / B: 前端基本校验 + 后端完整校验 | 选 B | 前端校验提供即时反馈（如必填字段、格式），后端校验作为权威屏障（已有 `_validate_completeness` + `_validate_type_compatibility`） |

---

## 数据库 & Domain 模型

### 无新增表

复用已有 `working_states` 和 `change_records` 表，无需 Alembic 迁移。

### 新增 Pydantic 响应模型

```python
# app/domain/working_state.py 新增

class HistoryListResponse(DomainModel):
    """分页 ChangeRecord 列表响应。"""
    items: list[ChangeRecord]
    total: int
    page: int
    page_size: int
```

### 已有模型（无变更）

```python
class Change(DomainModel):
    id: str
    resource_type: ResourceType
    resource_rid: str
    change_type: ChangeType
    before: dict | None = None
    after: dict | None = None
    timestamp: datetime

class WorkingState(DomainModel):
    rid: str
    user_id: str
    ontology_rid: str
    changes: list[Change] = Field(default_factory=list)
    base_version: int
    created_at: datetime
    last_modified_at: datetime

class ChangeRecord(DomainModel):
    rid: str
    ontology_rid: str
    version: int
    changes: list[Change]
    saved_at: datetime
    saved_by: str
    description: str | None = None
```

---

## API 契约

### 端点列表

| Method | Path | 描述 | 状态 |
|--------|------|------|------|
| POST | `/api/v1/ontologies/{rid}/save` | 发布变更 | 已有 |
| DELETE | `/api/v1/ontologies/{rid}/working-state` | 丢弃所有变更 | 已有 |
| GET | `/api/v1/ontologies/{rid}/working-state` | 获取当前工作状态 | 已有 |
| GET | `/api/v1/ontologies/{rid}/history` | 分页查询变更历史 | **新增** |
| GET | `/api/v1/ontologies/{rid}/history/{version}` | 查询特定版本变更详情 | **新增** |
| DELETE | `/api/v1/ontologies/{rid}/working-state/changes/{changeId}` | 丢弃单条变更 | **新增** |

### 新增端点详情

#### GET `/api/v1/ontologies/{rid}/history`

**Query Parameters**:
- `page`: int, default 1, min 1
- `pageSize`: int, default 20, min 1, max 100

**Response 200**:
```json
{
  "items": [
    {
      "rid": "ri.ontology.change-record.uuid",
      "ontologyRid": "ri.ontology.ontology.uuid",
      "version": 3,
      "changes": [
        {
          "id": "chg-uuid",
          "resourceType": "ObjectType",
          "resourceRid": "ri.ontology.object-type.uuid",
          "changeType": "CREATE",
          "before": null,
          "after": { "displayName": "Employee", "..." : "..." },
          "timestamp": "2026-03-19T10:00:00Z"
        }
      ],
      "savedAt": "2026-03-19T10:05:00Z",
      "savedBy": "system",
      "description": null
    }
  ],
  "total": 3,
  "page": 1,
  "pageSize": 20
}
```

#### GET `/api/v1/ontologies/{rid}/history/{version}`

**Response 200**: 单个 ChangeRecord（同上 items 中元素格式）

**Response 404**:
```json
{
  "error": {
    "code": "CHANGE_RECORD_NOT_FOUND",
    "message": "Change record with version 999 not found"
  }
}
```

#### DELETE `/api/v1/ontologies/{rid}/working-state/changes/{changeId}`

**Response 204**: 无 body

**Response 404**（WorkingState 不存在 或 changeId 不存在）:
```json
{
  "error": {
    "code": "CHANGE_NOT_FOUND",
    "message": "Change with id chg-xxx not found in working state"
  }
}
```

### 错误码表

| HTTP Status | Code | 场景 | 关联 AC |
|-------------|------|------|---------|
| 404 | `CHANGE_RECORD_NOT_FOUND` | 指定 version 的 ChangeRecord 不存在 | AC-21 |
| 404 | `CHANGE_NOT_FOUND` | 指定 changeId 的 Change 不存在于 WorkingState 中 | AC-27 |
| 404 | `WORKING_STATE_NOT_FOUND` | WorkingState 不存在（已有） | AC-27 |

---

## Service / Router 层逻辑

### WorkingStateService 新增方法

- **`list_history(ontology_rid, page, page_size) → HistoryListResponse`**
  - 委托 `ChangeRecordStorage.list_by_ontology()` 分页查询
  - 按 version 降序排列

- **`get_history_version(ontology_rid, version) → ChangeRecord`**
  - 委托 `ChangeRecordStorage.get_by_version()`
  - 不存在则抛出 `AppError(CHANGE_RECORD_NOT_FOUND, 404)`

- **`discard_single_change(ontology_rid, change_id) → None`**
  - 获取 WorkingState（不存在抛 404 `WORKING_STATE_NOT_FOUND`）
  - 从 `changes` 中移除匹配 `change_id` 的条目（不存在抛 404 `CHANGE_NOT_FOUND`）
  - 若移除后 `changes` 为空，删除整个 WorkingState
  - 否则更新 WorkingState 的 changes 和 last_modified_at

### ChangeRecordStorage（新建）

- **`list_by_ontology(session, ontology_rid, page, page_size) → tuple[list[ChangeRecordModel], int]`**
  - `SELECT * FROM change_records WHERE ontology_rid = :rid ORDER BY version DESC LIMIT :limit OFFSET :offset`
  - 同时返回总数（`SELECT count(*)`）

- **`get_by_version(session, ontology_rid, version) → ChangeRecordModel | None`**
  - `SELECT * FROM change_records WHERE ontology_rid = :rid AND version = :version`

### Router 新增端点

- `GET /ontologies/{rid}/history` → 调用 `service.list_history()`
- `GET /ontologies/{rid}/history/{version}` → 调用 `service.get_history_version()`
- `DELETE /ontologies/{rid}/working-state/changes/{change_id}` → 调用 `service.discard_single_change()`

---

## 前端组件设计

### 组件树

```
TopBar (#change-status-slot) ← Portal
  └── ChangeActions                       [新建] — Save + Discard 按钮组合
      ├── SaveButton                      — "Save (N)" 按钮，点击打开 SaveDialog
      ├── DiscardButton                   — "Discard" 按钮，点击弹确认后丢弃全部
      └── SaveDialog (Modal)              [新建] — Review Edits 弹窗
          ├── ChangesTab                  [新建] — 按 ResourceType 分组展示变更
          │   └── ChangeItem              [新建] — 单条变更（名称 + 类型标签 + 垃圾桶）
          └── ErrorsTab                   [新建] — 校验错误列表

HomeSidebar (修改 menuItems)
  ├── "Unsaved changes (N)"               [新增入口] — 底部区域，点击打开 SaveDialog
  └── "History"                           [新增导航项] → /history

HistoryPage                               [新建] — HomeLayout 子路由
  └── HistoryList                         [新建] — Collapse 可展开列表

ObjectTypeDetailLayout (OT_NAV_ITEMS 新增 history)
  └── ObjectTypeHistoryPage               [新建] — OT 级别变更历史
```

### 关键组件说明

**ChangeActions**（SaveButton + DiscardButton 组合组件）
- 使用 `createPortal` 渲染到 `document.getElementById('change-status-slot')`
- 通过 `useWorkingState()` hook 获取当前 WorkingState
- 无 WorkingState 或 changes 为空时不渲染
- 显示：`Save (N)` 按钮（primary，N = changes.length）+ `Discard` 按钮（default/danger text）
- Save 点击 → 打开 SaveDialog；Discard 点击 → 确认对话框 → 调用 DELETE /working-state

**SaveDialog**
- Ant Design Modal，宽度 640px
- 状态管理：`save-dialog-store`（Zustand）控制开关 + 活跃 Tab
- Tabs：Changes（默认）| Errors
- Footer：左侧 "Discard all"（danger text button），右侧 "Save"（primary button）
- Save 按钮：有 errors 时 disabled

**ChangesTab**
- 按 `ResourceType` 分组（Object Types / Properties / Link Types）
- 每组标题含 badge 计数
- 每条 ChangeItem：资源 displayName（从 `change.after` 或 `change.before` 提取）+ ChangeType Tag + 垃圾桶 DeleteOutlined

**ErrorsTab**
- 调用后端 publish 预校验（复用 `_validate_completeness`）或前端基本校验
- 每条错误：描述文字 + "Open" 链接（navigate 到资源编辑页）
- 空状态："No errors"

**HistoryPage**
- 路由：`/history`
- 使用 `useHistory()` hook 分页获取 ChangeRecord 列表
- Ant Design Collapse 组件，每条 panel header 显示 AC-17 描述的信息
- 展开后显示 changes 列表

**ObjectTypeHistoryPage**
- 路由：`/object-types/:rid/history`
- 上部：该 OT 的未保存变更（从 WorkingState.changes 中筛选 `resource_rid === rid`）
- 下部：该 OT 的已发布历史（从所有 ChangeRecord 中筛选含 `resource_rid === rid` 的记录）

### 路由变更

修改 `router.tsx`：

```tsx
// HomeLayout children 新增
{ path: 'history', element: <HistoryPage /> }

// OT detail children 新增
{ path: 'history', element: <ObjectTypeHistoryPage /> }
```

### Zustand Store

**save-dialog-store**（仅 UI 状态）：

```typescript
interface SaveDialogState {
  open: boolean;
  activeTab: 'changes' | 'errors';
  openDialog: (tab?: 'changes' | 'errors') => void;
  closeDialog: () => void;
  setActiveTab: (tab: 'changes' | 'errors') => void;
}
```

### API Hooks（TanStack Query）

```typescript
// src/api/working-state.ts — 修改/新增
useWorkingState(ontologyRid)          // GET /working-state（已有逻辑，可能需新建 hook 文件）
useDiscardChange(ontologyRid)         // DELETE /working-state/changes/{changeId}
useDiscardAll(ontologyRid)            // DELETE /working-state
usePublish(ontologyRid)               // POST /save

// src/api/history.ts — 新建
useHistory(ontologyRid, page, pageSize)       // GET /history
useHistoryVersion(ontologyRid, version)       // GET /history/{version}
```

---

## 文件清单

```
apps/server/
├── app/domain/working_state.py                    # 修改 — 新增 HistoryListResponse
├── app/routers/ontology.py                        # 修改 — 新增 3 个 endpoint
├── app/services/working_state_service.py          # 修改 — 新增 3 个方法
├── app/storage/change_record_storage.py           # 新建 — ChangeRecord 查询
├── tests/unit/test_history_service.py             # 新建 — history/discard_single 单测
├── tests/integration/test_history_api.py          # 新建 — history API 集成测试
└── openapi.json                                   # 重新生成

apps/web/src/
├── api/working-state.ts                           # 新建 — WorkingState 相关 hooks
├── api/history.ts                                 # 新建 — History 相关 hooks
├── stores/save-dialog-store.ts                    # 新建 — SaveDialog UI 状态
├── components/ChangeActions.tsx                    # 新建 — Portal 到 TopBar（Save + Discard）
├── components/SaveDialog/
│   ├── SaveDialog.tsx                             # 新建 — Modal 主体
│   ├── ChangesTab.tsx                             # 新建 — 变更列表选项卡
│   ├── ErrorsTab.tsx                              # 新建 — 错误列表选项卡
│   └── ChangeItem.tsx                             # 新建 — 单条变更行
├── pages/history/HistoryPage.tsx                  # 新建 — History 列表页
├── pages/object-types/ObjectTypeHistoryPage.tsx   # 新建 — OT 级别 History
├── components/layout/HomeSidebar.tsx              # 修改 — 新增 History 导航 + Unsaved Changes 入口
├── pages/object-types/ObjectTypeDetailLayout.tsx  # 修改 — OT_NAV_ITEMS 新增 history
├── router.tsx                                     # 修改 — 新增 history 路由
├── locales/en-US/common.json                      # 修改 — 新增 i18n key
└── locales/zh-CN/common.json                      # 修改 — 新增 i18n key
```

---

## 非功能要求

- **性能**: History 列表分页查询，单次返回 ≤ 20 条，响应 < 200ms
- **可用性**: Save 过程中显示 loading 状态；Save/Discard 成功后自动刷新相关缓存；空状态有明确提示
- **一致性**: Publish 成功后一次性 invalidate 所有相关 query key，避免 UI 显示陈旧数据

---

## 相关文档

- 架构参考: [docs/architecture/06-change-management.md]
- 领域模型: [docs/architecture/02-domain-model.md]
- 版本契约: [features/v0.1.0/release-contract.md]
- 依赖特性: [features/v0.1.0/003-object-type-crud]、[features/v0.1.0/004-app-shell]、[features/v0.1.0/005-object-type-crud-frontend]
