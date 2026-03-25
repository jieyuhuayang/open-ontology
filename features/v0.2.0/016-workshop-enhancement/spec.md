# F016: Workshop Enhancement（本体工坊增强）

> 本文档合并需求规范与技术设计。需求部分描述业务能力，设计部分只写契约和决策（Why + What），不写实现步骤（How）。
> 前置步骤：Spec Discovery 已完成，4 个不确定性问题已与用户对齐。

**关联 PRD**: `docs/prd/0.2.0/AI 辅助本体构建 PRD.md` — §3.7（MX）、§3.8（引导性提示）、§3.9（数据预览）、§4.3（模块 C：3D 本体工坊）、§6.7（语义设计系统）、§6.8（渲染性能策略）
**架构参考**: `docs/architecture/01-system-architecture.md`
**版本契约**: `features/v0.2.0/release-contract.md`
**优先级**: P0
**所属版本**: v0.2.0

---

## 1. 概述与用户故事

F016 在 F015（Workshop Foundation）基础上增强本体工坊的画布交互和视觉体验。F015 交付了三面板布局、SSE 流式通信、3D 星空渲染、文件上传、实体探索等基础能力；F016 补全 F015 明确标注"不支持"的 8 个功能区域：3D/2D 视图切换、拖拽连线创建链接、焦点锁定、双向高亮联动、引导性提示气泡、视觉效果升级、删除星体、数据探针占位。

F016 是**纯前端 feature**，不新增后端端点，消费 F012/F014 已有 API。

### US-1 用户通过拖拽在画布上创建链接关系

作为 **业务分析师**，
我希望 在 3D 星空中从一个星体拖拽到另一个星体来创建链接关系，Agent 自动推荐基数和命名，
以便 以直觉式操作建立实体间的语义关系，而无需填写表单。

### US-2 用户通过焦点锁定和对话精确修改特定实体

作为 **领域专家**，
我希望 点击画布上的星体后锁定对话焦点，后续的对话指令自动作用于该实体，
以便 在大量实体中精确修改特定对象类型的属性和关系，避免歧义。

### US-3 用户在大规模本体中切换到 2D 视图保持流畅

作为 **数据架构师**，
我希望 当本体实体超过 200 个时系统提示切换到 2D 视图，且 2D 视图支持基本的节点交互，
以便 在大规模本体中保持操作流畅度，不因 3D 渲染性能限制而影响工作效率。

---

## 2. 验收标准

> AC-ID 在本特性内唯一。tasks.md 中的测试任务必须通过 `覆盖 AC: AC-NN` 追溯到此表。

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| **3D/2D 视图切换** | | | |
| AC-01 | 用户 | 点击工具栏 3D/2D 切换按钮 | 画布在 3D（React Three Fiber）和 2D（ReactFlow 力导向图）之间切换，节点/边数据一致。2D 节点样式反映 confirmed/pending 状态和置信度色标 |
| AC-02 | 用户 | 在 2D 视图中悬停节点 | 显示 EntityPopover（与 3D 相同内容：名称 + 类型 + 描述 + 置信度） |
| AC-03 | 用户 | 在 2D 视图中点击节点 | 打开 EntityDrawer（与 3D 相同行为） |
| AC-04 | 用户 | 在 2D 视图中缩放/拖拽画布 | ReactFlow 内置缩放和平移正常工作 |
| AC-05 | 系统 | 画布节点数 > 200 | 显示通知消息建议切换到 2D 视图（仅提示，不自动切换） |
| **拖拽连线创建链接（3D only）** | | | |
| AC-06 | 用户 | 在 3D 画布中从星体 A 拖拽到星体 B | 显示发光拖拽虚线跟随鼠标，悬停目标星体时线条高亮 |
| AC-07 | 用户 | 释放拖拽到有效目标星体上 | 发送 Agent chat 消息（"请建议 {A} 到 {B} 的链接类型"），Agent 通过 SSE blueprint-item 事件返回链接建议 |
| AC-08 | 用户 | 释放拖拽到空白区域（无目标） | 拖拽线消失，无任何操作 |
| **焦点锁定** | | | |
| AC-09 | 用户 | 在 3D 画布中点击一个星体 | 对话面板顶部出现焦点锁定标签（显示实体名称 + ✦ 图标 + 关闭按钮） |
| AC-10 | 用户 | 焦点锁定后发送消息 "减少冗长字段" | 消息自动携带焦点实体上下文（"[关于 {displayName}] 减少冗长字段"），Agent 仅作用于该实体 |
| AC-11 | 用户 | 点击焦点锁定标签的关闭按钮 | 焦点锁定标签消失，后续消息不再携带实体上下文 |
| AC-12 | 用户 | 在画布空白区域点击 | 清除焦点锁定 |
| **双向高亮联动** | | | |
| AC-13 | 用户 | 将鼠标悬停在 Agent 回复中的实体名称上 | 3D 画布中对应星体以 cyan 色脉冲发光，区别于选中状态 |
| AC-14 | 用户 | 点击 Agent 回复中的实体名称 | 3D 相机平滑飞向该星体，打开 EntityDrawer |
| AC-15 | 用户 | 在画布中点击一个星体 | 对话面板高亮提及该实体的消息（背景色标识），并滚动到最近一条提及 |
| **引导性提示气泡** | | | |
| AC-16 | 用户 | 在画布中选中一个实体 | ChatInput 上方出现 3-5 个上下文相关的建议气泡（如"检查孤立外键"、"推导统计属性"） |
| AC-17 | 用户 | 点击一个建议气泡 | 气泡文本作为用户消息发送（经焦点锁定前缀包装），触发 Agent 执行 |
| AC-18 | 用户 | 取消选中实体 | 建议气泡消失 |
| **删除星体** | | | |
| AC-19 | 用户 | 在 EntityDrawer 中查看 pending 实体 | 底部显示红色"删除"按钮 |
| AC-20 | 用户 | 在 EntityDrawer 中查看 confirmed 实体 | 不显示删除按钮（confirmed 实体通过 Ontology Manager 管理） |
| AC-21 | 用户 | 点击"删除"按钮 | 显示 Popconfirm，展示前端计算的影响范围（关联的边数量和名称） |
| AC-22 | 用户 | 在 Popconfirm 中确认删除 | 星体播放红色碎裂消散动画（~1.5s），关联边同步移除，EntityDrawer 关闭 |
| **视觉效果升级** | | | |
| AC-23 | 系统 | 渲染星体 | 星体具有 Fresnel 边缘光效果（边缘处更亮的光晕）和微弱的顶点噪声位移 |
| AC-24 | 用户 | 在 3D 画布中拖拽创建链接 | 拖拽线为发光实线 + 沿线流动的能量粒子 |
| AC-25 | 系统 | SSE 返回 link_type 类型的 blueprint-item | 两端星体发出径向冲击波动画（环形扩展 + 透明度衰减，~1s） |
| AC-26 | 用户 | 点击 fit-view / reset / 实体聚焦 | 相机以平滑 lerp 过渡移动（电影感），而非瞬间跳转 |
| **数据预览探针（占位）** | | | |
| AC-27 | 用户 | 查看星链上的探针按钮 | 按钮处于 disabled 状态，显示 tooltip "即将推出" |

---

## 3. 边界情况

- 当 2D 视图中节点数 > 500 时，力导向布局可能变慢。F016 不处理此场景（后续版本考虑 WebWorker 优化）
- 当用户在 2D 视图中尝试拖拽连线时，不支持该操作（拖拽连线仅 3D 模式）
- 当拖拽连线的源和目标是同一个星体时，忽略操作
- 当焦点锁定的实体被删除时，自动清除焦点锁定
- 当 SSE 连接断开时，拖拽连线的 Agent 请求将排队等待重连后发送（复用 F015 重连机制）
- 当视图从 3D 切换到 2D 时，清除 dragLinkState（拖拽连线仅 3D）
- 当 Agent 回复中的实体名称与多个星体匹配时，高亮所有匹配的星体
- **不支持**：2D 视图中的拖拽连线创建链接（延后到后续版本）
- **不支持**：2D 视图中的焦点锁定和引导性提示气泡（延后到后续版本）
- **不支持**：2D 视图中的 Fresnel/冲击波等 3D 视觉效果
- **不支持**：数据预览探针的实际数据采样功能（延后到 F017+，需后端 API）
- **不支持**：Agent 驱动的影响检查 API 调用（延后到 F017，F016 仅前端计算关联边）
- **不支持**：语义重力场和重力书写（PRD 标注为 V1 考虑）

---

## 4. 架构决策

| ID | 决策 | 选项 | 结论 | 理由 |
|----|------|------|------|------|
| AD-01 | 3D/2D 视图切换渲染策略 | A: 条件渲染（unmount/mount）/ B: display:none 隐藏 | 选 A | R3F Canvas 和 ReactFlow 同时挂载内存占用大，条件渲染确保只有活跃视图占用资源 |
| AD-02 | 2D 布局算法 | A: d3-force / B: ReactFlow 内置 / C: elkjs | 选 A | d3-force 是成熟方案，力导向图效果好，已有 ReactFlow 示例可参考。elkjs 更适合层次图，此处是拓扑图 |
| AD-03 | 拖拽连线的平面投射 | A: 固定 XZ 平面 / B: 相机平行平面 | 选 B | 相机平行平面确保拖拽线跟随鼠标，不因视角旋转产生偏差。参考 Demo 的 DragLinkLine 实现 |
| AD-04 | Fresnel 实现方式 | A: drei 的 Fresnel 组件 / B: 自定义 ShaderMaterial | 选 B | 需要同时实现 Fresnel + 顶点噪声 + confidence 驱动的 opacity/emissive，自定义 shader 更灵活 |
| AD-05 | 实体锚点匹配策略 | A: displayName 精确匹配 / B: 正则/模糊匹配 / C: RID 标记 | 选 A | Agent 回复中使用 `[EntityName]` 格式引用实体，精确匹配 displayName 即可。后端未来支持 RID 标记时可升级 |
| AD-06 | 引导性提示生成方式 | A: 前端模板映射 / B: Agent API 动态生成 | 选 A | F016 scope 内不新增后端端点，使用前端模板映射实现。按 entity type、status、property count 等上下文选择模板 |

---

## 5. 数据库 & Domain 模型

**无新增数据库表**。F016 纯前端实现，消费 F012/F014 已定义的表和 API。

### 前端类型扩展

```typescript
// pages/workshop/types.ts — 新增类型

/** 画布视图模式 */
export type ViewMode = '3d' | '2d';

/** 引导性提示气泡 */
export interface PromptBubble {
  id: string;
  label: string;           // i18n key
  template: string;        // 发送给 Agent 的消息模板
  entityTypes?: ('object_type' | 'link_type')[];  // 适用的实体类型
  entityStatuses?: ('confirmed' | 'pending')[];     // 适用的实体状态
  minProperties?: number;  // 最小属性数（可选条件）
}

/** 冲击波动画状态 */
export interface ShockwaveInstance {
  id: string;
  position: { x: number; y: number; z: number };
  startTime: number;
}

/** 星体坍缩动画状态 */
export interface CollapseInstance {
  id: string;
  position: { x: number; y: number; z: number };
  color: string;
  startTime: number;
}
```

### Zustand Store 扩展

```typescript
// pages/workshop/stores/workshop-store.ts — 新增字段

interface WorkshopStore {
  // ... 现有字段 ...

  // 视图模式
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // 焦点锁定
  focusedEntityRid: string | null;
  setFocusedEntityRid: (rid: string | null) => void;
  clearFocusLock: () => void;

  // 双向高亮
  highlightedEntityRids: string[];
  setHighlightedEntityRids: (rids: string[]) => void;
  clearHighlights: () => void;

  // 拖拽连线（DragLinkState 已在 types.ts 中定义）
  dragLinkState: DragLinkState | null;
  setDragLinkState: (state: DragLinkState | null) => void;
  clearDragLink: () => void;

  // 视觉效果
  activeShockwaves: ShockwaveInstance[];
  addShockwave: (instance: ShockwaveInstance) => void;
  removeShockwave: (id: string) => void;

  activeCollapses: CollapseInstance[];
  addCollapse: (instance: CollapseInstance) => void;
  removeCollapse: (id: string) => void;
}
```

---

## 6. API 契约

### 消费的端点（全部来自 F012/F014/v0.1.0，无新增）

| Method | Path | 描述 | 来源 |
|--------|------|------|------|
| POST | `/api/v1/agent/chat` | SSE 流式对话（拖拽连线后发送链接建议请求） | F012 |
| GET | `/api/v1/object-types` | 获取现有对象类型（2D 视图渲染） | v0.1.0 |
| GET | `/api/v1/link-types` | 获取现有链接类型（2D 视图渲染） | v0.1.0 |
| GET | `/api/v1/blueprints/{rid}` | 获取蓝图详情（2D 视图渲染 pending 项） | F014 |

---

## 7. Service / Router 层逻辑

**无新增后端逻辑**。F016 纯前端实现。

### 前端核心 Hook 逻辑

- **useFocusLock(nodes)**: 管理焦点锁定状态。`lockEntity(rid)` 设置 `focusedEntityRid`；`unlockEntity()` 清除；`prefixMessage(content)` 在消息前添加 `[关于 {displayName}]` 上下文前缀。从 `nodes` 中查找 `displayName`。
- **useEntityHighlights(nodes, messages)**: 管理双向高亮。`highlightFromChat(rid)` 在 chat 锚点悬停时高亮对应星体；`highlightFromCanvas(rid)` 在星体点击时高亮相关消息。使用 `displayName` 精确匹配消息文本。

---

## 8. Agent 集成设计

F016 不直接新增 Agent 集成，但通过现有的 `POST /api/v1/agent/chat` 实现两个画布驱动的 Agent 交互：

### 拖拽连线 → Agent 链接建议

用户拖拽连线释放后，前端自动发送格式化消息：
```
请建议从 {sourceDisplayName} 到 {targetDisplayName} 的链接类型，包括基数关系和关系名称
```
Agent 通过 SSE `blueprint-item` 事件返回 `link_type` 类型的蓝图项。

### 焦点锁定 → Agent 上下文约束

焦点锁定后，用户消息自动添加前缀：
```
[关于 {focusedDisplayName}] {用户原始消息}
```
Agent 理解此前缀，将操作范围限定在指定实体。

---

## 9. 前端组件设计

### 页面结构（在 F015 基础上扩展）

```
WorkshopPage                               # 全屏三面板容器
├── ChatPanel                              # 左侧
│   ├── GuidanceCard                       # (F015) Phase 0 引导
│   ├── FocusLockTag                       # [NEW] 焦点锁定标签（实体名 + 关闭按钮）
│   ├── FileUploadArea                     # (F015) 文件上传
│   ├── MessageList                        # (F015, 修改) 新增消息高亮
│   │   └── MessageBubble                  # (F015, 修改) 新增实体锚点
│   ├── PromptBubbles                      # [NEW] 引导性提示气泡（3-5 个 pill 按钮）
│   └── ChatInput                          # (F015) 底部输入
├── StarfieldWorkbench                     # 中央（修改：3D/2D 视图路由）
│   ├── WorkshopCanvas                     # (F015, 修改) 3D 模式
│   │   ├── WorkshopStarNode × N           # (F015, 修改) Fresnel shader + 高亮
│   │   ├── WorkshopStarLink × N           # (F015) 星链
│   │   ├── DragLinkLine                   # [NEW] 发光拖拽线 + 能量粒子
│   │   ├── ShockwaveEffect × N            # [NEW] 冲击波动画
│   │   ├── StarCollapseEffect × N         # [NEW] 碎裂消散动画
│   │   ├── BackgroundStars                # (F015) 背景
│   │   └── VortexEffect                   # (F015) 漩涡
│   ├── Workshop2DView                     # [NEW] 2D ReactFlow 视图
│   └── WorkshopToolbar                    # (F015, 修改) 新增 3D/2D 切换按钮
├── SidekickPanel                          # 右侧 (F015)
├── EntityPopover                          # (F015) 悬停
├── EntityDrawer                           # (F015, 修改) 新增删除按钮
│   └── DataProbeButton                   # [NEW] 数据探针占位（disabled）
└── ConnectionBanner                       # (F015) 连接状态
```

### Hook 结构

```
hooks/
├── use-agent-chat.ts                      # (F015) SSE 流式对话
├── use-workshop-graph.ts                  # (F015) 节点/边数据转换
├── use-sse-parser.ts                      # (F015) SSE 事件解析
├── use-focus-lock.ts                      # [NEW] 焦点锁定逻辑
└── use-entity-highlights.ts               # [NEW] 双向高亮逻辑
```

---

## 10. 文件清单

```
apps/web/src/pages/workshop/
├── types.ts                                          # 修改：新增 ViewMode, PromptBubble, ShockwaveInstance, CollapseInstance
├── stores/
│   ├── workshop-store.ts                             # 修改：新增 viewMode, focusedEntityRid, highlightedEntityRids, dragLinkState, shockwaves, collapses
│   └── __tests__/workshop-store.test.ts              # 修改：扩展测试覆盖新状态
├── hooks/
│   ├── use-focus-lock.ts                             # 新建：焦点锁定 hook
│   ├── use-entity-highlights.ts                      # 新建：双向高亮 hook
│   └── __tests__/
│       ├── use-focus-lock.test.ts                    # 新建：焦点锁定测试
│       └── use-entity-highlights.test.ts             # 新建：双向高亮测试
├── components/
│   ├── StarfieldWorkbench.tsx                        # 修改：3D/2D 视图路由
│   ├── WorkshopCanvas.tsx                            # 修改：拖拽交互、focus lock、cinematic camera
│   ├── WorkshopStarNode.tsx                          # 修改：Fresnel shader、高亮响应
│   ├── WorkshopStarLink.tsx                          # 修改：冲击波触发
│   ├── WorkshopToolbar.tsx                           # 修改：3D/2D 切换按钮、auto-degrade
│   ├── ChatPanel.tsx                                 # 修改：FocusLockTag、PromptBubbles 集成
│   ├── MessageBubble.tsx                             # 修改：实体锚点、高亮样式
│   ├── MessageList.tsx                               # 修改：消息高亮
│   ├── EntityDrawer.tsx                              # 修改：删除按钮
│   ├── Workshop2DView.tsx                            # 新建：ReactFlow 2D 视图
│   ├── DragLinkLine.tsx                              # 新建：发光拖拽线
│   ├── PromptBubbles.tsx                             # 新建：引导性提示气泡
│   ├── FocusLockTag.tsx                              # 新建：焦点锁定标签
│   ├── ShockwaveEffect.tsx                           # 新建：冲击波动画
│   ├── StarCollapseEffect.tsx                        # 新建：碎裂消散动画
│   └── DataProbeButton.tsx                           # 新建：数据探针占位
└── WorkshopPage.tsx                                  # 修改：全局集成新 hooks 和 props

apps/web/src/locales/
├── en-US/common.json                                 # 修改：新增 workshop 相关 i18n 键
└── zh-CN/common.json                                 # 修改：新增 workshop 相关 i18n 键
```

---

## 非功能要求

- **性能**：3D 画布 200 节点以下保持 60fps；Fresnel shader + Bloom 后处理同时运行时不掉帧；2D 视图 500 节点以下保持流畅交互
- **无障碍**：2D 视图中节点可键盘导航（ReactFlow 内置支持）
- **浏览器兼容**：Fresnel shader 需要 WebGL2，不支持时 fallback 到 meshStandardMaterial
- **i18n**：所有用户可见字符串使用 `t('key')`，覆盖中英双语

---

## 相关文档

- 架构参考: `docs/architecture/01-system-architecture.md`
- 依赖特性: `features/v0.2.0/015-workshop-foundation`（F015 必须完成）
- 版本契约: `features/v0.2.0/release-contract.md`
- 视觉升级参考: `apps/web/src/pages/demo/TODO-design-upgrades.md`
- Demo 组件参考: `apps/web/src/pages/demo/components/`（DragLinkLine, VortexEffect, StarLink）
- ReactFlow 用法参考: `apps/web/src/pages/object-types/components/LinkTypeGraph.tsx`
