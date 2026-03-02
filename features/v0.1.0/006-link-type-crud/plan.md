# Plan: Link Type CRUD（链接类型增删改查）

**关联 Spec**: `features/v0.1.0/006-link-type-crud/spec.md`
**架构参考**: `docs/architecture/02-domain-model.md` §6 LinkType, `docs/specs/link-type-metadata.md`

---

## Context

F003（Object Type CRUD）已实现完整的后端 CRUD + WorkingState 草稿机制。F006 在此基础上为 LinkType 提供全栈 CRUD 能力。`WorkingStateService` 已设计为资源类型无关（`ResourceType.LINK_TYPE` 枚举已存在），可直接复用。

**已就绪的依赖**:
- F002: `link_types` + `link_type_endpoints` 表 + ORM 模型已创建（`apps/server/app/storage/models.py:237-305`）
- F003: WorkingStateService、ObjectTypeService（级联删除已生成 LinkType DELETE 变更）
- F004: AppShell（导航已有 Link Types 入口、CreateMenu 已有菜单项）
- F005: Object Type CRUD Frontend（前端列表/详情/创建/删除模式可参照）

---

## 架构决策

### AD-1: LinkType 在 WorkingState 中以扁平化嵌套 JSON 存储

LinkType 包含子结构 `sideA` / `sideB`（对应 `link_type_endpoints` 子表）。在 `Change.after` 中存储为嵌套 JSON：

```json
{
  "rid": "ri.ontology.link-type.xxx",
  "id": "employee-employer",
  "cardinality": "one-to-many",
  "joinMethod": "foreign-key",
  "status": "experimental",
  "sideA": { "objectTypeRid": "...", "displayName": "...", "apiName": "...", "visibility": "normal" },
  "sideB": { "objectTypeRid": "...", "displayName": "...", "apiName": "...", "visibility": "normal" },
  "projectRid": "...", "ontologyRid": "...",
  "createdAt": "...", "createdBy": "...", "lastModifiedAt": "...", "lastModifiedBy": "..."
}
```

WorkingStateService 合并视图算法无需修改（仍以 dict 操作），发布时由 `_apply_link_type_change()` 拆解为两张表的写入。

### AD-2: API Name 格式为 camelCase

Spec AC6: "小写字母开头，仅含字母和数字，1-100 字符"。正则: `^[a-z][a-zA-Z0-9]{0,99}$`。区别于 ObjectType 的 PascalCase。

### AD-3: API Name 唯一性范围 = 对应 ObjectType 的所有链接端

Spec AC7: 一端 apiName 在其关联 ObjectType 的所有链接类型端中唯一。需同时检查已发布数据和草稿 CREATE。

### AD-4: 详情视图使用 Drawer 侧边面板

Spec 明确"无独立链接类型详情页面"。使用 Ant Design `Drawer` 在 `LinkTypeListPage` 中展示。URL search param `?selected={rid}` 控制 Drawer 状态。移除已有的 `LinkTypeDetailLayout` + 子路由。

### AD-5: 创建流程使用 Modal + Steps（3 步向导）

Ant Design `Modal` + `Steps`，不跳转页面：
- Step 1: 选择基数（3 张卡片，many-to-many 置灰）
- Step 2: 选择两端 ObjectType（searchable Select，自链接即时报错）
- Step 3: 名称定义（ID / Display Name / API Name / Status / Visibility）

`CreateMenu` 改为打开 Modal（不再导航到 `/link-types/new`）。

### AD-6: 后端响应附带 ObjectType displayName

在 `LinkSide` 中增加 `objectTypeDisplayName` 可选字段，Service 层在 list/get 时从 ObjectType 合并视图填充。前端无需额外请求。

---

## 数据结构设计

### Pydantic Schema（`app/domain/link_type.py`）

```python
class Cardinality(str, Enum):
    ONE_TO_ONE = "one-to-one"
    ONE_TO_MANY = "one-to-many"
    MANY_TO_ONE = "many-to-one"

class JoinMethod(str, Enum):
    FOREIGN_KEY = "foreign-key"  # MVP 唯一值

class LinkSide(DomainModel):
    object_type_rid: str
    display_name: str
    api_name: str
    visibility: Visibility = Visibility.NORMAL
    object_type_display_name: str | None = None  # Service 层填充

class LinkType(DomainModel):
    rid: str
    id: str
    side_a: LinkSide
    side_b: LinkSide
    cardinality: Cardinality
    join_method: JoinMethod = JoinMethod.FOREIGN_KEY
    status: ResourceStatus = ResourceStatus.EXPERIMENTAL
    project_rid: str
    ontology_rid: str
    created_at: datetime
    created_by: str
    last_modified_at: datetime
    last_modified_by: str

class LinkTypeWithChangeState(LinkType):
    change_state: ChangeState = ChangeState.PUBLISHED

class LinkSideCreateInput(DomainModel):
    object_type_rid: str
    display_name: str
    api_name: str
    visibility: Visibility = Visibility.NORMAL

class LinkTypeCreateRequest(DomainModel):
    id: str
    side_a: LinkSideCreateInput
    side_b: LinkSideCreateInput
    cardinality: Cardinality
    status: ResourceStatus = ResourceStatus.EXPERIMENTAL
    # joinMethod 不暴露，后端固定 foreign-key

class LinkSideUpdateInput(DomainModel):
    display_name: str | None = None
    visibility: Visibility | None = None
    # objectTypeRid 和 apiName 创建后不可变

class LinkTypeUpdateRequest(DomainModel):
    side_a: LinkSideUpdateInput | None = None
    side_b: LinkSideUpdateInput | None = None
    cardinality: Cardinality | None = None
    status: ResourceStatus | None = None

class LinkTypeListResponse(DomainModel):
    items: list[LinkTypeWithChangeState]
    total: int
    page: int
    page_size: int
```

### TypeScript 类型（`src/api/types.ts` 导出）

```typescript
export type LinkSide = components['schemas']['LinkSide'];
export type LinkType = components['schemas']['LinkTypeWithChangeState'];
export type LinkTypeCreateRequest = components['schemas']['LinkTypeCreateRequest'];
export type LinkTypeUpdateRequest = components['schemas']['LinkTypeUpdateRequest'];
export type LinkTypeListResponse = components['schemas']['LinkTypeListResponse'];
export type Cardinality = components['schemas']['Cardinality'];
```

### 校验器扩展（`app/domain/validators.py`）

```python
LINK_SIDE_API_NAME_PATTERN = re.compile(r"^[a-z][a-zA-Z0-9]{0,99}$")

def validate_link_type_id(id_value: str) -> None:
    """复用 ID_PATTERN: ^[a-z][a-z0-9-]*$"""

def validate_link_side_api_name(api_name: str, side: str) -> None:
    """NFKC 检查 → 格式匹配 → 保留字检查"""
```

---

## API 端点设计

### LinkType CRUD

| Method | Path | 描述 | 请求体 | 响应 | 状态码 |
|--------|------|------|--------|------|--------|
| GET | `/api/v1/link-types` | 列表查询（合并视图，分页+过滤） | query: `page`, `pageSize`, `objectTypeRid?`, `status?`, `visibility?` | `LinkTypeListResponse` | 200 |
| POST | `/api/v1/link-types` | 创建链接类型（写入草稿） | `LinkTypeCreateRequest` | `LinkTypeWithChangeState` | 201 |
| GET | `/api/v1/link-types/{rid}` | 详情查询（合并视图） | — | `LinkTypeWithChangeState` | 200 |
| PUT | `/api/v1/link-types/{rid}` | 更新链接类型（写入草稿） | `LinkTypeUpdateRequest` | `LinkTypeWithChangeState` | 200 |
| DELETE | `/api/v1/link-types/{rid}` | 删除链接类型（写入草稿） | — | — | 204 |

### 请求/响应示例

```json
// POST /api/v1/link-types
// Request
{
  "id": "employee-company",
  "sideA": {
    "objectTypeRid": "ri.ontology.object-type.xxx",
    "displayName": "Company",
    "apiName": "company"
  },
  "sideB": {
    "objectTypeRid": "ri.ontology.object-type.yyy",
    "displayName": "Employee",
    "apiName": "employee"
  },
  "cardinality": "many-to-one"
}

// Response 201
{
  "rid": "ri.ontology.link-type.zzz",
  "id": "employee-company",
  "sideA": {
    "objectTypeRid": "ri.ontology.object-type.xxx",
    "displayName": "Company",
    "apiName": "company",
    "visibility": "normal",
    "objectTypeDisplayName": "Employee"
  },
  "sideB": {
    "objectTypeRid": "ri.ontology.object-type.yyy",
    "displayName": "Employee",
    "apiName": "employee",
    "visibility": "normal",
    "objectTypeDisplayName": "Company"
  },
  "cardinality": "many-to-one",
  "joinMethod": "foreign-key",
  "status": "experimental",
  "changeState": "created",
  "projectRid": "ri.ontology.space.default",
  "ontologyRid": "ri.ontology.ontology.default",
  "createdAt": "2026-03-01T00:00:00Z",
  "createdBy": "default",
  "lastModifiedAt": "2026-03-01T00:00:00Z",
  "lastModifiedBy": "default"
}
```

### 错误码

| HTTP | Code | 触发场景 |
|------|------|----------|
| 400 | `LINK_TYPE_INVALID_ID` | id 格式不符合 `^[a-z][a-z0-9-]*$` |
| 400 | `LINK_TYPE_INVALID_API_NAME` | apiName 非 camelCase |
| 400 | `LINK_TYPE_RESERVED_API_NAME` | apiName 为保留关键字 |
| 400 | `LINK_TYPE_API_NAME_NOT_NFKC` | apiName 未 NFKC 规范化 |
| 400 | `LINK_TYPE_SELF_LINK_NOT_ALLOWED` | 两端为同一 ObjectType |
| 400 | `LINK_TYPE_ACTIVE_CANNOT_DELETE` | 删除 active 状态的 LinkType |
| 404 | `LINK_TYPE_OBJECT_TYPE_NOT_FOUND` | 引用的 OT 不存在或已删除 |
| 404 | `LINK_TYPE_NOT_FOUND` | 指定 RID 不存在 |
| 409 | `LINK_TYPE_ID_CONFLICT` | id 在本体内重复 |
| 409 | `LINK_TYPE_API_NAME_CONFLICT` | apiName 在对应 OT 下重复 |

---

## Storage 层设计

### LinkTypeStorage（`app/storage/link_type_storage.py`）

| 方法 | 说明 |
|------|------|
| `list_by_ontology(session, ontology_rid)` | 查询已发布 LinkTypes（`selectinload` endpoints），返回 `list[LinkType]` |
| `get_by_rid(session, rid)` | 按 RID 查询 |
| `get_by_id(session, ontology_rid, id)` | 按 ID 查询（唯一性校验） |
| `get_api_names_for_object_type(session, ot_rid)` | 查 `link_type_endpoints` 表，返回 `list[tuple[str, str]]`（link_type_rid, api_name） |
| `create(session, model)` | 插入 `link_types` + 2 条 `link_type_endpoints`（发布时） |
| `update(session, rid, data)` | 更新主表 + endpoints（发布时） |
| `delete(session, rid)` | 删除（CASCADE 删 endpoints）（发布时） |

`_to_domain()`: 将 ORM `LinkTypeModel` + 两条 `LinkTypeEndpointModel` 转为 `LinkType`，按 `endpoint.side` 字段区分 A/B。

---

## Service 层设计

### LinkTypeService（`app/services/link_type_service.py`）

| 方法 | 说明 |
|------|------|
| `create(req)` | 校验 id/apiName → 自链接检查 → OT 存在性 → 唯一性检查 → 生成 rid → add_change(CREATE) |
| `list(page, page_size, filters?)` | get_merged_view(LINK_TYPE) → 过滤（objectTypeRid/status/visibility）→ 分页 → 填充 OT displayName |
| `get_by_rid(rid)` | 从合并视图查找 → 404 if not found → 填充 OT displayName |
| `update(rid, req)` | 查找 → 构建 before/after → add_change(UPDATE) |
| `delete(rid)` | active 不可删 → add_change(DELETE) |

辅助方法：
- `_get_ot_display_name_map()` — 从 OT 合并视图建立 rid→displayName 映射
- `_fill_ot_display_names()` — 为 LinkType 响应填充 OT 展示名
- `_check_id_uniqueness()` — 已发布 + 草稿 CREATE 双重检查
- `_check_api_name_uniqueness()` — 已发布端点 + 草稿 CREATE 中的端点双重检查
- `_validate_object_type_exists()` — OT 合并视图中存在且未被删除

### WorkingStateService 扩展

3 处修改：
1. `get_merged_view()`: 添加 `LINK_TYPE` 分支，调用 `LinkTypeStorage.list_by_ontology()`
2. `publish()`: 添加 `LINK_TYPE` 分支，调用 `_apply_link_type_change()`
3. 新增 `_apply_link_type_change()`: CREATE → `LinkTypeStorage.create()`, UPDATE → `.update()`, DELETE → `.delete()`

---

## 前端组件设计

### 页面结构

```
LinkTypeListPage
├── Header (Title + "New link type" Button)
├── Filters (ObjectType Select + Status MultiSelect + Visibility MultiSelect)
├── LinkTypeTable                        # Props-driven 表格
│   └── Columns: ID | Side A | Side B | Cardinality | Status | ChangeState
├── LinkTypeDetailDrawer                 # 右侧抽屉面板
│   ├── Header (ID + StatusBadge + ChangeStateBadge + Dropdown Menu)
│   ├── Basic Info (ID, RID, Cardinality, Status — 后两者可编辑)
│   ├── Side A Section (OT name, Display Name, API Name, Visibility)
│   ├── Side B Section (同上)
│   └── Audit Info (createdAt/By, lastModifiedAt/By)
└── CreateLinkTypeWizard                 # Modal + Steps 创建向导
    ├── Step 1: Cardinality (3 Card 选项)
    ├── Step 2: ObjectType Selection (2 × searchable Select)
    └── Step 3: Names & Settings (Form)
```

### API Hooks（`src/api/link-types.ts`）

```typescript
const linkTypeKeys = {
  all: ['link-types'],
  lists: () => [...linkTypeKeys.all, 'list'],
  list: (params) => [...linkTypeKeys.lists(), params],
  details: () => [...linkTypeKeys.all, 'detail'],
  detail: (rid) => [...linkTypeKeys.details(), rid],
};

useLinkTypes(page, pageSize, filters?)  // 列表查询
useLinkType(rid)                        // 单条查询
useCreateLinkType()                     // 创建
useUpdateLinkType(rid)                  // 更新
useDeleteLinkType()                     // 删除
```

### Zustand Store（`src/stores/create-link-type-modal-store.ts`）

```typescript
interface CreateLinkTypeModalStore {
  isOpen: boolean;
  prefilledSideA?: string;  // objectTypeRid，从 OT 详情页进入时预填
  open: (prefilledSideA?: string) => void;
  close: () => void;
}
```

### 路由变更

- 移除 `link-types/new` 路由（创建改为 Modal）
- 移除 `link-types/:rid` 及子路由（详情改为 Drawer）
- 删除 `LinkTypeDetailLayout.tsx`

### OT Overview 页集成

- 将 LinkTypes `PlaceholderCard` 替换为关联 LinkType 列表
- `useLinkTypes(1, 100, { objectTypeRid: rid })` 查询
- "New link type" 按钮 → `open(rid)` 预填 Side A

### OT 删除级联提示

- `DeleteObjectTypeModal` 中查询关联 LinkType 数量
- 确认弹窗显示"将同时删除 N 条关联链接类型"（AC20）

---

## 测试策略

| 测试类型 | 范围 | 工具 |
|---------|------|------|
| 单元测试 | 校验器（ID 格式、apiName 格式/NFKC/保留字） | pytest |
| 集成测试 | LinkType CRUD API 全流程 + 唯一性冲突 + 发布 | pytest + httpx |
| 组件测试 | 列表页渲染、Wizard 3 步流程、Drawer 展示 | Vitest + Testing Library |

---

## 文件变更清单

### 新建文件（12 个）

| 文件路径 | 说明 |
|----------|------|
| `apps/server/app/domain/link_type.py` | 领域模型 + 请求/响应 Schema |
| `apps/server/app/storage/link_type_storage.py` | 数据访问层 |
| `apps/server/app/services/link_type_service.py` | 业务逻辑 |
| `apps/server/app/routers/link_types.py` | REST 端点 |
| `apps/server/tests/unit/test_link_type_validators.py` | 校验器单元测试 |
| `apps/server/tests/integration/test_link_type_api.py` | CRUD API 集成测试 |
| `apps/web/src/api/link-types.ts` | TanStack Query hooks |
| `apps/web/src/stores/create-link-type-modal-store.ts` | Wizard modal 状态 |
| `apps/web/src/pages/link-types/components/CreateLinkTypeWizard.tsx` | 3 步创建向导 |
| `apps/web/src/pages/link-types/components/LinkTypeTable.tsx` | 列表表格 |
| `apps/web/src/pages/link-types/components/LinkTypeDetailDrawer.tsx` | 详情侧边面板 |
| `apps/web/src/pages/link-types/components/DeleteLinkTypeModal.tsx` | 删除确认弹窗 |

### 修改文件（12 个）

| 文件路径 | 修改内容 |
|----------|----------|
| `apps/server/app/domain/validators.py` | +2 验证函数（`validate_link_type_id`, `validate_link_side_api_name`） |
| `apps/server/app/services/working_state_service.py` | +LINK_TYPE 分支（merged view + publish + _apply_link_type_change） |
| `apps/server/app/main.py` | +注册 link_types router |
| `apps/web/src/generated/api.ts` | +LinkType 相关 OpenAPI 类型定义 |
| `apps/web/src/api/types.ts` | +LinkType 类型导出 |
| `apps/web/src/pages/link-types/LinkTypeListPage.tsx` | 从 Placeholder 重写为完整列表页 |
| `apps/web/src/router.tsx` | 移除 link-types/new 和 link-types/:rid 路由 |
| `apps/web/src/components/layout/CreateMenu.tsx` | 改为打开 Modal |
| `apps/web/src/pages/object-types/ObjectTypeOverviewPage.tsx` | LinkTypes PlaceholderCard → 关联列表 |
| `apps/web/src/pages/object-types/components/DeleteObjectTypeModal.tsx` | +级联删除警告 |
| `apps/web/src/locales/en-US/common.json` | +linkType i18n namespace |
| `apps/web/src/locales/zh-CN/common.json` | +linkType i18n namespace（中文） |

### 删除文件（2 个）

| 文件路径 | 原因 |
|----------|------|
| `apps/web/src/pages/link-types/LinkTypeDetailLayout.tsx` | 改用 Drawer，不再需要 |
| `apps/web/src/pages/link-types/__tests__/LinkTypeDetailLayout.test.tsx` | 对应组件已删除 |

---

## 验证方式

| AC | 验证方法 |
|----|----------|
| AC1 | 前端测试：CreateMenu → 打开 Modal；列表页按钮 → 打开 Modal；OT Overview → 打开 Modal（预填 Side A） |
| AC2 | 前端测试：Wizard Step 1 显示 3 个基数选项卡 |
| AC3 | 前端测试：Wizard Step 2 显示两个 Select + 自链接报错 |
| AC4 | 前端测试：Wizard Step 3 表单字段 + 自动生成 |
| AC5 | 单元测试：`validate_link_type_id()` 正则校验 |
| AC6 | 单元测试：`validate_link_side_api_name()` camelCase + NFKC + 保留字 |
| AC7 | 集成测试：POST 重复 apiName → 409 |
| AC8 | 集成测试：缺少必填字段 → 422 |
| AC9 | 前端测试：列表页渲染表格列 |
| AC10 | 集成测试：GET list with objectTypeRid filter |
| AC11 | 集成测试：GET list with pagination |
| AC12 | 前端测试：行点击 → Drawer 展示详情；集成测试：GET detail 返回完整字段 + OT displayName |
| AC13 | 前端测试：Drawer 中 displayName/visibility/cardinality/status 可编辑 |
| AC14 | 前端测试：Drawer 中 OT/apiName/ID 只读 |
| AC17 | 前端测试：DeleteLinkTypeModal 展示确认信息 |
| AC18 | 集成测试：DELETE active → 400；前端：active 时 disabled |
| AC20 | 前端测试：DeleteObjectTypeModal 显示级联警告 |
| AC21 | 集成测试：POST 写入草稿，主表无记录 |
| AC22 | 集成测试：创建后 GET 列表包含 created 资源 |
| AC23 | 集成测试：验证 changeState 标注 |
| AC24 | 集成测试：POST publish → 主表写入 link_types + link_type_endpoints |
