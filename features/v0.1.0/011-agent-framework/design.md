# Open Ontology Agent Framework — 完整技术方案（修订版）

## Context

基于 Claude、Gemini、OpenAI 三位 AI 对 Ontology Agent Framework 的独立调研方案，综合取长补短，并结合对现有代码库的深度审查，设计统一的优化方案。目标是将本体从静态知识库升级为"可对话、可推理、可追溯"的智能系统。

**修订说明**：本版本基于对 `apps/server/` 和 `apps/web/src/` 的完整代码审查，修正了原方案中与实际代码库不一致的部分，补充了缺失的技术细节。

---

## 一、产品交互体验

### 1.1 布局：自适应三面板

```
┌──────────────────────────────────────────────────────────────┐
│                    顶部导航栏（复用现有 AppShell）             │
├───────────────┬─────────────────────────┬────────────────────┤
│  对话面板 30%  │   知识图谱画布 45%       │  实体详情面板 25%  │
│               │                         │                    │
│  · 聊天消息流  │  · React Flow 力导向     │  · 三层渐进披露    │
│  · 实体锚点    │  · 自定义节点/边样式     │  · 属性/关系/溯源  │
│  · 建议操作    │  · 推理轨迹动画          │  · 导航面包屑栈    │
│  · 嵌入迷你图  │  · 双向高亮联动          │                    │
├───────────────┴─────────────────────────┴────────────────────┤
│  证据/溯源折叠面板（按需展开，底部 30%）                       │
└──────────────────────────────────────────────────────────────┘
```

- 面板可拖拽调整：`react-resizable-panels`（新增依赖）
- 图谱渲染：**React Flow**（`@xyflow/react` 已在 `package.json` 中，零新增依赖；MVP 够用，V1 如性能不足再迁移 AntV G6）
- 实体详情：Ant Design `Drawer`
- Agent 页面采用**独立全屏布局**（不嵌入 `HomeLayout` 侧边栏），类似 `/demo/canvas` 的独立路由

### 1.2 三层渐进式实体探索（← Claude 方案精华）

| 层级 | 触发 | 组件 | 内容 | 尺寸 |
|------|------|------|------|------|
| Tier 1 悬停预览 | 鼠标悬停 200ms | `Popover` | 名称+类型徽标+一行描述 | 280-320px |
| Tier 2 侧面板 | 单击实体 | `Drawer` | 完整属性、关系分组、溯源、面包屑 | 400-480px |
| Tier 3 全屏 | "展开详情" | 跳转现有 ObjectType Detail 页 | 完整编辑、关系图、审计 | 全屏路由 |

### 1.3 对话 ↔ 图谱联动

- **双向实体高亮**（← Claude）：对话悬停实体 → 图节点发光；图悬停节点 → 对话文本高亮。通过 Zustand store 共享（见 §4.4 Store 设计）
- **推理轨迹可视化**（← Gemini）：Agent 多跳推理时图谱节点依次点亮，展示探索路径（V1）
- **图操作驱动对话**（← Gemini A2UI 简化）：右键节点 → 上下文菜单"查看详情/解释关系"（MVP 先实现单节点操作，V1 再做框选多节点）

### 1.4 Entity-Linked Citation（← Claude 方案精华）

- `[E1]` 实体引用 | `[R1]` 关系引用 | `[I1]` 推理引用
- 上标可点击，悬停预览，点击打开 Tier 2 面板
- 区别于 URL 引用，本体原生溯源

### 1.5 置信度 + 证据展示

- **三色置信度**（← Claude + OpenAI）：绿色 直接事实 | 黄色 多跳推理 | 红色 需专家确认
- **事实验证管线**（← Gemini）：回答 → 原子声明 → 本体三元组映射 → 路径验证（V1）
- **证据折叠面板**（← OpenAI）：推理路径 + 数据来源 + 数据新鲜度（MVP 先做推理步骤展示，V1 补完整证据链）

---

## 二、技术架构

### 2.1 Agent 编排：LangGraph + PydanticAI

```
用户消息 → LangGraph StatefulGraph
  ├── classify（查询分类）
  │   ├── entity_lookup → 实体查找工具（PydanticAI）
  │   ├── relationship → 关系遍历工具（PydanticAI）
  │   ├── aggregation → 聚合查询工具（PydanticAI）
  │   ├── hybrid → 混合检索工具（PydanticAI）
  │   └── action → 动作执行（需人工确认，V2）
  └── synthesize（结构化输出 + 实体标注）
```

Agent 状态模型：
```python
class OntologyAgentState(TypedDict):
    messages: list                    # 对话历史
    ontology_context: str             # 缓存 schema 上下文（见 §2.6）
    query_results: list               # 原始查询结果
    referenced_entities: list         # 引用的实体
    reasoning_steps: list[str]        # 可解释推理链（← Claude）
    subgraph: dict | None             # 子图（可视化用）
    todos: list[str]                  # 任务规划（← Gemini DeepAgent）
```

### 2.2 检索策略（分阶段）

**MVP — 两路检索**：
```
用户查询 ──┬─→ [路径1] 本体图查询（PG + SQLAlchemy async + 递归 CTE）
           └─→ [路径2] PG 全文索引（tsvector，复用现有 search_vector 基础设施）
                       │
                       └─→ 结果融合 → 统一上下文
```

**V1 — 三路并行混合检索**（新增 pgvector）：
```
用户查询 ──┬─→ [路径1] 本体图查询（递归 CTE）
           ├─→ [路径2] 向量语义搜索（pgvector 扩展）  ← V1 新增
           └─→ [路径3] PG 全文索引（tsvector）
                       │
                       └─→ RRF 结果融合重排 → 统一上下文
```

关键决策：
- 不引入 Neo4j，PostgreSQL 递归 CTE + JSONB 处理图查询
- **MVP 不引入 pgvector**：两路检索（tsvector + CTE）已覆盖大部分场景，降低部署复杂度
- **V1 引入 pgvector**：配合 embedding 模型选择一起决策
- 全文搜索复用现有基础设施：`object_types.search_vector`（tsvector）和 `search_storage.py` 已有实现

### 2.3 结构化输出（← Claude 方案精华）

**Instructor + Pydantic** 两阶段：阶段1 Agent 自由推理，阶段2 Instructor 提取实体标注

```python
# 继承现有 DomainModel 基类（apps/server/app/domain/common.py）
# 自动获得 alias_generator=to_camel, populate_by_name=True

class EntityReference(DomainModel):
    entity_id: str          # RID（格式：ri.ontology.<type>.<12hex>）
    entity_label: str
    entity_type: EntityType # object_type | property | link_type
    confidence: float       # 0-1
    span_start: int | None  # 文本字符偏移
    span_end: int | None

class AgentResponse(DomainModel):
    answer_text: str
    referenced_entities: list[EntityReference]
    evidence_subgraph: dict | None
    reasoning_steps: list[str]
    confidence: float
```

> 注意：继承 `DomainModel` 而非重复声明 `ConfigDict`，与项目现有模式一致。

### 2.4 流式传输：SSE

**API 端点设计**：
```
POST /api/v1/agent/chat           → text/event-stream（SSE 流式对话）
  Body: { sessionRid?: string, message: string, ontologyRid: string }

GET  /api/v1/agent/sessions       → 会话列表
GET  /api/v1/agent/sessions/{rid} → 会话详情（含消息历史）
DELETE /api/v1/agent/sessions/{rid} → 删除会话
```

**SSE 事件类型**：
```
event: text-delta        # 文本增量（data: { text: "..." }）
event: entity-ref        # 实体引用标注（data: { entityId, label, type, spanStart, spanEnd }）
event: subgraph          # 子图数据（data: { nodes: [...], edges: [...] }）
event: reasoning-step    # 推理步骤（data: { step: "...", index: N }）
event: done              # 流结束（data: { confidence, sessionRid }）
event: error             # 错误（data: { code, message }）
```

**实现方案**：
- 后端：FastAPI `StreamingResponse`（`media_type="text/event-stream"`），无需额外 SSE 库
- 前端：自定义 hook `useAgentChat()` 基于 `fetch` + `ReadableStream` + `useReducer`
  - 流式数据**不**走 TanStack Query（不适合长连接）
  - 会话列表/历史走 TanStack Query（标准 REST）

### 2.5 安全分层

| 层 | 防护 | 阶段 |
|----|------|------|
| L1 输入检验 | 长度限制（4096 字符）、prompt 注入检测 | MVP |
| L2 权限关卡 | 实体级权限验证 | V1 |
| L3 Agent 约束 | 工具白名单，禁止直接 SQL，语义层隔离 | MVP |
| L4 输出过滤 | 敏感字段脱敏、PII 检测 | V1 |
| L5 审计日志 | 完整对话链路日志 | MVP |

### 2.6 本体上下文构建策略

Agent 需要理解当前本体的 schema 才能准确回答。关键设计：

**Schema 序列化**：将 ontology 的 object types + properties + link types 序列化为结构化文本（类似 SQL DDL），作为 system prompt 的一部分。

```
Ontology: <ontology_name>
Object Types:
  - Employee (ri.ontology.object-type.abc123)
    Properties: name (string), age (integer), department (string)
    Links: reports_to → Manager (many-to-one)
  - Manager (ri.ontology.object-type.def456)
    Properties: name (string), level (integer)
    ...
```

**Token 预算管理**：
- 小型本体（< 50 object types）：完整 schema 内联
- 大型本体：按相关性截断，优先包含用户查询涉及的 object types 及其 1-hop 关联
- schema 在会话级别缓存（`OntologyAgentState.ontology_context`），ontology 变更时失效

**数据来源**：复用现有 `ObjectTypeStorage.list_by_ontology()` + `PropertyStorage` + `LinkTypeStorage`

### 2.7 LLM 模型配置

MVP 即支持 Anthropic 和 OpenAI 两个提供商，通过配置切换：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `LLM_PROVIDER` | `anthropic` | 提供商：`anthropic` / `openai` |
| `ANTHROPIC_API_KEY` | 环境变量 | Anthropic API 密钥 |
| `OPENAI_API_KEY` | 环境变量 | OpenAI API 密钥（可选） |
| `LLM_MODEL` | `claude-sonnet-4-20250514` | 模型 ID（按提供商不同填对应模型名） |
| `LLM_MAX_TOKENS` | `4096` | 最大输出 token |
| `LLM_TEMPERATURE` | `0.3` | 温度（低温提高准确性） |

通过 `app/config.py` 的 `Settings` 类管理（pydantic-settings），与现有配置模式一致。
实现层封装统一的 `LLMClient` 接口，屏蔽提供商差异。V2 再做运行时动态路由。

---

## 三、各方案精华采纳总览

### Claude 方案（✅ 完整采纳 6 项）

| 创新 | 采纳 |
|------|------|
| OAG（本体增强生成）理念 | ✅ 核心架构原则 |
| 三层渐进式实体探索 | ✅ 适配 Ant Design |
| 双向实体高亮 | ✅ Zustand 共享状态 |
| Entity-Linked Citation | ✅ [E1]/[R1]/[I1] |
| 嵌入式迷你图 | ✅ 360x220px |
| Instructor + Pydantic 结构化输出 | ✅ 两阶段方案 |

### Gemini 方案（✅ 完整采纳 3 项 + 简化/延后 4 项）

| 创新 | 采纳 |
|------|------|
| 语义层隔离（NL→本体安全调用） | ✅ 消除 SQL 幻觉 |
| 推理轨迹实时可视化 | ✅ 图谱节点动画 |
| 本体原语完整性（6 大原语） | ✅ 与现有领域模型对齐 |
| DeepAgent 任务规划 | 📋 简化为 LangGraph todos 字段 |
| A2UI 协议 | 📋 简化为 SSE 事件类型 |
| 事实验证管线 | 📅 V1 引入 |
| ReBAC 权限 | 📅 V2 引入 |

### OpenAI 方案（✅ 完整采纳 3 项 + 分阶段 3 项）

| 创新 | 采纳 |
|------|------|
| 三路并行混合检索 + RRF 融合 | ✅ 最全面检索策略 |
| OWASP LLM 风险防范清单 | ✅ 安全审查 checklist |
| 置信度多因素计算 | ✅ LLM概率+检索得分+验证结果 |
| 5 层安全防护 | 📅 MVP 实现 L1/L3/L5，V1 补齐 |
| Graphiti 知识图记忆 | 📅 V1 引入 |
| 细粒度 ACL | 📅 V2 引入 |

---

## 四、与现有代码库集成

### 4.1 新增文件

**后端**：

| 文件 | 职责 |
|------|------|
| `app/routers/agent.py` | Agent REST + SSE 端点 |
| `app/services/agent_service.py` | LangGraph 编排 + 工具调用 |
| `app/services/retrieval_service.py` | 本体检索（CTE + tsvector 融合） |
| `app/services/schema_service.py` | 本体 schema 序列化（上下文构建） |
| `app/domain/agent.py` | Agent Pydantic 模型（继承 DomainModel） |
| `app/storage/agent_storage.py` | 会话/消息/审计日志的 CRUD |
| `alembic/versions/0010_agent_tables.py` | 会话 + 消息 + 审计日志表迁移 |

**前端**：

| 文件 | 职责 |
|------|------|
| `pages/agent/AgentPage.tsx` | 三面板主页面（独立布局） |
| `components/agent/ChatPanel.tsx` | 对话面板（消息流 + 输入框） |
| `components/agent/ChatMessage.tsx` | 单条消息（含实体锚点渲染） |
| `components/agent/GraphPanel.tsx` | React Flow 图谱画布 |
| `components/agent/EntityDrawer.tsx` | Tier 2 实体侧面板 |
| `components/agent/EntityPopover.tsx` | Tier 1 悬停预览 |
| `components/agent/ReasoningSteps.tsx` | 推理步骤折叠展示 |
| `stores/agent-panel-store.ts` | 面板尺寸/折叠状态 |
| `stores/entity-highlight-store.ts` | 双向高亮共享状态 |
| `api/agent.ts` | TanStack Query hooks（会话 CRUD） |
| `api/use-agent-chat.ts` | 自定义 SSE 流式 hook |

### 4.2 需修改的现有文件

| 文件 | 修改内容 |
|------|----------|
| `apps/server/app/main.py` | 注册 `agent.router` |
| `apps/web/src/router.tsx` | 添加 `/agent` 路由（AppShell 下独立布局） |
| `apps/web/src/locales/en-US/common.json` | 新增 `agent.*` i18n key |
| `apps/web/src/locales/zh-CN/common.json` | 新增 `agent.*` i18n key |
| `apps/web/src/components/layout/TopBar.tsx` | 添加 Agent 导航入口 |
| `apps/server/app/config.py` | 新增 LLM 配置项 |
| `apps/server/openapi.json` | 自动重新生成 |

### 4.3 数据库设计

**agent_sessions 表**：
```sql
CREATE TABLE agent_sessions (
    rid          TEXT PRIMARY KEY,  -- ri.ontology.agent-session.<12hex>
    ontology_rid TEXT NOT NULL REFERENCES ontologies(rid),
    title        TEXT,              -- 会话标题（LLM 自动生成或用户编辑）
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**agent_messages 表**：
```sql
CREATE TABLE agent_messages (
    rid          TEXT PRIMARY KEY,  -- ri.ontology.agent-message.<12hex>
    session_rid  TEXT NOT NULL REFERENCES agent_sessions(rid) ON DELETE CASCADE,
    role         TEXT NOT NULL,     -- 'user' | 'assistant' | 'system'
    content      TEXT NOT NULL,
    metadata     JSONB,            -- { referencedEntities, reasoningSteps, confidence, subgraph }
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_messages_session ON agent_messages(session_rid, created_at);
```

**agent_audit_logs 表**：
```sql
CREATE TABLE agent_audit_logs (
    rid            TEXT PRIMARY KEY,  -- ri.ontology.agent-audit.<12hex>
    session_rid    TEXT REFERENCES agent_sessions(rid) ON DELETE SET NULL,
    action_type    TEXT NOT NULL,     -- 'query' | 'tool_call' | 'llm_request' | 'response'
    tool_name      TEXT,              -- 工具名（entity_lookup, relationship_traverse 等）
    input_summary  TEXT,              -- 输入摘要（脱敏后）
    output_summary TEXT,              -- 输出摘要
    latency_ms     INTEGER,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_audit_session ON agent_audit_logs(session_rid, created_at);
```

> RID 格式遵循现有 `generate_rid()` 规范：`ri.ontology.<type>.<uuid4.hex[:12]>`

### 4.4 前端 Store 设计

按照项目 kebab-case 命名规范，拆分为单一职责 store：

**`agent-panel-store.ts`** — 面板 UI 状态（纯 UI，不含服务端数据）：
```typescript
interface AgentPanelState {
  chatPanelWidth: number;      // 默认 30%
  graphPanelWidth: number;     // 默认 45%
  detailPanelWidth: number;    // 默认 25%
  isDetailOpen: boolean;
  isReasoningExpanded: boolean;
}
```

**`entity-highlight-store.ts`** — 双向高亮共享状态：
```typescript
interface EntityHighlightState {
  hoveredEntityId: string | null;     // 当前悬停的实体 RID
  selectedEntityId: string | null;    // 当前选中的实体 RID（打开 Drawer）
  highlightSource: 'chat' | 'graph' | null;  // 高亮来源
}
```

### 4.5 错误码表

| 错误码 | HTTP | 说明 |
|--------|------|------|
| `AGENT_SESSION_NOT_FOUND` | 404 | 会话不存在 |
| `AGENT_LLM_UNAVAILABLE` | 503 | LLM 服务不可用 |
| `AGENT_INPUT_TOO_LONG` | 400 | 输入超长（> 4096 字符） |
| `AGENT_PROMPT_INJECTION` | 400 | 检测到 prompt 注入 |
| `AGENT_TOOL_EXECUTION_FAILED` | 500 | 工具执行失败 |
| `AGENT_RATE_LIMITED` | 429 | 速率限制 |
| `AGENT_ONTOLOGY_NOT_FOUND` | 404 | 关联本体不存在 |

与现有 `AppError` + `app_error_handler` 模式一致。

### 4.6 严格遵守的约束

- 后端分层：routers → services → domain/storage（禁止反向导入）
- Domain 模型继承 `DomainModel`（自动 camelCase 序列化）
- 数据库：rid 主键 `ri.ontology.<type>.<12hex>`，Alembic 迁移
- 类型管道：openapi.json → openapi-typescript → generated/api.ts
- 前端状态：服务端数据 → TanStack Query，UI 状态 → Zustand
- i18n：所有用户可见字符串用 `t('agent.xxx')`
- 异步 SQLAlchemy：async session + asyncpg

---

## 五、新增依赖清单

### 后端（`apps/server/pyproject.toml`）

| 包 | 版本 | 用途 | 阶段 |
|----|------|------|------|
| `langgraph` | `>=0.2` | Agent 状态图编排 | MVP |
| `pydantic-ai` | `>=0.1` | Agent 工具定义 | MVP |
| `instructor` | `>=1.0` | 结构化 LLM 输出提取 | MVP |
| `anthropic` | `>=0.40` | Claude API SDK | MVP |
| `openai` | `>=1.50` | OpenAI API SDK | MVP |
| `tiktoken` | `>=0.7` | Token 计数（上下文管理） | MVP |
| `pgvector` | `>=0.3` | 向量搜索 SQLAlchemy 集成 | V1 |

### 前端（`apps/web/package.json`）

| 包 | 用途 | 阶段 |
|----|------|------|
| `react-resizable-panels` | 三面板拖拽调整 | MVP |

> `@xyflow/react`（React Flow）已在依赖中，无需新增。

---

## 六、分阶段路线

### MVP（8 周）— "会说话的本体"

| 周 | 任务 | 产出 |
|----|------|------|
| W1 | 环境搭建 + Alembic 迁移 + Agent domain 模型 + config | 数据库表 + Pydantic 模型 |
| W2 | LangGraph 状态图 + 基础工具（实体查找）+ SSE 端点骨架 | POST /agent/chat 可返回流式文本 |
| W3 | Instructor 结构化输出 + 更多工具（关系遍历、schema 查询） + openapi 管道 | 实体标注 + 类型生成 |
| W4 | 前端对话面板：Ant Design 对话 UI + SSE 流式渲染 | 可对话的基础 UI |
| W5 | 实体锚点渲染 + Tier 1 悬停预览 + Tier 2 Drawer 侧面板 | 可点击的实体引用 |
| W6 | React Flow 图谱画布 + 双向高亮联动 | 知识图谱可视化 |
| W7 | 安全层 L1/L3/L5：输入检验 + 工具白名单 + 审计日志 | 基础安全防护 |
| W8 | 集成测试 + 打磨 + 文档 | 可发布状态 |

### V1（8-10 周）— "可信赖的智能助手"

- 混合检索三路并行（新增 pgvector 语义搜索 + RRF 融合）
- Entity-Linked Citation（`[E1]`/`[R1]`/`[I1]` 引用标记）
- 事实验证管线
- 嵌入式迷你图（360x220px React Flow 嵌入对话）
- 推理轨迹动画（图谱节点依次点亮）
- Graphiti 知识图记忆
- 权限 L2/L4
- LangSmith 可观测性

### V2（10-12 周）— "自主操作的本体代理"

- 动作执行（人工审批流）
- 多代理协作
- ReBAC 权限
- A2UI 完整实现
- 图谱交互操作（框选 + 右键菜单驱动对话）
- 多模型路由

---

## 七、决策记录（已确认）

| # | 决策 | 结论 | 说明 |
|---|------|------|------|
| D1 | LLM 模型 | **MVP 即支持多模型** | 通过 config 切换 Anthropic/OpenAI，需同时引入两个 SDK |
| D2 | 图谱渲染库 | **React Flow** | 已有依赖，零新增。V1 如性能不足再迁移 G6 |
| D3 | 页面布局 | **独立全屏** | AppShell 下独立路由，不嵌入 HomeLayout |
| D4 | 会话标题 | **LLM 自动生成** | 第一轮对话后异步生成标题，额外一次 API 调用 |
| D5 | SSE 实现 | **FastAPI 原生** | `StreamingResponse` + async generator，零新增依赖 |

---

## 八、验证方式

1. **后端单元测试**：`cd apps/server && PYTHONPATH=. uv run pytest tests/unit/ -v` 覆盖 Agent 服务 + 检索逻辑
2. **后端集成测试**：`cd apps/server && PYTHONPATH=. uv run pytest tests/integration/ -v` 覆盖 Agent 路由端点
3. **前端测试**：`cd apps/web && pnpm test --run` 覆盖对话面板 + 实体探索 + 图谱联动
4. **端到端手动验证**：
   - 启动后端+前端
   - 访问 `/agent` 页面
   - 输入自然语言查询（如"有哪些对象类型？"）
   - 验证：流式文本渲染 → 实体锚点可点击 → 图谱节点显示 → Drawer 面板弹出
5. **SSE 流式验证**：浏览器 DevTools Network → EventStream 面板查看事件序列完整性
