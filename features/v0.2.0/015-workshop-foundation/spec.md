# F015: Workshop Foundation（本体工坊基础）

> 本文档合并需求规范与技术设计。需求部分描述业务能力，设计部分只写契约和决策（Why + What），不写实现步骤（How）。

**关联 PRD**: `docs/prd/0.2.0/AI 辅助本体构建 PRD.md` — §3.1（Chat-to-Canvas 范式）、§4.3（模块 C：3D 本体工坊）、§5.1（核心用户故事 US-1/US-2）、§5.2（端到端流程走查）、§6.1（前端代码结构）、§6.8（渲染性能策略）
**架构参考**: `docs/architecture/01-system-architecture.md`
**版本契约**: `features/v0.2.0/release-contract.md`
**优先级**: P0
**所属版本**: v0.2.0

---

## 1. 概述与用户故事

F015 是 v0.2.0 的核心前端特性，将 3D 星空 Demo（`/demo/canvas`）升级为生产级**本体工坊**（`/workshop`）——AI 辅助本体构建的主交互界面。工坊采用 **Chat-to-Canvas** 范式：左侧对话面板承载线性的意图表达，中央 3D 星空画布承载非线性的拓扑结构，右侧 Sidekick 面板展示 Agent 实时建议。

F015 是纯前端实现，消费 F012（Agent SSE）和 F014（Material/Blueprint API）提供的后端能力，不新增后端端点。

### US-1 业务分析师进入工坊构建本体

作为 **业务分析师**，
我希望 进入本体工坊，上传资料文件，与 Agent 对话，在 3D 星空中实时观察本体蓝图的"结晶"过程，
以便 直观理解本体结构并快速完成企业本体的初稿构建。

### US-2 领域专家通过对话微调蓝图

作为 **领域专家**，
我希望 在工坊中点击星体查看实体详情，通过对话要求 Agent 补充缺失的对象类型，
以便 利用专业知识完善 Agent 生成的本体蓝图。

### US-3 用户首次进入工坊时设定领域上下文

作为 **用户**，
我希望 首次进入工坊时填写业务领域、建模目标和概念范围（或选择跳过），
以便 Agent 在后续分析中获得更精准的上下文，提高建议质量。

---

## 2. 验收标准

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| **工坊布局与路由** | | | |
| AC-01 | 用户 | 访问 `/workshop` | 渲染全屏三面板布局：左侧对话面板、中央 3D 星空画布、右侧 Sidekick 面板。无 AppShell 侧边栏。 |
| AC-02 | 用户 | 收缩/展开左侧对话面板 | 面板在 280px（收缩）和 380px（展开）之间切换，中央画布自适应填满剩余空间 |
| AC-03 | 用户 | 收缩/展开右侧 Sidekick 面板 | 面板在 0px（折叠）和 320px（展开）之间切换 |
| AC-04 | 用户 | 点击工坊左上角返回按钮 | 导航回 Ontology Manager 首页（`/`） |
| **Phase 0 领域引导** | | | |
| AC-05 | 用户 | 首次进入空白工坊（无活跃会话） | 对话面板显示引导卡片，包含：业务领域选择（电商/金融/供应链/医疗/自定义输入）、建模目标选择、概念范围文本框 |
| AC-06 | 用户 | 填写领域引导卡片并点击"开始" | 调用 `POST /api/v1/agent/sessions` 创建会话（携带 domain、goal、scopeHint），卡片消失，显示对话输入框 |
| AC-07 | 用户 | 点击引导卡片的"跳过" | 调用 `POST /api/v1/agent/sessions` 创建会话（domain/goal/scopeHint 为空），卡片消失 |
| **对话面板（ChatPanel）** | | | |
| AC-08 | 用户 | 在输入框输入消息并点击发送（或按 Enter） | 消息出现在消息列表中（用户气泡），调用 `POST /api/v1/agent/chat`，SSE 流开始 |
| AC-09 | 用户 | SSE 返回 `text-delta` 事件 | Assistant 气泡实时追加文本，呈打字机效果 |
| AC-10 | 用户 | SSE 返回 `done` 事件 | 流结束，Assistant 气泡完成渲染，消息持久化到消息历史 |
| AC-11 | 用户 | SSE 返回 `error` 事件 | 对话面板显示错误提示条（含错误码和消息），流终止 |
| AC-12 | 用户 | Agent 正在流式回复时点击发送新消息 | 发送按钮禁用，显示"Agent 正在思考…"提示 |
| AC-13 | 用户 | 刷新页面后重新访问工坊（有活跃会话） | 自动加载最近一个 active 会话，消息历史从 API 恢复显示 |
| **文件上传** | | | |
| AC-14 | 用户 | 将文件拖入对话面板区域 | 显示拖放高亮区域（虚线边框 + "释放以上传文件"提示） |
| AC-15 | 用户 | 释放支持的文件（csv/xlsx/sql/pdf/md/docx/txt） | 调用 `POST /api/v1/agent/materials/upload`，对话面板显示文件缩略卡（文件名、大小、类型图标、上传进度条） |
| AC-16 | 用户 | 上传完成后文件缩略卡状态 | 进度条消失，显示 ✓ 已上传状态 |
| AC-17 | 用户 | 点击上传按钮（📎 图标） | 打开文件选择对话框，选择文件后执行上传 |
| AC-18 | 用户 | 上传不支持的文件类型 | 显示 Toast 错误提示："不支持的文件类型，请上传 CSV、Excel、SQL、PDF、Markdown、Word 或文本文件" |
| AC-19 | 用户 | 上传超过 10MB 的文件 | 显示 Toast 错误提示："文件大小超过 10MB 限制" |
| **3D 星空画布（StarfieldWorkbench）** | | | |
| AC-20 | 用户 | 进入已有本体的工坊（存在已发布的 ObjectType） | 画布渲染现有 ObjectType 为明亮实体星体，LinkType 为实线星链 |
| AC-21 | 用户 | 进入空白工坊（无 ObjectType） | 画布显示空星空背景 + 中心引导动画（脉冲光效） |
| AC-22 | 用户 | SSE 返回 `blueprint-item` 事件（type=object_type） | 画布中心触发能量漩涡（VortexEffect），新星体从漩涡中诞生，呈半透明状态（pending review），并附 AI 角标 ✦ |
| AC-23 | 用户 | SSE 返回 `blueprint-item` 事件（type=link_type） | 两个相关星体之间出现虚线连线（pending review），带方向箭头 |
| AC-24 | 用户 | SSE 返回 `blueprint-complete` 事件 | 漩涡效果停止，所有星体就位，画布自动 fit-to-view |
| AC-25 | 用户 | 在画布中使用鼠标滚轮 | 缩放 3D 场景 |
| AC-26 | 用户 | 按住右键拖拽画布 | 旋转 3D 场景视角 |
| AC-27 | 用户 | 点击底部工具栏"适配"按钮 | 画布自动缩放以显示所有星体 |
| AC-28 | 用户 | 点击底部工具栏"重置"按钮 | 画布恢复默认视角和缩放级别 |
| **渐进式实体探索** | | | |
| AC-29 | 用户 | 鼠标悬停星体 200ms | 显示 Popover（Tier 1）：名称 + 类型徽标（OT/LT）+ 一行描述 + 置信度色标（🟢/🟡/🔴） |
| AC-30 | 用户 | 单击星体 | 打开侧面 Drawer（Tier 2）：完整属性列表 + 关系分组 + 推理来源标签 + 置信度分值 |
| AC-31 | 用户 | 双击星体（已确认的实体） | 在新标签页打开 Ontology Manager 对象类型详情页（`/object-types/:rid`） |
| AC-32 | 用户 | 在 Tier 2 Drawer 中查看推理来源 | 显示来源标签（字段分析/模式匹配/语义推断/最佳实践）+ 推理说明文字 |
| **Sidekick 面板** | | | |
| AC-33 | 用户 | SSE 返回 `plan-step` 事件 | Sidekick 面板显示规划进度树（步骤序号 + 步骤文字 + 当前进度 i/total） |
| AC-34 | 用户 | SSE 返回 `blueprint-item` 事件 | Sidekick 面板新增建议卡片：类型图标（🔵OT/🔗LT）+ 名称 + 置信度指示器（颜色 + 百分比）+ 推理来源标签 |
| AC-35 | 用户 | 在 Sidekick 中点击建议卡片 | 画布自动平移并聚焦到对应星体，同时打开 Tier 2 Drawer |
| **页面状态管理** | | | |
| AC-36 | 系统 | 首次进入，无本体数据 | 页面状态 = `empty`，画布显示空星空，对话面板显示引导卡片 |
| AC-37 | 系统 | 存在已发布 ObjectType | 页面状态 = `existing`，画布渲染现有实体，对话面板显示"上传资料扩展本体" |
| AC-38 | 系统 | SSE 流活跃（Agent 正在分析） | 页面状态 = `analyzing`，画布显示实时结晶动画，Sidekick 显示进度 |
| AC-39 | 系统 | SSE 连接中断（< 30s） | 页面状态 = `reconnecting`，画布右上角显示"重新连接中…"指示器，系统自动执行指数退避重连（1s→2s→4s→8s→max 30s）。重连成功后恢复上一状态 |
| AC-40 | 系统 | SSE 连接中断超过 30s（自动重连失败） | 页面状态 = `disconnected`，画布显示 Loading 遮罩 + "连接已断开"横幅 + 手动重连按钮 |
| AC-41 | 用户 | 点击手动重连按钮 | 尝试重新建立 SSE 连接，成功后恢复上一状态，失败则保持 disconnected |
| **置信度视觉系统** | | | |
| AC-42 | 系统 | 蓝图项 confidence ≥ 0.8（high） | 星体较明亮，连线较粗，置信度指示器绿色 🟢 |
| AC-43 | 系统 | 蓝图项 confidence 0.5-0.8（medium） | 星体半透明，连线虚线，置信度指示器黄色 🟡 |
| AC-44 | 系统 | 蓝图项 confidence < 0.5（low） | 星体微弱闪烁，连线细虚线 + 警示色，置信度指示器红色 🔴 |
| AC-45 | 系统 | 所有 AI 生成的元素（蓝图项） | 星体中心悬浮发光 AI 角标 ✦，区分"事实"（已确认）与"建议"（待审） |

---

## 3. 边界情况

- 当 SSE 连接中断超过 30 秒时，自动进入 `disconnected` 状态，画布冻结当前视图
- 当用户在多个浏览器标签页打开工坊时，每个标签页独立管理 SSE 连接（INV-12 由后端保证单活跃会话）
- 当 Agent 流式回复期间用户刷新页面时，已接收的消息从 API 恢复，流式部分丢失（用户可重新发送消息）
- 当 ObjectType 数量 > 100 时，画布可能出现性能下降（F016 负责 >200 节点的 2D 降级和 WebWorker 优化）
- 当文件上传网络中断时，显示上传失败状态，用户可重试
- 当无本体数据且无活跃会话时，显示空白工坊 + Phase 0 引导
- **不支持**：3D/2D 视图切换（延后到 F016）
- **不支持**：蓝图审查栏和 Accept/Edit/Reject 操作（延后到 F017）
- **不支持**：焦点锁定机制和双向高亮联动（延后到 F016）
- **不支持**：引导性提示气泡和数据预览探针（延后到 F016）
- **不支持**：视觉效果升级如 Fresnel 边缘光、冲击波、电影感相机（延后到 F016）

---

## 4. 架构决策

| ID | 决策 | 选项 | 结论 | 理由 |
|----|------|------|------|------|
| AD-01 | Workshop 路由模式 | A: AppShell 内嵌页面 / B: 独立全屏路由 | 选 B | 工坊需要全屏沉浸式体验，不与管理后台共享侧边栏。与 Demo 路由（`/demo/canvas`）一致 |
| AD-02 | SSE 消费方式 | A: EventSource / B: fetch + ReadableStream | 选 B | Agent chat 端点是 POST（EventSource 仅支持 GET）。fetch + ReadableStream 是标准做法 |
| AD-03 | 3D 组件复用策略 | A: 从 Demo 提取共享库 / B: 在 workshop/ 下独立构建 | 选 B | Demo 使用 Mock 类型（DemoObjectType），Workshop 需要真实 API 类型。共享库需要泛型化，额外复杂度不值得。Demo 保留不动 |
| AD-04 | Workshop 图模型 | A: 直接使用 API 类型 / B: 统一适配器模型（WorkshopNode/Edge） | 选 B | 画布需要统一处理"已确认的 ObjectType"和"待审的 BlueprintItem"，适配器将两者转为同一接口 |
| AD-05 | SSE 事件分发 | A: useAgentChat hook 内部处理所有事件 / B: hook 分发到 Zustand store | 选 B | blueprint-item 事件需要同时更新对话面板（消息）、画布（新星体）、Sidekick（建议卡片），store 是天然的事件总线 |
| AD-06 | 面板布局方案 | A: CSS Flexbox 固定比例 / B: 可拖拽分隔条（Resizable） | 选 A + 折叠 | MVP 阶段用 Flexbox + 折叠按钮实现即可。可拖拽分隔条体验更好但增加复杂度，可在 F016 迭代 |

---

## 5. 数据库 & Domain 模型

**无新增数据库表**。F015 纯前端实现，消费 F012/F014 已定义的表和 API。

### 前端类型定义

```typescript
// pages/workshop/types.ts

/** 工坊页面状态 */
type WorkshopPageState =
  | 'empty'              // 无本体数据，显示引导
  | 'existing'           // 已有本体，渲染现有星体
  | 'analyzing'          // Agent 流式分析中
  | 'blueprint_pending'  // 蓝图待审（F017 消费此状态）
  | 'disconnected';      // SSE 连接断开

/** 统一画布节点（适配 ObjectType + BlueprintItem） */
interface WorkshopNode {
  id: string;                          // ObjectType rid 或 BlueprintItem rid
  type: 'object_type' | 'link_type';
  displayName: string;
  apiName?: string;
  description?: string;
  icon?: string;
  color: string;
  properties?: WorkshopProperty[];
  // 位置（由布局算法计算）
  position: { x: number; y: number; z: number };
  // 状态
  status: 'confirmed' | 'pending';     // confirmed = 已有 OT, pending = 蓝图项
  // 置信度（仅 pending 状态有值）
  confidence?: number;
  confidenceLevel?: 'high' | 'medium' | 'low';
  reasoning?: string;
  source?: 'field_analysis' | 'pattern_matching' | 'semantic_inference' | 'best_practices';
  // 来源蓝图项 RID（仅 pending 状态）
  blueprintItemRid?: string;
}

interface WorkshopProperty {
  displayName: string;
  apiName: string;
  baseType: string;
}

/** 统一画布边（适配 LinkType + BlueprintItem link_type） */
interface WorkshopEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  label: string;
  cardinality?: string;
  status: 'confirmed' | 'pending';
  confidence?: number;
  confidenceLevel?: 'high' | 'medium' | 'low';
  blueprintItemRid?: string;
}

/** 拖拽连线状态（复用 Demo 模式） */
interface DragLinkState {
  sourceNodeId: string;
  sourcePosition: { x: number; y: number; z: number };
  currentPointerPosition: { x: number; y: number; z: number };
  hoveredTargetId: string | null;
}

/** SSE 事件联合类型 */
type SSEEvent =
  | { type: 'text-delta'; data: { text: string } }
  | { type: 'plan-step'; data: { step: string; index: number; total: number } }
  | { type: 'blueprint-item'; data: { rid: string; itemType: string; suggestion: Record<string, unknown>; confidence: number; confidenceLevel: string } }
  | { type: 'blueprint-complete'; data: { blueprintRid: string; name: string; status: string; itemCount: number } }
  | { type: 'material-uploaded'; data: { rid: string; fileName: string; fileType: string } }
  | { type: 'done'; data: { sessionRid: string; summary: string } }
  | { type: 'error'; data: { code: string; message: string } };
```

---

## 6. API 契约

### 消费的端点（全部来自 F012/F014，无新增）

| Method | Path | 描述 | 来源 |
|--------|------|------|------|
| POST | `/api/v1/agent/sessions` | 创建 Agent 会话（含 domain/goal/scopeHint） | F012 |
| GET | `/api/v1/agent/sessions` | 查询会话列表 | F012 |
| GET | `/api/v1/agent/sessions/{rid}` | 获取会话详情（含消息历史） | F012 |
| POST | `/api/v1/agent/chat` | SSE 流式对话 | F012 |
| POST | `/api/v1/agent/materials/upload` | 上传资料文件 | F014 |
| GET | `/api/v1/agent/materials` | 查询素材列表 | F014 |
| DELETE | `/api/v1/agent/materials/{rid}` | 删除素材 | F014 |
| GET | `/api/v1/blueprints` | 查询蓝图列表 | F014 |
| GET | `/api/v1/blueprints/{rid}` | 获取蓝图详情（含蓝图项） | F014 |
| GET | `/api/v1/object-types` | 获取现有对象类型（渲染已有星体） | v0.1.0 |
| GET | `/api/v1/link-types` | 获取现有链接类型（渲染已有星链） | v0.1.0 |

### SSE 事件格式（来自 F012/F014 `sse_adapter.py`）

| 事件类型 | 数据结构 | 说明 |
|---------|---------|------|
| `text-delta` | `{ text: string }` | Agent 流式回复文本增量 |
| `plan-step` | `{ step: string, index: number, total: number }` | 规划步骤进度 |
| `blueprint-item` | `{ rid, itemType, suggestion, confidence, confidenceLevel }` | 新识别的蓝图项 → 触发画布结晶 |
| `blueprint-complete` | `{ blueprintRid, name, status, itemCount }` | 蓝图生成完毕 |
| `material-uploaded` | `{ rid, fileName, fileType }` | 文件上传确认（SSE 内） |
| `done` | `{ sessionRid, summary }` | 流式回复结束 |
| `error` | `{ code, message }` | 错误事件 |

### 前端 API Hook 设计

```typescript
// api/agent.ts — Agent 会话管理
agentSessionKeys.all / .lists() / .list(params) / .details() / .detail(rid)
useAgentSessions(ontologyRid, page, pageSize) → AgentSessionList
useAgentSessionDetail(rid) → AgentSessionDetail
useCreateAgentSession() → mutation
useDeleteAgentSession() → mutation

// api/materials.ts — 素材上传管理
materialKeys.all / .list(sessionRid) / .detail(rid)
useMaterials(sessionRid) → AgentMaterial[]
useUploadMaterial() → mutation (multipart/form-data)
useDeleteMaterial() → mutation

// api/blueprints.ts — 蓝图查询
blueprintKeys.all / .lists() / .list(params) / .details() / .detail(rid)
useBlueprints(sessionRid) → BlueprintList
useBlueprintDetail(rid) → BlueprintDetail
```

---

## 7. Service / Router 层逻辑

**无新增后端逻辑**。F015 纯前端实现。

### 前端核心 Hook 逻辑

- **useAgentChat(sessionRid)**: 使用 `fetch` POST `/api/v1/agent/chat` 获取 SSE 流，通过 `ReadableStream` + `TextDecoder` 逐行解析事件。`text-delta` 累积到 `streamingText`；`plan-step` 更新 Zustand store 的 `planSteps`；`blueprint-item` 触发 store 的 `addPendingCrystallization`；`done` 将完整消息写入 TanStack Query cache；`error` 设置错误状态。
- **useWorkshopGraph(ontologyRid, sessionRid)**: 合并两个数据源——已有 ObjectType/LinkType（TanStack Query）和蓝图项 BlueprintItem（TanStack Query）——统一转换为 `WorkshopNode[]` 和 `WorkshopEdge[]`。使用球面分布算法计算节点位置。

---

## 8. Agent 集成设计

F015 不直接集成 Agent，而是消费 F012 的 SSE 事件流。

### SSE 事件消费映射

| 事件 | 对话面板 | 画布 | Sidekick |
|------|---------|------|---------|
| `text-delta` | 追加 Assistant 消息文本 | — | — |
| `plan-step` | — | — | 更新进度树 |
| `blueprint-item` | — | 触发结晶动画，添加半透明星体/虚线连线 | 添加建议卡片 |
| `blueprint-complete` | — | 停止漩涡，fit-to-view | 显示蓝图完成摘要 |
| `done` | 完成消息渲染 | — | — |
| `error` | 显示错误横幅 | — | — |

---

## 9. 前端组件设计

### 页面结构

```
WorkshopPage                            # 全屏三面板容器（CSS Flexbox）
├── ChatPanel                           # 左侧（固定宽度 380px，可折叠到 48px）
│   ├── GuidanceCard                    # Phase 0 引导（仅空白工坊状态）
│   ├── FileUploadArea                  # 拖放/按钮上传区
│   ├── MessageList                     # 可滚动消息历史
│   │   ├── MessageBubble (user)        # 用户消息气泡
│   │   ├── MessageBubble (assistant)   # Agent 消息气泡（含流式文本）
│   │   └── FileThumbnailCard           # 文件上传缩略卡
│   └── ChatInput                       # 底部输入框 + 发送按钮 + 📎 上传按钮
├── StarfieldWorkbench                  # 中央（flex: 1，占满剩余空间）
│   ├── WorkshopCanvas                  # R3F Canvas 容器
│   │   ├── SceneContent                # 灯光、控制器、背景
│   │   ├── WorkshopStarNode × N        # 星体（confirmed = 明亮，pending = 半透明 + AI角标）
│   │   ├── WorkshopStarLink × N        # 星链（confirmed = 实线，pending = 虚线）
│   │   ├── BackgroundStars             # 背景星空粒子
│   │   └── VortexEffect                # 漩涡效果（结晶动画触发时）
│   ├── WorkshopToolbar                 # 底部工具栏：缩放 / 适配 / 重置
│   ├── EntityPopover                   # Tier 1: 悬停预览（Ant Design Popover）
│   └── EntityDrawer                    # Tier 2: 点击详情面板（Ant Design Drawer）
├── SidekickPanel                       # 右侧（固定宽度 320px，可折叠到 0px）
│   ├── PlanProgressTree                # 规划进度展示
│   ├── SuggestionCard × N              # 蓝图项建议卡片
│   │   └── ConfidenceIndicator         # 置信度色标 + 百分比
│   └── BlueprintSummary                # 蓝图完成后的摘要（名称 + 项数）
└── ConnectionBanner                    # SSE 断连遮罩（全屏覆盖）
```

### 路由

```
/workshop                               # 工坊主页面（全屏，独立于 AppShell）
```

注册方式：在 `router.tsx` 的 `routeConfig` 顶层添加，与 `/demo/canvas` 同级。

### Zustand Store 设计

```typescript
// stores/workshop-store.ts
interface WorkshopStore {
  // 页面状态
  pageState: WorkshopPageState;
  setPageState: (state: WorkshopPageState) => void;

  // 会话
  currentSessionRid: string | null;
  setCurrentSessionRid: (rid: string | null) => void;

  // SSE 连接
  connectionStatus: 'idle' | 'connected' | 'disconnected';
  setConnectionStatus: (s: 'idle' | 'connected' | 'disconnected') => void;

  // 实体交互
  selectedEntityRid: string | null;
  setSelectedEntityRid: (rid: string | null) => void;
  hoveredEntityRid: string | null;
  setHoveredEntityRid: (rid: string | null) => void;

  // 面板可见性
  isChatPanelExpanded: boolean;
  isSidekickOpen: boolean;
  toggleChatPanel: () => void;
  toggleSidekick: () => void;

  // SSE 事件缓冲
  planSteps: Array<{ step: string; index: number; total: number }>;
  addPlanStep: (step: { step: string; index: number; total: number }) => void;
  clearPlanSteps: () => void;

  // 结晶队列（blueprint-item 事件驱动）
  pendingCrystallizations: SSEBlueprintItemData[];
  addPendingCrystallization: (item: SSEBlueprintItemData) => void;
  consumeCrystallization: (rid: string) => void;

  // 重置
  reset: () => void;
}
```

---

## 10. 文件清单

```
apps/web/src/
├── pages/workshop/
│   ├── WorkshopPage.tsx                # 新建 — 主页面（三面板布局）
│   ├── types.ts                        # 新建 — WorkshopNode/Edge/SSEEvent 等类型
│   ├── components/
│   │   ├── ChatPanel.tsx               # 新建 — 左侧对话面板容器
│   │   ├── GuidanceCard.tsx            # 新建 — Phase 0 引导卡片
│   │   ├── FileUploadArea.tsx          # 新建 — 拖放/按钮上传
│   │   ├── MessageList.tsx             # 新建 — 消息历史列表
│   │   ├── MessageBubble.tsx           # 新建 — 单条消息气泡
│   │   ├── FileThumbnailCard.tsx       # 新建 — 文件缩略卡
│   │   ├── ChatInput.tsx               # 新建 — 输入框 + 发送按钮
│   │   ├── StarfieldWorkbench.tsx      # 新建 — 中央 3D 画布容器
│   │   ├── WorkshopCanvas.tsx          # 新建 — R3F Canvas（参考 Demo StarfieldCanvas）
│   │   ├── WorkshopStarNode.tsx        # 新建 — 星体组件（参考 Demo StarNode）
│   │   ├── WorkshopStarLink.tsx        # 新建 — 星链组件（参考 Demo StarLink）
│   │   ├── EntityPopover.tsx           # 新建 — Tier 1 悬停预览
│   │   ├── EntityDrawer.tsx            # 新建 — Tier 2 详情面板
│   │   ├── SidekickPanel.tsx           # 新建 — 右侧 Sidekick 容器
│   │   ├── PlanProgressTree.tsx        # 新建 — 规划进度树
│   │   ├── SuggestionCard.tsx          # 新建 — 建议卡片
│   │   ├── ConfidenceIndicator.tsx     # 新建 — 置信度指示器
│   │   ├── BlueprintSummary.tsx        # 新建 — 蓝图完成摘要
│   │   ├── WorkshopToolbar.tsx         # 新建 — 画布工具栏
│   │   └── ConnectionBanner.tsx        # 新建 — SSE 断连遮罩
│   ├── hooks/
│   │   ├── use-agent-chat.ts           # 新建 — SSE 流式对话 hook
│   │   ├── use-workshop-graph.ts       # 新建 — 图模型合并 hook
│   │   └── use-sse-parser.ts           # 新建 — SSE 事件解析工具
│   ├── stores/
│   │   └── workshop-store.ts           # 新建 — Zustand UI 状态
│   └── styles/
│       └── workshop.module.css         # 新建 — 暗色主题样式
├── api/
│   ├── agent.ts                        # 新建 — Agent 会话 TanStack Query hooks
│   ├── blueprints.ts                   # 新建 — 蓝图查询 hooks
│   └── materials.ts                    # 新建 — 素材管理 hooks
├── api/types.ts                        # 修改 — 添加 Agent/Blueprint/Material 类型别名
├── locales/en-US/common.json           # 修改 — 添加 workshop.* 命名空间
├── locales/zh-CN/common.json           # 修改 — 添加 workshop.* 命名空间
├── router.tsx                          # 修改 — 添加 /workshop 路由
└── generated/api.ts                    # 重新生成 — 确保包含 Agent/Blueprint/Material schemas
```

---

## 非功能要求

- **性能**: 画布渲染维持 60fps（≤100 节点时）；SSE 事件处理防抖合并（200ms）；消息渲染 <100ms/条
- **安全**: 文件上传前端预校验类型和大小（后端是最终校验方）；不在前端存储 API Key
- **可用性**: SSE 断连 30 秒后显示重连 UI；流式回复中禁用发送按钮；文件上传显示进度条
- **浏览器**: 依赖 WebGL 2.0（React Three Fiber 要求）；不支持 WebGL 的浏览器显示"请使用现代浏览器"提示（F016 提供 2D 降级方案）

---

## 相关文档

- 架构参考: `docs/architecture/01-system-architecture.md`
- PRD 主参考: `docs/prd/0.2.0/AI 辅助本体构建 PRD.md` §3.1, §4.3, §5.1-5.3, §6.1, §6.8
- 领域术语: CLAUDE.md §领域术语
- 3D Demo 参考: `apps/web/src/pages/demo/` — 星体/星链/漩涡/拖拽组件
- 依赖特性: `features/v0.2.0/012-agent-foundation`（Agent SSE 端点）、`features/v0.2.0/014-material-and-blueprint`（Material/Blueprint API）
- 版本契约: `features/v0.2.0/release-contract.md`（INV-12/13/16 约束前端行为）
