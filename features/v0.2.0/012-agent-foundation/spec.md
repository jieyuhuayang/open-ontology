# F012: Agent Foundation（Agent 基础设施）

> 本文档合并需求规范与技术设计。需求部分描述业务能力，设计部分只写契约和决策（Why + What），不写实现步骤（How）。

**关联 PRD**: `docs/prd/0.2.0/AI 辅助本体构建 PRD.md` — §4.1 模块 A（Agent 引擎与交互）、§6.1（deepagents 集成方案）、§6.2（API 端点）、§6.3（数据库表）、§6.4（LLM 配置）、§6.5（安全约束 L2/L7/L8）
**架构参考**: `docs/architecture/01-system-architecture.md`
**版本契约**: `features/v0.2.0/release-contract.md`
**优先级**: P0
**所属版本**: v0.2.0

---

## 1. 概述与用户故事

F012 是 v0.2.0 的基础设施层，为后续所有 Agent 相关 feature（F013–F019）提供核心引擎能力。本 feature 聚焦三个方面：

1. **deepagents Agent 引擎初始化与配置** — 集成 `deepagents` PyPI 包（v0.4.12+），配置中间件栈（Planning、Skill 加载、虚拟文件系统、上下文压缩）
2. **SSE 流式通信适配层** — 将 LangGraph/deepagents 原生事件转换为 PRD 定义的 SSE 事件格式
3. **Agent 会话/消息/审计持久化** — 3 张数据库表 + PostgresCheckpointer 双写

### US-1 开发者启动 Agent 会话进行本体构建

作为 **开发者**，
我希望 创建一个 Agent 会话并与 Agent 进行流式对话，
以便 通过自然语言与 Agent 交互来构建本体。

### US-2 用户通过 SSE 流式对话与 Agent 交互

作为 **用户**，
我希望 发送消息后实时看到 Agent 的流式回复（逐字输出、规划步骤），
以便 获得低延迟、高交互感的 AI 对话体验。

### US-3 用户查看历史会话并继续对话

作为 **用户**，
我希望 查看历史会话列表、加载完整消息记录、并在已有会话上继续对话，
以便 在中断后恢复工作上下文。

---

## 2. 验收标准

> AC-ID 在本特性内唯一。tasks.md 中的测试任务必须通过 `覆盖 AC: AC-NN` 追溯到此表。

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| **会话管理** | | | |
| AC-01 | 用户 | POST `/api/v1/agent/sessions` 创建会话（含 ontologyRid, domain, goal, scopeHint） | 201，返回 AgentSession（rid 格式 `ri.ontology.agent-session.<12hex>`，status=`active`），会话持久化到 DB |
| AC-02 | 用户 | POST 创建会话时已有一个 status=`active` 的会话 | 409，错误码 `AGENT_SESSION_CONFLICT`，消息 "An active session already exists"（INV-12） |
| AC-03 | 用户 | GET `/api/v1/agent/sessions` 列表查询 | 200，返回分页 AgentSessionList（按 createdAt DESC），含 items + totalCount + page + pageSize |
| AC-04 | 用户 | GET `/api/v1/agent/sessions/{rid}` 获取详情 | 200，返回 AgentSessionDetail：session 对象 + messages 列表（按 createdAt ASC） |
| AC-05 | 用户 | GET 获取不存在的 session rid | 404，错误码 `AGENT_SESSION_NOT_FOUND` |
| AC-06 | 用户 | DELETE `/api/v1/agent/sessions/{rid}` 删除会话 | 204，级联删除关联 messages 和 audit_logs |
| AC-07 | 用户 | DELETE 不存在的 session rid | 404，错误码 `AGENT_SESSION_NOT_FOUND` |
| **SSE 流式对话** | | | |
| AC-08 | 用户 | POST `/api/v1/agent/chat` 发送消息（sessionRid + content） | 返回 SSE stream（Content-Type: `text/event-stream`），流中包含 `text-delta` 事件（data: `{"text": "..."}`） |
| AC-09 | 用户 | POST chat 后 Agent 回复完毕 | 流发送 `done` 事件（data: `{"sessionRid": "...", "summary": "..."}`），然后关闭连接 |
| AC-10 | 用户 | POST chat 时 LLM 调用失败（API key 无效或网络超时） | 流发送 `error` 事件（data: `{"code": "LLM_API_ERROR", "message": "..."}`），然后关闭连接 |
| AC-11 | 用户 | POST chat 时 sessionRid 不存在 | 404，错误码 `AGENT_SESSION_NOT_FOUND`（非 SSE，直接 JSON 错误） |
| AC-12 | 用户 | POST chat 时 session status 非 `active` | 422，错误码 `AGENT_SESSION_NOT_ACTIVE` |
| AC-13 | 用户 | POST chat，Agent 生成规划步骤 | SSE 流包含 `plan-step` 事件（data: `{"step": "...", "index": 0, "total": 3}`） |
| **消息持久化** | | | |
| AC-14 | 系统 | POST chat 后 | 双写：用户消息（role=`user`）和 Agent 完整回复（role=`assistant`）均持久化到 agent_messages 表 |
| AC-15 | 用户 | GET session 详情后发送新消息 | 新消息追加到已有消息历史，Agent 能感知之前的对话上下文 |
| **审计日志** | | | |
| AC-16 | 系统 | 每次 chat 请求 | 自动写入 agent_audit_logs（action=`chat`，details 含 sessionRid、用户消息摘要、token 消耗估算） |
| **Agent 引擎** | | | |
| AC-17 | 系统 | 创建会话并首次 chat | deepagents Agent 使用配置的 LLM model 和 API key 正确初始化，包含 TodoListMiddleware + FilesystemMiddleware + SummarizationToolMiddleware + SkillsMiddleware |
| AC-18 | 系统 | Agent 内部状态 | PostgresCheckpointer 持久化 Agent checkpoint，支持会话恢复（同一 sessionRid 的后续 chat 复用 checkpoint） |
| **LLM 配置** | | | |
| AC-19 | 开发者 | 在 `.env` 中设置 `ANTHROPIC_API_KEY` 和 `LLM_MODEL` | AgentService 使用配置值初始化 LLM client |
| AC-20 | 开发者 | `.env` 未设置 `ANTHROPIC_API_KEY` 时调用 chat | 422，错误码 `LLM_NOT_CONFIGURED`，消息 "LLM API key not configured" |
| **Token 预算** | | | |
| AC-21 | 用户 | 单会话 token 消耗接近配置上限（默认 100K） | SSE 流发送 `error` 事件（code: `TOKEN_BUDGET_EXCEEDED`），Agent 停止响应 |
| **会话状态转换** | | | |
| AC-23 | 用户 | DELETE 一个 active 会话 | 会话 status 变为 `cancelled`，然后删除（级联删除 messages 和 audit_logs） |
| AC-24 | 系统 | Agent 完成回复（done 事件发送后） | 会话 status 保持 `active`（用户可继续对话）；仅用户显式关闭或删除时才变为 completed/cancelled |
| AC-25 | 用户 | POST `/api/v1/agent/sessions/{rid}/complete` 关闭会话 | 200，会话 status 从 `active` 变为 `completed`，此后新会话可创建（INV-12 释放） |
| **安全约束** | | | |
| AC-22 | 用户 | POST chat 消息 content 超过 4096 字符 | 422，错误码 `MESSAGE_TOO_LONG` |

---

## 3. 边界情况与显式排除

### 边界情况

- deepagents Agent 初始化失败（依赖版本不兼容）→ chat 返回 `error` 事件 code=`AGENT_INIT_FAILED`
- PostgresCheckpointer 连接失败 → Agent 降级为 MemorySaver（内存），日志记录 WARNING
- SSE 连接被客户端中断 → 服务端 Agent 继续执行当前 step 直到完成，结果写入 DB，客户端可通过 session 详情获取历史
- Agent 步骤执行超过 50 步（L8 迭代深度控制）→ 发送 `error` 事件 code=`MAX_STEPS_EXCEEDED`
- 并发创建会话 → 数据库层通过查询 + 插入的事务保证 INV-12

### 显式排除（不在 F012 范围内）

| 排除项 | 归属 Feature |
|--------|-------------|
| 文件上传与解析 | F014 |
| 蓝图生成与管理 | F014 |
| `oo` CLI 命令 | F013 |
| SKILL.md 知识内容 | F013 |
| 3D 工坊 UI | F015 |
| 澄清请求 `clarification-req` 事件 | F014 |
| `blueprint-item`、`subgraph-update`、`skill-call`、`confidence-update` 等扩展 SSE 事件 | F014+ |
| SSE 断点续传（`Last-Event-ID`） | F015+ |
| 前端组件 | F015 |

---

## 4. 架构决策

| ID | 决策 | 选项 | 结论 | 理由 |
|----|------|------|------|------|
| AD-01 | Agent 框架选择 | A: deepagents（PyPI v0.4.12+）/ B: 原生 LangGraph / C: 自建 Agent 框架 | **选 A** | deepagents 内置 Planning（TodoListMiddleware）、Skill（SkillsMiddleware）、SubAgent、ContextManagement（FilesystemMiddleware + SummarizationToolMiddleware）中间件栈，PRD 明确指定；原生 LangGraph 需自建中间件；自建框架投入过大 |
| AD-02 | Agent 状态持久化 | A: PostgresCheckpointer + agent_messages 双写 / B: 仅 PostgresCheckpointer / C: 仅 agent_messages | **选 A** | PostgresCheckpointer 保存 Agent 内部图状态（支持恢复推理上下文）；agent_messages 保存用户可见消息历史（支持 UI 展示和 API 查询）；两者用途不同，互不替代 |
| AD-03 | SSE 事件适配 | A: 适配层将 LangGraph astream() 事件映射为 PRD 定义的 SSE 事件 / B: 直接暴露 LangGraph 原始事件 | **选 A** | PRD 定义了明确的 SSE 事件协议（text-delta、plan-step、done、error），下游 feature 和前端依赖稳定契约；LangGraph 原始事件结构可能随版本变化 |
| AD-04 | SkillsMiddleware 集成 | A: F012 集成框架（空 skills 目录），F013 填充 SKILL.md / B: F012 不集成 SkillsMiddleware | **选 A** | F012 初始化 Agent 时配置 SkillsMiddleware 指向空 skills 目录，确保 Agent 引擎从一开始就具备 Skill 加载能力；F013 独立编写 SKILL.md 和 CLI 后 Agent 自动发现 |
| AD-05 | 会话创建 API 设计 | A: 显式 POST /sessions 创建 + POST /chat 发送消息（两步） / B: POST /chat 自动创建会话（一步） | **选 A** | 两步设计：(1) 创建时可指定 domain/goal/scopeHint（Phase 0 引导信息），(2) INV-12 检查在创建时执行更清晰，(3) 前端可先展示空会话再发消息 |
| AD-06 | 用户标识策略 | A: 预留 nullable user_id / B: 不预留 / C: 实现认证系统 | **选 A** | agent_sessions 表预留 nullable user_id 字段，当前不做认证，INV-12 简化为"全局仅 1 个活跃分析会话"；未来接入认证后启用 user_id 约束，无需 schema 迁移 |

---

## 5. 数据库 & Domain 模型

### 5.1 PostgreSQL 表定义

```sql
-- F012: Agent 会话
CREATE TABLE agent_sessions (
    rid          TEXT PRIMARY KEY,                    -- ri.ontology.agent-session.<12hex>
    ontology_rid TEXT NOT NULL REFERENCES ontologies(rid),
    user_id      TEXT,                                -- nullable，预留未来鉴权
    title        TEXT,                                -- 会话标题（自动生成或用户命名）
    domain       TEXT,                                -- 业务领域（电商/金融/供应链等）
    goal         TEXT,                                -- 建模目标
    scope_hint   TEXT,                                -- 概念范围提示
    status       TEXT NOT NULL DEFAULT 'active',      -- active | completed | failed | cancelled
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- F012: Agent 消息
CREATE TABLE agent_messages (
    rid          TEXT PRIMARY KEY,                    -- ri.ontology.agent-message.<12hex>
    session_rid  TEXT NOT NULL REFERENCES agent_sessions(rid) ON DELETE CASCADE,
    role         TEXT NOT NULL,                       -- user | assistant | system
    content      TEXT NOT NULL,
    metadata     JSONB NOT NULL DEFAULT '{}',         -- 附加信息（token 统计等）
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_messages_session ON agent_messages(session_rid, created_at);

-- F012: Agent 审计日志
CREATE TABLE agent_audit_logs (
    rid          TEXT PRIMARY KEY,                    -- ri.ontology.agent-audit.<12hex>
    session_rid  TEXT REFERENCES agent_sessions(rid) ON DELETE SET NULL,
    action       TEXT NOT NULL,                       -- chat | session_create | session_delete
    details      JSONB NOT NULL DEFAULT '{}',         -- 操作详情
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_audit_logs_session ON agent_audit_logs(session_rid, created_at);
```

> **注**：`langgraph-checkpoint-postgres` 包自行管理其 checkpoint 表（`checkpoints`、`checkpoint_writes` 等），在应用启动时调用 `AsyncPostgresSaver.setup()` 自动创建，不通过 Alembic 管理。

### 5.2 Pydantic Domain 模型

```python
# app/domain/agent.py

import enum
from datetime import datetime
from app.domain.common import DomainModel


class SessionStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class MessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


# --- 会话模型 ---

class AgentSession(DomainModel):
    rid: str
    ontology_rid: str
    user_id: str | None = None
    title: str | None = None
    domain: str | None = None
    goal: str | None = None
    scope_hint: str | None = None
    status: SessionStatus = SessionStatus.ACTIVE
    created_at: datetime
    updated_at: datetime


class AgentSessionCreate(DomainModel):
    ontology_rid: str
    title: str | None = None
    domain: str | None = None
    goal: str | None = None
    scope_hint: str | None = None


class AgentSessionList(DomainModel):
    items: list[AgentSession]
    total_count: int
    page: int
    page_size: int


# --- 消息模型 ---

class AgentMessage(DomainModel):
    rid: str
    session_rid: str
    role: MessageRole
    content: str
    metadata: dict = {}
    created_at: datetime


class AgentSessionDetail(DomainModel):
    """Session with full message history."""
    session: AgentSession
    messages: list[AgentMessage]


# --- 审计日志模型 ---

class AgentAuditLog(DomainModel):
    rid: str
    session_rid: str | None = None
    action: str
    details: dict = {}
    created_at: datetime


# --- 请求模型 ---

class ChatRequest(DomainModel):
    session_rid: str
    content: str  # max 4096 chars


# --- SSE 事件数据模型 ---

class TextDeltaEvent(DomainModel):
    text: str


class PlanStepEvent(DomainModel):
    step: str
    index: int
    total: int


class DoneEvent(DomainModel):
    session_rid: str
    summary: str


class ErrorEvent(DomainModel):
    code: str
    message: str
```

---

## 6. API 契约

### 6.1 端点列表

| Method | Path | 描述 | 优先级 |
|--------|------|------|--------|
| POST | `/api/v1/agent/sessions` | 创建会话 | P0 |
| GET | `/api/v1/agent/sessions` | 会话列表（分页） | P0 |
| GET | `/api/v1/agent/sessions/{rid}` | 会话详情（含消息历史） | P0 |
| DELETE | `/api/v1/agent/sessions/{rid}` | 删除会话 | P0 |
| POST | `/api/v1/agent/sessions/{rid}/complete` | 关闭会话（active→completed） | P0 |
| POST | `/api/v1/agent/chat` | SSE 流式对话 | P0 |

### 6.2 请求/响应示例

**POST /api/v1/agent/sessions — 创建会话**

```json
// Request
{
  "ontologyRid": "ri.ontology.ontology.default00",
  "title": "电商平台本体构建",
  "domain": "电商零售",
  "goal": "数据整合与搜索",
  "scopeHint": "聚焦订单履约流程"
}

// Response 201
{
  "rid": "ri.ontology.agent-session.a1b2c3d4e5f6",
  "ontologyRid": "ri.ontology.ontology.default00",
  "userId": null,
  "title": "电商平台本体构建",
  "domain": "电商零售",
  "goal": "数据整合与搜索",
  "scopeHint": "聚焦订单履约流程",
  "status": "active",
  "createdAt": "2026-03-24T10:00:00Z",
  "updatedAt": "2026-03-24T10:00:00Z"
}
```

**GET /api/v1/agent/sessions — 会话列表**

```json
// GET /api/v1/agent/sessions?page=1&pageSize=20
// Response 200
{
  "items": [
    {
      "rid": "ri.ontology.agent-session.a1b2c3d4e5f6",
      "ontologyRid": "ri.ontology.ontology.default00",
      "userId": null,
      "title": "电商平台本体构建",
      "domain": "电商零售",
      "goal": "数据整合与搜索",
      "scopeHint": "聚焦订单履约流程",
      "status": "active",
      "createdAt": "2026-03-24T10:00:00Z",
      "updatedAt": "2026-03-24T10:00:00Z"
    }
  ],
  "totalCount": 1,
  "page": 1,
  "pageSize": 20
}
```

**GET /api/v1/agent/sessions/{rid} — 会话详情**

```json
// Response 200
{
  "session": {
    "rid": "ri.ontology.agent-session.a1b2c3d4e5f6",
    "ontologyRid": "ri.ontology.ontology.default00",
    "userId": null,
    "title": "电商平台本体构建",
    "domain": "电商零售",
    "goal": "数据整合与搜索",
    "scopeHint": "聚焦订单履约流程",
    "status": "active",
    "createdAt": "2026-03-24T10:00:00Z",
    "updatedAt": "2026-03-24T10:00:00Z"
  },
  "messages": [
    {
      "rid": "ri.ontology.agent-message.f1e2d3c4b5a6",
      "sessionRid": "ri.ontology.agent-session.a1b2c3d4e5f6",
      "role": "user",
      "content": "帮我分析这些文件，生成一个电商平台的本体",
      "metadata": {},
      "createdAt": "2026-03-24T10:01:00Z"
    },
    {
      "rid": "ri.ontology.agent-message.a6b5c4d3e2f1",
      "sessionRid": "ri.ontology.agent-session.a1b2c3d4e5f6",
      "role": "assistant",
      "content": "好的，我来分析您的请求...",
      "metadata": {"tokenCount": 150},
      "createdAt": "2026-03-24T10:01:05Z"
    }
  ]
}
```

**DELETE /api/v1/agent/sessions/{rid} — 删除会话**

```
// Response 204 No Content
```

**POST /api/v1/agent/sessions/{rid}/complete — 关闭会话**

```json
// Response 200
{
  "rid": "ri.ontology.agent-session.a1b2c3d4e5f6",
  "status": "completed",
  "updatedAt": "2026-03-24T10:30:00Z"
}
```

**POST /api/v1/agent/chat — SSE 流式对话**

```json
// Request (JSON body, response is SSE stream)
{
  "sessionRid": "ri.ontology.agent-session.a1b2c3d4e5f6",
  "content": "帮我分析这些文件，生成一个电商平台的本体"
}
```

```
// Response: text/event-stream

event: plan-step
data: {"step": "分析用户请求，制定分析计划", "index": 0, "total": 3}

event: text-delta
data: {"text": "好的"}

event: text-delta
data: {"text": "，我来"}

event: text-delta
data: {"text": "分析您的请求..."}

event: plan-step
data: {"step": "理解电商领域背景", "index": 1, "total": 3}

event: text-delta
data: {"text": "基于您提供的电商零售领域信息..."}

event: done
data: {"sessionRid": "ri.ontology.agent-session.a1b2c3d4e5f6", "summary": "已完成初步分析"}
```

### 6.3 错误码表

| HTTP Status | Code | 场景 | 关联 AC |
|-------------|------|------|---------|
| 409 | `AGENT_SESSION_CONFLICT` | 创建会话时已存在 active 会话（INV-12） | AC-02 |
| 404 | `AGENT_SESSION_NOT_FOUND` | session rid 不存在 | AC-05, AC-07, AC-11 |
| 422 | `AGENT_SESSION_NOT_ACTIVE` | 向非 active 状态的会话发送消息或关闭非 active 会话 | AC-12, AC-25 |
| 422 | `LLM_NOT_CONFIGURED` | LLM API key 未配置 | AC-20 |
| 422 | `MESSAGE_TOO_LONG` | 用户消息超过 4096 字符 | AC-22 |
| SSE error | `LLM_API_ERROR` | LLM API 调用失败（网络/认证） | AC-10 |
| SSE error | `TOKEN_BUDGET_EXCEEDED` | 会话 token 消耗超限 | AC-21 |
| SSE error | `AGENT_INIT_FAILED` | deepagents Agent 初始化失败 | 边界 |
| SSE error | `MAX_STEPS_EXCEEDED` | Agent 步骤超过 50 步上限 | 边界 |

---

## 7. Service / Router 层逻辑

### 7.1 AgentService（`app/services/agent_service.py`）

职责：
- **会话管理**：创建（含 INV-12 检查）、查询列表、查询详情（含消息历史）、删除（级联）
- **Agent 引擎编排**：初始化 deepagents Agent（含中间件配置）、调用 `astream()` 获取事件流
- **消息双写**：用户消息和 Agent 完整回复均写入 agent_messages
- **审计日志写入**：每次 chat 交互写入 agent_audit_logs
- **Token 预算跟踪**：累计会话 token 消耗，超限时中断

关键流程 — `chat(session_rid, content)`：
1. 验证 session 存在且 status=`active`
2. 验证 LLM API key 已配置
3. 验证 content 长度 ≤ 4096
4. 持久化 user message（role=`user`）
5. 初始化/恢复 Agent（含 PostgresCheckpointer）
6. 调用 `agent.astream()` 获取事件流
7. SSE 适配器转换事件 → yield SSE events
8. 流结束后持久化 assistant message + audit log

### 7.2 SSE 适配器（`app/agent/sse_adapter.py`）

将 deepagents/LangGraph 的 `astream_events()` 输出映射为 F012 定义的 4 种基础 SSE 事件：

| LangGraph 原始事件 | 映射目标 | 说明 |
|-------------------|----------|------|
| `on_chat_model_stream` | `text-delta` | 文本增量输出 |
| TodoList/Planning 工具输出 | `plan-step` | Agent 规划步骤 |
| 流正常结束 | `done` | 包含 session rid 和摘要 |
| 异常捕获 | `error` | 错误码 + 消息 |

> F014+ 将扩展此适配器以支持 `blueprint-item`、`subgraph-update`、`clarification-req` 等事件。适配器设计为可扩展的事件注册模式。

### 7.3 AgentEngine（`app/agent/engine.py`）

封装 deepagents `create_deep_agent()` 调用：
- 配置 LLM provider 和 model（默认 `claude-sonnet-4-6`）
- 加载中间件栈：TodoListMiddleware, FilesystemMiddleware, SummarizationToolMiddleware, SkillsMiddleware（指向 `app/agent/skills/` 目录）
- 注入 system prompt（ontology builder persona）
- 配置 PostgresCheckpointer 用于状态持久化
- 配置 recursion_limit（对应 L8 迭代深度控制，默认 50）

### 7.4 AgentRouter（`app/routers/agent.py`）

HTTP 解析 + 委托逻辑：
- 会话 CRUD 端点委托给 AgentService（模式参考 `object_types.py`）
- `/chat` 端点返回 `StreamingResponse(media_type="text/event-stream")`，内部调用 AgentService.chat() 的 async generator
- 请求体校验：content 长度 ≤ 4096，rid 格式校验
- 依赖注入：`Depends(get_db_session)` → AgentService

---

## 8. 前端组件设计

F012 为纯后端 feature，**不包含前端组件**。前端集成在 F015（Workshop Foundation）中完成。

---

## 9. 文件清单

| 文件路径 | 操作 | 说明 |
|---------|------|------|
| `apps/server/alembic/versions/xxx_add_agent_tables.py` | 新建 | Alembic 迁移：agent_sessions + agent_messages + agent_audit_logs |
| `apps/server/app/agent/__init__.py` | 新建 | Agent 模块初始化 |
| `apps/server/app/agent/engine.py` | 新建 | deepagents Agent 初始化与配置 |
| `apps/server/app/agent/sse_adapter.py` | 新建 | LangGraph 事件 → SSE 事件适配器 |
| `apps/server/app/agent/skills/.gitkeep` | 新建 | 空 skills 目录占位（F013 填充） |
| `apps/server/app/agent/prompts/ontology_builder.md` | 新建 | 主 Agent system prompt |
| `apps/server/app/config.py` | 修改 | 新增 LLM 配置项（ANTHROPIC_API_KEY, LLM_MODEL 等） |
| `apps/server/app/domain/agent.py` | 新建 | AgentSession/Message/AuditLog + SSE 事件 Pydantic 模型 |
| `apps/server/app/routers/agent.py` | 新建 | Agent REST + SSE 端点 |
| `apps/server/app/services/agent_service.py` | 新建 | 会话管理 + Agent 编排 + 消息持久化 |
| `apps/server/app/storage/models.py` | 修改 | 新增 AgentSession/Message/AuditLog ORM 模型 |
| `apps/server/app/storage/agent_storage.py` | 新建 | Agent 相关 DB 查询（会话/消息/审计） |
| `apps/server/app/main.py` | 修改 | 注册 agent router + checkpoint setup |
| `apps/server/tests/unit/test_agent_service.py` | 新建 | AgentService 单元测试 |
| `apps/server/tests/unit/test_sse_adapter.py` | 新建 | SSE 适配器单元测试 |
| `apps/server/tests/integration/test_agent_api.py` | 新建 | Agent API 集成测试 |

---

## 10. 非功能要求

| 维度 | 要求 |
|------|------|
| **性能** | Agent 首次响应延迟（TTFT）< 2 秒；SSE 事件间隔 < 500ms |
| **安全** | 用户消息长度限制 4096 字符（L2）；Token 预算上限 100K/session，可配置（L7）；迭代深度上限 50 步（L8） |
| **可观测性** | LLM API 调用延迟和成功率日志；每次 chat 的 token 消耗记录到 audit_logs |
| **可用性** | LLM API key 未配置时返回明确错误而非 500；Agent 初始化失败时返回错误事件而非崩溃 |
| **可扩展性** | SSE 事件适配器设计为可扩展模式，F014+ 通过注册新的事件映射规则添加事件类型 |

---

## 相关文档

- 版本契约: `features/v0.2.0/release-contract.md`
- 架构参考: `docs/architecture/01-system-architecture.md`
- Agent 上下文架构: `docs/architecture/03-agent-context-architecture.md`
- deepagents 研究: `docs/research/基于通用 agent 的本体建模/`
- 依赖: v0.1.0 全部完成
- 下游依赖方: F013（CLI/Skills）、F014（Material/Blueprint）、F015（Workshop Foundation）、F018（Agent Sidekick）
