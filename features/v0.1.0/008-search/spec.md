# Feature: 008 本体搜索（Ontology Search）

> **前置步骤**：本文档编写前已完成 Spec Discovery（架构师提问），PRD 中的不确定性已与用户对齐。
> 本文档合并需求规范与技术设计。需求部分描述业务能力，设计部分只写契约和决策（Why + What），不写实现步骤（How）。
> 测试策略由 CLAUDE.md §测试要求统一管理，此处不重复。

**关联 PRD**: [docs/prd/0.1.0（MVP）/本体管理平台（Ontology Manager） PRD.md §5. 本体搜索]
**架构参考**: [docs/architecture/02-domain-model.md §Full-text search]
**优先级**: P0
**所属版本**: v0.1.0

---

## 1. 概述与用户故事

作为 **本体管理员**，
我希望 **在顶部搜索栏输入关键词，快速搜索到本体中的对象类型、属性和链接类型**，
以便 **在资源数量增多时能高效定位和导航到目标资源，而不必逐页滚动查找**。

---

## 2. 验收标准

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| AC-01 | 管理员 | 点击搜索栏或按 Cmd/Ctrl+K | 搜索栏获得焦点，可输入搜索词 |
| AC-02 | 管理员 | 输入搜索词（≥1 字符），等待 300ms debounce | 系统发送 `GET /api/v1/search?q=keyword`，返回按类型分组的搜索结果（200） |
| AC-03 | 管理员 | 查看搜索结果分组视图 | 结果按 Object Types → Properties → Link Types 分组展示，每组最多显示前 5 条，超出显示 "Show all" |
| AC-04 | 管理员 | 点击分组中的 "Show all" | 切换到该类型的筛选视图，复用列表页表格样式（NAME/STATUS/VISIBILITY 列） |
| AC-05 | 管理员 | 点击搜索结果中的某条记录 | 导航到该资源的详情页（OT → `/object-types/:rid/overview`，LT → `/link-types/:rid`，Property → `/object-types/:otRid/properties`） |
| AC-06 | 管理员 | 搜索包含草稿变更（CREATE/UPDATE）的资源 | 搜索结果中包含草稿资源，并显示对应的 changeState 标签（New/Modified） |
| AC-07 | 管理员 | 搜索已被草稿 DELETE 的资源 | 搜索结果中不包含已标记删除的资源 |
| AC-08 | 管理员 | 搜索草稿 ObjectType 下的草稿 Property | 搜索结果中包含该 Property，且显示其所属 ObjectType 的 displayName |
| AC-09 | 管理员 | 查看搜索结果中的关键词匹配 | 匹配的字段名高亮显示（如 displayName 匹配则标注 "Name"，description 匹配则标注 "Description"） |
| AC-10 | 管理员 | 输入搜索词后查看侧边栏 | 侧边栏切换为搜索模式：显示 "Search results (N)" 总计 + 各类型计数 |
| AC-11 | 管理员 | 在侧边栏搜索模式中点击某个类型 | 主内容区切换到该类型的筛选视图 |
| AC-12 | 管理员 | 点击搜索栏的 Clear 按钮或清空搜索词 | isSearchMode 恢复为 false，侧边栏和主内容区恢复到原始页面 |
| AC-13 | 管理员 | 使用 `types` 参数筛选搜索类型 | `GET /api/v1/search?q=keyword&types=objectType,property` 仅返回指定类型的结果 |
| AC-14 | 管理员 | 搜索无匹配结果 | 显示空状态提示（"No results found for 'keyword'"） |
| AC-15 | 管理员 | 输入部分词（前缀匹配，如 "Emp"） | 搜索结果包含 displayName 以 "Emp" 开头的资源（ILIKE 前缀补充） |
| AC-16 | 管理员 | 搜索结果中 Property 类型的结果 | 每条 Property 结果显示其所属 ObjectType 的 displayName 和 baseType |
| AC-17 | 管理员 | 搜索结果中 LinkType 类型的结果 | 每条 LinkType 结果显示 sideA 和 sideB 的 displayName |

---

## 3. 边界情况

- 当搜索词为空字符串或仅含空格时，不发送 API 请求，退出搜索模式
- 当搜索词长度超过 200 字符时，前端截断到 200 字符后发送
- 当 API 返回错误时，搜索结果区显示错误提示，不影响侧边栏状态
- 当某类型结果为 0 条时，分组视图中不显示该类型分组
- 当 WorkingState 不存在时（无草稿），搜索仅查询已发布数据
- 当搜索过程中用户快速连续输入时，debounce 300ms 确保只发送最后一次请求
- **不支持**：键盘 ↑↓ 导航和选中项预览面板（延后到后续版本）
- **不支持**：Health issues、Cleanup、History、Advanced 筛选（延后到后续版本）
- **不支持**：Action Types、Shared Properties、Interfaces、Functions 搜索（MVP 未实现这些资源类型）

---

## 4. 架构决策

| ID | 决策 | 选项 | 结论 | 理由 |
|----|------|------|------|------|
| AD-01 | 搜索引擎 | A: PostgreSQL FTS / B: Elasticsearch / C: 纯 ILIKE | 选 A（FTS + ILIKE 补充） | MVP 阶段不引入额外中间件；PG FTS 已有 TSVECTOR + GIN 索引基础设施；ILIKE 补充前缀匹配 |
| AD-02 | 草稿搜索 | A: 纯数据库查询 / B: FTS + 内存合并 | 选 B | 草稿存储在 WorkingState JSONB 中，无法通过 FTS 索引搜索；需在内存中匹配 draft changes |
| AD-03 | 搜索展示 | A: 下拉弹出面板 / B: 页面模式切换 / C: 独立搜索页 | 选 B | 与现有 HomeSidebar + 主内容区布局契合；支持分组和筛选视图切换；用户确认 |
| AD-04 | 键盘导航 | A: 完整键盘导航+预览 / B: 纯列表点击 | 选 B | MVP 简化方案，用户确认；后续版本可增强 |
| AD-05 | 分组展示 | A: 每组 5 条+Show all / B: 每组 10 条+分页 / C: 全量滚动 | 选 A | 用户确认；每组 5 条平衡信息密度和页面长度 |
| AD-06 | LinkType search_vector | A: 新增迁移 / B: 不建索引，纯 ILIKE | 选 A | ObjectType 和 Property 已有 search_vector + GIN 索引；LinkType 应保持一致 |

---

## 5. 数据库 & Domain 模型

### 5.1 数据库迁移：link_types search_vector

> ObjectType 和 Property 已在 `0002_create_schema.py` 中创建了 TSVECTOR 列、GIN 索引和触发器。
> LinkType 缺失该基础设施，需补充。

```sql
-- 1. 添加 TSVECTOR 列
ALTER TABLE link_types ADD COLUMN search_vector TSVECTOR;

-- 2. 创建 GIN 索引
CREATE INDEX ix_link_types_search_vector ON link_types USING GIN (search_vector);

-- 3. 创建 link_types 触发器函数
-- 从 link_type_endpoints 的 display_name/api_name 拼接
-- 权重：A = link_type_endpoints.display_name + api_name, B = link_types.id
CREATE OR REPLACE FUNCTION link_types_search_vector_update() RETURNS trigger AS $$
DECLARE
    combined_text TSVECTOR;
BEGIN
    SELECT
        setweight(to_tsvector('simple', coalesce(string_agg(e.display_name, ' '), '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(string_agg(e.api_name, ' '), '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(NEW.id, '')), 'B')
    INTO combined_text
    FROM link_type_endpoints e
    WHERE e.link_type_rid = NEW.rid;

    NEW.search_vector := combined_text;
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER link_types_search_vector_trigger
    BEFORE INSERT OR UPDATE ON link_types
    FOR EACH ROW EXECUTE FUNCTION link_types_search_vector_update();

-- 4. 创建 link_type_endpoints 级联触发器
-- endpoint 变更时更新父 link_type 的 search_vector
CREATE OR REPLACE FUNCTION link_type_endpoints_cascade_search_update() RETURNS trigger AS $$
BEGIN
    UPDATE link_types SET updated_at = now()
    WHERE rid = coalesce(NEW.link_type_rid, OLD.link_type_rid);
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER link_type_endpoints_cascade_trigger
    AFTER INSERT OR UPDATE OR DELETE ON link_type_endpoints
    FOR EACH ROW EXECUTE FUNCTION link_type_endpoints_cascade_search_update();

-- 5. 回填已有数据
UPDATE link_types SET updated_at = now();
```

### 5.2 ORM 模型变更

**修改**：`apps/server/app/storage/models.py` — LinkTypeModel 添加 `search_vector` 列

```python
# LinkTypeModel 新增字段
search_vector = mapped_column(TSVECTOR, nullable=True)
# GIN 索引（在 __table_args__ 中）
Index("ix_link_types_search_vector", "search_vector", postgresql_using="gin")
```

### 5.3 Search Domain 模型

**新增**：`apps/server/app/domain/search.py`

```python
class SearchResourceType(str, Enum):
    OBJECT_TYPE = "objectType"
    PROPERTY = "property"
    LINK_TYPE = "linkType"

class SearchResultItem(DomainModel):
    rid: str
    resource_type: SearchResourceType
    display_name: str
    description: str | None = None
    icon: Icon | None = None                    # ObjectType 的图标
    status: ResourceStatus
    visibility: Visibility
    change_state: ChangeState
    matched_fields: list[str]                   # ["name", "description", "apiName", ...]
    # Property 特有字段
    object_type_rid: str | None = None
    object_type_display_name: str | None = None
    base_type: str | None = None
    # LinkType 特有字段
    side_a_display_name: str | None = None
    side_b_display_name: str | None = None

class SearchTypeResult(DomainModel):
    items: list[SearchResultItem]
    total: int

class SearchResponse(DomainModel):
    query: str
    results: dict[str, SearchTypeResult]        # key = "objectTypes" | "properties" | "linkTypes"
    total_count: int
```

---

## 6. API 契约

### 端点列表

| Method | Path | 描述 |
|--------|------|------|
| GET | `/api/v1/search` | 全局搜索 |

### 请求参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `q` | string | 是 | — | 搜索关键词，1~200 字符 |
| `types` | string | 否 | `objectType,property,linkType` | 逗号分隔的资源类型筛选 |
| `limit` | int | 否 | `20` | 每种类型返回的最大结果数 |

### 响应示例

```json
// GET /api/v1/search?q=employee&types=objectType,property&limit=5
// Response 200
{
  "query": "employee",
  "results": {
    "objectTypes": {
      "items": [
        {
          "rid": "ri.ontology.object-type.abc123",
          "resourceType": "objectType",
          "displayName": "Employee",
          "description": "Company employee records",
          "icon": { "name": "user", "color": "#4A90D9" },
          "status": "active",
          "visibility": "prominent",
          "changeState": "published",
          "matchedFields": ["name", "description"]
        }
      ],
      "total": 1
    },
    "properties": {
      "items": [
        {
          "rid": "ri.ontology.property.def456",
          "resourceType": "property",
          "displayName": "Employee ID",
          "description": null,
          "icon": null,
          "status": "experimental",
          "visibility": "normal",
          "changeState": "created",
          "matchedFields": ["name"],
          "objectTypeRid": "ri.ontology.object-type.abc123",
          "objectTypeDisplayName": "Employee",
          "baseType": "string"
        }
      ],
      "total": 1
    },
    "linkTypes": {
      "items": [],
      "total": 0
    }
  },
  "totalCount": 2
}
```

### 错误码表

| HTTP Status | Code | 场景 | 关联 AC |
|-------------|------|------|---------|
| 400 | `SEARCH_QUERY_EMPTY` | `q` 参数为空或仅含空格 | AC-02 |
| 400 | `SEARCH_QUERY_TOO_LONG` | `q` 参数超过 200 字符 | AC-02 |
| 400 | `SEARCH_INVALID_TYPE` | `types` 中包含无效的资源类型 | AC-13 |

---

## 7. Service / Router 层逻辑

### SearchService（`app/services/search_service.py`）

核心方法 `search(ontology_rid, query, types, limit)` → `SearchResponse`：

1. **FTS 查询已发布数据**：调用 `SearchStorage` 对各资源表执行 `search_vector @@ plainto_tsquery('simple', query)` + `ts_rank` 排序
2. **ILIKE 前缀补充**：对 `display_name` 和 `api_name` 执行 `ILIKE '{query}%'` 查询，捕获 FTS 不支持的部分词前缀匹配
3. **合并去重**：FTS 结果 + ILIKE 结果按 rid 去重，FTS 匹配的排在前面
4. **草稿合并**：从 `WorkingStateService.get_merged_view()` 获取各类型的 merged view → 在内存中对 draft CREATE/UPDATE 资源执行关键词匹配（display_name、api_name、description、id 字段 ILIKE），排除 DELETE 状态的资源
5. **构建 matchedFields**：根据匹配的字段名生成 `["name", "description", "apiName", "id"]` 列表
6. **补充关联信息**：Property → 填充 objectTypeDisplayName（从 merged OT 视图获取）；LinkType → 填充 sideA/sideB displayName（从 endpoint 数据获取）

### SearchStorage（`app/storage/search_storage.py`）

- `search_object_types(session, ontology_rid, query, limit)` → 执行 FTS + ILIKE 查询 object_types 表
- `search_properties(session, ontology_rid, query, limit)` → 执行 FTS + ILIKE 查询 properties 表
- `search_link_types(session, ontology_rid, query, limit)` → 执行 FTS + ILIKE 查询 link_types + link_type_endpoints 表
- 每个方法返回 `list[tuple[Model, list[str]]]`（模型 + 匹配字段列表）

### SearchRouter（`app/routers/search.py`）

- `GET /api/v1/search` → 解析 query params → 调用 `SearchService.search()` → 返回 `SearchResponse`
- 参数校验：q 非空、长度 ≤ 200、types 合法

---

## 8. 前端组件设计

### 组件结构

```
TopBar
└── SearchBar.tsx                     # 替换 SearchBarPlaceholder（Cmd+K、debounce、Clear）

HomeLayout
├── HomeSidebar.tsx                   # 修改：搜索模式下显示搜索侧边栏内容
│   └── SearchSidebar（内嵌）          # "Search results (N)" + 各类型计数
└── <main>
    └── SearchResultsPanel.tsx        # 搜索模式下替代原页面内容
        ├── SearchResultsGroupView    # 默认分组视图（OT/Property/LT 各5条）
        │   └── SearchResultItem      # 单条结果（图标+名称+描述+badges+高亮标注）
        └── SearchResultsFilterView   # 筛选视图（复用表格样式）
```

### 新增/修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `components/layout/SearchBar.tsx` | 新增 | 替换 SearchBarPlaceholder；功能完整的搜索栏 |
| `components/layout/SearchBarPlaceholder.tsx` | 删除 | 被 SearchBar.tsx 替换 |
| `components/layout/TopBar.tsx` | 修改 | 引用 SearchBar 替换 SearchBarPlaceholder |
| `components/layout/HomeSidebar.tsx` | 修改 | 搜索模式下渲染搜索侧边栏内容 |
| `components/layout/HomeLayout.tsx` | 修改 | 搜索模式下主内容区渲染 SearchResultsPanel |
| `components/search/SearchResultsPanel.tsx` | 新增 | 搜索结果主面板（分组视图 + 筛选视图） |
| `components/search/SearchHighlight.tsx` | 新增 | 关键词高亮组件 |
| `components/search/SearchResultItem.tsx` | 新增 | 单条搜索结果展示 |
| `api/search.ts` | 新增 | TanStack Query hook `useSearch(query, types, limit)` |
| `stores/search-store.ts` | 新增 | Zustand store（query, activeType, isSearchMode） |

### 路由

无新增路由。搜索通过页面模式切换实现，不改变 URL。

### Zustand Store 设计

```typescript
interface SearchStore {
  query: string;                                  // 当前搜索词
  isSearchMode: boolean;                          // 是否处于搜索模式
  activeType: 'all' | 'objectType' | 'property' | 'linkType';  // 当前筛选类型
  setQuery: (q: string) => void;                  // 设置搜索词
  setActiveType: (type: ...) => void;             // 设置筛选类型
  enterSearchMode: () => void;                    // 进入搜索模式
  exitSearchMode: () => void;                     // 退出搜索模式（重置所有状态）
}
```

### TanStack Query Hook

```typescript
// Query key factory
const searchKeys = {
  all: ['search'] as const,
  query: (q: string, types?: string) => [...searchKeys.all, q, types] as const,
};

// Hook
function useSearch(query: string, types?: string, limit?: number) {
  return useQuery({
    queryKey: searchKeys.query(query, types),
    queryFn: () => fetchSearch(query, types, limit),
    enabled: query.trim().length > 0,              // 空词不请求
    staleTime: 30_000,                             // 30s 内不重查
  });
}
```

### 交互流程

1. 用户点击搜索栏或按 Cmd/Ctrl+K → 搜索栏获焦
2. 输入搜索词（debounce 300ms）→ `setQuery(q)` → `enterSearchMode()` → `useSearch` 触发 API 请求
3. 侧边栏切换为搜索模式：显示 "Search results (N)" + OT/Property/LT 计数（点击类型切换 `activeType`）
4. 主内容区显示 SearchResultsPanel：
   - `activeType === 'all'`：分组视图，每组前 5 条 + "Show all" 按钮
   - `activeType === 'objectType' | 'property' | 'linkType'`：筛选视图，复用表格样式
5. 点击结果 → 导航到资源详情页
6. 点击 Clear 或清空搜索词 → `exitSearchMode()` → 恢复原页面

---

## 9. 文件清单

```
apps/server/
├── alembic/versions/XXXX_add_link_type_search_vector.py   # 新建：迁移
├── app/domain/search.py                                    # 新建：搜索 domain 模型
├── app/storage/search_storage.py                           # 新建：FTS 查询
├── app/storage/models.py                                   # 修改：LinkTypeModel.search_vector
├── app/services/search_service.py                          # 新建：搜索业务逻辑
├── app/routers/search.py                                   # 新建：搜索路由
├── app/routers/__init__.py                                 # 修改：注册 search router
├── openapi.json                                            # 重新生成
└── tests/
    ├── unit/test_search_service.py                         # 新建：搜索服务单元测试
    └── integration/test_search_router.py                   # 新建：搜索路由集成测试

apps/web/
├── src/api/search.ts                                       # 新建：搜索 API hook
├── src/stores/search-store.ts                              # 新建：搜索 UI 状态
├── src/components/layout/SearchBar.tsx                     # 新建：功能搜索栏
├── src/components/layout/SearchBarPlaceholder.tsx           # 删除
├── src/components/layout/TopBar.tsx                        # 修改：引用 SearchBar
├── src/components/layout/HomeSidebar.tsx                   # 修改：搜索模式
├── src/components/layout/HomeLayout.tsx                    # 修改：搜索模式
├── src/components/search/SearchResultsPanel.tsx            # 新建：搜索结果面板
├── src/components/search/SearchHighlight.tsx               # 新建：关键词高亮
├── src/components/search/SearchResultItem.tsx              # 新建：单条搜索结果
├── src/locales/en-US/common.json                          # 修改：新增 search.* i18n keys
├── src/locales/zh-CN/common.json                          # 修改：新增 search.* i18n keys
└── src/generated/api.ts                                    # 重新生成（禁止手编）
```

---

## 非功能要求

- **性能**：搜索 API 响应时间 < 500ms（1000 条资源规模）；FTS + GIN 索引保证查询效率
- **可用性**：搜索过程中显示 loading 状态；API 错误时显示友好提示；空结果时显示引导信息
- **国际化**：所有搜索相关 UI 字符串使用 `t()` 包裹，支持中英双语

---

## 依赖与约束

- **依赖特性**：
  - `003-object-type-crud`：ObjectType CRUD + WorkingState 基础设施
  - `005-object-type-crud-frontend`：前端 App Shell + 侧边栏布局
  - `006-link-type-crud`：LinkType CRUD + link_type_endpoints 表
  - `007-property-management`：Property CRUD
- **版本契约**：本特性为只读搜索，不涉及任何领域对象的写入，不违反 release-contract.md 的 Owner 归属规则
- **不变量**：不涉及写操作，无不变量冲突

---

## 相关文档

- 架构参考: [docs/architecture/02-domain-model.md §Full-text search]
- 数据库迁移参考: [apps/server/alembic/versions/0002_create_schema.py §FTS triggers]
- PRD: [docs/prd/0.1.0（MVP）/本体管理平台（Ontology Manager） PRD.md §5]
- 版本契约: [features/v0.1.0/release-contract.md]
