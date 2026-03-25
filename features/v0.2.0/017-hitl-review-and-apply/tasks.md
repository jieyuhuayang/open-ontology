# Tasks: F017 HITL Review & Apply

**关联规格**: [spec.md](./spec.md)
**版本**: v0.2.0

---

## 状态

| 步骤 | 状态 | 备注 |
|------|------|------|
| spec.md | ✅ 已评审 | 22 条 AC，用户确认通过 |
| tasks.md | ✅ 已拆解 | 22 个任务，LGTM |
| 实现 | 🔄 进行中 | 10 / 22 完成 |

---

## 开发模式

**后端 Test-First（测试在前，实现在后）**：后端任务按「测试 → 实现」配对编排，先写测试（红），再写实现（绿）。
基础设施任务（Domain 模型、Storage 扩展）无测试配对，单独编号。

**前端 Test-Alongside**：前端实现任务内含测试，或在同 phase 末尾补充测试任务。

**自包含任务**：每个任务内联文件、逻辑、测试上下文，实现阶段不需要回读 spec.md。

---

## Tasks

### Phase 1: 后端基础设施

- [x] **T001**: Domain 模型扩展
  **文件**: `apps/server/app/domain/blueprint.py`
  **逻辑**: 新增 5 个 Pydantic 模型（继承 `DomainModel`）：
  - `BlueprintItemBatchUpdate`: `item_rids: list[str]`, `user_decision: UserDecision`, `rejection_reason: str | None = None`
  - `ConflictCheckResult`: `item_rid: str`, `conflict_type: str`, `message: str`, `conflicting_entity_rid: str | None = None`
  - `BlueprintPreApplyCheck`: `can_apply: bool`, `conflicts: list[ConflictCheckResult]`, `actionable_count: int`, `undecided_count: int`
  - `BlueprintItemRetryRequest`: `user_edits: dict | None = None`
  - `BlueprintItemRetryResult`: `item_rid: str`, `status: str`, `created_entity_rid: str | None = None`, `error: str | None = None`
  **依赖**: 无

- [ ] **T002**: Storage 层扩展
  **文件**: `apps/server/app/storage/blueprint_storage.py`
  **逻辑**: 在 `BlueprintItemStorage` 中新增 2 个静态方法：
  - `batch_get(session, rids: list[str]) -> list[BlueprintItemModel]`: 按 RID 列表批量查询蓝图项
  - `get_succeeded_items(session, blueprint_rid: str) -> list[BlueprintItemModel]`: 查询指定蓝图中 `created_entity_rid IS NOT NULL` 的所有项（用于 retry 时构建 placeholder→realRid 映射）
  **依赖**: T001

### Phase 2: 后端服务层（Test-First）

- [ ] **T003**: `batch_update_decisions` 单元测试
  **文件**: `apps/server/tests/unit/test_blueprint_service.py`
  **逻辑**: 使用 `mock_db_session` 测试 `BlueprintService.batch_update_decisions()`：
  - `test_batch_accept_all_undecided`: 3 个未决策项全部 accept → 返回 3 项，均 `userDecision=accepted`
  - `test_batch_skips_already_decided`: 2 个已决策 + 1 个未决策 → 仅返回 1 项（已决策跳过不报错）
  - `test_batch_reject_with_reason`: 批量 reject + `rejectionReason="与业务不相关"` → 每项均有 reason
  - `test_batch_requires_pending_review`: 蓝图状态为 `draft` → 抛 `BLUEPRINT_INVALID_STATUS_TRANSITION` (422)
  - `test_batch_empty_rids`: `item_rids=[]` → 返回空列表
  **覆盖 AC**: AC-11, AC-22
  **依赖**: T001, T002

- [ ] **T004**: `batch_update_decisions` 实现
  **文件**: `apps/server/app/services/blueprint_service.py`
  **逻辑**: 新增方法 `async def batch_update_decisions(self, blueprint_rid: str, req: BlueprintItemBatchUpdate) -> list[BlueprintItem]`：
  1. 验证蓝图存在且状态为 `pending_review`（否则抛 `BLUEPRINT_INVALID_STATUS_TRANSITION`）
  2. 调用 `BlueprintItemStorage.batch_get(session, req.item_rids)` 获取所有项
  3. 遍历每项：若 `user_decision is not None` → 跳过；否则调用 `BlueprintItemStorage.update_decision()` 设置 `req.user_decision` + `req.rejection_reason`
  4. 返回实际更新的项列表（转为 domain 模型）
  **测试**: T003 全部通过
  **覆盖 AC**: AC-11, AC-22
  **依赖**: T003

- [ ] **T005**: `pre_apply_check` 单元测试
  **文件**: `apps/server/tests/unit/test_blueprint_service.py`
  **逻辑**: 测试 `BlueprintService.pre_apply_check()`：
  - `test_precheck_no_conflicts`: 3 个 accepted OT 项 + 1 个 LT 项（依赖 OT 均 accepted）→ `canApply=true, conflicts=[]`
  - `test_precheck_apiname_collision`: OT 项 apiName="Order" 与现有 ObjectType 冲突 → `conflicts` 含 1 项 `api_name_collision`
  - `test_precheck_dependency_missing`: LT 项依赖的 OT placeholderRid 对应项被 rejected → `conflicts` 含 1 项 `dependency_missing`
  - `test_precheck_counts_undecided`: 2 个 accepted + 1 个 null → `actionableCount=2, undecidedCount=1`
  - `test_precheck_requires_pending_review`: 蓝图非 `pending_review` → 抛 `BLUEPRINT_INVALID_STATUS_TRANSITION`
  **覆盖 AC**: AC-14, AC-15
  **依赖**: T001, T002

- [ ] **T006**: `pre_apply_check` 实现
  **文件**: `apps/server/app/services/blueprint_service.py`
  **逻辑**: 新增方法 `async def pre_apply_check(self, rid: str) -> BlueprintPreApplyCheck`：
  1. 验证蓝图存在且状态为 `pending_review`
  2. 获取所有项 `list_by_blueprint(rid)`
  3. 统计 `actionable_count`（accepted/edited）和 `undecided_count`（null）
  4. Phase 1 — apiName 冲突检测：对每个 accepted/edited OT 项，从 `suggestion` 或 `user_edits` 取 `apiName`，查询 `ObjectTypeStorage` 是否已存在。冲突项加入 `conflicts` 列表
  5. Phase 2 — 依赖完整性检测：对每个 accepted/edited LT 项，检查 `suggestion.sideA.objectTypeRid` 和 `sideB.objectTypeRid`（placeholder）是否在 accepted/edited OT 项中有对应。缺失项加入 `conflicts`
  6. `canApply = len(conflicts) == 0 or all are api_name_collision`（apiName 冲突可忽略继续，依赖缺失不可）
  **测试**: T005 全部通过
  **覆盖 AC**: AC-14, AC-15
  **依赖**: T005

- [ ] **T007**: `retry_item` 单元测试
  **文件**: `apps/server/tests/unit/test_blueprint_service.py`
  **逻辑**: 测试 `BlueprintService.retry_item()`：
  - `test_retry_success_ot`: applied 蓝图 + accepted OT 项 + `created_entity_rid=None`（失败项）→ 重新创建成功 → 返回 `status="success"` + `createdEntityRid`
  - `test_retry_with_user_edits`: 传入 `userEdits={"apiName": "NewName"}` → 合并到 suggestion 后创建
  - `test_retry_not_retryable_already_created`: 项已有 `created_entity_rid` → 抛 `BLUEPRINT_ITEM_NOT_RETRYABLE` (422)
  - `test_retry_not_retryable_rejected`: 项 `user_decision=rejected` → 抛 `BLUEPRINT_ITEM_NOT_RETRYABLE`
  - `test_retry_requires_applied_status`: 蓝图状态为 `pending_review` → 抛 `BLUEPRINT_INVALID_STATUS_FOR_APPLY`
  - `test_retry_builds_rid_map_from_succeeded`: 已成功 OT 项的 `created_entity_rid` 用于构建 placeholder→real RID 映射，LT retry 能正确解析两端 OT
  **覆盖 AC**: AC-19
  **依赖**: T001, T002

- [ ] **T008**: `retry_item` 实现
  **文件**: `apps/server/app/services/blueprint_service.py`
  **逻辑**: 新增方法 `async def retry_item(self, blueprint_rid: str, item_rid: str, user_edits: dict | None = None) -> BlueprintItemRetryResult`：
  1. 验证蓝图存在且状态为 `applied`
  2. 验证项存在、属于该蓝图、`user_decision` 为 accepted/edited、`created_entity_rid` 为 None
  3. 若 `user_edits` 非空，合并到 `item.user_edits` 或 `item.suggestion` 上（同时更新 DB 中的 `user_edits` 字段）
  4. 从已成功项构建 `ot_rid_map`（`BlueprintItemStorage.get_succeeded_items()` → 遍历 OT 项取 `suggestion.placeholderRid` → `created_entity_rid`）
  5. 按 `item_type` 执行创建：复用 `apply()` 中的 Phase 1/2/3 单项创建逻辑（`ObjectTypeService.create` / `PropertyService.create` / `LinkTypeService.create`）
  6. 成功：更新 `created_entity_rid`，返回 `status="success"`
  7. 失败：返回 `status="failed"` + `error` 信息
  **测试**: T007 全部通过
  **覆盖 AC**: AC-19
  **依赖**: T007

### Phase 3: 后端 API 层（Test-First）

- [ ] **T009**: 3 个新端点集成测试
  **文件**: `apps/server/tests/integration/test_blueprint_api.py`
  **逻辑**: 使用 `seeded_client` 测试 3 个新端点：
  - **batch-decision**:
    - `test_batch_decision_accept_all`: POST 创建蓝图+项 → PATCH 状态到 pending_review → PATCH batch-decision(accepted) → 200, 所有项 accepted
    - `test_batch_decision_wrong_status`: draft 蓝图 → PATCH batch-decision → 422
  - **pre-apply-check**:
    - `test_precheck_no_conflicts`: pending_review 蓝图 + accepted 项 → POST pre-apply-check → 200, `canApply=true`
    - `test_precheck_apiname_conflict`: 先创建同名 ObjectType → POST pre-apply-check → 200, conflicts 含 1 项
  - **retry**:
    - `test_retry_failed_item`: 构造 applied 蓝图 + 失败项 → POST retry → 200, `status=success`
    - `test_retry_already_created`: 构造已成功项 → POST retry → 422
  **覆盖 AC**: AC-11, AC-14, AC-15, AC-19, AC-22
  **依赖**: T004, T006, T008

- [ ] **T010**: 3 个新端点 Router 实现
  **文件**: `apps/server/app/routers/blueprints.py`
  **逻辑**: 在现有 router 中新增 3 个端点（薄壳，委托给 service）：
  - `@router.patch("/{rid}/items/batch-decision")`: 接收 `BlueprintItemBatchUpdate` body → `service.batch_update_decisions(rid, body)` → 返回 `list[BlueprintItem]`
  - `@router.post("/{rid}/pre-apply-check")`: 无 body → `service.pre_apply_check(rid)` → 返回 `BlueprintPreApplyCheck`
  - `@router.post("/{rid}/items/{item_rid}/retry")`: 接收 `BlueprintItemRetryRequest` body → `service.retry_item(rid, item_rid, body.user_edits)` → 返回 `BlueprintItemRetryResult`
  注意：`batch-decision` 路由必须注册在 `/{rid}/items/{item_rid}` 之前，避免 FastAPI 将 `batch-decision` 匹配为 `{item_rid}` 参数
  **测试**: T009 全部通过
  **覆盖 AC**: AC-11, AC-14, AC-15, AC-19, AC-22
  **依赖**: T009

- [ ] **T011**: 重新生成 openapi.json + TS 类型
  **文件**: `apps/server/openapi.json`, `apps/web/src/generated/api.ts`
  **逻辑**:
  1. `cd apps/server && PYTHONPATH=. uv run python -c "import json; from app.main import app; print(json.dumps(app.openapi(), indent=2))" > openapi.json`
  2. `cd apps/web && pnpm run generate-types`（或 `npx openapi-typescript ../server/openapi.json -o src/generated/api.ts`）
  3. 验证生成的 TS 类型包含 `BlueprintItemBatchUpdate`, `BlueprintPreApplyCheck`, `BlueprintItemRetryRequest`, `BlueprintItemRetryResult`
  **依赖**: T010

### Phase 4: 前端基础设施

- [ ] **T012**: API mutation hooks
  **文件**: `apps/web/src/api/blueprints.ts`
  **逻辑**: 新增 5 个 `useMutation` hooks，所有 `onSuccess` 调用 `queryClient.invalidateQueries(blueprintKeys.detail(rid))`：
  - `useUpdateItemDecision(blueprintRid)`: `PATCH /blueprints/{rid}/items/{itemRid}` body: `{ userDecision, userEdits?, rejectionReason? }`
  - `useBatchUpdateDecisions(blueprintRid)`: `PATCH /blueprints/{rid}/items/batch-decision` body: `BlueprintItemBatchUpdate`
  - `usePreApplyCheck(blueprintRid)`: `POST /blueprints/{rid}/pre-apply-check` 无 body
  - `useApplyBlueprint(blueprintRid)`: `POST /blueprints/{rid}/apply` 无 body
  - `useRetryItem(blueprintRid)`: `POST /blueprints/{rid}/items/{itemRid}/retry` body: `{ userEdits? }`
  **依赖**: T011

- [ ] **T013**: Workshop store 扩展 + 类型扩展
  **文件**: `apps/web/src/pages/workshop/stores/workshop-store.ts`, `apps/web/src/pages/workshop/types.ts`
  **逻辑**:
  - **workshop-store.ts**: 新增 2 个状态字段和对应 setter：
    - `sidekickActiveTab: 'assistant' | 'review'` + `setSidekickActiveTab`（初始值 `'assistant'`）
    - `editingItemRid: string | null` + `setEditingItemRid`（初始值 `null`）
    - 在 `initialState` 和 `reset()` 中加入初始值
  - **types.ts**: 扩展 `WorkshopNode.status` 类型：
    - `status: 'confirmed' | 'pending' | 'accepted' | 'rejected' | 'failed'`
  **依赖**: 无

- [ ] **T014**: i18n 翻译键
  **文件**: `apps/web/src/locales/zh-CN/common.json`, `apps/web/src/locales/en-US/common.json`
  **逻辑**: 新增 `workshop.review.*` 前缀的约 30 个翻译键：
  - Tab: `workshop.review.tabTitle` = "审查" / "Review"
  - Toolbar: `workshop.review.acceptAll` = "全部接受" / "Accept All", `workshop.review.batchReject` = "批量拒绝" / "Batch Reject", `workshop.review.applyBlueprint` = "应用蓝图" / "Apply Blueprint", `workshop.review.discardBlueprint` = "放弃蓝图" / "Discard Blueprint"
  - Filter: `workshop.review.filterByType` = "按类型筛选" / "Filter by Type", `workshop.review.filterByConfidence` = "按置信度筛选" / "Filter by Confidence"
  - Table columns: `workshop.review.colType`, `workshop.review.colName`, `workshop.review.colDetail`, `workshop.review.colConfidence`, `workshop.review.colSource`, `workshop.review.colActions`
  - Actions: `workshop.review.accept`, `workshop.review.edit`, `workshop.review.reject`, `workshop.review.confirmEdit`, `workshop.review.cancelEdit`, `workshop.review.confirmReject`
  - Rejection reasons: `workshop.review.reasonIrrelevant` = "与业务不相关", `workshop.review.reasonDuplicate` = "已有类似对象类型", `workshop.review.reasonInaccurate` = "名称/属性不准确", `workshop.review.reasonOther` = "其他"
  - Apply: `workshop.review.applyProgress` = "正在应用蓝图...", `workshop.review.applySuccess` = "应用成功", `workshop.review.applyPartialFail` = "部分失败", `workshop.review.retryItem` = "编辑后重试", `workshop.review.skipItem` = "跳过"
  - Tooltips: `workshop.review.decisionLocked` = "决策已锁定，不可修改", `workshop.review.noActionableItems` = "请至少接受或编辑一项"
  - Empty/Loading: `workshop.review.empty` = "暂无蓝图建议", `workshop.review.analyzing` = "Agent 正在分析..."
  - Discard confirm: `workshop.review.discardConfirmTitle`, `workshop.review.discardConfirmContent`
  - Sources: `workshop.review.sourceFieldAnalysis`, `workshop.review.sourcePatternMatching`, `workshop.review.sourceSemanticInference`, `workshop.review.sourceBestPractices`
  **依赖**: 无

### Phase 5: 前端组件 — 审查表格核心

- [ ] **T015**: SidekickPanel Tabs 改造
  **文件**: `apps/web/src/pages/workshop/components/SidekickPanel.tsx`
  **逻辑**: 将单一面板改造为 Ant Design `Tabs`：
  - 导入 `Tabs` from `antd`，读取 `sidekickActiveTab` + `setSidekickActiveTab` from workshop-store
  - Tab 1 "助理" (key=`assistant`): 包裹现有内容（PlanProgressTree + SuggestionCard list + BlueprintSummary）
  - Tab 2 "审查" (key=`review`): 渲染 `<BlueprintReviewPanel />`，仅当 `pageState === 'blueprint_pending'` 或蓝图状态为 `applied` 时显示此 Tab
  - 蓝图到达 `pending_review` 时自动切换到审查 Tab（通过 useEffect 监听蓝图状态变化）
  - 暗色主题样式：Tabs 颜色继承工坊深色背景
  - Props 传递 `blueprintRid` 到 BlueprintReviewPanel
  **测试**: 渲染测试 — 验证双 Tab 切换、条件显示
  **覆盖 AC**: AC-01
  **依赖**: T012, T013, T014

- [ ] **T016**: BlueprintReviewPanel + ReviewToolbar
  **文件**: `apps/web/src/pages/workshop/components/BlueprintReviewPanel.tsx`, `apps/web/src/pages/workshop/components/ReviewToolbar.tsx`
  **逻辑**:
  - **BlueprintReviewPanel**: 顶层容器，使用 `useBlueprintDetail(blueprintRid)` 获取蓝图数据。根据蓝图状态渲染不同内容：
    - `draft` → "Agent 正在分析..." 加载态
    - `pending_review` → ReviewToolbar + BlueprintReviewTable + 相关 Modal/Alert
    - `applied` → 只读汇总面板（成功/失败/跳过统计）
    - 无蓝图 → 空状态 "暂无蓝图建议"
  - **ReviewToolbar**: 工具栏组件，Props: `{ items, selectedRowKeys, onAcceptAll, onBatchReject, onApply, onDiscard, filters, onFilterChange }`
    - "全部接受" Button（primary ghost）
    - "批量拒绝" Button（danger，仅 `selectedRowKeys.length > 0` 时启用）
    - 类型筛选 Select: 选项 OT/Property/LT
    - 置信度筛选 Select: 选项 高/中/低
    - "放弃蓝图" Button（danger text）
    - "应用蓝图" Button（primary，禁用条件: 无 accepted/edited 项）
    - 所有文案用 `t()` 国际化
  **测试**: 渲染测试 — 空状态、加载态、按钮禁用态
  **覆盖 AC**: AC-01, AC-12, AC-16, AC-21
  **依赖**: T015

- [ ] **T017**: BlueprintReviewTable（核心表格 + 行操作）
  **文件**: `apps/web/src/pages/workshop/components/BlueprintReviewTable.tsx`
  **逻辑**: Ant Design `Table` 组件，展示蓝图项列表：
  - **rowSelection**: 启用勾选框（仅未决策项可勾选），`selectedRowKeys` 通过 props 传出
  - **Columns**:
    - 类型图标: 根据 `itemType` 显示 🔵OT / 🟣Prop / 🔗LT 图标
    - 名称: `suggestion.displayName`
    - 详情: OT → 属性数（`suggestion.properties?.length`），LT → sideA→sideB
    - 置信度: Badge 组件，颜色由 `confidenceLevel` 决定（green/gold/red），显示百分比
    - 来源: Tag 组件，`t('workshop.review.source' + capitalize(source))`
    - 操作: 3 个按钮（Accept ✓ / Edit ⚙️ / Reject ✗），已决策项按钮禁用 + Tooltip (AC-05)
  - **行样式**: 根据 `userDecision` 设置行 className：`pending`(默认) / `accepted`(绿色背景) / `edited`(蓝色背景) / `rejected`(红色删除线) / `failed`(红色背景)
  - **行交互**:
    - `onRow.onMouseEnter` → `setHighlightedEntityRids([item.rid])` (AC-02)
    - `onRow.onMouseLeave` → `clearHighlights()`
    - `onRow.onClick` → `setFocusedEntityRid(item.blueprintItemRid)` (AC-03)
  - **Accept 按钮 onClick**: 调用 `useUpdateItemDecision` 设 `accepted` → 成功后触发 `addShockwave` (AC-04)
  - **Edit 按钮 onClick**: 设置 `expandedRowKeys` 展开当前行 (AC-06)
  - **Reject 按钮 onClick**: 渲染 `RejectionReasonPopover` (AC-09)
  - **expandedRowRender**: 渲染 `InlineEditForm` (AC-06)
  - **筛选**: 通过 props 接收 `filters: { type?, confidenceLevel? }`，过滤 `dataSource`
  **测试**: 渲染测试 — 列渲染、行样式、按钮禁用
  **覆盖 AC**: AC-01, AC-02, AC-03, AC-04, AC-05, AC-06, AC-09, AC-12
  **依赖**: T016

### Phase 6: 前端组件 — 编辑、拒绝、3D 联动

- [ ] **T018**: InlineEditForm
  **文件**: `apps/web/src/pages/workshop/components/InlineEditForm.tsx`
  **逻辑**: Ant Design `Form` 组件，根据 `itemType` 渲染不同字段：
  - **OT**: `displayName` (Input), `apiName` (Input), `description` (TextArea), `icon` (Input)
  - **Property**: `displayName` (Input), `apiName` (Input), `baseType` (Select: string/integer/float/boolean/datetime/array/object), `required` (Switch), `primaryKey` (Switch)
  - **LinkType**: `displayName` (Input), `sideA` (只读文本), `sideB` (只读文本), `cardinality` (Select: one-to-one/one-to-many/many-to-many)
  - Props: `{ item: BlueprintItem, onConfirm: (edits) => void, onCancel: () => void }`
  - 初始值从 `item.userEdits ?? item.suggestion` 取
  - "确认" 按钮: 调用 `useUpdateItemDecision` 设 `edited` + `userEdits={表单值}` → 成功后调用 `onConfirm` (AC-07)
  - "取消" 按钮: 调用 `onCancel`，不发请求 (AC-08)
  - 所有 label 用 `t()` 国际化
  **测试**: 渲染测试 — OT/Property/LT 三种表单切换、确认/取消行为
  **覆盖 AC**: AC-06, AC-07, AC-08
  **依赖**: T017

- [ ] **T019**: RejectionReasonPopover
  **文件**: `apps/web/src/pages/workshop/components/RejectionReasonPopover.tsx`
  **逻辑**: Ant Design `Popover` 组件：
  - 触发元素: Reject ✗ 按钮（由 BlueprintReviewTable 传入）
  - 内容: `Radio.Group` 含 4 个预设原因：
    1. "与业务不相关" (`irrelevant`)
    2. "已有类似对象类型" (`duplicate`)
    3. "名称/属性不准确" (`inaccurate`)
    4. "其他" (`other`) — 选中后显示 `Input` 自定义输入
  - "确认拒绝" Button: 调用 `useUpdateItemDecision` 设 `rejected` + `rejectionReason` → 成功后触发 `addCollapse`（3D 消散动画）+ 关闭 Popover (AC-10)
  - Props: `{ item, onConfirm: () => void }`
  - 所有文案用 `t()` 国际化
  **测试**: 渲染测试 — Popover 打开、选项选择、确认后关闭
  **覆盖 AC**: AC-09, AC-10
  **依赖**: T017

- [ ] **T020**: 3D 画布联动 — Accept/Reject 动画触发
  **文件**: `apps/web/src/pages/workshop/components/BlueprintReviewTable.tsx` (修改)
  **逻辑**: 补充 Accept/Reject 操作后的 3D 联动逻辑：
  - **Accept 成功后**: 从蓝图项的 `suggestion` 中取坐标（若无坐标则从 WorkshopNode 查找），调用 `addShockwave({ id: uuid(), position, startTime: Date.now() })` 触发 crystallize 动画
  - **Reject 成功后**: 取坐标，调用 `addCollapse({ id: uuid(), position, color: '#ff4d4f', startTime: Date.now() })` 触发消散动画
  - **Batch Accept All 成功后**: 对每个更新的项逐个触发 shockwave（间隔 100ms，产生连锁效果）
  - **Batch Reject 成功后**: 对每个更新的项逐个触发 collapse
  - 使用 workshop-store 的 `addShockwave` 和 `addCollapse` actions
  **覆盖 AC**: AC-04, AC-10, AC-11, AC-22
  **依赖**: T017, T019

### Phase 7: 前端组件 — 应用流程

- [ ] **T021**: ApplyProgressModal + ConflictWarningAlert
  **文件**: `apps/web/src/pages/workshop/components/ApplyProgressModal.tsx`, `apps/web/src/pages/workshop/components/ConflictWarningAlert.tsx`
  **逻辑**:
  - **ConflictWarningAlert**: Ant Design `Alert` 组件，展示 `preApplyCheck.conflicts` 列表：
    - `api_name_collision`: 黄色警告，展示冲突的 apiName + 现有实体名称。可"忽略继续"
    - `dependency_missing`: 红色错误，展示缺失的 OT 名称。阻断应用，必须"返回修改"
    - Props: `{ conflicts, onIgnore, onGoBack }`
  - **ApplyProgressModal**: Ant Design `Modal` 组件，展示 apply 流程：
    - 阶段 1 — 预检: 调用 `usePreApplyCheck` → 有冲突则渲染 ConflictWarningAlert → 无冲突或忽略后进入阶段 2
    - 阶段 2 — 应用: 调用 `useApplyBlueprint` → 显示 Progress 条 + 逐项状态列表（✓ success / ✗ failed / ⊘ skipped）
    - 阶段 3 — 结果: 显示汇总（`succeeded`/`failed`/`skipped` 计数）。若有失败项，每项显示错误原因 + "编辑后重试" Button + "跳过" Button
    - "编辑后重试" → 展开内联编辑（复用 InlineEditForm），修改后调用 `useRetryItem`
    - "跳过" → 本地标记为 skipped（前端状态）
    - 所有失败项处理完后显示最终汇总
  - 放弃蓝图确认: `Modal.confirm()` 二次确认 → 调用 `PATCH /blueprints/{rid}` 设 `status=discarded` → 切换回助理 Tab
  **测试**: 渲染测试 — Modal 打开/关闭、冲突展示、进度展示
  **覆盖 AC**: AC-13, AC-14, AC-15, AC-16, AC-17, AC-18, AC-19, AC-20, AC-21
  **依赖**: T017, T018

### Phase 8: 前端测试

- [ ] **T022**: 前端组件测试补充
  **文件**: `apps/web/src/pages/workshop/__tests__/BlueprintReviewPanel.test.tsx`
  **逻辑**: Testing Library 渲染测试 + 核心交互测试：
  - `test_renders_review_tab_when_blueprint_pending`: mock `useBlueprintDetail` 返回 pending_review 蓝图 → 验证审查 Tab 可见
  - `test_renders_empty_state_when_no_items`: mock 空项列表 → 验证空状态占位
  - `test_accept_button_calls_mutation`: 点击 Accept → 验证 `useUpdateItemDecision` 被调用
  - `test_reject_shows_popover`: 点击 Reject → 验证 Popover 出现 + 4 个选项
  - `test_edit_expands_form`: 点击 Edit → 验证展开行出现编辑表单
  - `test_disabled_buttons_after_decision`: 已决策项 → 验证 3 个按钮 disabled
  - `test_apply_button_disabled_when_no_actionable`: 全部 rejected → 验证 Apply 按钮 disabled
  - `test_batch_accept_all`: 点击全部接受 → 验证 `useBatchUpdateDecisions` 被调用
  **覆盖 AC**: AC-01, AC-04, AC-05, AC-06, AC-09, AC-11, AC-16
  **依赖**: T021

---

## 实际偏差记录

> 完成后，在此记录实现与 spec.md 的偏差，供后续参考。
