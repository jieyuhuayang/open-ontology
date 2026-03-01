# Tasks: App Shell & UI 基础框架

**关联 Plan**: `features/v0.1.0/004-app-shell/plan.md`
**规则**: 奇数任务写测试，偶数任务写实现

---

## 任务列表

### Task 1 — ✅ 测试：theme.ts + queryClient.ts + Zustand stores

**文件**:
- `apps/web/src/__tests__/theme.test.ts`
- `apps/web/src/__tests__/queryClient.test.ts`
- `apps/web/src/stores/__tests__/sidebar-store.test.ts`
- `apps/web/src/stores/__tests__/recently-viewed-store.test.ts`

**验收**:
- theme.ts: 验证导出的 ThemeConfig 包含 colorPrimary、borderRadius、Layout/Menu 组件 token
- queryClient.ts: 验证 QueryCache 和 MutationCache 均配置了 onError；验证 defaultOptions.queries.retry=1 和 refetchOnWindowFocus=false
- sidebar-store: 验证 collapsed 默认值 false；toggleCollapsed 切换状态；persist 中间件写入 localStorage
- recently-viewed-store: 验证 addItem 添加记录；同 rid 去重（更新 viewedAt）；超过 6 条自动淘汰最旧；按 viewedAt 降序排列

**关联 AC**: AC26, AC27, AC33, AC3(折叠持久化), AC21(最近查看存储)

---

### Task 2 — ✅ 实现：theme.ts + queryClient.ts + Zustand stores

**文件**:
- `apps/web/src/theme.ts`（新建）
- `apps/web/src/queryClient.ts`（新建）
- `apps/web/src/stores/sidebar-store.ts`（新建）
- `apps/web/src/stores/recently-viewed-store.ts`（新建）

**要点**:
- theme.ts: 按 plan 中主题配置段落实现，导出 ThemeConfig 对象
- queryClient.ts: 使用 QueryCache + MutationCache 的 onError 全局错误拦截（message.error + console.error）
- sidebar-store: Zustand + persist 中间件，key = `sidebar-collapsed`
- recently-viewed-store: Zustand + persist 中间件，key = `recently-viewed`；RecentlyViewedItem 接口含 rid, displayName, icon, description, viewedAt

**关联 AC**: AC26, AC27, AC33, AC3, AC21

---

### Task 3 — 测试：i18n 重构（en-US / zh-CN 完整语言码）

**文件**:
- `apps/web/src/locales/__tests__/i18n.test.ts`

**验收**:
- i18n 初始化成功，supportedLngs 包含 `en-US` 和 `zh-CN`
- `load: 'currentOnly'` 防止加载父语言
- fallbackLng 为 `en-US`
- 切换到 `zh-CN` 后 `t('nav.discover')` 返回中文 "发现"
- 切换到 `en-US` 后 `t('nav.discover')` 返回 "Discover"
- 翻译文件包含 plan 中定义的所有 key（app, nav, topBar, sidebar, detail, discover, common, error, language）

**关联 AC**: AC28, AC30

---

### Task 4 — 实现：i18n 重构 + 翻译文件

**文件**:
- `apps/web/src/locales/i18n.ts`（重写）
- `apps/web/src/locales/en-US/common.json`（新建）
- `apps/web/src/locales/zh-CN/common.json`（新建）

**要点**:
- 按 plan 国际化设计段落重写 i18n.ts
- 新建 en-US 和 zh-CN 翻译文件，包含 plan 中定义的所有 key
- 删除旧的 `locales/en/common.json` 和 `locales/zh/common.json`

**关联 AC**: AC28, AC30, AC31

---

### Task 5 — 测试：ErrorBoundary + PlaceholderPage + NotFoundPage

**文件**:
- `apps/web/src/components/__tests__/ErrorBoundary.test.tsx`
- `apps/web/src/components/__tests__/PlaceholderPage.test.tsx`
- `apps/web/src/pages/__tests__/NotFoundPage.test.tsx`

**验收**:
- ErrorBoundary: 子组件抛错时渲染友好错误页面（包含错误标题 + "返回首页"按钮）；无错误时正常渲染子组件
- PlaceholderPage: 传入 title 时显示 title；传入 comingSoon 时显示 "Coming Soon" 文案
- NotFoundPage: 显示 404 提示文案 + "返回首页"按钮/链接

**关联 AC**: AC24, AC32

---

### Task 6 — 实现：ErrorBoundary + PlaceholderPage + NotFoundPage

**文件**:
- `apps/web/src/components/ErrorBoundary.tsx`（新建）
- `apps/web/src/components/PlaceholderPage.tsx`（新建）
- `apps/web/src/pages/NotFoundPage.tsx`（新建）

**要点**:
- ErrorBoundary: 使用 react-router-dom 的 `useRouteError` + Ant Design `Result` 组件（status="error"）；提供"返回首页"按钮（Link to `/`）
- PlaceholderPage: 接受 `title: string` 和 `comingSoon?: boolean` props；使用 Ant Design `Result` 或 `Empty`
- NotFoundPage: 使用 Ant Design `Result`（status="404"），提供返回首页链接

**关联 AC**: AC24, AC32

---

### Task 7 — 测试：LanguageSwitcher + SearchBarPlaceholder + CreateMenu

**文件**:
- `apps/web/src/components/layout/__tests__/LanguageSwitcher.test.tsx`
- `apps/web/src/components/layout/__tests__/SearchBarPlaceholder.test.tsx`
- `apps/web/src/components/layout/__tests__/CreateMenu.test.tsx`

**验收**:
- LanguageSwitcher: 渲染语言切换入口；点击后可切换语言（调用 i18n.changeLanguage）；显示当前语言名称
- SearchBarPlaceholder: 渲染带 placeholder "Search by name, RID, aliases..." 的输入框；显示 ⌘K 快捷键提示；输入框为 disabled 状态
- CreateMenu: 渲染 "New" 按钮；下拉菜单包含 "Create Object Type" 和 "Create Link Type" 两项；点击菜单项后导航到 `/object-types/new` 和 `/link-types/new`

**关联 AC**: AC5, AC6, AC8, AC29

---

### Task 8 — 实现：LanguageSwitcher + SearchBarPlaceholder + CreateMenu

**文件**:
- `apps/web/src/components/layout/LanguageSwitcher.tsx`（新建）
- `apps/web/src/components/layout/SearchBarPlaceholder.tsx`（新建）
- `apps/web/src/components/layout/CreateMenu.tsx`（新建）

**要点**:
- LanguageSwitcher: Ant Design Dropdown/Select，选项为 English / 中文，调用 `i18n.changeLanguage('en-US')` / `i18n.changeLanguage('zh-CN')`
- SearchBarPlaceholder: `<Input prefix={<SearchOutlined />} placeholder={t('topBar.searchPlaceholder')} suffix="⌘K" disabled />`
- CreateMenu: `<Dropdown>` + `<Button>` "New"，菜单项 navigate 到对应路由

**关联 AC**: AC5, AC6, AC8, AC29

---

### Task 9 — 测试：TopBar

**文件**:
- `apps/web/src/components/layout/__tests__/TopBar.test.tsx`

**验收**:
- 渲染 `<header>` 语义标签
- 左侧显示 Logo 图标 + "Ontology Management" 标题
- 中部包含搜索框占位组件
- 右侧包含变更状态区域占位元素（`change-status-slot`）
- 右侧包含 "New" 创建按钮
- 右侧包含语言切换入口

**关联 AC**: AC4, AC5, AC6, AC7, AC8

---

### Task 10 — 实现：TopBar

**文件**:
- `apps/web/src/components/layout/TopBar.tsx`（新建）

**要点**:
- 使用 Ant Design Layout.Header 或自定义 `<header>`
- 左：Logo（可用 Ant Design icon 占位）+ Typography "Ontology Management"
- 中：`<SearchBarPlaceholder />`
- 右：分支导航占位 → 变更状态占位 → `<CreateMenu />` → `<LanguageSwitcher />`
- 布局使用 Flex

**关联 AC**: AC4, AC5, AC6, AC7, AC8

---

### Task 11 — 测试：HomeSidebar

**文件**:
- `apps/web/src/components/layout/__tests__/HomeSidebar.test.tsx`

**验收**:
- 渲染 `<nav>` 语义标签
- 顶部显示 Ontology 名称（"Default Ontology"）
- 导航菜单包含 Discover + Resources 分组（Object Types, Properties, Link Types, Action Types）
- Object Types / Link Types 旁显示数量或 "—"（API 未就绪时）
- 当前路由对应的导航项高亮（通过 selectedKeys）
- 支持折叠/展开（调用 sidebar-store）

**关联 AC**: AC9, AC10, AC11, AC12, AC13, AC3

---

### Task 12 — 实现：HomeSidebar

**文件**:
- `apps/web/src/components/layout/HomeSidebar.tsx`（新建）

**要点**:
- 使用 Ant Design `Layout.Sider` + `Menu`
- Sider 的 collapsed 状态绑定 sidebar-store
- Menu items 按 plan 配置（图标、label、badge）
- 使用 `useLocation` 计算 selectedKeys
- Resources 分组使用 Menu.ItemGroup 或 type: 'group'
- 资源计数暂时使用 "—"（后续由 useResourceCount hook 填充）

**关联 AC**: AC9, AC10, AC11, AC12, AC13, AC3

---

### Task 13 — 测试：DetailSidebarLayout

**文件**:
- `apps/web/src/components/layout/__tests__/DetailSidebarLayout.test.tsx`

**验收**:
- 渲染 `<nav>` 语义标签
- 显示 "← Back home" 按钮，点击后导航到 backTo 路由
- 显示资源图标、名称
- 可选显示状态 badge
- 基于 navItems props 渲染子页面导航项
- activeKey 对应的导航项高亮
- 导航项旁可选显示 badge 数量

**关联 AC**: AC14, AC15, AC16, AC17, AC18, AC19

---

### Task 14 — 实现：DetailSidebarLayout

**文件**:
- `apps/web/src/components/layout/DetailSidebarLayout.tsx`（新建）

**要点**:
- 纯展示组件（presentational），所有数据通过 props 传入
- Props: resourceName, resourceIcon, statusBadge?, navItems, backTo, activeKey
- 使用 Ant Design Menu 渲染子页面导航
- "← Back home" 使用 react-router-dom Link
- 不读路由、不查状态

**关联 AC**: AC14, AC15, AC16, AC17, AC18, AC19

---

### Task 15 — 测试：AppShell + HomeLayout

**文件**:
- `apps/web/src/components/layout/__tests__/AppShell.test.tsx`
- `apps/web/src/components/layout/__tests__/HomeLayout.test.tsx`

**验收**:
- AppShell: 渲染 TopBar + `<Outlet />`；根容器 minWidth=1280；渲染 `<header>` 标签
- HomeLayout: 渲染 `<aside>` + `<main>` 语义标签；包含 HomeSidebar；渲染 `<Outlet />` 子内容

**关联 AC**: AC1, AC2, AC3

---

### Task 16 — 实现：AppShell + HomeLayout

**文件**:
- `apps/web/src/components/layout/AppShell.tsx`（新建）
- `apps/web/src/components/layout/HomeLayout.tsx`（新建）

**要点**:
- AppShell: `<Layout style={{ minHeight: '100vh', minWidth: 1280 }}>` + `<header><TopBar /></header>` + `<Outlet />`
- HomeLayout: `<Layout>` + `<aside><HomeSidebar /></aside>` + `<Layout.Content><main><Outlet /></main></Layout.Content>`

**关联 AC**: AC1, AC2, AC3

---

### Task 17 — 测试：DiscoverPage

**文件**:
- `apps/web/src/pages/__tests__/DiscoverPage.test.tsx`

**验收**:
- 显示 "Recently viewed object types" 标题
- 无记录时显示空状态提示 "No recently viewed object types"
- 有记录时展示卡片（图标、名称、描述摘要）
- 显示记录总数
- 最多展示 6 张卡片

**关联 AC**: AC20, AC21, AC22

---

### Task 18 — 实现：DiscoverPage

**文件**:
- `apps/web/src/pages/DiscoverPage.tsx`（新建）

**要点**:
- 从 recently-viewed-store 读取 items
- 标题区：`t('discover.recentlyViewed')` + 总数
- 卡片区：Ant Design `Card` × 最多 6 个
- 空状态：Ant Design `Empty`
- 删除旧的 `pages/HomePage.tsx`

**关联 AC**: AC20, AC21, AC22

---

### Task 19 — 测试：ObjectTypeDetailLayout + LinkTypeDetailLayout

**文件**:
- `apps/web/src/pages/object-types/__tests__/ObjectTypeDetailLayout.test.tsx`
- `apps/web/src/pages/link-types/__tests__/LinkTypeDetailLayout.test.tsx`

**验收**:
- ObjectTypeDetailLayout: 渲染 DetailSidebarLayout（navItems 含 Overview/Properties/Datasources）+ `<Outlet />`；包含 `<aside>` 和 `<main>` 语义标签
- LinkTypeDetailLayout: 渲染 DetailSidebarLayout（navItems 含 Overview/Datasources）+ `<Outlet />`
- 两者均计算当前子路由传递 activeKey

**关联 AC**: AC16, AC17

---

### Task 20 — 实现：DetailLayout + 列表页占位

**文件**:
- `apps/web/src/pages/object-types/ObjectTypeDetailLayout.tsx`（新建）
- `apps/web/src/pages/object-types/ObjectTypeListPage.tsx`（新建）
- `apps/web/src/pages/link-types/LinkTypeDetailLayout.tsx`（新建）
- `apps/web/src/pages/link-types/LinkTypeListPage.tsx`（新建）

**要点**:
- ObjectTypeDetailLayout: 配置 OT_NAV_ITEMS（Overview/Properties/Datasources）；使用 useParams + useLocation 计算 activeKey；渲染 DetailSidebarLayout + Outlet
- LinkTypeDetailLayout: 配置 LT_NAV_ITEMS（Overview/Datasources）；同上模式
- ObjectTypeListPage / LinkTypeListPage: 使用 PlaceholderPage 组件占位

**关联 AC**: AC16, AC17, AC24

---

### Task 21 — 测试：路由配置（routes, redirects, 404）

**文件**:
- `apps/web/src/__tests__/router.test.tsx`

**验收**:
- `/` 渲染 DiscoverPage
- `/object-types` 渲染 ObjectTypeListPage
- `/object-types/new` 渲染 CreateObjectType 占位页
- `/link-types` 渲染 LinkTypeListPage
- `/link-types/new` 渲染 CreateLinkType 占位页
- `/properties` 渲染 Properties 占位页（含 Coming Soon）
- `/action-types` 渲染 ActionTypes 占位页（含 Coming Soon）
- `/object-types/:rid` 重定向到 `/object-types/:rid/overview`
- `/link-types/:rid` 重定向到 `/link-types/:rid/overview`
- `/random-path` 渲染 404 页面
- 使用 `createMemoryRouter` + `RouterProvider` 测试

**关联 AC**: AC23, AC24, AC25

---

### Task 22 — 实现：router.tsx + App.tsx 重构

**文件**:
- `apps/web/src/router.tsx`（新建）
- `apps/web/src/App.tsx`（重写）

**要点**:
- router.tsx: 按 plan 路由配置段落实现 `createBrowserRouter`，导出 router 实例
- App.tsx: 移除 BrowserRouter/Routes，改用 RouterProvider；引入 theme.ts 和 queryClient.ts；AntD locale map 使用 `en-US`/`zh-CN` 键；ConfigProvider 传入 theme

**关联 AC**: AC23, AC25, AC26, AC31

---

## 依赖关系

```
Task 1-2 (基础设施) ─┐
Task 3-4 (i18n)     ─┤
                      ├→ Task 7-8 (TopBar 子组件) → Task 9-10 (TopBar)
                      ├→ Task 11-12 (HomeSidebar)
                      ├→ Task 13-14 (DetailSidebarLayout)
Task 5-6 (通用组件)  ─┤
                      ├→ Task 15-16 (AppShell + HomeLayout)
                      ├→ Task 17-18 (DiscoverPage)
                      ├→ Task 19-20 (DetailLayout + 列表页)
                      └→ Task 21-22 (Router + App.tsx 集成)
```

Tasks 1-6 可并行执行（无相互依赖）。Tasks 7+ 依赖基础设施就绪。Task 21-22 最后执行（集成所有组件）。

---

## 验证方式

每个偶数任务完成后运行：
```bash
cd apps/web && pnpm test --run
```

全部任务完成后运行：
```bash
cd apps/web && pnpm dev
```
手动验证：
1. 首页 `/` 显示 Discover 页面（空状态）
2. 侧边栏导航可点击，路由正确跳转
3. 侧边栏折叠/展开正常，刷新后状态保持
4. TopBar "New" 下拉菜单导航到创建占位页
5. 语言切换中英文正常
6. 访问不存在路由显示 404
7. `/object-types/test-rid` 自动重定向到 `/object-types/test-rid/overview`
