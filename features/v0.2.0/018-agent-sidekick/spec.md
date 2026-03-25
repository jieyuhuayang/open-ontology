# Feature: F018 Agent Sidekick — AI 助手侧栏

> **前置步骤**：Spec Discovery 已完成，7 个不确定性问题已与用户对齐。
> 本文档合并需求规范与技术设计。需求部分描述业务能力，设计部分只写契约和决策（Why + What），不写实现步骤（How）。

**关联 PRD**: [docs/prd/0.2.0/AI 辅助本体构建 PRD.md §4.6 模块 F + §5.1 US-5 + §3.5 置信度与 AI 提示模式 + §3.8 引导性提示]
**架构参考**: [docs/architecture/01-system-architecture.md]
**优先级**: P1
**所属版本**: v0.2.0

---

## 1. 概述与用户故事

作为 **本体管理员**，
我希望 **在 Ontology Manager 的编辑页面右侧获得 AI 驱动的改进建议**，
以便 **在日常编辑中快速发现本体缺陷并一键修复，无需进入完整的本体工坊**。

### 补充用户故事

**US-5a（OT 详情页建议）**：管理员正在编辑 Customer 对象类型。打开 Sidekick 后，看到"Customer 有 12 个属性但缺少描述"和"建议将 email 标记为标题键"两条建议。接受第一条后，AI 自动生成描述并填充；接受第二条后，titleKeyPropertyId 自动更新。

**US-5b（Property 列表页建议）**：管理员在 Property 列表页查看属性。Sidekick 提示"存在 3 个 name 属性分布在不同对象类型中，可合并为共享属性"。管理员忽略此建议（共享属性功能尚未实现）。

**US-5c（LinkType 详情页建议）**：管理员在查看 Order → Customer 链接类型。Sidekick 提示"该链接基数为 one-to-one，但 Order 通常关联多个 Product，建议检查基数设置"。管理员点击编辑，将建议中的基数从 one-to-many 修改为 many-to-many 后应用。

**US-5d（降级模式）**：管理员未配置 LLM API Key。打开 Sidekick 后仅看到规则建议（缺少描述、无标题键等），不显示语义级建议。页面底部提示"配置 API Key 以获取更多 AI 建议"。

---

## 2. 验收标准

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-01 | 管理员 | 在 OT 详情页/Property 列表页/LinkType 详情页，点击右上角 ⚡ AI 按钮 | 右侧推出 Sidekick Drawer，显示建议卡片列表（规则建议瞬时呈现；LLM 建议异步加载后追加） |
| AC-02 | 管理员 | 再次点击 ⚡ AI 按钮或点击 Drawer 蒙层 | Sidekick Drawer 关闭 |
| AC-03 | 管理员 | 查看 OT 详情页（该 OT 缺少 description） | Sidekick 展示 "missing_description" 规则建议，confidence=1.0, source=completeness_check |
| AC-04 | 管理员 | 查看 OT 详情页（该 OT 缺少 titleKeyPropertyId） | Sidekick 展示 "missing_title_key" 规则建议，confidence=0.9, source=completeness_check |
| AC-05 | 管理员 | 查看 LinkType 详情页（该 LinkType 的某端 OT 已被删除） | Sidekick 展示 "orphan_link" 规则建议，confidence=1.0, source=consistency_check |
| AC-06 | 管理员 | 配置了 API Key，在 OT 详情页打开 Sidekick | 规则建议先显示，LLM 语义建议（如"建议添加链接到 Customer"）在 1-5s 后追加到列表末尾 |
| AC-07 | 管理员 | 对 "missing_description" 建议点击 [接受] | 后端调用 LLM 生成描述 → 通过 ObjectTypeService 更新 OT description → 建议卡片从列表移除 → OT 详情页的 description 字段刷新 |
| AC-08 | 管理员 | 对 "missing_title_key" 建议点击 [接受] | 后端选取最合适的属性（如 email/name）→ 通过 PropertyService 更新 isPrimaryKey/isTitleKey → 建议卡片移除 → 页面刷新 |
| AC-09 | 管理员 | 对 LLM 语义建议点击 [编辑] | 建议卡片展开内联编辑区域，显示建议内容的可编辑字段（如描述文本、基数选择）；用户修改后点击 [确认] 应用修改后的内容 |
| AC-10 | 管理员 | 对任意建议点击 [忽略] | 建议卡片从列表中平滑移除，不发送任何 API 请求 |
| AC-11 | 管理员 | 处理完部分建议后，点击列表顶部 [刷新] 按钮 | 重新请求 `POST /sidekick/suggestions`，基于当前实体状态生成新的建议列表 |
| AC-12 | 管理员 | 未配置 API Key 时打开 Sidekick | 仅展示规则建议，列表底部显示提示"配置 API Key 以获取更多 AI 建议" |
| AC-13 | 管理员 | 在不支持 Sidekick 的页面（如首页、搜索结果页） | ⚡ AI 按钮不显示（或灰色禁用） |
| AC-14 | 管理员 | 每条建议卡片 | 显示置信度指示器（🟢≥0.8 / 🟡0.5-0.8 / 🔴<0.5）、来源标签、AI 角标 ✦ |
| AC-15 | 管理员 | 建议卡片上的 [推理来源] 折叠区域 | 点击展开后显示推理依据详情（如"基于 completeness_check 规则：description 字段为空"） |
| AC-16 | 管理员 | 在 Sidekick 底部点击 [打开本体工坊] | 导航到 /workshop 页面 |
| AC-17 | 管理员 | 本体中无 OT/Property/LinkType（空本体） | Sidekick 显示空状态："本体为空，建议使用本体工坊开始构建"，带 [打开本体工坊] 按钮 |
| AC-18 | 管理员 | `POST /api/v1/sidekick/suggestions` 请求格式 | 请求体 `{ pageType, entityRid, ontologyRid }`；响应 `{ suggestions: [...], hasLlmSuggestions }` HTTP 200 |
| AC-19 | 管理员 | `POST /api/v1/sidekick/apply` 请求格式 | 请求体 `{ suggestionType, entityRid, actionPayload }`；成功 HTTP 200，失败返回对应错误码 |
| AC-20 | 管理员 | `POST /api/v1/sidekick/generate-content` 请求格式 | 请求体 `{ contentType, entityRid, context }`；响应 `{ content }` HTTP 200；无 API Key 返回 `SIDEKICK_LLM_UNAVAILABLE` HTTP 503 |

---

## 3. 边界情况

- 当 **本体为空**（无任何 OT/Property/LinkType）时，Sidekick 显示引导文案 + "打开本体工坊"按钮
- 当 **LLM API Key 未配置** 时，仅展示规则建议；LLM 相关的 generate-content 接口返回 503
- 当 **LLM 调用超时/失败** 时，仅展示规则建议，不阻塞整体体验；底部显示"AI 建议暂时不可用"
- 当 **用户正在 Workshop 中有 active AgentSession** 时，Sidekick 正常工作（无会话模式，不受 INV-12 影响）
- 当 **规则引擎未检测到任何问题** 且 **LLM 也无建议** 时，显示"本体状态良好，暂无改进建议" ✓
- 当 **实体正处于 WorkingState 草稿变更中** 时，规则引擎基于 merged view（草稿 + 已发布）分析
- 当 **Accept 操作因冲突失败**（如 apiName 重复）时，显示错误提示，建议卡片保留
- **不支持**：搜索结果页的 Sidekick（延后到 v0.3.0）
- **不支持**：建议历史持久化（无会话模式，不保存历史）
- **不支持**：批量 Accept 所有建议（每条逐个操作）

---

## 4. 架构决策

| ID | 决策 | 选项 | 结论 | 理由 |
|----|------|------|------|------|
| AD-01 | 会话模型 | A: 复用 AgentSession / B: 无会话模式 | 选 B | 避免 INV-12 冲突；Sidekick 是轻量即时查询，不需要对话持久化 |
| AD-02 | 建议引擎 | A: 纯 LLM / B: 纯规则 / C: 混合（规则+LLM） | 选 C | 规则建议瞬时零成本覆盖常见问题；LLM 按需提供语义级深度建议；无 API Key 时自动降级 |
| AD-03 | 前端集成位置 | A: 每个 Layout 分别集成 / B: AppShell 全局挂载 | 选 B | 一处集成覆盖所有页面；通过路由感知自动切换上下文 |
| AD-04 | 建议应用方式 | A: 走 Blueprint 流程 / B: 直接调用 v0.1.0 Service | 选 B | Sidekick 是单项即时编辑，不需要 Blueprint 批量审查流程；与 F017 先例一致 |
| AD-05 | LLM 调用方式 | A: deepagents Agent / B: 直接 Anthropic SDK 调用 | 选 B | Sidekick 不需要规划/多步编排能力，直接 API 调用更轻量快速 |
| AD-06 | 页面覆盖范围 | A: 全部 4 页面 / B: 3 核心页面（排除搜索结果页） | 选 B | 搜索结果页的 AI 建议价值有限，优先覆盖编辑页面 |

---

## 5. 数据库 & Domain 模型

### 数据库变更

**无新表**。F018 不引入新的持久化对象。所有建议是即时计算的临时数据。

### Pydantic Domain 模型（后端）

```python
# apps/server/app/domain/sidekick.py

class SidekickPageType(str, Enum):
    OBJECT_TYPE_DETAIL = "object_type_detail"
    PROPERTY_LIST = "property_list"
    LINK_TYPE_DETAIL = "link_type_detail"

class SuggestionType(str, Enum):
    MISSING_DESCRIPTION = "missing_description"
    MISSING_TITLE_KEY = "missing_title_key"
    MISSING_PRIMARY_KEY = "missing_primary_key"
    ORPHAN_LINK = "orphan_link"
    DUPLICATE_PROPERTY_NAME = "duplicate_property_name"
    SUGGEST_LINK = "suggest_link"
    CARDINALITY_REVIEW = "cardinality_review"
    NAMING_IMPROVEMENT = "naming_improvement"
    DESCRIPTION_ENHANCEMENT = "description_enhancement"

class SuggestionSource(str, Enum):
    COMPLETENESS_CHECK = "completeness_check"
    CONSISTENCY_CHECK = "consistency_check"
    PATTERN_MATCHING = "pattern_matching"
    SEMANTIC_INFERENCE = "semantic_inference"
    BEST_PRACTICES = "best_practices"

class SidekickContext(DomainModel):
    page_type: SidekickPageType
    entity_rid: str
    ontology_rid: str

class Suggestion(DomainModel):
    id: str                          # 临时 UUID，前端用于标识
    suggestion_type: SuggestionType
    title: str                       # 简短标题
    description: str                 # 详细说明
    confidence: float                # 0.0-1.0
    confidence_level: str            # high / medium / low
    source: SuggestionSource
    reasoning: str                   # 推理依据（展开后显示）
    action_payload: dict | None = None  # 可选：Apply 时需要的数据

class SuggestionsResponse(DomainModel):
    suggestions: list[Suggestion]
    has_llm_suggestions: bool        # 是否包含 LLM 建议（用于前端展示提示）

class SuggestionApplyRequest(DomainModel):
    suggestion_type: SuggestionType
    entity_rid: str
    action_payload: dict | None = None  # Accept 时 None；Edit 时含用户修改

class GenerateContentRequest(DomainModel):
    content_type: str                # "description" | "api_name_suggestion"
    entity_rid: str
    context: dict | None = None      # 实体上下文信息

class GenerateContentResponse(DomainModel):
    content: str
```

---

## 6. API 契约

### 端点列表

| Method | Path | 描述 |
|--------|------|------|
| POST | `/api/v1/sidekick/suggestions` | 获取当前页面上下文的建议列表 |
| POST | `/api/v1/sidekick/apply` | 应用一条建议（Accept 或 Edit 后确认） |
| POST | `/api/v1/sidekick/generate-content` | LLM 生成内容（如 OT 描述） |

### 请求/响应示例

```json
// POST /api/v1/sidekick/suggestions
// Request
{
  "pageType": "object_type_detail",
  "entityRid": "ri.ontology.object-type.abc123",
  "ontologyRid": "ri.ontology.main.default"
}

// Response 200
{
  "suggestions": [
    {
      "id": "tmp-uuid-1",
      "suggestionType": "missing_description",
      "title": "对象类型缺少描述",
      "description": "Customer 对象类型没有描述信息，添加描述可提高 Agent 理解准确度",
      "confidence": 1.0,
      "confidenceLevel": "high",
      "source": "completeness_check",
      "reasoning": "completeness_check 规则检测到 description 字段为空",
      "actionPayload": null
    },
    {
      "id": "tmp-uuid-2",
      "suggestionType": "suggest_link",
      "title": "建议添加链接到 Order",
      "description": "基于语义分析，Customer 与 Order 之间可能存在 1:N 关系",
      "confidence": 0.75,
      "confidenceLevel": "medium",
      "source": "semantic_inference",
      "reasoning": "Customer 和 Order 在业务领域中通常存在关联关系，建议添加链接类型",
      "actionPayload": {
        "targetObjectTypeRid": "ri.ontology.object-type.def456",
        "suggestedCardinality": "one-to-many"
      }
    }
  ],
  "hasLlmSuggestions": true
}
```

```json
// POST /api/v1/sidekick/apply
// Request — Accept missing_description
{
  "suggestionType": "missing_description",
  "entityRid": "ri.ontology.object-type.abc123",
  "actionPayload": null
}

// Response 200
{
  "success": true,
  "message": "描述已更新"
}

// Request — Edit 后 Apply（用户修改了 AI 生成的描述）
{
  "suggestionType": "missing_description",
  "entityRid": "ri.ontology.object-type.abc123",
  "actionPayload": {
    "description": "用户自定义的描述文本"
  }
}

// Response 200
{
  "success": true,
  "message": "描述已更新"
}
```

```json
// POST /api/v1/sidekick/generate-content
// Request
{
  "contentType": "description",
  "entityRid": "ri.ontology.object-type.abc123",
  "context": {
    "displayName": "Customer",
    "propertyNames": ["name", "email", "phone", "address"]
  }
}

// Response 200
{
  "content": "Customer 对象类型表示系统中的客户实体，包含客户的基本联系信息（姓名、邮箱、电话、地址），用于管理客户关系和订单关联。"
}

// Response 503 (无 API Key)
{
  "error": {
    "code": "SIDEKICK_LLM_UNAVAILABLE",
    "message": "LLM service is not configured. Set ANTHROPIC_API_KEY to enable AI suggestions."
  }
}
```

### 错误码表

| HTTP Status | Code | 场景 | 关联 AC |
|-------------|------|------|---------|
| 400 | `SIDEKICK_INVALID_CONTEXT` | pageType 不合法或 entityRid 不存在 | AC-18 |
| 404 | `ENTITY_NOT_FOUND` | entityRid 指向的实体不存在 | AC-19 |
| 409 | `OBJECT_TYPE_API_NAME_CONFLICT` | Apply 时 apiName 冲突（透传 v0.1.0 错误） | AC-07 |
| 503 | `SIDEKICK_LLM_UNAVAILABLE` | LLM API Key 未配置 | AC-12, AC-20 |
| 500 | `SIDEKICK_LLM_ERROR` | LLM 调用超时或异常 | AC-06 |

---

## 7. Service / Router 层逻辑

### SidekickService（`app/services/sidekick_service.py`）

核心编排服务，协调规则引擎和 LLM 引擎：

- **`get_suggestions(context)`**：
  1. 验证 context（pageType、entityRid 是否合法）
  2. 根据 pageType 获取实体数据（通过对应 Service 层的 get 方法）
  3. 调用 `SidekickRulesEngine.analyze()` 获取规则建议
  4. 如果 API Key 可用，调用 `SidekickLlmEngine.analyze()` 获取 LLM 建议
  5. 合并去重，按 confidence 降序排列
  6. 返回 `SuggestionsResponse`

- **`apply_suggestion(request)`**：
  1. 根据 `suggestion_type` 分发到对应的处理器
  2. 处理器调用 v0.1.0 Service 层执行实际操作（如 ObjectTypeService.update）
  3. 返回执行结果

- **`generate_content(request)`**：
  1. 检查 API Key 是否可用
  2. 构建 prompt（基于 content_type 和 context）
  3. 调用 LLM 生成内容
  4. 返回生成的内容

### SidekickRulesEngine（`app/services/sidekick_rules.py`）

基于 ValidationService 模式的规则检测引擎：

- **输入**：实体数据（OT/Property/LinkType 的完整信息，含 merged view）
- **规则集**：
  - `missing_description`：检查 description 字段为空
  - `missing_title_key`：检查 titleKeyPropertyId 为空（仅 OT 页面）
  - `missing_primary_key`：检查 primaryKeyPropertyId 为空（仅 OT 页面）
  - `orphan_link`：检查 LinkType 引用的 OT 是否存在
  - `duplicate_property_name`：检查同名属性跨 OT 重复
- **输出**：标准 `Suggestion` 列表，confidence=1.0（规则建议确定性高）

### SidekickLlmEngine（`app/services/sidekick_llm.py`）

轻量 LLM 调用引擎：

- **输入**：实体数据 + 本体元数据摘要
- **建议类型**：
  - `suggest_link`：分析 OT 语义，推荐可能的链接关系
  - `cardinality_review`：检查 LinkType 基数是否合理
  - `naming_improvement`：建议更好的 apiName/displayName
  - `description_enhancement`：建议改进已有描述
- **输出**：`Suggestion` 列表，confidence 由 LLM 自评（0.5-0.9）
- **依赖**：Anthropic SDK 直接调用，不走 deepagents
- **降级**：API Key 未配置时返回空列表，不报错

### SidekickRouter（`app/routers/sidekick.py`）

HTTP 层，委托给 SidekickService：

- 3 个 POST 端点，解析请求 → 调用 Service → 返回响应
- 使用 `get_async_session` 依赖注入数据库会话

---

## 8. Agent 集成设计

### LLM 调用（非 Agent）

F018 不使用 deepagents Agent，而是直接通过 Anthropic SDK 调用 LLM：

- **模型**：使用环境变量 `LLM_MODEL` 配置（默认 claude-sonnet-4-20250514）
- **Temperature**：0.3（建议需要一定创造性但不能太发散）
- **Max tokens**：1024（单条建议不需要长输出）
- **System prompt**：专用的 Sidekick 分析提示词，要求以 JSON 格式输出建议列表

### 无 Skill / SSE / HITL

- F018 不定义新 Skill（非 Agent 操作）
- 不使用 SSE 事件流（请求-响应模式）
- 不涉及 HITL 授权（Accept/Edit/Ignore 是前端操作，Apply 通过 v0.1.0 Service 执行）

---

## 9. 前端组件设计

### 组件结构

```
AppShell
├── TopBar
├── Outlet (页面内容)
├── CreateObjectTypeWizard
├── CreateLinkTypeWizard
└── SidekickDrawer                       # F018 新增
    ├── SidekickHeader                   # 标题 + 刷新按钮 + 关闭按钮
    ├── SuggestionList                   # 建议卡片列表
    │   ├── SuggestionCard               # 单条建议卡片
    │   │   ├── ConfidenceIndicator      # 置信度指示器（共享）
    │   │   ├── SourceTag                # 来源标签
    │   │   ├── ReasoningCollapse        # 折叠的推理详情
    │   │   └── SuggestionActions        # Accept / Edit / Ignore 按钮
    │   └── SuggestionInlineEditor       # Edit 模式的内联编辑区
    ├── LlmLoadingIndicator              # LLM 建议加载中指示
    ├── EmptyState                       # 空状态提示
    └── SidekickFooter                   # "打开本体工坊" + API Key 提示

SidekickTrigger (⚡ AI 按钮)              # F018 新增，在 TopBar 中
```

### Sidekick 上下文感知

通过 `useSidekickContext()` hook 基于当前路由自动推断上下文：

| 路由模式 | pageType | entityRid 来源 |
|----------|----------|---------------|
| `/ontology/object-types/:rid/*` | `object_type_detail` | URL 参数 `:rid` |
| `/ontology/object-types/:rid/properties` | `property_list` | URL 参数 `:rid`（所属 OT） |
| `/ontology/link-types/:rid` | `link_type_detail` | URL 参数 `:rid` |
| 其他路由 | `null` | 不可用 → ⚡ 按钮隐藏 |

### 状态管理

**Zustand Store**（`stores/sidekick-store.ts`）— 仅管理 UI 状态：

```typescript
interface SidekickStore {
  isOpen: boolean;
  editingSuggestionId: string | null;
  ignoredSuggestionIds: Set<string>;  // 前端过滤已忽略的建议
  toggle: () => void;
  open: () => void;
  close: () => void;
  setEditingSuggestionId: (id: string | null) => void;
  ignoreSuggestion: (id: string) => void;
  resetIgnored: () => void;           // 刷新时重置
}
```

**TanStack Query**（`api/sidekick.ts`）— 管理服务端数据：

- `useSidekickSuggestions(context)` — 建议列表查询
- `useApplySuggestion()` — 应用建议 mutation（onSuccess 刷新相关实体 cache）
- `useGenerateContent()` — 生成内容 mutation

### 路由

无新路由。Sidekick 是全局 Drawer 组件，不引入独立页面。

---

## 10. 文件清单

```
apps/server/
├── app/domain/sidekick.py                      # 新建 — Domain 模型
├── app/routers/sidekick.py                     # 新建 — HTTP 路由
├── app/services/sidekick_service.py            # 新建 — 编排服务
├── app/services/sidekick_rules.py              # 新建 — 规则引擎
├── app/services/sidekick_llm.py                # 新建 — LLM 引擎
├── app/main.py                                 # 修改 — 注册 sidekick router
├── tests/unit/test_sidekick_rules.py           # 新建
├── tests/unit/test_sidekick_service.py         # 新建
├── tests/integration/test_sidekick_api.py      # 新建
└── openapi.json                                # 重新生成

apps/web/
├── src/components/sidekick/                    # 新建目录
│   ├── SidekickTrigger.tsx                     # 新建 — ⚡ AI 按钮
│   ├── SidekickDrawer.tsx                      # 新建 — Drawer 容器
│   ├── SuggestionCard.tsx                      # 新建 — 建议卡片（共享版）
│   ├── SuggestionInlineEditor.tsx              # 新建 — 内联编辑区
│   ├── ConfidenceIndicator.tsx                 # 新建 — 置信度指示器（共享版）
│   └── __tests__/                              # 新建 — 组件测试
│       ├── SidekickDrawer.test.tsx
│       └── SuggestionCard.test.tsx
├── src/stores/sidekick-store.ts                # 新建 — Zustand store
├── src/stores/__tests__/sidekick-store.test.ts # 新建
├── src/api/sidekick.ts                         # 新建 — TanStack Query hooks
├── src/components/layout/AppShell.tsx          # 修改 — 添加 SidekickDrawer
├── src/components/layout/TopBar.tsx            # 修改 — 添加 SidekickTrigger
├── src/locales/zh.json                         # 修改 — 添加 sidekick.* 翻译
├── src/locales/en.json                         # 修改 — 添加 sidekick.* 翻译
└── src/generated/api.ts                        # 重新生成
```

---

## 非功能要求

- **性能**：
  - 规则建议响应时间 < 200ms（纯后端计算，无外部调用）
  - LLM 建议响应时间 < 5s（受 LLM API 延迟影响）
  - Apply 操作响应时间 < 500ms（复用 v0.1.0 Service）

- **安全**：
  - API Key 通过环境变量注入，不在 API 请求/响应中暴露
  - Sidekick 请求需要有效的 entityRid 和 ontologyRid，防止枚举攻击

- **可用性**：
  - 建议卡片移除使用过渡动画（Ant Design Collapse/Fade）
  - LLM 建议加载中显示 Skeleton 占位
  - 错误状态提供可操作的提示（如"重试"按钮）

- **i18n**：
  - 所有用户可见文本使用 `t('sidekick.*')` 键
  - 建议标题和描述由后端返回（后端根据请求的 Accept-Language 或固定中文输出）

---

## 依赖与约束

- **依赖特性**：F012-agent-foundation（Agent Engine 基础设施，虽然 F018 不直接使用 Agent，但复用其 LLM 配置和环境变量体系）
- **领域对象权限**：F018 不拥有任何领域对象的写入权限，仅通过调用 v0.1.0 Service 层进行操作（与 F017 先例一致）
- **不变量遵循**：INV-16（建议携带置信度和来源标签）
- **版本契约**：[features/v0.2.0/release-contract.md]
