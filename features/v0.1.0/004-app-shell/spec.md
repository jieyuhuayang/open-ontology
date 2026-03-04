# Feature: App Shell & UI 基础框架

**关联 PRD**: [docs/prd/0.1.0（MVP）/本体管理平台（Ontology Manager） PRD.md §1.1 本体管理平台导航, §1.2 发现页视图, §5 本体搜索, §6 变更管理]
**优先级**: P0
**所属版本**: v0.1.0
**状态**: Draft

---

## 用户故事

作为 **前端开发者**，
我希望 **有一个完整的应用外壳（布局、路由、国际化、主题），所有页面特性在此基础上开发**，
以便 **各 CRUD 特性的前端工作有统一的框架可依赖，避免重复搭建基础设施**。

作为 **本体管理员**，
我希望 **看到一个清晰的导航结构和统一的视觉风格**，
以便 **在不同功能模块之间快速切换，并通过 Discover 首页快速找到最近使用过的资源**。

---

## 验收标准

### 整体布局

- **AC1**: 页面采用侧边栏（Sidebar）+ 顶栏（Top Bar）+ 内容区（Content）三段式布局
- **AC2**: 使用语义化 HTML 标签：侧边栏 `<aside>`、顶栏 `<header>`、内容区 `<main>`、导航 `<nav>`
- **AC3**: 侧边栏支持折叠/展开，折叠后仅显示图标

### 顶栏（Top Bar）

- **AC4**: 顶栏左侧显示应用 Logo + "Ontology Management" 标题
- **AC5**: 顶栏中部包含全局搜索框占位（仅 UI 壳，显示 placeholder "Search by name, RID, aliases..." 及 ⌘K 快捷键提示；搜索逻辑由 F008 实现）
- **AC6**: 顶栏右侧包含 "New" 创建按钮（下拉菜单：创建对象类型、创建链接类型），点击菜单项后导航到对应的创建流程页面（创建逻辑由 F005/F006 实现，此处仅提供导航入口）
- **AC7**: 顶栏右侧预留变更状态区域（用于显示 "N edits" + "Discard" + "Save" 按钮，实际逻辑与 UI 由 F009 变更管理特性填充）
- **AC8**: 顶栏右侧包含语言切换入口

### 侧边栏 — 首页模式（Home Sidebar）

首页模式在用户位于首页（Discover）或资源列表页面时展示。

- **AC9**: 侧边栏顶部显示 Ontology 名称（MVP 固定显示默认 Ontology 名称）
- **AC10**: 导航菜单包含以下项目，分为两组：
  - **主导航**：Discover（发现页）
  - **Resources（资源）**：Object Types（对象类型）、Properties（属性）、Link Types（链接类型）、Action Types（动作类型）
- **AC11**: Object Types 和 Link Types 导航项旁显示对应资源总数（从 API 获取，API 就绪前显示为 "—"）
- **AC12**: Properties 和 Action Types 导航项可正常点击，进入各自的占位页面（显示资源类型名称 + "Coming Soon" 或空列表提示），后续由对应特性（F007 / 未来 Action Type 特性）替换
- **AC13**: 当前激活的导航项高亮显示

### 侧边栏 — 详情模式（Detail Sidebar）

详情模式在用户进入某个具体资源（如某个对象类型、某个链接类型）时展示。

- **AC14**: 详情侧边栏顶部显示 "← Back home" 返回按钮，点击返回首页模式对应的资源列表页
- **AC15**: 返回按钮下方显示当前资源的图标、名称与状态徽标
- **AC16**: 对象类型详情侧边栏包含以下子页面导航项：
  - Overview（概览）— 默认选中
  - Properties（属性）— 旁显示属性数量
  - Datasources（数据源）
- **AC17**: 链接类型详情侧边栏包含以下子页面导航项：
  - Overview（概览）— 默认选中
  - Datasources（数据源）
- **AC18**: 详情侧边栏框架作为可复用布局组件（`DetailSidebarLayout`），接受子页面导航配置作为 props，各 CRUD 特性可灵活定义自己的子页面列表
- **AC19**: 当前激活的子页面导航项高亮显示

### Discover 首页

- **AC20**: Discover 页面作为应用的默认首页（Landing Page），路由为 `/`
- **AC21**: 页面展示 "最近查看的对象类型"（Recently viewed object types）版块
  - 卡片展示最近访问过的对象类型（图标、名称、描述摘要）
  - 最近查看记录存储在前端 localStorage（MVP 无后端支持）
  - 无记录时显示空状态提示（如 "No recently viewed object types"）
  - 最多展示 6 个最近查看的对象类型
- **AC22**: 页面头部显示 "Recently viewed object types" 标题及总数

### 路由

- **AC23**: React Router v6 嵌套路由配置就绪，包含以下路由：
  - `/` — Discover 首页
  - `/object-types` — 对象类型列表
  - `/object-types/:rid` — 对象类型详情（嵌套子路由）
    - `/object-types/:rid/overview` — 概览（默认）
    - `/object-types/:rid/properties` — 属性列表
    - `/object-types/:rid/datasources` — 数据源
  - `/link-types` — 链接类型列表
  - `/link-types/:rid` — 链接类型详情（嵌套子路由）
    - `/link-types/:rid/overview` — 概览（默认）
    - `/link-types/:rid/datasources` — 数据源
  - `/properties` — 属性列表页（占位）
  - `/action-types` — 动作类型列表页（占位）
  - `*` — 404 页面
- **AC24**: 每个路由目标有对应的占位组件（显示页面名称即可），后续特性替换
- **AC25**: 对象类型和链接类型详情页访问 `/object-types/:rid` 时自动重定向到 `/object-types/:rid/overview`

### 主题与组件库

- **AC26**: Ant Design 5.x 通过 `ConfigProvider` 全局配置（主题 token、语言包）
- **AC27**: 自定义主题 token 可统一修改（品牌色、圆角等），提供 `theme.ts` 配置文件

### 国际化

- **AC28**: i18next 初始化完成，支持中文（zh-CN）和英文（en-US）两种语言
- **AC29**: 语言切换入口在顶栏可见（与 AC8 对应）
- **AC30**: 基础翻译文件包含：
  - 导航项名称（Discover、Object Types、Properties、Link Types、Action Types）
  - 通用按钮文案（保存、取消、删除、确认、创建、返回）
  - 通用提示文案（Coming Soon、No data、Loading...）
  - 顶栏元素文案（搜索 placeholder、New 按钮）
  - 详情侧边栏子页面名称（Overview、Properties、Datasources）
- **AC31**: Ant Design 组件语言随 i18n 切换联动

### 错误处理

- **AC32**: 全局 ErrorBoundary 捕获未处理的渲染错误，显示友好的错误页面（而非白屏）
- **AC33**: API 错误的全局拦截器就绪（TanStack Query 的 `QueryClient` 默认错误处理）

---

## 边界情况

- **不支持**：用户认证/登录（MVP 无权限系统）
- **不支持**：多主题切换（深色模式等）—— 延后到 v0.2.0
- **不支持**：响应式移动端适配 —— MVP 仅支持桌面端（最小宽度 1280px）
- **不支持**：Discover 页面个性化配置（版块增删、排序、数量配置）—— P2 延后
- **不支持**：收藏功能（收藏对象类型、收藏组）—— 延后
- **不支持**：Proposals（提案/分支管理）—— 延后
- **不支持**：搜索框 ⌘K 快捷键功能（由 F008 实现）
- 导航菜单中 "History"（变更历史）入口由 F009 变更管理特性添加
- "New" 按钮下拉菜单的实际创建逻辑由 F005（对象类型）/ F006（链接类型）实现
- 变更状态区域（Save/Discard）的实际逻辑由 F009 实现
- 详情侧边栏的各子页面内容由对应 CRUD 特性实现，App Shell 仅提供框架和占位

---

## 非功能要求

- **性能**: App Shell 首屏加载时间 < 1s（开发环境，Vite dev server）
- **可维护性**: 布局组件与业务组件解耦，布局变更不影响页面内容；侧边栏模式切换通过路由自动判断
- **可访问性**: 导航使用语义化 HTML（`<nav>`, `<main>`, `<aside>`, `<header>`）
- **可扩展性**: 侧边栏导航项、详情子页面导航项均通过配置驱动，新增资源类型或子页面无需修改布局组件

---

## 相关文档

- 技术栈: [docs/architecture/04-tech-stack-recommendations.md]
- 系统架构: [docs/architecture/01-system-architecture.md]
- PRD 导航与布局: [docs/prd/0.1.0（MVP）/本体管理平台（Ontology Manager） PRD.md §1.1, §1.2]
- 依赖特性: [features/v0.1.0/001-project-scaffolding]
- 被依赖: [features/v0.1.0/005-object-type-crud-frontend]、[features/v0.1.0/006-link-type-crud]、[features/v0.1.0/007-property-management]、[features/v0.1.0/009-change-management]
