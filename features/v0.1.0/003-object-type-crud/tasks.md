# Tasks: Object Type CRUD（对象类型增删改查）— Phase 2

**关联规范**: [spec.md](./spec.md)
**技术方案**: [design.md](./design.md)
**版本**: v0.1.0

---

## Phase 1 状态

Phase 1（ObjectType CRUD + WorkingState + 变更合并）已于 2026-02-28 完成，共 10 个任务全部通过。详见 git 历史中的原始 tasks.md。

---

## Phase 2 进度概览

- 总任务数: 58（后端 T001–T038，前端 T039–T058）
- 已完成: 0 / 58
- 状态: 🆕 待实现

---

## 开发模式

**Test-First（奇数测试，偶数实现）**：每组先写测试（红），再写实现（绿）。基础设施任务（配置、迁移、ORM、类型生成、i18n）无测试配对。

---

## 后端任务（T001–T038）

### Group 1: 基础设施（T001–T003，无测试配对）

- [ ] **T001**: 配置 + 依赖
  - 文件:
    - `apps/server/app/config.py` — 新增 `ENCRYPTION_KEY`, `UPLOAD_TEMP_DIR`, `UPLOAD_MAX_SIZE_MB`, `UPLOAD_TOKEN_TTL_MINUTES`
    - `apps/server/pyproject.toml` — 新增 `aiomysql`, `openpyxl`, `python-calamine`, `cryptography`, `python-multipart`
  - 完成后执行 `uv sync`
  - 依赖: 无

- [ ] **T002**: Alembic 迁移
  - 文件: `apps/server/alembic/versions/0004_add_dataset_and_import_tables.py`
  - 内容:
    - 新建 `datasets` 表（rid PK, name, source_type, source_metadata JSONB, row_count, column_count, status, ontology_rid FK, timestamps）
    - 新建 `dataset_columns` 表（rid PK, dataset_rid FK, name, inferred_type, column_index）
    - 新建 `dataset_rows` 表（dataset_rid + row_index 复合 PK, data JSONB）
    - 新建 `mysql_connections` 表（rid PK, name, host, port, database, username, encrypted_password, ontology_rid FK, last_used_at, timestamps）
    - `object_types` 表新增 `intended_actions` JSONB 列
  - 依赖: T001

- [ ] **T003**: ORM 模型
  - 文件: `apps/server/app/storage/models.py`
  - 内容:
    - 新增 `DatasetModel`, `DatasetColumnModel`, `DatasetRowModel`, `MySQLConnectionModel`
    - `ObjectTypeModel` 新增 `intended_actions` 列
  - 依赖: T002

---

### Group 2: 类型映射（T004–T005）

- [ ] **T004**: 类型映射单元测试
  - 文件: `apps/server/tests/unit/test_type_mapping.py`
  - 内容:
    - MySQL 类型映射测试（30+ MySQL 类型 → PropertyBaseType，按 PRD §8.7 规则）
    - Excel/CSV 类型推断测试（integer/double/date/timestamp/boolean/string、5% 容错阈值、回退 string）
  - 依赖: 无
  - AC 覆盖: AC-V6（类型兼容性基础）

- [ ] **T005**: 类型映射实现
  - 文件: `apps/server/app/domain/type_mapping.py`
  - 内容:
    - `MYSQL_TYPE_MAP: dict[str, str]` — MySQL 类型到 PropertyBaseType 的映射
    - `mysql_type_to_property_type(mysql_type: str) -> str` — MySQL 类型映射函数
    - `infer_column_type(values: list[str]) -> str` — Excel/CSV 列类型推断（采样前 1000 行，5% 容错）
  - 依赖: 无
  - 验证: T004 全部测试通过

---

### Group 3: Domain 模型（T006–T007）

- [ ] **T006**: Domain 模型测试
  - 文件: `apps/server/tests/unit/test_domain_models_phase2.py`
  - 内容:
    - Dataset / DatasetColumn / DatasetListItem 序列化、默认值（status='ready'）
    - MySQLConnection 响应不含密码（encrypted_password 排除）
    - ImportTask 状态枚举（pending/running/completed/failed）、默认值
    - `validate_intended_actions` 校验（有效值 create/modify/delete、无效值抛错）
  - 依赖: 无

- [ ] **T007**: Domain 模型实现
  - 文件:
    - `apps/server/app/domain/dataset.py` — Dataset, DatasetColumn, DatasetListItem, DatasetCreateInternal
    - `apps/server/app/domain/mysql_connection.py` — MySQLConnection, MySQLConnectionCreateRequest, MySQLConnectionTestRequest
    - `apps/server/app/domain/import_task.py` — ImportTask, ImportTaskStatus 枚举
    - `apps/server/app/domain/validators.py` — 新增 `validate_intended_actions()`
  - 依赖: 无
  - 验证: T006 全部测试通过

---

### Group 4: ObjectType 模型修改（T008–T009）

- [ ] **T008**: OT 模型修改测试
  - 文件: `apps/server/tests/unit/test_object_type_model_phase2.py`
  - 内容:
    - `ObjectTypeCreateRequest` 全字段可选（display_name 可空）、新增 `intended_actions`/`backing_datasource_rid`/`project_rid`
    - `ObjectTypeUpdateRequest` 新增 `intended_actions`/`backing_datasource_rid`/`primary_key_property_id`/`title_key_property_id`
    - `ObjectType` 新增 `intended_actions` 字段
  - 依赖: 无

- [ ] **T009**: OT 模型修改
  - 文件: `apps/server/app/domain/object_type.py`
  - 内容:
    - `ObjectTypeCreateRequest`: `display_name` 改为 `Optional[str] = None`，新增 `intended_actions`, `backing_datasource_rid`, `project_rid`
    - `ObjectTypeUpdateRequest`: 新增 `intended_actions`, `backing_datasource_rid`, `primary_key_property_id`, `title_key_property_id`
    - `ObjectType`: 新增 `intended_actions: list[str] = []`
  - 依赖: 无
  - 验证: T008 全部测试通过

---

### Group 5: CryptoService（T010–T011）

- [ ] **T010**: 加密测试
  - 文件: `apps/server/tests/unit/test_crypto_service.py`
  - 内容:
    - encrypt → decrypt 往返一致
    - 加密结果为 Base64 字符串
    - 不同明文产生不同密文
    - 密钥缺失时自动生成（开发模式）
  - 依赖: T001（cryptography 依赖）

- [ ] **T011**: 加密实现
  - 文件: `apps/server/app/services/crypto_service.py`
  - 内容:
    - 使用 `cryptography.fernet.Fernet` 实现 AES-256 对称加密
    - `encrypt(plaintext: str) -> str` / `decrypt(ciphertext: str) -> str`
    - 密钥从 `config.ENCRYPTION_KEY` 读取
  - 依赖: T001
  - 验证: T010 全部测试通过

---

### Group 6: ImportTaskService（T012–T013）

- [ ] **T012**: 任务服务测试
  - 文件: `apps/server/tests/unit/test_import_task_service.py`
  - 内容:
    - `create_task()` 返回唯一 task_id
    - `get_task()` 返回正确状态
    - `update_status()` 状态转换（pending→running→completed/failed）
    - 过期任务自动清理（TTL 1 小时）
  - 依赖: T007（ImportTask 模型）

- [ ] **T013**: 任务服务实现
  - 文件: `apps/server/app/services/import_task_service.py`
  - 内容:
    - 内存存储 `_tasks: dict[str, ImportTask]`
    - `create_task()` / `get_task(task_id)` / `update_status(task_id, status, **kwargs)`
    - `_cleanup_expired()` 清理 TTL > 1 小时的任务
  - 依赖: T007
  - 验证: T012 全部测试通过

---

### Group 7: Storage 层（T014–T017）

- [ ] **T014**: DatasetStorage 测试
  - 文件: `apps/server/tests/unit/test_dataset_storage.py`
  - 内容:
    - `_to_domain()` ORM→Domain 转换（字段映射完整性、columns 关联加载）
    - `_to_list_item()` 列表项转换（不含 rows）
  - 依赖: T003（ORM 模型）、T007（Domain 模型）

- [ ] **T015**: DatasetStorage 实现
  - 文件: `apps/server/app/storage/dataset_storage.py`
  - 内容:
    - `list_by_ontology(ontology_rid, search?)` — 列表查询，过滤 status='ready'
    - `get_by_rid(rid)` — 详情含 columns
    - `get_preview(rid, limit)` — 返回前 N 行
    - `create(dataset, columns, rows)` — 批量写入
    - `delete(rid)` — 级联删除 columns + rows
  - 依赖: T003、T007
  - 验证: T014 全部测试通过

- [ ] **T016**: MySQLConnectionStorage 测试
  - 文件: `apps/server/tests/unit/test_mysql_connection_storage.py`
  - 内容:
    - `_to_domain()` ORM→Domain 转换（encrypted_password 保留在内部、响应排除）
    - `list_by_ontology()` 排序逻辑
  - 依赖: T003、T007

- [ ] **T017**: MySQLConnectionStorage 实现
  - 文件: `apps/server/app/storage/mysql_connection_storage.py`
  - 内容:
    - `list_by_ontology(ontology_rid)` — 列表查询
    - `get_by_rid(rid)` — 详情（含 encrypted_password，供服务端解密）
    - `create(connection)` — 创建
    - `update_last_used(rid)` — 更新 last_used_at
  - 依赖: T003、T007
  - 验证: T016 全部测试通过

---

### Group 8: DatasetService（T018–T019）

- [ ] **T018**: DatasetService 测试
  - 文件: `apps/server/tests/unit/test_dataset_service.py`
  - 内容:
    - `is_in_use()` 合并计算（已发布 OT backing_datasource + WS CREATE/UPDATE 变更，排除 DELETE）
    - `get_in_use_map()` 批量版本返回 `{dataset_rid: object_type_display_name}`
    - `list()` 含 in-use 标记
    - `delete()` in-use → 403 拒绝
    - `get_preview()` 返回前 N 行
  - 依赖: T015（DatasetStorage）、T007（Domain 模型）

- [ ] **T019**: DatasetService 实现
  - 文件: `apps/server/app/services/dataset_service.py`
  - 内容: 见 design.md §DatasetService
  - 依赖: T015
  - 验证: T018 全部测试通过

---

### Group 9: OT Service 修改（T020–T021）

- [ ] **T020**: OT Service 修改测试
  - 文件: `apps/server/tests/unit/test_object_type_service_phase2.py`
  - 内容:
    - 占位名生成 `"Untitled Object Type xxxx"` 格式
    - ID 自动推断（display_name → kebab-case）
    - API Name 自动推断（display_name → PascalCase）
    - 不完整创建场景（空 body / 仅 displayName / 含新字段 backing_datasource_rid + intended_actions）
    - 唯一性冲突追加随机后缀
    - active 状态删除拒绝（已发布 + WS 草稿两种场景）
  - 依赖: T009（OT 模型修改）、T015（DatasetStorage）

- [ ] **T021**: OT Service 修改实现
  - 文件: `apps/server/app/services/object_type_service.py`
  - 内容:
    - `create()` 支持不完整创建 + 自动推断 + backing_datasource + intended_actions + project_rid
    - `update()` 新增字段处理
    - `delete()` 新增 active 状态校验
    - 新增辅助方法: `_generate_placeholder_name()`, `_auto_infer_id()`, `_auto_infer_api_name()`, `_ensure_unique()`
  - 依赖: T009、T015
  - 验证: T020 全部测试通过

---

### Group 10: MySQLImportService（T022–T023）

- [ ] **T022**: MySQL 导入测试
  - 文件: `apps/server/tests/unit/test_mysql_import_service.py`
  - 内容:
    - `save_connection()` 密码加密存储
    - `list_connections()` 返回列表（不含密码）
    - `test_connection()` 成功/失败（422 错误格式）
    - 复用已有连接下拉
    - `browse_tables()` / `get_table_columns()` / `preview_table()` 使用已保存连接
    - `start_import()` 返回 task_id
  - 依赖: T011（CryptoService）、T013（ImportTaskService）、T017（MySQLConnectionStorage）、T015（DatasetStorage）、T005（类型映射）

- [ ] **T023**: MySQL 导入实现
  - 文件: `apps/server/app/services/mysql_import_service.py`
  - 内容: 见 design.md §MySQLImportService
  - 依赖: T011、T013、T017、T015、T005
  - 验证: T022 全部测试通过

---

### Group 11: FileImportService（T024–T025）

- [ ] **T024**: 文件导入测试
  - 文件: `apps/server/tests/unit/test_file_import_service.py`
  - 内容:
    - `upload_and_preview()` CSV 正常解析、XLSX 正常解析、文件过大（50MB）→ 400、格式不支持 → 400
    - `confirm_import()` 成功创建 Dataset、token 过期 → 400、hasHeader=false 处理、columnTypeOverrides 应用
  - 依赖: T005（类型映射）、T013（ImportTaskService）、T015（DatasetStorage）

- [ ] **T025**: 文件导入实现
  - 文件: `apps/server/app/services/file_import_service.py`
  - 内容: 见 design.md §FileImportService
  - 依赖: T005、T013、T015
  - 验证: T024 全部测试通过

---

### Group 12: WS 校验（T026–T027）

- [ ] **T026**: 完整性 + 兼容性校验测试
  - 文件: `apps/server/tests/unit/test_completeness_validation.py`
  - 内容:
    - 完整性校验 7 项条件：各缺一、多缺、全满足通过
    - DELETE 类型变更跳过校验
    - 类型兼容性矩阵测试（string 兼容所有、integer↔short、timestamp↔date 等）
    - 不兼容时 details 含 propertyId/propertyType/columnType
  - 依赖: T015（DatasetStorage）、T009（OT 模型）

- [ ] **T027**: WS Service 修改
  - 文件: `apps/server/app/services/working_state_service.py`
  - 内容:
    - `publish()` 新增 `_validate_completeness()` + `_validate_type_compatibility()`
    - `_apply_object_type_change()` 的 `key_map` 新增 4 字段: `intendedActions`, `backingDatasource`, `primaryKeyPropertyId`, `titleKeyPropertyId`
  - 依赖: T015、T009
  - 验证: T026 全部测试通过

---

### Group 13: Dataset Router（T028–T029）

- [ ] **T028**: Dataset Router 测试
  - 文件: `apps/server/tests/unit/test_dataset_router.py`
  - 内容:
    - GET /datasets 列表（含 search 参数、in-use 标记）
    - GET /datasets/{rid} 详情
    - GET /datasets/{rid}/preview 数据预览
    - DELETE /datasets/{rid} 删除（in-use → 403）
  - 依赖: T019（DatasetService）

- [ ] **T029**: Dataset Router 实现
  - 文件: `apps/server/app/routers/datasets.py`
  - 内容: 见 design.md §Dataset Router
  - 依赖: T019
  - 验证: T028 全部测试通过

---

### Group 14: MySQL Router（T030–T031）

- [ ] **T030**: MySQL Router 测试
  - 文件: `apps/server/tests/unit/test_mysql_connections_router.py`
  - 内容:
    - GET /mysql-connections 列表
    - POST /mysql-connections 保存连接
    - POST /mysql-connections/test 测试连接（成功/失败 422）
    - GET /mysql-connections/{rid}/tables 浏览表
    - GET /mysql-connections/{rid}/tables/{table}/columns 列结构
    - GET /mysql-connections/{rid}/tables/{table}/preview 预览
  - 依赖: T023（MySQLImportService）

- [ ] **T031**: MySQL Router 实现
  - 文件: `apps/server/app/routers/mysql_connections.py`
  - 内容: 见 design.md §MySQL Connection Router
  - 依赖: T023
  - 验证: T030 全部测试通过

---

### Group 15: Import Router（T032–T033）

- [ ] **T032**: Import Router 测试
  - 文件: `apps/server/tests/unit/test_import_router.py`
  - 内容:
    - POST /datasets/import/mysql → 202 + taskId
    - POST /datasets/upload/preview → 200 + fileToken + preview
    - POST /datasets/upload/confirm → 202 + taskId
    - GET /import-tasks/{taskId} 状态轮询（pending/running/completed/failed）
  - 依赖: T023（MySQLImportService）、T025（FileImportService）、T013（ImportTaskService）

- [ ] **T033**: Import Router 实现
  - 文件: `apps/server/app/routers/imports.py`
  - 内容: 见 design.md §Import Router
  - 依赖: T023、T025、T013
  - 验证: T032 全部测试通过

---

### Group 16: 注册（T034）

- [ ] **T034**: main.py 注册 + openapi.json 重新生成
  - 文件:
    - `apps/server/app/main.py` — 注册 `datasets.router`, `mysql_connections.router`, `imports.router`
    - `apps/server/openapi.json` — 重新生成
  - 依赖: T029、T031、T033

---

### Group 17: 集成测试（T035–T038）

- [ ] **T035**: Dataset API 集成测试
  - 文件: `apps/server/tests/integration/test_dataset_api.py`
  - 内容:
    - Dataset 列表（含 in-use 合并计算标记）
    - Dataset 预览
    - Dataset 删除（成功 / in-use 拒绝）
  - 依赖: T034

- [ ] **T036**: 不完整 OT + 完整性校验集成测试
  - 文件: `apps/server/tests/integration/test_incomplete_object_type.py`
  - 内容:
    - 不完整创建（空 body → 占位名 + 自动推断）
    - 仅 displayName → ID/apiName 自动推断
    - 含新字段创建（backing_datasource_rid + intended_actions）
    - 补全后发布（完整性校验通过）
    - 未补全发布（完整性校验失败 + 详细 missingFields）
    - 类型兼容性校验失败
  - 依赖: T034

- [ ] **T037**: Import Task API 集成测试
  - 文件: `apps/server/tests/integration/test_import_task_api.py`
  - 内容:
    - 任务创建 + 轮询状态转换
    - 任务不存在 → 404
  - 依赖: T034

- [ ] **T038**: MySQL Connections API 集成测试
  - 文件: `apps/server/tests/integration/test_mysql_connections_api.py`
  - 内容:
    - 连接保存 + 列表
    - 测试连接失败 → 422 标准错误格式
    - 连接不存在 → 404
  - 依赖: T034

---

## 前端任务（T039–T058）

### Group 18: 类型生成 + API Hooks（T039–T041，基础设施无测试配对）

- [ ] **T039**: OpenAPI 类型重新生成 + 类型导出
  - 文件:
    - `apps/web/src/generated/api.ts` — 重新生成（`npx openapi-typescript`）
    - `apps/web/src/api/types.ts` — 追加 Dataset / MySQLConnection / ImportTask / 导入相关类型
  - 依赖: T034（后端 openapi.json 已更新）

- [ ] **T040**: Dataset + MySQL Connection API Hooks
  - 文件:
    - `apps/web/src/api/datasets.ts` — queryKeys + `useDatasets(search?)`, `useDataset(rid)`, `useDatasetPreview(rid, limit?)`, `useDeleteDataset()`
    - `apps/web/src/api/mysql-connections.ts` — queryKeys + `useMySQLConnections()`, `useCreateMySQLConnection()`, `useTestMySQLConnection()`, `useMySQLTables(rid)`, `useMySQLTableColumns(rid, table)`, `useMySQLTablePreview(rid, table)`
  - 依赖: T039

- [ ] **T041**: Import API Hooks + 轮询
  - 文件:
    - `apps/web/src/api/imports.ts` — `useMySQLImport()`, `useFileUploadPreview()`, `useFileImportConfirm()`, `useImportTask(taskId)` (支持 `refetchInterval` 轮询)
  - 依赖: T039

---

### Group 19: 状态管理 + i18n（T042–T043，基础设施）

- [ ] **T042**: Wizard Zustand Store
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

- [ ] **T043**: i18n 翻译
  - 文件:
    - `apps/web/src/locales/en-US/common.json` — 追加 wizard.*, dataset.*, mysqlConnection.*, import.*, step.* 命名空间
    - `apps/web/src/locales/zh-CN/common.json` — 对应中文翻译
  - 依赖: 无

---

### Group 20: 创建向导 Shell（T044–T045）

- [ ] **T044**: 向导 Shell 测试
  - 文件: `apps/web/src/pages/object-types/__tests__/CreateObjectTypeWizard.test.tsx`
  - 内容:
    - Stepper 渲染 5 个步骤（Datasource / Metadata / Properties / Actions / Save Location）
    - 步骤导航（Next/Previous 按钮）
    - 已完成步骤标记（✓ 图标）
    - 最低要求未满足时 Next 按钮置灰
    - 任意步骤退出触发创建（调用 POST /object-types）
  - 依赖: T042（Wizard Store）

- [ ] **T045**: 向导 Shell 实现
  - 文件:
    - `apps/web/src/pages/object-types/components/CreateObjectTypeWizard.tsx` — 新建（Modal + Ant Design Steps + 步骤路由）
    - `apps/web/src/pages/object-types/components/CreateObjectTypeModal.tsx` — 删除
    - `apps/web/src/components/CreateMenu.tsx` — 更新引用
    - `apps/web/src/layouts/HomeLayout.tsx` — 更新引用
  - 依赖: T042、T043
  - 验证: T044 全部测试通过

---

### Group 21: Step 1 — 数据源选择（T046–T047）

- [ ] **T046**: 数据源选择测试
  - 文件: `apps/web/src/pages/object-types/__tests__/WizardStepDatasource.test.tsx`
  - 内容:
    - Dataset 列表渲染（名称 / 来源 / 行数 / 列数 / 导入时间）
    - In-use 标记（被占用的 Dataset 标注 OT 名称）
    - 搜索过滤
    - 选中后展示 DatasetPreview（列结构 + 前 5 行）
    - "Connect to MySQL" / "Upload Excel/CSV" 按钮存在
  - 依赖: T040（API Hooks）、T045（向导 Shell）

- [ ] **T047**: 数据源选择实现
  - 文件:
    - `apps/web/src/pages/object-types/components/WizardStepDatasource.tsx` — 新建
    - 内含 DatasetList + DatasetPreview 子组件
    - "Use this Dataset" 确认按钮
  - 依赖: T040、T045
  - 验证: T046 全部测试通过

---

### Group 22: MySQL 子向导（T048–T049）

- [ ] **T048**: MySQL 子向导测试
  - 文件: `apps/web/src/pages/object-types/__tests__/MySQLImportWizard.test.tsx`
  - 内容:
    - 4 步导航（Connection / Browse Tables / Config / Result）
    - 连接表单必填校验（host, port, database, username, password）
    - Test Connection 成功 / 失败提示
    - 复用已有连接下拉
    - 表浏览 + 列预览
    - 导入配置（Dataset 名称 + 列选择）
    - 导入结果（进度 → 成功摘要 / 失败重试）
  - 依赖: T040、T041（API Hooks）

- [ ] **T049**: MySQL 子向导实现
  - 文件:
    - `apps/web/src/pages/object-types/components/MySQLImportWizard.tsx` — 新建（Modal + 4 步）
    - 内含 MySQLConnectionForm, MySQLTableBrowser, MySQLImportConfig, ImportResult 子组件
  - 依赖: T040、T041
  - 验证: T048 全部测试通过

---

### Group 23: Excel/CSV 子向导（T050–T051）

- [ ] **T050**: Excel/CSV 子向导测试
  - 文件: `apps/web/src/pages/object-types/__tests__/FileUploadWizard.test.tsx`
  - 内容:
    - 拖拽上传区域渲染
    - 格式校验（仅 .csv / .xlsx / .xls）、大小校验（≤50MB）
    - Sheet 选择（Excel multi-sheet 场景）
    - 预览配置（首行表头 Toggle、列选择 Checkbox、类型修改下拉、前 50 行表格）
    - 导入结果
  - 依赖: T041（API Hooks）

- [ ] **T051**: Excel/CSV 子向导实现
  - 文件:
    - `apps/web/src/pages/object-types/components/FileUploadWizard.tsx` — 新建（Modal + 3 步）
    - 内含 FileUploader, FilePreviewConfig, ImportResult 子组件
  - 依赖: T041
  - 验证: T050 全部测试通过

---

### Group 24: Step 2–5 向导步骤（T052–T053）

- [ ] **T052**: Step 2–5 测试
  - 文件: `apps/web/src/pages/object-types/__tests__/WizardSteps.test.tsx`
  - 内容:
    - **Metadata (Step 2)**: Icon 选择器、displayName 必填、ID 从 displayName 自动推断（kebab-case）、可手动编辑
    - **Properties (Step 3)**: 左右分栏布局、添加列映射、手动添加属性、PK/TK 必须各设置一个
    - **Actions (Step 4)**: 3 个 Checkbox（Create/Modify/Delete）、无必填限制
    - **Save Location (Step 5)**: Project 下拉选择、单 Project 自动选中
  - 依赖: T045（向导 Shell）

- [ ] **T053**: Step 2–5 实现
  - 文件:
    - `apps/web/src/pages/object-types/components/WizardStepMetadata.tsx` — 新建
    - `apps/web/src/pages/object-types/components/WizardStepProperties.tsx` — 新建（DatasourceColumnPane + PropertyPane）
    - `apps/web/src/pages/object-types/components/WizardStepActions.tsx` — 新建
    - `apps/web/src/pages/object-types/components/WizardStepSaveLocation.tsx` — 新建
  - 依赖: T045
  - 验证: T052 全部测试通过

---

### Group 25: 编辑页修改（T054–T055）

- [ ] **T054**: 编辑页修改测试
  - 文件: `apps/web/src/pages/object-types/__tests__/ObjectTypeEditPages.test.tsx`
  - 内容:
    - Overview 页 MetadataSection: Status/Visibility 下拉
    - 无 backing datasource 时显示 "Add a backing datasource" 提示
    - intended_actions 展示
    - Active 状态删除按钮置灰 + Tooltip 提示
  - 依赖: T040（API Hooks）

- [ ] **T055**: 编辑页修改实现
  - 文件:
    - `apps/web/src/pages/object-types/ObjectTypeOverviewPage.tsx` — 新增 backing datasource 区域、属性映射入口、incomplete 提示
    - `apps/web/src/pages/object-types/components/MetadataSection.tsx` — 新增 Status/Visibility 下拉、intended_actions 展示
    - `apps/web/src/pages/object-types/ObjectTypeDetailLayout.tsx` — Active 状态删除置灰
  - 依赖: T040
  - 验证: T054 全部测试通过

---

### Group 26: 组件更新 + 路由（T056–T057）

- [ ] **T056**: 现有组件更新
  - 文件:
    - `apps/web/src/pages/object-types/components/DeleteObjectTypeModal.tsx` — Active 置灰 Tooltip（确认是否已实现，否则新增）
    - `apps/web/src/components/HomeSidebar.tsx` — Incomplete OT 标记（图标/文字提示）
    - `apps/web/src/router.tsx` — 路由更新（如有变化）
  - 依赖: T045、T055

- [ ] **T057**: TypeScript 编译验证 + 测试修复
  - 内容:
    - `npx tsc --noEmit` 无类型错误
    - 更新受影响的现有测试（mock 数据、import 路径等）
    - `npx vitest run` 全部通过
  - 依赖: T056

---

### Group 27: 前端集成验证（T058）

- [ ] **T058**: 端到端前端流程验证
  - 内容:
    - 向导创建完整流程（5 步走完 → 创建成功）
    - 不完整创建 + 编辑页补全
    - 删除（active 状态限制验证）
    - 草稿暂存提示
  - 依赖: T057

---

## 依赖关系

```
后端:
T001 → T002 → T003
T004 → T005 (type mapping)
T006 → T007 (domain models)
T008 → T009 (OT model)
T010 → T011 (crypto, depends on T001)
T012 → T013 (import task, depends on T007)
T014 → T015, T016 → T017 (storage, depends on T003+T007)
T018 → T019 (dataset service, depends on T015)
T020 → T021 (OT service, depends on T009+T015)
T022 → T023 (MySQL import, depends on T011+T013+T017+T015+T005)
T024 → T025 (file import, depends on T005+T013+T015)
T026 → T027 (WS validation, depends on T015+T009)
T028 → T029, T030 → T031, T032 → T033 (routers, depend on services)
T034 (registration, depends on T029+T031+T033)
T035-T038 (integration tests, depend on T034)

前端:
T039 (types, depends on T034 backend openapi)
T040-T041 (API hooks, depends on T039)
T042-T043 (store + i18n, no backend dependency)
T044-T045 (wizard shell, depends on T042+T043)
T046-T047 (Step 1, depends on T040+T045)
T048-T049 (MySQL wizard, depends on T040+T041)
T050-T051 (File wizard, depends on T041)
T052-T053 (Steps 2-5, depends on T045)
T054-T055 (edit page, depends on T040)
T056-T057 (component updates + validation)
T058 (final integration)
```

---

## 验证方式

全部任务完成后：

```bash
# 后端
cd apps/server && uv run pytest tests/ -v                    # 全部测试通过
cd apps/server && uv run pytest tests/ -v -m "not mysql"     # CI 中跳过 MySQL 测试
cd apps/server && uv run alembic upgrade head                # 迁移成功

# 前端
cd apps/web && npx tsc --noEmit                              # 无类型错误
cd apps/web && npx vitest run                                # 全部测试通过
```
