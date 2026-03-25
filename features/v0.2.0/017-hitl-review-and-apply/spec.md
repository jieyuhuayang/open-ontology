# F017: HITL Review & Apply（人机审查与应用）

> 本文档合并需求规范与技术设计。需求部分描述业务能力，设计部分只写契约和决策（Why + What），不写实现步骤（How）。
> 前置步骤：Spec Discovery 已完成，4 个设计决策已与用户对齐。

**关联 PRD**: `docs/prd/0.2.0/AI 辅助本体构建 PRD.md` — §3.4（HITL 三级操作）、§3.5（置信度与 AI 提示）、§4.4（模块 D：HITL 蓝图审查与微调）
**架构参考**: `docs/architecture/01-system-architecture.md`
**版本契约**: `features/v0.2.0/release-contract.md`
**优先级**: P0
**所属版本**: v0.2.0

---

## 1. 概述与用户故事

F017 是 v0.2.0 的核心价值交付——将 Agent 生成的蓝图建议通过人机协同审查（Accept/Edit/Reject）转化为正式本体实体。后端蓝图基础设施（CRUD、状态机、3 阶段 apply 逻辑）已在 F014 中完成，F017 在此基础上补充：前端审查 UI、批量操作、应用前冲突预检、单项重试，以及 3D 画布联动。

F017 依赖 F014（蓝图数据模型）、F015（工坊布局）、F013（CLI 框架），三者均已完成。

### US-1 业务分析师通过审查表格批量审核蓝图建议

作为 **业务分析师**，
我希望 在工坊 Sidekick 面板中以表格形式审查所有蓝图项，一键接受高置信度建议、编辑需调整项、拒绝不相关项，
以便 在 5 分钟内完成本来需要数天的本体初稿审核工作。

### US-2 领域专家通过内联编辑微调蓝图建议

作为 **领域专家**，
我希望 展开蓝图项的编辑表单修改名称、属性类型、关系基数等字段，提交后自动标记为"已编辑"，
以便 在不离开审查流程的情况下精确调整 Agent 建议。

### US-3 数据架构师应用蓝图并处理部分失败

作为 **数据架构师**，
我希望 点击"应用蓝图"后看到逐项创建进度，失败项可单独编辑后重试，
以便 高效完成蓝图到正式本体的转化，即使遇到 apiName 冲突也能快速修正。

---

## 2. 验收标准

> AC-ID 在本特性内唯一。tasks.md 中的测试任务必须通过 `覆盖 AC: AC-NN` 追溯到此表。

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| **审查表格展示** | | | |
| AC-01 | 用户 | 蓝图到达 `pending_review` 状态后打开 Sidekick 面板 | Sidekick 显示双 Tab（"助理"/"审查"），自动切换到"审查"Tab。表格列出所有蓝图项，列：类型图标、名称、属性数（OT）/ 关联 OT（LT）、置信度徽标、来源标签、操作按钮。按 `sort_order` 排序 |
| AC-02 | 用户 | 鼠标悬停审查表格行 | 3D 画布中对应星体高亮（复用 `setHighlightedEntityRids`） |
| AC-03 | 用户 | 点击审查表格行 | 3D 画布中对应星体获得焦点锁定（复用 `setFocusedEntityRid`） |
| **Accept 操作** | | | |
| AC-04 | 用户 | 点击蓝图项的 ✓ Accept 按钮 | 调用 `PATCH /items/{item_rid}` 设置 `userDecision=accepted`。行样式变为绿色确认态。3D 画布中对应星体播放 crystallize 动画（复用 `addShockwave`） |
| AC-05 | 用户 | 对已决策项（已 accepted/edited/rejected）尝试操作 | 三个操作按钮均禁用，Tooltip 提示"决策已锁定，不可修改"（INV-11） |
| **Edit 操作** | | | |
| AC-06 | 用户 | 点击蓝图项的 ⚙️ Edit 按钮 | 展开行内编辑表单。OT 项显示：displayName、apiName、description、icon 字段。Property 项显示：displayName、apiName、baseType (Select)、required (Switch)、primaryKey (Switch)。LinkType 项显示：displayName、sideA/sideB OT 名称（只读）、cardinality (Select) |
| AC-07 | 用户 | 修改编辑表单字段后点击"确认" | 调用 `PATCH /items/{item_rid}` 设置 `userDecision=edited` + `userEdits={修改后的字段}`。行样式变为蓝色编辑态。编辑表单收起 |
| AC-08 | 用户 | 编辑表单中点击"取消" | 编辑表单收起，不发送请求，项保持未决策状态 |
| **Reject 操作** | | | |
| AC-09 | 用户 | 点击蓝图项的 ✗ Reject 按钮 | 弹出 Popover，显示 4 个预设拒绝原因（"与业务不相关"/"已有类似对象类型"/"名称/属性不准确"/"其他"）+ 自定义输入框 |
| AC-10 | 用户 | 选择拒绝原因后点击"确认拒绝" | 调用 `PATCH /items/{item_rid}` 设置 `userDecision=rejected` + `rejectionReason`。行样式变为红色删除线态。3D 画布中对应星体播放 collapse 消散动画（复用 `addCollapse`） |
| **批量操作** | | | |
| AC-11 | 用户 | 点击"全部接受"按钮 | 调用 `PATCH /items/batch-decision` 将所有未决策项（`userDecision=null`）批量设为 `accepted`。已决策项被跳过而非报错。表格更新所有行样式。3D 画布批量播放 crystallize 动画 |
| AC-12 | 用户 | 使用筛选器按置信度（高/中/低）或类型（OT/Property/LT）筛选 | 表格仅显示匹配项。批量操作（全部接受/批量拒绝）作用于当前筛选结果 |
| AC-22 | 用户 | 勾选多个未决策项后点击"批量拒绝" | 弹出拒绝原因 Popover（与单项拒绝相同），确认后调用 `PATCH /items/batch-decision` 设置 `userDecision=rejected` + `rejectionReason`。所有勾选项标记为 rejected。3D 画布批量播放 collapse 动画 |
| **应用蓝图** | | | |
| AC-13 | 用户 | 所有项已决策后点击"应用蓝图" | 先调用 `POST /pre-apply-check` 执行预检。无冲突时弹出进度 Modal，调用 `POST /apply`。Modal 显示逐项创建进度（成功 ✓ / 失败 ✗ / 跳过 ⊘）和汇总统计 |
| AC-14 | 用户 | 预检发现 apiName 冲突 | 显示冲突警告 Alert（列出冲突项 + 冲突的现有实体名称）。用户可选择"返回修改"或"忽略冲突继续应用" |
| AC-15 | 用户 | 预检发现依赖缺失（LinkType 引用的 OT 被 rejected） | 显示依赖警告 Alert（列出受影响的 LinkType 项 + 缺失的 OT）。用户必须返回修改（阻断应用） |
| AC-16 | 用户 | 无任何 accepted/edited 项时点击"应用蓝图" | 按钮禁用，Tooltip 提示"请至少接受或编辑一项"（INV-10） |
| AC-17 | 系统 | 执行 apply | 严格按 ObjectType → Property → LinkType 顺序创建（INV-15）。单项失败不阻断其他项 |
| **部分失败与重试** | | | |
| AC-18 | 用户 | Apply 完成且有失败项 | 进度 Modal 显示成功/失败/跳过统计。失败项展示错误原因，每项有"编辑后重试"和"跳过"按钮 |
| AC-19 | 用户 | 点击失败项的"编辑后重试" | 展开行内编辑表单（预填当前 suggestion + userEdits）。修改后点击"重试"，调用 `POST /items/{item_rid}/retry`。成功则更新为 ✓，失败则更新错误信息 |
| AC-20 | 用户 | 点击失败项的"跳过" | 该项标记为已跳过，不再参与后续重试。当所有失败项都处理完（重试成功或跳过）后，Modal 显示最终汇总 |
| **蓝图放弃** | | | |
| AC-21 | 用户 | 审查过程中点击"放弃蓝图" | 二次确认弹窗。确认后调用 `PATCH /blueprints/{rid}` 设置 `status=discarded`。审查 Tab 关闭，返回助理 Tab |

---

## 3. 边界情况

- 当蓝图无任何项时，审查 Tab 显示空状态占位（"暂无蓝图建议"）
- 当蓝图处于 `draft` 状态时（Agent 仍在分析），审查 Tab 显示"Agent 正在分析..."加载态，不可操作
- 当蓝图处于 `applied` 状态时，审查 Tab 显示只读汇总（成功/失败/跳过统计），不可操作
- 当两个用户同时 apply 同一蓝图时，行级锁（`SELECT ... FOR UPDATE`）保证只有一个成功，另一个收到 `BLUEPRINT_INVALID_STATUS_FOR_APPLY` 错误
- 当 retry 时依赖的 OT 在上一轮也失败了，retry 应使用当前数据库中已存在的 OT RID（而非 placeholder 映射）
- **不支持**：实体消歧裁决台（§4.5 并排比对 + 合并动画）— 延后到 v0.3.0
- **不支持**：自动化影响分析面板（§4.6 级联影响分析）— 延后到 v0.3.0
- **不支持**：循环链接检测和实体重复检测（相似度 > 80%）— 延后到 v0.3.0
- **不支持**：手动添加 Agent 遗漏的蓝图项 — 延后到 F018

---

## 4. 架构决策

| ID | 决策 | 选项 | 结论 | 理由 |
|----|------|------|------|------|
| AD-01 | 审查表格布局位置 | A: 底部可折叠面板 / B: Sidekick 内嵌 Tab / C: 全屏审查页 | 选 B | 用户确认。保持沉浸式工坊体验，不打断三面板布局；Sidekick 宽度足以容纳紧凑审查表格 |
| AD-02 | 3D 动画策略 | A: 新增专属动画 / B: 复用 F016 动画 / C: 最小视觉反馈 | 选 B | 用户确认。F016 的 crystallize（shockwave）和 collapse 效果已满足需求，避免重复开发 |
| AD-03 | 预检为独立端点 vs 集成到 apply | A: 独立 `pre-apply-check` 端点 / B: 集成到 `apply` 返回冲突 | 选 A | 预检不占行级锁时间；用户可在 apply 前看到冲突并修正 |
| AD-04 | 批量 Accept All 语义 | A: 报错若含已决策项 / B: 跳过已决策项 | 选 B | 用户可能先 reject 几项再 Accept All 其余，期望行为是"接受所有未决策项" |
| AD-05 | Retry 的蓝图状态 | A: 回退到 pending_review / B: 保持 applied | 选 B | 部分成功已创建真实实体，蓝图不应回退。retry 仅针对单项失败重新创建 |
| AD-06 | 编辑表单形式 | A: Drawer / B: Table expandedRowRender | 选 B | EntityDrawer 已用于 3D 画布实体详情；审查编辑嵌在表格展开行中保持流程连贯 |

---

## 5. 数据库 & Domain 模型

### 数据库变更

F017 **不新增数据库表或字段**。所有需要的字段（`user_decision`、`user_edits`、`rejection_reason`、`created_entity_rid`）已在 F014 的 `blueprint_items` 表中定义。

### 新增 Pydantic Domain 模型

在 `app/domain/blueprint.py` 中新增：

```python
class BlueprintItemBatchUpdate(DomainModel):
    """批量决策更新请求"""
    item_rids: list[str]
    user_decision: UserDecision
    rejection_reason: str | None = None

class ConflictCheckResult(DomainModel):
    """单项冲突检测结果"""
    item_rid: str
    conflict_type: str   # "api_name_collision" | "dependency_missing"
    message: str
    conflicting_entity_rid: str | None = None

class BlueprintPreApplyCheck(DomainModel):
    """Apply 前预检响应"""
    can_apply: bool
    conflicts: list[ConflictCheckResult]
    actionable_count: int     # accepted/edited 项数
    undecided_count: int      # 未决策项数

class BlueprintItemRetryRequest(DomainModel):
    """单项重试请求"""
    user_edits: dict | None = None

class BlueprintItemRetryResult(DomainModel):
    """单项重试结果"""
    item_rid: str
    status: str   # "success" | "failed"
    created_entity_rid: str | None = None
    error: str | None = None
```

---

## 6. API 契约

### 现有端点（F014 已实现，F017 前端消费）

| Method | Path | 描述 |
|--------|------|------|
| GET | `/api/v1/blueprints/{rid}` | 获取蓝图详情（含所有项） |
| PATCH | `/api/v1/blueprints/{rid}` | 更新蓝图（状态、名称） |
| PATCH | `/api/v1/blueprints/{rid}/items/{item_rid}` | 更新单项决策 |
| POST | `/api/v1/blueprints/{rid}/apply` | 应用蓝图 |

### 新增端点

| Method | Path | 描述 |
|--------|------|------|
| PATCH | `/api/v1/blueprints/{rid}/items/batch-decision` | 批量决策更新 |
| POST | `/api/v1/blueprints/{rid}/pre-apply-check` | Apply 前冲突预检 |
| POST | `/api/v1/blueprints/{rid}/items/{item_rid}/retry` | 单项重试 |

### 请求/响应示例

```jsonc
// PATCH /api/v1/blueprints/{rid}/items/batch-decision
// Request
{
  "itemRids": ["ri.ontology.blueprint-item.aaa", "ri.ontology.blueprint-item.bbb"],
  "userDecision": "accepted",
  "rejectionReason": null
}
// Response 200 — 实际更新的项列表（已决策项被跳过）
[
  { "rid": "ri.ontology.blueprint-item.aaa", "userDecision": "accepted", ... },
  { "rid": "ri.ontology.blueprint-item.bbb", "userDecision": "accepted", ... }
]

// POST /api/v1/blueprints/{rid}/pre-apply-check
// Request: 无 body
// Response 200
{
  "canApply": true,
  "conflicts": [
    {
      "itemRid": "ri.ontology.blueprint-item.ccc",
      "conflictType": "api_name_collision",
      "message": "apiName 'Order' 与现有 ObjectType 'ri.ontology.object-type.xxx' 冲突",
      "conflictingEntityRid": "ri.ontology.object-type.xxx"
    }
  ],
  "actionableCount": 8,
  "undecidedCount": 0
}

// POST /api/v1/blueprints/{rid}/items/{item_rid}/retry
// Request
{
  "userEdits": { "apiName": "CustomerOrder" }
}
// Response 200
{
  "itemRid": "ri.ontology.blueprint-item.ccc",
  "status": "success",
  "createdEntityRid": "ri.ontology.object-type.new-uuid",
  "error": null
}
```

### 错误码表

| HTTP Status | Code | 场景 | 关联 AC |
|-------------|------|------|---------|
| 422 | `BLUEPRINT_INVALID_STATUS_TRANSITION` | 蓝图不在 `pending_review` 状态时尝试更新决策 | AC-05 |
| 422 | `BLUEPRINT_ITEM_DECISION_IMMUTABLE` | 尝试修改已设置的决策（INV-11） | AC-05 |
| 422 | `BLUEPRINT_INVALID_STATUS_FOR_APPLY` | 蓝图不在 `pending_review` 状态时尝试 apply | AC-16 |
| 422 | `BLUEPRINT_NO_ACTIONABLE_ITEMS` | 无 accepted/edited 项时 apply（INV-10） | AC-16 |
| 422 | `BLUEPRINT_ITEM_NOT_RETRYABLE` | 项不满足重试条件（非 applied 蓝图、非失败项） | AC-19 |
| 404 | `BLUEPRINT_NOT_FOUND` | 蓝图不存在 | — |
| 404 | `BLUEPRINT_ITEM_NOT_FOUND` | 蓝图项不存在 | — |

---

## 7. Service / Router 层逻辑

### BlueprintService 新增方法

- **`batch_update_decisions(blueprint_rid, req: BlueprintItemBatchUpdate)`**: 验证蓝图状态为 `pending_review`。遍历 `item_rids`，对每项调用现有 `update_item_decision` 逻辑。已有 decision 的项跳过（不报错），返回实际更新的项列表。
- **`pre_apply_check(rid)`**: 收集所有 accepted/edited 项。Phase 1: 对每个 OT 项检查 `apiName` 是否与现有 ObjectType 冲突（查询 `object_types` 表）。Phase 2: 对每个 LinkType 项检查依赖的 OT placeholderRid 是否有对应的 accepted/edited OT 项。返回冲突列表 + 统计。
- **`retry_item(blueprint_rid, item_rid, user_edits)`**: 前置条件: 蓝图状态为 `applied`，该项 `user_decision` 为 accepted/edited，且 `created_entity_rid` 为 null（apply 时失败）。按项类型单独创建（复用 apply 的 Phase 逻辑）。RID 映射从已成功项的 `created_entity_rid` 构建。成功后更新 `created_entity_rid`。若传入 `user_edits`，合并到原始 suggestion/userEdits 上。

### Router 层

3 个新端点均为薄壳，解析 HTTP 参数后委托给 `BlueprintService` 对应方法。

---

## 8. Agent 集成设计

F017 不新增 Agent Skill 或 SSE 事件。F017 消费 F014 已有的蓝图数据（通过 API 查询），不直接与 Agent 引擎交互。

---

## 9. 前端组件设计

### SidekickPanel 改造

将现有 `SidekickPanel` 从单一面板改造为 Ant Design `Tabs` 组件：

```
SidekickPanel (修改)
├── Tabs
│   ├── Tab "助理" (key="assistant")
│   │   ├── PlanProgressTree (现有)
│   │   ├── SuggestionCard list (现有)
│   │   └── BlueprintSummary (现有)
│   └── Tab "审查" (key="review", 仅 blueprint pending_review/applied 时可见)
│       └── BlueprintReviewPanel (新增)
│           ├── ReviewToolbar
│           │   ├── "全部接受" Button
│           │   ├── 类型筛选 Select (OT/Property/LT)
│           │   ├── 置信度筛选 Select (高/中/低)
│           │   ├── "放弃蓝图" Button (danger)
│           │   └── "应用蓝图" Button (primary, 禁用态由 AC-16 控制)
│           ├── BlueprintReviewTable (Ant Table)
│           │   ├── Columns: 类型图标 | 名称 | 详情 | 置信度 | 来源 | 操作
│           │   ├── expandedRowRender → InlineEditForm
│           │   └── 行样式: pending(默认) / accepted(绿) / edited(蓝) / rejected(红线) / failed(红底)
│           ├── RejectionReasonPopover
│           ├── ApplyProgressModal
│           └── ConflictWarningAlert
```

### 新增前端组件

| 组件 | 文件 | 职责 |
|------|------|------|
| `BlueprintReviewPanel` | `pages/workshop/components/BlueprintReviewPanel.tsx` | 审查主面板容器，组合 Toolbar + Table + Modal |
| `BlueprintReviewTable` | `pages/workshop/components/BlueprintReviewTable.tsx` | Ant Table，展示蓝图项列表，行交互（hover 高亮、点击聚焦、操作按钮） |
| `ReviewToolbar` | `pages/workshop/components/ReviewToolbar.tsx` | 工具栏（批量操作 + 筛选 + Apply 按钮） |
| `InlineEditForm` | `pages/workshop/components/InlineEditForm.tsx` | 按 item_type 渲染不同字段的 Ant Form |
| `RejectionReasonPopover` | `pages/workshop/components/RejectionReasonPopover.tsx` | Popover + Radio.Group（4 个预设原因）+ Input（自定义） |
| `ApplyProgressModal` | `pages/workshop/components/ApplyProgressModal.tsx` | Modal 展示 apply 进度 + 结果汇总 + 失败项 retry/skip |
| `ConflictWarningAlert` | `pages/workshop/components/ConflictWarningAlert.tsx` | Alert 展示预检冲突列表 |

### 新增 API hooks

在 `api/blueprints.ts` 中新增：

| Hook | 端点 | 类型 |
|------|------|------|
| `useUpdateItemDecision` | `PATCH /items/{item_rid}` | useMutation |
| `useBatchUpdateDecisions` | `PATCH /items/batch-decision` | useMutation |
| `usePreApplyCheck` | `POST /pre-apply-check` | useMutation |
| `useApplyBlueprint` | `POST /apply` | useMutation |
| `useRetryItem` | `POST /items/{item_rid}/retry` | useMutation |

所有 mutation 的 `onSuccess` 回调调用 `queryClient.invalidateQueries(blueprintKeys.detail(rid))` 刷新缓存。

### 状态管理

| 数据 | 存放位置 | 原因 |
|------|---------|------|
| Blueprint + Items | TanStack Query cache | 服务端状态 |
| `sidekickActiveTab` | Zustand workshop-store | 跨组件（Tab 切换 + 蓝图状态联动） |
| `editingItemRid` | Zustand workshop-store | 跨组件（表格行 ↔ 3D 高亮） |
| 筛选条件 | React local state | 仅 ReviewToolbar 内部 |
| 展开行 keys | React local state | 仅 BlueprintReviewTable 内部 |
| Apply 进度 | React local state (Modal) | 仅 Modal 生命周期 |

Workshop store 新增字段：
- `sidekickActiveTab: 'assistant' | 'review'` + `setSidekickActiveTab`
- `editingItemRid: string | null` + `setEditingItemRid`

### WorkshopNode status 扩展

`types.ts` 中 `WorkshopNode.status` 从 `'confirmed' | 'pending'` 扩展为：

```typescript
status: 'confirmed' | 'pending' | 'accepted' | 'rejected' | 'failed';
```

- `'accepted'` — 用户已接受，待 apply（3D: 半透明→实体，crystallize 动画后）
- `'rejected'` — 用户已拒绝（3D: collapse 动画后移除）
- `'failed'` — apply 失败（3D: 红色闪烁）

### i18n

新增约 30 个翻译键，前缀 `workshop.review.*`，覆盖：
- Tab 标题、工具栏按钮、表格列头
- 操作按钮文案、Popover 内容、Modal 标题和描述
- 拒绝原因预设选项、错误提示、空状态占位

---

## 10. 文件清单

```
apps/server/
├── app/domain/blueprint.py                    # 修改 — 新增 5 个 Domain 模型
├── app/services/blueprint_service.py          # 修改 — 新增 3 个方法
├── app/routers/blueprints.py                  # 修改 — 新增 3 个端点
├── app/storage/blueprint_storage.py           # 修改 — 新增 2 个查询方法
├── tests/unit/test_blueprint_service.py       # 修改 — 新增测试
└── tests/integration/test_blueprint_api.py    # 修改 — 新增测试

apps/web/src/
├── api/blueprints.ts                          # 修改 — 新增 5 个 mutation hooks
├── pages/workshop/
│   ├── components/
│   │   ├── SidekickPanel.tsx                  # 修改 — 改造为 Tabs
│   │   ├── BlueprintReviewPanel.tsx           # 新增
│   │   ├── BlueprintReviewTable.tsx           # 新增
│   │   ├── ReviewToolbar.tsx                  # 新增
│   │   ├── InlineEditForm.tsx                 # 新增
│   │   ├── RejectionReasonPopover.tsx         # 新增
│   │   ├── ApplyProgressModal.tsx             # 新增
│   │   └── ConflictWarningAlert.tsx           # 新增
│   ├── stores/workshop-store.ts               # 修改 — +2 字段
│   └── types.ts                               # 修改 — 扩展 WorkshopNode status
└── locales/
    ├── zh-CN/common.json                      # 修改 — +~30 keys
    └── en-US/common.json                      # 修改 — +~30 keys
```

---

## 非功能要求

- **性能**: pre-apply-check 应在 2s 内完成（蓝图项 ≤ 100 个场景）；apply 进度应实时反馈
- **安全**: retry 端点校验蓝图状态和项状态，防止重复创建
- **可用性**: 所有操作有 loading 状态；错误有中文可读提示；批量操作有确认机制

---

## 依赖与约束

- **F014**（Material & Blueprint）: 蓝图 CRUD、状态机、apply 逻辑、Domain 模型 — ✅ 已完成
- **F015**（Workshop Foundation）: 三面板布局、SidekickPanel、3D 画布、SSE 通信 — ✅ 已完成
- **F016**（Workshop Enhancement）: crystallize/collapse 动画、焦点锁定、高亮联动 — ✅ 已完成
- **F013**（CLI & Skills）: `oo blueprint apply` CLI 命令 — ✅ 已完成
- **INV-10**: Blueprint `pending_review` → `applied` 需至少 1 个 accepted/edited 项
- **INV-11**: BlueprintItem.userDecision 一旦设置不可逆（null → accepted/edited/rejected）
- **INV-15**: Apply 按 ObjectType → Property → LinkType 顺序创建
- **INV-16**: 所有建议项必须携带置信度和来源标签（F014 已保证）

---

## 相关文档

- PRD: `docs/prd/0.2.0/AI 辅助本体构建 PRD.md` §3.4, §3.5, §4.4
- 版本契约: `features/v0.2.0/release-contract.md`
- F014 spec: `features/v0.2.0/014-material-and-blueprint/spec.md`
- F015 spec: `features/v0.2.0/015-workshop-foundation/spec.md`
- F016 spec: `features/v0.2.0/016-workshop-enhancement/spec.md`
