# Tasks: 本体搜索（Ontology Search）

**关联规格**: [spec.md](./spec.md)
**版本**: v0.1.0

---

## 状态

| 步骤 | 状态 | 备注 |
|------|------|------|
| spec.md | ✅ 已评审 | 2026-03-17 用户确认通过 |
| tasks.md | 🔲 草稿 | |
| 实现 | 🔲 未开始 | 0 / 15 完成 |

---

## 开发模式

**后端 Test-First（测试在前，实现在后）**：后端任务按「测试 → 实现」配对编排，先写测试（红），再写实现（绿）。
基础设施任务（数据库迁移、ORM 模型、配置）无测试配对，单独编号。

**前端 Test-Alongside**：前端实现任务内含测试，或在同 phase 末尾补充测试任务。

**自包含任务**：每个任务内联文件、逻辑、测试上下文，实现阶段不需要回读 spec.md。

---

## Phase 1: 后端基础设施

### T01: Alembic 迁移 — link_types 添加 search_vector

- [ ] **T01**
- 文件:
  - `apps/server/alembic/versions/XXXX_add_link_type_search_vector.py` — 新迁移脚本
- 内容:
  - `link_types` 表新增列 `search_vector TSVECTOR NULLABLE`
  - 创建 GIN 索引 `ix_link_types_search_vector`
  - 创建触发器函数 `link_types_search_vector_update()`：
    - 从 `link_type_endpoints` 的 `display_name`/`api_name` 拼接，权重 A
    - 从 `link_types.id` 拼接，权重 B
    - 使用 `to_tsvector('simple', ...)` + `setweight()`
  - 创建 `link_type_endpoints` 级联触发器 `link_type_endpoints_cascade_search_update()`：
    - endpoint INSERT/UPDATE/DELETE 时更新父 link_type 的 `updated_at`（触发 link_types 触发器重建 search_vector）
  - 回填已有数据：`UPDATE link_types SET updated_at = now()`
  - downgrade: 删除触发器、触发器函数、索引、列
  - **参考**: `0002_create_schema.py` 第 398-447 行的 ObjectType/Property FTS 触发器模式
- 依赖: 无
- 验证: `cd apps/server && PYTHONPATH=. uv run alembic upgrade head` 成功
- 覆盖 AC: 无（基础设施）

---

### T02: ORM 模型更新 — LinkTypeModel.search_vector

- [ ] **T02**
- 文件:
  - `apps/server/app/storage/models.py` — 修改 LinkTypeModel
- 内容:
  - `LinkTypeModel` 新增字段: `search_vector = mapped_column(TSVECTOR, nullable=True)`
  - `__table_args__` 新增: `Index("ix_link_types_search_vector", "search_vector", postgresql_using="gin")`
  - 需导入 `TSVECTOR` from `sqlalchemy.dialects.postgresql`（参考 ObjectTypeModel 已有的 search_vector 字段）
- 依赖: T01
- 覆盖 AC: 无（基础设施）

---

### T03: Search Domain 模型

- [ ] **T03**
- 文件:
  - `apps/server/app/domain/search.py` — 新建
- 内容:
  - `SearchResourceType(str, Enum)`: `OBJECT_TYPE = "objectType"`, `PROPERTY = "property"`, `LINK_TYPE = "linkType"`
  - `SearchResultItem(DomainModel)`:
    - `rid: str`, `resource_type: SearchResourceType`, `display_name: str`
    - `description: str | None = None`, `icon: Icon | None = None`
    - `status: ResourceStatus`, `visibility: Visibility`, `change_state: ChangeState`
    - `matched_fields: list[str]` — 如 `["name", "description", "apiName"]`
    - Property 特有: `object_type_rid: str | None`, `object_type_display_name: str | None`, `base_type: str | None`
    - LinkType 特有: `side_a_display_name: str | None`, `side_b_display_name: str | None`
  - `SearchTypeResult(DomainModel)`: `items: list[SearchResultItem]`, `total: int`
  - `SearchResponse(DomainModel)`: `query: str`, `results: dict[str, SearchTypeResult]`, `total_count: int`
  - 所有模型继承 `DomainModel`（自带 `alias_generator=to_camel, populate_by_name=True`）
  - 导入: `Icon` from `app.domain.object_type`, `ResourceStatus`, `Visibility` from `app.domain.object_type`, `ChangeState` from `app.domain.working_state`
- 依赖: 无
- 覆盖 AC: 无（基础设施）

---

## Phase 2: 后端 Storage + Service

### T04: SearchStorage 实现

- [ ] **T04**
- 文件:
  - `apps/server/app/storage/search_storage.py` — 新建
- 内容:
  - `search_object_types(session, ontology_rid, query, limit) → list[tuple[ObjectTypeModel, list[str]]]`:
    - FTS 查询: `search_vector @@ plainto_tsquery('simple', query)` + `ts_rank` 排序
    - ILIKE 前缀补充: `display_name ILIKE '{query}%' OR api_name ILIKE '{query}%'`
    - 合并去重（FTS 优先），返回模型 + matched_fields 列表
    - matched_fields 判断: 检查 `display_name`/`api_name`/`id`/`description` 中哪些字段包含 query
  - `search_properties(session, ontology_rid, query, limit) → list[tuple[PropertyModel, list[str]]]`:
    - 同上模式，查询 `properties` 表（需 JOIN `object_types` 获取 `ontology_rid` 过滤）
    - matched_fields: `display_name`/`api_name`/`description`
  - `search_link_types(session, ontology_rid, query, limit) → list[tuple[LinkTypeModel, list[str]]]`:
    - FTS: 查询 `link_types` 表的 `search_vector`
    - ILIKE: JOIN `link_type_endpoints` 查询 endpoint 的 `display_name`/`api_name`
    - matched_fields: endpoint `display_name`/`api_name`, `link_types.id`
  - 所有查询使用 `async session`，参数化查询防注入
  - **ILIKE 安全**: 对 query 中的 `%` 和 `_` 转义
- 依赖: T02（ORM 模型）、T03（Domain 模型）
- 覆盖 AC: 无（被 Service 层调用）

---

### T05: SearchService 单元测试

- [ ] **T05**
- 文件:
  - `apps/server/tests/unit/test_search_service.py` — 新建
- 内容:
  - mock `SearchStorage` 的三个方法 + `WorkingStateService.get_merged_view()`
  - 测试用例:
    - `test_search_object_types_fts_match`: OT FTS 匹配，返回 SearchResultItem（含 icon、status、visibility）→ AC-02
    - `test_search_properties_with_ot_display_name`: Property 结果包含 objectTypeDisplayName 和 baseType → AC-16
    - `test_search_link_types_with_sides`: LT 结果包含 sideA/sideB displayName → AC-17
    - `test_search_draft_created_included`: 草稿 CREATE 的资源在搜索结果中 → AC-06
    - `test_search_draft_updated_included`: 草稿 UPDATE 的资源在搜索结果中（使用 after 数据）→ AC-06
    - `test_search_draft_deleted_excluded`: 草稿 DELETE 的资源不在搜索结果中 → AC-07
    - `test_search_draft_property_under_draft_ot`: 草稿 OT 下的草稿 Property 可搜索到，且有 OT displayName → AC-08
    - `test_search_matched_fields_correct`: matchedFields 正确标注匹配的字段 → AC-09
    - `test_search_prefix_match`: 前缀匹配 "Emp" 命中 "Employee" → AC-15
    - `test_search_no_results`: 无匹配时返回空列表 + total=0 → AC-14
    - `test_search_type_filter`: types 参数只搜指定类型 → AC-13
    - `test_search_limit_per_type`: limit 参数限制每种类型返回数量 → AC-02
  - 运行: `cd apps/server && uv run pytest tests/unit/test_search_service.py -v`
- 依赖: T03（Domain 模型）
- 覆盖 AC: AC-02, AC-06, AC-07, AC-08, AC-09, AC-13, AC-14, AC-15, AC-16, AC-17

---

### T06: SearchService 实现

- [ ] **T06**
- 文件:
  - `apps/server/app/services/search_service.py` — 新建
- 内容:
  - `SearchService.__init__(self, session: AsyncSession)`: 持有 db session
  - `async search(ontology_rid, query, types, limit) → SearchResponse`:
    1. 根据 `types` 参数决定搜索哪些资源类型
    2. 对每种类型调用 `SearchStorage.search_xxx()` 获取已发布数据的 FTS+ILIKE 结果
    3. 调用 `WorkingStateService.get_merged_view(ontology_rid, resource_type)` 获取 merged view
    4. 对 merged view 中 `change_state != PUBLISHED` 的资源在内存中执行关键词匹配:
       - 匹配字段: `display_name`, `api_name`, `description`, `id`（不区分大小写）
       - `change_state == DELETED` → 跳过（无论是否匹配）
       - 已在 FTS 结果中（按 rid）→ 更新 change_state，不重复添加
       - 新 draft（CREATE/UPDATE 不在 FTS 中）→ 添加到结果
    5. 按 rid 去重，排序: FTS rank → draft 在后
    6. 截断到 limit
    7. 补充关联信息:
       - Property: 从 OT merged view 查找 `object_type_display_name`
       - LinkType: 从 endpoint 数据填充 `side_a_display_name`, `side_b_display_name`
    8. 构建 `SearchResponse`
  - **辅助方法**:
    - `_match_keyword(text: str | None, query: str) → bool`: 不区分大小写包含匹配
    - `_build_matched_fields(resource_dict, query) → list[str]`: 检查各字段返回匹配字段名
    - `_convert_to_search_item(...)`: 将各类型 domain 模型转为 SearchResultItem
  - 运行: T05 全部通过
- 依赖: T03、T04
- 覆盖 AC: AC-02, AC-06, AC-07, AC-08, AC-09, AC-13, AC-14, AC-15, AC-16, AC-17

---

## Phase 3: 后端 API 层

### T07: Search Router 集成测试

- [ ] **T07**
- 文件:
  - `apps/server/tests/integration/test_search_router.py` — 新建
- 内容:
  - 使用 `seeded_client` fixture（需 seed OT + Property + LT 数据）
  - 测试用例:
    - `test_search_success_all_types`: `GET /api/v1/search?q=xxx` 返回 200，结果包含 OT/Property/LT 分组 → AC-02, AC-03
    - `test_search_type_filter_object_type`: `?types=objectType` 只返回 OT → AC-13
    - `test_search_type_filter_property`: `?types=property` 只返回 Property → AC-13
    - `test_search_prefix_match`: `?q=Emp` 匹配 "Employee" → AC-15
    - `test_search_no_results`: `?q=nonexistent` 返回空 → AC-14
    - `test_search_empty_query_returns_400`: `?q=` 返回 400 `SEARCH_QUERY_EMPTY` → AC-02
    - `test_search_query_too_long_returns_400`: `?q=<201 chars>` 返回 400 `SEARCH_QUERY_TOO_LONG` → AC-02
    - `test_search_invalid_type_returns_400`: `?types=invalid` 返回 400 `SEARCH_INVALID_TYPE` → AC-13
    - `test_search_draft_created_visible`: 创建草稿 OT 后搜索可见 → AC-06
    - `test_search_draft_deleted_hidden`: 删除草稿后搜索不可见 → AC-07
    - `test_search_property_shows_ot_display_name`: Property 结果包含 objectTypeDisplayName → AC-16
    - `test_search_link_type_shows_sides`: LT 结果包含 sideA/sideB displayName → AC-17
    - `test_search_matched_fields`: matchedFields 正确返回 → AC-09
    - `test_search_limit`: `?limit=2` 每种类型最多 2 条 → AC-02
    - `test_search_response_camel_case`: 响应字段名为 camelCase → AC-02
  - 运行: `cd apps/server && uv run pytest tests/integration/test_search_router.py -v`
- 依赖: T06
- 覆盖 AC: AC-02, AC-03, AC-06, AC-07, AC-09, AC-13, AC-14, AC-15, AC-16, AC-17

---

### T08: Search Router 实现 + openapi.json 重新生成

- [ ] **T08**
- 文件:
  - `apps/server/app/routers/search.py` — 新建
  - `apps/server/app/routers/__init__.py` — 修改：注册 search router
  - `apps/server/openapi.json` — 重新生成
- 内容:
  - **Router**:
    - `router = APIRouter(prefix="/api/v1", tags=["search"])`
    - `GET /search`: Query params `q: str`, `types: str = "objectType,property,linkType"`, `limit: int = 20`
    - 参数校验: `q` 非空且 strip 后 ≤ 200 字符，否则 400；`types` 拆分后每项必须在 `{"objectType", "property", "linkType"}` 中，否则 400
    - 依赖注入: `_get_service(session) → SearchService(session)`
    - 调用 `service.search(ontology_rid, q.strip(), types_list, limit)` → 返回 `SearchResponse`
    - ontology_rid 从默认 ontology 获取（与 ObjectTypeRouter 模式一致）
  - **注册**: 在 `__init__.py` 的 `include_router` 列表中添加 `search.router`
  - **openapi.json**: `cd apps/server && PYTHONPATH=. uv run python -c "import json; from app.main import app; print(json.dumps(app.openapi(), indent=2))" > openapi.json`
  - 运行: T07 全部通过
- 依赖: T06
- 覆盖 AC: AC-02, AC-13

---

## Phase 4: 前端

### T09: 前端类型生成 + Search API Hook

- [ ] **T09**
- 文件:
  - `apps/web/src/generated/api.ts` — 重新生成（`pnpm run generate:api`）
  - `apps/web/src/api/search.ts` — 新建
- 内容:
  - **类型生成**: `cd apps/web && pnpm run generate:api`（从 openapi.json 生成 TS 类型）
  - **search.ts**:
    - `searchKeys` query key factory: `{ all: ['search'], query: (q, types?) => [...all, q, types] }`
    - `fetchSearch(query, types?, limit?)`: 调用 `GET /api/v1/search` 返回 `SearchResponse`
    - `useSearch(query, types?, limit?)`: TanStack Query hook
      - `enabled: query.trim().length > 0`
      - `staleTime: 30_000`（30 秒内不重查）
      - 返回 `UseQueryResult<SearchResponse>`
    - 使用 generated 类型（从 `src/generated/api.ts` 导入）
- 依赖: T08（openapi.json）
- 覆盖 AC: AC-02

---

### T10: Search Zustand Store

- [ ] **T10**
- 文件:
  - `apps/web/src/stores/search-store.ts` — 新建
- 内容:
  - `useSearchStore = create<SearchStore>(...)`:
    - `query: string`（初始 `""`）
    - `isSearchMode: boolean`（初始 `false`）
    - `activeType: 'all' | 'objectType' | 'property' | 'linkType'`（初始 `'all'`）
    - `setQuery(q: string)`: 设置 query
    - `setActiveType(type)`: 设置 activeType
    - `enterSearchMode()`: `isSearchMode = true`
    - `exitSearchMode()`: 重置 `query = ""`, `isSearchMode = false`, `activeType = 'all'`
  - 不使用 persist（搜索状态不需要持久化）
  - 仅存储 UI 状态，不存储服务端数据
- 依赖: 无
- 覆盖 AC: AC-10, AC-12

---

### T11: SearchBar 组件（替换 SearchBarPlaceholder）

- [ ] **T11**
- 文件:
  - `apps/web/src/components/layout/SearchBar.tsx` — 新建
  - `apps/web/src/components/layout/SearchBarPlaceholder.tsx` — 删除
  - `apps/web/src/components/layout/TopBar.tsx` — 修改：引用 SearchBar
- 内容:
  - **SearchBar.tsx**:
    - Ant Design `Input` 组件，`prefix={<SearchOutlined />}`，`suffix` 区域包含 Clear 按钮 + `⌘K` 快捷键标签
    - `placeholder={t('topBar.searchPlaceholder')}`
    - `maxWidth: 400`（与 placeholder 一致）
    - 受控 input: `value` 绑定 `useSearchStore.query`
    - `onChange`: 更新 store query + debounce 300ms 后 `enterSearchMode()`
    - Clear 按钮: 当 query 非空时显示 `CloseCircleFilled` 图标，点击调用 `exitSearchMode()`
    - `Cmd/Ctrl+K` 全局快捷键: `useEffect` 监听 keydown，`(e.metaKey || e.ctrlKey) && e.key === 'k'` → `e.preventDefault()` + 聚焦搜索框
    - `onFocus`: 如果已有 query → `enterSearchMode()`
    - 所有字符串用 `t()` 包裹
  - **TopBar.tsx**: 将 `<SearchBarPlaceholder />` 替换为 `<SearchBar />`
  - **删除** `SearchBarPlaceholder.tsx`
- 依赖: T10（search store）
- 覆盖 AC: AC-01, AC-12

---

### T12: SearchResultItem + SearchHighlight 组件

- [ ] **T12**
- 文件:
  - `apps/web/src/components/search/SearchResultItem.tsx` — 新建
  - `apps/web/src/components/search/SearchHighlight.tsx` — 新建
- 内容:
  - **SearchHighlight.tsx**:
    - Props: `text: string`, `query: string`
    - 逻辑: 将 text 中匹配 query 的部分用 `<mark>` 标签包裹（不区分大小写）
    - 无匹配则原样返回
  - **SearchResultItem.tsx**:
    - Props: `item: SearchResultItem`（API 返回类型）, `query: string`
    - 展示:
      - 左侧: 资源图标（OT 用 item.icon，Property 用 base type icon，LT 用 link icon）
      - 名称: `<SearchHighlight text={item.displayName} query={query} />`
      - 描述: 如有则展示 `<SearchHighlight text={item.description} query={query} />`（单行截断）
      - 右侧 badges: `changeState` 标签（published 隐藏, created → 绿"New", modified → 蓝"Modified"）
      - 类型特有信息:
        - Property: 显示 `objectTypeDisplayName` + `baseType` 标签
        - LinkType: 显示 `sideADisplayName ↔ sideBDisplayName`
      - matchedFields: 在名称下方用小字标注 "Matched: Name, Description"
    - 点击: `useNavigate()` 导航到详情页
      - OT → `/object-types/${item.rid}/overview`
      - LT → `/link-types/${item.rid}`
      - Property → `/object-types/${item.objectTypeRid}/properties`
    - 所有字符串用 `t()` 包裹
- 依赖: T09（API 类型）
- 覆盖 AC: AC-05, AC-09, AC-16, AC-17

---

### T13: SearchResultsPanel + HomeSidebar/HomeLayout 搜索模式

- [ ] **T13**
- 文件:
  - `apps/web/src/components/search/SearchResultsPanel.tsx` — 新建
  - `apps/web/src/components/layout/HomeSidebar.tsx` — 修改
  - `apps/web/src/components/layout/HomeLayout.tsx` — 修改
- 内容:
  - **SearchResultsPanel.tsx**:
    - 读取 `useSearchStore` 的 `query`, `activeType`
    - 调用 `useSearch(query)` 获取搜索结果
    - **分组视图** (`activeType === 'all'`):
      - 按 objectTypes → properties → linkTypes 顺序展示
      - 每组: 标题（如 "Object Types (3)"）+ 前 5 条 `<SearchResultItem />` + "Show all" 按钮
      - "Show all" 点击 → `setActiveType('objectType')` 等
      - 结果为 0 的组不显示
      - 全部为 0 → 显示空状态 `t('search.noResults', { query })`
    - **筛选视图** (`activeType !== 'all'`):
      - 展示对应类型的全部结果（复用表格样式）
      - 表格列: NAME（含高亮）、STATUS、VISIBILITY
      - Property 额外列: OBJECT TYPE、BASE TYPE
      - LinkType 额外列: SIDE A、SIDE B
    - Loading 状态: `Spin` 组件
    - Error 状态: `Alert` 提示
  - **HomeSidebar.tsx**:
    - 读取 `useSearchStore.isSearchMode`
    - `isSearchMode === true` 时，菜单区替换为搜索侧边栏:
      - 标题: `t('search.results', { count: totalCount })` 如 "Search results (12)"
      - 菜单项:
        - "All results" → `setActiveType('all')`
        - "Object Types (N)" → `setActiveType('objectType')`
        - "Properties (N)" → `setActiveType('property')`
        - "Link Types (N)" → `setActiveType('linkType')`
      - 当前 `activeType` 对应项高亮
    - `isSearchMode === false` 时，保持原有导航菜单
  - **HomeLayout.tsx**:
    - 读取 `useSearchStore.isSearchMode`
    - `isSearchMode === true` 时，`<main>` 区域渲染 `<SearchResultsPanel />` 替代 `<Outlet />`
    - `isSearchMode === false` 时，保持原有 `<Outlet />`
- 依赖: T09（API hook）、T10（store）、T11（SearchBar）、T12（SearchResultItem）
- 覆盖 AC: AC-03, AC-04, AC-10, AC-11, AC-14

---

### T14: i18n + 前端测试

- [ ] **T14**
- 文件:
  - `apps/web/src/locales/en-US/common.json` — 修改
  - `apps/web/src/locales/zh-CN/common.json` — 修改
  - `apps/web/src/stores/__tests__/search-store.test.ts` — 新建
  - `apps/web/src/components/search/__tests__/SearchHighlight.test.tsx` — 新建
  - `apps/web/src/components/search/__tests__/SearchResultsPanel.test.tsx` — 新建
- 内容:
  - **i18n keys** (en-US + zh-CN):
    ```
    search.results: "Search results ({{count}})" / "搜索结果 ({{count}})"
    search.noResults: "No results found for '{{query}}'" / "未找到与 '{{query}}' 匹配的结果"
    search.showAll: "Show all" / "查看全部"
    search.allResults: "All results" / "所有结果"
    search.matchedFields: "Matched: {{fields}}" / "匹配: {{fields}}"
    search.fieldName: "Name" / "名称"
    search.fieldDescription: "Description" / "描述"
    search.fieldApiName: "API Name" / "API 名称"
    search.fieldId: "ID" / "ID"
    search.objectTypes: "Object Types" / "对象类型"
    search.properties: "Properties" / "属性"
    search.linkTypes: "Link Types" / "链接类型"
    search.clear: "Clear" / "清除"
    ```
  - **search-store.test.ts**:
    - `test_enter_search_mode`: 设置 query + enterSearchMode → isSearchMode=true
    - `test_exit_search_mode`: exitSearchMode → query=""、isSearchMode=false、activeType='all'
    - `test_set_active_type`: setActiveType → 正确更新
    - 覆盖 AC: AC-10, AC-12
  - **SearchHighlight.test.tsx**:
    - `test_highlights_matching_text`: 匹配部分被 `<mark>` 包裹
    - `test_no_match_returns_plain`: 无匹配则原样返回
    - `test_case_insensitive`: 不区分大小写匹配
    - 覆盖 AC: AC-09
  - **SearchResultsPanel.test.tsx**:
    - mock `useSearch` 返回模拟数据
    - `test_renders_group_view`: 渲染分组视图，各组标题正确
    - `test_renders_empty_state`: 无结果时显示空状态
    - `test_show_all_switches_view`: 点击 "Show all" 切换 activeType
    - 覆盖 AC: AC-03, AC-04, AC-14
  - 运行: `cd apps/web && pnpm test --run`
- 依赖: T13
- 覆盖 AC: AC-03, AC-04, AC-09, AC-10, AC-12, AC-14

---

## AC 覆盖追溯矩阵

| AC | 覆盖任务 |
|----|---------|
| AC-01 | T11 |
| AC-02 | T05, T06, T07, T08, T09 |
| AC-03 | T07, T13, T14 |
| AC-04 | T13, T14 |
| AC-05 | T12 |
| AC-06 | T05, T06, T07 |
| AC-07 | T05, T06, T07 |
| AC-08 | T05, T06 |
| AC-09 | T05, T06, T07, T12, T14 |
| AC-10 | T10, T13, T14 |
| AC-11 | T13 |
| AC-12 | T10, T11, T14 |
| AC-13 | T05, T06, T07, T08 |
| AC-14 | T05, T06, T07, T13, T14 |
| AC-15 | T05, T06, T07 |
| AC-16 | T05, T06, T07, T12 |
| AC-17 | T05, T06, T07, T12 |

---

## 实际偏差记录

> 完成后，在此记录实现与 spec.md 的偏差，供后续参考。
