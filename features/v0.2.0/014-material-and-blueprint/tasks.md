# Tasks: F014 Material and Blueprint（素材与蓝图）

**关联规格**: [spec.md](./spec.md)
**版本**: v0.2.0

---

## 状态

| 步骤 | 状态 | 备注 |
|------|------|------|
| spec.md | ✅ 已评审 | 用户确认通过 |
| tasks.md | 🔲 草稿 | 拆解完成后改为 ✅ 已拆解 |
| 实现 | 🔲 未开始 | 0 / 35 完成 |

---

## 开发模式

**后端 Test-First（测试在前，实现在后）**：后端任务按「测试 → 实现」配对编排，先写测试（红），再写实现（绿）。
基础设施任务（数据库迁移、ORM 模型、配置）无测试配对，单独编号。

**自包含任务**：每个任务内联文件、逻辑、测试上下文，实现阶段不需要回读 spec.md。

---

## Tasks

### Phase 0: 基础设施

- [ ] **T001**: 数据库迁移 — 创建 agent_materials / blueprints / blueprint_items 表
  **文件**: `apps/server/alembic/versions/<next>_add_material_and_blueprint_tables.py`
  **逻辑**:
  - 创建 `agent_materials` 表：rid(PK), session_rid(FK→agent_sessions CASCADE), file_name, file_type, file_size, storage_path, analysis_status(default 'pending'), analysis_result(JSONB), error_message, created_at
  - 创建 `blueprints` 表：rid(PK), session_rid(FK→agent_sessions CASCADE), ontology_rid(FK→ontologies), name, status(default 'draft'), source_summary, created_at, updated_at
  - 创建 `blueprint_items` 表：rid(PK), blueprint_rid(FK→blueprints CASCADE), item_type, suggestion(JSONB), confidence(REAL), confidence_level, reasoning, source, user_decision, user_edits(JSONB), rejection_reason, created_entity_rid, sort_order(default 0), created_at, updated_at
  - 创建索引：idx_agent_materials_session, idx_blueprints_session, idx_blueprints_ontology, idx_blueprint_items_blueprint
  - downgrade: DROP 3 张表 + 索引
  **依赖**: 无

- [ ] **T002**: ORM 模型 — 在 models.py 新增 3 个 Model
  **文件**: `apps/server/app/storage/models.py`
  **逻辑**:
  - `AgentMaterialModel`: 映射 agent_materials 表，所有字段。relationship → AgentSessionModel (backref="materials")
  - `BlueprintModel`: 映射 blueprints 表。relationship → AgentSessionModel (backref="blueprints"), items relationship → BlueprintItemModel (cascade="all, delete-orphan")
  - `BlueprintItemModel`: 映射 blueprint_items 表。relationship → BlueprintModel (back_populates="items")
  - 遵循已有模式：Text PK, JSONB 列, DateTime(timezone=True), server_default
  **依赖**: T001

- [ ] **T003**: Domain 模型 — 创建 material.py + blueprint.py
  **文件**: `apps/server/app/domain/material.py`, `apps/server/app/domain/blueprint.py`
  **逻辑**:
  - material.py: MaterialFileType 枚举(csv/xlsx/sql/pdf/md/docx/txt), AnalysisStatus 枚举(pending/analyzing/completed/failed), AgentMaterial(DomainModel), AgentMaterialCreate(DomainModel)
  - blueprint.py: BlueprintStatus, BlueprintItemType, ConfidenceLevel, ItemSource, UserDecision 枚举。Blueprint, BlueprintCreate, BlueprintUpdate, BlueprintDetail, BlueprintList, BlueprintItem, BlueprintItemCreate, BlueprintItemUpdate, BlueprintApplyResult, ApplyItemResult 模型
  - 所有模型继承 DomainModel（自动 alias_generator=to_camel, populate_by_name=True）
  **依赖**: 无

- [ ] **T004**: 配置扩展 + .gitignore
  **文件**: `apps/server/app/config.py`, `apps/server/.gitignore`
  **逻辑**:
  - config.py 新增: `material_upload_dir: str = "uploads/materials"`, `material_max_file_size_mb: int = 10`, `material_max_files_per_session: int = 20`
  - .gitignore 添加 `uploads/` 目录
  **依赖**: 无

### Phase 1: 素材管理（Material）

- [ ] **T005**: MaterialStorage 单元测试
  **文件**: `apps/server/tests/unit/test_material_storage.py`
  **逻辑**: 测试 MaterialStorage 的 create/get/list_by_session/count_by_session/update_analysis_status/delete 方法，使用 mock_db_session
  **覆盖 AC**: AC-01, AC-07, AC-08, AC-09
  **依赖**: T002, T003

- [ ] **T006**: MaterialStorage 实现
  **文件**: `apps/server/app/storage/material_storage.py`
  **逻辑**: 静态方法类，方法：create, get, list_by_session, count_by_session, update_analysis_status(rid, status, result, error_message), delete, delete_by_session。遵循 AgentStorage 模式
  **测试**: T005 全部通过
  **依赖**: T002, T003

- [ ] **T007**: MaterialService 单元测试
  **文件**: `apps/server/tests/unit/test_material_service.py`
  **逻辑**:
  - `test_upload_success` → 校验文件写入+DB 记录创建 (AC-01)
  - `test_upload_file_too_large` → 超 10MB 抛 MATERIAL_FILE_TOO_LARGE (AC-02)
  - `test_upload_invalid_type` → 不支持的扩展名抛 MATERIAL_INVALID_FILE_TYPE (AC-03)
  - `test_upload_session_limit` → 超 20 个文件抛 MATERIAL_SESSION_LIMIT_EXCEEDED (AC-04)
  - `test_upload_session_not_found` → 不存在的会话抛 AGENT_SESSION_NOT_FOUND (AC-05)
  - `test_upload_session_not_active` → 非 active 会话抛 AGENT_SESSION_NOT_ACTIVE (AC-06)
  - `test_delete_with_file_cleanup` → 删除 DB 记录+磁盘文件 (AC-09)
  - `test_delete_not_found` → 不存在的 rid 抛 MATERIAL_NOT_FOUND (AC-10)
  - `test_cleanup_session_files` → 删除整个会话文件目录 (AC-39)
  - 使用 mock_db_session + tmp_path 隔离文件系统
  **覆盖 AC**: AC-01, AC-02, AC-03, AC-04, AC-05, AC-06, AC-09, AC-10, AC-39
  **依赖**: T003, T006

- [ ] **T008**: MaterialService 实现
  **文件**: `apps/server/app/services/material_service.py`
  **逻辑**:
  - upload(): 校验 session active → count_by_session ≤ 20 → validate_file_extension → validate_file_size ≤ 10MB → 生成 storage_path `{upload_dir}/{session_rid}/{rid}_{sanitized_name}` → 异步写入磁盘(aiofiles) → 创建 DB 记录
  - get(), list_by_session(): 标准查询 + ORM→Domain 转换
  - delete(): 删除 DB 记录 + 删除磁盘文件（Path.unlink, 容错 FileNotFoundError）
  - update_analysis(): 更新 analysis_status + analysis_result + error_message
  - cleanup_session_files(): shutil.rmtree(session_dir, ignore_errors=True)
  - _validate_file_extension(): 检查扩展名在白名单 {csv,xlsx,sql,pdf,md,docx,txt}
  - _sanitize_filename(): 移除特殊字符，保留可读性
  **测试**: T007 全部通过
  **覆盖 AC**: AC-01, AC-02, AC-03, AC-04, AC-05, AC-06, AC-07, AC-08, AC-09, AC-10, AC-39
  **依赖**: T006

- [ ] **T009**: Material API 集成测试
  **文件**: `apps/server/tests/integration/test_materials_router.py`
  **逻辑**:
  - `test_upload_csv_success` → POST /upload multipart, 201 (AC-01)
  - `test_upload_file_too_large` → 400 MATERIAL_FILE_TOO_LARGE (AC-02)
  - `test_upload_invalid_type` → 400 MATERIAL_INVALID_FILE_TYPE (AC-03)
  - `test_upload_session_limit` → 400 MATERIAL_SESSION_LIMIT_EXCEEDED (AC-04)
  - `test_get_material` → GET /{rid}, 200 (AC-07)
  - `test_list_materials_by_session` → GET ?sessionRid=xxx, 200 (AC-08)
  - `test_delete_material` → DELETE /{rid}, 204 (AC-09)
  - `test_delete_not_found` → 404 MATERIAL_NOT_FOUND (AC-10)
  - 使用 seeded_client + tmp_path
  **覆盖 AC**: AC-01, AC-02, AC-03, AC-04, AC-07, AC-08, AC-09, AC-10
  **依赖**: T008

- [ ] **T010**: Material Router 实现
  **文件**: `apps/server/app/routers/materials.py`
  **逻辑**:
  - APIRouter(prefix="/api/v1/agent/materials", tags=["materials"])
  - POST /upload: multipart/form-data (file: UploadFile, session_rid: Form) → MaterialService.upload() → 201
  - GET /: Query(session_rid) → MaterialService.list_by_session() → 200
  - GET /{rid}: → MaterialService.get() → 200
  - DELETE /{rid}: → MaterialService.delete() → 204
  - 依赖注入: _get_service(session=Depends(get_db_session))
  **测试**: T009 全部通过
  **覆盖 AC**: AC-01, AC-02, AC-03, AC-04, AC-07, AC-08, AC-09, AC-10
  **依赖**: T008

### Phase 2: 蓝图 CRUD

- [ ] **T011**: BlueprintStorage + BlueprintItemStorage 单元测试
  **文件**: `apps/server/tests/unit/test_blueprint_storage.py`
  **逻辑**: 测试 BlueprintStorage 的 create/get/get_with_items/list_by_ontology/update_status/update 和 BlueprintItemStorage 的 create/batch_create/get/list_by_blueprint/update_decision/update_created_entity_rid/count_actionable
  **覆盖 AC**: AC-11, AC-13, AC-14, AC-21, AC-24
  **依赖**: T002, T003

- [ ] **T012**: BlueprintStorage + BlueprintItemStorage 实现
  **文件**: `apps/server/app/storage/blueprint_storage.py`
  **逻辑**:
  - BlueprintStorage: create, get, get_with_items (selectinload items), list_by_ontology(page, page_size), list_by_session(page, page_size), update_status, update, delete
  - BlueprintItemStorage: create, batch_create, get, list_by_blueprint (order by sort_order), update_decision(rid, decision, edits, rejection_reason), update_created_entity_rid, count_actionable (count where user_decision in accepted/edited)
  **测试**: T011 全部通过
  **依赖**: T002, T003

- [ ] **T013**: BlueprintService CRUD + 状态机单元测试
  **文件**: `apps/server/tests/unit/test_blueprint_service.py`
  **逻辑**:
  - `test_create_blueprint` → 创建蓝图 status=draft (AC-11)
  - `test_create_blueprint_session_not_found` → 404 (AC-12)
  - `test_get_detail` → 返回蓝图+items (AC-14)
  - `test_get_not_found` → 404 BLUEPRINT_NOT_FOUND (AC-15)
  - `test_update_status_draft_to_pending` → 合法转换 (AC-16)
  - `test_update_status_pending_to_discarded` → 合法转换 (AC-17)
  - `test_update_status_applied_to_any` → 422 BLUEPRINT_INVALID_STATUS_TRANSITION (AC-18)
  - `test_update_status_discarded_to_any` → 422 (AC-19)
  - `test_update_status_draft_to_applied` → 422 (AC-20)
  - `test_create_item` → 创建蓝图项 + confidence_level 自动计算 (AC-21)
  - `test_create_item_invalid_confidence` → 400 BLUEPRINT_ITEM_INVALID_CONFIDENCE (AC-22)
  - `test_create_item_missing_source` → 400 BLUEPRINT_ITEM_MISSING_SOURCE (AC-23)
  - `test_batch_create_items` → 批量创建 (AC-25)
  **覆盖 AC**: AC-11, AC-12, AC-14, AC-15, AC-16, AC-17, AC-18, AC-19, AC-20, AC-21, AC-22, AC-23, AC-25
  **依赖**: T003, T012

- [ ] **T014**: BlueprintService CRUD + 状态机实现
  **文件**: `apps/server/app/services/blueprint_service.py`
  **逻辑**:
  - create(): 校验 session 存在 + ontology 存在 → 生成 rid → 创建蓝图 (status=draft)
  - get() / get_detail(): 查询蓝图（detail eagerly load items）
  - list_blueprints(): 支持 session_rid / ontology_rid 过滤 + 分页
  - update(): 状态机校验 —— 合法转换: draft→pending_review, pending_review→discarded; 禁止: applied→任何, discarded→任何, draft→applied; pending_review→applied 只能通过 apply 端点
  - create_item(): 校验 INV-16(confidence 0-1 + source 非空) → 计算 confidence_level(≥0.8=high, 0.5-0.8=medium, <0.5=low) → 创建
  - batch_create_items(): 批量校验 + 创建
  - _to_blueprint() / _to_item(): ORM→Domain 转换
  **测试**: T013 全部通过
  **覆盖 AC**: AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, AC-17, AC-18, AC-19, AC-20, AC-21, AC-22, AC-23, AC-24, AC-25
  **依赖**: T012

### Phase 3: 蓝图项审查决策

- [ ] **T015**: BlueprintItem 决策更新单元测试
  **文件**: `apps/server/tests/unit/test_blueprint_item_decision.py`
  **逻辑**:
  - `test_accept_item` → userDecision=accepted (AC-26)
  - `test_edit_item` → userDecision=edited + userEdits (AC-27)
  - `test_reject_item` → userDecision=rejected + rejectionReason (AC-28)
  - `test_decision_immutable` → 已有决策时再改 → 422 BLUEPRINT_ITEM_DECISION_IMMUTABLE (AC-29)
  - `test_decision_requires_pending_review` → 蓝图非 pending_review → 422 (AC-30)
  - `test_item_not_found` → 404 BLUEPRINT_ITEM_NOT_FOUND (AC-31)
  **覆盖 AC**: AC-26, AC-27, AC-28, AC-29, AC-30, AC-31
  **依赖**: T014

- [ ] **T016**: BlueprintItem 决策更新实现
  **文件**: `apps/server/app/services/blueprint_service.py`（追加 update_item_decision 方法）
  **逻辑**:
  - update_item_decision(blueprint_rid, item_rid, update): 校验蓝图 status=pending_review → 校验 item 属于该蓝图 → 校验 INV-11(current user_decision 必须为 null) → 保存 decision/edits/rejection_reason
  **测试**: T015 全部通过
  **覆盖 AC**: AC-26, AC-27, AC-28, AC-29, AC-30, AC-31
  **依赖**: T014

### Phase 4: 蓝图应用（Apply）

- [ ] **T017**: Apply 单元测试
  **文件**: `apps/server/tests/unit/test_blueprint_apply.py`
  **逻辑**:
  - `test_apply_success` → happy path: 2 个 OT + 3 个 Property + 1 个 LT，全部成功 (AC-32, AC-33, AC-37, AC-38)
  - `test_apply_dependency_order` → 验证 OT 先创建，Property/LT 后创建 (AC-33)
  - `test_apply_partial_failure` → 1 个 OT 失败 → 其 Property 被 skip (AC-34)
  - `test_apply_not_pending_review` → 非 pending_review → 422 BLUEPRINT_INVALID_STATUS_FOR_APPLY (AC-35)
  - `test_apply_no_actionable_items` → 没有 accepted/edited 项 → 422 BLUEPRINT_NO_ACTIONABLE_ITEMS (AC-36)
  - `test_apply_all_failed` → 全部失败 → 蓝图状态保持 pending_review
  - `test_apply_created_entity_rid_updated` → 成功项 created_entity_rid 非空 (AC-37)
  - Mock ObjectTypeService.create / PropertyService.create / LinkTypeService.create
  **覆盖 AC**: AC-32, AC-33, AC-34, AC-35, AC-36, AC-37, AC-38
  **依赖**: T016

- [ ] **T018**: Apply 实现
  **文件**: `apps/server/app/services/blueprint_service.py`（追加 apply 方法）
  **逻辑**:
  - apply(rid): 校验 status=pending_review (INV-10) → 获取所有 items → 筛选 accepted/edited → 校验 ≥1 项 (INV-10)
  - Phase 1: 遍历 item_type=object_type → 读取 suggestion/user_edits → 调用 ObjectTypeService.create() → 成功则记录 ot_rid_map[placeholderRid]=created.rid → 更新 created_entity_rid
  - Phase 2: 遍历 item_type=property → 从 suggestion 解析 objectTypePlaceholderRid → 通过 ot_rid_map 映射到实际 rid → 调用 PropertyService.create() → 更新 created_entity_rid
  - Phase 3: 遍历 item_type=link_type → 解析两端 OT placeholder → 映射实际 rid → 调用 LinkTypeService.create() → 更新 created_entity_rid
  - 部分失败: OT 失败 → 依赖该 OT 的 Property/LT 记为 skipped; 其他失败项继续
  - 全部处理完后: 有 ≥1 个成功项 → 更新蓝图 status=applied; 全部失败 → 保持 pending_review
  - 返回 BlueprintApplyResult
  **测试**: T017 全部通过
  **覆盖 AC**: AC-32, AC-33, AC-34, AC-35, AC-36, AC-37, AC-38
  **依赖**: T016

### Phase 5: Blueprint API 集成测试 + 路由实现

- [ ] **T019**: Blueprint API 集成测试
  **文件**: `apps/server/tests/integration/test_blueprints_router.py`
  **逻辑**:
  - `test_create_blueprint` → POST /blueprints, 201 (AC-11)
  - `test_list_blueprints` → GET /blueprints?ontologyRid=xxx, 200 (AC-13)
  - `test_get_blueprint_detail` → GET /blueprints/{rid}, 200 (AC-14)
  - `test_get_not_found` → 404 (AC-15)
  - `test_update_status` → PATCH /blueprints/{rid}, 200 (AC-16, AC-17)
  - `test_invalid_status_transition` → 422 (AC-18, AC-19, AC-20)
  - `test_create_item` → POST /blueprints/{rid}/items, 201 (AC-21)
  - `test_create_item_invalid_confidence` → 400 (AC-22)
  - `test_list_items` → GET /blueprints/{rid}/items, 200 (AC-24)
  - `test_update_item_decision` → PATCH /blueprints/{rid}/items/{itemRid}, 200 (AC-26, AC-27, AC-28)
  - `test_decision_immutable` → 422 (AC-29)
  - `test_apply_blueprint` → POST /blueprints/{rid}/apply, 200 (AC-32)
  - `test_apply_not_pending` → 422 (AC-35)
  - 使用 seeded_client（需要预创建 session + ontology）
  **覆盖 AC**: AC-11, AC-13, AC-14, AC-15, AC-16, AC-17, AC-18, AC-19, AC-20, AC-21, AC-22, AC-24, AC-26, AC-27, AC-28, AC-29, AC-32, AC-35
  **依赖**: T018

- [ ] **T020**: Blueprint Router 实现
  **文件**: `apps/server/app/routers/blueprints.py`
  **逻辑**:
  - APIRouter(prefix="/api/v1/blueprints", tags=["blueprints"])
  - POST /: BlueprintCreate body → BlueprintService.create() → 201
  - GET /: Query(session_rid, ontology_rid, page, page_size) → BlueprintService.list_blueprints() → 200
  - GET /{rid}: → BlueprintService.get_detail() → 200
  - PATCH /{rid}: BlueprintUpdate body → BlueprintService.update() → 200
  - POST /{rid}/items: BlueprintItemCreate body (单个或 list) → create_item/batch_create_items → 201
  - GET /{rid}/items: → BlueprintService.list_items() → 200
  - PATCH /{rid}/items/{item_rid}: BlueprintItemUpdate body → update_item_decision → 200
  - POST /{rid}/apply: → BlueprintService.apply() → 200
  **测试**: T019 全部通过
  **覆盖 AC**: AC-11, AC-13, AC-14, AC-15, AC-16, AC-17, AC-18, AC-19, AC-20, AC-21, AC-22, AC-23, AC-24, AC-25, AC-26, AC-27, AC-28, AC-29, AC-30, AC-31, AC-32, AC-35, AC-36
  **依赖**: T018

### Phase 6: SSE 事件 + 会话级联 + 注册

- [ ] **T021**: SSE 事件扩展
  **文件**: `apps/server/app/agent/sse_adapter.py`
  **逻辑**:
  - SSEEventType 枚举新增: MATERIAL_UPLOADED = "material-uploaded", BLUEPRINT_ITEM = "blueprint-item", BLUEPRINT_COMPLETE = "blueprint-complete"
  - 新增格式化函数: format_material_uploaded_event(material), format_blueprint_item_event(item), format_blueprint_complete_event(blueprint)
  - 每个函数调用已有 format_sse_event() 并使用 camelCase 字段名
  **覆盖 AC**: AC-40, AC-41, AC-42
  **依赖**: 无

- [ ] **T022**: 会话删除级联文件清理
  **文件**: `apps/server/app/services/agent_service.py`
  **逻辑**:
  - 修改 delete_session(): 在写审计日志和删除会话之前，调用 MaterialService(self._session).cleanup_session_files(rid) 清理本地文件
  - DB 记录由 FK CASCADE 自动清理，此处只需清理文件系统
  - **跨 feature 影响**: 修改 F012 产出文件 agent_service.py，仅在 delete_session() 方法中追加一行 cleanup 调用，不改变原有逻辑
  **覆盖 AC**: AC-39
  **依赖**: T008

- [ ] **T023**: 注册 Router + 重新生成 openapi.json
  **文件**: `apps/server/app/main.py`, `apps/server/openapi.json`
  **逻辑**:
  - main.py: `from app.routers import materials, blueprints` + `app.include_router(materials.router)` + `app.include_router(blueprints.router)`
  - 启动服务，访问 /openapi.json 保存到 apps/server/openapi.json
  **依赖**: T010, T020

### Phase 7: CLI 命令

- [ ] **T024**: CLI blueprint 命令单元测试
  **文件**: `apps/server/tests/unit/test_cli_blueprint.py`
  **逻辑**:
  - 使用 typer.testing.CliRunner + mock BlueprintService
  - `test_list_blueprints` → oo blueprint list --session-rid xxx (AC-43)
  - `test_show_blueprint` → oo blueprint show <rid> (AC-44)
  - `test_apply_blueprint` → oo blueprint apply <rid> (AC-45)
  **覆盖 AC**: AC-43, AC-44, AC-45
  **依赖**: T014

- [ ] **T025**: CLI blueprint 命令实现（填充存根）
  **文件**: `apps/server/cli/commands/blueprint.py`
  **逻辑**:
  - 移除存根代码（_NOT_IMPL_MSG）
  - list(session_rid, ontology_rid, format): 调用 BlueprintService.list_blueprints() → 格式化输出
  - show(rid, format): 调用 BlueprintService.get_detail() → 格式化输出（含所有 items）
  - apply(rid): 调用 BlueprintService.apply() → 输出结果摘要（成功/失败/跳过数量）
  - analyze 保留存根（analyze 逻辑由 Agent 驱动，不在 CLI 直接实现）
  - 使用 cli/adapter.py 的 run_async() 桥接
  **测试**: T024 全部通过
  **覆盖 AC**: AC-43, AC-44, AC-45
  **依赖**: T024

- [ ] **T026**: CLI material 命令单元测试
  **文件**: `apps/server/tests/unit/test_cli_material.py`
  **逻辑**:
  - `test_upload_material` → oo material upload <file> --session-rid xxx (AC-46)
  - `test_list_materials` → oo material list --session-rid xxx (AC-47)
  - `test_parse_csv` → oo material parse orders.csv (AC-48)
  **覆盖 AC**: AC-46, AC-47, AC-48
  **依赖**: T008

- [ ] **T027**: CLI material 命令实现 + 注册
  **文件**: `apps/server/cli/commands/material.py`, `apps/server/cli/main.py`
  **逻辑**:
  - material.py: typer.Typer(no_args_is_help=True)
  - upload(file: Path, session_rid: str, format: str): 读取文件 → 调用 MaterialService.upload() → 输出 rid
  - list(session_rid: str, format: str): 调用 MaterialService.list_by_session() → 格式化输出
  - parse(file: Path, parser: str = "auto"): auto 模式根据扩展名选择解析器 → 调用解析器 → 格式化输出
  - main.py: `app.add_typer(material.app, name="material", help="Manage materials.")`
  **测试**: T026 全部通过
  **覆盖 AC**: AC-46, AC-47, AC-48
  **依赖**: T026

### Phase 8: 文件解析器

- [ ] **T028**: 解析器基类 + CSV 解析器单元测试
  **文件**: `apps/server/tests/unit/test_parsers.py`
  **逻辑**:
  - `test_csv_parse_basic` → 解析简单 CSV，验证列名、类型推断、行数 (AC-49)
  - `test_csv_primary_key_candidate` → 列名含 id/_id/Id 标记为主键候选 (AC-53)
  - `test_csv_audit_field_detection` → 检测 created_at/updated_at 等审计字段 (AC-54)
  - `test_csv_type_inference` → Integer/Double/Date/Timestamp/Boolean/String 推断正确 (AC-49)
  - `test_csv_gbk_encoding` → GBK 编码降级解析
  - `test_csv_empty_file` → 空文件处理
  - 使用 tmp_path 创建测试 CSV 文件
  **覆盖 AC**: AC-49, AC-53, AC-54
  **依赖**: T003

- [ ] **T029**: 解析器基类 + CSV 解析器实现
  **文件**: `apps/server/app/agent/parsers/__init__.py`, `apps/server/app/agent/parsers/base.py`, `apps/server/app/agent/parsers/csv_parser.py`
  **逻辑**:
  - base.py: BaseParser(ABC) 抽象类 + ParseResult/ColumnInfo/TableInfo/ForeignKeyInfo 数据模型
  - csv_parser.py: CsvParser(BaseParser)
    - 读取文件（尝试 UTF-8，降级 GBK）
    - 使用 csv.Sniffer 检测分隔符
    - 前 1000 行推断类型：整数→Integer, 小数→Double, 日期→Date, 时间戳→Timestamp, bool→Boolean, 默认→String
    - 类型匹配率 >95% 确认，否则 String
    - 列名含 id/_id/Id → is_primary_key_candidate=True
    - 列名匹配审计模式 → is_audit_field=True
    - 返回 ParseResult(columns, row_count, metadata={delimiter, encoding})
  **测试**: T028 全部通过
  **覆盖 AC**: AC-49, AC-53, AC-54
  **依赖**: T003

- [ ] **T030**: Excel 解析器单元测试 + 实现（Test-Alongside：解析器为独立工具模块，无 DB 依赖）
  **文件**: `apps/server/tests/unit/test_excel_parser.py`, `apps/server/app/agent/parsers/excel_parser.py`
  **逻辑**:
  - ExcelParser(BaseParser): 使用 openpyxl 读取 .xlsx
  - 支持多 sheet，每 sheet 独立分析
  - 类型推断复用 CSV 逻辑
  - 测试: `test_excel_parse_basic` (AC-50), `test_excel_multi_sheet` (AC-50)
  - 使用 openpyxl 在 tmp_path 创建测试 xlsx
  **覆盖 AC**: AC-50
  **依赖**: T029

- [ ] **T031**: DDL 解析器单元测试 + 实现（Test-Alongside：解析器为独立工具模块，无 DB 依赖）
  **文件**: `apps/server/tests/unit/test_ddl_parser.py`, `apps/server/app/agent/parsers/ddl_parser.py`
  **逻辑**:
  - DdlParser(BaseParser): 使用 sqlparse 解析 SQL DDL
  - 提取 CREATE TABLE 语句: 表名、列名+类型、PRIMARY KEY、FOREIGN KEY (含引用表+列)、UNIQUE、NOT NULL
  - 外键映射为 ForeignKeyInfo(from_column, to_table, to_column)
  - 测试: `test_ddl_parse_create_table` (AC-51), `test_ddl_parse_foreign_key` (AC-51), `test_ddl_parse_multiple_tables` (AC-51)
  **覆盖 AC**: AC-51
  **依赖**: T029

- [ ] **T032**: 文档解析器单元测试 + 实现（Test-Alongside：解析器为独立工具模块，无 DB 依赖）
  **文件**: `apps/server/tests/unit/test_document_parser.py`, `apps/server/app/agent/parsers/document_parser.py`
  **逻辑**:
  - DocumentParser(BaseParser): 根据文件扩展名选择提取方式
    - .pdf: 使用 pymupdf (fitz) 提取文本; 无文本内容(扫描件) → 标记失败
    - .docx: 使用 python-docx 提取段落文本
    - .md / .txt: 直接读取
  - 返回 ParseResult(text_content=extracted_text, file_type=ext)
  - 测试: `test_parse_txt` (AC-52), `test_parse_markdown` (AC-52), `test_parse_pdf_empty` (扫描件检测)
  **覆盖 AC**: AC-52
  **依赖**: T029

- [ ] **T033**: 4 个 parse-* SKILL.md 文件
  **文件**: `apps/server/app/agent/skills/parse-csv/SKILL.md`, `apps/server/app/agent/skills/parse-excel/SKILL.md`, `apps/server/app/agent/skills/parse-ddl/SKILL.md`, `apps/server/app/agent/skills/parse-document/SKILL.md`
  **逻辑**:
  - 每个 SKILL.md 包含: frontmatter (name, description, level: L1) + 参数表 + 约束 + CLI 命令映射 (`oo material parse <file> --parser <type>`) + 使用场景 + 示例
  - 遵循已有 SKILL.md 格式（参考 create-object-type/SKILL.md）
  **覆盖 AC**: AC-49, AC-50, AC-51, AC-52
  **依赖**: T029, T030, T031, T032

### Phase 9: 更新已有 analyze-materials + generate-blueprint SKILL.md

- [ ] **T034**: 更新 L3 SKILL.md 引用新的 parse-* skills
  **文件**: `apps/server/app/agent/skills/analyze-materials/SKILL.md`, `apps/server/app/agent/skills/generate-blueprint/SKILL.md`
  **逻辑**:
  - analyze-materials SKILL.md: 更新"子步骤"部分，引用 parse-csv/parse-excel/parse-ddl/parse-document skills；更新 CLI 命令为 `oo material parse` + `oo material upload`
  - generate-blueprint SKILL.md: 更新引用蓝图 API（POST /blueprints, POST /blueprints/{rid}/items）和 CLI 命令 `oo blueprint list/show/apply`
  **依赖**: T033

- [ ] **T035**: Python 依赖安装确认
  **文件**: `apps/server/pyproject.toml`
  **逻辑**:
  - 确认 aiofiles 依赖已存在（用于异步文件 I/O）
  - 添加解析器依赖（如需要）: openpyxl（Excel）, sqlparse（DDL）, pymupdf（PDF）, python-docx（Word）
  - 运行 `uv sync` 确认依赖安装
  **依赖**: 无

---

## 实际偏差记录

> 完成后，在此记录实现与 spec.md 的偏差，供后续参考。
