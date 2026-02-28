# Plan: App Shell & UI 基础框架

**关联 Spec**: `features/v0.1.0/004-app-shell/spec.md`
**架构参考**: `docs/architecture/04-tech-stack-recommendations.md`, `docs/architecture/01-system-architecture.md`

---

## Context

MVP 需要一个完整的应用外壳（布局、路由、国际化、主题），作为所有页面特性的统一基础框架。当前前端仅有一个 HomePage 占位组件，无布局系统、无路由结构。

**已就绪**: F001 项目脚手架（React 18 + Vite + Ant Design 5 + TanStack Query + Zustand + i18next + React Router v6），所有依赖已在 `package.json` 中声明。

**本特性范围**: 纯前端特性，不涉及后端 API、数据库或 Pydantic 模型。

---

## 架构决策

### AD-1: 布局方案 — 自定义 CSS 布局 vs Ant Design Layout

**选择**: 使用 Ant Design 的 `Layout`（`Layout.Sider` + `Layout.Header` + `Layout.Content`）作为基础骨架，内部用语义化 HTML 标签（`<aside>`, `<header>`, `<main>`, `<nav>`）包裹以满足可访问性要求。

**理由**: Ant Design Layout 提供了折叠/展开、响应式等内置能力，减少自定义 CSS；同时通过语义化标签满足 AC2 的可访问性要求。

### AD-2: 侧边栏模式切换 — 路由判断 vs 状态管理

**选择**: 通过路由路径自动判断侧边栏模式（Home vs Detail），不使用 Zustand 管理侧边栏模式状态。

**理由**:
- 路径匹配 `/object-types/:rid/*` 或 `/link-types/:rid/*` → Detail 模式
- 其余路径 → Home 模式
- 侧边栏模式是路由的纯派生状态（derived state），无需额外状态管理
- 使用 `useMatch` / `useParams` 即可判断

### AD-3: 侧边栏折叠状态 — localStorage 持久化

**选择**: 侧边栏折叠/展开状态存储在 localStorage 中，页面刷新后保持用户的上次选择。

**理由**: 折叠偏好是跨会话的用户习惯，localStorage 是 MVP 最简方案。使用一个轻量 Zustand store 管理，配合 `persist` 中间件写入 localStorage。

### AD-4: 最近查看记录 — localStorage 存储

**选择**: Discover 页的最近查看记录存储在 localStorage（spec AC21 明确要求）。使用 Zustand store + `persist` 中间件，最多保存 6 条记录。

**数据结构**:
```typescript
interface RecentlyViewedItem {
  rid: string;
  displayName: string;
  icon: { name: string; color: string };
  description?: string;
  viewedAt: number; // timestamp
}
```

在详情页加载时自动写入记录。

### AD-5: 详情侧边栏 — 配置驱动的可复用组件

**选择**: `DetailSidebarLayout` 接受子页面导航配置 props（spec AC18 明确要求），各 CRUD 特性可灵活定义自己的子页面列表。

```typescript
interface DetailSidebarNavItem {
  key: string;       // 路由段，如 "overview"
  labelKey: string;  // i18n key
  icon: ReactNode;
  badge?: number;    // 旁显数量
}

interface DetailSidebarProps {
  resourceName: string;
  resourceIcon: ReactNode;
  statusBadge?: ReactNode;
  navItems: DetailSidebarNavItem[];
  backTo: string;    // 返回的路由路径
}
```

### AD-6: 主题配置 — Ant Design ConfigProvider token

**选择**: 通过 `theme.ts` 集中管理 Ant Design 的主题 token（品牌色、圆角、字体等），所有组件通过 `ConfigProvider` 统一消费。

**理由**: Ant Design 5.x 的 Design Token 体系支持全局 token 覆盖，无需 CSS-in-JS 或额外主题库。

### AD-7: 路由结构 — 嵌套路由 + Layout Route

**选择**: 使用 React Router v6 的 layout route 模式，在根路由下嵌套 `AppLayout` 作为布局容器，所有页面路由作为其子路由。

```
<Route element={<AppLayout />}>
  <Route index element={<DiscoverPage />} />
  <Route path="object-types" element={<ObjectTypeListPage />} />
  <Route path="object-types/:rid" element={<ObjectTypeDetailLayout />}>
    <Route index element={<Navigate to="overview" replace />} />
    <Route path="overview" element={<ObjectTypeOverviewPage />} />
    <Route path="properties" element={<ObjectTypePropertiesPage />} />
    <Route path="datasources" element={<ObjectTypeDatasourcesPage />} />
  </Route>
  ...
</Route>
```

### AD-8: "New" 下拉菜单 — 仅提供导航入口

**选择**: "New" 按钮下拉菜单仅做路由导航，不实现创建逻辑。菜单项点击后导航到对应的创建流程页面（由 F005/F006 后续实现）。

### AD-9: 导航项资源计数 — TanStack Query hook 占位

**选择**: Object Types 和 Link Types 旁的资源总数通过 TanStack Query hook 获取。API 就绪前 hook 返回 `undefined`，UI 显示 "—"。

**实现**: 创建 `useResourceCount` hook，内部调用 list API 的 total 字段。API 未就绪时 query 会失败，利用 TanStack Query 的 `placeholderData` 或 `enabled` 配置优雅降级。

---

## 前端组件设计

### 组件树总览

```
App
├── ConfigProvider (theme + locale)
├── QueryClientProvider
└── BrowserRouter
    └── Routes
        ├── <AppLayout>                          # 三段式布局容器
        │   ├── <TopBar>                         # 顶栏
        │   │   ├── Logo + Title
        │   │   ├── <SearchBarPlaceholder>       # 搜索框占位
        │   │   ├── <ChangeStatusArea>           # 变更状态区域占位（F009 填充）
        │   │   ├── <CreateMenu>                 # "New" 下拉菜单
        │   │   └── <LanguageSwitcher>           # 语言切换
        │   ├── <Sidebar>                        # 侧边栏（自动切换模式）
        │   │   ├── <HomeSidebar>                # 首页模式
        │   │   │   ├── Ontology 名称
        │   │   │   └── 导航菜单（Discover / Resources）
        │   │   └── <DetailSidebarLayout>        # 详情模式（配置驱动）
        │   │       ├── Back home 按钮
        │   │       ├── 资源信息（图标 + 名称 + 状态）
        │   │       └── 子页面导航
        │   └── <Content>                        # 内容区 (<main>)
        │       └── <Outlet />                   # 子路由渲染
        ├── DiscoverPage                         # 首页
        │   └── RecentlyViewedSection
        │       └── ObjectTypeCard (×6)
        ├── ObjectTypeListPage                   # 占位
        ├── ObjectTypeDetailLayout               # 详情布局（嵌套 Outlet）
        │   ├── ObjectTypeOverviewPage           # 占位
        │   ├── ObjectTypePropertiesPage         # 占位
        │   └── ObjectTypeDatasourcesPage        # 占位
        ├── LinkTypeListPage                     # 占位
        ├── LinkTypeDetailLayout                 # 详情布局
        │   ├── LinkTypeOverviewPage             # 占位
        │   └── LinkTypeDatasourcesPage          # 占位
        ├── PropertiesPage                       # 占位 (Coming Soon)
        ├── ActionTypesPage                      # 占位 (Coming Soon)
        └── NotFoundPage                         # 404
```

### 关键组件说明

#### AppLayout（`src/components/layout/AppLayout.tsx`）

三段式布局容器，使用 Ant Design `Layout` + 语义化 HTML：

```typescript
<Layout>
  <header>
    <TopBar />
  </header>
  <Layout>
    <aside>
      <Sidebar />
    </aside>
    <main>
      <Outlet />
    </main>
  </Layout>
</Layout>
```

#### TopBar（`src/components/layout/TopBar.tsx`）

| 区域 | 内容 | 说明 |
|------|------|------|
| 左侧 | Logo 图标 + "Ontology Management" | 固定显示 |
| 中部 | 搜索框占位 | `<Input prefix={<SearchOutlined />} placeholder="Search by name, RID, aliases..." suffix="⌘K" disabled />` |
| 右侧 | 变更状态区域占位 | 空 `<div id="change-status-slot" />` 供 F009 填充 |
| 右侧 | "New" 下拉按钮 | `<Dropdown>` 含两个菜单项：Create Object Type / Create Link Type |
| 右侧 | 语言切换 | `<LanguageSwitcher>` 组件 |

#### HomeSidebar（`src/components/layout/HomeSidebar.tsx`）

分两组导航：

**主导航**:
- Discover（图标: `CompassOutlined`）

**Resources**:
- Object Types（图标: `AppstoreOutlined`，badge: 资源数量 / "—"）
- Properties（图标: `UnorderedListOutlined`）
- Link Types（图标: `LinkOutlined`，badge: 资源数量 / "—"）
- Action Types（图标: `ThunderboltOutlined`）

使用 Ant Design `Menu` 组件，通过 `selectedKeys` 高亮当前路由。

#### DetailSidebarLayout（`src/components/layout/DetailSidebarLayout.tsx`）

可复用的详情侧边栏组件，接受 `DetailSidebarProps` 配置：
- 顶部: "← Back home" 按钮
- 资源信息: 图标 + 名称 + 状态 badge
- 子页面导航: 基于配置渲染 `Menu`，高亮当前子路由

#### DiscoverPage（`src/pages/DiscoverPage.tsx`）

- 标题区: "Recently viewed object types" + 总数
- 卡片区: 使用 Ant Design `Card` 展示最近查看的 ObjectType，最多 6 个
- 空状态: 无记录时显示 `<Empty description="No recently viewed object types" />`

#### ObjectTypeDetailLayout / LinkTypeDetailLayout

详情页的布局容器，负责：
1. 配置 `DetailSidebarLayout` 的导航项
2. 记录最近查看
3. 渲染 `<Outlet />` 供子页面填充

### 关键状态

```typescript
// 1. 侧边栏折叠状态 — Zustand + persist
interface SidebarStore {
  collapsed: boolean;
  toggleCollapsed: () => void;
}

// 2. 最近查看记录 — Zustand + persist
interface RecentlyViewedStore {
  items: RecentlyViewedItem[];
  addItem: (item: Omit<RecentlyViewedItem, 'viewedAt'>) => void;
  // 自动去重（同 rid 更新 viewedAt）+ 保留最新 6 条
}

// 3. 资源计数 — TanStack Query（API 就绪后启用）
// 暂时 enabled: false，返回 undefined
```

---

## 路由配置

```typescript
// src/router.tsx
const router = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, element: <DiscoverPage /> },
      { path: 'object-types', element: <ObjectTypeListPage /> },
      {
        path: 'object-types/:rid',
        element: <ObjectTypeDetailLayout />,
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          { path: 'overview', element: <PlaceholderPage title="Object Type Overview" /> },
          { path: 'properties', element: <PlaceholderPage title="Object Type Properties" /> },
          { path: 'datasources', element: <PlaceholderPage title="Object Type Datasources" /> },
        ],
      },
      { path: 'link-types', element: <LinkTypeListPage /> },
      {
        path: 'link-types/:rid',
        element: <LinkTypeDetailLayout />,
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          { path: 'overview', element: <PlaceholderPage title="Link Type Overview" /> },
          { path: 'datasources', element: <PlaceholderPage title="Link Type Datasources" /> },
        ],
      },
      { path: 'properties', element: <PlaceholderPage title="Properties" comingSoon /> },
      { path: 'action-types', element: <PlaceholderPage title="Action Types" comingSoon /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
```

使用 `createBrowserRouter` 替代当前的 `<BrowserRouter>` + `<Routes>`，以支持更好的 data loading 和 error boundary。

---

## 主题配置

```typescript
// src/theme.ts
import type { ThemeConfig } from 'antd';

const theme: ThemeConfig = {
  token: {
    colorPrimary: '#1677ff',       // Ant Design 默认蓝，可后续替换品牌色
    borderRadius: 6,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      headerHeight: 56,
      siderBg: '#ffffff',
    },
    Menu: {
      itemBorderRadius: 6,
    },
  },
};

export default theme;
```

---

## 国际化设计

### 翻译文件结构

```json
// locales/en/common.json
{
  "app": {
    "title": "Open Ontology",
    "subtitle": "Ontology Management"
  },
  "nav": {
    "discover": "Discover",
    "objectTypes": "Object Types",
    "properties": "Properties",
    "linkTypes": "Link Types",
    "actionTypes": "Action Types"
  },
  "topBar": {
    "searchPlaceholder": "Search by name, RID, aliases...",
    "new": "New",
    "createObjectType": "Create Object Type",
    "createLinkType": "Create Link Type"
  },
  "sidebar": {
    "resources": "Resources",
    "ontologyName": "Default Ontology",
    "backHome": "Back home"
  },
  "detail": {
    "overview": "Overview",
    "properties": "Properties",
    "datasources": "Datasources"
  },
  "discover": {
    "recentlyViewed": "Recently viewed object types",
    "noRecentlyViewed": "No recently viewed object types"
  },
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "confirm": "Confirm",
    "create": "Create",
    "back": "Back",
    "comingSoon": "Coming Soon",
    "noData": "No data",
    "loading": "Loading..."
  },
  "error": {
    "pageNotFound": "Page Not Found",
    "pageNotFoundDesc": "The page you are looking for does not exist.",
    "backHome": "Back to Home",
    "somethingWentWrong": "Something went wrong",
    "somethingWentWrongDesc": "An unexpected error occurred. Please try refreshing the page."
  },
  "language": {
    "en": "English",
    "zh": "中文"
  }
}
```

中文 `locales/zh/common.json` 结构相同，值为对应中文翻译。

---

## 错误处理

### ErrorBoundary（`src/components/ErrorBoundary.tsx`）

全局错误边界，包裹在路由最外层：
- 捕获子组件的渲染错误
- 显示友好的错误页面（Ant Design `Result` 组件，status="error"）
- 提供"返回首页"按钮

### QueryClient 默认错误处理

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error) => {
        // 全局 mutation 错误处理（如 message.error 提示）
      },
    },
  },
});
```

---

## 测试策略

| 测试类型 | 范围 | 工具 |
|---------|------|------|
| 组件测试 | AppLayout 渲染、侧边栏模式切换、路由导航 | Vitest + Testing Library |
| 组件测试 | TopBar 元素渲染、LanguageSwitcher 切换 | Vitest + Testing Library |
| 组件测试 | HomeSidebar 导航项渲染、高亮状态 | Vitest + Testing Library |
| 组件测试 | DetailSidebarLayout 配置驱动渲染 | Vitest + Testing Library |
| 组件测试 | DiscoverPage 最近查看卡片、空状态 | Vitest + Testing Library |
| 单元测试 | RecentlyViewedStore 去重、上限、排序 | Vitest |
| 路由测试 | 路由匹配、重定向、404 | Vitest + MemoryRouter |

---

## 文件变更清单

### 新建文件（25 个）

| 文件路径 | 说明 |
|----------|------|
| `apps/web/src/theme.ts` | Ant Design 主题 token 配置 |
| `apps/web/src/router.tsx` | React Router 路由配置 |
| `apps/web/src/components/layout/AppLayout.tsx` | 三段式布局容器 |
| `apps/web/src/components/layout/TopBar.tsx` | 顶栏组件 |
| `apps/web/src/components/layout/Sidebar.tsx` | 侧边栏容器（自动切换 Home/Detail 模式） |
| `apps/web/src/components/layout/HomeSidebar.tsx` | 首页模式侧边栏 |
| `apps/web/src/components/layout/DetailSidebarLayout.tsx` | 详情模式侧边栏（可复用） |
| `apps/web/src/components/layout/SearchBarPlaceholder.tsx` | 搜索框占位组件 |
| `apps/web/src/components/layout/CreateMenu.tsx` | "New" 下拉菜单 |
| `apps/web/src/components/layout/LanguageSwitcher.tsx` | 语言切换组件 |
| `apps/web/src/components/ErrorBoundary.tsx` | 全局错误边界 |
| `apps/web/src/components/PlaceholderPage.tsx` | 通用占位页面 |
| `apps/web/src/pages/DiscoverPage.tsx` | Discover 首页 |
| `apps/web/src/pages/object-types/ObjectTypeListPage.tsx` | 对象类型列表页（占位） |
| `apps/web/src/pages/object-types/ObjectTypeDetailLayout.tsx` | 对象类型详情布局 |
| `apps/web/src/pages/link-types/LinkTypeListPage.tsx` | 链接类型列表页（占位） |
| `apps/web/src/pages/link-types/LinkTypeDetailLayout.tsx` | 链接类型详情布局 |
| `apps/web/src/pages/NotFoundPage.tsx` | 404 页面 |
| `apps/web/src/stores/sidebar-store.ts` | 侧边栏折叠状态 |
| `apps/web/src/stores/recently-viewed-store.ts` | 最近查看记录 |

### 修改文件（4 个）

| 文件路径 | 修改内容 |
|----------|----------|
| `apps/web/src/App.tsx` | 替换路由为 `RouterProvider`，引入 theme.ts |
| `apps/web/src/pages/HomePage.tsx` | 删除（功能被 DiscoverPage 替代） |
| `apps/web/src/locales/en/common.json` | 扩充翻译 key |
| `apps/web/src/locales/zh/common.json` | 扩充翻译 key |

---

## 验证方式

| AC | 验证方法 |
|----|----------|
| AC1 | 组件测试：AppLayout 渲染 Sider + Header + Content 三段式结构 |
| AC2 | 组件测试：检查 DOM 中包含 `<aside>`, `<header>`, `<main>`, `<nav>` 语义标签 |
| AC3 | 组件测试：点击折叠按钮后 Sider 宽度变化；刷新后状态保持（mock localStorage） |
| AC4 | 组件测试：TopBar 左侧渲染 Logo 图标和 "Ontology Management" 标题 |
| AC5 | 组件测试：TopBar 中部渲染搜索框占位，含 placeholder 文案和 ⌘K 提示 |
| AC6 | 组件测试：TopBar 右侧 "New" 按钮下拉菜单包含两个创建选项 |
| AC7 | 组件测试：TopBar 右侧存在变更状态区域占位元素 |
| AC8 | 组件测试：TopBar 右侧渲染语言切换入口 |
| AC9 | 组件测试：HomeSidebar 顶部显示 Ontology 名称 |
| AC10 | 组件测试：HomeSidebar 包含 Discover + 四个 Resources 导航项 |
| AC11 | 组件测试：Object Types / Link Types 导航项旁显示数量或 "—" |
| AC12 | 组件测试 + 路由测试：Properties / Action Types 点击后导航到占位页面 |
| AC13 | 组件测试：当前路由对应的导航项高亮（selectedKeys） |
| AC14 | 组件测试：DetailSidebarLayout 渲染 "← Back home" 按钮，点击后路由跳转 |
| AC15 | 组件测试：DetailSidebarLayout 显示资源图标、名称、状态 badge |
| AC16 | 路由测试：对象类型详情侧边栏含 Overview / Properties / Datasources 三项 |
| AC17 | 路由测试：链接类型详情侧边栏含 Overview / Datasources 两项 |
| AC18 | 组件测试：DetailSidebarLayout 接受 navItems props 配置驱动渲染 |
| AC19 | 组件测试：当前激活的子页面导航项高亮 |
| AC20 | 路由测试：访问 `/` 渲染 DiscoverPage |
| AC21 | 组件测试 + 单元测试：最近查看卡片展示、localStorage 存储、上限 6 条、空状态 |
| AC22 | 组件测试：Discover 页显示 "Recently viewed object types" 标题及总数 |
| AC23 | 路由测试：所有路由路径可正确匹配对应组件 |
| AC24 | 路由测试：每个路由渲染对应的占位组件 |
| AC25 | 路由测试：`/object-types/:rid` 重定向到 `/object-types/:rid/overview` |
| AC26 | 组件测试：ConfigProvider 正确传入 theme 和 locale |
| AC27 | 代码审查：theme.ts 存在且包含品牌色、圆角等 token |
| AC28 | 组件测试：i18n 初始化支持 zh 和 en 两种语言 |
| AC29 | 组件测试：LanguageSwitcher 可见并可切换语言 |
| AC30 | 代码审查：翻译文件包含 spec 要求的所有 key |
| AC31 | 组件测试：切换语言后 Ant Design 组件语言联动变化 |
| AC32 | 组件测试：ErrorBoundary 捕获子组件错误，显示友好页面 |
| AC33 | 代码审查：QueryClient 配置了默认错误处理 |
