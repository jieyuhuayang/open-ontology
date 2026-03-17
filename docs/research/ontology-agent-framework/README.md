# Ontology-Aware AI Agent Framework — 研究与设计文档

> **状态**: 研究草案
> **作者**: Open Ontology Team
> **日期**: 2026-03-17
> **前置阅读**: `docs/architecture/03-agent-context-architecture.md`

---

## 1. 调研背景与目标

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

## 2. 系统架构总览

### 2.1 四层架构

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

### 2.2 核心设计原则

1. **Agent 是 Service 的消费者，不是替代者** — Agent 通过包装现有 Service 获取能力，不绕过 Domain 层
2. **结构化优于纯文本** — Agent 返回的每一段文本都可以关联到 Ontology 实体
3. **流式优先** — SSE 流式输出，前端实时渲染文本 + 本体注解
4. **渐进式复杂度** — 从纯文本聊天开始，逐步增加实体引用、关系图、交互式导航

---

## 3. 核心数据流

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
│     - 文本流式输出 (text_delta events)               │
│     - 提取实体引用 (entity_ref events)               │
│     - 提取关系描述 (relationship events)              │
│     - 标注信息来源 (source events)                   │
│     - 完成信号 (done event)                          │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼ SSE Stream
┌─────────────────────────────────────────────────────┐
│  5. Frontend Rendering                               │
│     - ChatPanel: 实时渲染文本 + 内联实体芯片          │
│     - OntologyContextPanel: 渲染 Entity Cards +      │
│       ReactFlow 关系图                               │
└─────────────────────────────────────────────────────┘
```

---

## 4. 后端 Agent 框架设计

### 4.1 框架选型：LangGraph

**选型理由**：

| 框架 | 优势 | 劣势 | 适配度 |
|------|------|------|--------|
| **LangGraph** | 显式状态图、支持循环/分支/人机交互、原生流式、与 langchain 工具生态兼容 | 学习曲线较陡 | ★★★★★ |
| LangChain (LCEL) | 生态丰富、社区大 | 链式抽象对复杂流程不够灵活、调试困难 | ★★★☆☆ |
| AutoGen | 多 Agent 对话、角色扮演 | 重量级、偏多 Agent 场景、对单 Agent 工具调用场景过度设计 | ★★☆☆☆ |
| 原生实现 | 完全可控、无依赖 | 需要自己实现状态管理、工具调用循环、流式输出 | ★★★☆☆ |
| CrewAI | 简洁的任务编排 | 抽象层次过高、不适合需要精细控制的场景 | ★★☆☆☆ |

**LangGraph 的关键优势**：

1. **显式状态图** — 每个节点（load_context → agent → tools → assemble）的职责清晰，便于调试和观测
2. **条件边** — agent 节点可根据是否需要工具调用决定下一步走向
3. **原生流式** — 内置 `astream_events` 支持逐 token 流式输出
4. **人机协作** — 内置 `interrupt` 机制，支持 Agent 请求用户确认
5. **检查点** — 自动保存图执行状态，支持会话恢复

### 4.2 目录结构

```
apps/server/app/agent/
├── __init__.py
├── graph.py                 # LangGraph 状态图定义（核心）
├── state.py                 # AgentState TypedDict
├── nodes/
│   ├── __init__.py
│   ├── load_context.py      # 加载 OAG + 对话历史
│   ├── agent.py             # LLM 推理节点
│   ├── tools.py             # 工具执行节点
│   └── assemble.py          # 响应组装 + 实体提取
├── tools/
│   ├── __init__.py
│   ├── ontology_tools.py    # 包装 Service 的 Agent Tools
│   └── search_tools.py      # 搜索相关 Tools
├── oag/
│   ├── __init__.py
│   └── generator.py         # OAG (Schema-as-Context) L0/L1/L2 生成
├── llm/
│   ├── __init__.py
│   ├── provider.py          # Multi-provider LLM 适配器
│   └── config.py            # LLM 配置（model, temperature, etc.）
├── conversation/
│   ├── __init__.py
│   └── manager.py           # 对话历史管理
└── models/
    ├── __init__.py
    ├── agent_message.py     # AgentMessage 结构化响应模型
    └── sse_events.py        # SSE 事件类型定义
```

### 4.3 LangGraph 状态图定义

```python
# app/agent/state.py
from typing import TypedDict, Annotated
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    """Agent 状态，在图的各节点间传递。"""
    # 对话消息（LangGraph 自动管理追加逻辑）
    messages: Annotated[list[BaseMessage], add_messages]
    # OAG 上下文（L0/L1/L2 Schema 摘要）
    ontology_context: str
    # 当前对话 ID
    conversation_id: str
    # 本轮提取的实体引用
    entity_refs: list[dict]
    # 本轮提取的关系
    relationships: list[dict]
    # 信息来源
    sources: list[dict]
```

```python
# app/agent/graph.py
from langgraph.graph import StateGraph, END
from app.agent.state import AgentState
from app.agent.nodes import load_context, agent, tools, assemble

def build_agent_graph() -> StateGraph:
    """构建 Ontology Agent 的 LangGraph 状态图。"""
    graph = StateGraph(AgentState)

    # 添加节点
    graph.add_node("load_context", load_context.run)
    graph.add_node("agent", agent.run)
    graph.add_node("tools", tools.run)
    graph.add_node("assemble", assemble.run)

    # 定义边
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

    # 组装完成 → 结束
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

### 4.4 Ontology Tool 定义

将现有 Service 包装为 LangGraph/LangChain 兼容的 Tool：

```python
# app/agent/tools/ontology_tools.py
from langchain_core.tools import tool
from app.services.object_type_service import ObjectTypeService
from app.services.link_type_service import LinkTypeService
from app.services.property_service import PropertyService
from app.services.search_service import SearchService

@tool
async def search_ontology(
    query: str,
    resource_type: str | None = None,
    status: str | None = None,
) -> dict:
    """搜索 Ontology 中的对象类型、链接类型等资源。

    Args:
        query: 搜索关键词
        resource_type: 资源类型过滤（object_type / link_type / property）
        status: 状态过滤（active / draft / deprecated）
    """
    results = await SearchService.search(
        query=query,
        resource_type=resource_type,
        status=status,
    )
    return {"results": [r.model_dump(by_alias=True) for r in results]}


@tool
async def get_object_type(object_type_rid: str) -> dict:
    """获取指定对象类型的完整定义，包含所有属性。

    Args:
        object_type_rid: 对象类型的 RID（如 ri.ontology.object-type.xxx）
    """
    ot = await ObjectTypeService.get_by_rid(object_type_rid)
    return ot.model_dump(by_alias=True)


@tool
async def list_object_types() -> dict:
    """列出所有对象类型的概要信息（名称、描述、属性数量）。"""
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
    """列出链接类型。可选按对象类型过滤，只返回与该对象类型相关的链接。

    Args:
        object_type_rid: 可选，过滤与此对象类型相关的链接类型
    """
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
    """获取指定对象类型的所有属性定义。

    Args:
        object_type_rid: 对象类型的 RID
    """
    props = await PropertyService.list_by_object_type(object_type_rid)
    return {
        "properties": [p.model_dump(by_alias=True) for p in props]
    }


@tool
async def describe_relationship(
    object_type_a_rid: str,
    object_type_b_rid: str,
) -> dict:
    """描述两个对象类型之间的所有链接关系。

    Args:
        object_type_a_rid: 第一个对象类型的 RID
        object_type_b_rid: 第二个对象类型的 RID
    """
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
    search_ontology,
    get_object_type,
    list_object_types,
    list_link_types,
    get_object_type_properties,
    describe_relationship,
]
```

### 4.5 OAG 实现（Schema-as-Context）

OAG（Ontology-Aware Generation）将 Ontology Schema 注入 LLM system prompt，遵循 `03-agent-context-architecture.md` 定义的 L0/L1/L2 分层模型：

```python
# app/agent/oag/generator.py
from app.services.object_type_service import ObjectTypeService
from app.services.link_type_service import LinkTypeService


class OAGGenerator:
    """生成 Ontology Schema 的分层上下文摘要。"""

    @staticmethod
    async def generate_l0() -> str:
        """L0 — Abstract (~100 tokens): 一句话概括本体规模和覆盖域。"""
        obj_count = await ObjectTypeService.count()
        link_count = await LinkTypeService.count()
        return (
            f"当前本体包含 {obj_count} 个对象类型、"
            f"{link_count} 个链接类型。"
        )

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

### 4.6 多 LLM 提供商支持

```python
# app/agent/llm/provider.py
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

### 4.7 对话管理

```python
# app/agent/conversation/manager.py
from datetime import datetime
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage


class ConversationManager:
    """管理对话历史，支持持久化和上下文窗口管理。"""

    def __init__(self, conversation_id: str, max_history: int = 50):
        self.conversation_id = conversation_id
        self.max_history = max_history

    async def load_history(self) -> list:
        """从存储加载对话历史。MVP 阶段使用内存存储。"""
        # MVP: 内存字典存储
        # 后续: PostgreSQL conversations / messages 表
        ...

    async def save_message(self, role: str, content: str, metadata: dict | None = None):
        """保存一条消息到对话历史。"""
        ...

    async def get_context_window(self, max_tokens: int = 8000) -> list:
        """获取适合 LLM 上下文窗口的消息子集。

        策略：保留最近 N 条消息 + 第一条系统消息。
        """
        ...
```

---

## 5. 结构化响应格式设计

### 5.1 AgentMessage 模型

Agent 返回的不是纯文本字符串，而是一个包含文本 + 实体引用 + 关系 + 来源的结构化消息：

```python
# app/agent/models/agent_message.py
from pydantic import BaseModel, ConfigDict
from humps import camelize


class EntityRef(BaseModel):
    """对话中引用的 Ontology 实体。"""
    model_config = ConfigDict(
        alias_generator=camelize,
        populate_by_name=True,
    )

    rid: str                    # 实体 RID
    entity_type: str            # "object_type" | "link_type" | "property"
    display_name: str           # 显示名称
    api_name: str               # API 名称
    description: str | None = None
    # 在文本中的位置（用于内联芯片渲染）
    text_offset_start: int | None = None
    text_offset_end: int | None = None


class Relationship(BaseModel):
    """对话中提及的实体间关系。"""
    model_config = ConfigDict(
        alias_generator=camelize,
        populate_by_name=True,
    )

    source_rid: str
    source_display_name: str
    target_rid: str
    target_display_name: str
    link_type_rid: str
    link_display_name: str
    cardinality: str


class Source(BaseModel):
    """信息来源追踪。"""
    model_config = ConfigDict(
        alias_generator=camelize,
        populate_by_name=True,
    )

    tool_name: str              # 来源 Tool 名称
    tool_args: dict             # Tool 调用参数
    result_summary: str         # 结果摘要


class AgentMessage(BaseModel):
    """Agent 的结构化响应。"""
    model_config = ConfigDict(
        alias_generator=camelize,
        populate_by_name=True,
    )

    text: str                                # 主体文本
    entity_refs: list[EntityRef] = []        # 引用的实体
    relationships: list[Relationship] = []   # 涉及的关系
    sources: list[Source] = []               # 信息来源
    conversation_id: str                     # 对话 ID
    message_id: str                          # 消息 ID
```

### 5.2 SSE 流式协议

使用 Server-Sent Events (SSE) 实现流式输出，前端实时渲染：

```python
# app/agent/models/sse_events.py
from pydantic import BaseModel, ConfigDict
from humps import camelize
from enum import Enum


class SSEEventType(str, Enum):
    """SSE 事件类型。"""
    TEXT_DELTA = "text_delta"         # 增量文本
    ENTITY_REF = "entity_ref"        # 实体引用
    RELATIONSHIP = "relationship"    # 关系
    SOURCE = "source"                # 信息来源
    TOOL_START = "tool_start"        # 工具调用开始（用于 UI loading 状态）
    TOOL_END = "tool_end"            # 工具调用完成
    ERROR = "error"                  # 错误
    DONE = "done"                    # 完成
```

**SSE 流示例**：

```
event: text_delta
data: {"delta": "根据本体定义，"}

event: text_delta
data: {"delta": "**Customer** 和 **Order** 之间"}

event: entity_ref
data: {"rid": "ri.ontology.object-type.abc", "entityType": "object_type", "displayName": "Customer", "apiName": "Customer", "textOffsetStart": 8, "textOffsetEnd": 16}

event: entity_ref
data: {"rid": "ri.ontology.object-type.def", "entityType": "object_type", "displayName": "Order", "apiName": "Order", "textOffsetStart": 19, "textOffsetEnd": 24}

event: text_delta
data: {"delta": "存在 places 链接关系。"}

event: relationship
data: {"sourceRid": "ri.ontology.object-type.abc", "sourceDisplayName": "Customer", "targetRid": "ri.ontology.object-type.def", "targetDisplayName": "Order", "linkTypeRid": "ri.ontology.link-type.ghi", "linkDisplayName": "places", "cardinality": "ONE_TO_MANY"}

event: source
data: {"toolName": "list_link_types", "toolArgs": {}, "resultSummary": "Found 3 link types"}

event: done
data: {"messageId": "msg_xxx", "conversationId": "conv_yyy"}
```

**API 端点设计**：

```python
# app/routers/agent_router.py
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api/v1/agent", tags=["agent"])

@router.post("/chat")
async def chat(request: ChatRequest) -> StreamingResponse:
    """发送消息并接收流式响应。"""
    return StreamingResponse(
        agent_stream(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Nginx SSE 支持
        },
    )

@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    """获取对话历史。"""
    ...

@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    """删除对话。"""
    ...
```

### 5.3 实体引用提取策略

**选型：State Accumulation（状态累积）**

在 LangGraph 状态图执行过程中，tools 节点直接将工具返回的实体信息累积到 `AgentState.entity_refs` 中，assemble 节点负责将累积的实体与最终文本进行匹配。

```
优势：
- 实体信息来源明确（直接从 Tool 结果提取），准确度高
- 无需额外 LLM 调用进行后处理
- 流式友好——实体引用可在文本生成过程中穿插发出

对比方案 — Post-processing（后处理）：
- 在完整文本生成后，用正则/NER 从文本中提取实体名，再与 Ontology 匹配
- 劣势：延迟高（需等完整文本）、准确度依赖文本匹配质量
```

---

## 6. 前端架构设计

### 6.1 组件层次

```
AgentPage
├── ChatPanel (60% 宽度)
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
└── OntologyContextPanel (40% 宽度)
    ├── PanelTabs
    │   ├── EntitiesTab
    │   │   └── EntityCardList
    │   │       └── EntityCard                ← 属性摘要 + 链接到详情页
    │   ├── GraphTab
    │   │   └── MiniRelationshipGraph         ← ReactFlow 微型关系图
    │   └── SourcesTab
    │       └── SourceList                    ← Tool 调用记录
    └── PanelHeader
        └── ToggleButton                      ← 展开/收起
```

### 6.2 页面布局

```
┌──────────────────────────────────────────────────────────────────┐
│  Agent Chat                                            [≡] [⚙]  │
├──────────────────────────────────┬───────────────────────────────┤
│                                  │                               │
│  ChatPanel (60%)                 │  OntologyContextPanel (40%)   │
│                                  │                               │
│  ┌────────────────────────────┐  │  ┌─────────────────────────┐  │
│  │ 🤖 根据本体定义，          │  │  │ [实体] [关系图] [来源]  │  │
│  │    [Customer] 和 [Order]   │  │  │                         │  │
│  │    之间存在 places 链接    │  │  │  ┌──────────────────┐   │  │
│  │    关系（一对多）。        │  │  │  │ 📦 Customer      │   │  │
│  │                            │  │  │  │ 客户实体          │   │  │
│  │    Customer 通过 places    │  │  │  │ 属性: name, email │   │  │
│  │    链接到 Order，表示      │  │  │  │ [查看详情 →]      │   │  │
│  │    "客户下单"的业务关系。  │  │  │  └──────────────────┘   │  │
│  │                            │  │  │                         │  │
│  │  📎 来源: list_link_types  │  │  │  ┌──────────────────┐   │  │
│  └────────────────────────────┘  │  │  │ 📦 Order         │   │  │
│                                  │  │  │ 订单实体          │   │  │
│  ┌────────────────────────────┐  │  │  │ 属性: order_id,  │   │  │
│  │ 👤 还有哪些对象类型与      │  │  │  │   status, amount │   │  │
│  │    Customer 相关？         │  │  │  │ [查看详情 →]      │   │  │
│  └────────────────────────────┘  │  │  └──────────────────┘   │  │
│                                  │  │                         │  │
│  ┌────────────────────────────┐  │  │  ┌───────────────────┐  │  │
│  │ ⏳ 正在查询链接类型...     │  │  │  │  Customer         │  │  │
│  └────────────────────────────┘  │  │  │     │ places      │  │  │
│                                  │  │  │     ▼             │  │  │
│  ┌────────────────────────────┐  │  │  │   Order           │  │  │
│  │ [请输入你的问题...]    [↑] │  │  │  └───────────────────┘  │  │
│  └────────────────────────────┘  │  │                         │  │
│                                  │  └─────────────────────────┘  │
└──────────────────────────────────┴───────────────────────────────┘
```

### 6.3 Entity Mention 内联芯片

对话文本中的实体引用渲染为可交互的内联芯片（Chip）：

```tsx
// components/agent/EntityMentionChip.tsx
interface EntityMentionChipProps {
  rid: string;
  entityType: 'object_type' | 'link_type' | 'property';
  displayName: string;
  apiName: string;
  description?: string;
}

// 视觉样式：
// - object_type: 蓝色背景芯片 🔵
// - link_type:   绿色背景芯片 🟢
// - property:    灰色背景芯片 ⚪
//
// 交互行为：
// - hover: Tooltip 显示 description + apiName
// - click: 右侧面板高亮对应 EntityCard
// - double-click: 导航到详情页 (/object-types/:rid)
```

### 6.4 SSE 流式 Hook + Zustand Chat Store

```typescript
// stores/agent-chat-store.ts
import { create } from 'zustand';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  entityRefs: EntityRef[];
  relationships: Relationship[];
  sources: Source[];
  isStreaming: boolean;
}

interface AgentChatStore {
  // 对话状态
  conversations: Map<string, Conversation>;
  activeConversationId: string | null;

  // 当前流式消息
  streamingMessage: Message | null;

  // UI 状态（仅 UI 相关，服务端数据在 TanStack Query）
  isContextPanelOpen: boolean;
  activeContextTab: 'entities' | 'graph' | 'sources';
  highlightedEntityRid: string | null;

  // Actions
  setStreamingMessage: (msg: Message | null) => void;
  appendTextDelta: (delta: string) => void;
  addEntityRef: (ref: EntityRef) => void;
  addRelationship: (rel: Relationship) => void;
  finalizeMessage: () => void;
  setHighlightedEntity: (rid: string | null) => void;
}
```

```typescript
// api/use-agent-chat.ts
import { useMutation } from '@tanstack/react-query';

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

      // 初始化流式消息
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
            // 下一行是 data:
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
    case 'text_delta':
      store.appendTextDelta(data.delta);
      break;
    case 'entity_ref':
      store.addEntityRef(data);
      break;
    case 'relationship':
      store.addRelationship(data);
      break;
    case 'source':
      store.addSource(data);
      break;
    case 'tool_start':
      // 显示 "正在调用 xxx..." 指示器
      break;
    case 'done':
      store.finalizeMessage();
      break;
  }
}
```

### 6.5 与现有页面集成

Agent 页面与现有 Ontology Manager 页面的集成点：

| 集成点 | 交互方式 |
|--------|---------|
| Entity Chip → Object Type 详情页 | 双击芯片导航到 `/object-types/:rid` |
| Entity Chip → Link Type 详情页 | 双击芯片导航到 `/link-types/:rid` |
| Entity Card → 详情页 | 点击 "查看详情" 按钮 |
| 搜索页 → Agent | 搜索结果页添加 "Ask Agent" 入口 |
| Object Type 详情页 → Agent | 添加 "Ask Agent about this type" 按钮 |
| 全局导航 | 侧边栏添加 "Agent Chat" 菜单项 |

### 6.6 与 3D 星空 Demo 的连接点

现有 3D 星空 Demo（`/demo/canvas`）可与 Agent 深度联动：

1. **Agent 引用可视化** — Agent 提及的实体和关系在星空中高亮显示（星体发光 + 连线加粗）
2. **星空导航** — 点击星体触发 Agent 查询该对象类型
3. **关系发现动画** — Agent 发现新关系时，星空中实时绘制新连线（带粒子动画）
4. **双视图模式** — 用户可在 ReactFlow 平面图 和 3D 星空 之间切换

实现策略：通过 Zustand store 共享 `highlightedEntityRids` 状态，3D 场景监听状态变化。

---

## 7. 本体可视化模式

### 7.1 Entity Cards

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

### 7.2 Relationship Graph（ReactFlow）

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

### 7.3 Evidence Trail（证据追踪）

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

### 7.4 Interactive Navigation

用户可从可视化面板出发进一步探索：

- **Entity Card → 展开属性** — 折叠/展开完整属性列表
- **Entity Card → 查看详情** — 跳转到 Object Type / Link Type 详情页
- **Graph 节点 → 点击** — 高亮对应 Entity Card + 滚动到对话中的提及位置
- **Graph 节点 → 双击** — 以该节点为中心展开关联节点（增量探索）
- **Graph 边 → 点击** — 显示 Link Type 详细信息浮层

---

## 8. 技术选型总结

### 8.1 核心技术栈

| 层 | 技术 | 用途 |
|---|------|------|
| Agent 框架 | LangGraph 0.2+ | 状态图编排、工具调用循环、流式输出 |
| LLM 接口 | langchain-anthropic / langchain-openai | 多 LLM 提供商适配 |
| 工具定义 | langchain-core `@tool` | 包装现有 Service 为 Agent Tools |
| 流式协议 | SSE (Server-Sent Events) | 实时流式输出到前端 |
| 关系图 | ReactFlow | 交互式本体关系图 |
| Markdown 渲染 | react-markdown + rehype | 支持内联 Entity Chip 的 Markdown 渲染 |
| 前端框架 | Ant Design 5.x（现有） | 对话 UI 组件 |
| 状态管理 | Zustand（UI 状态） + TanStack Query（服务端状态） | 遵循现有架构 |

### 8.2 新增 Python 依赖

```toml
# apps/server/pyproject.toml 新增
[project.dependencies]
langgraph = ">=0.2.0"
langchain-core = ">=0.3.0"
langchain-anthropic = ">=0.2.0"
langchain-openai = ">=0.2.0"     # 可选，按需启用
```

### 8.3 新增前端依赖

```json
// apps/web/package.json 新增
{
  "dependencies": {
    "@xyflow/react": "^12.0.0",
    "react-markdown": "^9.0.0",
    "rehype-raw": "^7.0.0",
    "remark-gfm": "^4.0.0"
  }
}
```

---

## 9. MVP 分阶段规划

### Phase 1: 基础聊天 + 本体上下文注入

**目标**: 用户可以与 Agent 进行基本对话，Agent 具备 Ontology 上下文感知能力。

**范围**:
- [x] LangGraph 状态图骨架（load_context → agent → tools → assemble）
- [x] OAG L0/L1 自动生成 + system prompt 注入
- [x] 基础 Ontology Tools（list_object_types, get_object_type, list_link_types）
- [x] SSE 流式输出（仅 text_delta + done 事件）
- [x] 前端 ChatPanel（消息列表 + 输入框 + 流式渲染）
- [x] 单一 LLM 提供商（Claude）
- [ ] 对话历史（内存存储）

**不包含**: 实体引用、关系图、上下文面板。

### Phase 2: 结构化响应 + 实体引用

**目标**: Agent 响应中包含结构化的实体引用，前端以内联芯片形式渲染。

**范围**:
- [ ] 实体引用提取（State Accumulation 策略）
- [ ] SSE entity_ref / relationship / source 事件
- [ ] Entity Mention Chip 组件
- [ ] OntologyContextPanel（Entity Cards Tab）
- [ ] 60/40 分栏布局
- [ ] Entity Card 链接到详情页
- [ ] 更多 Tools（search_ontology, describe_relationship, get_properties）

### Phase 3: 交互式本体可视化

**目标**: 对话中涉及的本体关系以交互式图形展示。

**范围**:
- [ ] ReactFlow Mini Relationship Graph
- [ ] Graph ↔ Chat 双向联动（点击节点高亮对话文本）
- [ ] Evidence Trail（Tool 调用记录面板）
- [ ] 对话历史持久化（PostgreSQL）
- [ ] 多对话管理（Conversation Sidebar）

### Phase 4: 高级特性

**目标**: Agent 具备更深层的 Ontology 理解和辅助设计能力。

**范围**:
- [ ] RAG — 基于 Ontology 描述文本的向量检索
- [ ] Multi-Agent — 专项 Agent 协作（Schema 分析 Agent + 数据质量 Agent）
- [ ] Agent 辅助设计 — 用自然语言描述业务场景，Agent 生成 Object Type / Link Type 草案
- [ ] 3D 星空联动 — Agent 引用实体在星空中高亮
- [ ] @ Mention 自动补全 — 输入 `@` 触发 Ontology 实体搜索
- [ ] 多 LLM 提供商 UI 切换

### 时间线估算

```
Phase 1 ──────── 基础聊天
Phase 2 ────────── 结构化响应
Phase 3 ──────────── 本体可视化
Phase 4 ──────────────── 高级特性
```

---

## 10. 关键设计决策与权衡

### D1: Agent 框架选择 — LangGraph vs 原生实现

**决策**: 选择 LangGraph。

| 维度 | LangGraph | 原生实现 |
|------|-----------|---------|
| 开发速度 | 快（内置状态管理、工具循环） | 慢（需自建） |
| 灵活性 | 高（显式状态图 + 条件边） | 最高 |
| 调试 | 好（LangSmith 集成、可视化） | 需自建 |
| 依赖 | 中（langchain 生态） | 无 |
| 锁定风险 | 中（核心逻辑可迁移） | 无 |

**权衡**: 接受 langchain 生态的依赖换取更快的开发迭代。核心 Tools 只依赖 `@tool` 装饰器，迁移成本低。

### D2: 流式协议 — SSE vs WebSocket

**决策**: 选择 SSE。

| 维度 | SSE | WebSocket |
|------|-----|-----------|
| 复杂度 | 低（HTTP/1.1 内置） | 高（需连接管理） |
| 适用场景 | 服务端→客户端单向流 | 双向实时通信 |
| FastAPI 支持 | 原生 StreamingResponse | 需额外配置 |
| 断线重连 | 浏览器自动重连 | 需手动实现 |
| 并发连接 | 受 HTTP/1.1 限制（每域 6 连接） | 无限制 |

**权衡**: Agent 对话是典型的"请求-流式响应"模式，SSE 足够且更简单。如果后续需要实时协作（多人编辑 Ontology），再引入 WebSocket。

### D3: 实体引用提取 — State Accumulation vs Post-processing

**决策**: 选择 State Accumulation。

**理由**:
- Tool 调用天然返回结构化实体数据，无需额外解析
- 流式友好 — entity_ref 事件可在文本流中穿插发出
- 准确度高 — 不依赖文本匹配/NER 的不确定性

**劣势**: Agent 在不调用 Tool 时（纯基于 L1 上下文推理）无法提取实体引用。
**应对**: assemble 节点增加轻量文本匹配作为兜底（正则匹配已知 apiName）。

### D4: 前端状态管理 — 服务端数据 vs UI 状态

**决策**: 遵循现有架构约定。

- **服务端数据**（对话历史、Agent 响应）→ TanStack Query cache
- **UI 状态**（面板开关、高亮实体、流式消息缓冲）→ Zustand store
- **流式消息**是特殊情况 — 流式进行中存在 Zustand（避免 TanStack Query 频繁更新），流式完成后移入 TanStack Query cache

### D5: 可视化技术 — ReactFlow vs D3.js vs 3D 星空复用

**决策**: ReactFlow 作为主可视化方案，3D 星空作为可选联动。

| 维度 | ReactFlow | D3.js | 3D 星空复用 |
|------|-----------|-------|------------|
| 学习曲线 | 低（React 原生） | 高 | 中（已有代码） |
| 交互性 | 高（拖拽、缩放、事件原生支持） | 需手动实现 | 高但不适合小面板 |
| 适合嵌入 | 好（轻量、可嵌入面板） | 好 | 差（3D 渲染开销大） |
| 关系图表达 | 专为图设计 | 通用 | 偏展示，非精确操作 |

**权衡**: ReactFlow 适合面板内嵌入的轻量关系图。3D 星空保留为可选的沉浸式全屏视图。

### D6: 对话持久化 — 立即持久化 vs 延迟实现

**决策**: Phase 1 使用内存存储，Phase 3 迁移到 PostgreSQL。

**理由**: MVP 优先验证 Agent 能力和交互设计，对话持久化不影响核心价值验证。Phase 3 使用 Alembic 迁移添加 `conversations` 和 `messages` 表。

---

## 附录 A: 数据库扩展（Phase 3）

```sql
-- conversations 表
CREATE TABLE conversations (
    rid TEXT PRIMARY KEY,           -- ri.ontology.conversation.<uuid>
    title TEXT,                      -- 自动从第一条消息生成
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- messages 表
CREATE TABLE messages (
    rid TEXT PRIMARY KEY,           -- ri.ontology.message.<uuid>
    conversation_rid TEXT NOT NULL REFERENCES conversations(rid) ON DELETE CASCADE,
    role TEXT NOT NULL,              -- 'user' | 'assistant'
    content TEXT NOT NULL,           -- 主体文本
    entity_refs JSONB DEFAULT '[]', -- EntityRef 数组
    relationships JSONB DEFAULT '[]', -- Relationship 数组
    sources JSONB DEFAULT '[]',     -- Source 数组
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 按对话和时间排序
    CONSTRAINT messages_conversation_fk FOREIGN KEY (conversation_rid)
        REFERENCES conversations(rid) ON DELETE CASCADE
);

CREATE INDEX idx_messages_conversation ON messages(conversation_rid, created_at);
```

## 附录 B: 环境变量配置

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
