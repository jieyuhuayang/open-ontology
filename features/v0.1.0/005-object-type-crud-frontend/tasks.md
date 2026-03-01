# F005 Object Type CRUD Frontend — 任务清单 (tasks.md)

> 基于 plan.md 拆解的原子任务，每个任务一次 AI 会话可完成。

---

## 阶段 1：类型生成与基础设施

- [x] **T1: 重新生成 OpenAPI 类型**
  - 运行 `just server-openapi` 重新生成 `apps/server/openapi.json`（含 object-type 路由）
  - 运行 `just web-typegen` 生成 `src/generated/api.ts`
  - 新建 `src/api/types.ts`，从 generated 重导出便捷类型别名

- [x] **T2: API Hooks + Query Client 改造**
  - 新建 `src/api/object-types.ts`：query key factory + 5 个 hooks（list, detail, create, update, delete）
  - 修改 `src/queryClient.ts`：MutationCache.onError 增加 `meta.skipGlobalError` 支持

- [x] **T3: 校验工具 + Zustand Store**
  - 新建 `src/utils/validation.ts`：validateObjectTypeId, validateApiName
  - 新建 `src/stores/create-object-type-modal-store.ts`：isOpen + open() / close()

---

## 阶段 2：可复用组件

- [x] **T4: ChangeStateBadge + DynamicIcon**
  - 新建 `src/components/ChangeStateBadge.tsx`
  - 新建 `src/components/DynamicIcon.tsx`（25 个图标的静态映射表）

- [x] **T5: IconSelector + InlineEditText + PlaceholderCard**
  - 新建 `src/components/IconSelector.tsx`（Popover + 图标网格 + 12 色色板）
  - 新建 `src/components/InlineEditText.tsx`（click-to-edit, blur/Enter save, Esc cancel）
  - 新建 `src/components/PlaceholderCard.tsx`（卡片壳 + 空状态）

---

## 阶段 3：页面组件

- [x] **T6: ObjectTypeTable + 列表页**
  - 新建 `src/pages/object-types/components/ObjectTypeTable.tsx`
  - 重写 `src/pages/object-types/ObjectTypeListPage.tsx`（表格 + 筛选 + 空状态 + 分页）

- [x] **T7: CreateObjectTypeModal**
  - 新建 `src/pages/object-types/components/CreateObjectTypeModal.tsx`
  - 包含 IconSelector、表单校验、服务器错误码映射

- [x] **T8: DeleteObjectTypeModal + DetailLayout 改造**
  - 新建 `src/pages/object-types/components/DeleteObjectTypeModal.tsx`
  - 重写 `src/pages/object-types/ObjectTypeDetailLayout.tsx`（API 数据加载、三点菜单、recently viewed）

- [x] **T9: MetadataSection + Overview 页**
  - 新建 `src/pages/object-types/components/MetadataSection.tsx`（内联编辑 + 下拉选择）
  - 新建 `src/pages/object-types/ObjectTypeOverviewPage.tsx`

---

## 阶段 4：布局/路由改造 + i18n

- [x] **T10: 路由与布局更新**
  - 修改 `src/router.tsx`：删除 `/object-types/new`，替换 overview placeholder
  - 修改 `src/components/layout/CreateMenu.tsx`：navigate → Zustand store.open()
  - 修改 `src/components/layout/DetailSidebarLayout.tsx`：增加 `extra` + `onNavClick` props
  - 修改 `src/components/layout/HomeLayout.tsx`：增加 CreateObjectTypeModal

- [x] **T11: i18n 翻译**
  - 修改 `src/locales/en-US/common.json`：增加 objectType.* 命名空间
  - 修改 `src/locales/zh-CN/common.json`：增加 objectType.* 命名空间

---

## 阶段 5：验证

- [x] **T12: TypeScript 编译验证 + 测试修复**
  - 运行 `tsc --noEmit` 确认无类型错误
  - 更新受影响的测试文件（router.test.tsx, HomeLayout.test.tsx, ObjectTypeDetailLayout.test.tsx）
  - 运行 `vitest run` 确认全部 85 个测试通过
