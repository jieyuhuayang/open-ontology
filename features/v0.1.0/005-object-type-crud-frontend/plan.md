# F005 Object Type CRUD Frontend — 技术方案 (plan.md)

## Context

F003（后端 Object Type CRUD）已完成，提供完整的 REST API。F004（App Shell）已完成，提供布局系统、路由骨架和占位页面。本方案设计 F005 的前端实现：将占位页面替换为功能完整的列表页、创建弹窗、详情页和 Overview 页面，实现 Object Type 的端到端 CRUD 闭环。

---

## 1. 类型生成

仅当后端 schema 变更时再执行 `server-openapi` / `web-typegen` 重新生成类型：

```bash
just server-openapi   # 从 FastAPI 重新生成 openapi.json
just web-typegen      # openapi-typescript → src/generated/api.ts
```

新建 `src/api/types.ts` 提供便捷类型别名（从 generated 重导出，不手写）：

```typescript
import type { components } from '@/generated/api';
export type ObjectType = components['schemas']['ObjectTypeWithChangeState'];
export type ObjectTypeCreateRequest = components['schemas']['ObjectTypeCreateRequest'];
export type ObjectTypeUpdateRequest = components['schemas']['ObjectTypeUpdateRequest'];
export type ObjectTypeListResponse = components['schemas']['ObjectTypeListResponse'];
export type Icon = components['schemas']['Icon'];
```

---

## 2. API 层（TanStack Query Hooks）

**文件**: `src/api/object-types.ts`

### Query Key Factory

```typescript
export const objectTypeKeys = {
  all: ['object-types'] as const,
  lists: () => [...objectTypeKeys.all, 'list'] as const,
  list: (params: { page: number; pageSize: number }) => [...objectTypeKeys.lists(), params] as const,
  details: () => [...objectTypeKeys.all, 'detail'] as const,
  detail: (rid: string) => [...objectTypeKeys.details(), rid] as const,
};
```

### Hooks

| Hook | 类型 | 说明 |
|------|------|------|
| `useObjectTypes(page, pageSize)` | useQuery | 分页列表 |
| `useObjectType(rid)` | useQuery | 单个详情 |
| `useCreateObjectType()` | useMutation | 创建，成功后 invalidate lists + seed detail cache |
| `useUpdateObjectType(rid)` | useMutation | 更新，成功后 invalidate lists + detail(rid) |
| `useDeleteObjectType()` | useMutation | 删除，成功后 invalidate lists + remove detail(rid) |

### 缓存失效策略

- **创建后**: invalidate `lists()`, setQueryData `detail(newRid)`
- **更新后**: invalidate `lists()` + `detail(rid)`
- **删除后**: invalidate `lists()`, removeQueries `detail(rid)`

### Mutation 错误处理

创建弹窗使用 `mutateAsync` + try/catch 映射已知错误码到表单字段错误：
- `OBJECT_TYPE_ID_CONFLICT` → ID 字段提示冲突
- `OBJECT_TYPE_API_NAME_CONFLICT` → API Name 字段提示冲突
- `OBJECT_TYPE_RESERVED_API_NAME` → API Name 字段提示保留字

为避免全局 toast 与表单错误重复提示，在 `queryClient.ts` 的 `MutationCache.onError` 中增加 `meta.skipGlobalError` 支持，创建 mutation 设置该 meta。

---

## 3. 架构决策

### AD-1: 创建流程用 Modal，不用路由

Spec 要求创建使用 Modal 对话框。当前 `CreateMenu` 导航到 `/object-types/new` 路由需改造：
- 新建 Zustand store `create-object-type-modal-store.ts`（`isOpen` + `open()` / `close()`）
- `CreateMenu` 改为调用 `open()` 而非 `navigate`
- Modal 渲染在 `HomeLayout` 内（Outlet 之后），确保从任何 Home 页面都可触发
- 删除 `router.tsx` 中 `/object-types/new` 路由

### AD-2: 内联编辑 = 组件本地状态 + 即时 PUT

Overview 页每个可编辑字段使用 `InlineEditText` 组件，内部维护 `isEditing` + `draftValue`。失焦/Enter 时调用 `useUpdateObjectType` mutation。每个字段独立保存。下拉字段（Status / Visibility）使用 Ant Design `Select`，onChange 直接触发 PUT。

### AD-3: DynamicIcon 静态映射

图标集固定 20-30 个，使用静态 `Record<string, ComponentType>` 映射表，不做动态 import。

### AD-4: DetailSidebarLayout 扩展三点菜单

为 `DetailSidebarLayout` 添加 `extra?: ReactNode` prop，在资源名称旁渲染额外内容。`ObjectTypeDetailLayout` 传入 `<Dropdown>` 三点菜单。向后兼容，LinkType 可复用。

### AD-5: 客户端筛选

后端 GET list API 仅支持 `page` + `pageSize`，不支持 status/visibility 筛选参数。MVP 阶段采用**客户端筛选**：前端拿到当前页数据后在内存中按 status/visibility 过滤显示。筛选条件和分页用组件本地 `useState`。注意客户端筛选后实际显示条数可能少于 pageSize，MVP 可接受。

### AD-6: Recently Viewed 集成（可选跨特性增强）

`ObjectTypeDetailLayout` 在获取详情数据后，通过 `useEffect` 调用 `useRecentlyViewedStore.addItem()`，与 Discover 页已有的最近查看功能打通。此功能为低风险可选增强，零额外依赖。

### AD-7: 加载态设计

- **列表页**: `loading={isLoading}` 传给 Ant Table，使用 Table 内置 Spin
- **详情页**: `ObjectTypeDetailLayout` 在 `isLoading` 时返回居中 `<Spin />`
- **Overview 页**: 父级已处理 loading，子页只在有 data 时渲染（通过 Outlet context 或条件渲染）

---

## 4. 组件树

### 4.1 列表页 `/object-types`

```
ObjectTypeListPage
├── 页头：标题 + "New object type" Button → open create modal
├── FilterBar：Status 多选 + Visibility 多选（Ant Dropdown / Select）
├── Table (antd)
│   ├── Column: 复选框（预留）
│   ├── Column: NAME = Icon + displayName
│   ├── Column: STATUS = Tag (Active/Experimental/Deprecated 不同颜色)
│   ├── Column: VISIBILITY = Tag (Prominent/Normal/Hidden)
│   └── Column: 变更状态 = ChangeStateBadge
├── EmptyState（items 为空时）："Create your first object type" + Button
└── CreateObjectTypeModal（由 Zustand store 控制显隐）
```

### 4.2 创建弹窗 `CreateObjectTypeModal`

```
Modal (Ant Design)
└── Form
    ├── IconSelector（Popover：图标网格 + 颜色色板）
    ├── Display Name (Input, 必填)
    ├── Description (TextArea, 可选)
    ├── ID (Input, 必填, 实时格式校验)
    └── API Name (Input, 必填, 实时格式+保留字校验)
```

### 4.3 详情布局 `/object-types/:rid`

```
ObjectTypeDetailLayout（修改现有）
├── DetailSidebarLayout（传入真实数据 + extra 三点菜单）
│   ├── resourceIcon = DynamicIcon(data.icon)
│   ├── resourceName = data.displayName
│   ├── badges = StatusBadge(data.status) + ChangeStateBadge(data.changeState)
│   └── extra = Dropdown(三点菜单: Delete)
├── DeleteObjectTypeModal（确认弹窗）
└── Outlet → ObjectTypeOverviewPage / PlaceholderPage
```

### 4.4 Overview 页 `/object-types/:rid/overview`

```
ObjectTypeOverviewPage
├── MetadataSection
│   ├── 左侧
│   │   ├── IconSelector（点击编辑图标）
│   │   ├── InlineEditText (displayName, 必填)
│   │   └── InlineEditText (description, 可选, placeholder "Type here...")
│   ├── 右侧
│   │   ├── Select (status: Active/Experimental/Deprecated, 立即保存)
│   │   └── Select (visibility: Prominent/Normal/Hidden, 立即保存)
│   └── 底部行
│       ├── ReadOnly (ID)
│       ├── InlineEditText (apiName, active 时禁用 + tooltip)
│       └── ReadOnly (RID)
├── PlaceholderCard ("Properties (0)" + 空状态)
├── PlaceholderCard ("Action types (0)" + 空状态)
├── PlaceholderCard ("Link types (0)" + 空状态)
└── PlaceholderCard ("Data" + 空状态)
```

---

## 5. 可复用组件

| 组件 | 文件路径 | 职责 |
|------|---------|------|
| `StatusBadge` | `src/components/StatusBadge.tsx` | 资源状态标签：active=绿, experimental=橙, deprecated=红 |
| `ChangeStateBadge` | `src/components/ChangeStateBadge.tsx` | 变更状态标签：published 不显示, created=绿 "New", modified=蓝 "Modified", deleted=红 "Deleted" |
| `DynamicIcon` | `src/components/DynamicIcon.tsx` | 根据 icon name 字符串渲染 Ant Design 图标 + color |
| `IconSelector` | `src/components/IconSelector.tsx` | Popover：~25 个图标网格 + 12 色色板 |
| `InlineEditText` | `src/components/InlineEditText.tsx` | 点击切换编辑态，blur/Enter 提交，Esc 取消，支持 disabled + tooltip + validate |
| `PlaceholderCard` | `src/components/PlaceholderCard.tsx` | 卡片壳：标题 + 计数 + 空状态文案 |

---

## 6. 状态管理

| 状态 | 存储位置 | 理由 |
|------|---------|------|
| 列表数据 | TanStack Query `useObjectTypes` | 服务端状态 |
| 详情数据 | TanStack Query `useObjectType(rid)` | 服务端状态 |
| 创建弹窗开关 | Zustand `useCreateObjectTypeModalStore` | CreateMenu + ListPage 共享 |
| 内联编辑草稿 | 组件本地 `useState` | 瞬态编辑 |
| 筛选/分页 | 组件本地 `useState` | MVP 够用 |
| 删除确认弹窗 | 组件本地 `useState` | 仅 DetailLayout 使用 |
| 最近查看 | Zustand `useRecentlyViewedStore`（已有） | 持久化 |

---

## 7. 校验工具

**文件**: `src/utils/validation.ts`

```typescript
const ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const API_NAME_PATTERN = /^[A-Z][a-zA-Z0-9_]*$/;
const RESERVED_API_NAMES = ['ontology', 'object', 'property', 'link', 'relation',
  'rid', 'primarykey', 'typeid', 'ontologyobject'];

export function validateObjectTypeId(value: string): string | null;
export function validateApiName(value: string): string | null;
```

创建弹窗中使用 Ant Design Form 的 `rules` + 自定义 validator，实时触发（`validateTrigger: 'onChange'`）。

---

## 8. 路由变更

修改 `src/router.tsx`：
- **删除** `{ path: 'object-types/new', element: <PlaceholderPage ... /> }`
- **替换** overview 子路由的 PlaceholderPage 为 `ObjectTypeOverviewPage`
- **保留** 已有的 index 重定向 `<Navigate to="overview" replace />`

修改 `CreateMenu.tsx`：
- 去掉 `useNavigate` + `navigate('/object-types/new')`
- 改为 `useCreateObjectTypeModalStore().open()`

---

## 9. i18n

在 `en-US/common.json` 和 `zh-CN/common.json` 中新增 `objectType` 命名空间，包含：
- `listTitle`, `newObjectType`, `createTitle`, `createSuccess`
- `deleteTitle`, `deleteConfirm`, `deleteSuccess`, `cannotDeleteActive`
- `cannotModifyApiNameActive`
- `emptyTitle`, `emptyDescription`
- `fields.*` (displayName, description, id, apiName, rid, icon, status, visibility)
- `status.*` (active, experimental, deprecated)
- `visibility.*` (prominent, normal, hidden)
- `changeState.*` (new, modified, deleted)
- `validation.*` (idFormat, apiNameFormat, apiNameReserved, displayNameRequired, idConflict, apiNameConflict)
- `placeholders.*` (properties, actionTypes, linkTypes, data 及其空状态文案)

---

## 10. 文件清单

### 新建文件 (~15 个)

| 文件 | 说明 |
|------|------|
| `src/generated/api.ts` | openapi-typescript 自动生成 |
| `src/api/types.ts` | 类型重导出 |
| `src/api/object-types.ts` | Query hooks + query keys |
| `src/utils/validation.ts` | ID / API Name 校验 |
| `src/stores/create-object-type-modal-store.ts` | 创建弹窗状态 |
| `src/components/ChangeStateBadge.tsx` | 变更状态标签 |
| `src/components/DynamicIcon.tsx` | 动态图标 |
| `src/components/IconSelector.tsx` | 图标选择器 |
| `src/components/InlineEditText.tsx` | 内联编辑 |
| `src/components/PlaceholderCard.tsx` | 占位卡片 |
| `src/pages/object-types/ObjectTypeOverviewPage.tsx` | Overview 页 |
| `src/pages/object-types/components/CreateObjectTypeModal.tsx` | 创建弹窗 |
| `src/pages/object-types/components/DeleteObjectTypeModal.tsx` | 删除确认弹窗 |
| `src/pages/object-types/components/ObjectTypeTable.tsx` | 列表表格 |
| `src/pages/object-types/components/MetadataSection.tsx` | 元数据区 |

### 修改文件 (~8 个)

| 文件 | 变更 |
|------|------|
| `apps/server/openapi.json` | 重新生成（含 object-type 路由） |
| `src/router.tsx` | 删除 /object-types/new，替换 overview placeholder |
| `src/queryClient.ts` | 增加 `meta.skipGlobalError` 支持 |
| `src/components/layout/CreateMenu.tsx` | navigate → Zustand store.open() |
| `src/components/layout/DetailSidebarLayout.tsx` | 增加 `extra?: ReactNode` prop |
| `src/components/layout/HomeLayout.tsx` | 增加 CreateObjectTypeModal |
| `src/pages/object-types/ObjectTypeListPage.tsx` | 替换 placeholder 为完整列表 |
| `src/pages/object-types/ObjectTypeDetailLayout.tsx` | 获取数据 + 传真实 props + 三点菜单 + 删除弹窗 + recently viewed |
| `src/locales/en-US/common.json` | 增加 objectType.* 翻译 |
| `src/locales/zh-CN/common.json` | 增加 objectType.* 翻译 |

---

## 11. 验证方案

### 手动验证

1. **列表页**：访问 `/object-types`，确认表格渲染、分页、筛选、空状态、行点击跳转
2. **创建**：点击 "New object type" / TopBar CreateMenu，弹窗填写表单，验证实时校验（ID/API Name 格式、保留字），提交后跳转到详情页，列表刷新
3. **详情页**：确认侧边栏显示图标+名称+变更状态，三点菜单可用
4. **Overview**：内联编辑 displayName/description/apiName，确认即时保存；修改 status/visibility 下拉；active 状态下 apiName 禁用
5. **删除**：非 active 可删除，确认弹窗后返回列表；active 菜单项置灰
6. **图标选择器**：Popover 选择图标和颜色，实时预览
7. **i18n**：切换语言确认所有文案正确

### 自动化测试

- 可复用组件单测：`ChangeStateBadge`, `InlineEditText`, `DynamicIcon`
- 页面集成测试（mock API）：列表页渲染、创建流程、详情加载
- 路由测试更新：移除 `/object-types/new` 测试，更新 overview 测试
