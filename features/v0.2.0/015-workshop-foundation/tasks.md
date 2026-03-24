# Tasks: F015 Workshop Foundation（本体工坊基础）

**关联规格**: [spec.md](./spec.md)
**版本**: v0.2.0

---

## 状态

| 步骤 | 状态 | 备注 |
|------|------|------|
| spec.md | ✅ 已评审 | 用户确认通过 |
| tasks.md | ✅ 已拆解 | 22 任务，6 Phase |
| 实现 | 🔲 未开始 | 0 / 22 完成 |

---

## 开发模式

**纯前端 Feature**：F015 不涉及后端变更，全部任务为前端 Test-Alongside 模式。
前端实现任务内含测试，或在同 phase 末尾补充测试任务。

**自包含任务**：每个任务内联文件、逻辑、测试上下文，实现阶段不需要回读 spec.md。

---

## Tasks

### Phase 0: 基础设施

- [ ] **T001**: API 类型生成 + 类型别名
  **文件**: `apps/web/src/generated/api.ts`（重新生成）, `apps/web/src/api/types.ts`（修改）
  **逻辑**:
  - 在 `apps/server/` 下运行 `PYTHONPATH=. uv run python -c "from app.main import app; import json; print(json.dumps(app.openapi()))" > openapi.json` 确保 openapi.json 包含最新的 Agent/Blueprint/Material schemas
  - 在 `apps/web/` 下运行 `pnpm exec openapi-typescript ../server/openapi.json -o src/generated/api.ts` 重新生成类型
  - 在 `api/types.ts` 中添加类型别名：
    ```typescript
    // Agent
    export type AgentSession = components['schemas']['AgentSession'];
    export type AgentSessionCreate = components['schemas']['AgentSessionCreate'];
    export type AgentSessionList = components['schemas']['AgentSessionList'];
    export type AgentSessionDetail = components['schemas']['AgentSessionDetail'];
    export type AgentMessage = components['schemas']['AgentMessage'];
    export type ChatRequest = components['schemas']['ChatRequest'];
    // Material
    export type AgentMaterial = components['schemas']['AgentMaterial'];
    // Blueprint
    export type Blueprint = components['schemas']['Blueprint'];
    export type BlueprintItem = components['schemas']['BlueprintItem'];
    export type BlueprintDetail = components['schemas']['BlueprintDetail'];
    export type BlueprintList = components['schemas']['BlueprintList'];
    ```
  **影响范围**: `api/types.ts` 仅追加新类型别名，不修改现有导出；`generated/api.ts` 完整重新生成但不影响现有类型引用
  **依赖**: 无

- [ ] **T002**: API Hooks — Agent 会话 + 素材 + 蓝图
  **文件**: `apps/web/src/api/agent.ts`（新建）, `apps/web/src/api/materials.ts`（新建）, `apps/web/src/api/blueprints.ts`（新建）
  **逻辑**:
  - `agent.ts`: agentSessionKeys 工厂 + useAgentSessions(ontologyRid, page, pageSize) + useAgentSessionDetail(rid) + useCreateAgentSession() mutation + useDeleteAgentSession() mutation。遵循 `api/object-types.ts` 模式
  - `materials.ts`: materialKeys 工厂 + useMaterials(sessionRid) + useUploadMaterial() mutation（multipart/form-data，使用 `apiClient.post('/agent/materials/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })`）+ useDeleteMaterial() mutation
  - `blueprints.ts`: blueprintKeys 工厂 + useBlueprints(params: { sessionRid?, ontologyRid? }) + useBlueprintDetail(rid) 查询 hooks
  - 所有 mutation 的 onSuccess 做适当的 queryClient.invalidateQueries
  **测试**: TypeScript 编译通过即可验证类型正确性；hook 功能由 T007(GuidanceCard)/T008(FileUpload)/T009(ChatPanel) 组件集成测试覆盖
  **覆盖 AC**: AC-06, AC-07, AC-15
  **依赖**: T001

- [ ] **T003**: Workshop Store + 前端类型定义
  **文件**: `apps/web/src/pages/workshop/stores/workshop-store.ts`（新建）, `apps/web/src/pages/workshop/types.ts`（新建）, `apps/web/src/pages/workshop/stores/__tests__/workshop-store.test.ts`（新建）
  **逻辑**:
  - `types.ts`: 定义 WorkshopPageState('empty'|'existing'|'analyzing'|'blueprint_pending'|'disconnected'), WorkshopNode(id/type/displayName/apiName/description/icon/color/properties/position/status/confidence/confidenceLevel/reasoning/source/blueprintItemRid), WorkshopEdge(id/sourceNodeId/targetNodeId/label/cardinality/status/confidence/confidenceLevel/blueprintItemRid), WorkshopProperty(displayName/apiName/baseType), DragLinkState(sourceNodeId/sourcePosition/currentPointerPosition/hoveredTargetId), SSEEvent 联合类型(7 种事件), SSEBlueprintItemData
  - `workshop-store.ts`: Zustand store，包含：pageState + setPageState, currentSessionRid + setCurrentSessionRid, connectionStatus('idle'|'connected'|'reconnecting'|'disconnected') + setConnectionStatus, selectedEntityRid + hoveredEntityRid, isChatPanelExpanded + isSidekickOpen + toggle 方法, planSteps + addPlanStep + clearPlanSteps, pendingCrystallizations + addPendingCrystallization + consumeCrystallization, reset()
  **测试**: 在 `stores/__tests__/workshop-store.test.ts` 中测试核心状态转换（pageState、connectionStatus、面板切换、结晶队列增删）
  **覆盖 AC**: AC-02, AC-03, AC-36, AC-37, AC-38, AC-39, AC-40
  **依赖**: 无

### Phase 1: 布局与路由

- [ ] **T004**: WorkshopPage 主页面 + 路由注册 + 暗色主题样式
  **文件**: `apps/web/src/pages/workshop/WorkshopPage.tsx`（新建）, `apps/web/src/pages/workshop/styles/workshop.module.css`（新建）, `apps/web/src/router.tsx`（修改）
  **逻辑**:
  - `WorkshopPage.tsx`: 全屏三面板 Flexbox 容器（100vw × 100vh，暗色背景 #0a0a1a）。左侧预留 ChatPanel slot（宽度 380px，可折叠到 48px），中央 flex:1 预留 StarfieldWorkbench slot，右侧预留 SidekickPanel slot（宽度 320px，可折叠到 0px）。左上角返回按钮（Link to `/`）。面板折叠/展开从 workshop-store 读取 + 控制
  - `workshop.module.css`: 暗色主题变量（--ws-bg, --ws-panel-bg, --ws-text, --ws-border），面板过渡动画，全屏布局
  - `router.tsx`: 在 routeConfig 顶层添加 `{ path: '/workshop', lazy: () => import('@/pages/workshop/WorkshopPage') }`，与 `/demo/canvas` 同级，独立于 HomeLayout
  - 初始阶段各 slot 渲染占位 div（后续任务逐步替换）
  **测试**: 渲染测试验证三面板布局 + 返回按钮 + 面板折叠
  **覆盖 AC**: AC-01, AC-02, AC-03, AC-04
  **依赖**: T003

- [ ] **T005**: WorkshopToolbar 画布工具栏
  **文件**: `apps/web/src/pages/workshop/components/WorkshopToolbar.tsx`（新建）
  **逻辑**:
  - 底部工具栏（fixed 在画布区域底部居中），包含 3 个按钮：缩放适配（fit-to-view）、重置视角（reset camera）、缩放+/缩放-
  - 按钮通过 callback props 驱动（与 R3F 的 OrbitControls ref 交互，由 T012 WorkshopCanvas 连接）
  - 暗色半透明背景，图标使用 Ant Design Icons
  **测试**: 由 T022 WorkshopPage 渲染测试覆盖（验证工具栏按钮存在 + 点击回调触发）
  **覆盖 AC**: AC-27, AC-28
  **依赖**: T004

### Phase 2: 对话面板（ChatPanel）

- [ ] **T006**: MessageBubble + MessageList + ChatInput 组件
  **文件**: `apps/web/src/pages/workshop/components/MessageBubble.tsx`（新建）, `apps/web/src/pages/workshop/components/MessageList.tsx`（新建）, `apps/web/src/pages/workshop/components/ChatInput.tsx`（新建）
  **逻辑**:
  - `MessageBubble.tsx`: 接收 role('user'|'assistant'), content, isStreaming 属性。用户消息右对齐蓝色背景，Agent 消息左对齐深色背景。流式消息显示闪烁光标
  - `MessageList.tsx`: 可滚动容器（flex:1, overflow-y:auto），渲染 MessageBubble 数组。新消息自动滚动到底部（useEffect + scrollIntoView）
  - `ChatInput.tsx`: 底部固定输入框（Ant Design Input.TextArea 暗色主题）+ 发送按钮（Paper Plane 图标）+ 📎 上传触发按钮。props: onSend(content), onUploadClick, disabled(流式中禁用), placeholder。按 Enter 发送（Shift+Enter 换行）
  - 所有用户可见字符串使用 `t('workshop.xxx')`
  **测试**: 由 T022 补充 ChatInput 渲染测试（验证 Enter 发送、Shift+Enter 换行、disabled 状态禁用发送按钮）
  **覆盖 AC**: AC-08, AC-12
  **依赖**: T004

- [ ] **T007**: GuidanceCard Phase 0 引导卡片
  **文件**: `apps/web/src/pages/workshop/components/GuidanceCard.tsx`（新建）
  **逻辑**:
  - 卡片组件，显示在对话面板中（仅 pageState='empty' 时渲染）
  - 包含 3 个可选字段：
    1. 业务领域：Tag 选择器（电商零售/金融银行/供应链物流/医疗健康/制造业/人力资源）+ 自定义输入
    2. 建模目标：Tag 选择器（数据整合与搜索/决策分析与报表/知识图谱探索/AI 应用基座/数据治理合规）
    3. 关键概念范围：文本框，placeholder "例如：聚焦订单履约流程，不含财务对账"
  - "确认并继续"按钮：调用 useCreateAgentSession() mutation，传入 { ontologyRid, domain, goal, scopeHint }，成功后 store.setCurrentSessionRid(rid) + store.setPageState('existing')
  - "跳过"按钮：调用 useCreateAgentSession() 不传可选字段
  **测试**: 由 T022 补充 GuidanceCard 渲染测试（验证领域选择器渲染、确认按钮调用 mutation、跳过按钮调用 mutation）
  **覆盖 AC**: AC-05, AC-06, AC-07
  **依赖**: T002, T003, T006

- [ ] **T008**: FileUploadArea + FileThumbnailCard 文件上传
  **文件**: `apps/web/src/pages/workshop/components/FileUploadArea.tsx`（新建）, `apps/web/src/pages/workshop/components/FileThumbnailCard.tsx`（新建）
  **逻辑**:
  - `FileUploadArea.tsx`: 拖放区域组件（dragover/drop 事件），覆盖对话面板区域。拖入时显示虚线高亮边框 + "释放以上传文件" 文字。支持的 MIME 类型白名单：text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/sql, application/pdf, text/markdown, application/vnd.openxmlformats-officedocument.wordprocessingml.document, text/plain。前端预校验：类型不匹配显示 Toast（message.error）；文件大小 > 10MB 显示 Toast。校验通过后调用 useUploadMaterial() mutation
  - `FileThumbnailCard.tsx`: 接收 material: AgentMaterial, uploadProgress?: number。展示文件名、大小（格式化为 KB/MB）、类型图标（不同类型不同颜色）、上传进度条（progress < 100 时显示）、完成状态 ✓
  **测试**: 由 T022 补充 FileUploadArea 测试（验证拖放高亮、文件类型校验 Toast、文件大小校验 Toast、上传 mutation 调用）
  **覆盖 AC**: AC-14, AC-15, AC-16, AC-17, AC-18, AC-19
  **依赖**: T002, T006

- [ ] **T009**: ChatPanel 容器组件 + 会话恢复
  **文件**: `apps/web/src/pages/workshop/components/ChatPanel.tsx`（新建）
  **逻辑**:
  - 左侧面板容器，组合 GuidanceCard + FileUploadArea + MessageList + ChatInput
  - 页面加载时：检查是否有 active 的 AgentSession（调用 useAgentSessions 查询 status=active）。若有，自动恢复：setCurrentSessionRid + 通过 useAgentSessionDetail 加载消息历史到 MessageList
  - 面板头部显示当前会话标题（可编辑，或显示"新工坊"）
  - 折叠状态下仅显示窄条 + 展开按钮
  - 错误提示条渲染：当 useAgentChat 返回 error 状态时，在消息列表底部显示红色错误提示条（含错误码 + 消息），流终止后可关闭
  **测试**: 由 T022 补充 ChatPanel 测试（验证会话恢复加载消息、错误提示条渲染）
  **覆盖 AC**: AC-11, AC-13
  **依赖**: T006, T007, T008

- [ ] **T010**: useAgentChat Hook — SSE 流式对话
  **文件**: `apps/web/src/pages/workshop/hooks/use-agent-chat.ts`（新建）, `apps/web/src/pages/workshop/hooks/use-sse-parser.ts`（新建）
  **逻辑**:
  - `use-sse-parser.ts`: SSE 事件解析工具函数 `parseSSELine(line: string) → SSEEvent | null`。处理 `event:` 和 `data:` 行，返回类型化的 SSEEvent 联合类型。处理多行 data 拼接、空行分隔
  - `use-agent-chat.ts`: Hook 签名 `useAgentChat(sessionRid: string | null)`
    - 返回: `{ messages, streamingText, isStreaming, connectionStatus, send, reconnect }`
    - `send(content)`: POST `/api/v1/agent/chat` 使用 fetch（非 axios），响应类型 text/event-stream。通过 ReadableStream + TextDecoder 逐行读取，调用 parseSSELine 解析事件
    - 事件分发（通过 workshop-store）：
      - `text-delta` → 追加到 streamingText 状态
      - `plan-step` → store.addPlanStep()
      - `blueprint-item` → store.addPendingCrystallization() + queryClient.invalidateQueries(['blueprints'])
      - `blueprint-complete` → store.setPageState('blueprint_pending')
      - `done` → 将 streamingText 转为完整消息追加到 messages, 清空 streamingText, isStreaming=false
      - `error` → 设置错误状态
    - SSE 断连处理：fetch 异常时进入 reconnecting 状态，指数退避重试（1s→2s→4s→8s→max 30s），超过 30s 进入 disconnected
    - `reconnect()`: 手动重连方法
  **测试**: 单元测试 `use-sse-parser.ts`（测试各种 SSE 行解析）；`use-agent-chat.ts` 测试使用 mock fetch 验证事件分发
  **覆盖 AC**: AC-08, AC-09, AC-10, AC-11, AC-12, AC-39, AC-40, AC-41
  **依赖**: T002, T003

### Phase 3: 3D 星空画布（StarfieldWorkbench）

- [ ] **T011**: useWorkshopGraph Hook — 图模型合并
  **文件**: `apps/web/src/pages/workshop/hooks/use-workshop-graph.ts`（新建）
  **逻辑**:
  - Hook 签名: `useWorkshopGraph(ontologyRid: string, blueprintRid: string | null)`
  - 数据源 1: useObjectTypes() 获取已有 ObjectType → 转为 WorkshopNode (status='confirmed', 明亮)
  - 数据源 2: useLinkTypes() 获取已有 LinkType → 转为 WorkshopEdge (status='confirmed')
  - 数据源 3: useBlueprintDetail(blueprintRid) 获取蓝图项 → item_type='object_type' 转为 WorkshopNode (status='pending'), item_type='link_type' 转为 WorkshopEdge (status='pending')
  - 合并逻辑：confirmed 节点 + pending 节点统一计算球面分布位置（参考 Demo 的 sphereLayout 算法）
  - 返回: `{ nodes: WorkshopNode[], edges: WorkshopEdge[], isLoading }`
  - 适配函数: `objectTypeToNode(ot: ObjectType) → WorkshopNode`, `blueprintItemToNode(item: BlueprintItem) → WorkshopNode`, `linkTypeToEdge(lt: LinkType) → WorkshopEdge`, `blueprintItemToEdge(item: BlueprintItem) → WorkshopEdge`
  **测试**: 单元测试验证适配函数正确转换 + 合并后节点数一致
  **覆盖 AC**: AC-20, AC-42, AC-43, AC-44
  **依赖**: T001, T002, T003

- [ ] **T012**: WorkshopCanvas + SceneContent — R3F 3D 场景
  **文件**: `apps/web/src/pages/workshop/components/WorkshopCanvas.tsx`（新建）
  **逻辑**:
  - 参考 Demo 的 `StarfieldCanvas.tsx` 构建，适配 WorkshopNode/Edge 类型
  - R3F Canvas 容器（暗色背景 #0a0a1a），配置：camera fov=60, near=0.1, far=2000
  - SceneContent 内部组件：
    - AmbientLight + PointLight（参考 Demo）
    - OrbitControls（enablePan, enableRotate, enableZoom）— 暴露 ref 给 WorkshopToolbar
    - BackgroundStars（参考 Demo，可直接复制渲染逻辑）
    - 遍历 nodes 渲染 WorkshopStarNode（T013）
    - 遍历 edges 渲染 WorkshopStarLink（T013）
  - EffectComposer + Bloom 后处理（参考 Demo）
  - 接收 props: nodes, edges, onNodeHover, onNodeClick, onNodeDoubleClick, toolbarRef
  **覆盖 AC**: AC-25, AC-26
  **依赖**: T004, T005, T011

- [ ] **T013**: WorkshopStarNode + WorkshopStarLink — 星体与星链
  **文件**: `apps/web/src/pages/workshop/components/WorkshopStarNode.tsx`（新建）, `apps/web/src/pages/workshop/components/WorkshopStarLink.tsx`（新建）
  **逻辑**:
  - `WorkshopStarNode.tsx`: 参考 Demo StarNode，关键差异：
    - 接收 WorkshopNode 类型
    - status='confirmed': 明亮实体星体（emissiveIntensity 高，opacity=1.0）
    - status='pending': 半透明星体（opacity 按 confidenceLevel 分级：high=0.8, medium=0.5, low=0.3）+ 中心悬浮 AI 角标 ✦（HTML overlay via drei Html 组件）
    - confidenceLevel='high' → 明亮星体；'medium' → 半透明 + 黄色光晕；'low' → 微弱闪烁动画（useFrame sin 波）
    - onPointerOver/onPointerOut → store.setHoveredEntityRid
    - onClick → store.setSelectedEntityRid + onNodeClick 回调
    - onDoubleClick → 打开 /object-types/:rid（仅 confirmed 状态）
  - `WorkshopStarLink.tsx`: 参考 Demo StarLink，关键差异：
    - status='confirmed': 实线（lineWidth=2），白色
    - status='pending': 虚线效果（LineDashedMaterial dashSize/gapSize），颜色按 confidence 分级
    - 带方向箭头（cone mesh 在 target 端）
    - label 显示关系名称（drei Text）
  **覆盖 AC**: AC-20, AC-21, AC-42, AC-43, AC-44, AC-45
  **依赖**: T012

- [ ] **T014**: VortexEffect + 实时结晶动画
  **文件**: `apps/web/src/pages/workshop/components/VortexEffect.tsx`（新建）, `apps/web/src/pages/workshop/components/StarfieldWorkbench.tsx`（新建）
  **逻辑**:
  - `VortexEffect.tsx`: 参考 Demo VortexEffect。当 store.pendingCrystallizations 队列非空时激活。每消费一个 item，播放：
    1. 中心漩涡能量聚集（粒子螺旋收缩，~1s）
    2. 在目标位置诞生新星体（scale 从 0 → 1 弹性动画，~0.5s）
    3. 消费完成后调用 store.consumeCrystallization(rid)
  - `StarfieldWorkbench.tsx`: 中央面板容器，组合 WorkshopCanvas + WorkshopToolbar + EntityPopover(T017) + EntityDrawer(T018)。从 useWorkshopGraph 获取 nodes/edges，传入 WorkshopCanvas。监听 store.pendingCrystallizations 驱动 VortexEffect
  - blueprint-complete 事件到达时：停止 VortexEffect，画布 fit-to-view（通过 OrbitControls ref）
  **覆盖 AC**: AC-22, AC-23, AC-24
  **依赖**: T012, T013

### Phase 4: Sidekick + 实体探索

- [ ] **T015**: SidekickPanel + PlanProgressTree
  **文件**: `apps/web/src/pages/workshop/components/SidekickPanel.tsx`（新建）, `apps/web/src/pages/workshop/components/PlanProgressTree.tsx`（新建）
  **逻辑**:
  - `SidekickPanel.tsx`: 右侧面板容器。可折叠（store.isSidekickOpen）。内部垂直布局：PlanProgressTree（顶部）→ SuggestionCard 列表（中部，可滚动）→ BlueprintSummary（底部，蓝图完成后显示）
  - `PlanProgressTree.tsx`: 从 store.planSteps 渲染步骤列表。每个步骤显示：序号（圆形徽标）+ 步骤文字 + 状态（当前步骤显示 loading spinner，已完成显示 ✓）。当前进度：step.index / step.total
  **覆盖 AC**: AC-33
  **依赖**: T003, T004

- [ ] **T016**: SuggestionCard + ConfidenceIndicator + BlueprintSummary
  **文件**: `apps/web/src/pages/workshop/components/SuggestionCard.tsx`（新建）, `apps/web/src/pages/workshop/components/ConfidenceIndicator.tsx`（新建）, `apps/web/src/pages/workshop/components/BlueprintSummary.tsx`（新建）
  **逻辑**:
  - `ConfidenceIndicator.tsx`: 接收 confidence(number) + confidenceLevel('high'|'medium'|'low')。渲染：色标圆点（🟢/🟡/🔴）+ 百分比文字（如"92%"）
  - `SuggestionCard.tsx`: 接收 BlueprintItem 数据。渲染：
    - 类型图标（🔵 对象类型 / 🔗 链接类型）
    - 名称（suggestion.displayName 或 suggestion.name）
    - ConfidenceIndicator
    - 推理来源标签（field_analysis → "字段分析" / pattern_matching → "模式匹配" / semantic_inference → "语义推断" / best_practices → "最佳实践"）
    - 点击卡片 → store.setSelectedEntityRid(节点 id) + 画布聚焦（通过回调）
  - `BlueprintSummary.tsx`: 蓝图完成后显示摘要：蓝图名称 + 总项数 + 各类型数量
  **覆盖 AC**: AC-34, AC-35, AC-42, AC-43, AC-44
  **依赖**: T003, T015

- [ ] **T017**: EntityPopover — Tier 1 悬停预览
  **文件**: `apps/web/src/pages/workshop/components/EntityPopover.tsx`（新建）
  **逻辑**:
  - 当 store.hoveredEntityRid 非空时，在鼠标位置附近显示 Popover（使用 absolute 定位，跟踪鼠标位置）
  - 延迟 200ms 显示（防止快速移动闪烁）
  - 内容：名称（加粗）+ 类型徽标（"对象类型"/"链接类型"标签）+ 一行描述（截断 50 字）+ ConfidenceIndicator（仅 pending 状态）
  - 使用 React portal 渲染到 document.body 避免 R3F Canvas 层级问题
  - 悬停目标移开后 100ms 消失
  **覆盖 AC**: AC-29
  **依赖**: T003, T016

- [ ] **T018**: EntityDrawer — Tier 2 详情面板
  **文件**: `apps/web/src/pages/workshop/components/EntityDrawer.tsx`（新建）
  **逻辑**:
  - 当 store.selectedEntityRid 非空时，从右侧滑出 Ant Design Drawer（width=400px，暗色主题覆盖）
  - 内容（对于 WorkshopNode）：
    - 头部：名称 + 类型徽标 + 置信度指示器（仅 pending）+ AI 角标（仅 pending）
    - 属性列表：表格形式展示 properties（displayName, apiName, baseType）
    - 关系分组：列出关联的 edges（链接名称 + 对端实体名称 + 基数）
    - 推理来源（仅 pending）：来源标签 + reasoning 文字（可展开/折叠）
  - 双击标题或点击"查看完整详情"按钮 → window.open(`/object-types/${rid}`, '_blank')（仅 confirmed 状态可用）
  - 点击 Drawer 外部或关闭按钮 → store.setSelectedEntityRid(null)
  **覆盖 AC**: AC-30, AC-31, AC-32
  **依赖**: T003, T016

### Phase 5: 页面状态 + 连接管理

- [ ] **T019**: 页面状态机 + ConnectionBanner
  **文件**: `apps/web/src/pages/workshop/components/ConnectionBanner.tsx`（新建）, `apps/web/src/pages/workshop/WorkshopPage.tsx`（修改）
  **逻辑**:
  - `ConnectionBanner.tsx`: 全屏半透明遮罩（仅 connectionStatus='disconnected' 时渲染）。内容：Loading 动画 + "连接已断开" 文字 + "重新连接"按钮（调用 useAgentChat 的 reconnect）
  - reconnecting 状态：画布右上角小型指示器"重新连接中…"（不遮挡画布）
  - WorkshopPage 集成状态机：
    - 加载时：查询 ObjectType 列表和 AgentSession → 决定初始状态（empty / existing）
    - 有 currentSessionRid 时自动连接 useAgentChat
    - SSE 流活跃时 → setPageState('analyzing')
    - blueprint-complete 后 → setPageState('blueprint_pending')
    - 连接断开 → 'reconnecting' → 超时 → 'disconnected'
  - 条件渲染：
    - empty: 画布空星空 + GuidanceCard
    - existing: 画布渲染 OT + "上传资料扩展本体"引导文字
    - analyzing: 画布结晶动画 + Sidekick 进度
    - disconnected: ConnectionBanner 遮罩
  **覆盖 AC**: AC-36, AC-37, AC-38, AC-39, AC-40, AC-41
  **依赖**: T009, T010, T014, T015

### Phase 6: 集成 + i18n

- [ ] **T020**: WorkshopPage 组件集成
  **文件**: `apps/web/src/pages/workshop/WorkshopPage.tsx`（修改）
  **逻辑**:
  - 将所有子组件集成到 WorkshopPage 的三面板 slot 中：
    - 左侧 slot → ChatPanel
    - 中央 slot → StarfieldWorkbench
    - 右侧 slot → SidekickPanel
    - 全局覆盖 → ConnectionBanner
  - 连接数据流：useWorkshopGraph → StarfieldWorkbench → 节点交互 → EntityPopover/EntityDrawer
  - 连接 SSE 流：useAgentChat → 事件分发 → 各面板更新
  - 确保所有面板的折叠/展开联动正常
  **覆盖 AC**: AC-01, AC-02, AC-03
  **依赖**: T019

- [ ] **T021**: i18n 国际化字符串
  **文件**: `apps/web/src/locales/en-US/common.json`（修改）, `apps/web/src/locales/zh-CN/common.json`（修改）
  **逻辑**:
  - 添加 `workshop` 命名空间，覆盖所有组件中使用的用户可见字符串：
    ```json
    "workshop": {
      "title": "Ontology Workshop / 本体工坊",
      "backToManager": "Back / 返回",
      "guidance": {
        "title": "Start Building Ontology / 开始构建本体",
        "domain": "Business Domain / 业务领域",
        "goal": "Modeling Goal / 建模目标",
        "scope": "Concept Scope / 概念范围",
        "scopePlaceholder": "e.g. Focus on order fulfillment... / 例如：聚焦订单履约流程…",
        "confirm": "Confirm & Continue / 确认并继续",
        "skip": "Skip / 跳过"
      },
      "chat": {
        "placeholder": "Ask Agent... / 向 Agent 提问…",
        "thinking": "Agent is thinking... / Agent 正在思考…",
        "send": "Send / 发送"
      },
      "upload": {
        "dropHint": "Release to upload / 释放以上传文件",
        "invalidType": "Unsupported file type... / 不支持的文件类型…",
        "tooLarge": "File exceeds 10MB limit / 文件大小超过 10MB 限制",
        "uploaded": "Uploaded / 已上传"
      },
      "sidekick": { "title": "AI Suggestions / AI 建议", "planSteps": "Plan / 规划", "blueprintComplete": "Blueprint complete / 蓝图已完成" },
      "confidence": { "high": "High / 高", "medium": "Medium / 中", "low": "Low / 低" },
      "source": {
        "field_analysis": "Field Analysis / 字段分析",
        "pattern_matching": "Pattern Matching / 模式匹配",
        "semantic_inference": "Semantic Inference / 语义推断",
        "best_practices": "Best Practices / 最佳实践"
      },
      "connection": {
        "reconnecting": "Reconnecting... / 重新连接中…",
        "disconnected": "Connection lost / 连接已断开",
        "reconnect": "Reconnect / 重新连接"
      },
      "state": {
        "uploadGuide": "Upload materials to expand ontology / 上传资料扩展本体"
      },
      "entity": {
        "objectType": "Object Type / 对象类型",
        "linkType": "Link Type / 链接类型",
        "properties": "Properties / 属性",
        "relationships": "Relationships / 关系",
        "reasoning": "Reasoning / 推理来源",
        "viewDetail": "View Full Detail / 查看完整详情"
      },
      "toolbar": { "fit": "Fit / 适配", "reset": "Reset / 重置", "zoomIn": "Zoom In / 放大", "zoomOut": "Zoom Out / 缩小" },
      "domains": { "ecommerce": "E-Commerce / 电商零售", "finance": "Finance / 金融银行", "supplyChain": "Supply Chain / 供应链物流", "healthcare": "Healthcare / 医疗健康", "manufacturing": "Manufacturing / 制造业", "hr": "Human Resources / 人力资源" },
      "goals": { "dataIntegration": "Data Integration & Search / 数据整合与搜索", "analytics": "Analytics & Reports / 决策分析与报表", "knowledgeGraph": "Knowledge Graph / 知识图谱探索", "aiFoundation": "AI Foundation / AI 应用基座", "dataGovernance": "Data Governance / 数据治理合规" }
    }
    ```
  - en-US 只保留英文值，zh-CN 只保留中文值
  - 回查所有已创建组件，确保无硬编码字符串
  **覆盖 AC**: AC-05, AC-18, AC-19
  **依赖**: T020

- [ ] **T022**: 前端测试
  **文件**: `apps/web/src/pages/workshop/__tests__/WorkshopPage.test.tsx`（新建）, `apps/web/src/pages/workshop/hooks/__tests__/use-sse-parser.test.ts`（新建）, `apps/web/src/pages/workshop/stores/__tests__/workshop-store.test.ts`（已在 T003 创建）
  **逻辑**:
  - `WorkshopPage.test.tsx`: 渲染测试 — 验证三面板布局存在、返回按钮可点击、路由跳转正确
  - `use-sse-parser.test.ts`: 纯函数测试 — parseSSELine 解析 text-delta/plan-step/blueprint-item/done/error 事件；处理多行 data；处理空行分隔；处理格式错误的行返回 null
  - `workshop-store.test.ts`（补充）: 验证完整状态转换流程：empty→existing→analyzing→blueprint_pending；reconnecting 超时→disconnected；pendingCrystallizations 增删
  **覆盖 AC**: AC-01, AC-04, AC-09, AC-10, AC-11, AC-36, AC-37, AC-38, AC-39, AC-40
  **依赖**: T020

---

## AC 追溯矩阵

| AC | 覆盖任务 |
|----|---------|
| AC-01 | T004, T020, T022 |
| AC-02 | T003, T004, T020 |
| AC-03 | T003, T004, T020 |
| AC-04 | T004, T022 |
| AC-05 | T007, T021 |
| AC-06 | T002, T007 |
| AC-07 | T007 |
| AC-08 | T006, T010 |
| AC-09 | T010, T022 |
| AC-10 | T010, T022 |
| AC-11 | T010, T022 |
| AC-12 | T006 |
| AC-13 | T009 |
| AC-14 | T008 |
| AC-15 | T002, T008 |
| AC-16 | T008 |
| AC-17 | T008 |
| AC-18 | T008, T021 |
| AC-19 | T008, T021 |
| AC-20 | T011, T013 |
| AC-21 | T013 |
| AC-22 | T014 |
| AC-23 | T014 |
| AC-24 | T014 |
| AC-25 | T012 |
| AC-26 | T012 |
| AC-27 | T005 |
| AC-28 | T005 |
| AC-29 | T017 |
| AC-30 | T018 |
| AC-31 | T018 |
| AC-32 | T018 |
| AC-33 | T015 |
| AC-34 | T016 |
| AC-35 | T016 |
| AC-36 | T003, T019, T022 |
| AC-37 | T003, T019, T022 |
| AC-38 | T003, T019, T022 |
| AC-39 | T003, T010, T019, T022 |
| AC-40 | T003, T010, T019, T022 |
| AC-41 | T010, T019 |
| AC-42 | T011, T013, T016 |
| AC-43 | T011, T013, T016 |
| AC-44 | T011, T013, T016 |
| AC-45 | T013 |

---

## 实际偏差记录

> 完成后，在此记录实现与 spec.md 的偏差，供后续参考。

（暂无）
