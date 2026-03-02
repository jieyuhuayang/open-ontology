# 004-app-shell 技术方案评审（Architecture Review）

**评审对象**: `features/v0.1.0/004-app-shell/plan.md`  
**交叉基线**: 
- `features/v0.1.0/004-app-shell/spec.md`
- `docs/prd/0_1_0（MVP）/本体管理平台（Ontology Manager） PRD.md`
- `docs/architecture/01-system-architecture.md`
- `docs/architecture/04-tech-stack-recommendations.md`

**结论**: 当前方案存在 **3 个高优先级阻塞项**，建议先修订后再进入实现。

---

## Findings（按严重级别）

### High

1. **详情侧边栏职责冲突，架构边界不清**
- **位置**: `plan.md:126-138`, `plan.md:147`, `plan.md:220-225`
- **问题**: 组件树中 `Sidebar` 负责渲染 `DetailSidebarLayout`；但后文又定义 `ObjectTypeDetailLayout/LinkTypeDetailLayout` 负责配置并承载 `DetailSidebarLayout`。
- **影响**: 实现阶段会出现“双重持有”与状态来源不一致，容易导致路由切换、高亮、最近查看写入逻辑重复或失效。
- **建议**: 二选一并写入明确契约。
  - 方案 A（推荐）: `AppLayout/Sidebar` 统一渲染 Detail Sidebar，详情页仅通过 route meta/context 提供配置。
  - 方案 B: 将 Detail Sidebar 下沉到各 DetailLayout，`AppLayout` 只渲染 Home Sidebar。

2. **`New` 菜单缺少可落地路由契约，无法满足 AC6**
- **位置**: `spec.md:34-35`（AC6）, `plan.md:104-107`, `plan.md:258-283`
- **问题**: 方案声明 `New` 只做导航入口，但路由清单未定义创建入口（例如 `/object-types/new`, `/link-types/new`）。
- **影响**: AC6 无法验收；实现时会出现“有菜单无目标页”或先接 404 的临时行为。
- **建议**: 在 F004 直接补齐创建占位路由（可后续被 F005/F006 替换），并在 plan 写死路径契约。

3. **i18n 语言码设计与验收标准不一致，AntD 语言联动存在失败风险**
- **位置**: `spec.md:102-103`, `spec.md:110`, `plan.md:323-385`
- **问题**: Spec 要求 `zh-CN`/`en-US`，但方案示例与当前实现习惯使用 `zh`/`en`。
- **影响**: 浏览器检测到 `zh-CN` 时，若映射仅按 `zh`/`en` 处理，会导致 Ant Design locale 回退到英文，AC31 难通过。
- **建议**: 在 plan 明确统一策略：
  - i18next `supportedLngs: ['zh-CN', 'en-US']`
  - 增加 fallback map（`zh`→`zh-CN`, `en`→`en-US`）
  - AntD locale map 与 i18n 语言码完全对齐。

### Medium

4. **路由技术路线描述前后不一致**
- **位置**: `plan.md:124-125` vs `plan.md:251-289`
- **问题**: 前文仍写 `BrowserRouter + Routes`，后文又改为 `createBrowserRouter + RouterProvider`。
- **影响**: 任务拆分和代码评审时易误实现。
- **建议**: 全文统一为 Data Router 方案，并删除旧描述。

5. **全局错误拦截仅覆盖 mutation，不满足 AC33 的“全局 API 错误处理”预期**
- **位置**: `spec.md:115`, `plan.md:399-413`
- **问题**: 当前仅在 `mutations.onError` 处理，queries 缺统一拦截策略。
- **影响**: 查询错误表现不一致，后续特性接入时重复造轮子。
- **建议**: 在 `QueryCache`/`MutationCache` 层统一 `onError`，并定义 toast/日志策略。

6. **测试策略与路由实现不匹配**
- **位置**: `plan.md:253-285`, `plan.md:427`
- **问题**: 运行时采用 `createBrowserRouter`，测试却写 `MemoryRouter`。
- **影响**: 路由重定向和 error boundary 行为测试可能失真。
- **建议**: 路由测试统一使用 `createMemoryRouter + RouterProvider`。

7. **PRD 的顶栏“分支导航/分支创建”未在方案中显式处理**
- **位置**: `PRD.md:84`, `plan.md`（缺失）
- **问题**: PRD 明确 top bar 包含分支导航能力，方案未实现也未声明延期。
- **影响**: 需求追踪断裂，后续评审容易产生“是否漏需求”争议。
- **建议**: 在 plan 边界中显式标注“分支能力延期到某特性/版本”，并预留可扩展插槽。

### Low

8. **桌面端最小宽度约束未转化为实现细则**
- **位置**: `spec.md:123`, `plan.md`（缺失）
- **问题**: Spec 说明 MVP 仅支持桌面端（min-width 1280），方案未定义处理方式。
- **影响**: 在窄屏设备上可能出现不可预期布局，验收口径不清。
- **建议**: 在 `AppLayout` 增加 `min-width: 1280px` 或明确“窄屏提示页”策略。

---

## 建议的修订优先级

1. 先修复 High 1-3（架构边界、创建路由契约、语言码统一）。
2. 再修复 Medium 4-7（文档一致性、错误处理、测试策略、PRD 追踪）。
3. 最后补 Low 8（桌面端约束实现细则）。

---

## 评审结论（Gate）

- **当前状态**: `Changes Requested`（需修改后再进入开发）
- **通过条件**: High 项全部关闭，且 Medium 至少关闭 4/4（第 4-7 项）
