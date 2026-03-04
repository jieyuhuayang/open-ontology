# Tasks: Object Type CRUD（对象类型增删改查）— Phase 2

**关联规范**: [spec.md](./spec.md)
**技术方案**: [design.md](./design.md)
**版本**: v0.1.0

---

## Phase 1 状态

Phase 1（ObjectType CRUD + WorkingState + 变更合并）已于 2026-02-28 完成，共 10 个任务全部通过。详见 git 历史中的原始 tasks.md。

---

## Phase 2 进度概览

- 总任务数: 26（后端 T001–T016，前端 T017–T026）
- 已完成: 10 / 26（T001–T005, T008–T011, T016 部分 — 由 010-data-connection 已有代码覆盖）
- 剩余待实现: 16（T006–T007, T012–T015, T016 集成测试, T017–T026）
- 状态: 🔧 实现中

> **2026-03-04 更新**：经审查，010-data-connection 后端已有代码覆盖了 003 Phase 2 中的 Dataset 相关后端任务。
> 详见下方各任务的标记说明。

---

## 开发模式

**Test-First（奇数测试，偶数实现）**：每组先写测试（红），再写实现（绿）。基础设施任务（配置、迁移、ORM、类型生成、i18n）无测试配对。

---

## 后端任务（T001–T016）

### Group 1: 基础设施（T001–T003，无测试配对）

- [x] **T001**: 配置 + 依赖 — ✅ 已由 010-data-connection 覆盖
  - `python-multipart` 已安装；`aiomysql`、`openpyxl`、`xlrd`、`cryptography` 等依赖已添加
  - 依赖: 无

- [x] **T002**: Alembic 迁移 — ✅ 已由 010-data-connection 覆盖
  - `alembic/versions/0004_add_dataset_and_import_tables.py` 已包含 `datasets`、`dataset_columns`、`dataset_rows`、`mysql_connections` 4 张表 + `object_types` 表扩展（`intended_actions`、`backing_datasource`、`primary_key_property_id`、`title_key_property_id`）
  - 依赖: T001

- [x] **T003**: ORM 模型 — ✅ 已由 010-data-connection 覆盖
  - `DatasetModel`、`DatasetColumnModel`、`DatasetRowModel`、`MySQLConnectionModel` 已在 `storage/models.py` 中定义
  - `ObjectTypeModel` 已新增 Phase 2 列
  - 依赖: T002

---

### Group 2: Domain 模型（T004–T005）

- [x] **T004**: Domain 模型测试 — ✅ 已由 010-data-connection 覆盖
  - `tests/unit/test_domain_models_phase2.py` 中 Dataset/DatasetColumn/DatasetListItem 测试已有
  - `validate_intended_actions` 仍需补充（属于 003 OT 侧逻辑，在 T006/T007 中处理）
  - 依赖: 无

- [x] **T005**: Domain 模型实现 — ✅ 已由 010-data-connection 覆盖
  - `app/domain/dataset.py` 已实现 Dataset, DatasetColumn, DatasetListItem, DatasetListResponse, DatasetPreviewResponse
  - 依赖: 无

---

### Group 3: ObjectType 模型修改（T006–T007）

- [ ] **T006**: OT 模型修改测试
  - 文件: `apps/server/tests/unit/test_object_type_model_phase2.py`
  - 内容:
    - `ObjectTypeCreateRequest` 全字段可选（display_name 可空）、新增 `intended_actions`/`backing_datasource_rid`/`project_rid`
    - `ObjectTypeUpdateRequest` 新增 `intended_actions`/`backing_datasource_rid`/`primary_key_property_id`/`title_key_property_id`
    - `ObjectType` 新增 `intended_actions` 字段
  - 依赖: 无
  - AC 覆盖: AC-W4（任意步骤退出创建）

- [ ] **T007**: OT 模型修改
  - 文件: `apps/server/app/domain/object_type.py`
  - 内容:
    - `ObjectTypeCreateRequest`: `display_name` 改为 `Optional[str] = None`，新增 `intended_actions`, `backing_datasource_rid`, `project_rid`
    - `ObjectTypeUpdateRequest`: 新增 `intended_actions`, `backing_datasource_rid`, `primary_key_property_id`, `title_key_property_id`
    - `ObjectType`: 新增 `intended_actions: list[str] = []`
  - 依赖: 无
  - 验证: T006 全部测试通过

---

### Group 4: Storage 层（T008–T009）

- [x] **T008**: DatasetStorage 测试 — ✅ 已由 010-data-connection 覆盖
  - `tests/unit/test_dataset_storage.py` 已覆盖 list_by_ontology、get_by_rid、get_preview、create、delete
  - 依赖: T003、T005

- [x] **T009**: DatasetStorage 实现 — ✅ 已由 010-data-connection 覆盖
  - `app/storage/dataset_storage.py` 已实现 list_by_ontology、get_by_rid、get_preview、create、delete
  - 依赖: T003、T005

---

### Group 5: DatasetService（T010–T011）

- [x] **T010**: DatasetService 测试 — ✅ 已由 010-data-connection 覆盖
  - `tests/unit/test_dataset_service.py` 已覆盖 in_use 合并计算、delete 保护、list with in-use 标记
  - 依赖: T009、T005

- [x] **T011**: DatasetService 实现 — ✅ 已由 010-data-connection 覆盖
  - `app/services/dataset_service.py` 已实现 list、get_by_rid、get_preview、delete（含 in_use 保护）
  - 依赖: T009

---

### Group 6: OT Service 修改（T012–T013）

- [ ] **T012**: OT Service 修改测试
  - 文件: `apps/server/tests/unit/test_object_type_service_phase2.py`
  - 内容:
    - 占位名生成 `"Untitled Object Type xxxx"` 格式
    - ID 自动推断（display_name → kebab-case）
    - API Name 自动推断（display_name → PascalCase）
    - 不完整创建场景（空 body / 仅 displayName / 含新字段 backing_datasource_rid + intended_actions）
    - 唯一性冲突追加随机后缀
    - active 状态删除拒绝（已发布 + WS 草稿两种场景）
  - 依赖: T007（OT 模型修改）、T009（DatasetStorage）
  - AC 覆盖: AC-W4（任意步骤退出）、AC-W5（自动推断）、AC-DEL3（active 不可删除）

- [ ] **T013**: OT Service 修改实现
  - 文件: `apps/server/app/services/object_type_service.py`
  - 内容:
    - `create()` 支持不完整创建 + 自动推断 + backing_datasource + intended_actions + project_rid
    - `update()` 新增字段处理
    - `delete()` 新增 active 状态校验
    - 新增辅助方法: `_generate_placeholder_name()`, `_auto_infer_id()`, `_auto_infer_api_name()`, `_ensure_unique()`
  - 依赖: T007、T009
  - 验证: T012 全部测试通过

---

### Group 7: WS 校验（T014–T015）

- [ ] **T014**: 完整性 + 兼容性校验测试
  - 文件: `apps/server/tests/unit/test_completeness_validation.py`
  - 内容:
    - 完整性校验 7 项条件：各缺一、多缺、全满足通过
    - DELETE 类型变更跳过校验
    - 类型兼容性矩阵测试（string 兼容所有、integer↔short、timestamp↔date 等）
    - 不兼容时 details 含 propertyId/propertyType/columnType
  - 依赖: T009（DatasetStorage）、T007（OT 模型）
  - AC 覆盖: AC-V4（完整性校验）、AC-V6（类型兼容性）

- [ ] **T015**: WS Service 修改
  - 文件: `apps/server/app/services/working_state_service.py`
  - 内容:
    - `publish()` 新增 `_validate_completeness()` + `_validate_type_compatibility()`
    - `_apply_object_type_change()` 的 `key_map` 新增 4 字段: `intendedActions`, `backingDatasource`, `primaryKeyPropertyId`, `titleKeyPropertyId`
  - 依赖: T009、T007
  - 验证: T014 全部测试通过

---

### Group 8: Dataset Router + 注册 + 集成测试（T016）

- [ ] **T016**: Dataset Router + 注册 + openapi.json + 集成测试
  - 文件:
    - `apps/server/app/routers/datasets.py` — GET /datasets（列表含 in-use）、GET /datasets/{rid}（详情含 columns）
    - `apps/server/app/main.py` — 注册 `datasets.router`
    - `apps/server/openapi.json` — 重新生成
    - `apps/server/tests/integration/test_dataset_api.py` — Dataset 列表（含 in-use 合并计算标记）
    - `apps/server/tests/integration/test_incomplete_object_type.py` — 不完整创建 + 补全 + 发布完整性校验 + 类型兼容性校验
  - 依赖: T011、T013、T015
  - AC 覆盖: AC-DS1~DS5、AC-MC5~MC6、AC-V4、AC-V6

---

## 前端任务（T017–T026）

### Group 9: 类型生成 + API Hooks（T017–T018，基础设施无测试配对）

- [ ] **T017**: OpenAPI 类型重新生成 + 类型导出
  - 文件:
    - `apps/web/src/generated/api.ts` — 重新生成（`npx openapi-typescript`）
    - `apps/web/src/api/types.ts` — 追加 Dataset 相关类型
  - 依赖: T016（后端 openapi.json 已更新）

- [ ] **T018**: Dataset API Hooks
  - 文件:
    - `apps/web/src/api/datasets.ts` — queryKeys + `useDatasets(search?)`, `useDataset(rid)`
  - 依赖: T017

---

### Group 10: 状态管理 + i18n（T019–T020，基础设施）

- [ ] **T019**: Wizard Zustand Store
  - 文件: `apps/web/src/stores/create-wizard-store.ts`
  - 内容:
    - 替代 `create-object-type-modal-store.ts`
    - 5 步导航（currentStep 0-4）、步骤前进/后退
    - Step 1: selectedDatasetRid
    - Step 2: displayName, description, icon, objectTypeId
    - Step 3: properties（WizardProperty[]）
    - Step 4: intendedActions
    - Step 5: projectRid
    - open() / close() / reset() actions
  - 依赖: 无

- [ ] **T020**: i18n 翻译
  - 文件:
    - `apps/web/src/locales/en-US/common.json` — 追加 wizard.*, dataset.*, step.* 命名空间
    - `apps/web/src/locales/zh-CN/common.json` — 对应中文翻译
  - 依赖: 无

---

### Group 11: 创建向导 Shell（T021–T022）

- [ ] **T021**: 向导 Shell 测试
  - 文件: `apps/web/src/pages/object-types/__tests__/CreateObjectTypeWizard.test.tsx`
  - 内容:
    - Stepper 渲染 5 个步骤（Datasource / Metadata / Properties / Actions / Save Location）
    - 步骤导航（Next/Previous 按钮）
    - 已完成步骤标记（✓ 图标）
    - 最低要求未满足时 Next 按钮置灰
    - 任意步骤退出触发创建（调用 POST /object-types）
  - 依赖: T019（Wizard Store）
  - AC 覆盖: AC-W1~W4

- [ ] **T022**: 向导 Shell 实现
  - 文件:
    - `apps/web/src/pages/object-types/components/CreateObjectTypeWizard.tsx` — 新建（Modal + Ant Design Steps + 步骤路由）
    - `apps/web/src/pages/object-types/components/CreateObjectTypeModal.tsx` — 删除
    - `apps/web/src/components/CreateMenu.tsx` — 更新引用
    - `apps/web/src/layouts/HomeLayout.tsx` — 更新引用
  - 依赖: T019、T020
  - 验证: T021 全部测试通过

---

### Group 12: Step 1 — 数据源选择（T023）

- [ ] **T023**: 数据源选择（测试 + 实现）
  - 测试文件: `apps/web/src/pages/object-types/__tests__/WizardStepDatasource.test.tsx`
  - 实现文件: `apps/web/src/pages/object-types/components/WizardStepDatasource.tsx`
  - 测试内容:
    - Dataset 列表渲染（名称 / 来源 / 行数 / 列数 / 导入时间）
    - In-use 标记（被占用的 Dataset 标注 OT 名称）
    - 搜索过滤
    - 选中后展示 DatasetPreview（列结构 + 前 5 行）
    - "Continue without datasource" 按钮存在且可点击
  - 实现内容:
    - 内含 DatasetList + DatasetPreview 子组件
    - "Use this Dataset" 确认按钮
    - "Continue without datasource" 按钮
  - 依赖: T018（API Hooks）、T022（向导 Shell）
  - AC 覆盖: AC-DS1~DS5

---

### Group 13: Step 2–5 向导步骤（T024）

- [ ] **T024**: Step 2–5（测试 + 实现）
  - 测试文件: `apps/web/src/pages/object-types/__tests__/WizardSteps.test.tsx`
  - 实现文件:
    - `apps/web/src/pages/object-types/components/WizardStepMetadata.tsx` — 新建
    - `apps/web/src/pages/object-types/components/WizardStepProperties.tsx` — 新建（DatasourceColumnPane + PropertyPane）
    - `apps/web/src/pages/object-types/components/WizardStepActions.tsx` — 新建
    - `apps/web/src/pages/object-types/components/WizardStepSaveLocation.tsx` — 新建
  - 测试内容:
    - **Metadata (Step 2)**: Icon 选择器、displayName 必填、ID 从 displayName 自动推断（kebab-case）、可手动编辑
    - **Properties (Step 3)**: 左右分栏布局、添加列映射、手动添加属性、PK/TK 必须各设置一个
    - **Actions (Step 4)**: 3 个 Checkbox（Create/Modify/Delete）、无必填限制
    - **Save Location (Step 5)**: Project 下拉选择、单 Project 自动选中
  - 依赖: T022（向导 Shell）
  - AC 覆盖: AC-MD1~MD4、AC-PR1~PR10、AC-AT1~AT4、AC-SL1~SL3

---

### Group 14: 编辑页修改 + 组件更新（T025）

- [ ] **T025**: 编辑页修改 + 组件更新（测试 + 实现）
  - 测试文件: `apps/web/src/pages/object-types/__tests__/ObjectTypeEditPages.test.tsx`
  - 实现文件:
    - `apps/web/src/pages/object-types/ObjectTypeOverviewPage.tsx` — 新增 backing datasource 区域、属性映射入口、incomplete 提示
    - `apps/web/src/pages/object-types/components/MetadataSection.tsx` — 新增 Status/Visibility 下拉、intended_actions 展示
    - `apps/web/src/pages/object-types/ObjectTypeDetailLayout.tsx` — Active 状态删除置灰
    - `apps/web/src/pages/object-types/components/DeleteObjectTypeModal.tsx` — Active 置灰 Tooltip
    - `apps/web/src/components/HomeSidebar.tsx` — Incomplete OT 标记
  - 测试内容:
    - Overview 页 MetadataSection: Status/Visibility 下拉
    - 无 backing datasource 时显示 "Add a backing datasource" 提示
    - intended_actions 展示
    - Active 状态删除按钮置灰 + Tooltip 提示
  - 依赖: T018（API Hooks）、T022（向导 Shell）
  - AC 覆盖: AC-MC1~MC6、AC-ED1~ED5、AC-DEL3

---

### Group 15: 前端集成验证（T026）

- [ ] **T026**: TypeScript 编译验证 + 全量测试 + 端到端流程验证
  - 内容:
    - `npx tsc --noEmit` 无类型错误
    - 更新受影响的现有测试（mock 数据、import 路径等）
    - `npx vitest run` 全部通过
    - 向导创建完整流程（5 步走完 → 创建成功）
    - 不完整创建 + 编辑页补全
    - 删除（active 状态限制验证）
    - 草稿暂存提示
  - 依赖: T023、T024、T025

---

## 依赖关系

```
后端:
T001 → T002 → T003
T004 → T005 (domain models)
T006 → T007 (OT model)
T008 → T009 (dataset storage, depends on T003+T005)
T010 → T011 (dataset service, depends on T009)
T012 → T013 (OT service, depends on T007+T009)
T014 → T015 (WS validation, depends on T009+T007)
T016 (router + integration, depends on T011+T013+T015)

前端:
T017 (types, depends on T016 backend openapi)
T018 (API hooks, depends on T017)
T019-T020 (store + i18n, no backend dependency)
T021-T022 (wizard shell, depends on T019+T020)
T023 (Step 1, depends on T018+T022)
T024 (Steps 2-5, depends on T022)
T025 (edit page, depends on T018+T022)
T026 (final validation, depends on T023+T024+T025)
```

---

## 验证方式

全部任务完成后：

```bash
# 后端
cd apps/server && uv run pytest tests/ -v                    # 全部测试通过
cd apps/server && uv run alembic upgrade head                # 迁移成功

# 前端
cd apps/web && npx tsc --noEmit                              # 无类型错误
cd apps/web && npx vitest run                                # 全部测试通过
```
