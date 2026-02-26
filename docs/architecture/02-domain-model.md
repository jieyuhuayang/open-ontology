# 02 - Domain Model / 领域模型

## Overview

Open Ontology 的领域模型定义了系统中所有一等公民实体及其关系。领域模型分为两大类：

- **语义要素（Semantic Elements）**: 描述"世界中有什么" — 对象、属性、链接
- **动态要素（Kinetic Elements）**: 描述"世界中发生什么" — 动作、函数、安全控制

## Entity Relationship Diagram

```
                          ┌─────────────┐
                          │   Space     │
                          │  (空间)     │
                          └──────┬──────┘
                                 │ 1:1
                          ┌──────┴──────┐
                          │  Ontology   │
                          │  (本体)     │
                          └──────┬──────┘
                                 │ 1:N
              ┌──────────────────┼──────────────────┐
              │                  │                  │
     ┌────────┴────────┐  ┌─────┴──────┐  ┌───────┴────────┐
     │  Object Type    │  │ Link Type  │  │  Action Type   │
     │  (对象类型)     │  │ (链接类型) │  │  (动作类型)    │
     └───┬────┬────────┘  └─────┬──────┘  └────────────────┘
         │    │                 │
         │    │    ┌────────────┤
         │    │    │            │
    ┌────┴──┐ │  ┌─┴──────┐  ┌─┴────────────┐
    │Property│ │  │ Side A │  │   Side B     │
    │(属性) │ │  │(一端)  │  │  (另一端)    │
    └───────┘ │  └────────┘  └──────────────┘
              │
     ┌────────┴────────┐
     │   Interface     │
     │   (接口)        │
     └─────────────────┘
```

## Naming Convention / 命名约定

本体中的每个资源使用三层命名体系（详见 01-system-architecture.md AD-5）：

| 层级 | 字段名 | 格式 | 可变性 | 用途 |
|------|--------|------|--------|------|
| **RID** | `rid` | `ri.<namespace>.<type>.<hash>` | 不可变 | 系统内部引用、外键、API 路径参数 |
| **ID** | `id` | 小写字母+数字+短横线 | experimental 阶段可改，active 后不可变 | URL slug、用户可见标识 |
| **API Name** | `apiName` | ObjectType: PascalCase；Property: camelCase | experimental 阶段可改，active 后不可变 | 代码生成、SDK 方法名 |
| **Display Name** | `displayName` | 任意 Unicode | 始终可变 | UI 展示、i18n |

> 文档中 `rid` 即 Resource Identifier，与 "resource id" 同义。所有跨实体引用统一使用 `rid` 字段名。

## Core Entities

### 1. Space（空间）

空间是顶层容器，与 Ontology 1:1 映射。

```typescript
interface Space {
  rid: string;                    // 系统唯一标识
  name: string;                   // 空间名称
  description?: string;           // 描述
  ontologyRid: string;            // 关联的 Ontology RID
  accessRequirements: OrgRef[];   // 可访问的组织列表
  createdAt: Timestamp;
  createdBy: UserRef;
}
```

### 2. Ontology（本体）

```typescript
interface Ontology {
  rid: string;
  spaceRid: string;               // 所属 Space
  displayName: string;
  description?: string;
  version: number;                 // 当前发布版本号
  lastModifiedAt: Timestamp;
  lastModifiedBy: UserRef;
}
```

### 3. ObjectType（对象类型）

对象类型是 Ontology 的核心实体，对应现实世界中的实体或事件。

```typescript
interface ObjectType {
  // === 标识 ===
  rid: string;                     // 系统唯一标识，不可变
  id: string;                      // 用户可见的唯一 ID (e.g., "employee")
                                   // 规则: 小写字母 + 数字 + 短横线, 以字母开头
  apiName: string;                 // API 引用名 (e.g., "Employee")
                                   // 规则: PascalCase, 字母数字 + 下划线, 全局唯一

  // === 展示 ===
  displayName: string;             // 展示名称 (e.g., "员工")
  pluralDisplayName?: string;      // 复数展示名称 (e.g., "员工们") — MVP 不做
  description?: string;            // 描述文本
  aliases?: string[];              // 搜索别名
  icon: Icon;                      // 图标 + 颜色

  // === 生命周期 ===
  status: ResourceStatus;          // active | experimental | deprecated
  visibility: Visibility;          // prominent | normal | hidden

  // === 数据 ===
  backingDatasource?: DatasourceRef; // 底层数据源引用
  primaryKeyPropertyId: string;    // 主键属性 ID
  titleKeyPropertyId: string;      // 标题键属性 ID

  // === 组织 ===
  groupIds?: string[];             // 所属分组 — P2
  projectRid: string;              // 保存位置（项目）

  // === 审计 ===
  createdAt: Timestamp;
  createdBy: UserRef;
  lastModifiedAt: Timestamp;
  lastModifiedBy: UserRef;
}
```

### 4. Property（属性）

属性描述对象类型的特征、状态或度量。属性不能独立存在，必须属于一个对象类型。

```typescript
interface Property {
  // === 标识 ===
  rid: string;
  id: string;                      // 属性 ID (在所属 ObjectType 内唯一)
                                   // 规则: 大小写字母 + 数字 + 短横线 + 下划线
  apiName: string;                 // API 引用名 (camelCase)
  objectTypeRid: string;           // 所属对象类型

  // === 展示 ===
  displayName: string;
  description?: string;

  // === 类型 ===
  baseType: PropertyBaseType;      // 基础类型 (见下方枚举)
  arrayInnerType?: PropertyBaseType; // 若 baseType 为 Array, 内部元素类型
  structSchema?: StructField[];    // 若 baseType 为 Struct, 字段定义

  // === 数据映射 ===
  backingColumn?: string;          // 映射到数据源的列名

  // === 生命周期 ===
  status: ResourceStatus;
  visibility: Visibility;

  // === 格式化 ===
  valueFormatting?: ValueFormatting;       // 值格式化配置
  conditionalFormatting?: ConditionalFormatting[]; // 条件格式化规则

  // === 键标记 ===
  isPrimaryKey: boolean;
  isTitleKey: boolean;

  // === 共享属性 ===
  sharedPropertyRid?: string;      // 若为共享属性实例，引用共享属性定义 — P2
}
```

### 5. PropertyBaseType（属性基础类型）

```typescript
enum PropertyBaseType {
  // 常用类型
  String = "string",
  Integer = "integer",
  Short = "short",

  // 时间类型
  Date = "date",
  Timestamp = "timestamp",

  // 数值类型
  Boolean = "boolean",
  Byte = "byte",
  Long = "long",
  Float = "float",
  Double = "double",
  Decimal = "decimal",

  // 复合类型
  Array = "array",
  Struct = "struct",

  // 高级类型
  Vector = "vector",
  Geopoint = "geopoint",
  Geoshape = "geoshape",
  Attachment = "attachment",
  TimeSeries = "timeseries",
  MediaReference = "media-reference",
  Marking = "marking",
  Cipher = "cipher",
}
```

### 6. LinkType（链接类型）

链接类型定义对象之间的语义关系。

```typescript
interface LinkType {
  // === 标识 ===
  rid: string;
  id: string;                      // 链接类型 ID (e.g., "employee-employer")

  // === 两端定义 ===
  sideA: LinkSide;                 // 一端
  sideB: LinkSide;                 // 另一端

  // === 关系类型 ===
  cardinality: Cardinality;        // 基数关系
  joinMethod: JoinMethod;          // 连接方式

  // === 生命周期 ===
  status: ResourceStatus;

  // === 组织 ===
  projectRid: string;

  // === 审计 ===
  createdAt: Timestamp;
  createdBy: UserRef;
  lastModifiedAt: Timestamp;
  lastModifiedBy: UserRef;
}

interface LinkSide {
  objectTypeRid: string;           // 该端的对象类型
  displayName: string;             // 该端的展示名称
  pluralDisplayName?: string;
  apiName: string;                 // API 引用名
  visibility: Visibility;
  foreignKeyPropertyId?: string;   // 外键属性（若适用）
}

enum Cardinality {
  OneToOne = "one-to-one",
  OneToMany = "one-to-many",
  ManyToOne = "many-to-one",
  ManyToMany = "many-to-many",
}

enum JoinMethod {
  ForeignKey = "foreign-key",      // 外键方式 (1:1, N:1)
  JoinTable = "join-table",        // 连接表方式 (N:N)
  BackingObject = "backing-object", // 对象支撑 (N:N with metadata)
}
```

### 7. ActionType（动作类型）— P2

```typescript
interface ActionType {
  rid: string;
  id: string;
  apiName: string;
  displayName: string;
  description?: string;
  objectTypeRid: string;           // 关联的对象类型
  rules: ActionRule[];             // 动作规则
  status: ResourceStatus;
  projectRid: string;
}

enum ActionRuleType {
  CreateObject = "create-object",
  ModifyObject = "modify-object",
  DeleteObject = "delete-object",
  AddLink = "add-link",
  RemoveLink = "remove-link",
}
```

### 8. Interface（接口）— P2

```typescript
interface OntologyInterface {
  rid: string;
  id: string;
  apiName: string;
  displayName: string;
  description?: string;
  properties: InterfaceProperty[];  // 接口要求的属性形状
  implementedBy: string[];          // 实现此接口的 ObjectType RID 列表
}
```

## Common Types

```typescript
enum ResourceStatus {
  Active = "active",
  Experimental = "experimental",
  Deprecated = "deprecated",
}

enum Visibility {
  Prominent = "prominent",
  Normal = "normal",
  Hidden = "hidden",
}

interface Icon {
  name: string;                    // 图标名称
  color: string;                   // 颜色 (hex)
}

interface DatasourceRef {
  rid: string;
  name: string;
  type: "database" | "csv" | "api" | "object-store";
}

interface ValueFormatting {
  type: "numeric" | "datetime" | "userid" | "rid";
  config: NumericFormatConfig | DateTimeFormatConfig;
}

interface NumericFormatConfig {
  style: "currency" | "unit" | "percent" | "prefix-suffix" | "fixed";
  useGrouping: boolean;
  notation?: "compact" | "scientific" | "engineering";
  currency?: string;
  unit?: string;
  prefix?: string;
  suffix?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

interface DateTimeFormatConfig {
  style: "date" | "date-time-long" | "date-time-short"
       | "iso-instant" | "relative" | "time";
}
```

## Change Management Model

变更管理是 MVP 的核心功能之一，需要单独建模。

```typescript
// 工作状态：用户的未保存变更集合
interface WorkingState {
  userId: string;
  ontologyRid: string;
  changes: Change[];               // 有序的变更列表
  baseVersion: number;             // 基于的 Ontology 版本
  createdAt: Timestamp;
  lastModifiedAt: Timestamp;
}

// 单个变更
interface Change {
  id: string;
  resourceType: "ObjectType" | "Property" | "LinkType" | "ActionType";
  resourceRid: string;             // 目标资源的 RID（命名约定见上方 Naming Convention）
  changeType: "CREATE" | "UPDATE" | "DELETE";
  before?: any;                    // 变更前的状态 (CREATE 时为空)
  after?: any;                     // 变更后的状态 (DELETE 时为空)
  timestamp: Timestamp;
}

// 已保存的变更记录（历史）
interface ChangeRecord {
  id: string;
  ontologyRid: string;
  version: number;                 // Ontology 版本号
  changes: Change[];
  savedAt: Timestamp;
  savedBy: UserRef;
  description?: string;            // 变更说明
}
```

## Domain Rules / 领域规则

### Object Type Rules

1. `id` 格式: 小写字母开头，仅含小写字母、数字、短横线
2. `apiName` 格式: 字母数字 + 下划线，全局唯一
3. API Name 保留字: `ontology`, `object`, `property`, `link`, `relation`, `rid`, `primaryKey`, `typeId`, `ontologyObject`
4. 保存前必填: id, displayName, backingDatasource, apiName, primaryKey, titleKey
5. `active` 状态的对象类型不能修改 apiName，不能删除
6. 同一数据源只能支撑一个对象类型

### Property Rules

1. `id` 格式: 字母开头，含大小写字母、数字、短横线、下划线
2. `id` 在同一 ObjectType 内唯一
3. `apiName` 在同一 ObjectType 内唯一
4. `active` 状态的属性不能删除，不能修改 apiName
5. baseType 必须与映射列的数据类型兼容
6. Array 不支持嵌套；Struct 字段不能是 Array

### Link Type Rules

1. 一端的 apiName 在关联的 ObjectType 的所有链接类型中唯一
2. apiName: 小写字母开头，字母数字，长度 1-100，NFKC 规范化
3. `active` 状态的链接类型不能删除，不能修改 apiName
4. Many-to-Many 链接类型需要 join table 数据源
5. 对象支撑链接需要先建立两条 many-to-one 链接作为前置条件
