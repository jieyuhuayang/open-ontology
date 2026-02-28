# Plan: Object Type CRUD（对象类型增删改查）

**关联 Spec**: `features/v0.1.0/003-object-type-crud/spec.md`
**架构参考**: `docs/architecture/02-domain-model.md`, `docs/specs/object-type-metadata.md`

---

## Context

MVP 需要对象类型（ObjectType）的完整 CRUD 后端能力。所有写操作通过 WorkingState 草稿机制（F009）写入，查询返回已发布 + 草稿的合并视图。F009 尚无 plan/tasks，本方案将 F009 核心逻辑作为 Phase 1 一并实现，避免 stub 浪费。

**已就绪**: F002 数据库表结构（8 张表 + ORM 模型 + 种子数据）、FastAPI 脚手架（错误处理、session 管理、RID 生成）。

---

## 架构决策

### AD-1: F009 与 F003a 合并实施

WorkingStateService 作为 F003a 的前置 Phase 实现。实施顺序：
1. Domain 模型（Change、WorkingState、ObjectType Pydantic 模型）
2. Storage 层（working_state_storage、object_type_storage、ontology_storage）
3. WorkingStateService（变更写入、合并视图、发布/丢弃）
4. ObjectTypeService（CRUD 业务逻辑，调用 WorkingStateService）
5. Router 层 + 注册

### AD-2: 合并视图在应用层实现

MVP 数据量 < 10,000 条，Python 层合并足够（< 200ms）。逻辑：
1. 查询 `object_types` 主表获取已发布资源
2. 从 `working_states.changes` 中过滤对应 `resourceType` 的变更
3. 应用 CREATE（添加新资源）、UPDATE（覆盖字段）、DELETE（标记排除）
4. 为每个资源标注 `changeState`: `published` | `created` | `modified` | `deleted`

### AD-3: 变更合并（Change Collapsing）

在 `add_change()` 中对同一 `resourceRid` 的变更进行合并：
- CREATE + UPDATE → 合并为 CREATE（更新 after）
- CREATE + DELETE → 抵消移除
- UPDATE + UPDATE → 保留最早 before + 最新 after
- UPDATE + DELETE → 变为 DELETE（保留原始 before）

### AD-4: 级联删除策略

删除 ObjectType 时，在草稿中为关联资源分别生成 DELETE 变更：
1. 查询该 ObjectType 下的所有 Properties → 为每个 Property 生成 DELETE 变更
2. 查询引用该 ObjectType 的 LinkTypes（通过 link_type_endpoints 表）→ 为每个 LinkType 生成 DELETE 变更
3. 为 ObjectType 自身生成 DELETE 变更

发布时按顺序执行：先删 LinkType（解除 `link_type_endpoints` 的 RESTRICT FK 约束）→ 再删 ObjectType（CASCADE 删除 Properties）。

### AD-5: MVP 默认值

单用户模型，以下值作为常量：
- `user_id = "default"`
- `ontology_rid = "ri.ontology.ontology.default"`
- `project_rid = "ri.ontology.space.default"`

### AD-6: 唯一性校验范围

`id` 和 `api_name` 的唯一性需同时检查：
1. `object_types` 主表（已发布资源）
2. `working_states.changes` 中的 CREATE 变更（未发布的草稿资源）

排除已被 DELETE 标记的资源。

### AD-7: 保留关键字比较

Spec 中保留字为小写形式（`ontology`, `object`, `property`, `link`, `relation`, `rid`, `primaryKey`, `typeId`, `ontologyObject`）。校验时将 apiName 转小写后与保留字列表比较。

---

## API 端点设计

### ObjectType CRUD

| Method | Path | 描述 | 请求体 | 响应 | 状态码 |
|--------|------|------|--------|------|--------|
| GET | `/api/v1/object-types` | 列表查询（合并视图，分页） | query: `page`, `pageSize` | `ObjectTypeListResponse` | 200 |
| POST | `/api/v1/object-types` | 创建对象类型（写入草稿） | `ObjectTypeCreateRequest` | `ObjectTypeWithChangeState` | 201 |
| GET | `/api/v1/object-types/{rid}` | 详情查询（合并视图） | — | `ObjectTypeDetailResponse` | 200 |
| PUT | `/api/v1/object-types/{rid}` | 更新对象类型（写入草稿） | `ObjectTypeUpdateRequest` | `ObjectTypeWithChangeState` | 200 |
| DELETE | `/api/v1/object-types/{rid}` | 删除对象类型（写入草稿） | — | — | 204 |

### 变更管理（F009 AC18-AC20）

| Method | Path | 描述 | 响应 | 状态码 |
|--------|------|------|------|--------|
| POST | `/api/v1/ontologies/{rid}/save` | 发布所有草稿变更 | `ChangeRecord` | 200 |
| DELETE | `/api/v1/ontologies/{rid}/working-state` | 丢弃草稿 | — | 204 |
| GET | `/api/v1/ontologies/{rid}/working-state` | 查看当前草稿状态 | `WorkingState` | 200/404 |

---

## 数据结构设计

### 通用变更管理模型（`app/domain/working_state.py`）

```python
class ChangeType(str, enum.Enum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"

class ResourceType(str, enum.Enum):
    OBJECT_TYPE = "ObjectType"
    PROPERTY = "Property"
    LINK_TYPE = "LinkType"

class ChangeState(str, enum.Enum):
    """合并视图中资源的变更状态标注"""
    PUBLISHED = "published"
    CREATED = "created"
    MODIFIED = "modified"
    DELETED = "deleted"

class Change(DomainModel):
    id: str
    resource_type: ResourceType
    resource_rid: str
    change_type: ChangeType
    before: dict | None = None   # CREATE 时为 None
    after: dict | None = None    # DELETE 时为 None
    timestamp: datetime

class WorkingState(DomainModel):
    rid: str
    user_id: str
    ontology_rid: str
    changes: list[Change] = Field(default_factory=list)
    base_version: int
    created_at: datetime
    last_modified_at: datetime

class ChangeRecord(DomainModel):
    rid: str
    ontology_rid: str
    version: int
    changes: list[Change]
    saved_at: datetime
    saved_by: str
    description: str | None = None
```

### ObjectType 模型（`app/domain/object_type.py`）

```python
class ResourceStatus(str, enum.Enum):
    ACTIVE = "active"
    EXPERIMENTAL = "experimental"
    DEPRECATED = "deprecated"

class Visibility(str, enum.Enum):
    PROMINENT = "prominent"
    NORMAL = "normal"
    HIDDEN = "hidden"

class Icon(DomainModel):
    name: str
    color: str

class ObjectType(DomainModel):
    rid: str
    id: str
    api_name: str
    display_name: str
    plural_display_name: str | None = None
    description: str | None = None
    icon: Icon
    status: ResourceStatus = ResourceStatus.EXPERIMENTAL
    visibility: Visibility = Visibility.NORMAL
    backing_datasource: dict | None = None
    primary_key_property_id: str | None = None
    title_key_property_id: str | None = None
    project_rid: str
    ontology_rid: str
    created_at: datetime
    created_by: str
    last_modified_at: datetime
    last_modified_by: str

class ObjectTypeWithChangeState(ObjectType):
    """合并视图返回的 ObjectType，附带变更状态"""
    change_state: ChangeState = ChangeState.PUBLISHED
```

### 请求/响应 Schema

```python
class ObjectTypeCreateRequest(DomainModel):
    id: str
    api_name: str
    display_name: str
    plural_display_name: str | None = None
    description: str | None = None
    icon: Icon

class ObjectTypeUpdateRequest(DomainModel):
    display_name: str | None = None
    plural_display_name: str | None = None
    description: str | None = None
    icon: Icon | None = None
    status: ResourceStatus | None = None
    visibility: Visibility | None = None
    api_name: str | None = None  # 仅 non-active 状态可改

class ObjectTypeListResponse(DomainModel):
    items: list[ObjectTypeWithChangeState]
    total: int
    page: int
    page_size: int
```

### 校验器（`app/domain/validators.py`）

```python
PASCAL_CASE_PATTERN = re.compile(r"^[A-Z][a-zA-Z0-9_]*$")
ID_PATTERN = re.compile(r"^[a-z][a-z0-9-]*$")

RESERVED_API_NAMES = frozenset({
    "ontology", "object", "property", "link", "relation",
    "rid", "primarykey", "typeid", "ontologyobject",
})

def validate_api_name(api_name: str) -> None:
    """PascalCase 格式 + 保留字检查（小写比较）"""

def validate_object_type_id(id_value: str) -> None:
    """小写字母开头，仅含小写字母、数字、连字符"""
```

### 常量（`app/domain/constants.py`）

```python
DEFAULT_USER_ID = "default"
DEFAULT_ONTOLOGY_RID = "ri.ontology.ontology.default"
DEFAULT_PROJECT_RID = "ri.ontology.space.default"
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
```

---

## Storage 层设计

### WorkingStateStorage（`app/storage/working_state_storage.py`）

| 方法 | 说明 |
|------|------|
| `get_by_ontology(ontology_rid, user_id)` | 查询指定 ontology + user 的 WorkingState |
| `create(model)` | 创建新 WorkingState |
| `update_changes(rid, changes, last_modified_at)` | 更新 changes JSONB |
| `delete(rid)` | 删除 WorkingState |

### ObjectTypeStorage（`app/storage/object_type_storage.py`）

| 方法 | 说明 |
|------|------|
| `list_by_ontology(ontology_rid, page, page_size)` | 分页查询已发布 ObjectTypes，返回 (list, total) |
| `get_by_rid(rid)` | 按 RID 查询 |
| `get_by_id(ontology_rid, id)` | 按用户 ID 查询（唯一性校验） |
| `get_by_api_name(ontology_rid, api_name)` | 按 API name 查询（唯一性校验） |
| `create(model)` | 插入主表（发布时调用） |
| `update(rid, data)` | 更新主表（发布时调用） |
| `delete(rid)` | 删除主表记录（发布时调用，CASCADE 删 properties） |
| `get_related_link_type_rids(object_type_rid)` | 查询引用该 ObjectType 的 LinkType RIDs |
| `_to_dict(model)` / `_to_domain(model)` | ORM ↔ Domain 转换辅助方法 |

### OntologyStorage（`app/storage/ontology_storage.py`）

| 方法 | 说明 |
|------|------|
| `get_by_rid(rid)` | 查询 Ontology |
| `increment_version(rid)` | 原子递增 version 并返回新版本号 |

---

## Service 层设计

### WorkingStateService（`app/services/working_state_service.py`）

核心职责：管理 WorkingState 生命周期，提供变更写入和合并视图查询。

| 方法 | 说明 |
|------|------|
| `get_or_create(ontology_rid)` | 获取现有 WS，若不存在则自动创建（base_version = ontology.version） |
| `add_change(ontology_rid, change)` | 追加变更 + 执行变更合并（AD-3） |
| `get_merged_view(ontology_rid, resource_type)` | 返回 list[tuple[dict, ChangeState]]，资源类型无关 |
| `publish(ontology_rid)` | 原子事务：应用变更 → 创建 ChangeRecord → 递增 version → 删除 WS |
| `discard(ontology_rid)` | 删除 WorkingState |

**`get_merged_view` 设计**: 返回通用的 `list[tuple[dict, ChangeState]]`。调用方（ObjectTypeService 等）负责将 dict 转换为具体 domain 模型。这样 WorkingStateService 保持资源类型无关，可被 F004（LinkType）、F005（Property）复用。

### ObjectTypeService（`app/services/object_type_service.py`）

| 方法 | 说明 |
|------|------|
| `create(req)` | 校验 id/apiName → 唯一性检查 → 生成 rid → add_change(CREATE) |
| `list(page, page_size)` | get_merged_view → 分页 → 返回 ObjectTypeListResponse |
| `get_by_rid(rid)` | 从合并视图查找 → 404 if not found |
| `update(rid, req)` | 校验 active 限制 → 校验 apiName → add_change(UPDATE) |
| `delete(rid)` | 校验 active 不可删 → 级联生成子资源 DELETE → add_change(DELETE) |
| `_check_uniqueness(ontology_rid, id, api_name, exclude_rid?)` | 主表 + 草稿 CREATE 双重检查 |

---

## Router 层设计

### ObjectType Router（`app/routers/object_types.py`）

遵循 `health.py` 的模式：`APIRouter(prefix="/api/v1", tags=["object-types"])`。

通过 `Depends` 注入 `ObjectTypeService`：

```python
def get_service(session: AsyncSession = Depends(get_db_session)) -> ObjectTypeService:
    return ObjectTypeService(session)
```

Router 层仅做 HTTP 解析 + 委托，不含业务逻辑。Query 参数 `pageSize` 使用 `alias="pageSize"` 映射到 snake_case。

### Ontology Router（`app/routers/ontology.py`）

变更管理端点，注入 `WorkingStateService`。

---

## 错误码

| HTTP | Code | 触发场景 |
|------|------|----------|
| 400 | `OBJECT_TYPE_INVALID_ID` | id 格式不符合 `^[a-z][a-z0-9-]*$` |
| 400 | `OBJECT_TYPE_INVALID_API_NAME` | apiName 非 PascalCase |
| 400 | `OBJECT_TYPE_RESERVED_API_NAME` | apiName 为保留关键字 |
| 400 | `OBJECT_TYPE_ACTIVE_CANNOT_MODIFY_API_NAME` | active 状态下修改 apiName |
| 400 | `OBJECT_TYPE_ACTIVE_CANNOT_DELETE` | 删除 active 状态的 ObjectType |
| 404 | `OBJECT_TYPE_NOT_FOUND` | 指定 RID 不存在 |
| 409 | `OBJECT_TYPE_ID_CONFLICT` | id 在本体内重复 |
| 409 | `OBJECT_TYPE_API_NAME_CONFLICT` | apiName 在本体内重复 |
| 400 | `WORKING_STATE_EMPTY` | 发布空的 WorkingState |
| 404 | `WORKING_STATE_NOT_FOUND` | 无活跃的 WorkingState |

---

## 文件变更清单

### 新建文件（16 个）

| 文件路径 | 说明 |
|----------|------|
| `apps/server/app/domain/constants.py` | 默认值常量 |
| `apps/server/app/domain/validators.py` | apiName/id 格式校验 + 保留字 |
| `apps/server/app/domain/working_state.py` | Change、WorkingState、ChangeRecord 模型 |
| `apps/server/app/domain/object_type.py` | ObjectType 模型 + 请求/响应 schema |
| `apps/server/app/storage/working_state_storage.py` | WorkingState 数据访问 |
| `apps/server/app/storage/object_type_storage.py` | ObjectType 数据访问 |
| `apps/server/app/storage/ontology_storage.py` | Ontology 版本管理 |
| `apps/server/app/services/working_state_service.py` | 变更管理核心逻辑 |
| `apps/server/app/services/object_type_service.py` | ObjectType CRUD 业务逻辑 |
| `apps/server/app/routers/object_types.py` | ObjectType REST 端点 |
| `apps/server/app/routers/ontology.py` | 变更管理端点 |
| `apps/server/tests/conftest.py` | 测试 fixtures（test db session, test client） |
| `apps/server/tests/unit/test_validators.py` | 校验器单元测试 |
| `apps/server/tests/unit/test_change_collapsing.py` | 变更合并逻辑单元测试 |
| `apps/server/tests/integration/test_object_type_api.py` | ObjectType CRUD API 集成测试 |
| `apps/server/tests/integration/test_working_state_api.py` | 变更管理 API 集成测试 |

### 修改文件（1 个）

| 文件路径 | 修改内容 |
|----------|----------|
| `apps/server/app/main.py` | 注册 `object_types.router` 和 `ontology.router` |

### 复用（不修改）

| 文件路径 | 复用内容 |
|----------|----------|
| `app/storage/models.py` | ORM 模型（ObjectTypeModel, WorkingStateModel 等） |
| `app/domain/common.py` | DomainModel 基类, generate_rid() |
| `app/exceptions.py` | AppError + handler |
| `app/database.py` | async session 管理 |

---

## 验证方式

| AC | 验证方法 |
|----|----------|
| AC1 | 集成测试：POST 创建后，GET 列表确认 status=experimental, visibility=normal |
| AC2 | 集成测试：创建两个同 id 或同 apiName 的 ObjectType，确认返回 409 |
| AC3a | 单元测试：验证 PascalCase 正则 + 保留字拒绝 |
| AC3b | 单元测试：验证 id 正则 |
| AC4 | 集成测试：创建 25 条，GET page=1&pageSize=20 返回 20 条，total=25 |
| AC5 | 集成测试：GET /{rid} 返回完整元数据字段 |
| AC6 | 集成测试：PUT 修改 displayName/description/icon/status/visibility，确认成功 |
| AC7 | 集成测试：status=active 时修改 apiName 返回 400；id 不可修改（请求 schema 不含 id） |
| AC8 | 集成测试：PUT 后 GET 返回最新值（合并视图即时反映） |
| AC9 | 前端测试（F003b 覆盖） |
| AC10 | 集成测试：active 状态 DELETE 返回 400 |
| AC10a | 集成测试：删除 ObjectType 后发布，确认 properties 和 link_types 也被删除 |
| AC11 | 集成测试：创建后检查 working_states 表有记录，object_types 主表无记录 |
| AC12 | 集成测试：创建后 GET 列表包含新资源（未发布），changeState=created |
| AC13 | 集成测试：验证 created/modified/deleted/published 四种 changeState 标注正确 |
