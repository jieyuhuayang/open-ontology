# Feature: Link Type CRUD（链接类型增删改查）

**关联 PRD**: [docs/prd/0_1_0（MVP）/本体管理平台（Ontology Manager） PRD.md §3 链接类型管理]
**优先级**: P0
**所属版本**: v0.1.0
**状态**: Final

---

## 特性说明

本特性为全栈特性（后端 + 前端一起开发），实现链接类型的创建、查看、编辑和删除。

| 依赖 | 说明 |
|------|------|
| F002 | 数据库 Schema（link_types 表） |
| F003 | Object Type CRUD（需要已有对象类型可供选择；复用 Working State 服务层） |
| F004 | App Shell（UI 框架、左侧导航栏、顶部 New 下拉菜单） |
| F005 | Ontology Search（链接类型出现在全局搜索结果中） |

---

## 用户故事

作为 **本体管理员**，
我希望 **能够创建、查看、编辑和删除对象类型之间的链接类型**，
以便 **定义实体间的语义关系，构建完整的业务知识图谱**。

---

## MVP 范围决策

以下范围决策由产品方确认：

| 决策项 | MVP 范围 | 说明 |
|--------|----------|------|
| 连接方式（Join Method） | 仅 Foreign Key | 支持 one-to-one / one-to-many / many-to-one；Join Table（many-to-many）和 Backing Object 延后 |
| 自链接（Self-Link） | 不支持 | 两端必须是不同的对象类型 |
| 数据源 & 键映射 | 仅语义关系 | 只捕获对象类型、基数、名称；不配置实际外键属性映射和数据源 |
| 详情视图 | 列表 + 侧边面板 | 无独立链接类型详情页面；在列表中选中后以侧边面板展示详情和编辑 |
| pluralDisplayName | 不支持 | 与 Object Type 保持一致，MVP 不做 |
| Type Classes | 不支持 | 延后 |
| 数据源变更 | 不支持 | Datasources Tab 延后，MVP 无数据源配置 |

---

## 领域模型参考

> 完整定义见 `docs/architecture/02-domain-model.md` §6 LinkType

### LinkType 核心字段

| 字段 | 类型 | 说明 | MVP 是否纳入 |
|------|------|------|-------------|
| `rid` | string | 系统唯一标识，自动生成，不可变 | ✅ |
| `id` | string | 用户可见标识（如 `employee-employer`），创建后不可变 | ✅ |
| `sideA` | LinkSide | 链接一端定义 | ✅ |
| `sideB` | LinkSide | 链接另一端定义 | ✅ |
| `cardinality` | enum | 基数关系 | ✅ |
| `joinMethod` | enum | MVP 固定为 `foreign-key` | ✅（固定值） |
| `status` | ResourceStatus | active / experimental / deprecated | ✅ |
| `projectRid` | string | 保存位置（项目） | ✅ |
| `createdAt` / `createdBy` | 审计 | 自动填充 | ✅ |
| `lastModifiedAt` / `lastModifiedBy` | 审计 | 自动填充 | ✅ |

### LinkSide 字段

| 字段 | 类型 | 说明 | MVP 是否纳入 |
|------|------|------|-------------|
| `objectTypeRid` | string | 该端关联的对象类型 RID | ✅ |
| `displayName` | string | 该端的展示名称 | ✅ |
| `pluralDisplayName` | string? | 复数展示名称 | ❌ MVP 不做 |
| `apiName` | string | API 引用名 | ✅ |
| `visibility` | Visibility | prominent / normal / hidden | ✅ |
| `foreignKeyPropertyId` | string? | 外键属性 ID | ❌ MVP 不做（仅语义关系） |

### 基数选项（MVP）

| 枚举值 | 说明 | 示例 |
|--------|------|------|
| `one-to-one` | A 端一个对象链接到 B 端一个对象 | Aircraft ↔ Registration |
| `one-to-many` | A 端一个对象链接到 B 端多个对象 | Aircraft → Flights |
| `many-to-one` | A 端多个对象链接到 B 端一个对象 | Flights → Aircraft |

> `many-to-many` 需要 join table，MVP 不支持。

---

## 验收标准

### 创建入口

- **AC1**: 用户可通过以下 3 种方式进入"创建链接类型"流程：
  1. 顶部 **New** 下拉菜单 → 选择 **链接类型（Link type）**
  2. 左侧导航 **资源（Resources）** → **链接类型（Link type）** 列表页 → 点击 **创建新链接类型** 按钮
  3. 对象类型 **概览（Overview）** 页的 link type graph 区域 → 点击 **创建新链接类型**

### 创建流程

创建链接类型采用向导式对话框（Wizard Dialog），共 3 步：

- **AC2**（Step 1 — 选择基数）: 用户选择链接的基数类型：one-to-one、one-to-many、many-to-one
  - many-to-many 选项置灰并标注"需要连接表数据集，后续版本支持"
- **AC3**（Step 2 — 选择对象类型）: 用户分别选择链接两端的对象类型（Side A 和 Side B）
  - **AC3a**: 对象类型选择器支持搜索（输入关键词过滤候选列表）
  - **AC3b**: 两端不允许选择相同的对象类型；如果选择相同类型，UI 提示错误
  - **AC3c**: 如从对象类型详情页进入创建流程（入口 3），该对象类型自动填入 Side A
- **AC4**（Step 3 — 定义名称与标识）:
  - **AC4a**: 用户为两端分别填写 **Display Name**（展示名称）
  - **AC4b**: 用户为两端分别填写 **API Name**；可从 Display Name 自动生成，允许手动修改
  - **AC4c**: 用户填写链接类型的 **ID**（如 `employee-employer`）；可从两端对象类型自动生成，允许手动修改
  - **AC4d**: 用户选择链接类型的 **Status**，默认为 `experimental`
  - **AC4e**: 用户为两端分别设置 **Visibility**，默认为 `normal`

### 验证规则

- **AC5**（ID 格式）: `id` 必须满足：小写字母开头，仅含小写字母、数字、短横线；在本体范围内唯一
- **AC6**（API Name 格式）: 每端的 `apiName` 必须满足：
  - 小写字母开头
  - 仅含字母和数字（alphanumeric）
  - 长度 1–100 字符
  - NFKC 规范化
  - 不得使用保留字：`ontology`、`object`、`property`、`link`、`relation`、`rid`、`primaryKey`、`typeId`、`ontologyObject`
- **AC7**（API Name 唯一性）: 一端的 `apiName` 在其关联的 Object Type 的所有链接类型中唯一；重复时返回明确错误提示，指明冲突的链接类型
- **AC8**（必填校验）: 提交前以下字段必填：两端的 objectTypeRid、displayName、apiName，以及链接类型 id 和 cardinality；缺失时 Submit 按钮禁用并提示必填字段

### 查看

- **AC9**: 左侧导航 **链接类型** 页面展示链接类型列表，列包含：ID、Side A 对象类型名、Side B 对象类型名、基数、状态
- **AC10**: 列表支持按以下条件过滤：
  - 关联的对象类型（仅显示涉及某对象类型的链接）
  - 状态（active / experimental / deprecated）
  - 可见性（prominent / normal / hidden）
- **AC11**: 列表默认分页，每页 20 条，支持翻页
- **AC12**: 点击列表中的链接类型，右侧展开侧边面板，显示完整详情：
  - 两端的对象类型（可点击跳转到对象类型详情）、Display Name、API Name、Visibility
  - 链接类型 ID、基数、状态
  - 创建/修改时间与操作人

### 编辑

- **AC13**: 在侧边面板中，以下字段可编辑：
  - 两端的 Display Name
  - 两端的 Visibility
  - 基数（Cardinality）
  - Status
- **AC14**: 以下字段创建后 **不可修改**（UI 上展示为只读）：
  - 两端的 Object Type
  - 两端的 API Name
  - 链接类型 ID
- **AC15**（Status 约束）: 当链接类型状态为 `active` 时：
  - 不允许修改 API Name（已被 AC14 覆盖，此处强调后端也须校验）
  - 不允许删除（见 AC18）
- **AC16**（Breaking Changes 警告）: 修改可能影响依赖应用的字段（如基数变更）时，保存前弹出警告提示，说明潜在的破坏性影响

### 删除

- **AC17**: 删除前展示确认弹窗，显示链接类型名称和两端对象类型信息
- **AC18**: `active` 状态的链接类型不允许删除；删除按钮置灰并显示提示"活跃状态的链接类型不可删除，请先将状态改为 deprecated"
- **AC19**: 删除链接类型 **不影响** 两端对象类型本身
- **AC20**（级联行为）: 当删除一个对象类型时，系统自动将所有关联的链接类型标记为删除（在 Working State 中记录）；确认弹窗需明确提示"将同时删除 N 条关联的链接类型"

### Working State 集成

- **AC21**: 所有写入操作（创建 / 编辑 / 删除）通过 WorkingStateService 写入草稿，而非直接修改 `link_types` 主表
- **AC22**: 列表和侧边面板查询返回 **合并视图**（已发布数据 + 草稿变更）
- **AC23**: 合并视图中的链接类型标注变更状态标签：
  - `published` — 无未保存变更
  - `created` — 新建但未保存到本体
  - `modified` — 已有修改但未保存
  - `deleted` — 已标记删除但未保存
- **AC24**: 点击顶部 **Save** 按钮后，链接类型的变更随同其他资源变更一起提交到本体

---

## 边界情况

| 场景 | 行为 |
|------|------|
| 自链接（Side A = Side B 同一对象类型） | 不支持，选择器阻止选择相同对象类型 |
| many-to-many 基数 | MVP 不支持，UI 选项置灰提示 |
| 连接表数据集（Join Table Dataset） | MVP 不支持，延后到支持 many-to-many 时实现 |
| 支撑对象链接（Object-Backed Link） | P1 延后 |
| 链接类型上的属性 | 延后到 v0.2.0 |
| 两个相同对象类型之间多条链接 | 允许，只要 ID 和各端 API Name 不冲突 |
| 并发编辑 | MVP 单用户模型，暂不处理 |
| 对象类型被删除后关联链接的展示 | 列表中该链接类型仍显示，但关联的对象类型名显示为"已删除"样式（置灰 + 删除线） |
| 外键属性映射 / 数据源配置 | MVP 不支持，仅捕获语义关系 |
| pluralDisplayName | MVP 不做，与 Object Type 保持一致 |
| Type Classes | MVP 不做 |

---

## 非功能要求

- **可用性**: 对象类型选择器支持搜索过滤（候选对象类型可能很多）
- **性能**: 列表接口响应时间 < 500ms（合并视图查询）
- **一致性**: 后端需独立校验所有验证规则（AC5–AC8），不依赖前端校验
- **i18n**: 所有用户可见文本使用 `t('key')` 国际化，不硬编码

---

## 相关文档

- 链接类型元数据规范: `docs/specs/link-type-metadata.md`
- 领域模型 LinkType 章节: `docs/architecture/02-domain-model.md` §6
- PRD 链接类型管理: `docs/prd/0_1_0（MVP）/本体管理平台（Ontology Manager） PRD.md` §3
- PRD UI 截图（创建向导）: image-17 ~ image-23, image-32 ~ image-34
- 依赖特性:
  - F002: `features/v0.1.0/002-database-schema`（link_types 表 Schema）
  - F003: `features/v0.1.0/003-object-type-crud`（Working State 服务层 + 对象类型数据）
  - F004: `features/v0.1.0/004-app-shell`（UI 框架）
  - F005: `features/v0.1.0/005-ontology-search`（全局搜索集成）
