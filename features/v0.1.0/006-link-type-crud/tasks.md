# Tasks: Link Type CRUD（链接类型增删改查）— 重写版

**关联规范**: [spec.md](./spec.md)
**版本**: v0.1.0
**开始日期**: 2026-03-16

---

## 进度概览

- 总任务数: 12
- 已完成: 0 / 12
- 状态: 🔄 进行中

---

## Phase 1: 后端基础

### T01: Alembic 迁移 — 新增 JT 字段 + 约束变更

- [x] **T01**
- 文件:
  - `apps/server/alembic/versions/0007_link_type_join_table.py` — 新迁移脚本
- 内容:
  - `link_types` 表新增列 `join_table_dataset_rid VARCHAR NULLABLE`，FK → `datasets.rid` ON DELETE SET NULL
  - `link_type_endpoints` 表新增列 `join_table_column VARCHAR(255) NULLABLE`
  - 修改 `link_types.id` 的唯一约束：从全局唯一改为 `(ontology_rid, id)` 复合唯一
  - downgrade: 反向操作（删除列 + 恢复原约束）
- 依赖: 无
- 验证: `cd apps/server && PYTHONPATH=. uv run alembic upgrade head` 成功
- 覆盖 AC: 无（基础设施）

---

### T02: Domain 模型 + 校验器更新 + 单元测试

- [x] **T02**
- 文件:
  - `apps/server/app/domain/link_type.py` — 扩展枚举 + 模型字段
  - `apps/server/app/domain/validators.py` — 新增校验器
  - `apps/server/tests/unit/test_link_type_validators.py` — 更新测试
- 内容:
  - **Cardinality 枚举**: 新增 `MANY_TO_MANY = "many-to-many"`
  - **JoinMethod 枚举**: 新增 `JOIN_TABLE = "join-table"`
  - **LinkSide 模型**: 新增字段 `foreign_key_property_id: str | None = None`、`join_table_column: str | None = None`、`object_type_display_name: str | None = None`（已有则保留）
  - **LinkType 模型**: 新增字段 `join_table_dataset_rid: str | None = None`
  - **LinkTypeCreateRequest**: 新增 `join_table_dataset_rid`、`project_rid`；`LinkSideCreateInput` 新增 `foreign_key_property_id`、`join_table_column`
  - **LinkTypeUpdateRequest**: **移除 `cardinality`**（不可更新）；保留 `status`、`sideA`、`sideB` 等
  - **新增校验器** `validate_cardinality_join_method_match(cardinality, join_method)`: {1:1/1:N/N:1} → FK only；N:N → JT only。抛出 `LINK_TYPE_CARDINALITY_JOIN_METHOD_MISMATCH`
  - **单元测试**: 新增 cardinality/joinMethod 匹配测试（合法组合通过、非法组合报错）；新增 many-to-many 枚举值测试
- 依赖: 无
- 覆盖 AC: AC-08, AC-09（校验器）

---

### T03: ORM 模型 + Storage 层更新

- [x] **T03**
- 文件:
  - `apps/server/app/storage/models.py` — 扩展 ORM 模型
  - `apps/server/app/storage/link_type_storage.py` — 更新存储方法
- 内容:
  - **LinkTypeModel**: 新增 `join_table_dataset_rid = Column(String, ForeignKey("datasets.rid", ondelete="SET NULL"), nullable=True)`
  - **LinkTypeEndpointModel**: 新增 `join_table_column = Column(String(255), nullable=True)`
  - **`_to_domain()`**: 从 endpoint 提取 `foreign_key_property_id` 和 `join_table_column`；从主表提取 `join_table_dataset_rid`
  - **`create()`**: 创建时写入 `join_table_dataset_rid`、endpoint 的 `foreign_key_property_id` 和 `join_table_column`
  - **`update()`**: 支持更新 `join_table_dataset_rid`（主表）+ endpoint 的 `foreign_key_property_id`、`join_table_column`
- 依赖: T01（迁移）、T02（Domain 模型）
- 覆盖 AC: 间接支持所有后端 AC

---

### T04: Service 层更新 — JT/FK 校验 + API Name 锁定

- [x] **T04**
- 文件:
  - `apps/server/app/services/link_type_service.py` — 核心业务逻辑更新
- 内容:
  - **移除自链接检查**：删除 `LINK_TYPE_SELF_LINK_NOT_ALLOWED` 相关代码（spec D4 允许自链接）
  - **create() 新增校验**:
    1. 调用 `validate_cardinality_join_method_match()`
    2. 若 `join_method == JOIN_TABLE`：
       - 检查 `join_table_dataset_rid` 必填 → `LINK_TYPE_JOIN_TABLE_REQUIRED`
       - 检查数据集存在 → `LINK_TYPE_DATASET_NOT_FOUND`
       - 检查两端 `join_table_column` 类型与 OT 主键类型兼容 → `LINK_TYPE_JOIN_TABLE_COLUMN_TYPE_MISMATCH`
    3. 若 `join_method == FOREIGN_KEY` 且提供 `foreign_key_property_id`：
       - 检查属性在 OT 上存在 → `LINK_TYPE_FK_PROPERTY_NOT_FOUND`
       - 检查属性类型与对端 OT 主键类型兼容 → `LINK_TYPE_FK_TYPE_MISMATCH`
    4. `join_method` 根据 `cardinality` 动态设置（非硬编码 FOREIGN_KEY）
  - **update() 新增约束**:
    1. **Cardinality 不可更新**：如果请求中包含 cardinality 且与当前不同，忽略或报错
    2. **API Name 状态锁定**：如果链接类型 status == active 且请求中修改了 apiName → `LINK_TYPE_ACTIVE_CANNOT_MODIFY_API_NAME`
  - **WorkingStateService 扩展**: 确保 `_apply_link_type_change()` 正确处理新字段（join_table_dataset_rid、endpoint 的 FK/JT 字段）
- 依赖: T02（Domain）、T03（Storage）
- 覆盖 AC: AC-07, AC-10, AC-12, AC-13, AC-14, AC-22, AC-23, AC-24, AC-25, AC-28, AC-31

---

### T05: 后端集成测试更新

- [x] **T05**
- 文件:
  - `apps/server/tests/integration/test_link_type_api.py` — 扩展测试用例
- 内容:
  - **新增测试用例**:
    - `test_create_many_to_many_with_join_table`: 创建 N:N + JT 链接成功
    - `test_create_many_to_many_without_dataset_returns_400`: N:N 缺少 JT 数据集
    - `test_create_fk_with_property_mapping`: FK 带外键属性映射
    - `test_create_fk_invalid_property_returns_400`: FK 属性不存在
    - `test_create_self_link_succeeds`: 自链接允许（原有测试需反转）
    - `test_create_cardinality_method_mismatch_returns_400`: N:N + FK 不匹配
    - `test_update_cardinality_ignored`: 更新请求中的 cardinality 被忽略
    - `test_update_api_name_experimental_succeeds`: experimental 状态修改 apiName 成功
    - `test_update_api_name_active_returns_400`: active 状态修改 apiName 失败
    - `test_publish_join_table_link_type`: JT 链接类型发布后主表验证
  - **修改既有测试**:
    - `test_create_self_link_returns_400` → 改为 `test_create_self_link_succeeds`（200/201）
    - 调整 create 请求体包含 `projectRid`、`joinMethod` 字段
- 依赖: T04（Service）
- 覆盖 AC: AC-07, AC-08, AC-09, AC-10, AC-12, AC-13, AC-14, AC-22, AC-23, AC-24, AC-28, AC-31, AC-34

---

## Phase 2: 前端基础

### T06: OpenAPI 类型重生成 + API Hooks 更新

- [x] **T06**
- 文件:
  - `apps/server/openapi.json` — 重新生成
  - `apps/web/src/generated/api.ts` — 自动生成
  - `apps/web/src/api/link-types.ts` — 检查/更新 hooks
  - `apps/web/src/api/types.ts` — 检查/更新导出类型
  - `apps/web/src/stores/create-link-type-modal-store.ts` — 检查/更新
- 内容:
  - 执行 OpenAPI 生成流水线：`cd apps/server && PYTHONPATH=. uv run python -c "..."` → `cd apps/web && pnpm run generate:api`
  - 确认新增类型正确导出：`Cardinality`（含 many-to-many）、`JoinMethod`（含 join-table）
  - 确认 `LinkTypeCreateRequest` 包含 `joinTableDatasetRid`、`projectRid`、side 的 `foreignKeyPropertyId`/`joinTableColumn`
  - 确认 `LinkTypeUpdateRequest` 不含 `cardinality`
  - API hooks 无需修改（泛型足够），但需验证 TypeScript 编译通过
- 依赖: T04（后端 API 就绪）
- 覆盖 AC: 前端所有 AC 的类型基础

---

## Phase 3: 前端页面重构

### T07: LinkTypeDetailPage — 独立详情页（Overview + Datasets Tab）

- [ ] **T07**
- 文件:
  - `apps/web/src/pages/link-types/LinkTypeDetailPage.tsx` — 新建
  - `apps/web/src/pages/link-types/components/LinkTypeOverviewTab.tsx` — 新建
  - `apps/web/src/pages/link-types/components/LinkTypeDatasetsTab.tsx` — 新建
  - `apps/web/src/pages/link-types/components/LinkTypeDetailDrawer.tsx` — 删除
  - `apps/web/src/router.tsx` — 添加 `/link-types/:rid` 路由
- 内容:
  - **LinkTypeDetailPage**: 布局 = 左侧边栏（返回导航 + 链接类型 icon/名称/ID/Status badge）+ 右侧内容区（Tabs: Overview / Datasets）
  - **Overview Tab (AC-19)**:
    - 元数据区：Status（可编辑 Radio）/ ID（只读）/ RID（只读 copyable）/ Cardinality（只读 Tag）/ Join Method（只读 Tag）/ 创建修改时间
    - Side A 区：OT 名称（Link 跳转到 `/object-types/:rid`）/ Display Name（Input，onBlur 提交）/ API Name（experimental 可编辑，active 只读 + Tooltip AC-23）/ Visibility（Radio.Group，onChange 提交）
    - Side B 区：同 Side A
    - Key 配置区：FK 模式 → 显示外键属性名（可编辑 Select）/ JT 模式 → 显示列映射概要
    - 三点菜单：删除选项（复用 DeleteLinkTypeModal）
  - **Datasets Tab (AC-20)**: 仅 JT 类型显示。展示连接表数据集名称/来源/行列数 + 列映射表（数据集列 → OT 主键）+ 更换数据集按钮
  - **破坏性变更警告 (AC-26)**: Key 配置变更时，保存前弹出确认对话框
  - **路由**: `router.tsx` 添加 `{ path: 'link-types/:rid', element: <LinkTypeDetailPage /> }`
- 依赖: T06（类型就绪）
- 覆盖 AC: AC-18, AC-19, AC-20, AC-21, AC-22, AC-23, AC-24, AC-25, AC-26, AC-27, AC-28

---

### T08: LinkTypeListPage 更新 — 导航到详情页

- [ ] **T08**
- 文件:
  - `apps/web/src/pages/link-types/LinkTypeListPage.tsx` — 重构
  - `apps/web/src/pages/link-types/components/LinkTypeTable.tsx` — 更新列
- 内容:
  - **行点击**: 从 `setSearchParams({selected: rid})` 改为 `navigate(\`/link-types/${rid}\`)`
  - **移除 Drawer**: 删除 `LinkTypeDetailDrawer` 引用和 `selectedRid` 逻辑
  - **更新表格列 (AC-15)**: ID / Side A OT 名 / Side B OT 名 / Cardinality / Join Method / Status / Change State
  - **Join Method 列**: 显示 `foreign-key` 或 `join-table`（i18n 翻译）
  - **过滤器 (AC-16)**: 保持现有：objectTypeRid / status / visibility
  - **分页 (AC-17)**: 保持现有
- 依赖: T06（类型）、T07（详情页存在才能导航）
- 覆盖 AC: AC-15, AC-16, AC-17, AC-18

---

### T09: CreateLinkTypeWizard 重构 — 4 步向导 + FK/JT 分支

- [ ] **T09**
- 文件:
  - `apps/web/src/pages/link-types/components/CreateLinkTypeWizard.tsx` — 重写
  - `apps/web/src/pages/link-types/components/ForeignKeyStep.tsx` — 新建（Step 2 FK 模式）
  - `apps/web/src/pages/link-types/components/JoinTableStep.tsx` — 新建（Step 2 JT 模式）
- 内容:
  - **Step 1 — 关系类型 + 基数 (AC-02)**:
    - FK 分组（Card 样式）：One-to-One / One-to-Many / Many-to-One
    - JT 分组：Many-to-Many
    - BO 分组：置灰 + "后续版本支持" 标注
    - 选择后自动设置 `joinMethod` 字段
  - **Step 2 — 链接资源定义 (AC-03, AC-04, AC-07)**:
    - **FK 模式** (`ForeignKeyStep.tsx`):
      - 左侧：外键对象类型（可搜索 Select）→ 选中后加载其属性列表 → FK 属性选择器（Select）
      - 右侧：主键对象类型（可搜索 Select）→ 主键属性自动选中显示
      - 自动检测：如果 FK OT 某属性名/类型匹配 PK OT 的主键，自动预选
      - 自链接允许（AC-07）：两侧可选同一 OT
    - **JT 模式** (`JoinTableStep.tsx`):
      - 两侧：各一个可搜索 OT Select
      - 下方：Dataset 选择器（调用 `useDatasetsQuery`，展示可用数据集列表）
      - 选中 Dataset 后：展示列映射界面 — 两组 Select（数据集列 → Side A PK 列 / Side B PK 列）
      - 校验：列类型与 OT 主键类型匹配 (AC-13)
  - **Step 3 — 名称与标识 (AC-05)**:
    - 链接类型 ID（自动从两端 OT ID 生成，如 `employee-company`，可编辑）
    - 每端 Display Name + API Name（apiName 从 displayName 自动生成 camelCase）
    - 每端 Visibility（默认 normal）
    - Status（默认 experimental）
  - **Step 4 — 保存位置 (AC-06)**:
    - Project 选择器（默认当前 Ontology 的 project）
    - Submit 按钮
  - **创建成功后**: 跳转到新建链接类型的详情页 `/link-types/${newRid}`
  - **错误处理**: 映射后端错误码到对应表单字段（ID 冲突 → id 字段；apiName 冲突 → 对应端 apiName 字段）
- 依赖: T06（类型）
- 覆盖 AC: AC-01, AC-02, AC-03, AC-04, AC-05, AC-06, AC-07, AC-08, AC-09, AC-10, AC-11, AC-12, AC-13, AC-14

---

## Phase 4: 前端可视化

### T10: OT Overview 链接类型关系图

- [ ] **T10**
- 文件:
  - `apps/web/src/pages/object-types/components/LinkTypeGraph.tsx` — 新建
  - `apps/web/src/pages/object-types/ObjectTypeOverviewPage.tsx` — 集成图组件
- 内容:
  - **技术**: `@xyflow/react`（已在 package.json 依赖中）
  - **组件 LinkTypeGraph**:
    - Props: `objectTypeRid: string`（当前 OT）、`linkTypes: LinkTypeWithChangeState[]`
    - **节点 (AC-35)**:
      - 中心节点：当前 OT，高亮样式（品牌色背景 + icon + 名称）
      - 关联节点：通过链接类型关联的其他 OT，标准样式（灰色背景 + icon + 名称）
      - 自链接：不创建额外节点，使用环形边回到中心节点
    - **边 (AC-35)**:
      - 显示链接类型 Display Name
      - 基数图标（→ 单向 / ↔ 双向）
      - Hover Tooltip 显示：链接类型 ID、基数、连接方式、状态
    - **交互**:
      - 点击边 → `navigate(\`/link-types/${linkType.rid}\`)` (AC-36)
      - 点击 OT 节点 → `navigate(\`/object-types/${otRid}\`)` (AC-38)
      - 图支持拖拽平移 + 缩放
    - **创建入口 (AC-37)**: 图右上角"创建新链接类型"按钮 → `openCreateLinkType(currentOtRid)`
    - **超 20 条链接**: 显示前 20 条 + "查看全部"链接跳转到 `/link-types?objectTypeRid=xxx`
    - **布局算法**: 中心放射状布局（当前 OT 居中，关联 OT 环绕）
  - **ObjectTypeOverviewPage 集成**: 将现有 Link Types 表格区域替换为 `<LinkTypeGraph />` 组件
  - **调用 frontend-design skill**: 对 LinkTypeGraph 的视觉设计使用 `/frontend-design` 技能确保高质量 UI
- 依赖: T06（类型）、T08（列表页导航可用）
- 覆盖 AC: AC-35, AC-36, AC-37, AC-38

---

## Phase 5: 前端收尾

### T11: i18n 翻译更新

- [ ] **T11**
- 文件:
  - `apps/web/src/locales/en-US/common.json` — 更新翻译
  - `apps/web/src/locales/zh-CN/common.json` — 更新翻译
- 内容:
  - **新增/更新 key**:
    - `linkType.joinMethod.foreignKey` / `linkType.joinMethod.joinTable`
    - `linkType.cardinality.manyToMany`
    - `linkType.wizard.step1Title` / `step2Title` / `step3Title` / `step4Title`
    - `linkType.wizard.fkGroup` / `linkType.wizard.jtGroup` / `linkType.wizard.boGroup`
    - `linkType.wizard.fkObjectType` / `linkType.wizard.pkObjectType`
    - `linkType.wizard.selectDataset` / `linkType.wizard.columnMapping`
    - `linkType.wizard.saveLocation` / `linkType.wizard.projectSelect`
    - `linkType.detail.overviewTab` / `linkType.detail.datasetsTab`
    - `linkType.detail.keyConfig` / `linkType.detail.replaceDataset`
    - `linkType.detail.cannotModifyApiNameActive` — "活跃状态的链接类型不可修改 API Name"
    - `linkType.detail.breakingChangeWarning` — "此操作可能影响依赖此链接类型的应用"
    - `linkType.graph.title` / `linkType.graph.createNew` / `linkType.graph.viewAll`
    - 错误码翻译：`LINK_TYPE_JOIN_TABLE_REQUIRED`、`LINK_TYPE_DATASET_NOT_FOUND`、`LINK_TYPE_FK_PROPERTY_NOT_FOUND`、`LINK_TYPE_FK_TYPE_MISMATCH`、`LINK_TYPE_JOIN_TABLE_COLUMN_TYPE_MISMATCH`、`LINK_TYPE_CARDINALITY_JOIN_METHOD_MISMATCH`、`LINK_TYPE_ACTIVE_CANNOT_MODIFY_API_NAME`
  - **移除过时 key**: `linkType.selfLinkError`（自链接不再报错）
- 依赖: T07–T10（确定所有 i18n key）
- 覆盖 AC: 非功能要求（i18n）

---

### T12: 前端测试 + 路由更新

- [ ] **T12**
- 文件:
  - `apps/web/src/pages/link-types/__tests__/LinkTypeListPage.test.tsx` — 更新
  - `apps/web/src/pages/link-types/__tests__/CreateLinkTypeWizard.test.tsx` — 更新
  - `apps/web/src/pages/link-types/__tests__/LinkTypeDetailPage.test.tsx` — 新建
  - `apps/web/src/__tests__/router.test.tsx` — 更新路由测试
- 内容:
  - **LinkTypeListPage 测试更新**:
    - 行点击导航到 `/link-types/:rid`（非 Drawer）
    - 表格包含 Join Method 列
  - **CreateLinkTypeWizard 测试更新**:
    - Step 1 包含 many-to-many 选项
    - Step 2 FK 模式：OT 选择 + FK 属性选择
    - Step 2 JT 模式：OT 选择 + Dataset 选择
    - 自链接允许
  - **LinkTypeDetailPage 测试（新建）**:
    - 渲染 Overview Tab（元数据 + 两端信息 + Key 配置）
    - Datasets Tab 仅 JT 类型显示
    - experimental 状态 apiName 可编辑
    - active 状态 apiName 只读
    - 删除按钮逻辑
  - **Router 测试更新**:
    - `/link-types/:rid` 路由正确加载 LinkTypeDetailPage
    - 移除旧 Drawer 相关断言
  - **验证**: `cd apps/web && pnpm test --run` 全部通过
- 依赖: T07–T11（所有前端组件就绪）
- 覆盖 AC: AC-01, AC-02, AC-03, AC-04, AC-07, AC-15, AC-18, AC-19, AC-22, AC-23

---

## AC 覆盖对照

| AC | 描述 | 覆盖任务 |
|----|------|---------|
| AC-01 | 3 种创建入口 | T09, T10, T12 |
| AC-02 | Step 1 关系类型+基数选择 | T09, T12 |
| AC-03 | Step 2 FK 模式 | T04, T05, T09, T12 |
| AC-04 | Step 2 JT 模式 | T04, T05, T09, T12 |
| AC-05 | Step 3 名称定义 | T09 |
| AC-06 | Step 4 保存位置 | T09 |
| AC-07 | 自链接允许 | T04, T05, T09, T12 |
| AC-08 | ID 格式校验 | T02, T05 |
| AC-09 | apiName 格式校验 | T02, T05 |
| AC-10 | apiName 唯一性 | T04, T05 |
| AC-11 | 必填校验 | T09 |
| AC-12 | N:N 缺少 JT 数据集 | T04, T05, T09 |
| AC-13 | JT 列类型不兼容 | T04, T05, T09 |
| AC-14 | FK 属性类型不兼容 | T04, T05 |
| AC-15 | 列表页展示 | T08, T12 |
| AC-16 | 列表过滤 | T08 |
| AC-17 | 列表分页 | T08 |
| AC-18 | 详情页跳转 | T07, T08, T12 |
| AC-19 | Overview Tab | T07, T12 |
| AC-20 | Datasets Tab | T07 |
| AC-21 | 可编辑字段 | T07 |
| AC-22 | experimental apiName 可编辑 | T04, T05, T07, T12 |
| AC-23 | active apiName 只读 | T04, T05, T07, T12 |
| AC-24 | 不可变字段 | T04, T07 |
| AC-25 | active 后 apiName 锁定 | T04, T07 |
| AC-26 | 破坏性变更警告 | T07 |
| AC-27 | 删除确认弹窗 | T07 |
| AC-28 | active 不可删 | T04, T05, T07 |
| AC-29 | 删除不影响 OT | T05 |
| AC-30 | OT 删除级联 | T04 |
| AC-31 | 写入草稿 | T04, T05 |
| AC-32 | 合并视图 | T04, T05 |
| AC-33 | 变更状态标注 | T04, T05 |
| AC-34 | 发布写入主表 | T04, T05 |
| AC-35 | 链接类型关系图 | T10 |
| AC-36 | 图中点击边跳转 | T10 |
| AC-37 | 图中创建链接类型 | T10 |
| AC-38 | 图中点击 OT 节点 | T10 |
