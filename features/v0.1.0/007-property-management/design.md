# Plan: F007 Property Management（属性管理）

**关联 Spec**: `features/v0.1.0/007-property-management/spec.md`
**状态**: 已审批

---

## Context

F007 是首个需要同时扩展后端 CRUD、Working State 集成和前端完整 UI 的全栈特性。它基于已就绪的数据库 Schema（F002）和 Working State 框架（F003），为对象类型的 Properties 标签页实现属性的创建、编辑、删除和拖拽排序功能。

**核心特殊性**：相较 ObjectType/LinkType CRUD，属性管理有三处额外复杂度：
1. 主键/标题键具有全局唯一约束，设置时需原子化更新多个资源
2. `sort_order` 列在现有 migration 中缺失，需补充迁移
3. Working State 的 `get_merged_view()` 和 `publish()` 目前不处理 PROPERTY 类型，需扩展

---

## 架构决策

### AD-1: 数据库补丁迁移（新增 sort_order + 审计列）

`properties` 表在 `0002_create_schema.py` 中未定义 `sort_order`、`created_at`、`created_by`、`last_modified_at`、`last_modified_by` 列（遗漏）。需新建迁移 `0003_add_property_sort_order.py`，添加：
- `sort_order`: `Integer, nullable=False, server_default="0"`
- `created_at`: `DateTime(timezone=True), nullable=False, server_default=func.now()`
- `created_by`: `String(255), nullable=False, server_default="system"`
- `last_modified_at`: `DateTime(timezone=True), nullable=False, server_default=func.now()`
- `last_modified_by`: `String(255), nullable=False, server_default="system"`

同时在 `storage/models.py` 中的 `PropertyModel` 补充这些字段。

### AD-2: Property ID 与 API Name 校验规则

| 字段 | 格式规则 | Pattern |
|------|---------|---------|
| `id` | 字母开头，含大小写字母/数字/短横线/下划线（spec AC4） | `^[a-zA-Z][a-zA-Z0-9_-]*$` |
| `apiName` | 小写字母开头，仅含字母数字，1-100 字符，NFKC（同 LinkType side） | `^[a-z][a-zA-Z0-9]{0,99}$` |

**实现**：在 `domain/validators.py` 新增 `validate_property_id()` 和 `validate_property_api_name()`，后者复用 `LINK_SIDE_API_NAME_PATTERN`，但使用 `PROPERTY_` 错误码前缀。

### AD-3: 主键/标题键设置通过 Property UPDATE 端点处理

不设独立的 PK/TK 端点，统一通过 `PUT /properties/{rid}` 传递 `isPrimaryKey` / `isTitleKey`。
PropertyService 检测到这两个字段变更时，**原子化生成多个 Working State 变更**：
1. 旧 PK/TK 属性的 UPDATE change（清除标记）
2. 目标属性的 UPDATE change（设置标记）
3. ObjectType 的 UPDATE change（更新 `primaryKeyPropertyId` / `titleKeyPropertyId`）

变更合并逻辑由 `WorkingStateService._collapse_change()` 自动处理。

### AD-4: 属性合并视图的 objectTypeRid 过滤

`WorkingStateService.get_merged_view()` 扩展支持 `ResourceType.PROPERTY`：
- 新增 PROPERTY 分支，调用 `PropertyStorage.list_by_ontology()`（跨所有 ObjectType）
- PropertyService 获得全量 merged view 后，按 `objectTypeRid` 在内存中过滤
- 无需修改 `get_merged_view()` 签名，MVP 数量级（单 Ontology < 1000 属性）可接受

同时在 `publish()` 中新增 PROPERTY 分支，调用 `_apply_property_change()`。

### AD-5: 属性排序通过批量端点更新

拖拽排序完成后，前端发送一次批量请求：
```
PUT /api/v1/object-types/{objectTypeRid}/properties/sort-order
Body: { "propertyOrders": [{"rid": "...", "sortOrder": 0}, ...] }
```
Service 对每个属性创建 UPDATE change（仅含 `sortOrder` 字段），change collapsing 自动合并同一属性的多次排序变更。

### AD-6: 复合类型（Array/Struct）在创建时锁定配置

- `baseType` 创建后**只读**；`arrayInnerType` 和 `structSchema` 同样创建后不可修改
- Service 在 UPDATE 请求中忽略这三个字段（如果包含则返回错误）
- Struct 字段名唯一性在 Service 层校验，后端不依赖 DB unique constraint

### AD-7: 前端拖拽使用 @dnd-kit

使用 `@dnd-kit/core` + `@dnd-kit/sortable`（React 18 兼容，轻量）实现 Table 行拖拽。
通过 React Context 将 `useSortable` 的 `listeners` 从 `SortableRow` 传递给 `DragHandleCell`，实现正确的 drag handle 交互，排序完成后调用 `useReorderProperties` mutation。

---

## API 端点设计

| Method | Path | 功能 | 请求体 | 响应 |
|--------|------|------|--------|------|
| `GET` | `/api/v1/object-types/{objectTypeRid}/properties` | 列出属性（合并视图） | — | `PropertyListResponse` |
| `POST` | `/api/v1/object-types/{objectTypeRid}/properties` | 创建属性 | `PropertyCreateRequest` | `PropertyWithChangeState` 201 |
| `PUT` | `/api/v1/object-types/{objectTypeRid}/properties/sort-order` | 批量更新排序 | `PropertySortOrderRequest` | 204 |
| `PUT` | `/api/v1/object-types/{objectTypeRid}/properties/{rid}` | 编辑属性 | `PropertyUpdateRequest` | `PropertyWithChangeState` |
| `DELETE` | `/api/v1/object-types/{objectTypeRid}/properties/{rid}` | 删除属性 | — | 204 |

**注**：`/sort-order` 在路由注册时必须在 `/{rid}` 之前，避免路径冲突。

---

## 数据结构设计（domain/property.py）

```python
class StructField(DomainModel):
    name: str
    type: str

class Property(DomainModel):
    rid: str
    id: str
    api_name: str
    object_type_rid: str
    display_name: str
    description: str | None = None
    base_type: str
    array_inner_type: str | None = None
    struct_schema: list[StructField] | None = None
    backing_column: str | None = None
    status: ResourceStatus = ResourceStatus.EXPERIMENTAL
    visibility: Visibility = Visibility.NORMAL
    is_primary_key: bool = False
    is_title_key: bool = False
    sort_order: int = 0
    created_at: datetime
    created_by: str
    last_modified_at: datetime
    last_modified_by: str

class PropertyWithChangeState(Property):
    change_state: ChangeState = ChangeState.PUBLISHED

class PropertyCreateRequest(DomainModel):
    id: str
    api_name: str
    display_name: str
    base_type: str
    array_inner_type: str | None = None
    struct_schema: list[StructField] | None = None
    backing_column: str | None = None
    description: str | None = None
    status: ResourceStatus = ResourceStatus.EXPERIMENTAL
    visibility: Visibility = Visibility.NORMAL

class PropertyUpdateRequest(DomainModel):
    display_name: str | None = None
    description: str | None = None
    api_name: str | None = None
    backing_column: str | None = None
    status: ResourceStatus | None = None
    visibility: Visibility | None = None
    is_primary_key: bool | None = None
    is_title_key: bool | None = None

class PropertySortOrderItem(DomainModel):
    rid: str
    sort_order: int

class PropertySortOrderRequest(DomainModel):
    property_orders: list[PropertySortOrderItem]

class PropertyListResponse(DomainModel):
    items: list[PropertyWithChangeState]
    total: int
```

---

## 错误码设计

| 错误码 | HTTP | 触发场景 |
|--------|------|---------|
| `PROPERTY_NOT_FOUND` | 404 | RID 不存在于合并视图 |
| `PROPERTY_INVALID_ID` | 400 | id 格式不合法 |
| `PROPERTY_INVALID_API_NAME` | 400 | apiName 格式不合法 |
| `PROPERTY_RESERVED_API_NAME` | 400 | apiName 为保留字 |
| `PROPERTY_ID_CONFLICT` | 409 | 同一 ObjectType 内 id 重复 |
| `PROPERTY_API_NAME_CONFLICT` | 409 | 同一 ObjectType 内 apiName 重复 |
| `PROPERTY_ACTIVE_CANNOT_DELETE` | 400 | 删除 active 状态属性 |
| `PROPERTY_ACTIVE_CANNOT_MODIFY_API_NAME` | 400 | active 状态修改 apiName |
| `PROPERTY_PRIMARY_KEY_CANNOT_DELETE` | 400 | 删除主键属性 |
| `PROPERTY_TYPE_INVALID_FOR_PRIMARY_KEY` | 400 | 该类型不可作主键 |
| `PROPERTY_TYPE_INVALID_FOR_TITLE_KEY` | 400 | 该类型不可作标题键 |
| `PROPERTY_ACTIVE_OBJECT_TYPE_CANNOT_CHANGE_PK` | 400 | ObjectType 为 active，不可更换主键 |
| `PROPERTY_LIMIT_EXCEEDED` | 400 | 超过 200 属性上限 |
| `PROPERTY_ARRAY_INNER_TYPE_REQUIRED` | 400 | Array 类型未提供 arrayInnerType |
| `PROPERTY_STRUCT_FIELD_NAME_CONFLICT` | 400 | Struct 字段名重复 |
| `PROPERTY_ARRAY_NESTED_NOT_ALLOWED` | 400 | Array inner type 不可为 array |
| `PROPERTY_STRUCT_FIELD_INVALID_TYPE` | 400 | Struct 字段使用了不允许的类型 |

---

## Storage 层接口（storage/property_storage.py）

```python
class PropertyStorage:
    @staticmethod
    async def list_by_ontology(session, ontology_rid: str) -> list[Property]
    @staticmethod
    async def list_by_object_type(session, object_type_rid: str) -> list[Property]
    @staticmethod
    async def get_by_rid(session, rid: str) -> Property | None
    @staticmethod
    async def create(session, model: Property) -> Property
    @staticmethod
    async def update(session, rid: str, data: dict) -> None
    @staticmethod
    async def delete(session, rid: str) -> None
    @staticmethod
    async def count_by_object_type(session, object_type_rid: str) -> int
```

---

## Service 层核心流程（services/property_service.py）

### CREATE
1. 验证 ObjectType 存在（从合并视图）
2. 验证 id 格式、apiName 格式
3. 唯一性检查（合并视图中同 ObjectType 下无重复）
4. 属性数量上限检查（合并视图中非 DELETED 计数 < 200）
5. baseType 特殊验证（array→inner type 必填，struct→schema 必填，字段名唯一性）
6. auto sort_order = 当前最大值 + 1
7. 生成 RID，构建 Property 域模型
8. 添加 CREATE change → WorkingStateService

### UPDATE
1. 从合并视图找到属性
2. active 状态约束检查（apiName 修改）
3. apiName 唯一性检查（排除自身）
4. backing_column 空字符串 → None 规范化
5. isPrimaryKey=true：验证类型合法、OT 非 active、清除旧 PK、更新 OT
6. isTitleKey=true：验证类型合法、清除旧 TK、更新 OT
7. 添加 UPDATE change

### DELETE
1. 找到属性（合并视图）
2. status=active → 拒绝
3. isPrimaryKey=true → 拒绝
4. 添加 DELETE change

### REORDER
1. 验证所有 RID 属于该 ObjectType 的合并视图
2. 对每个属性生成 UPDATE change（仅含 sortOrder）

---

## 主键/标题键有效类型

```python
PRIMARY_KEY_TYPES = frozenset({
    "string", "integer", "short", "date", "timestamp",
    "boolean", "byte", "long",
})

TITLE_KEY_TYPES = frozenset({
    "string", "integer", "short", "date", "timestamp",
    "boolean", "byte", "long", "float", "double", "decimal",
    "geopoint", "cipher", "array",
})
```

---

## Working State 扩展

### `get_merged_view()` 扩展
```python
elif resource_type == ResourceType.PROPERTY:
    published = await PropertyStorage.list_by_ontology(session, ontology_rid)
    published_map = {r.rid: r.model_dump(mode="json", by_alias=True) for r in published}
```

### `publish()` 扩展
```python
elif change.resource_type == ResourceType.PROPERTY:
    await self._apply_property_change(change)
```

### `_apply_property_change()` key_map
```python
key_map = {
    "displayName": "display_name", "description": "description",
    "apiName": "api_name", "backingColumn": "backing_column",
    "status": "status", "visibility": "visibility",
    "isPrimaryKey": "is_primary_key", "isTitleKey": "is_title_key",
    "sortOrder": "sort_order",
    "lastModifiedAt": "last_modified_at", "lastModifiedBy": "last_modified_by",
}
```

---

## 前端组件树

```
ObjectTypePropertiesPage（/object-types/:rid/properties）
├── useProperties(objectTypeRid)
├── useObjectType(rid)
├── 顶部操作栏
│   ├── FilterBar（status, visibility, baseType 下拉，本地过滤）
│   └── Button "Add Property"（disabled + tooltip if count >= 200）
├── PropertyTable（DnD 拖拽排序）
│   ├── Column: 拖拽手柄（DragHandleOutlined，Context 传递 listeners）
│   ├── Column: Display Name + ChangeStateBadge
│   ├── Column: ID / API Name / Base Type / Backing Column
│   ├── Column: Status（StatusBadge）/ Visibility
│   └── Column: PK / TK（Key icon）
├── CreatePropertyDrawer（宽 480px）
└── EditPropertyPanel（宽 480px）
    ├── 只读: ID, Base Type, RID
    ├── InlineEditText: Display Name / Description / API Name
    ├── Select: Status / Visibility
    ├── BackingColumnSection
    └── PK / TK 设置区
```

---

## 文件变更清单

### 后端（新建）
| 文件 | 用途 |
|------|------|
| `apps/server/alembic/versions/0003_add_property_sort_order.py` | 新增 sort_order + 审计列 |
| `apps/server/app/domain/property.py` | Property 域模型 + 枚举 + 请求/响应体 |
| `apps/server/app/storage/property_storage.py` | PropertyStorage（CRUD + 查询） |
| `apps/server/app/services/property_service.py` | PropertyService（业务逻辑） |
| `apps/server/app/routers/properties.py` | 5 个 HTTP 端点 |

### 后端（修改）
| 文件 | 改动 |
|------|------|
| `apps/server/app/storage/models.py` | PropertyModel 增加 5 个缺失列 |
| `apps/server/app/domain/validators.py` | 新增 `validate_property_id()`、`validate_property_api_name()` |
| `apps/server/app/services/working_state_service.py` | 扩展 PROPERTY 支持 |
| `apps/server/app/main.py` | 注册 properties router |

### 前端（新建）
| 文件 | 用途 |
|------|------|
| `apps/web/src/api/properties.ts` | 5 个 TanStack Query hooks |
| `apps/web/src/pages/object-types/ObjectTypePropertiesPage.tsx` | Properties 标签主页 |
| `apps/web/src/pages/object-types/components/PropertyTable.tsx` | 拖拽排序表格 |
| `apps/web/src/pages/object-types/components/CreatePropertyDrawer.tsx` | 创建抽屉 |
| `apps/web/src/pages/object-types/components/EditPropertyPanel.tsx` | 编辑面板 |
| `apps/web/src/pages/object-types/components/PropertyTypeSelector.tsx` | 类型选择器 |
| `apps/web/src/pages/object-types/components/StructFieldEditor.tsx` | Struct 字段编辑器 |
| `apps/web/src/pages/object-types/components/BackingColumnSection.tsx` | 底层列映射区 |

### 前端（修改）
| 文件 | 改动 |
|------|------|
| `apps/web/package.json` | 添加 `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` |
| `apps/web/src/router.tsx` | 替换 Properties 标签的占位符路由 |
| `apps/web/src/locales/en-US/common.json` | 添加 `property` 命名空间 |
| `apps/web/src/locales/zh-CN/common.json` | 添加 `property` 命名空间（中文） |
| `apps/web/src/generated/api.ts` | 手动补充 Property 相关 Schema |
| `apps/web/src/api/types.ts` | 导出 Property 相关类型 |
