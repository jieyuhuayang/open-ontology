# 03 - Agent Context Architecture / Agent 上下文架构

## Why This Matters

Open Ontology 的核心差异化定位是"为 Agent 时代设计的 Ontology"。这意味着 Ontology 不仅是给人看的 UI 界面背后的数据模型，更是 AI Agent 理解和操作业务世界的**语义基础设施**。

本文档设计 Agent 如何消费 Ontology 上下文，回答一个根本问题：

> **Ontology 向 Agent 提供怎样的上下文，以怎样的形式？**

## The Agent Context Problem

```
Agent 面临的困境:

┌─────────────┐
│  LLM Agent  │ ← "哪些客户的订单延迟超过 5 天？"
│             │
│  我需要知道: │
│  1. 有哪些对象类型？(Customer? Order? Delivery?)
│  2. 它们有什么属性？(delivery_date? status?)
│  3. 它们之间什么关系？(Customer → places → Order?)
│  4. 我能执行什么操作？(escalate? cancel?)
│  5. 我有权限看什么？
└─────────────┘

Without Ontology: Agent 需要猜测 SQL 表名、列名、关系… 容易出错
With Ontology:    Agent 获得结构化的语义模型，精确操作
```

## Three-Interface Strategy（三接口策略）

Open Ontology 通过三种互补的接口将 Ontology 暴露给 Agent：

```
┌──────────────────────────────────────────────────────────────┐
│                    AI Agent / LLM                            │
└─────┬───────────────────┬────────────────────┬───────────────┘
      │                   │                    │
      ▼                   ▼                    ▼
┌───────────┐     ┌──────────────┐     ┌──────────────────┐
│ Interface │     │  Interface   │     │   Interface      │
│    ①      │     │     ②       │     │      ③          │
│           │     │              │     │                  │
│ MCP Server│     │ Schema-as-  │     │ Ontology         │
│ (dynamic  │     │ Context     │     │ Filesystem       │
│  tool use)│     │ (prompt     │     │ (browsable       │
│           │     │  injection) │     │  hierarchy)      │
└───────────┘     └──────────────┘     └──────────────────┘
     │                   │                    │
     └───────────────────┴────────────────────┘
                         │
              ┌──────────┴──────────┐
              │   Ontology Core     │
              │   (Domain Model)    │
              └─────────────────────┘
```

### Interface ①: MCP Server（Model Context Protocol 服务器）

MCP 是 Anthropic 提出的开放标准，正在成为 Agent 与外部系统通信的主要协议。将 Ontology 实现为 MCP Server 是最具前瞻性的选择。

**Resources（只读上下文数据）:**

```
ontology://schema                         → 完整 Schema 概览
ontology://object-types                   → 所有对象类型列表
ontology://object-types/{id}              → 单个对象类型完整定义
ontology://object-types/{id}/properties   → 对象类型的所有属性
ontology://link-types                     → 所有链接类型列表
ontology://link-types/{id}                → 单个链接类型定义
ontology://search/{query}                 → 搜索结果（Resource Template）
```

**Tools（Agent 可执行的操作）:**

| Tool | Description | Parameters |
|------|-------------|------------|
| `search_ontology` | 搜索 Ontology 中的资源 | `query`, `resourceType?`, `status?` |
| `get_object_type` | 获取对象类型完整定义 | `id` |
| `list_properties` | 列出对象类型的所有属性 | `objectTypeId` |
| `get_linked_types` | 获取与某对象类型关联的所有链接类型 | `objectTypeId` |
| `traverse_link` | 从一个对象类型沿链接导航到另一个 | `fromObjectTypeId`, `linkTypeId` |
| `describe_relationship` | 用自然语言描述两个对象类型之间的关系 | `objectTypeIdA`, `objectTypeIdB` |
| `validate_schema` | 校验当前 Ontology Schema 的一致性 | — |
| `export_schema` | 导出 Ontology Schema 为 JSON | `format?` |

**Prompts（交互模板）:**

| Prompt | Description |
|--------|-------------|
| `explore-ontology` | 引导 Agent 探索当前 Ontology 的结构 |
| `design-object-type` | 引导 Agent 设计一个新的对象类型 |
| `analyze-relationships` | 分析并解释对象类型之间的关系网络 |

**MCP Server 的关键优势:**

1. **动态发现**: Agent 调用 `resources/list` 和 `tools/list` 自动了解 Ontology 能力
2. **变更通知**: Ontology 变更时，推送 `notifications/resources/list_changed`
3. **多客户端**: 多个 Agent 同时连接同一个 Ontology MCP Server
4. **生态兼容**: Claude Code, VS Code Copilot, LangChain 等都在支持 MCP

### Interface ②: Schema-as-Context（Schema 注入上下文）

将 Ontology Schema 的紧凑表示直接注入 Agent 的 system prompt，使 Agent 在不调用任何工具的情况下就理解数据模型。

**分层信息模型（借鉴 OpenViking 的 L0/L1/L2）:**

```
L0 — Abstract (~100 tokens)
    "企业本体包含 12 个对象类型、8 个链接类型，
     覆盖客户管理、订单处理、供应链三个业务域。"

L1 — Overview (~2K tokens)
    Object Types:
    - Customer: 客户实体 [properties: name, email, region, tier]
    - Order: 订单 [properties: order_id, status, amount, created_at]
    - Product: 产品 [properties: sku, name, price, category]
    Links:
    - Customer → places → Order (1:N)
    - Order → contains → Product (N:N)

L2 — Detail (按需加载)
    Customer 的完整定义:
    {
      "id": "customer",
      "apiName": "Customer",
      "properties": [
        { "id": "name", "baseType": "string", "isPrimaryKey": false, ... },
        ...
      ],
      ...
    }
```

**Token Budget 管理策略:**

| 场景 | 注入内容 | 预估 Tokens |
|------|---------|-------------|
| 小型 Ontology (≤10 类型) | L1 完整 + 关键 L2 | ~2K-5K |
| 中型 Ontology (10-50 类型) | L0 + L1 概要 + 按需 L2 | ~1K + 按需 |
| 大型 Ontology (50+ 类型) | L0 + 搜索工具 + 按需 L2 | ~200 + 按需 |

**自动生成 L0/L1 摘要:**

Ontology Service 应该自动从 Schema 元数据生成 L0/L1 摘要：

```python
def generate_l0(ontology):
    """~100 tokens: 一句话概括"""
    obj_count = len(ontology.object_types)
    link_count = len(ontology.link_types)
    domains = extract_domains(ontology)  # 从分组/描述中提取业务域
    return f"企业本体包含 {obj_count} 个对象类型、{link_count} 个链接类型，" \
           f"覆盖{', '.join(domains)}等业务域。"

def generate_l1(ontology):
    """~2K tokens: 结构化概览"""
    lines = ["Object Types:"]
    for ot in ontology.object_types:
        props = [p.id for p in ot.properties[:5]]  # 只列前 5 个属性
        lines.append(f"- {ot.displayName}: {ot.description} "
                     f"[properties: {', '.join(props)}]")
    lines.append("\nLink Types:")
    for lt in ontology.link_types:
        lines.append(f"- {lt.sideA.objectType} → {lt.displayName} → "
                     f"{lt.sideB.objectType} ({lt.cardinality})")
    return "\n".join(lines)
```

### Interface ③: Ontology Filesystem（本体文件系统）

借鉴 OpenViking 的 Context Database 理念，将 Ontology 映射为虚拟文件系统，使 Agent 能用文件系统操作（ls, read, grep, find）浏览 Ontology。

**目录结构映射:**

```
ontology://
├── .abstract.md                    # L0: 本体概述 (~100 tokens)
├── .overview.md                    # L1: 结构化概览 (~2K tokens)
├── object-types/
│   ├── .overview.md                # 所有对象类型概要列表
│   ├── customer/
│   │   ├── .abstract.md            # "Customer: B2B/B2C 客户实体"
│   │   ├── .overview.md            # 属性摘要、关键链接、约束
│   │   ├── properties.json         # L2: 完整属性定义
│   │   ├── links.md                # L2: 涉及的所有链接类型
│   │   └── schema.json             # L2: 完整的 ObjectType JSON
│   ├── order/
│   │   └── ...
│   └── product/
│       └── ...
├── link-types/
│   ├── .overview.md                # 所有链接类型概要
│   ├── customer-places-order/
│   │   ├── .abstract.md
│   │   ├── .overview.md            # 源/目标类型、基数、约束
│   │   └── schema.json             # L2: 完整定义
│   └── ...
├── action-types/                   # 后续版本
│   └── ...
└── graph.md                        # 以 Mermaid 图描述的关系图
```

**为什么文件系统是好的 Agent 接口:**

1. **层次结构匹配 Ontology 结构**: Ontology 天然是层次化的（Space → Object Types → Properties）
2. **L0/L1/L2 解决"Ontology 太大放不进 prompt"的问题**: Agent 先读 L0 找到相关类型，再读 L1 理解结构，最后按需加载 L2
3. **确定性路径**: Agent 知道要什么时，直接导航到 `ontology://object-types/customer/properties.json`
4. **语义搜索兜底**: 不知道路径时，`find("哪个实体跟踪收入?", target="ontology://")` 进行语义搜索
5. **与 OpenViking 兼容**: 可以注册为 OpenViking 的 resource，接入其 L0/L1/L2 + 检索体系

**局限性与应对:**

| 局限 | 应对策略 |
|------|---------|
| 文件系统是树，Ontology 是图 | 在 `graph.md` 和 `links.md` 中补充图关系 |
| 无事务性写入 | 写操作走 MCP Tools，不走文件系统 |
| 无类型约束 | 文件系统是只读视图，写操作通过 Domain Layer 校验 |

## Agent Interaction Patterns

### Pattern A: Discovery-First（先发现后操作）

```
Agent receives: "分析客户订单延迟情况"

Step 1: Agent reads L1 overview → 发现 Customer, Order, Delivery 三个类型
Step 2: Agent calls get_linked_types("customer") → 发现 Customer→Order 链接
Step 3: Agent calls get_object_type("order") → 获取 Order 的完整属性列表
Step 4: Agent finds "delivery_date", "status" properties
Step 5: Agent formulates structured query based on ontology knowledge
```

### Pattern B: Schema-Grounded Reasoning（基于 Schema 的推理）

```
System Prompt 包含 L1 概览:
  "Object Types: Customer [name, region, tier], Order [order_id, status, amount]
   Links: Customer → places → Order (1:N)"

User: "各地区的高价值客户有多少延迟订单？"

Agent 推理:
  1. "地区" → Customer.region
  2. "高价值客户" → Customer.tier = "premium" (或需要确认)
  3. "延迟订单" → Order.status = "delayed"
  4. "关联" → Customer → places → Order 链接
  → 生成精确的查询
```

### Pattern C: Multi-Agent Ontology Sharing（多 Agent 共享 Ontology）

```
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│ Data Analyst   │  │ Business Rule  │  │ Integration    │
│ Agent          │  │ Agent          │  │ Agent          │
│                │  │                │  │                │
│ reads: L2 of   │  │ reads: Action  │  │ reads: Data    │
│ Customer,Order │  │ Types, Rules   │  │ Sources, APIs  │
└───────┬────────┘  └───────┬────────┘  └───────┬────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                   ┌────────┴────────┐
                   │  Ontology MCP   │
                   │  Server         │
                   │  (shared truth) │
                   └─────────────────┘
```

## Security for Agents

Agent 安全模型的核心原则：**Agent 继承调用用户的安全上下文**。

```
User (with roles & markings)
    │
    ├── Agent sees: only ObjectTypes/Properties the user can see
    ├── Agent can: only execute Actions the user is permitted to
    └── Agent cannot: bypass Markings or Organization boundaries
```

实现方式:
1. MCP Server 连接时携带用户凭证
2. 每个 Resource 读取和 Tool 调用都经过 Security Service 鉴权
3. Agent 的操作记录在审计日志中，标记为"via Agent"

## Implementation Roadmap

```
MVP (v0.1.0):
  ✅ REST API — 基础的 Ontology CRUD
  ✅ JSON Export — 可供外部工具消费的 Schema 导出
  ⬜ Schema-as-Context — L1 概览的自动生成接口

v0.2.0:
  ⬜ MCP Server — Resources + Tools
  ⬜ L0/L1/L2 分层信息模型
  ⬜ 基于 MCP 的 Agent 安全上下文传递

v0.3.0:
  ⬜ Ontology Filesystem — OpenViking 适配层
  ⬜ 语义搜索（向量索引）
  ⬜ OSDK 代码生成
  ⬜ Multi-Agent 场景的实时变更通知
```

## Palantir Lessons Applied

| Palantir Pattern | Open Ontology Adaptation |
|---|---|
| AIP Logic: Ontology 作为 Agent 的 "API Surface" | MCP Server 的 Resources + Tools 就是这个 API Surface |
| AIP Logic: 显式限定 Agent 可访问的 Ontology 范围 | MCP Server 支持 scope 参数，限定 Agent 可见的 Object Types |
| OSDK: 类型安全的编程接口 | L2 JSON Schema 可以驱动代码生成 |
| Ontology 描述文本不仅给人看 | displayName + description 是 Agent 理解语义的关键输入 |
| Action 作为唯一写入路径 | Agent 只能通过 MCP Tools 中的 Action 工具修改数据 |

## OpenViking Lessons Applied

| OpenViking Pattern | Open Ontology Adaptation |
|---|---|
| `viking://` URI 协议 + 虚拟文件系统 | `ontology://` URI 映射 Ontology 资源为可浏览层次结构 |
| L0/L1/L2 三层信息模型 | 自动从 Ontology 元数据生成分层摘要，管理 token 预算 |
| 确定性导航 + 语义搜索混合 | 已知路径直接 read，未知路径用 find/grep 语义搜索 |
| 目录递归检索（先锁定目录，再深入） | 搜索先定位到 ObjectType 目录，再深入到 properties |
| Session 结束后记忆提取 | Agent 使用过的 Ontology 元素可被记录，优化后续上下文 |
