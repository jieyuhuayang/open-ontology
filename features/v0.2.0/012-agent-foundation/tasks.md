# Tasks: Agent Foundation

**关联规格**: [spec.md](./spec.md)
**版本**: v0.2.0

---

## 状态

| 步骤 | 状态 | 备注 |
|------|------|------|
| spec.md | ✅ 已评审 | 25 条 AC，6 个架构决策 |
| tasks.md | 🔲 草稿 | 拆解完成后改为 ✅ 已拆解 |
| 实现 | 🔲 未开始 | 0 / 15 完成 |

---

## 开发模式

**后端 Test-First（测试在前，实现在后）**：后端任务按「测试 → 实现」配对编排，先写测试（红），再写实现（绿）。
基础设施任务（数据库迁移、ORM 模型、配置）无测试配对，单独编号。

**纯后端 Feature**：F012 不含前端组件（前端在 F015）。

**自包含任务**：每个任务内联文件、逻辑、测试上下文，实现阶段不需要回读 spec.md。

---

## Tasks

### 基础设施

- [ ] **T001**: LLM 配置项 + Pydantic Domain 模型
  **文件**: `apps/server/app/config.py`, `apps/server/app/domain/agent.py`
  **逻辑**:
  - `config.py`: 在 Settings 类中新增 LLM 配置项：
    - `ANTHROPIC_API_KEY: str = ""`
    - `OPENAI_API_KEY: str = ""`
    - `LLM_MODEL: str = "claude-sonnet-4-6"`
    - `LLM_MAX_TOKENS: int = 4096`
    - `LLM_TEMPERATURE: float = 0.3`
    - `LLM_TOKEN_BUDGET: int = 100000` （单会话 token 预算上限）
    - `LLM_MAX_STEPS: int = 50` （Agent 步骤上限，L8）
  - `domain/agent.py`: 创建所有 Pydantic 模型：
    - `SessionStatus` enum（active/completed/failed/cancelled）
    - `MessageRole` enum（user/assistant/system）
    - `AgentSession`, `AgentSessionCreate`, `AgentSessionList`
    - `AgentMessage`, `AgentSessionDetail`
    - `AgentAuditLog`
    - `ChatRequest`（含 content max 4096 校验）
    - SSE 事件模型：`TextDeltaEvent`, `PlanStepEvent`, `DoneEvent`, `ErrorEvent`
    - 所有模型继承 `DomainModel`（自动 camelCase alias）
  **依赖**: 无

- [ ] **T002**: Alembic 迁移 + SQLAlchemy ORM 模型
  **文件**: `apps/server/alembic/versions/xxx_add_agent_tables.py`, `apps/server/app/storage/models.py`
  **逻辑**:
  - `storage/models.py`: 新增 3 个 ORM 模型：
    - `AgentSessionModel`（agent_sessions 表）：rid PK, ontology_rid FK→ontologies, nullable user_id, title, domain, goal, scope_hint, status(default='active'), created_at, updated_at。关系：messages(cascade delete), audit_logs
    - `AgentMessageModel`（agent_messages 表）：rid PK, session_rid FK→agent_sessions(CASCADE), role, content, metadata(JSONB), created_at。索引：(session_rid, created_at)
    - `AgentAuditLogModel`（agent_audit_logs 表）：rid PK, session_rid FK→agent_sessions(SET NULL), action, details(JSONB), created_at。索引：(session_rid, created_at)
  - Alembic 迁移：`upgrade()` 创建 3 张表 + 2 个索引；`downgrade()` 按反序删除
  **依赖**: 无

- [ ] **T003**: Storage 层实现
  **文件**: `apps/server/app/storage/agent_storage.py`
  **逻辑**:
  - `AgentStorage` 类，接收 `AsyncSession`
  - 方法：
    - `create_session(model) → AgentSessionModel`
    - `get_session(rid) → AgentSessionModel | None`
    - `list_sessions(page, page_size) → tuple[list[AgentSessionModel], int]`（按 created_at DESC，返回列表+总数）
    - `update_session_status(rid, status) → AgentSessionModel | None`
    - `delete_session(rid) → bool`
    - `count_active_sessions() → int`（用于 INV-12 检查）
    - `create_message(model) → AgentMessageModel`
    - `list_messages_by_session(session_rid) → list[AgentMessageModel]`（按 created_at ASC）
    - `create_audit_log(model) → AgentAuditLogModel`
  - 全部使用 async SQLAlchemy 2.0 API
  **依赖**: T002

### 会话管理 Service

- [ ] **T004**: AgentService 会话 CRUD 单元测试
  **文件**: `apps/server/tests/unit/test_agent_service.py`
  **逻辑**: 通过 `mock_db_session` mock 数据库，测试 AgentService 的会话管理方法：
  - `test_create_session_success` → 创建成功返回 AgentSession
  - `test_create_session_conflict` → 已有 active session 时抛 AppError(AGENT_SESSION_CONFLICT, 409)
  - `test_list_sessions` → 返回分页 AgentSessionList
  - `test_get_session_detail` → 返回 session + messages
  - `test_get_session_not_found` → 抛 AppError(AGENT_SESSION_NOT_FOUND, 404)
  - `test_complete_session_success` → status active→completed
  - `test_complete_session_not_active` → 非 active session 抛 AppError(AGENT_SESSION_NOT_ACTIVE, 422)
  - `test_delete_session_success` → 删除成功
  - `test_delete_session_not_found` → 抛 AppError(AGENT_SESSION_NOT_FOUND, 404)
  **覆盖 AC**: AC-01, AC-02, AC-03, AC-04, AC-05, AC-06, AC-07, AC-23, AC-25
  **依赖**: T001, T003

- [ ] **T005**: AgentService 会话 CRUD 实现
  **文件**: `apps/server/app/services/agent_service.py`
  **逻辑**:
  - `AgentService` 类，接收 `AsyncSession`
  - `create_session(req: AgentSessionCreate) → AgentSession`：
    - 调用 storage.count_active_sessions()，如 > 0 抛 AGENT_SESSION_CONFLICT(409)
    - 生成 rid = generate_rid("ontology", "agent-session")
    - 调用 storage.create_session()
    - 写入 audit_log（action="session_create"）
  - `list_sessions(page, page_size) → AgentSessionList`
  - `get_session_detail(rid) → AgentSessionDetail`：
    - 查询 session + messages，不存在抛 AGENT_SESSION_NOT_FOUND(404)
  - `complete_session(rid) → AgentSession`：
    - 验证 session 存在且 status=active，否则抛对应错误
    - 调用 storage.update_session_status(rid, "completed")
  - `delete_session(rid) → None`：
    - 验证 session 存在，否则抛 AGENT_SESSION_NOT_FOUND(404)
    - 写入 audit_log（action="session_delete", details 含 rid）— **必须在 delete 之前写入**，因为 FK ON DELETE SET NULL
    - 调用 storage.delete_session(rid)（级联删除 messages；audit_logs 的 session_rid 被 SET NULL 保留记录）
  **测试**: T004 全部通过
  **覆盖 AC**: AC-01, AC-02, AC-03, AC-04, AC-05, AC-06, AC-07, AC-23, AC-25
  **依赖**: T001, T003

### 会话管理 Router

- [ ] **T006**: Agent Router 会话 CRUD 集成测试
  **文件**: `apps/server/tests/integration/test_agent_api.py`
  **逻辑**: 使用 `seeded_client`（或 `async_client` + 真实 DB），测试 HTTP 端点：
  - `test_create_session_201` → POST /api/v1/agent/sessions 返回 201 + AgentSession JSON（camelCase 字段）
  - `test_create_session_409_conflict` → 已有 active session 时返回 409 + AGENT_SESSION_CONFLICT 错误
  - `test_list_sessions_200` → GET /api/v1/agent/sessions 返回分页列表
  - `test_get_session_detail_200` → GET /api/v1/agent/sessions/{rid} 返回 session + messages
  - `test_get_session_404` → 不存在的 rid 返回 404
  - `test_complete_session_200` → POST /api/v1/agent/sessions/{rid}/complete 返回 200
  - `test_delete_session_204` → DELETE /api/v1/agent/sessions/{rid} 返回 204
  - `test_delete_session_404` → 不存在的 rid 返回 404
  **覆盖 AC**: AC-01, AC-02, AC-03, AC-04, AC-05, AC-06, AC-07, AC-23, AC-25
  **依赖**: T005

- [ ] **T007**: Agent Router 会话 CRUD 实现 + main.py 注册
  **文件**: `apps/server/app/routers/agent.py`, `apps/server/app/main.py`
  **逻辑**:
  - `agent.py`：`router = APIRouter(prefix="/api/v1/agent", tags=["agent"])`
    - `_get_service()`: Depends(get_db_session) → AgentService
    - `POST /sessions` → 201, response_model=AgentSession
    - `GET /sessions` → 200, response_model=AgentSessionList, 分页参数 page + pageSize
    - `GET /sessions/{rid}` → 200, response_model=AgentSessionDetail
    - `POST /sessions/{rid}/complete` → 200, response_model=AgentSession
    - `DELETE /sessions/{rid}` → 204, Response(status_code=204)
  - `main.py`：`app.include_router(agent.router)`
  **测试**: T006 全部通过
  **覆盖 AC**: AC-01, AC-02, AC-03, AC-04, AC-05, AC-06, AC-07, AC-23, AC-25
  **依赖**: T005

### Agent 引擎

- [ ] **T008**: AgentEngine 单元测试
  **文件**: `apps/server/tests/unit/test_agent_engine.py`
  **逻辑**: mock deepagents 的 `create_deep_agent`，测试 AgentEngine 的初始化和配置：
  - `test_create_agent_with_anthropic_key` → 使用 Anthropic API key 正确初始化
  - `test_create_agent_with_middleware` → 包含 TodoListMiddleware + FilesystemMiddleware + SummarizationToolMiddleware + SkillsMiddleware
  - `test_create_agent_with_checkpointer` → 配置 PostgresCheckpointer
  - `test_create_agent_no_api_key` → 未配置 API key 时抛 AppError(LLM_NOT_CONFIGURED, 422)
  - `test_create_agent_skills_path` → skills 参数指向 app/agent/skills/ 目录
  - `test_agent_recursion_limit` → recursion_limit 等于 settings.LLM_MAX_STEPS
  **覆盖 AC**: AC-17, AC-18, AC-19, AC-20
  **依赖**: T001

- [ ] **T009**: AgentEngine 实现
  **文件**: `apps/server/app/agent/__init__.py`, `apps/server/app/agent/engine.py`, `apps/server/app/agent/skills/.gitkeep`, `apps/server/app/agent/prompts/ontology_builder.md`
  **逻辑**:
  - `engine.py`：`AgentEngine` 类
    - `__init__(settings: Settings)`: 存储配置
    - `create_agent(session_rid: str, system_prompt: str | None = None) → CompiledStateGraph`：
      - 验证 ANTHROPIC_API_KEY 非空，否则抛 LLM_NOT_CONFIGURED
      - 调用 `create_deep_agent(model=settings.LLM_MODEL, system_prompt=..., skills=[skills_dir], checkpointer=checkpointer, ...)`
      - 配置 recursion_limit=settings.LLM_MAX_STEPS
    - `get_checkpointer() → AsyncPostgresSaver`：创建/复用 PostgresCheckpointer 实例
  - `prompts/ontology_builder.md`：基础 system prompt（本体构建 Agent 角色定义）
  - `skills/.gitkeep`：空目录占位
  - `main.py`：在 lifespan 中调用 `AsyncPostgresSaver.setup()` 初始化 checkpoint 表（checkpoint setup 必须在应用启动时完成）
  **测试**: T008 全部通过
  **覆盖 AC**: AC-17, AC-18, AC-19, AC-20
  **依赖**: T001

### SSE 适配器

- [ ] **T010**: SSE 适配器单元测试
  **文件**: `apps/server/tests/unit/test_sse_adapter.py`
  **逻辑**: 测试 LangGraph 事件到 PRD SSE 事件的映射：
  - `test_map_chat_model_stream_to_text_delta` → `on_chat_model_stream` 事件映射为 `text-delta` SSE 事件
  - `test_map_planning_tool_to_plan_step` → TodoList/write_todos 工具输出映射为 `plan-step` SSE 事件
  - `test_map_stream_end_to_done` → 流结束映射为 `done` SSE 事件（含 sessionRid + summary）
  - `test_map_exception_to_error` → 异常映射为 `error` SSE 事件（含 code + message）
  - `test_format_sse_event` → 验证 SSE 格式正确（`event: xxx\ndata: {...}\n\n`）
  **覆盖 AC**: AC-08, AC-09, AC-10, AC-13
  **依赖**: T001

- [ ] **T011**: SSE 适配器实现
  **文件**: `apps/server/app/agent/sse_adapter.py`
  **逻辑**:
  - `format_sse_event(event_type: str, data: dict) → str`：格式化为 `event: {type}\ndata: {json}\n\n`
  - `async def adapt_stream(astream, session_rid: str) → AsyncGenerator[str, None]`：
    - 遍历 `astream_events()` 输出
    - `on_chat_model_stream` → yield `text-delta` 事件
    - 识别 `write_todos` 工具调用 → yield `plan-step` 事件
    - 流正常结束 → yield `done` 事件
    - 捕获异常 → yield `error` 事件
  - 设计为可扩展：事件映射通过注册表模式，F014+ 可添加新映射
  **测试**: T010 全部通过
  **覆盖 AC**: AC-08, AC-09, AC-10, AC-13
  **依赖**: T001

### Chat 流式对话

- [ ] **T012**: AgentService chat 单元测试
  **文件**: `apps/server/tests/unit/test_agent_service.py`（追加到 T004 创建的文件）
  **逻辑**: mock AgentEngine 和 SSE adapter，测试 chat 方法：
  - `test_chat_success_yields_sse_events` → 返回 SSE 事件 async generator
  - `test_chat_session_not_found` → 抛 AppError(AGENT_SESSION_NOT_FOUND, 404)
  - `test_chat_session_not_active` → 抛 AppError(AGENT_SESSION_NOT_ACTIVE, 422)
  - `test_chat_llm_not_configured` → 抛 AppError(LLM_NOT_CONFIGURED, 422)
  - `test_chat_message_too_long` → content > 4096 时抛 AppError(MESSAGE_TOO_LONG, 422)
  - `test_chat_persists_user_message` → 验证 user message 写入 agent_messages
  - `test_chat_persists_assistant_message` → 验证流结束后 assistant message 写入 agent_messages
  - `test_chat_creates_audit_log` → 验证 audit_log 写入（action="chat"）
  - `test_chat_context_continuity` → 多轮对话时 Agent 感知历史消息
  - `test_chat_session_stays_active_after_done` → done 事件后 session status 仍为 active
  - `test_chat_token_budget_exceeded` → token 超限时产生 error 事件
  **覆盖 AC**: AC-08, AC-09, AC-10, AC-11, AC-12, AC-14, AC-15, AC-16, AC-20, AC-21, AC-22, AC-24
  **依赖**: T005, T009, T011

- [ ] **T013**: AgentService chat 实现
  **文件**: `apps/server/app/services/agent_service.py`（追加到 T005 创建的文件）
  **逻辑**:
  - `async def chat(session_rid: str, content: str) → AsyncGenerator[str, None]`：
    1. 验证 content 长度 ≤ 4096，否则抛 MESSAGE_TOO_LONG
    2. 查询 session，不存在抛 AGENT_SESSION_NOT_FOUND；非 active 抛 AGENT_SESSION_NOT_ACTIVE
    3. 验证 LLM 配置
    4. 持久化 user message（role="user"）
    5. 通过 AgentEngine 创建/恢复 Agent（session_rid 作为 thread_id）
    6. 构建包含 domain/goal/scope_hint 的 system prompt
    7. 调用 agent.astream()，通过 sse_adapter.adapt_stream() 转换
    8. 累积 assistant 文本片段
    9. yield 每个 SSE 事件
    10. 流结束后：持久化 assistant message + 创建 audit_log
  **测试**: T012 全部通过
  **覆盖 AC**: AC-08, AC-09, AC-10, AC-11, AC-12, AC-14, AC-15, AC-16, AC-20, AC-21, AC-22, AC-24
  **依赖**: T005, T009, T011

- [ ] **T014**: Chat 端点集成测试
  **文件**: `apps/server/tests/integration/test_agent_api.py`（追加到 T006 创建的文件）
  **逻辑**:
  - `test_chat_sse_stream` → POST /api/v1/agent/chat 返回 text/event-stream，包含 text-delta + done 事件
  - `test_chat_session_not_found_404` → sessionRid 不存在返回 404 JSON 错误
  - `test_chat_session_not_active_422` → session 非 active 返回 422 JSON 错误
  - `test_chat_message_too_long_422` → content > 4096 返回 422 JSON 错误
  - `test_chat_persists_messages` → chat 后 GET session 详情包含 user + assistant 消息
  **覆盖 AC**: AC-08, AC-09, AC-11, AC-12, AC-14, AC-22
  **依赖**: T013, T007

- [ ] **T015**: Chat 端点实现
  **文件**: `apps/server/app/routers/agent.py`（追加到 T007 创建的文件）
  **逻辑**:
  - `POST /chat` 端点：
    - 接收 ChatRequest body（sessionRid + content）
    - 前置校验（session 存在、active、LLM 配置）在 service 层完成，若抛 AppError 则返回 JSON 错误
    - 成功时返回 `StreamingResponse(service.chat(session_rid, content), media_type="text/event-stream")`
    - 设置 response headers：`Cache-Control: no-cache`, `X-Accel-Buffering: no`
  **测试**: T014 全部通过
  **覆盖 AC**: AC-08, AC-09, AC-11, AC-12, AC-14, AC-22
  **依赖**: T013, T007

---

## 实际偏差记录

> 完成后，在此记录实现与 spec.md 的偏差，供后续参考。

- （待填写）
