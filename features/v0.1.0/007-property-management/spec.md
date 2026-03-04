# Feature: Property Management（属性管理）

**关联 PRD**: [docs/prd/0.1.0（MVP）/本体管理平台（Ontology Manager） PRD.md §2 对象类型管理 - 属性编辑器]
**优先级**: P0
**所属版本**: v0.1.0
**状态**: Final

---

## 特性说明

本特性为全栈特性（后端 + 前端一起开发），实现对象类型属性的创建、查看、编辑、删除和排序，同时管理底层数据列映射、主键（Primary Key）和标题键（Title Key）的设置。

| 依赖 | 说明 |
|------|------|
| F002 | 数据库 Schema（properties 表） |
| F003 | Object Type CRUD 后端（WorkingState 服务层） |
| F004 | App Shell（UI 框架） |
| F005 | Object Type CRUD 前端（对象类型详情页框架） |

---

## MVP 范围决策

以下范围决策由产品方确认：

| 决策项 | MVP 范围 | 说明 |
|--------|----------|------|
| backingColumn（数据源列映射） | 支持（手动输入） | 支持设置/更改/解除映射；MVP 无数据源管理，PRD 中的"下拉选列"简化为手动文本输入列名 |
| 属性 status | 支持 | active / experimental / deprecated，默认 experimental |
| 属性 visibility | 支持 | prominent / normal / hidden，默认 normal |
| isPrimaryKey / isTitleKey | 支持 | 属性管理中可设置 / 切换主键和标题键 |
| nullable（是否必填） | 不支持 | MVP 不做字段级约束 |
| 值格式化（Value Formatting） | 不支持 | P1 特性，延后到后续迭代 |
| 共享属性（Shared Property） | 不支持 | P2 特性，延后 |
| 批量编辑属性 | 不支持 | MVP 不做批量操作，延后 |
| 复合类型（Array / Struct） | 增量支持 | 基础 Schema 先完成，嵌套配置 UI 作为增量任务在本特性内完成 |
| 高级类型（8 种） | UI 显示 coming soon | 后端 Schema 枚举值合法，前端不提供配置界面 |
| 对象类型创建向导第三步（添加属性） | 不支持 | 属性在对象类型创建后从详情页添加 |

---

## 领域模型参考

> 完整定义见 `docs/architecture/02-domain-model.md` §Property

### Property 核心字段

| 字段 | 类型 | 说明 | MVP 是否纳入 |
|------|------|------|-------------|
| `rid` | string | 系统唯一标识，自动生成，不可变 | ✅ |
| `id` | string | 用户设置的属性标识符（在所属 ObjectType 内唯一，大小写敏感） | ✅ |
| `apiName` | string | API 引用名（camelCase），从 id 自动生成，可手动覆盖 | ✅ |
| `objectTypeRid` | string | 所属对象类型 RID | ✅ |
| `displayName` | string | 展示名称 | ✅ |
| `description` | string? | 描述 | ✅ |
| `baseType` | PropertyBaseType | 属性基础类型，一旦设定不可修改 | ✅ |
| `arrayInnerType` | PropertyBaseType? | Array 类型的元素类型 | ✅（增量） |
| `structSchema` | StructField[]? | Struct 类型的字段定义 | ✅（增量） |
| `backingColumn` | string? | 底层数据源列名；null 表示未映射 | ✅ |
| `status` | ResourceStatus | active / experimental / deprecated，默认 experimental | ✅ |
| `visibility` | Visibility | prominent / normal / hidden，默认 normal | ✅ |
| `isPrimaryKey` | boolean | 是否为主键 | ✅ |
| `isTitleKey` | boolean | 是否为标题键 | ✅ |
| `sortOrder` | integer | 属性在列表中的显示顺序（拖拽排序写入此字段） | ✅ |
| `valueFormatting` | ValueFormatting? | 值格式化配置 | ❌ P1 |
| `conditionalFormatting` | ConditionalFormatting[]? | 条件格式化规则 | ❌ P1 |
| `sharedPropertyRid` | string? | 共享属性引用 | ❌ P2 |
| `createdAt` / `createdBy` | 审计 | 自动填充 | ✅ |
| `lastModifiedAt` / `lastModifiedBy` | 审计 | 自动填充 | ✅ |

### 属性类型分级

| 级别 | 类型 | MVP 支持程度 |
|------|------|-------------|
| **核心** | String, Integer, Boolean, Date, Timestamp, Double, Long | 完整支持 |
| **标准** | Short, Byte, Float, Decimal | 完整支持 |
| **复合** | Array, Struct | 增量支持（本特性内完成嵌套配置 UI） |
| **高级** | Vector, Geopoint, Geoshape, Attachment, TimeSeries, MediaReference, Marking, Cipher | Schema 枚举值预留，UI 显示 "coming soon" |

### 主键 / 标题键有效类型

| 属性类型 | 可作主键 | 可作标题键 | 备注 |
|----------|---------|----------|------|
| String, Integer, Short | ✅ | ✅ | 推荐主键类型 |
| Date, Timestamp | ⚠️ 不推荐 | ✅ | 存储格式与显示格式差异可能导致碰撞 |
| Boolean, Byte, Long | ⚠️ 不推荐 | ✅ | Boolean 限制对象实例为两个；Long 有 JS 表示精度问题 |
| Float, Double, Decimal | ❌ | ✅ | 浮点数不适合作主键 |
| Geopoint | ❌ | ✅ | |
| Array | ❌ | ✅（内部类型须有效） | 内部类型不是有效标题键类型时 Array 也不可作标题键 |
| Cipher | ❌ | ✅ | |
| Vector, Struct, MediaReference, TimeSeries, Attachment, Geoshape, Marking | ❌ | ❌ | |

---

## 用户故事

作为 **本体管理员**，
我希望 **能够为对象类型添加、编辑、删除和排序属性，并配置属性的类型、底层数据列映射和语义约束**，
以便 **精确描述业务实体的特征和状态，构建可供 Agent 和应用消费的语义数据模型**。

---

## 验收标准

### 入口

- **AC1**: 属性管理的唯一入口为 **对象类型详情页 → Properties 标签页**
- **AC2**: Properties 标签页顶部提供「Add Property」按钮；属性行支持拖拽手柄调整显示顺序

### 创建属性

- **AC3**: 点击「Add Property」弹出创建抽屉/对话框，用户需填写：
  - `displayName`（展示名称，必填）
  - `id`（属性 ID，必填）；`apiName` 从 `id` 实时自动生成（camelCase 转换），用户可手动修改 `apiName`
  - `baseType`（基础类型，必填）；从类型选择器选择，高级类型标注 "coming soon" 并置灰不可选
  - `backingColumn`（底层列名，可选）；若填写则与属性关联，可留空后续再映射
  - `description`（描述，可选）
  - `status`（可选，默认 `experimental`）
  - `visibility`（可选，默认 `normal`）
- **AC4**（id 格式校验）: 字母开头，仅含大小写字母、数字、短横线、下划线；在同一对象类型内唯一（大小写敏感）；重复时提示明确错误
- **AC5**（apiName 格式校验）:
  - 小写字母开头
  - 仅含字母和数字（alphanumeric）
  - 长度 1–100 字符
  - NFKC 规范化
  - 不得使用保留字：`ontology`、`object`、`property`、`link`、`relation`、`rid`、`primaryKey`、`typeId`、`ontologyObject`
  - 在同一对象类型内唯一；重复时提示明确错误，指明冲突的属性名
- **AC6**: `baseType` 一旦设定**不可修改**；创建表单中 UI 提示"属性类型设定后不可更改"
- **AC7**: 属性数量上限为 **200 个**；达到上限后「Add Property」按钮禁用并提示原因

### 查看属性列表

- **AC8**: Properties 标签页以表格展示所有属性，列包含：展示名称、属性 ID、API 名称、基础类型、底层列名（未映射时显示 "—"）、状态标签、可见性、是否主键、是否标题键
- **AC9**: 表格支持按 `status`、`visibility`、`baseType` 过滤
- **AC10**: 点击某行展开属性详情（右侧侧边面板），显示完整字段和可编辑区域

### 编辑属性

- **AC11**: 以下字段**可编辑**：
  - `displayName`（展示名称）
  - `description`（描述）
  - `status`（状态）
  - `visibility`（可见性）
  - `apiName`（仅当属性 status 不为 `active` 时可修改）
  - `backingColumn`（底层列名，见下方专项章节 AC14–AC16）
  - `isPrimaryKey` / `isTitleKey`（键标记，受 AC17–AC20 约束）
- **AC12**: 以下字段创建后**不可修改**（UI 显示为只读）：
  - `id`（属性 ID）
  - `baseType`（基础类型）
- **AC13**（active 状态约束）: 当属性 status 为 `active` 时：
  - `apiName` 不可修改（置灰 + tooltip 提示）
  - 不允许删除（见 AC22）
  - `backingColumn` 的更改**不受 active 状态约束**，仍可操作

### 底层数据列映射（PRD §2.4.2）

- **AC14**（映射状态展示）: 属性详情面板中显示底层列映射状态：
  - **已映射**：显示列名（如 `full_name`）+ 「更改映射」按钮 + 「解除映射」按钮
  - **未映射**：显示 "未映射" + 「映射到列」按钮
- **AC15**（设置 / 更改映射）: 点击「映射到列」或「更改映射」弹出输入框，用户手动输入底层数据源的列名（字符串）；保存后写入 `backingColumn`
  > PRD 描述为下拉选列，但 MVP 无数据源管理，故简化为自由文本输入；列名格式不做强规则校验
- **AC16**（解除映射）: 点击「解除映射」弹出确认提示后将 `backingColumn` 置为 null；解除映射操作不受属性 status 约束（active 状态属性也可解除）

### 主键 / 标题键管理

- **AC17**: 每个对象类型有且只有**一个主键属性**和**一个标题键属性**；可以为 null（未设置）
- **AC18**（设置主键）: 将属性设为主键时：
  - 仅合法类型可设为主键（见领域模型主键有效类型表）；不合法时操作置灰，tooltip 说明原因
  - 当对象类型 status 为 `active` 时，不允许更改主键；操作置灰并提示原因
  - 若已有其他属性是主键，弹出确认提示"将替换现有主键属性 [name]"，确认后自动清除旧主键标记
- **AC19**（设置标题键）: 将属性设为标题键时：
  - 仅合法类型可设为标题键（见领域模型标题键有效类型表）；不合法时操作置灰，tooltip 说明原因
  - 若已有其他属性是标题键，弹出确认提示"将替换现有标题键属性 [name]"，确认后自动清除旧标题键标记
- **AC20**（主键删除保护）: 主键属性不允许被删除；删除操作置灰并提示"请先更换主键后再删除此属性"
  > 标题键无此删除保护限制

### 删除属性

- **AC21**: 删除前展示确认弹窗，显示属性展示名称和类型
- **AC22**: `active` 状态的属性不允许删除；删除按钮置灰并提示"请先将属性状态更改为 deprecated"
- **AC23**: 主键属性不允许删除（AC20 已覆盖，此处强调后端也须校验）
- **AC24**: 删除成功后属性从列表移除

### 属性排序

- **AC25**: 用户可拖拽调整属性的显示顺序；顺序变更写入 `sortOrder` 字段，通过 Working State 暂存，不立即发布

### 复合类型（增量阶段）

- **AC26**（Array）: 选择 Array 类型时，额外显示「元素类型（Item type）」选择器：
  - 仅允许核心和标准类型（11 种）；不允许嵌套 Array
  - 元素类型一经确认同样不可修改
- **AC27**（Struct）: 选择 Struct 类型时，额外显示字段列表编辑器（Field schema editor）：
  - 每个字段需填写：字段名、字段类型（仅限核心和标准类型，不可为 Array）
  - Struct 不支持嵌套；字段不可为 Array 类型

### Working State 集成

- **AC28**: 所有写入操作（创建 / 编辑 / 删除 / 排序 / 列映射变更）通过 WorkingStateService 写入草稿，不直接修改 `properties` 主表
- **AC29**: 属性列表查询返回**合并视图**（已发布数据 + 草稿变更）
- **AC30**: 合并视图中每条属性标注变更状态标签：
  - `published` — 无未保存变更
  - `created` — 新建但未发布到本体
  - `modified` — 已修改但未发布
  - `deleted` — 已标记删除但未发布
- **AC31**: 点击顶部 **Save** 后，属性变更随同其他资源变更一起提交到本体

---

## 边界情况

| 场景 | 行为 |
|------|------|
| 属性类型变更（如 String → Integer） | 明确不支持，属性类型为只读；后端拒绝此类请求 |
| 属性 id 与现有属性重复（大小写敏感） | 后端返回 `PROPERTY_ID_CONFLICT` 错误，前端实时校验时高亮提示 |
| apiName 与现有属性重复 | 后端返回 `PROPERTY_API_NAME_CONFLICT` 错误，前端实时校验时高亮提示 |
| backingColumn 未配置时发布 | 允许；MVP 不强制要求数据源映射 |
| backingColumn 列名为空字符串 | 等同于 null，保存后视为解除映射 |
| active 状态属性变更 backingColumn | 允许；仅 apiName 修改和删除操作受 active 状态约束 |
| 删除主键属性 | 不允许；须先切换主键至其他属性 |
| 将不合法类型（如 Double）设为主键 | 选项置灰，tooltip 说明该类型不支持作主键 |
| 修改 active 状态对象类型的主键 | 操作置灰，提示对象类型处于 active 状态，主键不可更改 |
| 属性达到 200 个上限 | Add Property 按钮禁用并提示已达上限 |
| 删除 active 状态属性 | 不允许；需先将属性改为 deprecated |
| 属性 id 相同但大小写不同（如 `name` vs `Name`） | 大小写敏感，视为不同属性，均允许存在 |
| 高级类型属性存储 | 后端枚举合法，可持久化；前端属性列表显示类型名 + "coming soon" 标签 |
| 对象类型下暂无属性时 | Properties 标签页显示空状态，引导用户添加第一个属性 |
| 并发编辑 | MVP 单用户模型，暂不处理 |

---

## 非功能要求

- **可用性**:
  - 属性类型选择器为每种类型提供说明（hover tooltip），帮助用户选择合适类型
  - 不合法的主键 / 标题键类型在键设置操作中置灰并给出说明
  - 类型选择时，高级类型分组展示并整体标注 "coming soon"
  - 底层列名输入框提供 placeholder 示例（如 `employee_id`）
- **性能**: 属性列表接口响应 < 500ms（合并视图查询，单对象类型 200 条以内）
- **一致性**: 后端独立校验所有验证规则（AC4–AC6、AC13、AC18–AC20），不依赖前端校验
- **安全**: 属性类型在后端严格校验，拒绝非法类型值
- **i18n**: 所有用户可见文本使用 `t('key')` 国际化，不硬编码

---

## 相关文档

- 属性类型规范: `docs/specs/supported-property-types.md`
- 对象类型元数据: `docs/specs/object-type-metadata.md`
- 领域模型 Property 章节: `docs/architecture/02-domain-model.md`
- 属性值格式化（P1 参考）: `docs/specs/property-value-formatting.md`
- PRD UI 截图（属性编辑器）: image-24 ~ image-31, image-35 ~ image-40（参见 PRD images 目录）
- 依赖特性:
  - F002: `features/v0.1.0/002-database-schema`（properties 表 Schema）
  - F003: `features/v0.1.0/003-object-type-crud`（WorkingState 服务层）
  - F004: `features/v0.1.0/004-app-shell`（UI 框架）
  - F005: `features/v0.1.0/005-object-type-crud-frontend`（对象类型详情页框架）
