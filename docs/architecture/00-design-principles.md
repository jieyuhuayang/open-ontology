# 00 - Design Principles / 设计原则

## From First Principles: Why Ontology?

Every个企业决策都可以分解为四个维度：**Data**（数据）、**Logic**（逻辑）、**Action**（动作）、**Security**（安全）。Ontology 的本质是为这四个维度提供一个**统一的语义抽象层**，使人类用户和 AI agent 能用同一套业务术语理解和操作数据。

### The Core Problem

```
Without Ontology:                    With Ontology:

  App A ──→ DB Table "t_emp"           App A ──→ ┌─────────────┐
  App B ──→ API "/users"               App B ──→ │  Employee    │ ──→ Data Sources
  Agent ──→ ???                        Agent ──→ │  (Ontology)  │
                                                 └─────────────┘
  每个消费者各自理解数据               所有消费者共享语义模型
```

## Core Design Principles

### P1: Semantic Abstraction over Raw Data（语义抽象优于原始数据）

**Palantir's Key Insight**: 将表格数据（行和列）抽象为业务概念（对象、属性、链接），是 Ontology 的根基。

- 对象类型（Object Type）不是"表"，而是"业务实体"
- 属性（Property）不是"列"，而是"特征/状态/度量"
- 链接类型（Link Type）不是"外键"，而是"语义关系"

**For Open Ontology**: Schema 定义与底层数据存储分离。Ontology Manager 管理的是语义模型，不直接管理数据。

### P2: Single Source of Truth（单一事实来源）

一个 Space 内的所有应用、所有用户、所有 Agent 共享同一个 Ontology。不存在"分析 Ontology"和"应用 Ontology"的区分。

- 一个组织可以有多个 Space，但每个 Space 有且仅有一个 Ontology
- 所有消费者（UI 应用、API 客户端、AI Agent）都通过同一套 Ontology 访问数据

### P3: Agent as First-Class Citizen（Agent 作为一等公民）

**This is where we go beyond Palantir.** Palantir 的 AIP 是后来嫁接的；Open Ontology 从第一天起就为 Agent 设计。

- Ontology 的每个元素（对象类型、属性、链接类型）都应该有清晰的自然语言描述，不仅给人看，也给 Agent 理解
- Ontology Schema 应该能以结构化方式（JSON/MCP Resource）注入 Agent 上下文
- Agent 对 Ontology 的操作应该和人类用户一样受安全策略约束

### P4: Type Safety and Code Generation（类型安全与代码生成）

借鉴 Palantir OSDK 的理念：从 Ontology Schema 自动生成类型安全的客户端代码。

- 三层命名体系：RID（系统唯一标识）/ API Name（开发者友好）/ Display Name（用户友好，可国际化）
- Ontology Schema 是一个强类型契约，可以生成 TypeScript/Python SDK
- 编译期捕获错误，而不是运行时

### P5: Actions as the Write Path（动作作为写入路径）

所有对 Ontology 数据的变更必须通过 Action Type 完成，不允许直接写入。

- Action 是事务性的（原子操作）
- Action 是可验证的（前置/后置条件）
- Action 是可审计的（完整的执行日志）
- Action 是可授权的（谁能执行什么动作）

**For Agents**: Agent 只能通过 Action 修改数据，和人类用户一样受约束。

### P6: Security Woven In, Not Bolted On（安全内建而非外挂）

安全不是功能完成后再加的一层，而是架构的基本组成部分。

- **强制控制（MAC）**: Organization + Markings = 无法绕过的访问限制
- **自主控制（DAC）**: Roles = 灵活的权限授予
- **Agent 安全继承**: AI Agent 继承调用用户的安全上下文

### P7: Open and Extensible（开放与可扩展）

与 Palantir 的封闭生态不同，Open Ontology 是开源的：

- 开放的 API 协议（REST + MCP）
- 可插拔的数据源适配器
- 可插拔的存储后端
- 可扩展的属性类型系统

### P8: Declarative over Imperative（声明式优于命令式）

Ontology 定义是声明式的：你声明"存在一个 Employee 对象类型，由这个数据集支撑，属性映射如下"，而不是编写命令式代码来获取和转换数据。

- Schema 定义是声明式的 JSON/YAML
- 属性映射是声明式的
- 安全策略是声明式的
- 导入/导出是基于声明式 Schema 的

## Anti-Patterns to Avoid

| Anti-Pattern | Why to Avoid | What to Do Instead |
|---|---|---|
| Raw SQL/API exposure to agents | 不安全，无语义，agent 容易出错 | 通过 Ontology 语义层暴露 |
| Separate "AI data layer" | 语义漂移，数据不一致 | 人和 Agent 用同一个 Ontology |
| Security as middleware only | 可被绕过，且 Agent 场景更容易出问题 | 安全内建到每一层 |
| Mutable schema without versioning | 破坏下游应用 | Status lifecycle + 变更管理 |
| Imperative ontology definitions | 难以序列化、对比、合并 | 声明式 Schema |
