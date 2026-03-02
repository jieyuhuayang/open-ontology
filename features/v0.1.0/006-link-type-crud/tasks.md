# Tasks: Link Type CRUD（链接类型增删改查）

**关联规范**: [spec.md](./spec.md)
**技术方案**: [design.md](./design.md)
**版本**: v0.1.0
**开始日期**: 2026-03-02
**完成日期**: 2026-03-02

---

## 进度概览

- 总任务数: 14
- 已完成: 14 / 14
- 状态: ✅ 完成（后端单元 64 个通过含 17 个新增，前端 88 个测试通过含 21 个测试文件）

---

## Phase 1: 后端 Domain + Validators

- [x] **T001**: 编写 LinkType 校验器单元测试
  - 文件: `apps/server/tests/unit/test_link_type_validators.py`
  - 内容:
    - `validate_link_type_id()` 测试: 合法 id 通过（`my-link`, `link-with-digits-1`）、非法拒绝（大写、数字开头、空字符串、含下划线）
    - `validate_link_side_api_name()` 测试: 合法 camelCase 通过（`company`, `worksAt`）、非法拒绝（PascalCase、含连字符/下划线、空字符串、数字开头）、保留字拒绝（`ontology`, `primaryKey`）、NFKC 检查
    - 共 17 个测试用例
  - 依赖: 无
  - AC 覆盖: AC5, AC6

- [x] **T002**: 实现 LinkType Domain 模型 + 校验器扩展
  - 文件:
    - `apps/server/app/domain/link_type.py` — `Cardinality`, `JoinMethod`, `LinkSide`, `LinkType`, `LinkTypeWithChangeState`, `LinkSideCreateInput`, `LinkTypeCreateRequest`, `LinkSideUpdateInput`, `LinkTypeUpdateRequest`, `LinkTypeListResponse`
    - `apps/server/app/domain/validators.py` — `LINK_SIDE_API_NAME_PATTERN`, `validate_link_type_id()`, `validate_link_side_api_name()`
  - 内容: 见 [design.md §数据结构设计](./design.md#数据结构设计)。所有模型继承 `DomainModel`（camelCase alias）。校验器抛出 `AppError`，错误码见 design.md §错误码
  - 依赖: 无（复用 F003 的 `validators.py` 基础设施）
  - AC 覆盖: AC5, AC6
  - 验证: T001 全部测试通过

---

## Phase 2: 后端 Storage 层

- [x] **T003**: 实现 LinkTypeStorage
  - 文件: `apps/server/app/storage/link_type_storage.py`
  - 内容:
    - `_to_domain()`: ORM `LinkTypeModel` + endpoints → Domain `LinkType`，按 `endpoint.side` 区分 A/B
    - `list_by_ontology()`: `selectinload(LinkTypeModel.endpoints)` 急加载
    - `get_by_rid()`, `get_by_id()`: 单条查询
    - `get_api_names_for_object_type()`: 返回 `list[tuple[str, str]]`（link_type_rid, api_name）
    - `create()`: 插入 LinkTypeModel + 2 条 LinkTypeEndpointModel
    - `update()`: 更新主表 + 端点字段
    - `delete()`: 删除（CASCADE）
  - 依赖: T002（Domain 模型）、F002（ORM 模型）
  - AC 覆盖: 间接支持所有后端 AC

---

## Phase 3: 后端 Service + WorkingState 扩展

- [x] **T004**: 实现 LinkTypeService
  - 文件: `apps/server/app/services/link_type_service.py`
  - 内容:
    - `create()`: 校验 id/apiName → 自链接检查 → OT 存在性 → 唯一性 → 生成 RID → add_change(CREATE)
    - `list()`: merged view → 过滤 → 分页 → OT displayName 填充
    - `get_by_rid()`: 合并视图查找 + OT displayName
    - `update()`: 构建 before/after → add_change(UPDATE)
    - `delete()`: active 状态守卫 → add_change(DELETE)
    - 辅助: `_get_ot_display_name_map()`, `_fill_ot_display_names()`, `_check_id_uniqueness()`, `_check_api_name_uniqueness()`, `_validate_object_type_exists()`
  - 依赖: T003（Storage）、F003 WorkingStateService
  - AC 覆盖: AC5–AC8, AC10–AC12, AC15, AC18, AC21–AC23

- [x] **T005**: 扩展 WorkingStateService 支持 LINK_TYPE
  - 文件: `apps/server/app/services/working_state_service.py`
  - 内容:
    - `get_merged_view()`: 添加 `elif resource_type == ResourceType.LINK_TYPE` 分支
    - `publish()`: 添加 LINK_TYPE 分支 → `_apply_link_type_change()`
    - 新增 `_apply_link_type_change()`: CREATE/UPDATE/DELETE 分别调用 LinkTypeStorage
    - UPDATE 中的 camelCase→snake_case 键映射 + 嵌套 side 更新
  - 依赖: T003（LinkTypeStorage）
  - AC 覆盖: AC21, AC24

---

## Phase 4: 后端 Router + 集成测试

- [x] **T006**: 实现 LinkType Router + 注册
  - 文件:
    - `apps/server/app/routers/link_types.py` — 5 个端点（GET list, POST create, GET detail, PUT update, DELETE）
    - `apps/server/app/main.py` — 注册 `link_types.router`
  - 内容: Router 仅做 HTTP 解析 + 委托 LinkTypeService。查询参数 `objectTypeRid`, `status`, `visibility` 可选过滤
  - 依赖: T004（LinkTypeService）
  - AC 覆盖: 所有后端 AC（HTTP 入口）

- [x] **T007**: 编写 LinkType API 集成测试
  - 文件: `apps/server/tests/integration/test_link_type_api.py`
  - 内容:
    - `_create_object_types()` 辅助函数创建 Employee + Company OTs
    - `test_create_returns_201`: 创建成功 + 默认值检查
    - `test_create_self_link_returns_400`: 自链接拒绝
    - `test_create_duplicate_id_returns_409`: ID 唯一性
    - `test_create_duplicate_api_name_returns_409`: apiName 唯一性
    - `test_list_with_pagination`: 分页查询
    - `test_list_filter_by_object_type`: objectTypeRid 过滤
    - `test_get_detail`: 详情 + OT displayName 填充
    - `test_update_fields`: 更新字段
    - `test_delete_active_returns_400`: active 不可删
    - `test_delete_experimental_returns_204`: 正常删除
    - `test_not_found_returns_404`: 404 处理
    - `test_publish_writes_to_main_table`: 发布后主表写入验证
  - 依赖: T006
  - AC 覆盖: AC5–AC8, AC10, AC11, AC15, AC18, AC21–AC24

---

## Phase 5: 前端 API + Store

- [x] **T008**: 实现前端 API 类型 + Hooks + Store
  - 文件:
    - `apps/web/src/generated/api.ts` — 添加 LinkType OpenAPI 类型定义
    - `apps/web/src/api/types.ts` — 导出 LinkType, LinkSide, Cardinality 等
    - `apps/web/src/api/link-types.ts` — `linkTypeKeys` 工厂 + `useLinkTypes`, `useLinkType`, `useCreateLinkType`, `useUpdateLinkType`, `useDeleteLinkType`
    - `apps/web/src/stores/create-link-type-modal-store.ts` — Zustand store（isOpen, prefilledSideA, open, close）
  - 依赖: T006（后端 API 就绪）
  - AC 覆盖: 前端所有 AC 的数据层基础

---

## Phase 6: 前端组件

- [x] **T009**: 实现 CreateLinkTypeWizard（3 步创建向导）
  - 文件: `apps/web/src/pages/link-types/components/CreateLinkTypeWizard.tsx`
  - 内容:
    - Step 1: 3 个 Card 选择基数（many-to-many 置灰 disabled）
    - Step 2: 2 个 searchable Select 选择 OT（prefilledSideA 时 Side A 只读，自链接即时报错）
    - Step 3: Form（ID 自动生成自 OT IDs、每端 displayName + apiName + visibility、status）
    - apiName 从 displayName 自动生成 camelCase（`toCamelCase()` 辅助函数）
    - 错误处理映射后端错误码到表单字段
  - 依赖: T008
  - AC 覆盖: AC1, AC2, AC3, AC3a, AC3b, AC3c, AC4, AC4a–AC4e, AC8

- [x] **T010**: 实现 LinkTypeTable + LinkTypeDetailDrawer + DeleteLinkTypeModal
  - 文件:
    - `apps/web/src/pages/link-types/components/LinkTypeTable.tsx` — 列: ID, Side A, Side B, Cardinality, Status, ChangeState；`onRowClick` prop
    - `apps/web/src/pages/link-types/components/LinkTypeDetailDrawer.tsx` — Drawer 展示详情 + 可编辑字段（displayName onBlur、visibility/cardinality/status Radio.Group）+ Dropdown 删除菜单
    - `apps/web/src/pages/link-types/components/DeleteLinkTypeModal.tsx` — 确认弹窗 + `LINK_TYPE_ACTIVE_CANNOT_DELETE` 错误处理
  - 依赖: T008
  - AC 覆盖: AC9, AC12, AC13, AC14, AC17, AC18

- [x] **T011**: 重写 LinkTypeListPage + 路由更新
  - 文件:
    - `apps/web/src/pages/link-types/LinkTypeListPage.tsx` — 完整列表页（Header + Filters + Table + Drawer + Wizard）、URL search param `?selected={rid}` 控制 Drawer
    - `apps/web/src/router.tsx` — 移除 `link-types/new` 和 `link-types/:rid` 路由
    - 删除 `apps/web/src/pages/link-types/LinkTypeDetailLayout.tsx`
    - 删除 `apps/web/src/pages/link-types/__tests__/LinkTypeDetailLayout.test.tsx`
  - 依赖: T009, T010
  - AC 覆盖: AC9, AC10, AC11

- [x] **T012**: 更新 CreateMenu + OT Overview + OT Delete 级联
  - 文件:
    - `apps/web/src/components/layout/CreateMenu.tsx` — `navigate('/link-types/new')` → `useCreateLinkTypeModalStore().open()`
    - `apps/web/src/pages/object-types/ObjectTypeOverviewPage.tsx` — PlaceholderCard → 关联 LinkType 列表 + "New link type" 按钮
    - `apps/web/src/pages/object-types/components/DeleteObjectTypeModal.tsx` — 查询关联数量 + 级联警告
  - 依赖: T008, T011
  - AC 覆盖: AC1（入口 1+3）, AC3c, AC20

- [x] **T013**: 添加 i18n 翻译
  - 文件:
    - `apps/web/src/locales/en-US/common.json` — +linkType namespace（~60 keys）+ `objectType.deleteCascadeWarning`
    - `apps/web/src/locales/zh-CN/common.json` — 对应中文翻译
  - 依赖: T009–T012（确定所有 i18n key）
  - AC 覆盖: 非功能要求（i18n）

---

## Phase 7: 前端测试

- [x] **T014**: 编写前端组件测试 + 路由测试更新
  - 文件:
    - `apps/web/src/pages/link-types/__tests__/LinkTypeListPage.test.tsx` — 3 个测试（empty state、table with data、title + button）
    - `apps/web/src/pages/link-types/__tests__/CreateLinkTypeWizard.test.tsx` — 3 个测试（modal closed、step 1 cardinality、step 2 advance）
    - `apps/web/src/__tests__/router.test.tsx` — 更新：添加 link-types mock、修改断言、移除旧路由测试、新增 404 测试
  - 依赖: T011
  - AC 覆盖: AC1, AC2, AC3, AC9

---

## AC 覆盖对照

| AC | 描述 | 覆盖任务 |
|----|------|---------|
| AC1 | 3 种创建入口 | T009, T012, T014 |
| AC2 | Step 1 基数选择 | T009, T014 |
| AC3 | Step 2 OT 选择 + 自链接检查 | T004, T007, T009, T014 |
| AC4 | Step 3 名称定义 | T009 |
| AC5 | ID 格式校验 | T001, T002, T007 |
| AC6 | apiName 格式校验 | T001, T002, T007 |
| AC7 | apiName 唯一性 | T004, T007 |
| AC8 | 必填校验 | T007, T009 |
| AC9 | 列表页展示 | T010, T011, T014 |
| AC10 | 列表过滤 | T007, T011 |
| AC11 | 列表分页 | T007, T011 |
| AC12 | 侧边面板详情 | T007, T010 |
| AC13 | 可编辑字段 | T010 |
| AC14 | 不可变字段 | T010 |
| AC15 | active 状态约束 | T004, T007 |
| AC17 | 删除确认弹窗 | T010 |
| AC18 | active 不可删 | T004, T007, T010 |
| AC20 | OT 删除级联提示 | T012 |
| AC21 | 写入草稿 | T004, T005, T007 |
| AC22 | 合并视图查询 | T004, T005, T007 |
| AC23 | 变更状态标注 | T004, T005, T007 |
| AC24 | 发布写入主表 | T005, T007 |

---

## 实际偏差记录

> 本特性实际先完成了实现，后补 design.md 和 tasks.md（违反 SDD 流程）。以下记录实现与最终 plan 的偏差。

- **偏差 1**: LinkTypeListPage 的过滤在客户端通过 `useMemo` 实现（而非服务端过滤），因为 merged view 已在内存中。与 ObjectTypeListPage 保持一致。
- **偏差 2**: Router test 中 `/link-types/:rid` 改为 expect 404（因详情改为 Drawer），需要额外添加 `vi.mock('@/api/link-types')` 和 `window.matchMedia` polyfill。
- **偏差 3**: Test 中 `useLinkTypes` mock 返回值需要 `as unknown as ReturnType<typeof useLinkTypes>` 双重断言才能通过 TypeScript 检查。

---

## 会话记录

| 日期 | 完成任务 | 备注 |
|------|---------|------|
| 2026-03-02 | T001–T014 | 全部 14 个任务在一次会话中完成。后端 64 个单元测试通过（17 个新增），前端 88 个测试通过。TypeScript 编译 0 错误。|
| 2026-03-02 | design.md + tasks.md | 追溯补齐 SDD 文档。 |
