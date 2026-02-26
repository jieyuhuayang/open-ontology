# 04 - Tech Stack Recommendations / 技术栈建议

## Guiding Criteria

技术选型遵循以下原则：
1. **MVP 速度优先**: 选择成熟、社区活跃的技术栈
2. **开源友好**: 所有组件必须是开源或有开源替代
3. **Agent 生态兼容**: 能方便地与主流 Agent 框架集成
4. **可演进**: 不锁死在某个技术上，允许后续替换

## Recommended Tech Stack

### Frontend: Ontology Manager Web UI

| Choice | Technology | Rationale |
|--------|-----------|-----------|
| **Framework** | React 18+ with TypeScript | 最成熟的 SPA 生态，TS 提供类型安全 |
| **UI Library** | Ant Design 5.x 或 Shadcn/ui | Ant Design 适合后台管理系统，中文社区强；Shadcn/ui 更现代、可定制性强 |
| **State Mgmt** | Zustand 或 React Query | 轻量级，适合 CRUD 应用 |
| **Router** | React Router v6 | 标准选择 |
| **Graph Viz** | ReactFlow 或 D3.js | 用于链接类型图（Link Type Graph）可视化 |
| **Build Tool** | Vite | 快速开发体验 |
| **i18n** | react-intl 或 i18next | 支持中英文国际化 |

### Backend: Application Server

| Choice | Technology | Rationale |
|--------|-----------|-----------|
| **Language** | TypeScript (Node.js) 或 Python (FastAPI) | 两者都有优势，见下方比较 |
| **API Style** | REST (OpenAPI 3.0) | MVP 阶段 REST 足够，后续可加 GraphQL |
| **Validation** | Zod (TS) 或 Pydantic (Python) | Schema 校验与类型安全 |
| **ORM** | Prisma (TS) 或 SQLAlchemy (Python) | 类型安全的数据库操作 |
| **Auth** | JWT + 外部 IdP 集成 | MVP 可以简化为 JWT，后续集成 OIDC |

**Backend Language Comparison:**

| Factor | TypeScript (Node.js) | Python (FastAPI) |
|--------|---------------------|------------------|
| 前后端共享类型 | ✅ 天然共享 TS 类型 | ❌ 需要代码生成 |
| Agent 生态 | MCP SDK 原生支持 TS | LangChain/LangGraph 生态更丰富 |
| 性能 | 适合 I/O 密集 | 适合 CPU 密集（ML/数据处理） |
| 社区规模 | Web 开发主流 | AI/Data 开发主流 |
| OSDK 代码生成 | 天然支持生成 TS SDK | 需要额外工具 |

**Recommendation**: TypeScript 全栈（前后端统一语言，类型共享，MCP SDK 原生支持）。如果团队 Python 能力更强且重视 Agent 生态，FastAPI 也是好选择。

### Database: Storage Layer

| Choice | Technology | Rationale |
|--------|-----------|-----------|
| **Primary DB** | PostgreSQL 16+ | 成熟、功能强大、JSONB 支持好 |
| **Search** | PostgreSQL Full-Text Search (MVP) → Elasticsearch/Meilisearch (后续) | MVP 用 PG 内置全文搜索足够 |
| **Vector Index** | pgvector (后续) | Agent 语义搜索用，MVP 不需要 |
| **Cache** | Redis (可选) | MVP 可能不需要 |

**为什么选 PostgreSQL 作为唯一存储:**

MVP 阶段，所有存储需求都可以用 PostgreSQL 满足：
- Schema Store: 关系表 + JSONB 列存储灵活的元数据
- Change History: 事件溯源表
- Full-Text Search: `tsvector` + GIN 索引
- 后续加 pgvector 扩展支持向量搜索

### MCP Server (v0.2.0)

| Choice | Technology | Rationale |
|--------|-----------|-----------|
| **Protocol** | MCP over STDIO + Streamable HTTP | STDIO 用于本地开发，HTTP 用于生产 |
| **SDK** | @modelcontextprotocol/sdk (TS) | 官方 SDK，文档完善 |
| **Transport** | JSON-RPC 2.0 | MCP 标准协议 |

### DevOps & Tooling

| Concern | Technology | Rationale |
|---------|-----------|-----------|
| **Monorepo** | Turborepo 或 pnpm workspaces | 前后端代码共存 |
| **Testing** | Vitest (unit) + Playwright (E2E) | 现代测试框架 |
| **CI/CD** | GitHub Actions | 开源项目标配 |
| **Container** | Docker + Docker Compose | 开发环境一致性 |
| **Docs** | VitePress 或 Docusaurus | 技术文档站点 |

## Project Structure (Proposed)

```
open-ontology/
├── apps/
│   ├── web/                      # Ontology Manager Web UI (React)
│   │   ├── src/
│   │   │   ├── components/       # UI 组件
│   │   │   ├── pages/            # 页面
│   │   │   ├── stores/           # 状态管理
│   │   │   ├── api/              # API 客户端
│   │   │   └── i18n/             # 国际化
│   │   └── package.json
│   │
│   └── server/                   # Backend API Server
│       ├── src/
│       │   ├── routes/           # API 路由
│       │   ├── services/         # 业务逻辑服务
│       │   ├── domain/           # 领域模型
│       │   ├── storage/          # 数据访问层
│       │   └── middleware/       # 认证、错误处理等
│       └── package.json
│
├── packages/
│   ├── shared/                   # 前后端共享的类型定义
│   │   ├── src/
│   │   │   ├── types/            # Ontology 类型定义 (02-domain-model)
│   │   │   └── validation/       # 校验规则
│   │   └── package.json
│   │
│   ├── mcp-server/               # MCP Server (v0.2.0)
│   │   └── package.json
│   │
│   └── osdk/                     # OSDK 代码生成器 (future)
│       └── package.json
│
├── specs/                        # 已有的规格文档
├── PRD/                          # 已有的 PRD 文档
├── architecture/                 # 本技术架构文档
│
├── docker-compose.yml            # 开发环境
├── turbo.json                    # Monorepo 配置
├── package.json                  # Root package
└── CLAUDE.md                     # AI 协作指南
```

## Data Schema Design (PostgreSQL)

MVP 需要的核心表：

```sql
-- 本体
CREATE TABLE ontologies (
  rid          TEXT PRIMARY KEY,
  space_rid    TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description  TEXT,
  version      INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 对象类型
CREATE TABLE object_types (
  rid               TEXT PRIMARY KEY,
  ontology_rid      TEXT NOT NULL REFERENCES ontologies(rid),
  id                TEXT NOT NULL,          -- user-facing ID
  api_name          TEXT NOT NULL,
  display_name      TEXT NOT NULL,
  description       TEXT,
  icon              JSONB,
  status            TEXT NOT NULL DEFAULT 'experimental',
  visibility        TEXT NOT NULL DEFAULT 'normal',
  backing_datasource JSONB,
  primary_key_property_rid TEXT,
  title_key_property_rid   TEXT,
  project_rid       TEXT,
  metadata          JSONB,                 -- 扩展元数据
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        TEXT,
  UNIQUE(ontology_rid, id),
  UNIQUE(ontology_rid, api_name)
);

-- 属性
CREATE TABLE properties (
  rid              TEXT PRIMARY KEY,
  object_type_rid  TEXT NOT NULL REFERENCES object_types(rid) ON DELETE CASCADE,
  id               TEXT NOT NULL,
  api_name         TEXT NOT NULL,
  display_name     TEXT NOT NULL,
  description      TEXT,
  base_type        TEXT NOT NULL,
  type_config      JSONB,                  -- array inner type, struct schema, etc.
  backing_column   TEXT,
  status           TEXT NOT NULL DEFAULT 'experimental',
  visibility       TEXT NOT NULL DEFAULT 'normal',
  is_primary_key   BOOLEAN NOT NULL DEFAULT false,
  is_title_key     BOOLEAN NOT NULL DEFAULT false,
  value_formatting JSONB,
  conditional_formatting JSONB,
  sort_order       INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(object_type_rid, id),
  UNIQUE(object_type_rid, api_name)
);

-- 链接类型
CREATE TABLE link_types (
  rid              TEXT PRIMARY KEY,
  ontology_rid     TEXT NOT NULL REFERENCES ontologies(rid),
  id               TEXT NOT NULL,
  cardinality      TEXT NOT NULL,
  join_method      TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'experimental',
  -- Side A
  side_a_object_type_rid TEXT NOT NULL REFERENCES object_types(rid),
  side_a_display_name    TEXT NOT NULL,
  side_a_api_name        TEXT NOT NULL,
  side_a_visibility      TEXT NOT NULL DEFAULT 'normal',
  side_a_fk_property_rid TEXT,
  -- Side B
  side_b_object_type_rid TEXT NOT NULL REFERENCES object_types(rid),
  side_b_display_name    TEXT NOT NULL,
  side_b_api_name        TEXT NOT NULL,
  side_b_visibility      TEXT NOT NULL DEFAULT 'normal',
  side_b_fk_property_rid TEXT,
  -- Join table (for many-to-many)
  join_table_datasource  JSONB,
  -- Backing object (for object-backed links)
  backing_object_type_rid TEXT,
  -- Meta
  project_rid      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by       TEXT,
  UNIQUE(ontology_rid, id)
);

-- 变更历史
CREATE TABLE change_records (
  id               TEXT PRIMARY KEY,
  ontology_rid     TEXT NOT NULL REFERENCES ontologies(rid),
  version          INTEGER NOT NULL,
  changes          JSONB NOT NULL,          -- 变更详情数组
  saved_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  saved_by         TEXT NOT NULL,
  description      TEXT
);

-- 工作状态（未保存的变更）
CREATE TABLE working_states (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  ontology_rid     TEXT NOT NULL REFERENCES ontologies(rid),
  base_version     INTEGER NOT NULL,
  changes          JSONB NOT NULL DEFAULT '[]',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, ontology_rid)
);

-- 全文搜索索引
CREATE INDEX idx_object_types_search ON object_types
  USING GIN (to_tsvector('simple',
    coalesce(display_name, '') || ' ' ||
    coalesce(description, '') || ' ' ||
    coalesce(api_name, '') || ' ' ||
    coalesce(id, '')
  ));
```

## Decision Log

| # | Decision | Chosen | Alternatives Considered | Reason |
|---|----------|--------|------------------------|--------|
| 1 | Frontend Framework | React + TS | Vue 3, Svelte | 最大生态，TS 类型共享 |
| 2 | Backend Language | TypeScript (Node.js) | Python, Go, Rust | 全栈统一，MCP SDK 支持 |
| 3 | Database | PostgreSQL | MySQL, MongoDB, Neo4j | JSONB + 全文搜索 + pgvector 扩展 |
| 4 | API Protocol | REST (MVP) | GraphQL, gRPC | MVP 简单性，后续可加 |
| 5 | Agent Interface | MCP | Custom API, OpenAPI tools | 开放标准，生态增长最快 |
| 6 | Monorepo Tool | Turborepo | Nx, Lerna | 轻量、快速、与 Vercel 生态兼容 |
| 7 | Search (MVP) | PG Full-Text | Elasticsearch, Meilisearch | 减少运维，MVP 足够 |
