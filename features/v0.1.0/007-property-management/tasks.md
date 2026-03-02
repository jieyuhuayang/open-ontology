# Tasks: F007 Property Management（属性管理）

**关联 Plan**: `features/v0.1.0/007-property-management/plan.md`
**状态**: 已完成

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
