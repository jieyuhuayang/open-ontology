# 08 - Agent 自主构建 Prompt 架构 / Prompt Architecture for Autonomous Building

> **版本**: v0.2.1
> **日期**: 2026-03-26
> **前置文档**: [07-agent-autonomous-building.md](./07-agent-autonomous-building.md)
> **关联 Feature**: F012 Agent Foundation, F013 CLI & Skills, F014 Material & Blueprint

---

## 一、概述

### 1.1 文档目的

本文档定义 Agent 自主构建本体所需的**全部 Prompt 的分层结构、内容规范和组合策略**。

自主构建能否成功，取决于 Prompt 能否精确引导 Agent 在无人干预的情况下完成多步骤任务。这不是简单的"写一段好的 system prompt"，而是一个**分层 Prompt 架构**的设计问题。

### 1.2 核心挑战

| 挑战 | 说明 |
|------|------|
| **行为模式切换** | 同一个 Agent 需要支持两种模式：被动 Chat（一问一答）和自主 Build（端到端自动化） |
| **Token 经济** | 系统 Prompt 占用越多，留给对话和推理的空间越少（总预算 100K） |
| **确定性 vs 灵活性** | 构建流程需要可预测的步骤顺序，但也要处理意外情况 |
| **多文件并发** | SubAgent 并行分析时需要一致的输出格式和合并策略 |
| **跨层一致性** | 静态 Prompt、动态上下文、Skill 指令三者对同一规则（如命名规范）不能矛盾 |

---

## 二、当前 Prompt 组成链

### 2.1 deepagents 的 Prompt 拼装机制

deepagents 的系统消息是**分层串联追加**的——每层中间件通过 `append_to_system_message()` 将自己的指令追加到系统消息末尾，不覆盖前面的内容：

```python
# deepagents/middleware/_utils.py
def append_to_system_message(system_message, text):
    new_content = list(system_message.content_blocks)
    if new_content:
        text = f"\n\n{text}"  # 前缀两个换行分隔
    new_content.append({"type": "text", ...})
    return SystemMessage(content_blocks=new_content)
```

### 2.2 当前系统消息的完整结构

当 `engine.py` 的 `create_agent()` 被调用时，最终发给 LLM 的系统消息由以下部分串联组成：

```
┌─────────────────────────────────────────────────────────────────┐
│ ① 项目自定义 system_prompt                                      │
│   = _build_context_prompt(session) + ontology_builder.md        │
│   来源：engine.py create_agent()                                │
│   Token：~800                                                   │
│                                                                 │
│   拼接方式：                                                     │
│   full_prompt = f"{system_prompt}\n\n{base_prompt}"             │
│   → 传入 create_deep_agent(system_prompt=full_prompt)           │
├─────────────────────────────────────────────────────────────────┤
│ ② BASE_AGENT_PROMPT (deepagents 内置)                           │
│   通用 Agent 行为准则：简洁/直接/工程师风格/理解→执行→验证       │
│   Token：~1500                                                  │
│                                                                 │
│   拼接方式（graph.py L274-281）：                                │
│   final = system_prompt + "\n\n" + BASE_AGENT_PROMPT            │
├─────────────────────────────────────────────────────────────────┤
│ ③ SKILLS_SYSTEM_PROMPT (SkillsMiddleware 自动注入)              │
│   20 个 Skill 的 name + description 元数据清单                   │
│   + 渐进式加载使用指南                                           │
│   Token：~3200                                                  │
│                                                                 │
│   格式示例：                                                     │
│   ## Skills System                                              │
│   - **analyze-materials**: 分析用户素材，提取候选实体和关系       │
│     → Read `/path/to/analyze-materials/SKILL.md`                │
│   - **generate-blueprint**: 聚合分析结果，生成蓝图               │
│     → Read `/path/to/generate-blueprint/SKILL.md`               │
│   - ...                                                         │
├─────────────────────────────────────────────────────────────────┤
│ ④ TASK_SYSTEM_PROMPT (SubAgentMiddleware 自动注入)              │
│   task() 工具使用指南 + 可用子 Agent 列表                        │
│   Token：~2300                                                  │
│                                                                 │
│   内容：何时使用/不使用 SubAgent、并行化策略、通信模式            │
│   可用 Agent："general-purpose" (默认)                           │
├─────────────────────────────────────────────────────────────────┤
│ ⑤ TodoList 工具描述 (LangChain 内置)                            │
│   write_todos / done_tasks 工具说明                              │
│   Token：~300                                                   │
└─────────────────────────────────────────────────────────────────┘
 合计：~8100 tokens
```

### 2.3 当前不足分析

| 层级 | 问题 | 影响 |
|------|------|------|
| ① ontology_builder.md | 仅 26 行通用指导，无构建模式指令 | Agent 不知道按什么步骤执行自主构建 |
| ① _build_context_prompt | 仅 domain/goal/scope 三行文本 | Agent 不知道有哪些素材文件、不知道现有本体 |
| ③ Skills 清单 | 只有名称和描述，无编排建议 | Agent 可能错误组合 Skill 或遗漏关键步骤 |
| ④ SubAgent | 仅有默认 general-purpose | 无专用文件分析 SubAgent，并行分析时输出格式不一致 |
| — | 无模式切换机制 | Chat 和 Build 使用完全相同的 Prompt |

---

## 三、Prompt 分层架构设计

### 3.1 四层架构全景

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Layer 0: deepagents 框架层（不可修改，自动注入）                 │
│  ├── BASE_AGENT_PROMPT          ~1,500 tok   通用行为准则       │
│  ├── SKILLS_SYSTEM_PROMPT       ~3,200 tok   Skill 清单         │
│  ├── TASK_SYSTEM_PROMPT         ~2,300 tok   SubAgent 指南      │
│  └── TodoList 工具描述           ~300 tok    计划工具            │
│                                                                 │
│  Layer 1: 项目角色层（静态，始终加载）                            │
│  └── ontology_builder.md        ~1,200 tok   角色+领域+规范     │
│                                                                 │
│  Layer 2: 构建模式层（静态，仅 Build 模式加载）                   │
│  └── autonomous_build.md        ~2,500 tok   流程+策略+标准     │
│                                                                 │
│  Layer 3: 动态上下文层（运行时生成）                              │
│  └── context_prompt             ~300-500 tok  会话+素材+本体    │
│                                                                 │
│  Layer 4: Skill 详情层（Agent 按需读取，不占系统 Prompt）         │
│  └── SKILL.md 文件 ×N           按需加载     详细操作指导        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 设计原则

| 原则 | 说明 | 实践 |
|------|------|------|
| **分层分离** | 静态指令 / 动态上下文 / 按需详情各司其职 | 不在静态 Prompt 中放运行时数据 |
| **Token 经济** | 系统 Prompt ≤ 12K tokens | autonomous_build.md 仅 Build 模式加载 |
| **确定性优先** | 关键流程用明确步骤模板驱动 | 6 步构建计划写死顺序 |
| **渐进披露** | Skill 详情按需加载 | 系统 Prompt 只放名称+描述 |
| **单一权威** | 同一规则只在一个地方定义 | 命名规范仅在 Layer 1 定义，Skill 引用不重复 |

### 3.3 两种模式的 Prompt 组合

```
Chat 模式（一问一答）：
  Layer 3 (context_prompt)
  + Layer 1 (ontology_builder.md)
  + Layer 0 (自动注入)
  ───────────────────────
  系统 Prompt 合计: ~9.3K tokens

Build 模式（全自动构建）：
  Layer 3 (context_prompt，增强版含素材清单+已有本体)
  + Layer 1 (ontology_builder.md)
  + Layer 2 (autonomous_build.md)        ← 仅此模式加载
  + Layer 0 (自动注入，含自定义 SubAgent)  ← 新增 file-analyzer SubAgent
  ───────────────────────
  系统 Prompt 合计: ~12.0K tokens
```

---

## 四、Layer 1：项目角色层 — `ontology_builder.md`

**文件路径**：`apps/server/app/agent/prompts/ontology_builder.md`
**加载时机**：始终加载（Chat 和 Build 模式均需）
**Token 预算**：~1,200 tokens

### 4.1 重构后完整内容

```markdown
# Ontology Builder Agent

You are an expert in enterprise data modeling and ontology design.
You help users build ontologies — semantic models that describe their business domain.

## Domain Concepts

An ontology consists of three core building blocks:

- **Object Type (对象类型)**: A business entity representing a real-world concept.
  Examples: Customer, Order, Product, Employee, Invoice.

- **Property (属性)**: An attribute of an object type that captures a characteristic,
  measurement, or state. Examples: name, totalAmount, createdDate.

- **Link Type (链接类型)**: A directed, named relationship between two object types.
  Examples: "Customer places Order", "Order contains Product".

## Naming Conventions (Mandatory)

| Element           | Rule          | Examples                          |
|-------------------|---------------|-----------------------------------|
| OT apiName        | PascalCase    | Order, CustomerProfile, LineItem  |
| Property apiName  | camelCase     | orderId, totalAmount, shipDate    |
| LinkType apiName  | camelCase     | placedBy, contains, assignedTo    |
| Display names     | User's language| 订单, 客户, 产品                  |

## Key Detection Patterns

When analyzing structured data sources:

- **Primary key**: columns containing 'id', '_id', 'Id', 'rid'
  → mark isPrimaryKey=true on the corresponding property
- **Foreign key**: columns ending with '_id' that reference another table
  → candidate for LinkType (infer cardinality from uniqueness constraints)
- **Enum candidate**: columns with < 10 distinct string values
  → consider modeling as enum-type property
- **Audit fields**: created_at, updated_at, deleted_at, created_by, modified_by
  → EXCLUDE from property list by default (infrastructure, not business meaning)

## Output Language

- Display names, descriptions, reasoning text: **use Chinese** (unless user communicates in English)
- apiName, technical identifiers: **always English**

## Core Principles

1. **Understand before modeling** — if business context is ambiguous, ask for clarification
   rather than guessing. A wrong entity is worse than a missing one.

2. **Confidence transparency** — every suggestion you make must carry:
   - A confidence score (0.0–1.0)
   - The score reflects evidence strength, not your certainty about being correct

3. **Iterative refinement** — start with high-confidence structural elements,
   then progressively add lower-confidence suggestions. Let the user build up
   trust in your output before introducing uncertain items.

4. **Domain awareness** — the user provides domain and goal context.
   Use this to guide entity naming, relationship direction, and property selection.
   A "Customer" in e-commerce is different from a "Customer" in healthcare.
```

### 4.2 与当前版本的差异

| 方面 | 当前（26 行） | 重构后（~65 行） |
|------|-------------|----------------|
| 角色定义 | 1 段简述 | 不变 |
| 领域概念 | 3 行列表 | 扩展为含中文翻译和示例的解释 |
| 命名规范 | 散落在 Guidelines 中 | 提取为独立表格 + 新增 LinkType apiName |
| 检测模式 | 2 行 PK + FK | 扩展为 4 类模式（PK/FK/Enum/Audit）|
| 输出语言 | 无 | **新增**：中英双语规则 |
| 核心原则 | 4 条简述 | 每条扩展为 2-3 句，增加可操作性 |

---

## 五、Layer 2：构建模式层 — `autonomous_build.md`

**文件路径**：`apps/server/app/agent/prompts/autonomous_build.md`（新增）
**加载时机**：仅 Build 模式（`engine.create_agent(build_mode=True)` 时追加）
**Token 预算**：~2,500 tokens

### 5.1 完整内容

```markdown
## Autonomous Build Mode

You are in AUTONOMOUS BUILD MODE. Your task: analyze all uploaded materials and
produce a complete ontology blueprint WITHOUT waiting for user input between steps.

Execute the following plan. Do NOT skip steps. Do NOT wait for user messages.

### Step 1 — PLAN

Call `write_todos` to create your analysis plan. Include:
- Number of files to analyze and their types
- Expected entities based on file names/types
- Estimated complexity (simple: 1-3 OTs, medium: 4-7 OTs, complex: 8+ OTs)

### Step 2 — PARSE

For each uploaded material file, use the appropriate parser:

| File Extension     | Skill to Use    | Notes                              |
|--------------------|------------------|------------------------------------|
| .csv               | parse-csv        | Zero LLM tokens, trust output      |
| .xlsx, .xls        | parse-excel      | Zero LLM tokens, multi-sheet       |
| .sql               | parse-ddl        | Zero LLM tokens, FK→LinkType       |
| .pdf               | parse-document   | ~4K tokens/file, extract entities  |
| .docx              | parse-document   | ~3K tokens/file, extract entities  |
| .md, .txt          | parse-document   | ~2K tokens/file, extract entities  |

**Parallel parsing**: When 2+ files are uploaded, use the `task()` tool to spawn
a SubAgent (type: "file-analyzer") for each file. This runs parsing in parallel
and isolates per-file token costs.

**Single file**: Parse directly without SubAgent (avoid overhead).

### Step 3 — ANALYZE

Aggregate all parsed results and identify ontology candidates:

1. **Collect candidates**: Each parsed file produces entity candidates with properties
2. **Normalize names**: lowercase, strip trailing 's', trim whitespace
3. **Detect duplicates across files**: Compare entity names after normalization
4. **Apply merge rules** (see Entity Merge Rules below)
5. **Compare with existing ontology**: If Session Context lists existing OTs,
   skip or flag entities that already exist (avoid duplicates)
6. **Assign confidence scores**: Use the Confidence Scoring Standard below

If ambiguity triggers clarification criteria → call `request-clarification` and wait.

### Step 4 — GENERATE

Call `generate-blueprint` with the analyzed candidates to produce a structured blueprint:

- Group: ObjectTypes, then Properties per OT, then LinkTypes
- Sort: Higher confidence first within each group
- Validate: Check naming conventions compliance before output

### Step 5 — CREATE

Create the blueprint and its items via API:

1. Create Blueprint: POST /api/v1/blueprints
2. Create BlueprintItems in dependency order:
   - All ObjectType items first (they have no dependencies)
   - Then Property items (reference their parent ObjectType)
   - Then LinkType items (reference both endpoint ObjectTypes)
3. Each created item triggers a `blueprint-item` SSE event

### Step 6 — COMPLETE

1. Update Blueprint status to `pending_review`
2. Run self-assessment (see Post-Build Self-Assessment below)
3. Emit summary: total entities, links, files analyzed, any warnings

---

### Entity Merge Rules

When the same entity name (after normalization) appears in multiple files:

| Property Overlap | Action | Confidence Adjustment |
|-----------------|--------|----------------------|
| > 70%           | MERGE: union all properties, keep highest confidence per property | No change |
| 30% – 70%      | MERGE: union properties, but flag entity for user review | Lower to 0.50 – 0.65 |
| < 30%           | SEPARATE: likely different concepts with same name → call request-clarification | — |

Property overlap = |intersection of property names| / |union of property names|

### Confidence Scoring Standard

| Evidence Source | Score Range | Example |
|----------------|------------|---------|
| Column → Property (structured file, direct mapping) | 0.85 – 0.95 | CSV column "order_id" → Property orderId |
| Table → ObjectType (SQL DDL with PK defined) | 0.90 – 0.95 | CREATE TABLE orders → OT Order |
| Foreign key → LinkType | 0.80 – 0.90 | customer_id FK → "Order belongsTo Customer" |
| Entity from document (explicitly named) | 0.60 – 0.75 | "The system manages **Customers** and **Orders**" |
| Entity from document (inferred from context) | 0.45 – 0.60 | "Users can place purchases" → OT Purchase |
| Cross-file merge (high property overlap) | 0.75 – 0.85 | Customer in both CSV and DDL, 80% overlap |
| Cross-file merge (medium overlap) | 0.50 – 0.65 | Customer in CSV and PDF, 50% overlap |
| Best practice suggestion (no direct evidence) | 0.35 – 0.55 | "E-commerce domains usually have a Category OT" |

### Clarification Decision Standards

**CALL request-clarification** when:
- Same entity name in 2+ files with 30–70% property overlap (ambiguous merge)
- Relationship cardinality matters but cannot be inferred (no FK, no UNIQUE)
- Critical domain term is ambiguous and affects modeling of 3+ entities

**DO NOT call request-clarification** for:
- Property type ambiguity (string vs integer) → lower confidence instead
- Non-critical naming choices → apply PascalCase convention
- Audit field inclusion → exclude by default
- Single-file analysis → no cross-file conflicts possible

**Hard limit**: Maximum 3 clarification requests per build session.
Exceeding this degrades user experience. If uncertain, choose the more
conservative option and assign lower confidence.

### Post-Build Self-Assessment

After completing Step 5, evaluate the blueprint:

1. **Coverage check**: Did every uploaded file contribute at least one entity?
   - If a file produced 0 entities, note it in the summary as a warning.

2. **Relationship check**: Are there entity pairs that likely have a relationship
   but no LinkType was created? Common patterns:
   - Parent-child (Order → OrderItem)
   - Ownership (Customer → Order)
   - Reference (Product → Category)

3. **Property sufficiency**: Does any entity have fewer than 2 properties?
   This usually means the entity is underspecified.

4. **Summary format**: Include in the done event:
   - "Generated N object types, M link types from K files"
   - Any warnings (skipped files, low-confidence merges, missing relationships)
   - Suggestions for Phase 2 tuning (if issues found)
```

### 5.2 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| **步骤顺序固定** | 6 步写死，不允许 Agent 跳过或重排 | 确定性优先——自主构建的可靠性比灵活性重要 |
| **结构化文件零 LLM** | parse-csv/excel/ddl 不消耗 LLM token | Token 经济——结构化解析已有 Python 代码处理 |
| **合并规则用百分比** | 70%/30% 阈值 | 可操作——Agent 能按属性名交集/并集计算 |
| **置信度用区间** | 0.85-0.95 而非固定值 | 区间内 Agent 有微调空间，但方向明确 |
| **澄清硬限制 3 次** | 不可商量的上限 | 用户体验——超过 3 次打断会让用户失去耐心 |
| **自评估为必做步骤** | 不是建议，是指令 | 质量兜底——Phase 2 调优的前提是知道哪里不足 |

---

## 六、Layer 3：动态上下文层

**生成位置**：`app/services/agent_service.py` 的 `_build_context_prompt()` 方法
**加载时机**：每次 Agent 调用时动态生成
**Token 预算**：~300-500 tokens（视数据量）

### 6.1 当前实现

```python
# agent_service.py（当前，~3 行）
@staticmethod
def _build_context_prompt(orm) -> str:
    parts = []
    if orm.domain:
        parts.append(f"Business domain: {orm.domain}")
    if orm.goal:
        parts.append(f"Modeling goal: {orm.goal}")
    if orm.scope_hint:
        parts.append(f"Scope hint: {orm.scope_hint}")
    return "\n".join(parts) if parts else ""
```

### 6.2 增强设计

```python
@staticmethod
def _build_context_prompt(
    session_orm,
    materials: list | None = None,
    existing_ots: list | None = None,
    build_mode: bool = False,
) -> str:
    """
    构建动态上下文 Prompt。

    Chat 模式：仅注入 domain/goal/scope
    Build 模式：额外注入素材清单和已有本体摘要
    """
    sections = []

    # --- 会话元数据 ---
    sections.append("## Session Context")
    if session_orm.domain:
        sections.append(f"- Business domain: {session_orm.domain}")
    if session_orm.goal:
        sections.append(f"- Modeling goal: {session_orm.goal}")
    if session_orm.scope_hint:
        sections.append(f"- Scope: {session_orm.scope_hint}")

    # --- Build 模式专属 ---
    if build_mode:
        # 素材清单（Agent 需要知道要分析哪些文件）
        if materials:
            sections.append("")
            sections.append("## Uploaded Materials")
            for m in materials:
                size_kb = m.file_size // 1024
                sections.append(
                    f"- **{m.file_name}** ({m.file_type}, {size_kb}KB)"
                    f" [rid: {m.rid}]"
                )
            sections.append(f"\nTotal: {len(materials)} file(s)")

        # 已有本体摘要（去重比对用）
        if existing_ots:
            sections.append("")
            sections.append("## Existing Ontology (avoid creating duplicates)")
            for ot in existing_ots[:30]:  # 最多 30 个，防止 token 膨胀
                sections.append(
                    f"- {ot.display_name} (apiName: {ot.api_name})"
                )
            if len(existing_ots) > 30:
                sections.append(
                    f"... and {len(existing_ots) - 30} more."
                    " Use search-ontology skill to check before creating."
                )

    return "\n".join(sections)
```

### 6.3 示例输出

**Chat 模式**：
```
## Session Context
- Business domain: 电商零售
- Modeling goal: 建立完整的订单管理本体
- Scope: 订单、客户、产品三个核心模块
```

**Build 模式**：
```
## Session Context
- Business domain: 电商零售
- Modeling goal: 建立完整的订单管理本体
- Scope: 订单、客户、产品三个核心模块

## Uploaded Materials
- **orders.csv** (text/csv, 245KB) [rid: ri.ontology.agent-material.abc123]
- **products.xlsx** (application/vnd.openxmlformats..., 128KB) [rid: ri.ontology.agent-material.def456]
- **customer_schema.sql** (text/plain, 12KB) [rid: ri.ontology.agent-material.ghi789]

Total: 3 file(s)

## Existing Ontology (avoid creating duplicates)
- 产品分类 (apiName: ProductCategory)
- 仓库 (apiName: Warehouse)
```

---

## 七、Layer 4：Skill 详情层

Skill 详情通过 deepagents 的渐进式加载机制按需读取，**不占用系统 Prompt token**。Agent 在决定使用某个 Skill 时，通过 `read_file` 读取完整 SKILL.md 内容。

### 7.1 新增 Skill

#### request-clarification

**文件路径**：`apps/server/app/agent/skills/request-clarification/SKILL.md`（新增）

```yaml
---
name: request-clarification
description: 在自主构建过程中遇到歧义时向用户请求澄清，调用后 Agent 暂停等待回答
---

# request-clarification

在自主构建（Build 模式）过程中，当遇到无法自主决策的歧义时，
调用此 skill 向用户提出结构化问题。

## 调用方式

这是一个特殊 skill——调用后 Agent 执行会**暂停**（通过 deepagents interrupt_on 机制），
等待用户在前端浮层中选择答案后恢复。

调用时，使用 `request_clarification` 工具并传入以下参数：

## 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| question | string | 是 | 澄清问题（中文，简明扼要，1-2 句话） |
| context | string | 否 | 补充说明（为什么会有歧义，帮助用户理解） |
| options | array | 是 | 2-4 个选项，每项含 value (string) 和 label (string) |
| allowFreeText | boolean | 否 | 是否允许用户输入自由文本，默认 true |

## 参数格式示例

```json
{
  "question": "\"客户\" 在两个文件中结构差异较大，请选择处理方式",
  "context": "orders.csv 中的客户有 5 个字段，crm_data.xlsx 中有 12 个字段，重叠仅 3 个",
  "options": [
    {"value": "merge", "label": "同一实体（合并所有属性）"},
    {"value": "split", "label": "拆为两种客户类型（OrderCustomer + CrmCustomer）"},
    {"value": "primary_crm", "label": "以 CRM 数据为主，忽略订单中的客户字段"}
  ],
  "allowFreeText": true
}
```

## 使用准则

### 必须调用的场景
- 同名实体跨文件属性重叠率 30-70%（合并 vs 拆分不确定）
- 关系基数无法推断且影响核心建模（如"一对多"vs"多对多"）
- 关键领域术语含义不明且影响 3 个以上实体的建模

### 禁止调用的场景
- 属性类型不确定（降低置信度即可）
- 命名选择犹豫（按 PascalCase 规范决策）
- 是否包含审计字段（默认排除）
- 只涉及单个文件的分析（无跨文件冲突）

### 硬限制
- 单次构建最多 3 次澄清请求
- 问题必须用中文，选项 label 也用中文
- 选项数量 2-4 个，过多会让用户选择困难
```

#### suggest-improvements

**文件路径**：`apps/server/app/agent/skills/suggest-improvements/SKILL.md`（新增）

```yaml
---
name: suggest-improvements
description: 在 Phase 2 中对已完成的蓝图提出调优建议，以 Chat 建议卡片形式推送
---

# suggest-improvements

蓝图构建完成进入 Phase 2 后，Agent 可通过此 skill 向用户推送调优建议。
建议以 Chat 面板中的"建议卡片"形式呈现，用户可 Accept/Edit/Reject。

## 建议类型

| 类型 | 说明 | 典型场景 |
|------|------|---------|
| add_entity | 建议新增缺失的对象类型 | 常见领域模式中应该存在但蓝图中没有的 OT |
| add_property | 建议给现有 OT 补充属性 | 属性过少（<3 个）的 OT |
| add_link | 建议新增关系 | 应该有关联但缺少 LinkType 的实体对 |
| rename | 建议更名 | apiName 不符合规范或含义不清 |
| merge | 建议合并两个相似的 OT | 低置信度合并未执行的情况 |
| split | 建议拆分过于宽泛的 OT | 属性过多（>15 个）且语义分散 |

## 输出格式

每条建议作为一条 Assistant 消息发送，格式：

```
[SUGGESTION]
type: add_link
target: Order, Product
summary: 订单与产品之间缺少关联关系
detail: Order 有 product_id 属性，但未创建对应的 LinkType。建议创建 "Order contains Product" 链接类型，基数为 many-to-many。
confidence: 0.82
[/SUGGESTION]
```

前端解析 [SUGGESTION] 标记，渲染为可操作的建议卡片。

## 触发时机

1. 用户进入 Phase 2 后，Agent 首条消息包含构建摘要 + 自动调优建议
2. 用户在 Chat 中提问时，Agent 可在回答中附带相关建议
3. 用户明确要求"检查蓝图质量"或"有什么改进建议"时
```

### 7.2 现有 Skill 增强

#### analyze-materials 增强点

在现有 SKILL.md 末尾追加：

```markdown
## SubAgent 并行分析模式

当 Session Context 中列出 2+ 个素材文件时，应使用 SubAgent 并行分析：

1. 为每个文件调用 `task(subagent_type="file-analyzer", objective="分析 {filename}")`
2. 等待所有 SubAgent 返回结果
3. 聚合候选实体列表
4. 按 Entity Merge Rules（见 Autonomous Build Mode）处理跨文件重复

## 候选实体标准化输出格式

每个文件的分析结果必须包含：
- entities[]: 候选实体数组，每项含 name, properties[], confidence, evidenceSource
- relationships[]: 候选关系数组，每项含 from, to, label, cardinality, confidence
- summary: 一句话描述该文件的内容

此格式确保 SubAgent 并行分析后主 Agent 能可靠地聚合结果。
```

#### generate-blueprint 增强点

在现有 SKILL.md 末尾追加：

```markdown
## 去重比对

在生成蓝图前，检查 Session Context 中的 "Existing Ontology" 列表：
- 如果候选 OT 的 apiName 与已有 OT 完全相同 → 跳过（不重复创建）
- 如果候选 OT 的 displayName 与已有 OT 相同但 apiName 不同 → 标记为可能冲突，降低置信度

## 蓝图项排序

BlueprintItems 的 sort_order 规则：
1. ObjectType 项在前，按置信度降序
2. Property 项紧跟其父 ObjectType
3. LinkType 项最后，按置信度降序

此排序确保前端画布的结晶动画是"先出现核心实体，再出现关系"的视觉叙事。
```

---

## 八、SubAgent Prompt 设计

### 8.1 自定义 file-analyzer SubAgent

当前 engine.py 仅注册了默认的 `general-purpose` SubAgent。自主构建需要一个专用的 `file-analyzer` SubAgent，确保并行文件分析的输出格式一致。

**注册方式**（engine.py 变更）：

```python
FILE_ANALYZER_SUBAGENT = SubAgent(
    name="file-analyzer",
    description="分析单个上传文件，提取本体候选实体和关系。输出结构化 JSON。",
    system_prompt="""You are a file analysis specialist for ontology building.

## Your Task

Analyze a single uploaded file and extract ontology candidates.
You will be given the file path and type. Use the appropriate parser skill.

## Output Format

Your FINAL message must be valid JSON with this structure:

```json
{
  "entities": [
    {
      "name": "Order",
      "displayName": "订单",
      "properties": [
        {"name": "orderId", "displayName": "订单编号", "type": "string", "isPrimaryKey": true},
        {"name": "totalAmount", "displayName": "总金额", "type": "double"}
      ],
      "confidence": 0.92,
      "evidenceSource": "field_analysis"
    }
  ],
  "relationships": [
    {
      "from": "Order",
      "to": "Customer",
      "label": "placedBy",
      "displayLabel": "下单客户",
      "cardinality": "many-to-one",
      "confidence": 0.85,
      "evidence": "customer_id foreign key column"
    }
  ],
  "fileInfo": {
    "fileName": "orders.csv",
    "rowCount": 15000,
    "columnCount": 12
  },
  "summary": "电商订单数据，包含订单基本信息和客户关联"
}
```

## Rules

- Entity names: PascalCase (Order, CustomerProfile)
- Property names: camelCase (orderId, totalAmount)
- Display names: Chinese
- EXCLUDE audit fields: created_at, updated_at, deleted_at, created_by, modified_by
- Mark primary key candidates (columns with id, _id, Id, rid)
- Infer foreign keys from column naming patterns (_id suffix)
- For structured files (CSV, Excel, DDL): trust parser output, map directly
- For unstructured files (PDF, DOCX): extract only EXPLICITLY mentioned entities,
  do not over-infer from vague descriptions
- Confidence scoring: follow the Confidence Scoring Standard in your skills library
""",
)
```

### 8.2 SubAgent vs 主 Agent 的职责边界

```
file-analyzer SubAgent（并行，每文件一个）：
  ✅ 解析单个文件
  ✅ 提取该文件中的候选实体和关系
  ✅ 标准化输出为 JSON
  ❌ 不做跨文件合并
  ❌ 不创建 Blueprint/BlueprintItem
  ❌ 不调用 request-clarification

主 Agent（串行，全局编排）：
  ✅ 规划构建步骤
  ✅ 派生 SubAgent 并行分析
  ✅ 聚合跨文件结果 + 合并去重
  ✅ 调用 request-clarification（如需）
  ✅ 生成蓝图 + 创建蓝图项
  ✅ 自评估 + 发送完成信号
```

---

## 九、Token 预算全景

### 9.1 系统 Prompt Token 分配

| 组件 | Chat 模式 | Build 模式 | 说明 |
|------|----------|-----------|------|
| **Layer 0**: BASE_AGENT_PROMPT | 1,500 | 1,500 | 不可改 |
| **Layer 0**: SKILLS_SYSTEM_PROMPT | 3,200 | 3,500 | Build 多 2 个 Skill（+300） |
| **Layer 0**: TASK_SYSTEM_PROMPT | 2,300 | 2,500 | Build 多 file-analyzer SubAgent（+200） |
| **Layer 0**: TodoList | 300 | 300 | 不变 |
| **Layer 1**: ontology_builder.md | 1,200 | 1,200 | 始终加载 |
| **Layer 2**: autonomous_build.md | — | 2,500 | 仅 Build |
| **Layer 3**: context_prompt | 200 | 500 | Build 含素材清单 |
| **合计** | **~8,700** | **~12,000** | |
| **占 100K 预算** | **8.7%** | **12.0%** | |
| **可用于对话+推理** | **~91K** | **~88K** | |

### 9.2 Skill 详情 Token 消耗（按需，不占系统 Prompt）

当 Agent 决定使用某个 Skill 时，`read_file` 读取的 SKILL.md 消耗对话 token：

| Skill | 估算 Token | 调用频率 |
|-------|-----------|---------|
| analyze-materials | ~1,500 | 1 次/构建 |
| generate-blueprint | ~1,200 | 1 次/构建 |
| parse-csv | ~800 | 每 CSV 文件 1 次 |
| parse-excel | ~800 | 每 Excel 文件 1 次 |
| parse-ddl | ~800 | 每 SQL 文件 1 次 |
| request-clarification | ~900 | 0-3 次/构建 |
| batch-create-from-blueprint | ~1,000 | 1 次/构建 |

典型 3 文件构建的 Skill 读取成本：~6K tokens（占总预算 6%）。

---

## 十、Prompt 组合时序图

### 10.1 Build 模式的 Prompt 组装流程

```python
# agent_service.py build_ontology() 方法中

# 1. 获取会话信息
session_orm = await storage.get_session(session_rid)

# 2. 获取素材清单
materials = await material_storage.list_by_session(session_rid)

# 3. 获取已有本体摘要
existing_ots = await object_type_service.list_all(session_orm.ontology_rid)

# 4. 构建动态上下文（Layer 3）
context = self._build_context_prompt(
    session_orm,
    materials=materials,
    existing_ots=existing_ots,
    build_mode=True,
)

# 5. 创建 Agent（engine.py 内部组装 Layer 1 + Layer 2）
agent = engine.create_agent(
    session_rid,
    system_prompt=context,
    build_mode=True,  # → 加载 autonomous_build.md + interrupt_on + file-analyzer
)

# 6. deepagents 自动追加 Layer 0（BASE_AGENT_PROMPT + Skills + SubAgent + TodoList）

# 7. 最终系统消息 = Layer 3 + Layer 1 + Layer 2 + Layer 0
#    ≈ 12K tokens
```

### 10.2 完整 Prompt 拼装顺序（LLM 看到的）

```
[Layer 3] ## Session Context
          - Business domain: 电商零售
          - Modeling goal: 建立完整的订单管理本体
          ...
          ## Uploaded Materials
          - orders.csv (text/csv, 245KB)
          ...
          ## Existing Ontology
          - 产品分类 (apiName: ProductCategory)
          ...

[Layer 1] # Ontology Builder Agent
          You are an expert in enterprise data modeling...
          ## Domain Concepts
          ...
          ## Naming Conventions
          ...

[Layer 2] ## Autonomous Build Mode
          You are in AUTONOMOUS BUILD MODE...
          ### Step 1 — PLAN
          ...
          ### Entity Merge Rules
          ...
          ### Confidence Scoring Standard
          ...

[Layer 0] You are a Deep Agent...（BASE_AGENT_PROMPT）

[Layer 0] ## Skills System（20+ 个 Skill 清单）

[Layer 0] ## task (subagent spawner)
          Available agents:
          - "general-purpose": ...
          - "file-analyzer": 分析单个上传文件...
```

---

## 十一、与 07-agent-autonomous-building.md 的关系

| 07 文档章节 | 本文档对应章节 | 关系 |
|------------|-------------|------|
| §8 系统 Prompt 增强方案 | §四（Layer 1）+ §五（Layer 2） | 本文档是 §8 的完整展开，提供具体 Prompt 内容 |
| §4 自主构建编排流程 | §五 Step 1-6 | 编排流程相同，本文档加入了 Prompt 视角的指导 |
| §6 澄清交互机制 | §七 request-clarification Skill | 07 定义了机制，本文档定义了 Prompt 和触发标准 |
| §7 Token 预算管理 | §九 Token 预算全景 | 本文档细化了系统 Prompt 层面的 token 分配 |
| §10 代码变更清单 | §十 Prompt 组合时序图 | 本文档补充了 Prompt 组装的代码变更 |

---

## 附录

### A. 文件清单

| 文件路径 | 状态 | 加载时机 |
|---------|------|---------|
| `app/agent/prompts/ontology_builder.md` | 重构 | 始终 |
| `app/agent/prompts/autonomous_build.md` | 新增 | Build 模式 |
| `app/agent/skills/request-clarification/SKILL.md` | 新增 | 按需 |
| `app/agent/skills/suggest-improvements/SKILL.md` | 新增 | 按需 |
| `app/agent/skills/analyze-materials/SKILL.md` | 增强 | 按需 |
| `app/agent/skills/generate-blueprint/SKILL.md` | 增强 | 按需 |
| `app/services/agent_service.py` | 修改 | 运行时 |
| `app/agent/engine.py` | 修改 | 运行时 |

### B. Prompt 内容检查清单

实现阶段完成后，检查以下一致性：

- [ ] Layer 1 的命名规范与 Layer 4 各 Skill 中的命名指导一致
- [ ] Layer 2 的置信度区间与 Layer 4 analyze-materials 中的评分指导一致
- [ ] Layer 2 的澄清标准与 Layer 4 request-clarification 的使用准则一致
- [ ] Layer 3 的素材清单格式包含 rid，Agent 可直接引用
- [ ] file-analyzer SubAgent 的 JSON 输出格式与主 Agent 的 analyze-materials 聚合逻辑兼容
- [ ] 所有用户可见文本（display name、question、summary）使用中文
