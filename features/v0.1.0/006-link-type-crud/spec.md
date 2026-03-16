# Feature: Link Type CRUD（链接类型增删改查）

**关联 PRD**: [docs/prd/0.1.0（MVP）/本体管理平台（Ontology Manager） PRD.md §3 链接类型管理]
**优先级**: P0
**所属版本**: v0.1.0
**状态**: Draft

---

## 相关文档

| 文档 | 路径 |
|------|------|
| 链接类型元数据规范 | `docs/specs/link-type-metadata.md` |
| 领域模型 §6 LinkType | `docs/architecture/02-domain-model.md` |
| 变更管理 | `docs/architecture/06-change-management.md` |
| PRD §3 链接类型管理 | `docs/prd/0.1.0（MVP）/本体管理平台（Ontology Manager） PRD.md` |
| 版本合约 | `features/v0.1.0/release-contract.md` |

| 依赖特性 | 说明 |
|----------|------|
| 001-scaffolding | 项目脚手架 |
| 002-db-schema | 数据库 Schema（link_types 表） |
| 003-object-type-crud | Object Type CRUD + WorkingState 服务层 |
| 004-app-shell | UI 框架、导航栏、顶部 New 下拉菜单 |
| 010-data-connection | Dataset 列表 API（many-to-many 连接表选择） |

---

## 用户故事

作为 **本体管理员**，
我希望 **能够创建、查看、编辑和删除对象类型之间的链接类型（包括外键关系和多对多连接表关系）**，
以便 **定义实体间的语义关系和数据路径，构建完整的业务知识图谱**。

---

## MVP 范围决策

以下范围决策由产品方在 Spec Discovery 阶段确认（2026-03-12）：

| # | 决策项 | MVP 范围 | 说明 |
|---|--------|----------|------|
| D1 | 连接方式 | Foreign Key + Join Table | FK 支持 1:1/1:N/N:1；JT 支持 N:N。Backing Object 延后到 P1 |
| D2 | 外键属性映射 | 支持 | 按 PRD 要求，创建向导 Step 2 支持选择 FK/PK 属性 |
| D3 | 详情视图 | 独立详情页 | 路由 `/link-types/:rid`，含 Overview + Datasets 两个 Tab |
| D4 | 自链接 | 允许 | 两端可选相同 OT（如 Employee → Manager） |
| D5 | OT Overview 链接图 | 可视化关系图 | 使用 @xyflow/react 实现节点+连线的交互式关系图 |
| D6 | 保存位置 | 创建向导含此步骤 | 默认当前 Ontology 的 project，允许切换 |
| D7 | API Name 可变性 | experimental 可改 | experimental 状态下允许修改 apiName；active 后锁定不可变 |
| D8 | 基数可变性 | 创建后不可修改 | Cardinality 一经创建即锁定 |

---

## 领域模型参考

> 完整定义见 `docs/architecture/02-domain-model.md` §6 LinkType

### LinkType 核心字段

| 字段 | 类型 | 说明 | MVP 纳入 |
|------|------|------|---------|
| `rid` | string | 系统唯一标识，自动生成，不可变 | ✅ |
| `id` | string | 用户可见标识（如 `employee-employer`），创建后不可变 | ✅ |
| `sideA` | LinkSide | 链接一端定义 | ✅ |
| `sideB` | LinkSide | 链接另一端定义 | ✅ |
| `cardinality` | enum | 基数关系（含 many-to-many） | ✅ |
| `joinMethod` | enum | `foreign-key` 或 `join-table` | ✅ |
| `joinTableDatasetRid` | string? | 连接表数据集 RID（仅 JT） | ✅ 新增 |
| `status` | ResourceStatus | active / experimental / deprecated | ✅ |
| `projectRid` | string | 保存位置（项目） | ✅ |
| `ontologyRid` | string | 所属 Ontology | ✅ |
| `createdAt` / `createdBy` | 审计 | 自动填充 | ✅ |
| `lastModifiedAt` / `lastModifiedBy` | 审计 | 自动填充 | ✅ |

### LinkSide 字段

| 字段 | 类型 | 说明 | MVP 纳入 |
|------|------|------|---------|
| `objectTypeRid` | string | 该端关联的 OT RID | ✅ |
| `displayName` | string | 该端的展示名称 | ✅ |
| `pluralDisplayName` | string? | 复数展示名称 | ❌ 延后 |
| `apiName` | string | API 引用名（camelCase） | ✅ |
| `visibility` | Visibility | prominent / normal / hidden | ✅ |
| `foreignKeyPropertyId` | string? | 外键属性 ID（仅 FK 的 FK 端） | ✅ 启用 |
| `joinTableColumn` | string? | JT 数据集中映射到此端 PK 的列名（仅 JT） | ✅ 新增 |

### 基数选项

| 枚举值 | 连接方式 | 说明 |
|--------|----------|------|
| `one-to-one` | Foreign Key | A 端 1 个 ↔ B 端 1 个 |
| `one-to-many` | Foreign Key | A 端 1 个 → B 端多个 |
| `many-to-one` | Foreign Key | A 端多个 → B 端 1 个 |
| `many-to-many` | Join Table | A 端多个 ↔ B 端多个 |

---

## 验收标准

### 创建入口

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-01 | 本体管理员 | 通过以下 3 种方式进入创建流程：① 顶部 New 下拉 → Link type；② 侧边栏 Resources → Link types 页 → 创建按钮；③ OT Overview 链接类型图 → 创建新链接类型 | 均打开创建向导对话框 |

### 创建向导

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-02 | 本体管理员 | 在 Step 1 选择关系类型与基数 | FK 分组下提供 1:1 / 1:N / N:1 选项；JT 分组下提供 N:N 选项；Backing Object 选项置灰标注"后续版本支持" |
| AC-03 | 本体管理员 | 在 Step 2（FK）选择两端 OT + 外键属性 | 左侧"外键对象类型"可搜索选择 OT，选中后列出其属性供选择 FK 属性；右侧"主键对象类型"可搜索选择 OT，主键属性自动选中；系统自动检测匹配的外键 |
| AC-04 | 本体管理员 | 在 Step 2（JT）选择两端 OT + 连接表数据集 + 列映射 | 选择两个 OT 后，展示可用数据集列表供选择连接表；选中数据集后显示列映射界面，将数据集列分别映射到两端 OT 的主键 |
| AC-05 | 本体管理员 | 在 Step 3 填写名称与标识 | 两端分别输入 Display Name 和 API Name；API Name 从 Display Name 自动生成 camelCase，允许手动修改；链接类型 ID 从两端 OT ID 自动生成，允许手动修改 |
| AC-06 | 本体管理员 | 在 Step 4 选择保存位置 | 默认选中当前 Ontology 的 project；允许从项目列表中切换 |
| AC-07 | 本体管理员 | 两端选择同一 OT（自链接） | 允许创建自链接（如 Employee → Manager，两端均为 Employee 类型） |

### 验证规则

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-08 | 本体管理员 | 输入链接类型 ID | 必须：小写字母开头，仅含小写字母 + 数字 + 短横线；在同一 Ontology 内唯一；不满足时提示错误 |
| AC-09 | 本体管理员 | 输入端点 API Name | 必须：小写字母开头，仅含字母和数字，长度 1–100，NFKC 规范化；不得使用保留字（`ontology`/`object`/`property`/`link`/`relation`/`rid`/`primaryKey`/`typeId`/`ontologyObject`） |
| AC-10 | 本体管理员 | 提交的 apiName 与已有链接类型冲突 | 返回错误 `LINK_TYPE_API_NAME_CONFLICT`，指明冲突的链接类型 ID 和所在端 |
| AC-11 | 本体管理员 | 未填写必填字段 | Submit 按钮禁用并高亮必填字段：两端 objectTypeRid、displayName、apiName，链接类型 id、cardinality |
| AC-12 | 本体管理员 | 选择 many-to-many 但未选择连接表数据集 | 校验失败，提示"多对多链接类型需要选择连接表数据集" |
| AC-13 | 本体管理员 | JT 映射的列类型与 OT 主键属性类型不一致 | 校验失败，提示"列类型 X 与主键属性类型 Y 不兼容" |
| AC-14 | 本体管理员 | FK 端选择的属性与 PK 端主键类型不一致 | 校验失败，提示"外键属性类型 X 与主键属性类型 Y 不兼容" |

### 列表页

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-15 | 本体管理员 | 访问链接类型列表页 | 展示表格，列包含：ID、Side A 对象类型名、Side B 对象类型名、基数、连接方式、状态、变更状态 |
| AC-16 | 本体管理员 | 使用过滤器筛选列表 | 支持按：关联的 OT（下拉选择）、状态（active/experimental/deprecated）、可见性（prominent/normal/hidden）过滤 |
| AC-17 | 本体管理员 | 翻页浏览列表 | 默认每页 20 条，支持翻页导航 |

### 详情页

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-18 | 本体管理员 | 点击列表中的链接类型 | 跳转到独立详情页 `/link-types/:rid`，默认显示 Overview Tab |
| AC-19 | 本体管理员 | 查看 Overview Tab | 展示：两端 OT（可点击跳转）、两端 Display Name / API Name / Visibility、链接类型 ID / RID / Cardinality / Join Method / Status、Key 配置（FK 属性或 JT 列映射）、创建/修改时间与操作人 |
| AC-20 | 本体管理员 | 查看 Datasets Tab | 展示连接表数据集信息（仅 JT 类型）：数据集名称/来源/行列数；列映射关系；支持更换数据集（选择新 dataset + 重新映射列） |

### 编辑

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-21 | 本体管理员 | 在详情页编辑字段 | 可编辑字段：两端 Display Name、两端 Visibility、Status、Key（FK 属性 / JT 列映射） |
| AC-22 | 本体管理员 | 在 experimental 状态下编辑 API Name | 允许修改，实时校验格式和唯一性 |
| AC-23 | 本体管理员 | 在 active 状态下编辑 API Name | 字段只读，Tooltip 提示"活跃状态的链接类型不可修改 API Name" |
| AC-24 | 本体管理员 | 查看不可变字段 | 以下字段创建后不可修改：两端 Object Type、链接类型 ID、Cardinality、Join Method |
| AC-25 | 本体管理员 | 修改 Status 为 active | 状态变为 active 后，API Name 锁定不可再修改 |
| AC-26 | 本体管理员 | 修改可能影响下游的字段（如 Key 配置） | 保存前弹出破坏性变更警告对话框，说明潜在影响，要求输入链接类型名称确认 |

### 删除

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-27 | 本体管理员 | 删除链接类型 | 弹出确认对话框，显示链接类型名称和两端 OT 信息 |
| AC-28 | 本体管理员 | 删除 active 状态的链接类型 | 禁止删除，提示"活跃状态的链接类型不可删除，请先将状态改为 deprecated" |
| AC-29 | 本体管理员 | 删除链接类型后检查两端 OT | 两端 OT 不受影响 |
| AC-30 | 本体管理员 | 删除一个对象类型 | 系统自动将所有关联的链接类型标记为删除（Working State）；确认弹窗提示"将同时删除 N 条关联的链接类型" |

### Working State 集成

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-31 | 本体管理员 | 执行创建/编辑/删除操作 | 通过 WorkingStateService 写入草稿，不直接修改 link_types 主表 |
| AC-32 | 本体管理员 | 查看列表或详情 | 返回合并视图（已发布数据 + 草稿变更） |
| AC-33 | 本体管理员 | 查看带变更的链接类型 | 标注变更状态标签：`published`（无未保存变更）、`created`（新建未保存）、`modified`（已修改未保存）、`deleted`（已标记删除） |
| AC-34 | 本体管理员 | 点击顶部 Save 发布 | 链接类型变更随同其他资源变更一起原子提交到本体 |

### OT Overview 链接类型图

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-35 | 本体管理员 | 在 OT Overview 页查看链接类型图 | 展示以当前 OT 为中心的可视化关系图：当前 OT 为主节点，通过连线连接到关联的其他 OT 节点；连线上标注链接类型名称和基数 |
| AC-36 | 本体管理员 | 点击关系图中的链接类型连线 | 跳转到该链接类型的详情页 |
| AC-37 | 本体管理员 | 点击关系图中的"创建新链接类型" | 打开创建向导，当前 OT 自动预填入 Side A |
| AC-38 | 本体管理员 | 点击关系图中的 OT 节点 | 跳转到该 OT 的详情页 |

---

## 边界情况

| 场景 | 行为 |
|------|------|
| 自链接（Side A = Side B 同一 OT） | 允许，两端可选相同 OT（D4 确认） |
| many-to-many 无连接表数据集 | 校验阻止，提示必须选择连接表数据集 |
| Backing Object 关系类型 | MVP 不支持，UI 选项置灰标注"后续版本支持" |
| 连接表数据集列类型不兼容 | 校验阻止，提示列类型与 PK 类型不兼容 |
| 两个相同 OT 之间多条链接 | 允许，只要 ID 和各端 apiName 不冲突 |
| 并发编辑 | MVP 单用户模型，通过 WorkingState 乐观锁处理 |
| 对象类型被删除后关联链接的展示 | 列表中该链接类型仍显示，但关联的 OT 名显示为"已删除"样式（置灰 + 删除线） |
| Cardinality 创建后修改 | 不允许（D8 确认），详情页 Cardinality 只读 |
| FK 属性在 OT 上被删除 | 链接类型保存校验失败，提示外键属性不存在 |
| JT 数据集被删除 | 链接类型保存校验失败，提示连接表数据集不存在 |
| pluralDisplayName | MVP 不做，延后 |
| Type Classes | MVP 不做，延后 |
| 链接类型图中 OT 关联超过 20 个链接 | 图默认展示前 20 条，提供"查看全部"入口跳转到列表页过滤 |

---

## 架构决策

### AD-1: 独立详情页（非 Drawer）

**决策**: 链接类型采用独立路由详情页 `/link-types/:rid`，包含 Overview 和 Datasets 两个 Tab。

**原因**: PRD §1.5 明确描述了包含多 Tab 的链接类型视图；详情页需要展示较多内容（元数据、Key 配置、数据集信息），Drawer 空间不足。

### AD-2: @xyflow/react 实现关系图

**决策**: OT Overview 页的链接类型图使用 `@xyflow/react`（已在项目依赖中）实现 2D 交互式节点-连线图。

**原因**: 项目已引入该库；@xyflow/react 是 React 生态中最成熟的图形编辑器库，适合节点-边关系可视化。

### AD-3: JT 列映射存储在 endpoint 表

**决策**: Join Table 的列映射信息（哪个数据集列对应哪端 OT 的主键）存储在 `link_type_endpoints.join_table_column` 字段。

**原因**: 每端 endpoint 自然关联一个 OT 和对应的 JT 列，与 FK 的 `foreign_key_property_id` 存储方式对称一致。

### AD-4: 创建后 Cardinality 不可变

**决策**: Cardinality 创建后锁定，不允许修改。

**原因**: 基数变更涉及 FK→JT 转换或反向，是重大 schema 变更，MVP 阶段不支持。

---

## 数据库 Schema 变更

### 新增字段（Alembic 迁移）

**`link_types` 表**:

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `join_table_dataset_rid` | VARCHAR | NULLABLE, FK → datasets.rid (SET NULL) | JT 连接方式的连接表数据集 RID |

**`link_type_endpoints` 表**:

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `join_table_column` | VARCHAR(255) | NULLABLE | JT 数据集中映射到此端 OT 主键的列名 |

### 约束变更

- `link_types.id` 的 UNIQUE 约束改为 `(ontology_rid, id)` 复合唯一（当前是全局唯一，应改为 Ontology 内唯一）

### 现有字段启用

- `link_type_endpoints.foreign_key_property_id` — 现有字段，开始在 FK 链接创建时写入值

---

## API 契约

### POST `/api/v1/link-types` — 创建链接类型

**请求体**:

```json
{
  "id": "employee-company",
  "cardinality": "many-to-one",
  "joinMethod": "foreign-key",
  "status": "experimental",
  "projectRid": "ri.ontology.project.xxx",
  "sideA": {
    "objectTypeRid": "ri.ontology.object-type.aaa",
    "displayName": "Employer",
    "apiName": "employer",
    "visibility": "normal",
    "foreignKeyPropertyId": "employer-id"
  },
  "sideB": {
    "objectTypeRid": "ri.ontology.object-type.bbb",
    "displayName": "Employees",
    "apiName": "employees",
    "visibility": "normal"
  },
  "joinTableDatasetRid": null
}
```

Join Table 示例:

```json
{
  "id": "flight-aircraft-mapping",
  "cardinality": "many-to-many",
  "joinMethod": "join-table",
  "status": "experimental",
  "projectRid": "ri.ontology.project.xxx",
  "sideA": {
    "objectTypeRid": "ri.ontology.object-type.flight",
    "displayName": "Flights",
    "apiName": "flights",
    "visibility": "normal",
    "joinTableColumn": "flight_id"
  },
  "sideB": {
    "objectTypeRid": "ri.ontology.object-type.aircraft",
    "displayName": "Aircraft",
    "apiName": "aircraft",
    "visibility": "normal",
    "joinTableColumn": "aircraft_id"
  },
  "joinTableDatasetRid": "ri.ontology.dataset.zzz"
}
```

**响应**: `201 Created` → `LinkTypeWithChangeState`

### GET `/api/v1/link-types` — 列表查询

**查询参数**: `page`, `pageSize`, `objectTypeRid?`, `status?`, `visibility?`

**响应**: `200 OK` → `LinkTypeListResponse { items, total, page, pageSize }`

### GET `/api/v1/link-types/{rid}` — 详情

**响应**: `200 OK` → `LinkTypeWithChangeState`

- 含两端 OT 的 `objectTypeDisplayName` 字段（填充）
- FK 类型含 `foreignKeyPropertyId` + 对应属性 displayName
- JT 类型含 `joinTableDatasetRid` + 数据集名称 + 两端 `joinTableColumn`

### PUT `/api/v1/link-types/{rid}` — 更新

**请求体**（部分更新，所有字段可选）:

```json
{
  "status": "active",
  "sideA": {
    "displayName": "New Name",
    "visibility": "prominent",
    "apiName": "newApiName",
    "foreignKeyPropertyId": "new-fk-property"
  }
}
```

**不可更新字段**（忽略或报错）: `id`, `cardinality`, `joinMethod`, `sideA.objectTypeRid`, `sideB.objectTypeRid`

**apiName 更新规则**: 仅当 `status != active` 时允许更新

**响应**: `200 OK` → `LinkTypeWithChangeState`

### DELETE `/api/v1/link-types/{rid}` — 删除

**前置条件**: `status != active`

**响应**: `204 No Content`

---

## 前端组件设计

### 路由结构

| 路由 | 组件 | 说明 |
|------|------|------|
| `/link-types` | `LinkTypeListPage` | 链接类型列表页 |
| `/link-types/:rid` | `LinkTypeDetailPage` | 链接类型详情页（Overview + Datasets Tab） |

### 创建向导（CreateLinkTypeWizard）

4 步 Modal 向导：

| 步骤 | 内容 | 关键组件 |
|------|------|---------|
| Step 1 | 关系类型 + 基数选择 | Radio Card 分组：FK（1:1/1:N/N:1）、JT（N:N）、BO（disabled） |
| Step 2 | 链接资源定义 | 条件渲染：FK 模式（OT 选择器 × 2 + FK 属性选择器）/ JT 模式（OT 选择器 × 2 + Dataset 选择器 + 列映射） |
| Step 3 | 名称与标识 | 两端 displayName + apiName（自动生成 camelCase）；链接类型 ID（自动生成） |
| Step 4 | 保存位置 | Project 选择器（默认当前 Ontology project） |

### 详情页（LinkTypeDetailPage）

**布局**: 左侧边栏（返回导航 + 链接类型元信息）+ 右侧内容区（Tab 切换）

**Overview Tab**:
- 元数据区：Status / ID / RID / Cardinality / Join Method / 创建修改时间
- Side A 区：OT 名称（链接跳转）/ Display Name（可编辑）/ API Name（experimental 可编辑）/ Visibility（可编辑）
- Side B 区：同 Side A
- Key 配置区：FK 模式显示外键属性映射（可编辑）/ JT 模式显示列映射概要

**Datasets Tab**（仅 JT 链接类型显示）:
- 当前连接表数据集信息（名称、来源、行列数）
- 列映射详情（数据集列 → OT 主键对应关系）
- 更换数据集按钮

### OT Overview 链接类型图（LinkTypeGraph）

**技术**: `@xyflow/react`

**节点类型**:
- 中心节点：当前 OT（高亮样式，显示图标 + 名称）
- 关联节点：链接到的其他 OT（标准样式，显示图标 + 名称）
- 自链接：当前 OT 的自引用边（环形连线）

**边类型**:
- 默认边：显示链接类型 Display Name + 基数图标（→ / ↔）
- 边上 Hover 时显示完整信息 Tooltip

**交互**:
- 点击边 → 跳转到链接类型详情页
- 点击 OT 节点 → 跳转到 OT 详情页
- "创建新链接类型"按钮 → 打开向导（当前 OT 预填 Side A）
- 图可拖拽平移、缩放

---

## 错误码表

| 错误码 | HTTP | 触发条件 |
|--------|------|---------|
| `LINK_TYPE_NOT_FOUND` | 404 | 指定 RID 的链接类型不存在 |
| `LINK_TYPE_ID_CONFLICT` | 409 | ID 在同一 Ontology 内重复 |
| `LINK_TYPE_API_NAME_CONFLICT` | 409 | apiName 在关联 OT 的链接类型中重复 |
| `LINK_TYPE_OBJECT_TYPE_NOT_FOUND` | 400 | 引用的 OT 不存在或已被删除 |
| `LINK_TYPE_ACTIVE_CANNOT_DELETE` | 400 | 尝试删除 active 状态的链接类型 |
| `LINK_TYPE_ACTIVE_CANNOT_MODIFY_API_NAME` | 400 | 尝试修改 active 链接类型的 apiName |
| `LINK_TYPE_JOIN_TABLE_REQUIRED` | 400 | many-to-many 缺少连接表数据集 |
| `LINK_TYPE_DATASET_NOT_FOUND` | 400 | 引用的连接表数据集不存在 |
| `LINK_TYPE_JOIN_TABLE_COLUMN_TYPE_MISMATCH` | 400 | JT 列类型与 OT 主键属性类型不兼容 |
| `LINK_TYPE_FK_PROPERTY_NOT_FOUND` | 400 | 引用的外键属性在 OT 上不存在 |
| `LINK_TYPE_FK_TYPE_MISMATCH` | 400 | 外键属性类型与主键属性类型不兼容 |
| `LINK_TYPE_CARDINALITY_JOIN_METHOD_MISMATCH` | 400 | 基数与连接方式不匹配（如 N:N + FK） |

---

## 新增全局不变量

以下不变量需追加到 `release-contract.md` 表 2：

| ID | 不变量描述 | 涉及领域对象 | 来源 spec |
|----|-----------|-------------|----------|
| INV-7 | LinkType 一端的 `apiName` 在关联 OT 的所有链接类型中唯一 | LinkType | 006 |
| INV-8 | `many-to-many` 基数的 LinkType 必须关联一个 `joinTableDatasetRid` | LinkType, Dataset | 006 |
| INV-9 | LinkType 的 `id` 在同一 Ontology 内唯一 | LinkType | 006 |

---

## 非功能要求

- **性能**: 列表接口（含合并视图）响应 < 500ms；关系图渲染 < 1s（20 个节点内）
- **后端独立校验**: 所有验证规则（AC-08 ~ AC-14）在后端独立校验，不依赖前端
- **i18n**: 所有用户可见文本使用 `t('key')` 国际化
- **可访问性**: 关系图提供列表视图降级方案（表格形式展示链接类型）
