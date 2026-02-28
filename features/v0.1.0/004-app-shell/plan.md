# Plan: App Shell & UI 基础框架

**关联 Spec**: `features/v0.1.0/004-app-shell/spec.md`
**架构参考**: `docs/architecture/04-tech-stack-recommendations.md`, `docs/architecture/01-system-architecture.md`

---

## Context

MVP 需要一个完整的应用外壳（布局、路由、国际化、主题），作为所有页面特性的统一基础框架。当前前端仅有一个 HomePage 占位组件，无布局系统、无路由结构。

**已就绪**: F001 项目脚手架（React 18 + Vite + Ant Design 5 + TanStack Query + Zustand + i18next + React Router v6），所有依赖已在 `package.json` 中声明。

**本特性范围**: 纯前端特性，不涉及后端 API、数据库或 Pydantic 模型。

---

## 范围边界（Scope Boundaries）

以下 PRD 功能在本特性中**显式延期**，不在 F004 实现范围内：

| PRD 来源 | 功能 | 延期原因 | 处理方式 |
|----------|------|----------|----------|
| PRD §1.1 | 顶栏分支导航/分支创建 | 属于 Proposals 特性，MVP P2 延后 | TopBar 预留 `<div id="branch-selector-slot" />` 空占位 |
| Spec 边界 | Discover 页个性化配置 | P2 延后 | 不实现 |
| Spec 边界 | 收藏功能 | 延后 | 不实现 |
| Spec 边界 | 深色模式 | v0.2.0 | 不实现 |
| Spec 边界 | 搜索框 ⌘K 快捷键功能 | 由 F008 实现 | 仅提供 UI 占位 |
| Spec 边界 | 变更状态区域（Save/Discard） | 由 F009 实现 | TopBar 预留空占位 |

---

## 架构决策

### AD-1: 布局方案 — Ant Design Layout + 语义化 HTML

**选择**: 使用 Ant Design 的 `Layout` 组件作为基础骨架，内部用语义化 HTML 标签（`<aside>`, `<header>`, `<main>`, `<nav>`）包裹以满足可访问性要求。

**理由**: Ant Design Layout 提供了折叠/展开、响应式等内置能力，减少自定义 CSS；同时通过语义化标签满足 AC2 的可访问性要求。

### AD-2: 侧边栏职责归属 — 双布局路由方案

**选择**: 将布局拆分为两层：`AppShell`（仅包含 TopBar）和 `HomeLayout`（包含 HomeSidebar + Content）。详情路由直接使用各自的 `ObjectTypeDetailLayout` / `LinkTypeDetailLayout`，其内部自行渲染 `DetailSidebarLayout` + Content。

**路由结构**:
```
<Route element={<AppShell />}>              // 仅 TopBar + <Outlet />
  <Route element={<HomeLayout />}>          // HomeSidebar + Content
    <Route index />                         // DiscoverPage
    <Route path="object-types" />           // 列表
    <Route path="object-types/new" />       // 创建占位
    <Route path="link-types" />
    <Route path="link-types/new" />
    <Route path="properties" />
    <Route path="action-types" />
  </Route>
  <Route path="object-types/:rid">          // OT DetailSidebar + Content
    <Route index → overview />
    <Route path="overview" />
    <Route path="properties" />
    <Route path="datasources" />
  </Route>
  <Route path="link-types/:rid">            // LT DetailSidebar + Content
    <Route index → overview />
    <Route path="overview" />
    <Route path="datasources" />
  </Route>
  <Route path="*" />                        // 404
</Route>
```

**明确契约**:
- `AppShell` 只负责：TopBar + `<Outlet />`，不渲染任何侧边栏
- `HomeLayout` 负责：HomeSidebar + `<Outlet />`，供首页/列表页共享
- `ObjectTypeDetailLayout` 负责：渲染 `<DetailSidebarLayout navItems={OT_NAV} />` + `<Outlet />`
- `LinkTypeDetailLayout` 负责：渲染 `<DetailSidebarLayout navItems={LT_NAV} />` + `<Outlet />`
- `DetailSidebarLayout` 是纯展示组件（presentational），完全由 props 驱动，不内部读路由或查状态
- 不再需要 `Sidebar` 通用容器组件

**理由**:
- 消除了"双重持有"问题：每个 DetailSidebarLayout 只有一个唯一的 Owner（各自的 DetailLayout）
- 路由树本身成为布局结构的权威描述，无隐式 context 传递
- TopBar 视觉位置不变（始终由 AppShell 渲染）
- DetailLayout 是 F005/F006 天然的扩展点：CRUD 特性只需填充导航配置和子页面

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

### AD-7: 路由技术方案 — createBrowserRouter (Data Router)

**选择**: 统一使用 `createBrowserRouter` + `RouterProvider`（Data Router 方案），不使用 `<BrowserRouter>` + `<Routes>` 传统方案。

**理由**: Data Router 支持路由级 `errorElement`、`loader`/`action` 等能力，与 ErrorBoundary 集成更自然，为后续特性预留数据加载能力。

### AD-8: "New" 下拉菜单 — 导航到创建占位页

**选择**: "New" 按钮下拉菜单做路由导航，不实现创建逻辑。菜单项点击后导航到对应的创建占位页面。

**路由契约**:
- Create Object Type → `/object-types/new`
- Create Link Type → `/link-types/new`

F004 提供占位页（PlaceholderPage），F005/F006 后续将占位页替换为实际创建流程。

### AD-9: 导航项资源计数 — TanStack Query hook 占位

**选择**: Object Types 和 Link Types 旁的资源总数通过 TanStack Query hook 获取。API 就绪前 hook 返回 `undefined`，UI 显示 "—"。

**实现**: 创建 `useResourceCount` hook，内部调用 list API 的 total 字段。API 未就绪时 query 会失败，利用 TanStack Query 的 `placeholderData` 或 `enabled` 配置优雅降级。

### AD-10: i18n 语言码 — 完整 BCP 47 码

**选择**: i18next 使用完整语言码 `en-US` / `zh-CN`，与 spec 要求的 `en-US` / `zh-CN` 完全对齐，并确保 Ant Design locale 映射一致。

**理由**: 浏览器 `navigator.language` 返回 `zh-CN` 等完整码；若 i18next 仅注册 `zh`/`en` 短码，LanguageDetector 检测到 `zh-CN` 时无法精确匹配，导致 AntD locale 回退英文。使用 `load: 'currentOnly'` 防止 i18next 尝试加载不存在的父语言（`zh`、`en`）。

### AD-11: 桌面端最小宽度约束

**选择**: 在 `AppShell` 根容器上设置 `min-width: 1280px`，不实现窄屏提示页。

**理由**: Spec 明确 "MVP 仅支持桌面端（最小宽度 1280px）"。在根容器设置 min-width 是最简实现——窄屏时浏览器出现水平滚动条即可，无需额外检测逻辑。

---

## 前端组件设计

### 组件树总览

```
App
├── ConfigProvider (theme + locale)
├── QueryClientProvider
└── RouterProvider (router = createBrowserRouter([...]))
    └── <AppShell>                              # 仅 TopBar + <Outlet />
        ├── <TopBar>
        │   ├── Logo + Title
        │   ├── <SearchBarPlaceholder>
        │   ├── 分支导航占位 (slot)              # PRD §1.1 延后
        │   ├── <ChangeStatusArea>              # F009 填充
        │   ├── <CreateMenu>                    # "New" 下拉菜单
        │   └── <LanguageSwitcher>
        │
        ├── [Home 路由组] <HomeLayout>           # HomeSidebar + <Outlet />
        │   ├── <HomeSidebar>
        │   │   ├── Ontology 名称
        │   │   └── 导航菜单（Discover / Resources）
        │   └── <Outlet /> → 以下页面之一：
        │       ├── DiscoverPage
        │       │   └── RecentlyViewedSection → ObjectTypeCard (×6)
        │       ├── ObjectTypeListPage（占位）
        │       ├── CreateObjectTypePage（占位，/object-types/new）
        │       ├── LinkTypeListPage（占位）
        │       ├── CreateLinkTypePage（占位，/link-types/new）
        │       ├── PropertiesPage（占位，Coming Soon）
        │       └── ActionTypesPage（占位，Coming Soon）
        │
        ├── [OT 详情路由组] <ObjectTypeDetailLayout>  # DetailSidebar + <Outlet />
        │   ├── <DetailSidebarLayout navItems={OT_NAV} />
        │   │   ├── "← Back home" 按钮
        │   │   ├── 资源信息（图标 + 名称 + 状态）
        │   │   └── 子页面导航（Overview / Properties / Datasources）
        │   └── <Outlet /> → Overview / Properties / Datasources 占位
        │
        ├── [LT 详情路由组] <LinkTypeDetailLayout>
        │   ├── <DetailSidebarLayout navItems={LT_NAV} />
        │   └── <Outlet /> → Overview / Datasources 占位
        │
        └── NotFoundPage（404）
```

### 关键组件说明

#### AppShell（`src/components/layout/AppShell.tsx`）

应用最外层壳，仅包含 TopBar：

```typescript
<Layout style={{ minHeight: '100vh', minWidth: 1280 }}>
  <header>
    <TopBar />
  </header>
  <Outlet />   {/* HomeLayout 或 DetailLayout 渲染于此 */}
</Layout>
```

#### HomeLayout（`src/components/layout/HomeLayout.tsx`）

首页/列表页的布局容器，包含 HomeSidebar：

```typescript
<Layout>
  <aside>
    <HomeSidebar />
  </aside>
  <Layout.Content>
    <main>
      <Outlet />   {/* DiscoverPage / ListPage 等渲染于此 */}
    </main>
  </Layout.Content>
</Layout>
```

#### TopBar（`src/components/layout/TopBar.tsx`）

| 区域 | 内容 | 说明 |
|------|------|------|
| 左侧 | Logo 图标 + "Ontology Management" | 固定显示 |
| 中部 | 搜索框占位 | `<Input prefix={<SearchOutlined />} placeholder="Search by name, RID, aliases..." suffix="⌘K" disabled />` |
| 右侧 | 分支导航占位 | 空 `<div id="branch-selector-slot" />`，PRD §1.1 要求的分支导航能力延后到 Proposals 特性 |
| 右侧 | 变更状态区域占位 | 空 `<div id="change-status-slot" />` 供 F009 填充 |
| 右侧 | "New" 下拉按钮 | `<Dropdown>` 含两个菜单项：Create Object Type（→ `/object-types/new`）/ Create Link Type（→ `/link-types/new`） |
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

可复用的详情侧边栏**纯展示组件**，接受 `DetailSidebarProps` 配置：
- 顶部: "← Back home" 按钮
- 资源信息: 图标 + 名称 + 状态 badge
- 子页面导航: 基于配置渲染 `Menu`，高亮当前子路由

不内部读路由或查状态，所有数据通过 props 传入。高亮状态由父组件（DetailLayout）根据当前路由计算后传入。

#### DiscoverPage（`src/pages/DiscoverPage.tsx`）

- 标题区: "Recently viewed object types" + 总数
- 卡片区: 使用 Ant Design `Card` 展示最近查看的 ObjectType，最多 6 个
- 空状态: 无记录时显示 `<Empty description="No recently viewed object types" />`

#### ObjectTypeDetailLayout / LinkTypeDetailLayout

详情页的布局容器，负责：
1. 组合布局：`<DetailSidebarLayout />` + `<Outlet />`（左右结构）
2. 配置 `DetailSidebarLayout` 的导航项（OT: Overview/Properties/Datasources，LT: Overview/Datasources）
3. 计算当前子路由并传递 `activeKey` 给 DetailSidebarLayout
4. 记录最近查看（调用 RecentlyViewedStore.addItem）
5. 渲染 `<Outlet />` 供子页面填充

```typescript
// ObjectTypeDetailLayout 示例结构
<Layout>
  <aside>
    <DetailSidebarLayout
      resourceName={objectType.displayName}
      resourceIcon={...}
      statusBadge={...}
      navItems={OT_NAV_ITEMS}
      backTo="/object-types"
      activeKey={currentSubRoute}
    />
  </aside>
  <Layout.Content>
    <main>
      <Outlet />
    </main>
  </Layout.Content>
</Layout>
```

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
    path: '/',
    element: <AppShell />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        element: <HomeLayout />,
        children: [
          { index: true, element: <DiscoverPage /> },
          { path: 'object-types', element: <ObjectTypeListPage /> },
          { path: 'object-types/new', element: <PlaceholderPage title="Create Object Type" /> },
          { path: 'link-types', element: <LinkTypeListPage /> },
          { path: 'link-types/new', element: <PlaceholderPage title="Create Link Type" /> },
          { path: 'properties', element: <PlaceholderPage title="Properties" comingSoon /> },
          { path: 'action-types', element: <PlaceholderPage title="Action Types" comingSoon /> },
        ],
      },
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
      {
        path: 'link-types/:rid',
        element: <LinkTypeDetailLayout />,
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          { path: 'overview', element: <PlaceholderPage title="Link Type Overview" /> },
          { path: 'datasources', element: <PlaceholderPage title="Link Type Datasources" /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
```

> **路由优先级说明**: `object-types/new` 等静态路由定义在 `HomeLayout` 子路由中，与 `object-types/:rid` 动态路由分属不同路由组，React Router v6 会正确区分——静态路径段优先于动态参数段。

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

### i18next 初始化配置

```typescript
// src/locales/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enUS from './en-US/common.json';
import zhCN from './zh-CN/common.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'en-US': { translation: enUS },
      'zh-CN': { translation: zhCN },
    },
    supportedLngs: ['en-US', 'zh-CN'],
    load: 'currentOnly',              // 防止 i18next 尝试加载 "en" / "zh" 父语言
    fallbackLng: 'en-US',
    nonExplicitSupportedLngs: false,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
```

### AntD locale 映射

```typescript
// App.tsx 中
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';

const antdLocaleMap: Record<string, typeof enUS> = {
  'en-US': enUS,
  'zh-CN': zhCN,
};
// 使用: antdLocaleMap[i18n.language] ?? enUS
```

### 翻译文件结构

```json
// locales/en-US/common.json
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
    "en-US": "English",
    "zh-CN": "中文"
  }
}
```

中文 `locales/zh-CN/common.json` 结构相同，值为对应中文翻译。

### LanguageSwitcher

语言切换组件调用 `i18n.changeLanguage('en-US')` 或 `i18n.changeLanguage('zh-CN')`，始终使用完整语言码。

---

## 错误处理

### ErrorBoundary（`src/components/ErrorBoundary.tsx`）

全局错误边界，作为根路由的 `errorElement`：
- 捕获子组件的渲染错误及路由错误
- 显示友好的错误页面（Ant Design `Result` 组件，status="error"）
- 提供"返回首页"按钮

### QueryClient 全局错误处理

```typescript
// src/queryClient.ts
import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { message } from 'antd';

function handleGlobalError(error: unknown) {
  const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
  message.error(msg);
  console.error('[API Error]', error);
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: handleGlobalError,    // 覆盖所有 query 错误
  }),
  mutationCache: new MutationCache({
    onError: handleGlobalError,    // 覆盖所有 mutation 错误
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

> `QueryCache.onError` + `MutationCache.onError` 是 TanStack Query v5 推荐的全局错误拦截方式，比 `defaultOptions.mutations.onError` 覆盖范围更广，同时覆盖 query 和 mutation 层的错误。

---

## 测试策略

| 测试类型 | 范围 | 工具 |
|---------|------|------|
| 组件测试 | AppShell + HomeLayout 渲染、侧边栏折叠 | Vitest + Testing Library |
| 组件测试 | TopBar 元素渲染、LanguageSwitcher 切换 | Vitest + Testing Library |
| 组件测试 | HomeSidebar 导航项渲染、高亮状态 | Vitest + Testing Library |
| 组件测试 | DetailSidebarLayout 配置驱动渲染 | Vitest + Testing Library |
| 组件测试 | DiscoverPage 最近查看卡片、空状态 | Vitest + Testing Library |
| 单元测试 | RecentlyViewedStore 去重、上限、排序 | Vitest |
| 路由测试 | 路由匹配、重定向、404、错误边界 | Vitest + createMemoryRouter + RouterProvider |

> **路由测试约定**: 统一使用 `createMemoryRouter(routes, { initialEntries: ['/path'] })` 配合 `<RouterProvider router={testRouter} />` 渲染，与运行时 `createBrowserRouter` 保持实现一致，确保 redirect、errorElement 行为可信。禁止使用 `<MemoryRouter>`（行为与 Data Router 不同）。

---

## 文件变更清单

### 新建文件

| 文件路径 | 说明 |
|----------|------|
| `apps/web/src/theme.ts` | Ant Design 主题 token 配置 |
| `apps/web/src/router.tsx` | React Router 路由配置（createBrowserRouter） |
| `apps/web/src/queryClient.ts` | QueryClient 实例（含 QueryCache/MutationCache 全局错误处理） |
| `apps/web/src/components/layout/AppShell.tsx` | 应用外壳（仅 TopBar + Outlet） |
| `apps/web/src/components/layout/HomeLayout.tsx` | 首页/列表页布局（HomeSidebar + Content） |
| `apps/web/src/components/layout/TopBar.tsx` | 顶栏组件 |
| `apps/web/src/components/layout/HomeSidebar.tsx` | 首页模式侧边栏 |
| `apps/web/src/components/layout/DetailSidebarLayout.tsx` | 详情模式侧边栏（可复用，props 驱动） |
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
| `apps/web/src/locales/en-US/common.json` | 英文翻译（新路径） |
| `apps/web/src/locales/zh-CN/common.json` | 中文翻译（新路径） |

### 修改文件

| 文件路径 | 修改内容 |
|----------|----------|
| `apps/web/src/App.tsx` | 移除 BrowserRouter，改用 RouterProvider；引入 theme.ts 和 queryClient.ts；AntD locale map 改用 `en-US`/`zh-CN` 键 |
| `apps/web/src/locales/i18n.ts` | 重写：resources 键改为 `en-US`/`zh-CN`；增加 `supportedLngs`、`load: 'currentOnly'`；导入路径改为 `./en-US/` / `./zh-CN/` |

### 删除文件

| 文件路径 | 原因 |
|----------|------|
| `apps/web/src/pages/HomePage.tsx` | 功能被 DiscoverPage 替代 |
| `apps/web/src/locales/en/common.json` | 迁移至 `en-US/common.json` |
| `apps/web/src/locales/zh/common.json` | 迁移至 `zh-CN/common.json` |

---

## 验证方式

| AC | 验证方法 |
|----|----------|
| AC1 | 组件测试：AppShell + HomeLayout 渲染 Header + Sider + Content 三段式结构 |
| AC2 | 组件测试：检查 DOM 中包含 `<aside>`, `<header>`, `<main>`, `<nav>` 语义标签 |
| AC3 | 组件测试：点击折叠按钮后 Sider 宽度变化；刷新后状态保持（mock localStorage） |
| AC4 | 组件测试：TopBar 左侧渲染 Logo 图标和 "Ontology Management" 标题 |
| AC5 | 组件测试：TopBar 中部渲染搜索框占位，含 placeholder 文案和 ⌘K 提示 |
| AC6 | 组件测试 + 路由测试：TopBar "New" 按钮下拉菜单包含两个创建选项，点击后导航到 `/object-types/new` 和 `/link-types/new` 占位页 |
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
| AC23 | 路由测试：所有路由路径可正确匹配对应组件（含 `/object-types/new`、`/link-types/new`） |
| AC24 | 路由测试：每个路由渲染对应的占位组件 |
| AC25 | 路由测试：`/object-types/:rid` 重定向到 `/object-types/:rid/overview` |
| AC26 | 组件测试：ConfigProvider 正确传入 theme 和 locale |
| AC27 | 代码审查：theme.ts 存在且包含品牌色、圆角等 token |
| AC28 | 组件测试：i18n 初始化支持 `zh-CN` 和 `en-US` 两种语言 |
| AC29 | 组件测试：LanguageSwitcher 可见并可切换语言 |
| AC30 | 代码审查：翻译文件包含 spec 要求的所有 key |
| AC31 | 组件测试：切换语言后 Ant Design 组件语言联动变化（AntD locale map 使用 `en-US`/`zh-CN` 键） |
| AC32 | 组件测试：ErrorBoundary 捕获子组件错误，显示友好页面 |
| AC33 | 代码审查：QueryCache 和 MutationCache 均配置了 onError 全局拦截，覆盖 query 和 mutation 错误 |

---

## Review 修订记录

以下为对 `plan-review.md` 各项 finding 的处理：

| # | 级别 | 问题 | 处理 |
|---|------|------|------|
| 1 | High | 详情侧边栏职责冲突 | 采用双布局路由方案（AD-2），AppShell/HomeLayout/DetailLayout 三层职责清晰分离 |
| 2 | High | "New" 菜单缺少路由契约 | 补齐 `/object-types/new` 和 `/link-types/new` 占位路由（AD-8、路由配置） |
| 3 | High | i18n 语言码不一致 | 统一使用 `en-US`/`zh-CN` 完整码，增加 `load: 'currentOnly'`（AD-10、国际化设计） |
| 4 | Medium | 路由技术路线前后不一致 | 全文统一为 `createBrowserRouter` + `RouterProvider`（AD-7） |
| 5 | Medium | 全局错误处理仅覆盖 mutation | 使用 `QueryCache`/`MutationCache` 的 `onError` 统一拦截（错误处理章节） |
| 6 | Medium | 测试策略与路由实现不匹配 | 统一使用 `createMemoryRouter` + `RouterProvider`（测试策略章节） |
| 7 | Medium | PRD 分支导航未显式处理 | 新增范围边界章节，TopBar 预留占位 slot |
| 8 | Low | 桌面端最小宽度未实现 | AppShell 根容器设置 `min-width: 1280px`（AD-11） |
