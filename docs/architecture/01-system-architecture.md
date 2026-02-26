# 01 - System Architecture / 系统架构

## Architecture Overview

Open Ontology 采用分层架构，从上到下分为 5 层：

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Consumption Layer（消费层）                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Ontology │  │  OSDK    │  │  MCP Server  │  │  REST API     │  │
│  │ Manager  │  │ (codegen)│  │ (Agent 接口) │  │ (通用接口)    │  │
│  │  (Web)   │  │          │  │              │  │               │  │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘  └───────┬───────┘  │
└───────┼──────────────┼───────────────┼──────────────────┼──────────┘
        │              │               │                  │
┌───────┴──────────────┴───────────────┴──────────────────┴──────────┐
│                     Service Layer（服务层）                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────┐  │
│  │ Ontology    │  │ Change Mgmt  │  │  Search    │  │ Security │  │
│  │ Service     │  │ Service      │  │  Service   │  │ Service  │  │
│  │(CRUD + 校验)│  │(版本+变更管理)│  │(全文+语义) │  │(认证+授权)│  │
│  └──────┬──────┘  └──────┬───────┘  └─────┬──────┘  └────┬─────┘  │
└─────────┼────────────────┼────────────────┼──────────────┼─────────┘
          │                │                │              │
┌─────────┴────────────────┴────────────────┴──────────────┴─────────┐
│                     Domain Layer（领域层）                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Ontology Domain Model                    │   │
│  │  ObjectType  Property  LinkType  ActionType  Interface ...  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Schema Registry                          │   │
│  │      (类型系统、校验规则、Schema 序列化/反序列化)            │   │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
┌────────────────────────────────┴────────────────────────────────────┐
│                     Storage Layer（存储层）                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Schema Store │  │ Search Index │  │ Change History Store     │  │
│  │(Ontology 定义)│  │(全文/语义索引)│  │(版本历史 + 审计日志)     │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                 │
┌────────────────────────────────┴────────────────────────────────────┐
│                     Data Source Layer（数据源层）                     │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────────┐   │
│  │ Database  │  │   CSV     │  │   API     │  │  Object Store │   │
│  │ (PG/MySQL)│  │  /Excel   │  │ (REST)   │  │   (S3/OSS)   │   │
│  └───────────┘  └───────────┘  └───────────┘  └───────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Layer Responsibilities

### Layer 1: Data Source Layer（数据源层）

**职责**: 底层数据的实际存储，Open Ontology 不拥有这一层，而是连接到它。

- 在 MVP 阶段，支持手动配置数据源连接（Database / CSV / API）
- 对象类型的属性值最终来自于这些数据源
- 每个数据源只能支撑一个对象类型（与 Palantir 一致的约束）

**MVP 范围**: 数据源管理是基础功能，但 MVP 聚焦于 Ontology Schema 的管理，数据源连接可以是简化版。

### Layer 2: Storage Layer（存储层）

**职责**: Ontology 自身元数据的持久化。

```
Schema Store (Ontology 定义存储)
├── 存储所有 Ontology 资源定义（Object Type, Property, Link Type 等）
├── 以 JSON 格式存储声明式 Schema
└── 支持事务性读写

Search Index (搜索索引)
├── 全文搜索索引（Object Type / Property / Link Type 的名称和描述）
├── 未来：向量索引用于语义搜索（Agent 场景）
└── 支持 Ontology Manager 中的搜索功能

Change History Store (变更历史)
├── 每次 Schema 变更的快照
├── 变更人、变更时间、变更内容
└── 支持回滚到任意历史版本
```

### Layer 3: Domain Layer（领域层）

**职责**: Ontology 的核心领域模型和业务规则。这是整个系统的心脏。

- **Ontology Domain Model**: 定义所有一等公民实体（详见 02-domain-model.md）
- **Schema Registry**: 管理类型系统、校验规则、序列化/反序列化
- 所有 Schema 校验逻辑集中在此层（ID 格式校验、唯一性校验、API Name 保留字检查等）

### Layer 4: Service Layer（服务层）

**职责**: 业务逻辑编排，面向上层消费者提供统一的服务接口。

```
Ontology Service (本体服务)
├── Object Type CRUD + 校验
├── Property CRUD + 映射管理
├── Link Type CRUD + 基数/外键管理
├── 导入/导出（JSON Schema）
└── 对象类型复制

Change Management Service (变更管理服务)
├── Working State 管理（未保存的变更）
├── Save（发布变更）
├── Review Edits（审阅编辑）
├── Merge Conflict Detection & Resolution
├── History & Rollback
└── Discard Changes

Search Service (搜索服务)
├── 按名称/描述/API Name 搜索所有资源
├── 按资源类型筛选
├── 按状态/可见性筛选
└── 未来：语义搜索（Agent 场景）

Security Service (安全服务)
├── 用户认证（集成外部 IdP）
├── 角色管理（Owner/Editor/Viewer/Discoverer）
├── 资源级权限检查
└── 审计日志
```

### Layer 5: Consumption Layer（消费层）

**职责**: 面向不同消费者的接入方式。

```
Ontology Manager (Web UI)
├── MVP 的核心交付物
├── 基于 React 的 SPA
├── 提供 Object Type / Link Type / Property 的可视化管理
└── 变更管理、搜索、导入导出

REST API (通用 API)
├── RESTful API，JSON 格式
├── 提供与 Ontology Manager 相同的功能
├── 供第三方应用集成
└── 供 OSDK 的后端支撑

MCP Server (Agent 接口)
├── 实现 Model Context Protocol
├── 将 Ontology 暴露为 Resources + Tools + Prompts
├── 供 AI Agent 框架（Claude Code, LangChain 等）接入
└── 详见 03-agent-context-architecture.md

OSDK (Code Generation)
├── 从 Ontology Schema 生成类型安全的 SDK
├── 支持 TypeScript / Python
├── 供开发者以编程方式操作 Ontology
└── 后期功能，MVP 不实现
```

## Key Architecture Decisions

### AD-1: Schema-Data Separation（Schema 与数据分离）

Ontology Manager 管理的是 **Schema**（对象类型定义、属性映射、链接类型定义），不直接管理底层数据。这一决策使得：

- Schema 可以独立于数据进行版本管理
- Schema 变更不需要触发数据迁移
- 同一套数据可以有不同的语义视图

### AD-2: Working State Pattern（工作状态模式）

借鉴 Palantir，所有 Schema 变更先进入 Working State，需要显式 Save 才生效：

```
Edit → Working State (本地) → Save → Published State (全局)
                ↓
            Discard (丢弃)
```

这允许用户在保存前自由编辑、审阅和回滚。

### AD-3: Event-Driven Change Tracking（事件驱动的变更追踪）

每个 Schema 变更生成一个 Change Event：

```json
{
  "id": "chg-001",
  "timestamp": "2024-01-15T10:00:00Z",
  "user": "user-123",
  "resourceType": "ObjectType",
  "resourceId": "employee",
  "changeType": "UPDATE",
  "before": { ... },
  "after": { ... }
}
```

这支撑了：History 查看、Rollback、审计日志、合并冲突检测。

### AD-4: Ontology as a Graph（本体即图）

虽然存储层可以使用关系型数据库，但领域模型本质上是一个图：

- **节点**: Object Types, Properties, Link Types, Action Types, Interfaces
- **边**: "has property", "linked by", "has action", "implements interface"

这个图结构是 Agent 上下文管理的基础（详见 03-agent-context-architecture.md）。

### AD-5: Three-Tier Naming（三层命名体系）

每个 Ontology 资源有三个标识：

| Tier | Purpose | Example | Mutability |
|------|---------|---------|------------|
| RID (Resource ID) | 系统唯一标识 | `ri.ontology.object-type.abc123` | 不可变 |
| API Name | 开发者引用 | `Employee` | 可变（active 后不可改） |
| Display Name | 用户界面展示 | `员工` / `Employee` | 随时可改，支持 i18n |

## MVP Architecture Scope

对于 v0.1.0 MVP，架构范围聚焦于：

```
✅ MVP 范围:
├── Ontology Manager Web UI（前端）
├── Ontology Service（Object Type + Link Type CRUD）
├── Change Management Service（Working State + Save + History）
├── Search Service（基础全文搜索）
├── REST API（基础 CRUD）
├── Schema Store（关系型数据库）
├── Change History Store
└── JSON Import/Export

⬜ 后续版本:
├── MCP Server（Agent 接口）
├── OSDK 代码生成
├── Security Service（完整的 RBAC + MAC）
├── 向量索引 + 语义搜索
├── Data Source 实际连接 + 数据同步
├── Action Type 执行引擎
└── Function Runtime
```

## Deployment Architecture (MVP)

MVP 采用最简单的部署模式：

```
┌─────────────────────────────────────┐
│          Browser (SPA)              │
│      Ontology Manager (React)       │
└──────────────┬──────────────────────┘
               │ HTTP/REST
┌──────────────┴──────────────────────┐
│   Application Server (FastAPI)      │
│   ┌───────────────────────────┐     │
│   │    REST API + Services    │     │
│   └────────────┬──────────────┘     │
│                │                    │
│   ┌────────────┴──────────────┐     │
│   │    Domain Model Layer     │     │
│   └────────────┬──────────────┘     │
└────────────────┼────────────────────┘
                 │
┌────────────────┴────────────────────┐
│          PostgreSQL                  │
│   ┌──────────┐  ┌──────────────┐    │
│   │  Schema  │  │   History    │    │
│   │  Store   │  │   Store      │    │
│   └──────────┘  └──────────────┘    │
└─────────────────────────────────────┘
```

后续可演进为微服务架构，但 MVP 阶段单体应用足够。
