# Feature: Object Type CRUD — 前端（对象类型前端界面）

**关联 PRD**: [docs/prd/0_1_0（MVP）/本体管理平台（Ontology Manager） PRD.md §对象类型管理]
**优先级**: P0
**所属版本**: v0.1.0
**状态**: Final
**前身**: 从 F003b（003-object-type-crud 前端部分）拆出为独立特性

---

## 背景

F003（003-object-type-crud）的后端部分已完成，包含 API + Service + Storage 层及 Working State 集成。本特性聚焦于 Object Type 的前端 UI 实现，是端到端闭环的关键一步。

完成本特性 + F004（App Shell）后，将进行 **Demo 走查检查点**，验证完整的用户交互流程。

---

## 用户故事

作为 **本体管理员**，
我希望 **通过 Web UI 创建、查看、编辑和删除对象类型**，
以便 **直观地构建和维护组织的语义数据模型，无需直接操作 API**。

---

## 依赖的后端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/object-types` | 列表（合并视图，分页），query: `page`, `pageSize` |
| POST | `/api/v1/object-types` | 创建（写入 Working State 草稿） |
| GET | `/api/v1/object-types/{rid}` | 详情（合并视图） |
| PUT | `/api/v1/object-types/{rid}` | 更新（写入 Working State 草稿） |
| DELETE | `/api/v1/object-types/{rid}` | 删除（写入 Working State 草稿） |

**请求/响应字段**（camelCase JSON）：

- **CreateRequest**: `id`, `apiName`, `displayName`, `description?`, `icon`
- **UpdateRequest**: `displayName?`, `description?`, `icon?`, `status?`, `visibility?`, `apiName?`（仅非 active 可改）
- **ListResponse**: `items: ObjectTypeWithChangeState[]`, `total`, `page`, `pageSize`
- **ObjectTypeWithChangeState**: 所有 ObjectType 字段 + `changeState: "published" | "created" | "modified" | "deleted"`

---

## 验收标准

### 列表页（`/object-types`）

- **AC-L1**: 列表页以表格形式展示所有对象类型，含分页（默认每页 20 条）
- **AC-L2**: 表格列定义：
  | 列 | 内容 |
  |----|------|
  | 复选框 | 行选择（MVP 阶段无批量操作，预留交互） |
  | NAME | 图标 + 显示名；若有副信息（如 plural display name、所属分组）可在下方以次要文字展示 |
  | STATUS | 状态标签：`Active` / `Experimental` / `Deprecated`，使用不同颜色区分 |
  | VISIBILITY | 可见性标签：`Prominent` / `Normal` / `Hidden` |
  | 变更状态 | 仅对非 `published` 状态的资源显示变更标签：`Created` / `Modified` / `Deleted`，使用视觉标签区分 |
- **AC-L3**: 点击行可导航到详情页 `/object-types/:rid/overview`
- **AC-L4**: 表格上方有 **"+ New object type"** 按钮，点击进入创建流程
- **AC-L5**: 支持基础筛选：
  - 按 Status 筛选（多选：active / experimental / deprecated）
  - 按 Visibility 筛选（多选：prominent / normal / hidden）
  - 筛选器以下拉/弹出面板形式呈现，点击漏斗图标触发
- **AC-L6**: 空状态：当无对象类型时，显示引导提示"Create your first object type"及创建按钮（参考 PRD-image-4.png）

### 创建（单步表单，Modal 对话框）

- **AC-C1**: 点击"New object type"或空状态引导按钮，打开 Modal 对话框
- **AC-C2**: 创建表单字段：
  | 字段 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | Icon | 图标选择器 | 是 | 默认提供一个预设图标，用户可更改 |
  | Display Name | 文本输入 | 是 | 对象类型的显示名称 |
  | Description | 多行文本输入 | 否 | 对象类型的描述 |
  | ID | 文本输入 | 是 | 对象类型唯一标识 |
  | API Name | 文本输入 | 是 | 编程引用名称 |
- **AC-C3**: ID 实时校验规则：
  - 格式：`^[a-z][a-z0-9-]*$`（小写字母开头，仅允许小写字母、数字、连字符）
  - 输入时实时提示格式错误
  - 提交后若后端返回 `OBJECT_TYPE_ID_CONFLICT`，展示唯一性冲突提示
- **AC-C4**: API Name 实时校验规则：
  - 格式：`^[A-Z][a-zA-Z0-9_]*$`（PascalCase，大写字母开头，仅允许字母、数字、下划线）
  - 保留关键字检查（前端拦截）：`ontology`, `object`, `property`, `link`, `relation`, `rid`, `primaryKey`, `typeId`, `ontologyObject`（不区分大小写）
  - 输入时实时提示格式/保留字错误
  - 提交后若后端返回 `OBJECT_TYPE_API_NAME_CONFLICT`，展示唯一性冲突提示；若返回 `OBJECT_TYPE_RESERVED_API_NAME`，展示保留字提示
- **AC-C5**: 创建成功后自动导航到新对象类型的 Overview 页面
- **AC-C6**: 创建成功后列表页的 TanStack Query 缓存自动失效并刷新

### 详情页（`/object-types/:rid`）

- **AC-D1**: 详情页使用 App Shell 提供的 `DetailSidebarLayout`，侧边栏显示：
  - "Back home" 返回按钮
  - 对象类型图标 + 显示名 + 状态徽标
  - 导航菜单项：Overview（默认选中）、Properties（带数量徽标，占位）、Datasources（占位）
  - 三点菜单（`...`）：包含"Delete"选项
- **AC-D2**: 访问 `/object-types/:rid` 时自动重定向到 `/object-types/:rid/overview`

### Overview 页面（`/object-types/:rid/overview`）

- **AC-O1**: 元数据区布局（参考 PRD-VgPQbsMBSomR9SxoGHUcZWE4neg.png）：
  - 左侧区域：
    - **图标**（可点击打开图标选择器）
    - **Display Name**（点击可内联编辑）
    - **Description**（点击可内联编辑，占位文字"Type here..."）
  - 右侧区域：
    - **Status** 下拉选择器：Active / Experimental / Deprecated
    - **Visibility** 下拉选择器：Prominent / Normal / Hidden
  - 底部行：
    - **ID** 只读显示（创建后不可修改）
    - **API Name** 可点击内联编辑（status 为 `active` 时禁用，显示 tooltip 提示原因）
    - **RID** 只读显示

- **AC-O2**: 所有元数据字段的修改通过内联编辑（click-to-edit）完成，而非单独的编辑表单：
  - 文本字段：点击后变为输入框，失去焦点或按 Enter 提交
  - 下拉字段（Status/Visibility）：直接点击打开下拉选项
  - 修改后立即调用 PUT API 保存到 Working State 草稿

- **AC-O3**: 占位区域（本特性只渲染壳子，后续特性填充内容）：
  | 区域 | 占位内容 |
  |------|---------|
  | Properties | 卡片标题"Properties (0)" + "No properties defined yet" 空状态 |
  | Action Types | 卡片标题"Action types (0)" + "No action types using this object type" 空状态 |
  | Link Types | 卡片标题"Link types (0)" + 空状态图 |
  | Data | 卡片标题"Data" + "No backing datasource added" 空状态 |

### 编辑

- **AC-E1**: 用户可通过 Overview 页内联编辑修改：Display Name、Description、Icon、Status、Visibility、API Name
- **AC-E2**: ID 创建后不可修改（UI 上显示为只读文本）
- **AC-E3**: API Name 在 status 为 `active` 时不可修改（UI 上置灰，hover 展示 tooltip："Active 状态的对象类型不能修改 API Name"）
- **AC-E4**: 编辑保存后，列表页和详情页通过 TanStack Query 缓存失效自动刷新

### 删除

- **AC-DEL1**: 三点菜单中的"Delete"选项：
  - `active` 状态时：菜单项置灰 + tooltip 提示"Active 状态的对象类型不能删除"
  - 非 `active` 状态时：可点击，触发确认弹窗
- **AC-DEL2**: 确认弹窗文案：提示将级联删除关联的属性和链接类型，需用户确认
- **AC-DEL3**: 删除成功后导航回列表页，列表自动刷新

### 图标选择器

- **AC-ICON1**: 图标选择器以 Popover 形式展示，包含：
  - 图标网格：预定义约 20-30 个常用 Ant Design 图标
  - 颜色选择：预定义约 12 种颜色的色板
- **AC-ICON2**: 选择图标或颜色后实时预览，点击外部或按 Esc 关闭
- **AC-ICON3**: 图标数据格式：`{ name: string, color: string }`，`name` 为 Ant Design 图标名，`color` 为 HEX 色值

### 变更状态展示

- **AC-CS1**: 列表页和详情页展示资源的变更状态标签：
  | 变更状态 | 视觉样式 |
  |---------|---------|
  | `published` | 不显示标签（默认状态） |
  | `created` | 绿色标签"New" |
  | `modified` | 蓝色标签"Modified" |
  | `deleted` | 红色标签"Deleted" |

---

## 校验规则汇总

| 字段 | 前端校验 | 后端校验（错误码） |
|------|---------|-----------------|
| ID 格式 | `^[a-z][a-z0-9-]*$`，实时 | `OBJECT_TYPE_INVALID_ID` |
| ID 唯一性 | — | `OBJECT_TYPE_ID_CONFLICT` (409) |
| API Name 格式 | `^[A-Z][a-zA-Z0-9_]*$`，实时 | `OBJECT_TYPE_INVALID_API_NAME` |
| API Name 保留字 | 前端匹配 9 个关键字，实时 | `OBJECT_TYPE_RESERVED_API_NAME` |
| API Name 唯一性 | — | `OBJECT_TYPE_API_NAME_CONFLICT` (409) |
| API Name active 不可改 | UI 禁用 | `OBJECT_TYPE_ACTIVE_CANNOT_MODIFY_API_NAME` |
| active 不可删除 | UI 禁用菜单项 | `OBJECT_TYPE_ACTIVE_CANNOT_DELETE` |
| Display Name 必填 | 表单非空校验 | 后端 Pydantic 校验 |

---

## 边界情况

- **不支持**：批量删除（延后到 v0.2.0）
- **不支持**：对象类型分组 Groups（延后到 P2）
- **不支持**：`aliases`（别名）字段（延后到 v0.2.0）
- **不支持**：`pluralDisplayName`（复数展示名称，延后到后续版本）
- **不支持**：对象类型复制 Copy configuration（P1 特性，独立实现）
- **不支持**：索引状态 Index status 和 Writeback 字段（后端未实现）
- 表单提交中（loading 状态）按钮禁用，防止重复提交
- 列表页复选框预留交互，MVP 阶段无批量操作

---

## 非功能要求

- **性能**: 列表页渲染 < 200ms（1000 条数据 + 分页）
- **可用性**: 表单校验即时反馈，无需提交后才看到错误；内联编辑流畅无闪烁
- **i18n**: 所有用户可见文案使用 `t('key')` 国际化
- **错误处理**: 网络错误/API 错误通过 Ant Design message 组件全局提示
- **加载状态**: 列表页使用骨架屏（Skeleton）；详情页数据加载时使用 Spin 组件

---

## UI 参考截图

| 截图 | 说明 |
|------|------|
| PRD-image-31.png | 列表页：表格布局、筛选图标、列定义 |
| PRD-image-4.png | 创建入口：顶栏 New 下拉菜单 |
| PRD-OoEEbMOX3oEF6UxmI2ycmIecnBg.png | Overview 页面完整布局（元数据 + 占位区域） |
| PRD-VgPQbsMBSomR9SxoGHUcZWE4neg.png | 元数据区编辑状态（图标选择器 + 内联编辑） |
| PRD-ZoCHbIEuyoma8hxG3X5cMR06nkf.png | 三点菜单（Delete 选项） |

> 截图路径: `docs/prd/0_1_0（MVP）/images/`

---

## 相关文档

- 对象类型元数据规范: [docs/specs/object-type-metadata.md]
- 领域模型: [docs/architecture/02-domain-model.md]
- UI 设计截图: [docs/prd/0_1_0（MVP）/images/]
- 依赖特性:
  - [features/v0.1.0/004-app-shell]（UI 框架、路由、布局）
  - [features/v0.1.0/003-object-type-crud]（后端 API 已就绪）
- 后续特性会填充 Overview 占位区域:
  - F007: Properties CRUD
  - F006: Link Type CRUD
  - Datasource 管理（P1）
