# Ontology-Aware AI Agent Framework — 研究与设计文档

> **状态**: 综合方案（修订版）
> **基于**: Claude / Gemini / OpenAI 三方独立调研 + 代码库审查
> **日期**: 2026-03-18
> **前置阅读**: `docs/architecture/03-agent-context-architecture.md`

## 文档索引

| 文档 | 说明 |
|------|------|
| **本文** | 综合技术方案（最终结论），整合三方调研精华 + 代码库审查修正 |
| `research_by_claude.md` | Claude 独立调研 |
| `research_by_gemini.md` | Gemini 独立调研 |
| `research_by_openai.md` | OpenAI 独立调研 |

---

## 一、调研背景与目标

### 1.1 为何构建 Agent 应用层

Open Ontology 的核心定位是"为 Agent 时代设计的 Ontology"。现有 `03-agent-context-architecture.md` 定义了 **Ontology 如何向 Agent 提供上下文**（MCP Server、Schema-as-Context、Ontology Filesystem 三接口策略），但尚未回答另一个关键问题：

> **如何在 Ontology Manager 之上构建一个原生的 AI Agent 应用，让用户通过自然语言与 Ontology 交互，并以可视化方式呈现结构化结果？**

本文档设计一个 **Ontology-Aware AI Agent Framework**，目标是：

1. **对话式 Ontology 探索** — 用户用自然语言提问，Agent 基于 Ontology Schema 进行推理和导航
2. **结构化响应** — Agent 返回的不仅是文本，还包含实体引用、关系描述、证据来源
3. **本体可视化** — 对话中提及的 Object Types、Link Types 实时呈现为可交互的卡片和关系图
4. **与现有系统深度集成** — 复用现有 Services、链接到详情页、连接 3D 星空 Demo

### 1.2 与现有架构文档的关系

| 文档 | 关注点 | 本文补充 |
|------|--------|---------|
| `03-agent-context-architecture.md` | Ontology 如何暴露给**外部** Agent（MCP/Filesystem/Schema 注入） | Ontology Manager **内置** Agent 的完整实现方案 |
| `01-system-architecture.md` | 系统分层（Consumption → Service → Domain → Storage） | 新增 Agent Application 层在 Consumption Layer 之上 |
| `04-tech-stack-recommendations.md` | MVP 技术选型 | Agent 层新增依赖（LangGraph、SSE、ReactFlow） |

本文档与 `03` 是**互补关系**：`03` 定义了"Ontology 作为 Agent 的语义基础设施"的接口规范，本文档定义了"使用这些接口构建内置 Agent 应用"的完整架构。

---

## 二、产品交互体验

> 来源：修订版 §一，综合 Claude / Gemini / OpenAI 三方案精华

### 2.1 布局：自适应三面板

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

### 2.2 三层渐进式实体探索（← Claude 方案精华）

| 层级 | 触发 | 组件 | 内容 | 尺寸 |
|------|------|------|------|------|
| Tier 1 悬停预览 | 鼠标悬停 200ms | `Popover` | 名称+类型徽标+一行描述 | 280-320px |
| Tier 2 侧面板 | 单击实体 | `Drawer` | 完整属性、关系分组、溯源、面包屑 | 400-480px |
| Tier 3 全屏 | "展开详情" | 跳转现有 ObjectType Detail 页 | 完整编辑、关系图、审计 | 全屏路由 |

### 2.3 对话 ↔ 图谱联动

- **双向实体高亮**（← Claude）：对话悬停实体 → 图节点发光；图悬停节点 → 对话文本高亮。通过 Zustand store 共享（见 §9.4 Store 设计）
- **推理轨迹可视化**（← Gemini）：Agent 多跳推理时图谱节点依次点亮，展示探索路径（V1）
- **图操作驱动对话**（← Gemini A2UI 简化）：右键节点 → 上下文菜单"查看详情/解释关系"（MVP 先实现单节点操作，V1 再做框选多节点）

### 2.4 Entity-Linked Citation（← Claude 方案精华）

- `[E1]` 实体引用 | `[R1]` 关系引用 | `[I1]` 推理引用
- 上标可点击，悬停预览，点击打开 Tier 2 面板
- 区别于 URL 引用，本体原生溯源

### 2.5 置信度 + 证据展示

- **三色置信度**（← Claude + OpenAI）：绿色 直接事实 | 黄色 多跳推理 | 红色 需专家确认
- **事实验证管线**（← Gemini）：回答 → 原子声明 → 本体三元组映射 → 路径验证（V1）
- **证据折叠面板**（← OpenAI）：推理路径 + 数据来源 + 数据新鲜度（MVP 先做推理步骤展示，V1 补完整证据链）

---

## 三、技术架构

> 来源：修订版 §二，基于代码库审查修正

### 3.1 Agent 编排：LangGraph + PydanticAI

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
    ontology_context: str             # 缓存 schema 上下文（见 §3.6）
    query_results: list               # 原始查询结果
    referenced_entities: list         # 引用的实体
    reasoning_steps: list[str]        # 可解释推理链（← Claude）
    subgraph: dict | None             # 子图（可视化用）
    todos: list[str]                  # 任务规划（← Gemini DeepAgent）
```

### 3.2 检索策略（分阶段）

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

### 3.3 结构化输出（← Claude 方案精华）

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

### 3.4 流式传输：SSE

**API 端点设计**：
```
POST /api/v1/agent/chat           → text/event-stream（SSE 流式对话）
  Body: { sessionRid?: string, message: string, ontologyRid: string }

GET  /api/v1/agent/sessions       → 会话列表
GET  /api/v1/agent/sessions/{rid} → 会话详情（含消息历史）
DELETE /api/v1/agent/sessions/{rid} → 删除会话
```

**SSE 事件类型**（kebab-case 命名）：
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

### 3.5 安全分层

| 层 | 防护 | 阶段 |
|----|------|------|
| L1 输入检验 | 长度限制（4096 字符）、prompt 注入检测 | MVP |
| L2 权限关卡 | 实体级权限验证 | V1 |
| L3 Agent 约束 | 工具白名单，禁止直接 SQL，语义层隔离 | MVP |
| L4 输出过滤 | 敏感字段脱敏、PII 检测 | V1 |
| L5 审计日志 | 完整对话链路日志 | MVP |

### 3.6 本体上下文构建策略

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

### 3.7 LLM 模型配置

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

## 四、系统架构总览

> 来源：原 README §2-§3，修订版中未覆盖的架构视图

### 4.1 四层架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                   Agent Application Layer                            │
│                      （Agent 应用层）                                 │
│                                                                      │
│  ┌─────────────────────────────┐  ┌───────────────────────────────┐  │
│  │      ChatPanel              │  │   OntologyContextPanel        │  │
│  │  (对话界面 + 流式渲染)      │  │  (实体卡片 + 关系图 +         │  │
│  │                             │  │   证据追踪)                   │  │
│  └──────────────┬──────────────┘  └───────────────┬───────────────┘  │
│                 │         SSE Stream              │                  │
└─────────────────┼─────────────────────────────────┼──────────────────┘
                  │                                 │
┌─────────────────┼─────────────────────────────────┼──────────────────┐
│                 ▼     Agent Backend Layer          ▼                  │
│                      （Agent 后端层）                                 │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                   LangGraph State Graph                       │    │
│  │                                                              │    │
│  │  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌────────┐ │    │
│  │  │  load    │───▶│  agent   │───▶│  tools   │───▶│assemble│ │    │
│  │  │ context  │    │ (LLM)   │◀───│ (execute) │    │response│ │    │
│  │  └──────────┘    └──────────┘    └──────────┘    └────────┘ │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│  ┌──────────────┐  ┌────────┴────────┐  ┌────────────────────────┐  │
│  │  OAG         │  │ Conversation    │  │  Multi-Provider LLM    │  │
│  │ (Schema-as-  │  │ Manager         │  │  Adapter               │  │
│  │  Context)    │  │ (会话历史管理)   │  │  (Claude/GPT/...)      │  │
│  └──────────────┘  └─────────────────┘  └────────────────────────┘  │
│                              │                                       │
└──────────────────────────────┼───────────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────────┐
│                              ▼                                       │
│                  Ontology Manager Layer                               │
│                  （本体管理层 — 现有系统）                             │
│                                                                      │
│  ┌────────────┐ ┌────────────┐ ┌──────────┐ ┌────────────────────┐  │
│  │ObjectType  │ │ LinkType   │ │ Property │ │  Search            │  │
│  │Service     │ │ Service    │ │ Service  │ │  Service           │  │
│  └────────────┘ └────────────┘ └──────────┘ └────────────────────┘  │
│  ┌────────────┐ ┌────────────┐ ┌──────────────────────────────────┐ │
│  │WorkingState│ │ Dataset    │ │  FileImport / MySQLImport        │ │
│  │Service     │ │ Service    │ │  Service                         │ │
│  └────────────┘ └────────────┘ └──────────────────────────────────┘ │
│                              │                                       │
└──────────────────────────────┼───────────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────────┐
│                              ▼                                       │
│                     Data Layer                                       │
│              (PostgreSQL + PG Full-Text Search)                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.2 核心设计原则

1. **Agent 是 Service 的消费者，不是替代者** — Agent 通过包装现有 Service 获取能力，不绕过 Domain 层
2. **结构化优于纯文本** — Agent 返回的每一段文本都可以关联到 Ontology 实体
3. **流式优先** — SSE 流式输出，前端实时渲染文本 + 本体注解
4. **渐进式复杂度** — 从纯文本聊天开始，逐步增加实体引用、关系图、交互式导航

### 4.3 核心数据流

```
User Query                  "哪些对象类型之间有订单关系？"
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  1. Context Loading (load_context node)              │
│     - 读取对话历史                                    │
│     - 生成 OAG (Schema-as-Context)                   │
│       · L0: "本体包含 5 个对象类型、3 个链接类型"     │
│       · L1: Object Types 列表 + Link Types 列表      │
│     - 注入 system prompt                             │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  2. LLM Reasoning (agent node)                       │
│     - 分析用户意图                                    │
│     - 决定是否需要调用 Tools                          │
│     - 如需要 → 生成 tool_calls                       │
│     - 如不需要 → 直接生成回答                         │
└──────────────────────┬──────────────────────────────┘
                       │
              ┌────────┴────────┐
              │  需要 Tools?     │
              └────────┬────────┘
              Yes      │       No
              ▼        │        ▼
┌─────────────────┐    │   ┌──────────────────────┐
│  3. Tool Exec   │    │   │  跳到步骤 4           │
│  (tools node)   │    │   └──────────────────────┘
│                 │    │
│  调用:          │    │
│  - search_      │    │
│    ontology()   │    │
│  - get_object_  │    │
│    type()       │    │
│  - list_link_   │    │
│    types()      │    │
│  - ...          │    │
│                 │    │
│  返回结构化结果 │    │
└────────┬────────┘    │
         │             │
         ▼             │
┌─────────────────────────────────────────────────────┐
│  4. Response Assembly (assemble node)                │
│     - 文本流式输出 (text-delta events)               │
│     - 提取实体引用 (entity-ref events)               │
│     - 提取关系描述 (relationship events)              │
│     - 标注信息来源 (source events)                   │
│     - 完成信号 (done event)                          │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼ SSE Stream
┌─────────────────────────────────────────────────────┐
│  5. Frontend Rendering                               │
│     - ChatPanel: 实时渲染文本 + 内联实体芯片          │
│     - GraphPanel: 渲染 ReactFlow 关系图              │
│     - EntityDrawer: 实体详情侧面板                    │
└─────────────────────────────────────────────────────┘
```

---

## 五、后端详细设计

### 5.1 目录结构

**采用修订版标准分层**（routers → services → domain → storage）：

```
apps/server/
├── app/
│   ├── routers/agent.py              # Agent REST + SSE 端点
│   ├── services/
│   │   ├── agent_service.py          # LangGraph 编排 + 工具调用
│   │   ├── retrieval_service.py      # 本体检索（CTE + tsvector 融合）
│   │   └── schema_service.py         # 本体 schema 序列化（上下文构建）
│   ├── domain/agent.py               # Agent Pydantic 模型（继承 DomainModel）
│   └── storage/agent_storage.py      # 会话/消息/审计日志的 CRUD
└── alembic/versions/0010_agent_tables.py  # 会话 + 消息 + 审计日志表迁移
```

> **备选参考**：原方案设计了 `app/agent/` 子包结构（graph.py, state.py, nodes/, tools/, oag/, llm/, conversation/, models/），该方案将 Agent 所有逻辑集中在独立子包内。在实现阶段可根据代码体量决定是否抽取子包，但对外 API 入口必须遵循标准分层。

### 5.2 LangGraph 状态图定义

```python
# Agent 状态定义
from typing import TypedDict, Annotated
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    """Agent 状态，在图的各节点间传递。"""
    messages: Annotated[list[BaseMessage], add_messages]
    ontology_context: str
    conversation_id: str
    entity_refs: list[dict]
    relationships: list[dict]
    sources: list[dict]
```

```python
# 状态图构建
from langgraph.graph import StateGraph, END

def build_agent_graph() -> StateGraph:
    """构建 Ontology Agent 的 LangGraph 状态图。"""
    graph = StateGraph(AgentState)

    graph.add_node("load_context", load_context.run)
    graph.add_node("agent", agent.run)
    graph.add_node("tools", tools.run)
    graph.add_node("assemble", assemble.run)

    graph.set_entry_point("load_context")
    graph.add_edge("load_context", "agent")

    # 条件边：agent 决定是否需要工具调用
    graph.add_conditional_edges(
        "agent",
        agent.should_use_tools,
        {
            "tools": "tools",       # 需要工具 → 执行工具
            "assemble": "assemble", # 不需要 → 直接组装响应
        },
    )

    # 工具执行后回到 agent（支持多轮工具调用）
    graph.add_edge("tools", "agent")
    graph.add_edge("assemble", END)

    return graph.compile()
```

**状态图可视化**：

```
                ┌──────────────┐
                │ load_context │
                └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
           ┌───▶│    agent     │
           │    └──────┬───────┘
           │           │
           │    ┌──────┴──────┐
           │    │ need tools? │
           │    └──┬───────┬──┘
           │   Yes │       │ No
           │       ▼       ▼
           │  ┌────────┐ ┌──────────┐
           │  │ tools  │ │ assemble │
           │  └────┬───┘ └─────┬────┘
           │       │           │
           └───────┘           ▼
                             [END]
```

### 5.3 Ontology Tool 定义

将现有 Service 包装为 LangGraph/LangChain 兼容的 Tool：

```python
from langchain_core.tools import tool
from app.services.object_type_service import ObjectTypeService
from app.services.link_type_service import LinkTypeService
from app.services.search_service import SearchService

@tool
async def search_ontology(
    query: str,
    resource_type: str | None = None,
    status: str | None = None,
) -> dict:
    """搜索 Ontology 中的对象类型、链接类型等资源。"""
    results = await SearchService.search(
        query=query, resource_type=resource_type, status=status,
    )
    return {"results": [r.model_dump(by_alias=True) for r in results]}

@tool
async def get_object_type(object_type_rid: str) -> dict:
    """获取指定对象类型的完整定义，包含所有属性。"""
    ot = await ObjectTypeService.get_by_rid(object_type_rid)
    return ot.model_dump(by_alias=True)

@tool
async def list_object_types() -> dict:
    """列出所有对象类型的概要信息。"""
    types = await ObjectTypeService.list_all()
    return {
        "objectTypes": [
            {
                "rid": t.rid,
                "apiName": t.api_name,
                "displayName": t.display_name,
                "description": t.description,
                "propertyCount": len(t.properties) if t.properties else 0,
            }
            for t in types
        ]
    }

@tool
async def list_link_types(object_type_rid: str | None = None) -> dict:
    """列出链接类型。可选按对象类型过滤。"""
    links = await LinkTypeService.list_all(object_type_rid=object_type_rid)
    return {
        "linkTypes": [
            {
                "rid": lt.rid,
                "apiName": lt.api_name,
                "displayName": lt.display_name,
                "description": lt.description,
                "sideA": lt.side_a.model_dump(by_alias=True),
                "sideB": lt.side_b.model_dump(by_alias=True),
                "cardinality": lt.cardinality,
            }
            for lt in links
        ]
    }

@tool
async def get_object_type_properties(object_type_rid: str) -> dict:
    """获取指定对象类型的所有属性定义。"""
    props = await PropertyService.list_by_object_type(object_type_rid)
    return {"properties": [p.model_dump(by_alias=True) for p in props]}

@tool
async def describe_relationship(
    object_type_a_rid: str, object_type_b_rid: str,
) -> dict:
    """描述两个对象类型之间的所有链接关系。"""
    links = await LinkTypeService.find_between(
        object_type_a_rid, object_type_b_rid
    )
    return {
        "relationships": [
            {
                "linkType": lt.display_name,
                "from": lt.side_a.object_type_display_name,
                "to": lt.side_b.object_type_display_name,
                "cardinality": lt.cardinality,
                "description": lt.description,
            }
            for lt in links
        ]
    }

# 工具注册表
ONTOLOGY_TOOLS = [
    search_ontology, get_object_type, list_object_types,
    list_link_types, get_object_type_properties, describe_relationship,
]
```

### 5.4 OAG 实现（Schema-as-Context）

OAG（Ontology-Aware Generation）将 Ontology Schema 注入 LLM system prompt，遵循 `03-agent-context-architecture.md` 定义的 L0/L1/L2 分层模型：

```python
class OAGGenerator:
    """生成 Ontology Schema 的分层上下文摘要。"""

    @staticmethod
    async def generate_l0() -> str:
        """L0 — Abstract (~100 tokens): 一句话概括本体规模和覆盖域。"""
        obj_count = await ObjectTypeService.count()
        link_count = await LinkTypeService.count()
        return f"当前本体包含 {obj_count} 个对象类型、{link_count} 个链接类型。"

    @staticmethod
    async def generate_l1() -> str:
        """L1 — Overview (~2K tokens): 所有类型的结构化列表。"""
        object_types = await ObjectTypeService.list_all()
        link_types = await LinkTypeService.list_all()

        lines = ["## 对象类型 (Object Types)\n"]
        for ot in object_types:
            prop_names = [p.api_name for p in (ot.properties or [])[:5]]
            props_str = ", ".join(prop_names)
            suffix = "..." if len(ot.properties or []) > 5 else ""
            lines.append(
                f"- **{ot.display_name}** (`{ot.api_name}`): "
                f"{ot.description or '无描述'} "
                f"[属性: {props_str}{suffix}]"
            )

        lines.append("\n## 链接类型 (Link Types)\n")
        for lt in link_types:
            lines.append(
                f"- {lt.side_a.object_type_display_name} "
                f"→ **{lt.display_name}** → "
                f"{lt.side_b.object_type_display_name} "
                f"({lt.cardinality})"
            )

        return "\n".join(lines)

    @staticmethod
    async def generate_l2(object_type_rid: str) -> str:
        """L2 — Detail (按需): 单个对象类型的完整 JSON Schema。"""
        ot = await ObjectTypeService.get_by_rid(object_type_rid)
        return ot.model_dump_json(by_alias=True, indent=2)

    @staticmethod
    async def generate_system_context() -> str:
        """生成完整的 system prompt 上下文注入内容。"""
        l0 = await OAGGenerator.generate_l0()
        l1 = await OAGGenerator.generate_l1()
        return (
            "# Ontology Context\n\n"
            f"{l0}\n\n"
            f"{l1}\n\n"
            "如需某个对象类型的完整定义，请使用 get_object_type 工具。"
        )
```

### 5.5 多 LLM 提供商支持

```python
from langchain_core.language_models import BaseChatModel
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI

class LLMProvider:
    """多 LLM 提供商适配器。"""

    PROVIDERS = {
        "claude": lambda cfg: ChatAnthropic(
            model=cfg.get("model", "claude-sonnet-4-20250514"),
            temperature=cfg.get("temperature", 0.3),
            max_tokens=cfg.get("max_tokens", 4096),
        ),
        "openai": lambda cfg: ChatOpenAI(
            model=cfg.get("model", "gpt-4o"),
            temperature=cfg.get("temperature", 0.3),
            max_tokens=cfg.get("max_tokens", 4096),
        ),
    }

    @classmethod
    def create(cls, provider: str = "claude", **config) -> BaseChatModel:
        factory = cls.PROVIDERS.get(provider)
        if not factory:
            raise ValueError(
                f"Unknown LLM provider: {provider}. "
                f"Supported: {list(cls.PROVIDERS.keys())}"
            )
        return factory(config)
```

### 5.6 对话管理

```python
class ConversationManager:
    """管理对话历史，支持持久化和上下文窗口管理。"""

    def __init__(self, conversation_id: str, max_history: int = 50):
        self.conversation_id = conversation_id
        self.max_history = max_history

    async def load_history(self) -> list:
        """从存储加载对话历史。MVP 阶段使用内存存储。"""
        ...

    async def save_message(self, role: str, content: str, metadata: dict | None = None):
        """保存一条消息到对话历史。"""
        ...

    async def get_context_window(self, max_tokens: int = 8000) -> list:
        """获取适合 LLM 上下文窗口的消息子集。
        策略：保留最近 N 条消息 + 第一条系统消息。"""
        ...
```

---

## 六、结构化响应与 SSE 协议

> 整合原 README §5 详细代码模型 + 修订版 §3.3/§3.4 决策

### 6.1 AgentMessage 模型

Agent 返回的不是纯文本字符串，而是包含文本 + 实体引用 + 关系 + 来源的结构化消息：

```python
class EntityRef(DomainModel):
    """对话中引用的 Ontology 实体。"""
    rid: str                    # 实体 RID
    entity_type: str            # "object_type" | "link_type" | "property"
    display_name: str
    api_name: str
    description: str | None = None
    text_offset_start: int | None = None  # 在文本中的位置（用于内联芯片渲染）
    text_offset_end: int | None = None

class Relationship(DomainModel):
    """对话中提及的实体间关系。"""
    source_rid: str
    source_display_name: str
    target_rid: str
    target_display_name: str
    link_type_rid: str
    link_display_name: str
    cardinality: str

class Source(DomainModel):
    """信息来源追踪。"""
    tool_name: str
    tool_args: dict
    result_summary: str

class AgentMessage(DomainModel):
    """Agent 的结构化响应。"""
    text: str
    entity_refs: list[EntityRef] = []
    relationships: list[Relationship] = []
    sources: list[Source] = []
    conversation_id: str
    message_id: str
```

> 注意：所有模型继承 `DomainModel`（`app/domain/common.py`），自动获得 `alias_generator=to_camel, populate_by_name=True`。

### 6.2 SSE 事件类型定义

```python
from enum import Enum

class SSEEventType(str, Enum):
    TEXT_DELTA = "text-delta"         # 增量文本
    ENTITY_REF = "entity-ref"        # 实体引用
    RELATIONSHIP = "relationship"    # 关系
    SOURCE = "source"                # 信息来源
    SUBGRAPH = "subgraph"            # 子图数据
    REASONING_STEP = "reasoning-step"# 推理步骤
    TOOL_START = "tool-start"        # 工具调用开始
    TOOL_END = "tool-end"            # 工具调用完成
    ERROR = "error"                  # 错误
    DONE = "done"                    # 完成
```

**SSE 流示例**：

```
event: text-delta
data: {"delta": "根据本体定义，"}

event: text-delta
data: {"delta": "**Customer** 和 **Order** 之间"}

event: entity-ref
data: {"rid": "ri.ontology.object-type.abc", "entityType": "object_type", "displayName": "Customer", "apiName": "Customer", "textOffsetStart": 8, "textOffsetEnd": 16}

event: entity-ref
data: {"rid": "ri.ontology.object-type.def", "entityType": "object_type", "displayName": "Order", "apiName": "Order", "textOffsetStart": 19, "textOffsetEnd": 24}

event: text-delta
data: {"delta": "存在 places 链接关系。"}

event: relationship
data: {"sourceRid": "ri.ontology.object-type.abc", "sourceDisplayName": "Customer", "targetRid": "ri.ontology.object-type.def", "targetDisplayName": "Order", "linkTypeRid": "ri.ontology.link-type.ghi", "linkDisplayName": "places", "cardinality": "ONE_TO_MANY"}

event: source
data: {"toolName": "list_link_types", "toolArgs": {}, "resultSummary": "Found 3 link types"}

event: done
data: {"messageId": "msg_xxx", "sessionRid": "sess_yyy"}
```

### 6.3 实体引用提取策略

**选型：State Accumulation（状态累积）**

在 LangGraph 状态图执行过程中，tools 节点直接将工具返回的实体信息累积到 `AgentState.entity_refs` 中，assemble 节点负责将累积的实体与最终文本进行匹配。

- 实体信息来源明确（直接从 Tool 结果提取），准确度高
- 无需额外 LLM 调用进行后处理
- 流式友好——实体引用可在文本流中穿插发出
- **兜底**：assemble 节点增加轻量文本匹配（正则匹配已知 apiName），覆盖 Agent 不调用 Tool 时的场景

---

## 七、前端架构设计

> 整合原 README §6 组件层次 + 修订版 §四 前端文件清单

### 7.1 组件层次

```
AgentPage（独立全屏布局）
├── ChatPanel (30% 宽度)
│   ├── MessageList
│   │   ├── UserMessage
│   │   └── AgentMessage
│   │       ├── MarkdownRenderer
│   │       │   └── EntityMentionChip (内联)   ← 可点击，hover 显示摘要
│   │       ├── ToolCallIndicator              ← "正在搜索本体..."
│   │       └── SourceFootnotes               ← 信息来源脚注
│   ├── ChatInput
│   │   ├── TextArea (支持 @ mention 触发)
│   │   └── SendButton
│   └── ConversationSidebar                   ← 对话列表
│
├── GraphPanel (45% 宽度)
│   └── ReactFlow 力导向关系图
│       ├── 自定义节点（Object Type 矩形卡片）
│       ├── 自定义边（Link Type 标签 + 箭头）
│       └── 推理轨迹动画层
│
└── EntityDrawer (25% 宽度)
    ├── 三层渐进披露
    │   ├── Tier 1: Popover 悬停预览
    │   ├── Tier 2: Drawer 完整属性/关系/溯源
    │   └── Tier 3: 跳转详情页
    └── ReasoningSteps                        ← 推理步骤折叠展示
```

### 7.2 前端文件清单

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

### 7.3 Entity Mention 内联芯片

对话文本中的实体引用渲染为可交互的内联芯片（Chip）：

```tsx
interface EntityMentionChipProps {
  rid: string;
  entityType: 'object_type' | 'link_type' | 'property';
  displayName: string;
  apiName: string;
  description?: string;
}

// 视觉样式：
// - object_type: 蓝色背景芯片
// - link_type:   绿色背景芯片
// - property:    灰色背景芯片
//
// 交互行为：
// - hover: Tooltip 显示 description + apiName
// - click: 右侧面板高亮对应 EntityCard
// - double-click: 导航到详情页 (/object-types/:rid)
```

### 7.4 SSE 流式 Hook

```typescript
// api/use-agent-chat.ts
export function useAgentChat() {
  const store = useAgentChatStore();

  const sendMessage = useMutation({
    mutationFn: async (params: { conversationId: string; message: string }) => {
      const response = await fetch('/api/v1/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: params.conversationId,
          message: params.message,
        }),
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      store.setStreamingMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        text: '',
        entityRefs: [],
        relationships: [],
        sources: [],
        isStreaming: true,
      });

      // 解析 SSE 流
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7);
            continue;
          }
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            handleSSEEvent(store, eventType, data);
          }
        }
      }

      store.finalizeMessage();
    },
  });

  return { sendMessage };
}

function handleSSEEvent(store: AgentChatStore, type: string, data: any) {
  switch (type) {
    case 'text-delta':
      store.appendTextDelta(data.delta);
      break;
    case 'entity-ref':
      store.addEntityRef(data);
      break;
    case 'relationship':
      store.addRelationship(data);
      break;
    case 'source':
      store.addSource(data);
      break;
    case 'tool-start':
      // 显示 "正在调用 xxx..." 指示器
      break;
    case 'done':
      store.finalizeMessage();
      break;
  }
}
```

### 7.5 Store 设计

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

### 7.6 与现有页面集成

| 集成点 | 交互方式 |
|--------|---------|
| Entity Chip → Object Type 详情页 | 双击芯片导航到 `/object-types/:rid` |
| Entity Chip → Link Type 详情页 | 双击芯片导航到 `/link-types/:rid` |
| Entity Card → 详情页 | 点击 "查看详情" 按钮 |
| 搜索页 → Agent | 搜索结果页添加 "Ask Agent" 入口 |
| Object Type 详情页 → Agent | 添加 "Ask Agent about this type" 按钮 |
| 全局导航 | 侧边栏添加 "Agent Chat" 菜单项 |

### 7.7 与 3D 星空 Demo 的连接点

现有 3D 星空 Demo（`/demo/canvas`）可与 Agent 深度联动：

1. **Agent 引用可视化** — Agent 提及的实体和关系在星空中高亮显示（星体发光 + 连线加粗）
2. **星空导航** — 点击星体触发 Agent 查询该对象类型
3. **关系发现动画** — Agent 发现新关系时，星空中实时绘制新连线（带粒子动画）
4. **双视图模式** — 用户可在 ReactFlow 平面图 和 3D 星空 之间切换

实现策略：通过 Zustand store 共享 `highlightedEntityRids` 状态，3D 场景监听状态变化。

---

## 八、本体可视化模式

> 来源：原 README §7

### 8.1 Entity Cards

每个被 Agent 引用的实体显示为一张摘要卡片：

```
┌──────────────────────────────┐
│ 📦 Object Type               │
│ ──────────────────────────── │
│ Customer                      │
│ 客户实体                       │
│                               │
│ 核心属性:                      │
│  • name (string)              │
│  • email (string)             │
│  • region (string)            │
│  • tier (string)              │
│  • ... +3 more               │
│                               │
│ 链接: 2 outgoing, 1 incoming │
│                               │
│ [查看详情 →]  [展开属性 ▼]    │
└──────────────────────────────┘
```

### 8.2 Relationship Graph（ReactFlow）

使用 ReactFlow 渲染对话中涉及的实体关系子图：

```
┌─────────────────────────────────────────┐
│                                         │
│   ┌──────────┐       places        ┌──────────┐
│   │ Customer │ ──────────────────▶ │  Order   │
│   │  (5 属性) │                    │  (6 属性) │
│   └──────────┘                     └──────────┘
│        │                                │
│        │ belongs_to                     │ contains
│        ▼                                ▼
│   ┌──────────┐                     ┌──────────┐
│   │  Region  │                     │ Product  │
│   │  (3 属性) │                     │  (4 属性) │
│   └──────────┘                     └──────────┘
│                                         │
│                    [全屏] [适应窗口]      │
└─────────────────────────────────────────┘
```

**ReactFlow 节点**：
- 矩形节点 = Object Type（颜色编码按业务域）
- 边标签 = Link Type 名称
- 箭头方向 = 关系方向
- 节点可拖拽、缩放

### 8.3 Evidence Trail（证据追踪）

展示 Agent 推理过程中调用的 Tools 和结果：

```
┌─────────────────────────────────────────┐
│ 📎 Evidence Trail                        │
│                                         │
│ 1. 🔍 search_ontology("订单")           │
│    → 找到: Order, OrderLine, ...        │
│                                         │
│ 2. 🔗 list_link_types("Customer")       │
│    → places → Order (1:N)              │
│    → belongs_to → Region (N:1)         │
│                                         │
│ 3. 📋 get_object_type("Order")          │
│    → 6 properties, 2 links             │
└─────────────────────────────────────────┘
```

### 8.4 Interactive Navigation

用户可从可视化面板出发进一步探索：

- **Entity Card → 展开属性** — 折叠/展开完整属性列表
- **Entity Card → 查看详情** — 跳转到 Object Type / Link Type 详情页
- **Graph 节点 → 点击** — 高亮对应 Entity Card + 滚动到对话中的提及位置
- **Graph 节点 → 双击** — 以该节点为中心展开关联节点（增量探索）
- **Graph 边 → 点击** — 显示 Link Type 详细信息浮层

---

## 九、与现有代码库集成

> 来源：修订版 §四 完整内容

### 9.1 新增文件

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

### 9.2 需修改的现有文件

| 文件 | 修改内容 |
|------|----------|
| `apps/server/app/main.py` | 注册 `agent.router` |
| `apps/web/src/router.tsx` | 添加 `/agent` 路由（AppShell 下独立布局） |
| `apps/web/src/locales/en-US/common.json` | 新增 `agent.*` i18n key |
| `apps/web/src/locales/zh-CN/common.json` | 新增 `agent.*` i18n key |
| `apps/web/src/components/layout/TopBar.tsx` | 添加 Agent 导航入口 |
| `apps/server/app/config.py` | 新增 LLM 配置项 |
| `apps/server/openapi.json` | 自动重新生成 |

### 9.3 数据库设计

> 修订版决策：MVP 即建表（非原方案的 Phase 3 延后）

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

### 9.4 错误码表

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

### 9.5 严格遵守的约束

- 后端分层：routers → services → domain/storage（禁止反向导入）
- Domain 模型继承 `DomainModel`（自动 camelCase 序列化）
- 数据库：rid 主键 `ri.ontology.<type>.<12hex>`，Alembic 迁移
- 类型管道：openapi.json → openapi-typescript → generated/api.ts
- 前端状态：服务端数据 → TanStack Query，UI 状态 → Zustand
- i18n：所有用户可见字符串用 `t('agent.xxx')`
- 异步 SQLAlchemy：async session + asyncpg

---

## 十、各方案精华采纳总览

> 来源：修订版 §三

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

## 十一、新增依赖清单

> 来源：修订版 §五

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

## 十二、分阶段路线

> 来源：修订版 §六

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

## 十三、关键设计决策与权衡

> 整合原 README §10 详细对比表 + 修订版 §七 决策记录

### 已确认决策

| # | 决策 | 结论 | 说明 |
|---|------|------|------|
| D1 | LLM 模型 | **MVP 即支持多模型** | 通过 config 切换 Anthropic/OpenAI，需同时引入两个 SDK |
| D2 | 图谱渲染库 | **React Flow** | 已有依赖，零新增。V1 如性能不足再迁移 G6 |
| D3 | 页面布局 | **独立全屏** | AppShell 下独立路由，不嵌入 HomeLayout |
| D4 | 会话标题 | **LLM 自动生成** | 第一轮对话后异步生成标题，额外一次 API 调用 |
| D5 | SSE 实现 | **FastAPI 原生** | `StreamingResponse` + async generator，零新增依赖 |

### 详细权衡分析

#### D1: Agent 框架 — LangGraph vs 原生实现

| 维度 | LangGraph | 原生实现 |
|------|-----------|---------|
| 开发速度 | 快（内置状态管理、工具循环） | 慢（需自建） |
| 灵活性 | 高（显式状态图 + 条件边） | 最高 |
| 调试 | 好（LangSmith 集成、可视化） | 需自建 |
| 依赖 | 中（langchain 生态） | 无 |
| 锁定风险 | 中（核心逻辑可迁移） | 无 |

**权衡**: 接受 langchain 生态的依赖换取更快的开发迭代。核心 Tools 只依赖 `@tool` 装饰器，迁移成本低。

#### D2: 流式协议 — SSE vs WebSocket

| 维度 | SSE | WebSocket |
|------|-----|-----------|
| 复杂度 | 低（HTTP/1.1 内置） | 高（需连接管理） |
| 适用场景 | 服务端→客户端单向流 | 双向实时通信 |
| FastAPI 支持 | 原生 StreamingResponse | 需额外配置 |
| 断线重连 | 浏览器自动重连 | 需手动实现 |
| 并发连接 | 受 HTTP/1.1 限制（每域 6 连接） | 无限制 |

**权衡**: Agent 对话是典型的"请求-流式响应"模式，SSE 足够且更简单。如果后续需要实时协作再引入 WebSocket。

#### D3: 实体引用提取 — State Accumulation vs Post-processing

**选择**: State Accumulation。

- Tool 调用天然返回结构化实体数据，无需额外解析
- 流式友好 — entity-ref 事件可在文本流中穿插发出
- 准确度高 — 不依赖文本匹配/NER 的不确定性
- **劣势**: Agent 不调用 Tool 时无法提取实体引用 → assemble 节点增加轻量文本匹配兜底

#### D4: 前端状态管理

遵循现有架构约定：

- **服务端数据**（对话历史、Agent 响应）→ TanStack Query cache
- **UI 状态**（面板开关、高亮实体、流式消息缓冲）→ Zustand store
- **流式消息**是特殊情况 — 流式进行中存在 Zustand（避免 TanStack Query 频繁更新），流式完成后移入 TanStack Query cache

#### D5: 可视化技术 — ReactFlow vs D3.js vs 3D 星空复用

| 维度 | ReactFlow | D3.js | 3D 星空复用 |
|------|-----------|-------|------------|
| 学习曲线 | 低（React 原生） | 高 | 中（已有代码） |
| 交互性 | 高（拖拽、缩放原生支持） | 需手动实现 | 高但不适合小面板 |
| 适合嵌入 | 好（轻量、可嵌入面板） | 好 | 差（3D 渲染开销大） |
| 关系图表达 | 专为图设计 | 通用 | 偏展示，非精确操作 |

**权衡**: ReactFlow 适合面板内嵌入的轻量关系图。3D 星空保留为可选的沉浸式全屏视图。

#### D6: 数据库建表时机

**修订版决策**: MVP 即建表（`agent_sessions` + `agent_messages` + `agent_audit_logs`）。

原方案将数据库延后到 Phase 3，但代码库审查后发现：
- 现有 Alembic 迁移管线成熟，新增 3 张表成本极低
- MVP 即需要审计日志（安全层 L5）
- 会话持久化是基础用户体验

---

## 十四、验证方式

> 来源：修订版 §八

1. **后端单元测试**：`cd apps/server && PYTHONPATH=. uv run pytest tests/unit/ -v` 覆盖 Agent 服务 + 检索逻辑
2. **后端集成测试**：`cd apps/server && PYTHONPATH=. uv run pytest tests/integration/ -v` 覆盖 Agent 路由端点
3. **前端测试**：`cd apps/web && pnpm test --run` 覆盖对话面板 + 实体探索 + 图谱联动
4. **端到端手动验证**：
   - 启动后端+前端
   - 访问 `/agent` 页面
   - 输入自然语言查询（如"有哪些对象类型？"）
   - 验证：流式文本渲染 → 实体锚点可点击 → 图谱节点显示 → Drawer 面板弹出
5. **SSE 流式验证**：浏览器 DevTools Network → EventStream 面板查看事件序列完整性

---

## 附录

### A: 环境变量配置

```bash
# Agent LLM 配置
AGENT_LLM_PROVIDER=claude                    # claude | openai
AGENT_LLM_MODEL=claude-sonnet-4-20250514     # 模型 ID
AGENT_LLM_TEMPERATURE=0.3
AGENT_LLM_MAX_TOKENS=4096
AGENT_LLM_API_KEY=sk-...                     # 对应提供商的 API Key

# Agent 行为配置
AGENT_MAX_TOOL_CALLS=10                      # 单轮最大工具调用次数
AGENT_CONTEXT_MAX_TOKENS=8000                # 对话上下文最大 token 数
AGENT_OAG_LEVEL=l1                           # 默认注入的 OAG 层级
```

### B: 技术栈总结

| 层 | 技术 | 用途 |
|---|------|------|
| Agent 框架 | LangGraph 0.2+ | 状态图编排、工具调用循环、流式输出 |
| 结构化输出 | Instructor + PydanticAI | 两阶段实体提取 |
| LLM 接口 | langchain-anthropic / langchain-openai | 多 LLM 提供商适配 |
| 工具定义 | langchain-core `@tool` | 包装现有 Service 为 Agent Tools |
| 流式协议 | SSE (Server-Sent Events) | 实时流式输出到前端 |
| 关系图 | ReactFlow | 交互式本体关系图 |
| Markdown 渲染 | react-markdown + rehype | 支持内联 Entity Chip |
| 前端框架 | Ant Design 5.x（现有） | 对话 UI 组件 |
| 状态管理 | Zustand（UI 状态） + TanStack Query（服务端状态） | 遵循现有架构 |
