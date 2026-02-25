# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Open Ontology is an open-source project inspired by the Palantir Ontology. It aims to build an ontology platform designed for the agent era, offering a business-centric unified data modeling framework so that users across different business units and functional teams—as well as LLM-based agents—can share a common set of standardized business terms.

The platform will consist of multiple applications/sub-platforms. The first application being built is the **Ontology Manager** — a back-office web UI for creating, editing, searching, and deleting ontology resources (object types, link types, properties, etc.).

Current version: v0.1.0 (MVP), focused on Ontology Manager.

## Repository Status

This repository is currently in the **specification/design phase**. It contains PRD documents only — no source code, build system, or tests yet.

## Repository Structure

```
specs/                                # Domain model specifications
├── terminology.md                    # Glossary of key domain terms
├── supported-property-types.md       # Property type specifications (21 types)
├── object-type-metadata.md           # Object type metadata fields
├── link-type-metadata.md             # Link type metadata fields
└── property-value-formatting.md      # Value formatting and conditional formatting
PRD/
├── 0 概念定义/                       # Foundational domain concepts
│   └── 0 概念定义.md                 # Data layer, object layer, security model
└── 0_1_0（MVP）/                     # MVP (v0.1.0) specifications
    ├── 本体管理平台（Ontology Manager） PRD.md  # Main PRD (~67KB)
    └── images/                       # UI design screenshots (~78 images)
```

## Domain Terminology

Use the bilingual terms consistently (Chinese with English in parentheses):

| Chinese | English | Description |
|---------|---------|-------------|
| 本体 | Ontology | The complete semantic model of an organization |
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

- **P0**: UI framework, Object Type CRUD, Link Type CRUD, ontology search, change management/versioning
- **P1**: Property value formatting, object-supported links, object type copying, ontology import/export (JSON)
- **P2 (deferred)**: Discover page customization, object type groups, shared properties, Action Type CRUD

## Internationalization

The PRD is written in Chinese (Simplified). The platform UI should support internationalization (i18n).
