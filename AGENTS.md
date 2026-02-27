# AGENTS.md

This file provides guidance to coding agents when working in this repository.

## Project Overview

Open Ontology is an open-source project inspired by the Palantir Ontology. It aims to build an ontology platform for the agent era, providing a business-centric unified data modeling framework so users across business units, functional teams, and LLM-based agents can share standardized business terms.

The platform will include multiple applications/sub-platforms. The first application is **Ontology Manager**: a back-office web UI for creating, editing, searching, and deleting ontology resources (object types, link types, properties, etc.).

Current version: `v0.1.0 (MVP)`, focused on Ontology Manager.

## Repository Status

This repository is currently in the **specification/design phase**. It contains documents only; there is no application source code, build system, or automated tests yet.

## Repository Structure

```text
docs/
├── architecture/                         # Architecture design documents
│   ├── 00-design-principles.md           # Core design principles
│   ├── 01-system-architecture.md         # System architecture overview
│   ├── 02-domain-model.md                # Domain model design
│   ├── 03-agent-context-architecture.md  # Agent context architecture
│   ├── 04-tech-stack-recommendations.md  # Tech stack recommendations
│   ├── 05-data-connectivity.md           # Data connectivity architecture
│   ├── 06-change-management.md           # Change management architecture
│   └── README.md
├── prd/                                  # Product Requirements Documents
│   ├── 0 概念定义/
│   │   └── 0 概念定义.md                 # Foundational concepts
│   └── 0_1_0（MVP）/
│       ├── 本体管理平台（Ontology Manager） PRD.md
│       └── images/                       # UI design screenshots
├── specs/                                # Domain model specifications
│   ├── terminology.md
│   ├── supported-property-types.md
│   ├── object-type-metadata.md
│   ├── link-type-metadata.md
│   └── property-value-formatting.md
└── research/
    └── unstructured-data-in-ontology.md

features/
├── README.md                             # Feature development guide
├── _templates/                           # spec/plan/tasks templates
└── v0.1.0/                               # MVP feature specs by module
```

## Domain Terminology

Use bilingual terms consistently (Chinese with English in parentheses):

| Chinese | English | Description |
| --- | --- | --- |
| 本体 | Ontology | Complete semantic model of an organization |
| 对象类型 | Object Type | Abstraction of a real-world entity or event |
| 属性 | Property | Characteristic, state, or measure of an object type |
| 链接类型 | Link Type | Semantic relationship between object types |
| 动作类型 | Action Type | Transactional operations with write-back capabilities |
| 函数 | Function | Custom business logic (Python/ML-backed) |
| 接口 | Interface | Polymorphic shape descriptor for object types |
| 共享属性 | Shared Property | Reusable property across multiple object types |
| 对象集 | Object Set | Collection of object instances |
| 空间 | Space | Top-level container for projects sharing one ontology |

## MVP (v0.1.0) Priority

- `P0`: UI framework, Object Type CRUD, Link Type CRUD, ontology search, change management/versioning
- `P1`: Property value formatting, object-supported links, object type copying, ontology import/export (JSON)
- `P2 (deferred)`: Discover page customization, object type groups, shared properties, Action Type CRUD

## Internationalization

The core PRD content is written in Simplified Chinese. Product and documentation changes should consider i18n readiness.

## Agent Working Guidelines

- Keep terminology consistent with `docs/specs/terminology.md`.
- Prioritize updates to existing specs over adding new parallel documents.
- When proposing architecture or feature changes, cross-check:
  - `docs/architecture/`
  - `docs/specs/`
  - corresponding files in `features/v0.1.0/`
- If implementation code is introduced later, update this file to add coding, testing, and CI conventions.
