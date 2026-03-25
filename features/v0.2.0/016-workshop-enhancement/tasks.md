# Tasks: Workshop Enhancement（本体工坊增强）

**关联规格**: [spec.md](./spec.md)
**版本**: v0.2.0

---

## 状态

| 步骤 | 状态 | 备注 |
|------|------|------|
| spec.md | ✅ 已评审 | PASS_WITH_NOTES，用户已确认 |
| tasks.md | ✅ 已拆解 | LGTM（3 个 LOW 问题，不阻塞） |
| 实现 | 🔄 进行中 | 20 / 26 完成 |

---

## 开发模式

**前端 Test-Alongside**：F016 为纯前端 feature，实现任务内含测试，或在同 phase 末尾补充测试任务。

**自包含任务**：每个任务内联文件、逻辑、测试上下文，实现阶段不需要回读 spec.md。

---

## Tasks

### Phase 0: 基础设施（Types + Store + i18n）

- [x] **T001**: 前端类型定义扩展
  **文件**: `apps/web/src/pages/workshop/types.ts`
  **逻辑**:
  - 新增 `ViewMode = '3d' | '2d'` 类型
  - 新增 `PromptBubble` 接口：`{ id, label, template, entityTypes?, entityStatuses?, minProperties? }`
  - 新增 `ShockwaveInstance` 接口：`{ id, position: {x,y,z}, startTime }`
  - 新增 `CollapseInstance` 接口：`{ id, position: {x,y,z}, color, startTime }`
  - `DragLinkState` 已存在，无需修改
  **测试**: 纯类型定义，无运行时测试
  **依赖**: 无

- [x] **T002**: Zustand Store 扩展 + 测试
  **文件**: `apps/web/src/pages/workshop/stores/workshop-store.ts`, `stores/__tests__/workshop-store.test.ts`
  **逻辑**:
  - 新增 `viewMode: ViewMode`（默认 `'3d'`）+ `setViewMode(mode)`
  - 新增 `focusedEntityRid: string | null` + `setFocusedEntityRid(rid)` + `clearFocusLock()`
  - 新增 `highlightedEntityRids: string[]` + `setHighlightedEntityRids(rids)` + `clearHighlights()`
  - 新增 `dragLinkState: DragLinkState | null` + `setDragLinkState(state)` + `clearDragLink()`
  - 新增 `activeShockwaves: ShockwaveInstance[]` + `addShockwave(instance)` + `removeShockwave(id)`
  - 新增 `activeCollapses: CollapseInstance[]` + `addCollapse(instance)` + `removeCollapse(id)`
  - 在 `initialState` 和 `reset()` 中包含新字段的初始值
  **测试**: 扩展 `workshop-store.test.ts`，验证：
  - `setViewMode('2d')` → viewMode 变为 '2d'
  - `setFocusedEntityRid('rid1')` → focusedEntityRid 为 'rid1'，`clearFocusLock()` → null
  - `setHighlightedEntityRids(['a','b'])` → 数组匹配，`clearHighlights()` → 空数组
  - `setDragLinkState(mockState)` → 匹配，`clearDragLink()` → null
  - `addShockwave / removeShockwave` 增减正确
  - `addCollapse / removeCollapse` 增减正确
  - `reset()` 清除所有新字段
  **覆盖 AC**: AC-01, AC-06, AC-09, AC-23, AC-25
  **依赖**: T001

- [x] **T003**: i18n 键值扩展
  **文件**: `apps/web/src/locales/en-US/common.json`, `apps/web/src/locales/zh-CN/common.json`
  **逻辑**: 在 `workshop` 命名空间下新增：
  - `workshop.toolbar.view3D` / `workshop.toolbar.view2D`
  - `workshop.autoDegrade.suggestion` / `workshop.autoDegrade.switchTo2D`
  - `workshop.focusLock.locked` / `workshop.focusLock.unlock`
  - `workshop.promptBubbles.checkOrphanKeys` / `workshop.promptBubbles.deriveStats` / `workshop.promptBubbles.splitSensitive` / `workshop.promptBubbles.suggestRelated` / `workshop.promptBubbles.checkNaming`
  - `workshop.entity.delete` / `workshop.entity.deleteConfirm` / `workshop.entity.deleteImpact` / `workshop.entity.cannotDeleteConfirmed`
  - `workshop.dataProbe.comingSoon`
  **测试**: 无
  **依赖**: 无

### Phase 1: 3D/2D 视图切换

- [x] **T004**: Workshop2DView 组件
  **文件**: `apps/web/src/pages/workshop/components/Workshop2DView.tsx`（新建）
  **逻辑**:
  - 接收 `nodes: WorkshopNode[]`、`edges: WorkshopEdge[]` props
  - 将 `WorkshopNode[]` 转换为 ReactFlow `Node[]`：
    - `node.id` → ReactFlow node id
    - `node.position` 的 x/z 投影为 2D（z → y，忽略 y 轴高度）
    - 自定义节点组件：圆形背景 + displayName + 置信度色标（confirmed=白色实体，pending=半透明+AI 角标）
  - 将 `WorkshopEdge[]` 转换为 ReactFlow `Edge[]`：
    - confirmed 实线，pending 虚线
    - 颜色同 WorkshopStarLink：high=#52c41a, medium=#faad14, low=#ff4d4f, confirmed=#ffffff
    - 标签显示 label + cardinality
  - node hover → `setHoveredEntityRid(nodeId)` 触发 EntityPopover
  - node click → `setSelectedEntityRid(nodeId)` 触发 EntityDrawer
  - 使用 `fitView` 初始化视口
  - 暴露 ref handle：`{ fitView(), zoomIn(), zoomOut(), resetView() }`
  - 参考 `LinkTypeGraph.tsx` 的 ReactFlow 用法模式
  **测试**: 渲染测试 — 给定 nodes/edges 验证 ReactFlow 容器渲染、节点数量正确
  **覆盖 AC**: AC-01, AC-02, AC-03, AC-04
  **依赖**: T001, T002

- [x] **T005**: WorkshopToolbar 视图切换按钮 + Auto-degrade
  **文件**: `apps/web/src/pages/workshop/components/WorkshopToolbar.tsx`（修改）
  **逻辑**:
  - 在工具栏右侧新增 3D/2D 切换按钮组（自定义 toggle，使用 `AppstoreOutlined`/`NodeIndexOutlined` 图标）
  - 读取 `useWorkshopStore` 的 `viewMode`，点击调用 `setViewMode`
  - 接收 `nodeCount: number` prop
  - 当 `nodeCount > 200` 且 `viewMode === '3d'` 时，调用 `notification.info` 显示降级建议（仅触发一次，使用 `useRef` 标记）
  - Props 新增 `onFitView2D`, `onResetView2D`, `onZoomIn2D`, `onZoomOut2D`（2D 模式下使用）
  - 根据 `viewMode` 切换 toolbar 按钮绑定的回调
  **测试**: 渲染测试 — 验证切换按钮存在，模拟点击后 viewMode 改变
  **覆盖 AC**: AC-01, AC-05
  **依赖**: T002, T003

- [x] **T006**: StarfieldWorkbench 3D/2D 视图路由
  **文件**: `apps/web/src/pages/workshop/components/StarfieldWorkbench.tsx`（修改）
  **逻辑**:
  - 新增 `Workshop2DView` 和 `useRef<Workshop2DViewHandle>` 用于 2D 视图控制
  - 读取 `viewMode` from store
  - `viewMode === '3d'` → 渲染现有 `WorkshopCanvas` + 3D toolbar callbacks
  - `viewMode === '2d'` → 渲染 `Workshop2DView` + 2D toolbar callbacks
  - 两种模式共用 `WorkshopToolbar`，但 zoom/fit/reset 按钮绑定不同的 ref 方法
  - 传递 `nodeCount={nodes.length}` 给 WorkshopToolbar
  - 视图切换时清除 `dragLinkState`（拖拽仅 3D 有效）
  **测试**: 渲染测试 — 验证 viewMode 切换后渲染不同组件
  **覆盖 AC**: AC-01
  **依赖**: T004, T005

### Phase 2: 拖拽连线创建链接（3D only）

- [x] **T007**: DragLinkLine 组件
  **文件**: `apps/web/src/pages/workshop/components/DragLinkLine.tsx`（新建）
  **逻辑**:
  - 基于 Demo `DragLinkLine.tsx` 适配到 Workshop
  - 接收 `dragLinkState: DragLinkState` prop
  - 渲染从 `sourcePosition` 到 `currentPointerPosition` 的线段
  - 使用 drei `Line` 组件：dashed 样式（基础版本，Phase 6 升级为发光线）
  - 颜色逻辑：无悬停目标 → `#ffffff` opacity 0.35；有悬停目标 → `#4fc3f7` opacity 0.6
  - 线宽：无悬停 → 2；有悬停 → 3
  **测试**: 纯 R3F 组件，E2E 覆盖
  **覆盖 AC**: AC-06
  **依赖**: T001

- [x] **T008**: WorkshopCanvas 拖拽交互逻辑
  **文件**: `apps/web/src/pages/workshop/components/WorkshopCanvas.tsx`（修改）, `WorkshopStarNode.tsx`（修改）
  **逻辑**:
  - **WorkshopStarNode 修改**:
    - 新增 `onDragStart?: (nodeId: string) => void` prop
    - `onPointerDown` 事件 → 200ms 长按阈值后启动拖拽：调用 `setDragLinkState({ sourceNodeId: id, sourcePosition: position, currentPointerPosition: position, hoveredTargetId: null })`
    - 拖拽活跃期间，`onPointerOver` → 设置 `hoveredTargetId`（如果不是源节点）
    - `onPointerOut` → 清除 `hoveredTargetId`
  - **WorkshopCanvas 修改**:
    - 新增不可见拖拽平面（`<mesh>` with `planeGeometry` 垂直于相机朝向）
    - `onPointerMove` 在拖拽活跃期间 → raycaster 投射到拖拽平面 → 更新 `dragLinkState.currentPointerPosition`
    - `onPointerUp` → 如果 `hoveredTargetId` 有效且 ≠ sourceNodeId → 调用 `onLinkCreate(sourceNodeId, hoveredTargetId)`；然后 `clearDragLink()`
    - 条件渲染 `<DragLinkLine>` 当 `dragLinkState !== null`
  - **接收 `onLinkCreate` prop**: 由 WorkshopPage 传入，内部调用 `agentChat.send()` 发送格式化链接建议请求消息
  **测试**: 纯 R3F 交互，E2E 覆盖
  **覆盖 AC**: AC-06, AC-07, AC-08
  **依赖**: T002, T007

### Phase 3: 焦点锁定 + 双向高亮

- [x] **T009**: use-focus-lock Hook + 测试
  **文件**: `apps/web/src/pages/workshop/hooks/use-focus-lock.ts`（新建）, `hooks/__tests__/use-focus-lock.test.ts`（新建）
  **逻辑**:
  - `useFocusLock(nodes: WorkshopNode[])` 返回：
    - `focusedEntity: WorkshopNode | null` — 当前锁定的实体对象
    - `lockEntity(rid: string)` → `setFocusedEntityRid(rid)`
    - `unlockEntity()` → `clearFocusLock()`
    - `prefixMessage(content: string): string` → 有焦点时返回 `[关于 ${displayName}] ${content}`，无焦点时返回原始 content
  - 从 `nodes` 中查找 `focusedEntityRid` 对应的节点获取 `displayName`
  - 如果 `focusedEntityRid` 对应的节点不在 `nodes` 中（被删除），自动调用 `clearFocusLock()`
  **测试**:
  - `prefixMessage` 有焦点时正确添加前缀
  - `prefixMessage` 无焦点时返回原始内容
  - 焦点实体被删除后自动清除锁定
  **覆盖 AC**: AC-09, AC-10, AC-11, AC-12
  **依赖**: T002

- [x] **T010**: FocusLockTag 组件
  **文件**: `apps/web/src/pages/workshop/components/FocusLockTag.tsx`（新建）
  **逻辑**:
  - 接收 `entity: WorkshopNode | null`、`onUnlock: () => void` props
  - 仅当 `entity !== null` 时渲染
  - 渲染实体标签：`✦ {displayName}` + CloseOutlined 关闭按钮
  - 样式：暗底 pill 标签，accent 色边框，与 workshop 暗主题一致
  - 点击关闭按钮 → 调用 `onUnlock()`
  **测试**: 渲染测试 — entity 为 null 不渲染；entity 有值时显示名称和关闭按钮；点击关闭调用 onUnlock
  **覆盖 AC**: AC-09, AC-11
  **依赖**: T003

- [x] **T011**: ChatPanel 集成焦点锁定
  **文件**: `apps/web/src/pages/workshop/components/ChatPanel.tsx`（修改）
  **逻辑**:
  - 接收 `nodes: WorkshopNode[]` prop（由 WorkshopPage 传入）
  - 实例化 `useFocusLock(nodes)` 获取 `focusedEntity`, `unlockEntity`, `prefixMessage`
  - 在 header 下方（GuidanceCard 或消息列表上方）渲染 `<FocusLockTag entity={focusedEntity} onUnlock={unlockEntity} />`
  - 修改 `ChatInput` 的 `onSend`：发送前调用 `prefixMessage(content)` 包装消息
  **测试**: 渲染测试 — 验证 FocusLockTag 条件渲染
  **覆盖 AC**: AC-09, AC-10, AC-11
  **依赖**: T009, T010

- [x] **T012**: WorkshopCanvas 集成焦点锁定
  **文件**: `apps/web/src/pages/workshop/components/WorkshopCanvas.tsx`（修改）
  **逻辑**:
  - 星体点击时（`onNodeClick`），除了现有 `setSelectedEntityRid`，同时调用 `setFocusedEntityRid(nodeId)`
  - 画布空白处点击（`onPointerMissed` in SceneContent）→ `clearFocusLock()`
  **测试**: 纯 R3F 交互，E2E 覆盖
  **覆盖 AC**: AC-09, AC-12
  **依赖**: T002

- [x] **T013**: use-entity-highlights Hook + 测试
  **文件**: `apps/web/src/pages/workshop/hooks/use-entity-highlights.ts`（新建）, `hooks/__tests__/use-entity-highlights.test.ts`（新建）
  **逻辑**:
  - `useEntityHighlights(nodes: WorkshopNode[])` 返回：
    - `highlightFromChat(rid: string)` → `setHighlightedEntityRids([rid])` 高亮对应星体
    - `clearChatHighlight()` → `clearHighlights()`
    - `getHighlightedMessageIndices(messages: Message[], entityRid: string): number[]` → 扫描消息文本，返回包含对应 `displayName` 的消息索引列表
    - `findEntityAnchors(text: string): Array<{rid: string, displayName: string, startIndex: number, endIndex: number}>` → 在文本中查找匹配的实体 displayName，返回位置信息
  - 实体匹配：遍历 `nodes`，对每个 `node.displayName` 在文本中做精确匹配（大小写不敏感）
  **测试**:
  - `findEntityAnchors` 正确识别文本中的实体名称及位置
  - `findEntityAnchors` 多个实体名称匹配时返回所有结果
  - `getHighlightedMessageIndices` 返回正确的消息索引
  **覆盖 AC**: AC-13, AC-14, AC-15
  **依赖**: T002

- [x] **T014**: MessageBubble 实体锚点 + MessageList 高亮
  **文件**: `apps/web/src/pages/workshop/components/MessageBubble.tsx`（修改）, `MessageList.tsx`（修改）
  **逻辑**:
  - **MessageBubble 修改**:
    - 接收 `entityAnchors?: Array<{rid, displayName, startIndex, endIndex}>` prop
    - 在渲染消息文本时，将匹配的 displayName 区间替换为可交互的 `<span>` 标签
    - anchor `onMouseEnter` → `highlightFromChat(rid)` → 星体发光
    - anchor `onMouseLeave` → `clearChatHighlight()`
    - anchor `onClick` → `setSelectedEntityRid(rid)` + `onFocusEntity(rid)`（触发相机飞向）
    - anchor 样式：带底部虚线、accent 色，cursor: pointer
  - **MessageList 修改**:
    - 接收 `highlightedMessageIndices?: number[]` prop
    - 匹配的消息渲染高亮背景色（`rgba(79, 143, 255, 0.1)` — 浅 accent 色）
    - 接收 `messageRefs?: React.MutableRefObject<Map<number, HTMLDivElement>>` 用于滚动定位
  **测试**: 渲染测试 — 验证 anchor span 渲染、高亮背景样式
  **覆盖 AC**: AC-13, AC-14, AC-15
  **依赖**: T013

- [x] **T015**: WorkshopStarNode 高亮响应
  **文件**: `apps/web/src/pages/workshop/components/WorkshopStarNode.tsx`（修改）
  **逻辑**:
  - 新增 `isHighlighted: boolean` prop（由父组件从 `highlightedEntityRids.includes(id)` 派生）
  - `isHighlighted` 为 true 时：
    - 增大 glow 球体 scale 至 2.2（高于 selected 的 1.8）
    - 使用 cyan 色 (`#00e5ff`) emissive（区别于 selected 的白色 glow）
    - `useFrame` 驱动脉冲动画（比 hover 更快的频率，~5 rad/s）
  - `isHighlighted` 优先级高于 `isHovered`，低于 `isSelected`
  **测试**: 纯 R3F，E2E 覆盖
  **覆盖 AC**: AC-13
  **依赖**: T002

### Phase 4: 引导性提示气泡

- [x] **T016**: PromptBubbles 组件 + 测试
  **文件**: `apps/web/src/pages/workshop/components/PromptBubbles.tsx`（新建）
  **逻辑**:
  - 接收 `selectedNode: WorkshopNode | null`、`onSend: (message: string) => void` props
  - 仅当 `selectedNode !== null` 时渲染
  - 维护模板映射表（使用 i18n key），按上下文条件筛选 3-5 个：
    - `object_type` + `pending`: "检查字段命名规范", "推导关联对象类型", "补充缺失属性"
    - `object_type` + `confirmed`: "检查孤立外键", "推导统计属性"
    - `object_type` + `properties.length > 8`: "拆分敏感字段", "识别共享属性"
    - `link_type`: "验证基数关系", "检查反向链接"
  - 渲染为 ChatInput 上方的水平 pill 按钮行，可水平滚动
  - 每个 pill：`💡 {label}` + 点击 → `onSend(template)`
  - 样式：半透明暗色背景，accent 色边框，小圆角
  **测试**: 渲染测试 —
  - selectedNode 为 null 时不渲染
  - object_type + pending 节点显示正确的建议
  - 点击 pill 调用 onSend 传入模板文本
  **覆盖 AC**: AC-16, AC-17, AC-18
  **依赖**: T003

- [x] **T017**: ChatPanel 集成 PromptBubbles
  **文件**: `apps/web/src/pages/workshop/components/ChatPanel.tsx`（修改）
  **逻辑**:
  - 从 `selectedEntityRid` + `nodes` 派生 `selectedNode`
  - 在 `ChatInput` 上方渲染 `<PromptBubbles selectedNode={selectedNode} onSend={handleSend} />`
  - `handleSend` 委托给 `agentChat.send`（经过 `prefixMessage` 包装）
  **测试**: 渲染测试 — 验证 PromptBubbles 的条件渲染
  **覆盖 AC**: AC-16, AC-17
  **依赖**: T011, T016

### Phase 5: 删除星体 + 数据探针占位

- [x] **T018**: EntityDrawer 删除按钮 + 影响展示
  **文件**: `apps/web/src/pages/workshop/components/EntityDrawer.tsx`（修改）
  **逻辑**:
  - 接收 `onDeleteNode?: (nodeId: string) => void` prop
  - 仅 `status === 'pending'` 的实体显示 Delete 按钮（红色 danger 样式，Ant Design Button）
  - `status === 'confirmed'` 不显示删除按钮
  - 点击 Delete → Popconfirm：
    - 标题：t('workshop.entity.deleteConfirm')
    - 内容：展示前端计算的影响范围 — 遍历 `edges` 找到 `sourceNodeId === nodeId || targetNodeId === nodeId` 的边，列出名称和数量
    - 确认 → 调用 `onDeleteNode(nodeId)`
  **测试**: 渲染测试 —
  - pending 实体显示删除按钮
  - confirmed 实体不显示删除按钮
  - 影响范围正确计算（给定 edges 数据）
  **覆盖 AC**: AC-19, AC-20, AC-21
  **依赖**: T003

- [x] **T019**: StarCollapseEffect 碎裂消散动画
  **文件**: `apps/web/src/pages/workshop/components/StarCollapseEffect.tsx`（新建）
  **逻辑**:
  - R3F 组件，接收 `collapse: CollapseInstance` prop
  - 在 `collapse.position` 位置播放碎裂动画：
    - 使用 `Points` + `BufferGeometry` 创建 30-50 个碎片粒子
    - 粒子初始位置在球心，随时间向外径向扩散 + 随机偏移
    - 颜色从 `collapse.color` 渐变到红色 (#ff4d4f) → 暗红 → 透明
    - 球体 scale 从 1 → 0 收缩（同时进行）
    - 使用 `useFrame` 驱动动画，总时长 ~1.5s
    - 动画完成后调用 `removeCollapse(collapse.id)`
  - 参考 `VortexEffect.tsx` 的 ShaderMaterial 和粒子系统模式
  **测试**: 纯视觉效果，E2E 覆盖
  **覆盖 AC**: AC-22
  **依赖**: T002

- [x] **T020**: DataProbeButton 占位组件
  **文件**: `apps/web/src/pages/workshop/components/DataProbeButton.tsx`（新建）
  **逻辑**:
  - 接收 `disabled: boolean`（F016 中始终为 true）、`tooltip: string` props
  - 渲染 Ant Design `Button` with `SearchOutlined` 图标，size small
  - disabled 状态 + Tooltip 显示 t('workshop.dataProbe.comingSoon')
  - 为 F017+ 预留 `onClick?: () => void` prop 接口
  - 在 `EntityDrawer` 的关系列表中，每个 edge 行末尾渲染此按钮
  **测试**: 渲染测试 — 按钮 disabled、tooltip 文案正确
  **覆盖 AC**: AC-27
  **依赖**: T003

### Phase 6: 视觉效果升级

- [x] **T021**: Fresnel 边缘光 + 顶点噪声 Shader
  **文件**: `apps/web/src/pages/workshop/components/WorkshopStarNode.tsx`（修改）
  **逻辑**:
  - 将 `meshStandardMaterial` 替换为自定义 `shaderMaterial`
  - **Vertex Shader**:
    - 引入 simplex noise 函数（内联 GLSL，参考 VortexEffect 的模式）
    - 微扰顶点位置：`position += normal * noise3D(position * 2.0 + time * 0.3) * 0.05`
    - 计算 `vNormal`（world space normal）和 `vViewDir`（view direction）传给 fragment
  - **Fragment Shader**:
    - Fresnel 效果：`float fresnel = pow(1.0 - dot(vViewDir, vNormal), fresnelPower)`
    - 最终颜色：`baseColor * opacity + fresnelColor * fresnel * fresnelIntensity`
    - emissive 贡献：`emissiveColor * emissiveIntensity`
  - **Uniforms**: `time`(float, useFrame 更新), `color`(vec3), `opacity`(float), `emissiveColor`(vec3), `emissiveIntensity`(float), `fresnelPower`(float, 默认 2.0), `fresnelIntensity`(float, 默认 0.8)
  - 保留现有的 confidence-based opacity/emissive 逻辑，通过 uniform 值驱动
  - **WebGL2 Fallback**: 检测 `renderer.capabilities.isWebGL2`，不支持时使用原 meshStandardMaterial
  **测试**: 纯视觉效果，E2E 覆盖
  **覆盖 AC**: AC-23
  **依赖**: T002

- [x] **T022**: DragLinkLine 发光升级 + 能量粒子
  **文件**: `apps/web/src/pages/workshop/components/DragLinkLine.tsx`（修改）
  **逻辑**:
  - 将 dashed `Line` 替换为 tube geometry（`TubeGeometry` with `CatmullRomCurve3`）+ emissive MeshBasicMaterial
  - 使用 `AdditiveBlending` + Bloom 配合产生发光效果
  - 沿线添加流动粒子（参考 Demo `StarLink.tsx` 的粒子系统）：
    - 8 个 `Sphere` mesh 粒子，沿线路径从 source → pointer 流动
    - 使用 `useFrame` 驱动位置更新，速度 ~2 单位/秒
    - 粒子 scale 0.03，emissive 白色，AdditiveBlending
  - 有悬停目标时：
    - 线条颜色从白变为 cyan (#4fc3f7)
    - 粒子加速到 ~4 单位/秒 + 增大 scale 到 0.05
    - 增加亮度/opacity
  **测试**: 纯视觉效果，E2E 覆盖
  **覆盖 AC**: AC-24
  **依赖**: T007

- [x] **T023**: ShockwaveEffect 冲击波动画
  **文件**: `apps/web/src/pages/workshop/components/ShockwaveEffect.tsx`（新建）
  **逻辑**:
  - R3F 组件，接收 `shockwave: ShockwaveInstance` prop
  - 在 `shockwave.position` 位置渲染扩展的环形波纹：
    - 使用 `RingGeometry`（innerRadius 动态增长, outerRadius = innerRadius + 0.15）
    - 动画：scale 从 0 → 3.0，opacity 从 0.8 → 0，总时长 ~1s
    - 材质：MeshBasicMaterial + AdditiveBlending + transparent + 白色/cyan 色
    - 环面朝向相机（使用 `lookAt` 或 `Billboard`）
  - `useFrame` 驱动动画，计算 `elapsed = clock.getElapsedTime() - shockwave.startTime`
  - 动画完成后调用 `removeShockwave(shockwave.id)`
  - **触发时机**：在 `useAgentChat` 的 `blueprint-item` 事件处理中，当 `itemType === 'link_type'` 时，从关联的两端节点位置触发冲击波
  **测试**: 纯视觉效果，E2E 覆盖
  **覆盖 AC**: AC-25
  **依赖**: T002

- [ ] **T024**: Cinematic Camera 平滑过渡
  **文件**: `apps/web/src/pages/workshop/components/WorkshopCanvas.tsx`（修改）
  **逻辑**:
  - 新增 `cameraTarget` state（`useRef<{position: Vector3, lookAt: Vector3} | null>`）
  - 在 `useFrame` 中，如果 `cameraTarget.current !== null`：
    - `camera.position.lerp(cameraTarget.current.position, 0.06)` — 平滑移动
    - 当距离目标 < 0.1 时，设置 `cameraTarget.current = null`（动画完成）
  - 修改 `fitView()`：计算包含所有节点的 bounding box → 设置 `cameraTarget` 而非直接 set position
  - 修改 `resetCamera()`：设置 `cameraTarget` 为默认位置 `[0, 5, 15]`
  - 新增 `focusOnEntity(position: {x,y,z})`：设置 `cameraTarget` 为实体位置前方 5 个单位
  - 暴露 `focusOnEntity` 到 `WorkshopCanvasHandle`
  **测试**: 纯视觉效果，E2E 覆盖
  **覆盖 AC**: AC-26
  **依赖**: T002

### Phase 7: 集成与测试

- [x] **T025**: WorkshopPage 全局集成
  **文件**: `apps/web/src/pages/workshop/WorkshopPage.tsx`（修改）
  **逻辑**:
  - 传递 `nodes` 给 `ChatPanel`（用于 focus lock displayName 查找和 entity anchors）
  - 实例化 `useEntityHighlights(nodes)` 获取 `findEntityAnchors`, `highlightFromChat`, `getHighlightedMessageIndices`
  - 将 `entityAnchors` 和 `highlightedMessageIndices` 传递给 ChatPanel → MessageList → MessageBubble
  - 创建 `handleLinkCreate(sourceId, targetId)` 回调：
    - 查找 source/target 的 displayName
    - 调用 `agentChat.send("请建议从 {source} 到 {target} 的链接类型，包括基数关系和关系名称")`
  - 传递 `onLinkCreate={handleLinkCreate}` 给 StarfieldWorkbench → WorkshopCanvas
  - 创建 `handleDeleteNode(nodeId)` 回调：
    - 触发坍缩动画（`addCollapse`）
    - 从本地 nodes/edges 中移除（调用 TanStack Query cache 更新或 store 操作）
    - 清除关联的 selectedEntityRid / focusedEntityRid
  - 传递 `onDeleteNode={handleDeleteNode}` 给 EntityDrawer
  - 传递 `onFocusEntity` 给 MessageBubble → 调用 canvasRef.current.focusOnEntity
  - 在 WorkshopCanvas 中渲染 `ShockwaveEffect` 和 `StarCollapseEffect`（遍历 store 的 `activeShockwaves` 和 `activeCollapses`）
  **覆盖 AC**: AC-07, AC-14, AC-22（全局集成）
  **依赖**: T006, T008, T011, T014, T017, T018, T019, T020, T021, T022, T023, T024

- [ ] **T026**: 前端测试补充
  **文件**: `apps/web/src/pages/workshop/__tests__/` 下新增/修改测试文件
  **逻辑**:
  - `Workshop2DView.test.tsx` — 2D 视图渲染测试（节点数量、边数量、交互回调）
  - `PromptBubbles.test.tsx` — 建议气泡渲染与点击交互测试
  - `FocusLockTag.test.tsx` — 焦点锁定标签显示/隐藏/关闭测试
  - `DataProbeButton.test.tsx` — disabled 状态和 tooltip 测试
  - 扩展 `workshop-store.test.ts` — 确保 T002 中新增的所有字段测试完整
  **覆盖 AC**: AC-01, AC-02, AC-03, AC-04, AC-09, AC-11, AC-16, AC-17, AC-18, AC-19, AC-20, AC-27
  **依赖**: T025

---

## AC 追溯矩阵

| AC | 描述 | 实现任务 | 测试任务 |
|----|------|---------|---------|
| AC-01 | 3D/2D 视图切换 | T004, T005, T006 | T004, T005, T006, T026 |
| AC-02 | 2D 节点悬停 | T004 | T004, T026 |
| AC-03 | 2D 节点点击 | T004 | T004, T026 |
| AC-04 | 2D 缩放/拖拽 | T004 | T004, T026 |
| AC-05 | Auto-degrade > 200 | T005 | T005 |
| AC-06 | 拖拽连线视觉 | T007, T008 | E2E |
| AC-07 | 拖拽释放 Agent 请求 | T008, T025 | E2E |
| AC-08 | 拖拽释放空白 | T008 | E2E |
| AC-09 | 焦点锁定标签 | T009, T010, T011, T012 | T009, T010, T026 |
| AC-10 | 焦点消息前缀 | T009, T011 | T009 |
| AC-11 | 焦点取消 | T009, T010, T011 | T009, T010, T026 |
| AC-12 | 画布空白取消焦点 | T012 | E2E |
| AC-13 | Chat→Canvas 高亮 | T013, T014, T015 | T013, T014 |
| AC-14 | Chat 锚点点击飞向 | T014, T025 | T014 |
| AC-15 | Canvas→Chat 高亮 | T013, T014 | T013, T014 |
| AC-16 | 提示气泡显示 | T016, T017 | T016, T026 |
| AC-17 | 提示气泡点击 | T016, T017 | T016, T026 |
| AC-18 | 提示气泡消失 | T016 | T016, T026 |
| AC-19 | Pending 删除按钮 | T018 | T018, T026 |
| AC-20 | Confirmed 无删除 | T018 | T018, T026 |
| AC-21 | 删除影响展示 | T018 | T018 |
| AC-22 | 删除碎裂动画 | T019, T025 | E2E |
| AC-23 | Fresnel 边缘光 | T021 | E2E |
| AC-24 | 发光拖拽线 | T022 | E2E |
| AC-25 | 冲击波动画 | T023 | E2E |
| AC-26 | 电影感相机 | T024 | E2E |
| AC-27 | 数据探针占位 | T020 | T020, T026 |

---

## 实际偏差记录

> 完成后，在此记录实现与 spec.md 的偏差，供后续参考。
