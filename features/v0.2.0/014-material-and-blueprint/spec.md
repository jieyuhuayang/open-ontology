# F014: Material and Blueprint（素材与蓝图）

> 本文档合并需求规范与技术设计。需求部分描述业务能力，设计部分只写契约和决策（Why + What），不写实现步骤（How）。

**关联 PRD**: `docs/prd/0.2.0/AI 辅助本体构建 PRD.md` — §3.3（本体蓝图）、§3.4（HITL 三级操作）、§3.5（置信度与推理溯源）、§4.2（模块 B：资料分析与蓝图生成）、§4.4（模块 D：HITL 蓝图审查 — apply 部分）、§6.2（API 端点）、§6.3（数据库表）
**架构参考**: `docs/architecture/01-system-architecture.md`
**版本契约**: `features/v0.2.0/release-contract.md`
**优先级**: P0
**所属版本**: v0.2.0

---

## 1. 概述与用户故事

F014 是 v0.2.0 的核心数据层，负责三个新领域对象（AgentMaterial、Blueprint、BlueprintItem）的完整生命周期管理，以及蓝图应用（apply）逻辑。本 feature 是纯后端实现，为 F015/F017 前端和 F012 Agent 引擎提供 API 支撑。

F014 还包含文件解析器模块（parsers），作为 deepagents 可调用的 skill，提供结构化和非结构化文件的程序化解析能力。

### US-1 用户上传资料文件

作为 **用户**，
我希望 上传 CSV、Excel、SQL DDL、PDF 等资料文件到 Agent 会话中，
以便 Agent 能够分析这些资料并生成本体蓝图。

### US-2 Agent 创建蓝图与蓝图项

作为 **Agent**，
我希望 在分析资料后创建蓝图和蓝图项（每个建议携带置信度和推理来源），
以便 将分析结果结构化持久化供用户审查。

### US-3 用户审查蓝图项

作为 **用户**，
我希望 对蓝图中的每个建议项执行接受/编辑/拒绝操作，
以便 精确控制哪些建议最终被应用到本体中。

### US-4 用户应用蓝图

作为 **用户**，
我希望 一键将审查通过的蓝图项批量创建为 WorkingState 中的草稿本体实体，
以便 快速完成本体构建（从数天缩短到数分钟）。

### US-5 开发者使用 CLI 管理蓝图

作为 **开发者**，
我希望 通过 `oo blueprint` 和 `oo material` CLI 命令管理蓝图和素材，
以便 在 CI/CD 流程和 Agent 自动化中使用。

### US-6 Agent 解析上传文件

作为 **Agent**，
我希望 调用文件解析 skill 提取文件的结构化信息（列名、类型、表定义等），
以便 基于精确的结构信息生成高置信度的蓝图项。

---

## 2. 验收标准

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| **素材上传** | | | |
| AC-01 | 用户 | POST `/api/v1/agent/materials/upload` 上传 CSV 文件（multipart/form-data，含 sessionRid） | 201，返回 AgentMaterial（rid 格式 `ri.ontology.agent-material.<12hex>`，analysisStatus=`pending`），文件写入本地磁盘 |
| AC-02 | 用户 | 上传文件大小超过 10MB | 400，错误码 `MATERIAL_FILE_TOO_LARGE`，消息包含文件大小限制（INV-13） |
| AC-03 | 用户 | 上传不支持的文件类型（如 .exe） | 400，错误码 `MATERIAL_INVALID_FILE_TYPE`，消息包含支持的格式列表 |
| AC-04 | 用户 | 会话已有 20 个文件时再上传 | 400，错误码 `MATERIAL_SESSION_LIMIT_EXCEEDED`（INV-13） |
| AC-05 | 用户 | 上传文件时 sessionRid 不存在 | 404，错误码 `AGENT_SESSION_NOT_FOUND` |
| AC-06 | 用户 | 上传文件时 session 状态非 active | 422，错误码 `AGENT_SESSION_NOT_ACTIVE` |
| **素材查询与删除** | | | |
| AC-07 | 用户 | GET `/api/v1/agent/materials/{rid}` | 200，返回 AgentMaterial 详情（含 fileName, fileType, fileSize, analysisStatus, analysisResult） |
| AC-08 | 用户 | GET `/api/v1/agent/materials?sessionRid=xxx` | 200，返回该会话下所有素材列表 |
| AC-09 | 用户 | DELETE `/api/v1/agent/materials/{rid}` | 204，删除 DB 记录并删除本地磁盘文件 |
| AC-10 | 用户 | DELETE 不存在的素材 rid | 404，错误码 `MATERIAL_NOT_FOUND` |
| **蓝图 CRUD** | | | |
| AC-11 | Agent | POST `/api/v1/blueprints` 创建蓝图（sessionRid, ontologyRid, name） | 201，返回 Blueprint（rid 格式 `ri.ontology.blueprint.<12hex>`，status=`draft`） |
| AC-12 | Agent | POST 创建蓝图时 sessionRid 不存在 | 404，错误码 `AGENT_SESSION_NOT_FOUND` |
| AC-13 | 用户 | GET `/api/v1/blueprints` 列表查询（支持 sessionRid / ontologyRid 过滤） | 200，返回分页 BlueprintList（按 createdAt DESC） |
| AC-14 | 用户 | GET `/api/v1/blueprints/{rid}` | 200，返回 BlueprintDetail（蓝图信息 + 所有蓝图项列表） |
| AC-15 | 用户 | GET 不存在的蓝图 rid | 404，错误码 `BLUEPRINT_NOT_FOUND` |
| **蓝图状态转换** | | | |
| AC-16 | Agent | PATCH `/api/v1/blueprints/{rid}` 将 status 从 draft 改为 pending_review | 200，状态更新成功 |
| AC-17 | 用户 | PATCH 将 status 从 pending_review 改为 discarded | 200，状态更新成功 |
| AC-18 | 用户 | PATCH 将 status 从 applied 改为任何值 | 422，错误码 `BLUEPRINT_INVALID_STATUS_TRANSITION`（终态不可变） |
| AC-19 | 用户 | PATCH 将 status 从 discarded 改为任何值 | 422，错误码 `BLUEPRINT_INVALID_STATUS_TRANSITION`（终态不可变） |
| AC-20 | 用户 | PATCH 将 status 从 draft 直接改为 applied | 422，错误码 `BLUEPRINT_INVALID_STATUS_TRANSITION`（必须先到 pending_review） |
| **蓝图项 CRUD** | | | |
| AC-21 | Agent | POST `/api/v1/blueprints/{rid}/items` 创建蓝图项（含 itemType, suggestion, confidence, source） | 201，返回 BlueprintItem（confidence_level 自动计算：≥0.8=high, 0.5-0.8=medium, <0.5=low） |
| AC-22 | Agent | POST 蓝图项时 confidence 不在 0.0-1.0 范围 | 400，错误码 `BLUEPRINT_ITEM_INVALID_CONFIDENCE`（INV-16） |
| AC-23 | Agent | POST 蓝图项时 source 为空 | 400，错误码 `BLUEPRINT_ITEM_MISSING_SOURCE`（INV-16） |
| AC-24 | 用户 | GET `/api/v1/blueprints/{rid}/items` | 200，返回蓝图项列表（按 sort_order ASC） |
| AC-25 | Agent | POST 批量创建蓝图项（数组） | 201，返回创建的蓝图项列表，每项都通过 INV-16 校验 |
| **蓝图项审查决策** | | | |
| AC-26 | 用户 | PATCH `/api/v1/blueprints/{rid}/items/{itemRid}` 设置 userDecision=accepted | 200，决策保存成功 |
| AC-27 | 用户 | PATCH 设置 userDecision=edited + userEdits 对象 | 200，决策和编辑内容保存成功 |
| AC-28 | 用户 | PATCH 设置 userDecision=rejected + rejectionReason | 200，决策和拒绝理由保存成功 |
| AC-29 | 用户 | PATCH 已有 userDecision=accepted 的项改为 rejected | 422，错误码 `BLUEPRINT_ITEM_DECISION_IMMUTABLE`（INV-11，决策不可逆） |
| AC-30 | 用户 | PATCH 蓝图项时蓝图状态非 pending_review | 422，错误码 `BLUEPRINT_INVALID_STATUS_TRANSITION` |
| AC-31 | 用户 | PATCH 不存在的蓝图项 | 404，错误码 `BLUEPRINT_ITEM_NOT_FOUND` |
| **蓝图应用** | | | |
| AC-32 | 用户 | POST `/api/v1/blueprints/{rid}/apply` 应用蓝图（status=pending_review，有 accepted 项） | 200，返回 BlueprintApplyResult（总数/成功/失败/跳过 + 每项结果），蓝图状态变为 applied |
| AC-33 | 用户 | Apply 时按 ObjectType → Property → LinkType 依赖顺序创建 | 对象类型先创建，属性和链接引用正确的 OT rid |
| AC-34 | 用户 | Apply 时某个 ObjectType 创建失败（如 apiName 冲突） | 该 OT 记为 failed，其依赖的 Property/LinkType 记为 skipped，其他独立项继续创建 |
| AC-35 | 用户 | Apply 时蓝图状态非 pending_review | 422，错误码 `BLUEPRINT_INVALID_STATUS_FOR_APPLY`（INV-10） |
| AC-36 | 用户 | Apply 时没有任何 accepted/edited 项 | 422，错误码 `BLUEPRINT_NO_ACTIONABLE_ITEMS`（INV-10） |
| AC-37 | 用户 | Apply 成功后，每个成功项的 created_entity_rid 更新为实际创建的实体 rid | BlueprintItem.createdEntityRid 非空 |
| AC-38 | 用户 | Apply 创建的实体进入 WorkingState 草稿状态 | 通过 v0.1.0 Service 层创建，自动进入工作状态 |
| **会话级联** | | | |
| AC-39 | 用户 | DELETE 一个 Agent 会话（该会话有素材和蓝图） | 会话删除，级联删除关联的素材 DB 记录（FK CASCADE）+ 清理本地素材文件目录 + 级联删除蓝图和蓝图项 |
| **SSE 事件** | | | |
| AC-40 | Agent | Agent 生成蓝图项时通过 SSE 发送 blueprint-item 事件 | 前端可实时接收蓝图项数据 |
| AC-41 | Agent | 蓝图生成完成时通过 SSE 发送 blueprint-complete 事件 | 前端可感知蓝图生成完毕 |
| AC-42 | 系统 | 素材上传完成后通过 SSE 发送 material-uploaded 事件 | 前端可感知文件上传状态 |
| **CLI 命令** | | | |
| AC-43 | 开发者 | `oo blueprint list --session-rid <rid>` | 输出蓝图列表（纯文本格式） |
| AC-44 | 开发者 | `oo blueprint show <rid>` | 输出蓝图详情 + 所有蓝图项 |
| AC-45 | 开发者 | `oo blueprint apply <rid>` | 执行蓝图应用，输出结果摘要 |
| AC-46 | 开发者 | `oo material upload <file> --session-rid <rid>` | 上传文件，输出素材 rid |
| AC-47 | 开发者 | `oo material list --session-rid <rid>` | 输出素材列表 |
| AC-48 | 开发者 | `oo material parse <file>` | 解析文件并输出结构化分析结果（不需要会话） |
| **文件解析器** | | | |
| AC-49 | Agent | 解析 CSV 文件 | 输出列名列表、推断的数据类型（Integer/Double/Date/Timestamp/Boolean/String）、样本数据（前 5 行）、行数、分隔符 |
| AC-50 | Agent | 解析 Excel 文件 | 输出每个 sheet 的列名、数据类型、行数 |
| AC-51 | Agent | 解析 SQL DDL 文件 | 输出表名、列名、列类型、主键、外键关系、唯一约束、NOT NULL 约束 |
| AC-52 | Agent | 解析 PDF/Markdown/Word/TXT 文件 | 提取文本内容，返回纯文本（LLM 实体识别由 Agent 自行完成） |
| AC-53 | Agent | CSV 列名包含 `id`/`_id`/`Id` | 自动标记为主键候选 |
| AC-54 | Agent | CSV 列名匹配审计字段（created_at/updated_at/created_by/updated_by/deleted_at/is_deleted） | 标记为"已跳过·审计字段"（可恢复） |

---

## 3. 边界情况

- 当上传空文件（0 字节）时，系统应接受上传但 analysisStatus 标记为 `completed`，analysisResult 标记为空文件
- 当 CSV 文件编码非 UTF-8 时，解析器应尝试 GBK 降级解析，失败则标记解析失败
- 当 Excel 文件有密码保护时，解析器应标记解析失败并返回提示信息
- 当 PDF 为纯扫描件（无可选文本）时，解析器应标记解析失败并返回提示信息
- 当文件解析超时（> 60s）时，analysisStatus 标记为 `failed`
- 当 apply 过程中某个 ObjectType 的 apiName 与现有本体冲突时，该项标记为 failed，不回滚已成功项
- 当 apply 过程中所有项都失败时，蓝图状态保持 pending_review（不变为 applied），返回全部失败结果
- 当蓝图项的 suggestion 中包含 placeholderRid 引用时，apply 按映射表解析为实际 rid
- **不支持**：文件内容加密/压缩包解析（延后到 v0.3.0）
- **不支持**：蓝图版本对比/回滚（延后到 v0.3.0）
- **不支持**：多用户并发审查同一蓝图（v0.2.0 单用户场景）

---

## 4. 架构决策

| ID | 决策 | 选项 | 结论 | 理由 |
|----|------|------|------|------|
| AD-01 | 文件存储 | A: 本地磁盘 / B: PostgreSQL BYTEA / C: S3 兼容 | 选 A | MVP 阶段简单可靠；按 session_rid 隔离目录便于清理；配置项可覆盖路径 |
| AD-02 | Apply 事务策略 | A: 整体事务（全成功或全回滚）/ B: 逐项事务（部分成功） | 选 B | PRD 明确要求部分失败恢复；每个 OT+属性为一个逻辑单元，LinkType 依赖 OT 成功 |
| AD-03 | F014 边界 | A: 纯数据层 / B: 含解析器 / C: 含 Agent 分析逻辑 | 选 B | 数据层 + 文件解析器（作为 skill）；Agent 分析编排由 deepagents 引擎驱动，不在 F014 service 层 |
| AD-04 | 蓝图项决策不可逆性 | A: 允许修改 / B: 不可逆（INV-11） | 选 B | release-contract INV-11 明确要求；简化并发处理和审计追溯 |
| AD-05 | Router 组织 | A: 全部放入 agent.py / B: 新建 materials.py + blueprints.py | 选 B | 蓝图和素材是独立的领域对象，单独 router 更清晰；与 v0.1.0 模式一致 |
| AD-06 | 素材分析状态更新 | A: upload 端点同步解析 / B: upload 只存文件，解析由 Agent 异步触发 | 选 B | 解析可能耗时（大文件/LLM）；upload 端点应快速返回；Agent 通过 skill 调用解析器后更新状态 |

---

## 5. 数据库 & Domain 模型

### PostgreSQL 表定义

```sql
-- 上传资料
CREATE TABLE agent_materials (
    rid             TEXT PRIMARY KEY,              -- ri.ontology.agent-material.<uuid12>
    session_rid     TEXT NOT NULL REFERENCES agent_sessions(rid) ON DELETE CASCADE,
    file_name       TEXT NOT NULL,                 -- 原始文件名
    file_type       TEXT NOT NULL,                 -- csv | xlsx | sql | pdf | md | docx | txt
    file_size       INTEGER NOT NULL,              -- 字节数
    storage_path    TEXT NOT NULL,                  -- 本地文件路径
    analysis_status TEXT NOT NULL DEFAULT 'pending', -- pending | analyzing | completed | failed
    analysis_result JSONB,                          -- 解析结果（列信息/提取的实体等）
    error_message   TEXT,                           -- 解析失败时的错误信息
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_agent_materials_session ON agent_materials(session_rid);

-- 本体蓝图
CREATE TABLE blueprints (
    rid             TEXT PRIMARY KEY,              -- ri.ontology.blueprint.<uuid12>
    session_rid     TEXT NOT NULL REFERENCES agent_sessions(rid) ON DELETE CASCADE,
    ontology_rid    TEXT NOT NULL REFERENCES ontologies(rid),
    name            TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'draft', -- draft | pending_review | applied | discarded
    source_summary  TEXT,                          -- 来源资料摘要
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_blueprints_session ON blueprints(session_rid);
CREATE INDEX idx_blueprints_ontology ON blueprints(ontology_rid);

-- 蓝图项
CREATE TABLE blueprint_items (
    rid                 TEXT PRIMARY KEY,           -- ri.ontology.blueprint-item.<uuid12>
    blueprint_rid       TEXT NOT NULL REFERENCES blueprints(rid) ON DELETE CASCADE,
    item_type           TEXT NOT NULL,              -- object_type | property | link_type
    suggestion          JSONB NOT NULL,             -- 建议内容（完整定义）
    confidence          REAL NOT NULL,              -- 0.0 - 1.0
    confidence_level    TEXT NOT NULL,              -- high (≥0.8) | medium (0.5-0.8) | low (<0.5)
    reasoning           TEXT,                       -- 推理说明
    source              TEXT NOT NULL,              -- field_analysis | pattern_matching | semantic_inference | best_practices
    user_decision       TEXT,                       -- NULL | accepted | edited | rejected
    user_edits          JSONB,                      -- 用户编辑内容（仅 edited 时）
    rejection_reason    TEXT,                       -- 拒绝理由（仅 rejected 时）
    created_entity_rid  TEXT,                       -- apply 后实际创建的实体 RID
    sort_order          INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_blueprint_items_blueprint ON blueprint_items(blueprint_rid, sort_order);
```

### Pydantic Domain 模型

**material.py**:
```python
class MaterialFileType(str, Enum):
    CSV = "csv"; XLSX = "xlsx"; SQL = "sql"
    PDF = "pdf"; MD = "md"; DOCX = "docx"; TXT = "txt"

class AnalysisStatus(str, Enum):
    PENDING = "pending"; ANALYZING = "analyzing"
    COMPLETED = "completed"; FAILED = "failed"

class AgentMaterial(DomainModel):
    rid: str
    session_rid: str
    file_name: str
    file_type: MaterialFileType
    file_size: int
    storage_path: str
    analysis_status: AnalysisStatus
    analysis_result: dict | None = None
    error_message: str | None = None
    created_at: datetime
```

**blueprint.py**:
```python
class BlueprintStatus(str, Enum):
    DRAFT = "draft"; PENDING_REVIEW = "pending_review"
    APPLIED = "applied"; DISCARDED = "discarded"

class BlueprintItemType(str, Enum):
    OBJECT_TYPE = "object_type"; PROPERTY = "property"; LINK_TYPE = "link_type"

class ConfidenceLevel(str, Enum):
    HIGH = "high"; MEDIUM = "medium"; LOW = "low"

class ItemSource(str, Enum):
    FIELD_ANALYSIS = "field_analysis"; PATTERN_MATCHING = "pattern_matching"
    SEMANTIC_INFERENCE = "semantic_inference"; BEST_PRACTICES = "best_practices"

class UserDecision(str, Enum):
    ACCEPTED = "accepted"; EDITED = "edited"; REJECTED = "rejected"

class Blueprint(DomainModel):
    rid: str; session_rid: str; ontology_rid: str; name: str
    status: BlueprintStatus; source_summary: str | None; created_at: datetime; updated_at: datetime

class BlueprintItem(DomainModel):
    rid: str; blueprint_rid: str; item_type: BlueprintItemType
    suggestion: dict; confidence: float; confidence_level: ConfidenceLevel
    reasoning: str | None; source: ItemSource
    user_decision: UserDecision | None; user_edits: dict | None
    rejection_reason: str | None; created_entity_rid: str | None
    sort_order: int; created_at: datetime; updated_at: datetime

class BlueprintApplyResult(DomainModel):
    blueprint_rid: str; total: int; succeeded: int; failed: int; skipped: int
    results: list[ApplyItemResult]

class ApplyItemResult(DomainModel):
    item_rid: str; item_type: BlueprintItemType
    status: str  # "success" | "failed" | "skipped"
    created_entity_rid: str | None; error: str | None
```

### 蓝图状态机

```
         ┌─────────── Agent 开始分析 ──────────┐
         ▼                                      │
      [draft] ──── Agent 完成 ────→ [pending_review]
                                        │         │
                                        │    用户逐项审查
                                        │    (accept/edit/reject)
                                        │         │
                                   用户放弃        用户点击 apply
                                        │         │
                                        ▼         ▼
                                  [discarded]  [applied]
                                  （终态）      （终态）
```

合法状态转换：
- `draft` → `pending_review`
- `pending_review` → `applied`（仅通过 apply 端点，INV-10）
- `pending_review` → `discarded`
- `applied` / `discarded` → 任何值：**禁止**

---

## 6. API 契约

### 端点列表

| Method | Path | 描述 |
|--------|------|------|
| POST | `/api/v1/agent/materials/upload` | 上传资料文件（multipart/form-data） |
| GET | `/api/v1/agent/materials` | 素材列表（?sessionRid=xxx） |
| GET | `/api/v1/agent/materials/{rid}` | 素材详情 |
| DELETE | `/api/v1/agent/materials/{rid}` | 删除素材 |
| POST | `/api/v1/blueprints` | 创建蓝图 |
| GET | `/api/v1/blueprints` | 蓝图列表（?sessionRid=xxx&ontologyRid=xxx） |
| GET | `/api/v1/blueprints/{rid}` | 蓝图详情（含 items） |
| PATCH | `/api/v1/blueprints/{rid}` | 更新蓝图（状态/名称） |
| POST | `/api/v1/blueprints/{rid}/items` | 创建蓝图项（单个或批量） |
| GET | `/api/v1/blueprints/{rid}/items` | 蓝图项列表 |
| PATCH | `/api/v1/blueprints/{rid}/items/{itemRid}` | 更新蓝图项决策 |
| POST | `/api/v1/blueprints/{rid}/apply` | 应用蓝图 |

### 请求/响应示例

```jsonc
// POST /api/v1/agent/materials/upload
// Content-Type: multipart/form-data
// Fields: file (binary), sessionRid (string)
// Response 201
{
  "rid": "ri.ontology.agent-material.a1b2c3d4e5f6",
  "sessionRid": "ri.ontology.agent-session.xxx",
  "fileName": "orders.csv",
  "fileType": "csv",
  "fileSize": 524288,
  "storagePath": "uploads/materials/ri.ontology.agent-session.xxx/ri.ontology.agent-material.a1b2c3d4e5f6_orders.csv",
  "analysisStatus": "pending",
  "analysisResult": null,
  "createdAt": "2026-03-24T10:00:00Z"
}

// POST /api/v1/blueprints
{
  "sessionRid": "ri.ontology.agent-session.xxx",
  "ontologyRid": "ri.ontology.main.xxx",
  "name": "电商平台本体蓝图",
  "sourceSummary": "基于 orders.csv + products.xlsx 分析生成"
}
// Response 201
{
  "rid": "ri.ontology.blueprint.b1c2d3e4f5g6",
  "sessionRid": "ri.ontology.agent-session.xxx",
  "ontologyRid": "ri.ontology.main.xxx",
  "name": "电商平台本体蓝图",
  "status": "draft",
  "sourceSummary": "基于 orders.csv + products.xlsx 分析生成",
  "createdAt": "2026-03-24T10:01:00Z",
  "updatedAt": "2026-03-24T10:01:00Z"
}

// POST /api/v1/blueprints/{rid}/items
{
  "itemType": "object_type",
  "suggestion": {
    "displayName": "订单",
    "apiName": "Order",
    "description": "表示一次客户购买行为",
    "placeholderRid": "placeholder:order",
    "properties": [
      { "displayName": "订单编号", "apiName": "orderId", "baseType": "string", "isPrimaryKey": true },
      { "displayName": "金额", "apiName": "amount", "baseType": "double" }
    ]
  },
  "confidence": 0.92,
  "reasoning": "从 orders.csv 的列结构直接推断",
  "source": "field_analysis",
  "sortOrder": 1
}
// Response 201
{
  "rid": "ri.ontology.blueprint-item.c1d2e3f4g5h6",
  "blueprintRid": "ri.ontology.blueprint.b1c2d3e4f5g6",
  "itemType": "object_type",
  "suggestion": { ... },
  "confidence": 0.92,
  "confidenceLevel": "high",
  "reasoning": "从 orders.csv 的列结构直接推断",
  "source": "field_analysis",
  "userDecision": null,
  "userEdits": null,
  "rejectionReason": null,
  "createdEntityRid": null,
  "sortOrder": 1,
  "createdAt": "2026-03-24T10:02:00Z",
  "updatedAt": "2026-03-24T10:02:00Z"
}

// PATCH /api/v1/blueprints/{rid}/items/{itemRid}
{ "userDecision": "edited", "userEdits": { "apiName": "CustomerOrder" } }
// Response 200 — 更新后的 BlueprintItem

// POST /api/v1/blueprints/{rid}/apply
// Response 200
{
  "blueprintRid": "ri.ontology.blueprint.b1c2d3e4f5g6",
  "total": 8,
  "succeeded": 7,
  "failed": 1,
  "skipped": 0,
  "results": [
    { "itemRid": "ri.ontology.blueprint-item.c1d2e3f4g5h6", "itemType": "object_type", "status": "success", "createdEntityRid": "ri.ontology.object-type.xxx" },
    { "itemRid": "ri.ontology.blueprint-item.yyy", "itemType": "object_type", "status": "failed", "error": "apiName 'Order' already exists" }
  ]
}
```

### 错误码表

| HTTP | Code | 场景 | 关联 AC |
|------|------|------|---------|
| 400 | `MATERIAL_INVALID_FILE_TYPE` | 不支持的文件格式 | AC-03 |
| 400 | `MATERIAL_FILE_TOO_LARGE` | 超过 10MB | AC-02 |
| 400 | `MATERIAL_SESSION_LIMIT_EXCEEDED` | 超过 20 个文件 | AC-04 |
| 400 | `BLUEPRINT_ITEM_INVALID_CONFIDENCE` | 置信度不在 0-1 | AC-22 |
| 400 | `BLUEPRINT_ITEM_MISSING_SOURCE` | 缺少来源标签 | AC-23 |
| 404 | `MATERIAL_NOT_FOUND` | 素材不存在 | AC-10 |
| 404 | `BLUEPRINT_NOT_FOUND` | 蓝图不存在 | AC-15 |
| 404 | `BLUEPRINT_ITEM_NOT_FOUND` | 蓝图项不存在 | AC-31 |
| 422 | `BLUEPRINT_INVALID_STATUS_TRANSITION` | 非法状态转换 | AC-18, AC-19, AC-20 |
| 422 | `BLUEPRINT_INVALID_STATUS_FOR_APPLY` | 非 pending_review | AC-35 |
| 422 | `BLUEPRINT_NO_ACTIONABLE_ITEMS` | 无可应用项 | AC-36 |
| 422 | `BLUEPRINT_ITEM_DECISION_IMMUTABLE` | 决策不可逆 | AC-29 |
| 500 | `MATERIAL_UPLOAD_FAILED` | 文件写入失败 | — |

---

## 7. Service / Router 层逻辑

### MaterialService

- **upload()**: 校验会话 active → 校验文件数量(≤20) → 校验文件类型（白名单） → 校验文件大小(≤10MB) → 写入磁盘 `uploads/materials/{session_rid}/{rid}_{filename}` → 创建 DB 记录
- **get() / list_by_session()**: 标准查询
- **delete()**: 删除 DB 记录 + 删除磁盘文件
- **update_analysis()**: 更新 analysis_status 和 analysis_result（由 Agent/skill 调用）
- **cleanup_session_files()**: 删除整个会话的文件目录（会话删除时调用）

### BlueprintService

- **create()**: 校验 session 和 ontology 存在 → 创建蓝图（status=draft）
- **get_detail()**: 返回蓝图 + eagerly load items
- **update()**: 校验状态转换合法性 → 更新字段
- **create_item() / batch_create_items()**: 校验 INV-16（confidence + source） → 计算 confidence_level → 创建
- **update_item_decision()**: 校验蓝图 status=pending_review → 校验 INV-11（不可逆） → 保存决策
- **apply()**: 校验 INV-10 → 按 OT→Property→LT 顺序遍历 accepted/edited 项 → 调用 v0.1.0 Service 创建实体 → 记录每项结果 → 更新蓝图状态为 applied

### Router 分离

- `app/routers/materials.py` — prefix `/api/v1/agent/materials`
- `app/routers/blueprints.py` — prefix `/api/v1/blueprints`

---

## 8. Agent 集成设计

### SSE 事件扩展

在 `app/agent/sse_adapter.py` 的 `SSEEventType` 枚举新增：

| 事件类型 | 数据结构 | 说明 |
|---------|---------|------|
| `material-uploaded` | `{ rid, fileName, fileType }` | 素材上传完成通知 |
| `blueprint-item` | `{ rid, itemType, suggestion, confidence, confidenceLevel }` | Agent 生成蓝图项 |
| `blueprint-complete` | `{ blueprintRid, name, status, itemCount }` | 蓝图生成完毕 |

### Skill 定义（文件解析器）

| Skill 名称 | Level | 参数 | 约束 | 对应 CLI 命令 |
|------------|-------|------|------|--------------|
| `parse-csv` | L1 | `file_path: Path` | 前 1000 行推断类型；类型匹配率 >95% 确认 | `oo material parse <file> --parser csv` |
| `parse-excel` | L1 | `file_path: Path` | 支持多 sheet | `oo material parse <file> --parser excel` |
| `parse-ddl` | L1 | `file_path: Path` | 解析 CREATE TABLE 语句 | `oo material parse <file> --parser ddl` |
| `parse-document` | L1 | `file_path: Path` | PDF/MD/DOCX/TXT 提取文本 | `oo material parse <file> --parser document` |

### 解析器模块

`app/agent/parsers/` 目录下实现统一接口：

```python
class BaseParser(ABC):
    @abstractmethod
    async def parse(self, file_path: Path) -> ParseResult: ...

class ParseResult(DomainModel):
    file_type: str
    columns: list[ColumnInfo] | None = None      # CSV/Excel
    tables: list[TableInfo] | None = None         # DDL
    text_content: str | None = None               # 文档
    row_count: int | None = None
    metadata: dict = Field(default_factory=dict)   # 分隔符、编码等

class ColumnInfo(DomainModel):
    name: str
    inferred_type: str    # Integer | Double | Date | Timestamp | Boolean | String
    sample_values: list[str]
    is_primary_key_candidate: bool = False
    is_audit_field: bool = False

class TableInfo(DomainModel):
    name: str
    columns: list[ColumnInfo]
    primary_key: list[str]
    foreign_keys: list[ForeignKeyInfo]
    unique_constraints: list[list[str]]
```

---

## 9. 前端组件设计

F014 为纯后端特性，不包含前端组件。前端 UI（FileUploadArea、BlueprintReviewBar 等）由 F015/F017 实现并消费 F014 API。

---

## 10. 文件清单

```
apps/server/
├── alembic/versions/<next>_add_material_and_blueprint_tables.py  # 新建：3 张表 + 索引
├── app/domain/material.py                    # 新建：AgentMaterial 模型 + 枚举
├── app/domain/blueprint.py                   # 新建：Blueprint/BlueprintItem 模型 + Apply 结果
├── app/storage/material_storage.py           # 新建：素材 Storage 层
├── app/storage/blueprint_storage.py          # 新建：蓝图/蓝图项 Storage 层
├── app/storage/models.py                     # 修改：新增 3 个 ORM Model
├── app/services/material_service.py          # 新建：素材 Service
├── app/services/blueprint_service.py         # 新建：蓝图 Service（含 apply）
├── app/services/agent_service.py             # 修改：delete_session 增加文件清理
├── app/routers/materials.py                  # 新建：素材 REST 端点
├── app/routers/blueprints.py                 # 新建：蓝图 REST 端点
├── app/main.py                               # 修改：注册新 router
├── app/agent/sse_adapter.py                  # 修改：新增 3 个 SSE 事件类型
├── app/agent/parsers/__init__.py             # 新建
├── app/agent/parsers/base.py                 # 新建：解析器基类 + 数据模型
├── app/agent/parsers/csv_parser.py           # 新建：CSV 解析
├── app/agent/parsers/excel_parser.py         # 新建：Excel 解析
├── app/agent/parsers/ddl_parser.py           # 新建：SQL DDL 解析
├── app/agent/parsers/document_parser.py      # 新建：PDF/MD/DOCX/TXT 解析
├── app/agent/skills/parse-csv/SKILL.md       # 新建
├── app/agent/skills/parse-excel/SKILL.md     # 新建
├── app/agent/skills/parse-ddl/SKILL.md       # 新建
├── app/agent/skills/parse-document/SKILL.md  # 新建
├── cli/commands/blueprint.py                 # 修改：填充存根实现
├── cli/commands/material.py                  # 新建：素材 CLI 命令
├── cli/main.py                               # 修改：注册 material 命令
├── .gitignore                                # 修改：添加 uploads/
```

---

## 非功能要求

- **性能**: 文件上传 API 响应 < 2s（10MB 文件）；蓝图列表查询 < 200ms；apply 操作整体 < 30s（20 个蓝图项）
- **安全**: 文件类型白名单校验；上传文件不执行；存储路径不可遍历（sanitize 文件名）
- **可观测性**: apply 操作写入审计日志（action=`blueprint_apply`）；文件上传写入审计日志（action=`material_upload`）
- **数据隔离**: 本地文件按 session_rid 目录隔离；测试使用 tmp_path fixture

---

## 依赖与约束

- **依赖特性**: F012-agent-foundation（AgentSession 表、AgentService、SSE 适配器）、F013-cli-and-skills（CLI 框架、`oo` 入口、blueprint 存根）
- **被依赖**: F017-hitl-review-and-apply（消费蓝图 API 和 apply 结果）
- **不变量引用**: INV-10（apply 条件）、INV-11（决策不可逆）、INV-13（文件限制）、INV-16（置信度+来源必填）
- **版本契约**: F014 是 AgentMaterial / Blueprint / BlueprintItem 三个领域对象的 Owner Feature
