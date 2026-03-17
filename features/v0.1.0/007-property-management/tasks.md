# Tasks: F007 Property Management（属性管理）

**关联 Plan**: `features/v0.1.0/007-property-management/design.md`
**状态**: 已完成（含回溯审查修复）

---

## 后端任务

### B1: 数据库迁移 ✅
- [x] 新建 `alembic/versions/0003_add_property_sort_order.py`
- [x] 添加 `sort_order`、`created_at`、`created_by`、`last_modified_at`、`last_modified_by` 列
- [x] 更新 `storage/models.py` 中 `PropertyModel` 补充对应字段
- [x] 执行 `alembic upgrade head`

### B2: 领域模型 ✅
- [x] 新建 `domain/property.py`：`StructField`、`Property`、`PropertyWithChangeState`
- [x] 新建请求/响应体：`PropertyCreateRequest`、`PropertyUpdateRequest`、`PropertySortOrderRequest`、`PropertyListResponse`
- [x] 定义 `PRIMARY_KEY_TYPES`、`TITLE_KEY_TYPES`、`ALL_BASE_TYPES`、`STRUCT_FIELD_TYPES` 常量

### B3: 校验器 ✅
- [x] 在 `domain/validators.py` 新增 `validate_property_id()`（`PROPERTY_INVALID_ID`）
- [x] 新增 `validate_property_api_name()`（`PROPERTY_INVALID_API_NAME`、`PROPERTY_RESERVED_API_NAME`）

### B4: Storage 层 ✅
- [x] 新建 `storage/property_storage.py`
- [x] 实现 `list_by_ontology()`（跨 ObjectType join 查询）
- [x] 实现 `list_by_object_type()`
- [x] 实现 `get_by_rid()`、`create()`、`update()`、`delete()`、`count_by_object_type()`

### B5: Working State 扩展 ✅
- [x] `get_merged_view()` 新增 `ResourceType.PROPERTY` 分支
- [x] `publish()` 新增 PROPERTY 分支调用 `_apply_property_change()`
- [x] 实现 `_apply_property_change()`（CREATE/UPDATE/DELETE，含 camelCase→snake_case key_map）

### B6: Service 层 ✅
- [x] 新建 `services/property_service.py`
- [x] 实现 `list()`：objectTypeRid 过滤 + 排序
- [x] 实现 `create()`：格式校验、唯一性检查、数量上限、baseType 约束、sort_order 自增
- [x] 实现 `update()`：active 约束、apiName 校验、backing_column 规范化、PK/TK 级联更新
- [x] 实现 `delete()`：active 保护、主键保护
- [x] 实现 `reorder()`：批量 sortOrder UPDATE change

### B7: Router + 注册 ✅
- [x] 新建 `routers/properties.py`（5 个端点，`/sort-order` 在 `/{rid}` 之前注册）
- [x] `main.py` 注册 `properties.router`

---

## 前端任务

### F1: 类型与 API Hooks ✅
- [x] 更新 `generated/api.ts`：手动补充 Property 相关 Schema
- [x] 更新 `api/types.ts`：导出 Property 相关类型
- [x] 新建 `api/properties.ts`：`propertyKeys` + 5 个 TanStack Query hooks
- [x] `useUpdateProperty` 在 PK/TK 变更时额外 invalidate ObjectType detail

### F2: 国际化 ✅
- [x] `locales/en-US/common.json` 新增 `property` 命名空间（全量 key）
- [x] `locales/zh-CN/common.json` 新增 `property` 命名空间（中文）

### F3: 基础 UI 组件 ✅
- [x] 新建 `PropertyTypeSelector.tsx`（可用类型 + coming soon 禁用选项）
- [x] 新建 `StructFieldEditor.tsx`（动态字段列表，STRUCT_FIELD_TYPES 约束）
- [x] 新建 `BackingColumnSection.tsx`（映射状态 + 设置/更改/移除弹窗）

### F4: 拖拽排序表格 ✅
- [x] 新建 `PropertyTable.tsx`
- [x] `package.json` 添加 `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`
- [x] 执行 `pnpm install` 安装依赖
- [x] 使用 `RowContext` 将 `useSortable listeners` 从 `SortableRow` 传递给 `DragHandleCell`
- [x] 实现 `onDragEnd` → `arrayMove` → `onReorder` 回调

### F5: 创建/编辑面板 ✅
- [x] 新建 `CreatePropertyDrawer.tsx`（表单校验、displayName→apiName 自动生成、array/struct 条件字段）
- [x] 新建 `EditPropertyPanel.tsx`（内部组件拆分避免 hooks 条件调用、PK/TK 操作区）

### F6: 主页面与路由 ✅
- [x] 新建 `ObjectTypePropertiesPage.tsx`（客户端三级过滤、空状态处理）
- [x] `router.tsx` 替换 Properties 占位路由为 `ObjectTypePropertiesPage`

---

## 回溯审查与修复（2026-03-17）

> 本特性在 SDD 流程规范化前完成开发，以下任务为事后回溯审查补全。

### R1: 后端 Bug 修复 ✅

| ID | 严重度 | 问题 | 修复内容 |
|----|--------|------|----------|
| BUG-1 | HIGH | `base_type` 创建时未校验是否在 `ALL_BASE_TYPES` 中 | 在 `create()` 中增加 `base_type` 和 `array_inner_type` 合法性校验，新增错误码 `PROPERTY_INVALID_BASE_TYPE` |
| BUG-2 | HIGH | 取消 PK/TK 时不级联清除 OT 的 `primaryKeyPropertyId`/`titleKeyPropertyId` | 在 `update()` 中增加 `isPrimaryKey: false` / `isTitleKey: false` 分支，级联设 OT 字段为 `None` |
| BUG-3 | HIGH | `reorder()` 的 `before` 字段始终为 `{"sortOrder": None}` | 构建 `rid_to_sort_order` 映射，记录真实旧值 |
| BUG-4 | HIGH | Array 类型设 TK 时未校验 `arrayInnerType` 是否为合法 TK 类型 | 在 TK 校验分支中，当 `base_type == "array"` 时额外检查 `arrayInnerType ∈ TITLE_KEY_TYPES` |

- 修改文件：`apps/server/app/services/property_service.py`
- 覆盖 AC：AC5（校验）、AC18-AC20（PK/TK 级联）、AC25（排序）

### R2: 后端单元测试 ✅
- [x] 新建 `tests/unit/test_property_service.py`（35 个测试）
- **TestCreate**（15 个）：成功默认值、sortOrder 自增、id/apiName 格式校验、保留字拒绝、**非法 base_type 拒绝（BUG-1）**、id/apiName 唯一性、200 上限、Array 缺 innerType / 嵌套 / **非法 innerType（BUG-1）**、Struct 缺 schema / 非法字段类型 / 字段名重复
  - 覆盖 AC：AC3-AC7, AC26-AC27
- **TestUpdate**（14 个）：displayName 更新、active apiName 拒绝、apiName 格式/唯一性、backingColumn 空→null、**PK 设置级联 + 取消级联（BUG-2）**、PK 非法类型/active OT 拒绝、**TK 设置级联 + Array TK 校验（BUG-4）+ 取消级联（BUG-2）**、404
  - 覆盖 AC：AC11-AC13, AC18-AC20
- **TestDelete**（3 个）：成功、active 拒绝、PK 拒绝
  - 覆盖 AC：AC8, AC20-AC22
- **TestList**（1 个）：排序 + 排除已删除
  - 覆盖 AC：AC23-AC25
- **TestReorder**（2 个）：**before 记录旧值（BUG-3）**、非法 RID 404
  - 覆盖 AC：AC29

### R3: 后端集成测试 ✅
- [x] 新建 `tests/integration/test_property_api.py`（13 个测试）
- 创建 201 + **非法 base_type 400（BUG-1）**
- 重复 id/apiName 409
- list 合并视图
- 更新 displayName、active apiName 400
- **PK 设置级联 + 取消级联（BUG-2）**
- 删除 active 400、删除 PK 400
- reorder 204 + 验证排序结果
- 完整生命周期（创建→更新→删除）

### R4: 前端测试 ✅
- [x] 新建 `ObjectTypePropertiesPage.test.tsx`（5 个测试）：空状态、属性列表、过滤器、Add 按钮、200 上限禁用
  - 覆盖 AC：AC2, AC7, AC8, AC9
- [x] 新建 `CreatePropertyDrawer.test.tsx`（5 个测试）：表单渲染、Create/Cancel 按钮、关闭状态、status/visibility、backingColumn/description
  - 覆盖 AC：AC3, AC4, AC5, AC26, AC27
- [x] 新建 `EditPropertyPanel.test.tsx`（11 个测试）：null 不渲染、详情展示、PK set/unset/invalid/active-OT、TK set/unset、删除 active 禁用、删除 PK 禁用、apiName 标签
  - 覆盖 AC：AC10-AC13, AC18-AC20, AC22
- [x] 新建 `BackingColumnAndStructField.test.tsx`（9 个测试）：映射/未映射状态、设置映射弹窗、disabled 隐藏按钮、字段增删、disabled 隐藏操作
  - 覆盖 AC：AC14-AC16, AC27

### R5: 前端 Bug 修复 ✅
- [x] **BUG-5**（MEDIUM）：修复 `toCamelCase()` 不处理 PascalCase 边界分割
  - 修改文件：`apps/web/src/utils/naming.ts`
  - 新增 `splitCaseBoundaries()` 辅助函数，在 `toCamelCase` 和 `toKebabCase` 前插入
  - `"EmployeeName"` → `"employeeName"` ✓ | `"myHTTPClient"` → `"myHttpClient"` ✓
  - 新增 4 个回归测试于 `utils/__tests__/naming.test.ts`

### 测试结果汇总

| 测试类型 | 文件 | 测试数 | 状态 |
|---------|------|--------|------|
| 后端单元测试 | `tests/unit/test_property_service.py` | 35 | ✅ 全部通过 |
| 后端集成测试 | `tests/integration/test_property_api.py` | 13 | ✅ 全部通过 |
| 前端组件测试 | `pages/object-types/__tests__/` 4 个新文件 | 30 | ✅ 全部通过 |
| 前端工具测试 | `utils/__tests__/naming.test.ts` | 14（含 4 个新增） | ✅ 全部通过 |
| **合计** | | **92** | ✅ |
