# Feature: App Shell & UI 基础框架

**关联 PRD**: [docs/prd/0_1_0（MVP）/本体管理平台（Ontology Manager） PRD.md §整体布局]
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
以便 **在不同功能模块之间快速切换**。

---

## 验收标准

### 布局
- **AC1**: 页面采用侧边栏 + 顶栏 + 内容区三段式布局
- **AC2**: 侧边栏包含导航菜单：对象类型（Object Types）、链接类型（Link Types）
- **AC3**: 侧边栏支持折叠/展开
- **AC4**: 顶栏包含全局搜索框占位（仅 UI 壳，搜索逻辑由 F008 实现）

### 路由
- **AC5**: React Router v6 嵌套路由配置就绪，包含以下路由：
  - `/object-types` — 对象类型列表
  - `/object-types/:rid` — 对象类型详情
  - `/link-types` — 链接类型列表
  - `/link-types/:rid` — 链接类型详情
  - `/` — 重定向到 `/object-types`
  - `*` — 404 页面
- **AC6**: 每个路由目标有对应的占位组件（显示页面名称即可），后续特性替换

### 主题与组件库
- **AC7**: Ant Design 5.x 通过 `ConfigProvider` 全局配置（主题 token、语言包）
- **AC8**: 自定义主题 token 可统一修改（品牌色、圆角等）

### 国际化
- **AC9**: i18next 初始化完成，支持中文（zh-CN）和英文（en-US）两种语言
- **AC10**: 语言切换入口在顶栏或侧边栏可见
- **AC11**: 基础翻译文件包含导航项、通用按钮（保存、取消、删除、确认）、通用提示文案
- **AC12**: Ant Design 组件语言随 i18n 切换联动

### 错误处理
- **AC13**: 全局 ErrorBoundary 捕获未处理的渲染错误，显示友好的错误页面（而非白屏）
- **AC14**: API 错误的全局拦截器就绪（TanStack Query 的 `QueryClient` 默认错误处理）

---

## 边界情况

- **不支持**：用户认证/登录（MVP 无权限系统）
- **不支持**：多主题切换（深色模式等）—— 延后到 v0.2.0
- **不支持**：响应式移动端适配 —— MVP 仅支持桌面端（最小宽度 1280px）
- 导航菜单中"变更管理"入口由 F009 前端特性添加

---

## 非功能要求

- **性能**: App Shell 首屏加载时间 < 1s（开发环境，Vite dev server）
- **可维护性**: 布局组件与业务组件解耦，布局变更不影响页面内容
- **可访问性**: 导航使用语义化 HTML（`<nav>`, `<main>`, `<aside>`）

---

## 相关文档

- 技术栈: [docs/architecture/04-tech-stack-recommendations.md]
- 系统架构: [docs/architecture/01-system-architecture.md]
- 依赖特性: [features/v0.1.0/001-project-scaffolding]
- 被依赖: [features/v0.1.0/005-object-type-crud-frontend]、[features/v0.1.0/006-link-type-crud]、[features/v0.1.0/007-property-management]、[features/v0.1.0/009-change-management]
