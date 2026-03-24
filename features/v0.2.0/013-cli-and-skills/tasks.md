# Tasks: CLI 工具与 Skills 体系

**关联规格**: [spec.md](./spec.md)
**版本**: v0.2.0

---

## 状态

| 步骤 | 状态 | 备注 |
|------|------|------|
| spec.md | ✅ 已评审 | 2026-03-24 审查通过（补充 L1 Skills + link-type update） |
| tasks.md | 🔲 草稿 | 拆解完成后改为 ✅ 已拆解 |
| 实现 | 🔲 未开始 | 0 / 30 完成 |

---

## 开发模式

**后端 Test-First**：CLI 命令测试在前，实现在后。每个实现任务显式依赖其配对测试任务。
**基础设施任务**（依赖安装、框架搭建）无测试配对。
**SKILL.md / Claude Code Skills**：文档类任务由 T028 集成验证覆盖（文件存在 + 格式校验）。
**自包含任务**：每个任务内联文件、逻辑、测试上下文，实现阶段不需要回读 spec.md 或 PRD。

---

## Tasks

### Phase 1: 基础设施

- [ ] **T001**: 依赖安装 + pyproject.toml + CLI 入口骨架
  **文件**: `apps/server/pyproject.toml`, `apps/server/cli/__init__.py`, `apps/server/cli/main.py`
  **逻辑**:
  - pyproject.toml 添加 `typer[all]>=0.12.0`, `rich>=13.0.0` 依赖
  - 添加 `[project.scripts]` 段：`oo = "cli.main:app"`
  - `cli/__init__.py`：空文件
  - `cli/main.py`：创建 typer.Typer app，添加 `--version` 回调（输出 `oo 0.2.0`），注册所有命令组子 app（暂为空 Typer）
  - 运行 `uv sync && uv run oo --help` 验证可用
  **依赖**: 无

- [ ] **T002**: CLI adapter + output 工具
  **文件**: `apps/server/cli/adapter.py`, `apps/server/cli/output.py`
  **逻辑**:
  - `cli/adapter.py`：
    - `run_async(coro)` — 封装 `asyncio.run()`
    - `async_session_context()` — async context manager，创建 session + 自动 commit/rollback
    - `handle_app_error(e: AppError)` — 格式化到 stderr + `raise SystemExit(1)`
    - `handle_db_error(e)` — stderr 输出 "Database connection failed" + exit 1
  - `cli/output.py`：
    - `format_table(headers: list[str], rows: list[list[str]])` — 用 rich.Table 输出
    - `format_json(data)` — json.dumps 输出
    - `print_success(msg)` — typer.echo 到 stdout
    - `print_error(msg)` — typer.echo 到 stderr
    - `OutputFormat` enum: TEXT, JSON
  - `cli/commands/__init__.py`：空文件
  **依赖**: T001

### Phase 2: CLI 命令（Test-First）

- [ ] **T003**: object-type 命令 — 单元测试
  **文件**: `apps/server/tests/unit/test_cli_object_type.py`
  **逻辑**: 使用 typer.testing.CliRunner + mock Service：
  - `test_create_success`：mock ObjectTypeService.create() 返回 ObjectTypeWithChangeState，验证 stdout 含 "Created object type"，exit 0
  - `test_create_with_api_name`：传 --api-name 参数，验证 Request 含指定 api_name
  - `test_list`：mock list() 返回 ObjectTypeListResponse，验证 stdout 含表格
  - `test_list_json`：加 --format json，验证 stdout 为合法 JSON 数组
  - `test_get_success`：mock get_by_rid()，验证 key-value 输出
  - `test_get_not_found`：mock 抛 AppError(404)，验证 stderr 含 "not found"，exit 1
  - `test_update`：验证 "Updated"，exit 0
  - `test_delete`：验证 "Deleted"，exit 0
  - `test_delete_active`：mock 抛 AppError(400)，验证 stderr 含 "Cannot delete"，exit 1
  **覆盖 AC**: AC-03, AC-04, AC-05, AC-06, AC-07, AC-08, AC-09, AC-10, AC-11
  **依赖**: T002

- [ ] **T004**: object-type 命令 — 实现
  **文件**: `apps/server/cli/commands/object_type.py`
  **逻辑**:
  - 创建 `app = typer.Typer()` 子命令组
  - `create(name, api_name, id, description)` → ObjectTypeCreateRequest → adapter.run_async(service.create()) → print_success
  - `list(page, page_size)` → service.list() → format_table 或 format_json
  - `get(rid)` → service.get_by_rid() → key-value 详情
  - `update(rid, name, api_name, description, status)` → ObjectTypeUpdateRequest → service.update()
  - `delete(rid)` → service.delete() → print_success
  - 在 main.py 中注册 `app.add_typer(object_type.app, name="object-type")`
  **测试**: T003 全部通过
  **覆盖 AC**: AC-03, AC-04, AC-05, AC-06, AC-07, AC-08, AC-09, AC-10, AC-11
  **依赖**: T002, T003

- [ ] **T005**: property 命令 — 单元测试
  **文件**: `apps/server/tests/unit/test_cli_property.py`
  **逻辑**: CliRunner + mock PropertyService：
  - `test_create`：传 --object-type, --name, --api-name, --type，验证 "Created property"，exit 0
  - `test_list`：传 --object-type，验证表格输出
  - `test_update`：验证 "Updated"，exit 0
  - `test_delete`：验证 "Deleted"，exit 0
  **覆盖 AC**: AC-12, AC-13, AC-14, AC-15
  **依赖**: T002

- [ ] **T006**: property 命令 — 实现
  **文件**: `apps/server/cli/commands/property_cmd.py`
  **逻辑**:
  - `create(object_type, name, api_name, type, id, description, backing_column)` → PropertyCreateRequest → service.create()
  - `list(object_type)` → service.list() → format_table
  - `update(rid, object_type, name, api_name, description)` → service.update()
  - `delete(rid, object_type)` → service.delete()
  - 在 main.py 注册 `app.add_typer(property_cmd.app, name="property")`
  **测试**: T005 全部通过
  **覆盖 AC**: AC-12, AC-13, AC-14, AC-15
  **依赖**: T002, T005

- [ ] **T007**: link-type 命令 — 单元测试
  **文件**: `apps/server/tests/unit/test_cli_link_type.py`
  **逻辑**: CliRunner + mock LinkTypeService：
  - `test_create`：传 --id, --side-a-object, --side-a-name, --side-a-api-name, --side-b-*, --cardinality，验证 "Created link type"，exit 0
  - `test_create_m2m_with_join_table`：传 --cardinality many-to-many --join-table-dataset <rid>，验证 Request 含 join_table_dataset_rid
  - `test_list`：验证表格输出
  - `test_get`：验证详情输出
  - `test_update`：传 --side-a-name，验证 "Updated"，exit 0
  - `test_delete`：验证 "Deleted"，exit 0
  **覆盖 AC**: AC-16, AC-17, AC-18, AC-19, AC-20
  **依赖**: T002

- [ ] **T008**: link-type 命令 — 实现
  **文件**: `apps/server/cli/commands/link_type.py`
  **逻辑**:
  - `create(id, side_a_object, side_a_name, side_a_api_name, side_b_*, cardinality, join_table_dataset)` → LinkTypeCreateRequest（含 LinkSideCreateInput + join_table_dataset_rid）→ service.create()
  - `--join-table-dataset` 可选参数：many-to-many 时必填（INV-8 校验由 Service 层保证）
  - `list(object_type)`, `get(rid)`, `update(rid, side_a_name, side_a_api_name, side_b_name, side_b_api_name, status)`, `delete(rid)`
  - 在 main.py 注册
  **测试**: T007 全部通过
  **覆盖 AC**: AC-16, AC-17, AC-18, AC-19, AC-20
  **依赖**: T002, T007

- [ ] **T009**: dataset 命令 — 单元测试
  **文件**: `apps/server/tests/unit/test_cli_dataset.py`
  **逻辑**: CliRunner + mock DatasetService/FileImportService：
  - `test_list`：mock DatasetService.list()，验证表格输出
  - `test_import_csv`：mock FileImportService，验证 "Imported dataset"，exit 0
  - `test_import_excel`：验证 --sheet 参数传递
  - `test_import_file_not_found`：传不存在路径，验证 stderr 含 "File not found"，exit 1
  - `test_import_file_too_large`：mock 文件大小超过 50MB，验证 stderr 含 "exceeds maximum size"，exit 1
  **覆盖 AC**: AC-21, AC-22, AC-23, AC-24
  **依赖**: T002

- [ ] **T010**: dataset 命令 — 实现
  **文件**: `apps/server/cli/commands/dataset.py`
  **逻辑**:
  - `list()` → DatasetService.list() → format_table
  - `import_csv(filepath, name)` → 检查文件存在 + 检查大小 ≤ 50MB → 读取字节 → FileImportService 解析 → 创建 Dataset → print_success
  - `import_excel(filepath, sheet, name)` → 同上，支持 sheet 参数
  - 文件不存在/超限时 print_error + exit 1
  - 在 main.py 注册
  - **注**：CLI 仅调用 FileImportService 的解析方法（读取权限），不修改 Dataset 写入语义，Dataset owner 仍为 F010
  **测试**: T009 全部通过
  **覆盖 AC**: AC-21, AC-22, AC-23, AC-24
  **依赖**: T002, T009

- [ ] **T011**: search 命令 — 单元测试
  **文件**: `apps/server/tests/unit/test_cli_search.py`
  **逻辑**: CliRunner + mock SearchService：
  - `test_search`：mock SearchService.search()，验证按 objectType/property/linkType 分区输出
  - `test_search_with_type`：传 --type objectType，验证仅搜索该类型
  - `test_search_no_results`：mock 返回空，验证 "No results found."，exit 0
  **覆盖 AC**: AC-25, AC-26, AC-27
  **依赖**: T002

- [ ] **T012**: search 命令 — 实现
  **文件**: `apps/server/cli/commands/search.py`
  **逻辑**:
  - `search(query, type, limit)` → SearchService.search(ontology_rid, query, types, limit) → 分区格式化输出
  - 在 main.py 注册为顶级命令（非子 app）
  **测试**: T011 全部通过
  **覆盖 AC**: AC-25, AC-26, AC-27
  **依赖**: T002, T011

- [ ] **T013**: working-state 命令 — 单元测试
  **文件**: `apps/server/tests/unit/test_cli_working_state.py`
  **逻辑**: CliRunner + mock WorkingStateService：
  - `test_show`：mock 返回 WorkingState with changes，验证变更列表输出
  - `test_show_empty`：无草稿时验证 "No pending changes."
  - `test_save`：mock publish() 返回 ChangeRecord，验证 "Published N changes (version M)."，exit 0
  - `test_save_empty`：mock 抛 AppError("WORKING_STATE_EMPTY")，验证 stderr "No changes to publish"，exit 1
  - `test_discard`：验证 "Discarded all draft changes."，exit 0
  **覆盖 AC**: AC-32, AC-33, AC-34, AC-35
  **依赖**: T002

- [ ] **T014**: working-state 命令 — 实现
  **文件**: `apps/server/cli/commands/working_state.py`
  **逻辑**:
  - `show()` → WorkingStateService.get_or_create() → 遍历 changes 输出表格（ResourceType, RID, ChangeType）
  - `save()` → WorkingStateService.publish()
  - `discard()` → WorkingStateService.discard()
  - 在 main.py 注册
  **测试**: T013 全部通过
  **覆盖 AC**: AC-32, AC-33, AC-34, AC-35
  **依赖**: T002, T013

- [ ] **T015**: blueprint 存根命令 — 单元测试
  **文件**: `apps/server/tests/unit/test_cli_blueprint.py`
  **逻辑**: CliRunner 测试四个存根子命令：
  - `test_analyze_stub`：验证 stderr 含 "not yet implemented"，exit 2
  - `test_list_stub`：验证 stderr 含 "not yet implemented"，exit 2
  - `test_show_stub`：验证 stderr 含 "not yet implemented"，exit 2
  - `test_apply_stub`：验证 stderr 含 "not yet implemented"，exit 2
  **覆盖 AC**: AC-36
  **依赖**: T002

- [ ] **T016**: blueprint 存根命令 — 实现
  **文件**: `apps/server/cli/commands/blueprint.py`
  **逻辑**:
  - analyze/list/show/apply 四个方法均 print_error("Blueprint commands not yet implemented (requires F014).") + raise SystemExit(2)
  - 在 main.py 注册
  **测试**: T015 全部通过
  **覆盖 AC**: AC-36
  **依赖**: T002, T015

### Phase 3: ValidationService 提取

- [ ] **T017**: ValidationService — 单元测试
  **文件**: `apps/server/tests/unit/test_validation_service.py`
  **逻辑**: mock db session + Storage 调用：
  - `test_validate_complete_ontology`：无问题时返回空 list
  - `test_validate_incomplete_ot`：缺字段时返回 ValidationResult(severity="error", code="INCOMPLETE_OBJECT_TYPE")
  - `test_validate_type_incompatibility`：属性类型与列类型不兼容时返回 error
  - `test_validate_orphan_link_type`：链接引用已删除 OT 时返回 warning
  - `test_validate_apiname_conflict`：apiName 冲突时返回 error
  **覆盖 AC**: AC-28, AC-29, AC-30, AC-31
  **依赖**: T002

- [ ] **T018**: ValidationService — 实现 + WorkingStateService 重构
  **文件**: `apps/server/app/services/validation_service.py`, `apps/server/app/services/working_state_service.py`
  **逻辑**:
  - 创建 `ValidationService(session)`，方法 `async def validate(ontology_rid) -> list[ValidationResult]`
  - 提取 `_validate_completeness()` → `_check_completeness()`（返回 list 而非抛异常）
  - 提取 `_validate_type_compatibility()` → `_check_type_compatibility()`
  - 新增 `_check_orphan_link_types()` + `_check_apiname_conflicts()`
  - 重构 `WorkingStateService.publish()`：调用 `ValidationService.validate()`，将 error 转 AppError
  - **影响范围**：仅提取验证逻辑，不修改 OT/Property/LT 写入行为。WS 仍归属 003+009。现有 `test_working_state_service.py` + `test_completeness_validation.py` 必须全部通过。
  **测试**: T017 全部通过 + 现有 WS 测试通过
  **覆盖 AC**: AC-28, AC-29, AC-30, AC-31
  **依赖**: T002, T017

- [ ] **T019**: validate CLI 命令 — 单元测试
  **文件**: `apps/server/tests/unit/test_cli_validate.py`
  **逻辑**: CliRunner + mock ValidationService：
  - `test_validate_pass`：mock 返回空列表，验证 "Validation passed."，exit 0
  - `test_validate_errors`：mock 返回 error 结果，验证 "ERROR:"，exit 1
  - `test_validate_warnings_only`：mock 返回 warning，验证 "WARNING:" + exit 0
  - `test_validate_mixed`：验证两者都输出 + exit 1
  **覆盖 AC**: AC-28, AC-29, AC-30, AC-31
  **依赖**: T018

- [ ] **T020**: validate CLI 命令 — 实现
  **文件**: `apps/server/cli/commands/validate.py`
  **逻辑**:
  - `validate(ctx)` → `adapter.get_ontology_rid(ctx)` → `ValidationService.validate()` → 格式化输出
  - 有 error → exit 1；仅 warning → exit 0
  - 在 main.py 注册为顶级命令
  **测试**: T019 全部通过
  **覆盖 AC**: AC-28, AC-29, AC-30, AC-31
  **依赖**: T002, T018, T019

### Phase 4: 全局行为

- [ ] **T021**: 全局选项 — 单元测试
  **文件**: `apps/server/tests/unit/test_cli_global.py`
  **逻辑**: CliRunner 测试全局选项和边界情况：
  - `test_format_json_global`：`oo object-type list --format json` 验证 JSON 输出
  - `test_format_invalid`：`oo object-type list --format xml` 验证 typer enum 拒绝无效值
  - `test_ontology_override`：`oo --ontology ri.test object-type list` 验证 ontology_rid 传递
  - `test_ontology_not_found`：mock 抛 AppError，验证 stderr + exit 1
  - `test_db_connection_error`：mock 连接异常，验证 stderr "Database connection failed"，exit 1
  **覆盖 AC**: AC-37, AC-38, AC-39
  **依赖**: T004

- [ ] **T022**: 全局选项 — 实现
  **文件**: `apps/server/cli/main.py`（更新）, `apps/server/cli/adapter.py`（更新）
  **逻辑**:
  - main.py 全局 callback：设置 `--ontology`/`--format` 到 `ctx.obj` dict
  - adapter.py：`get_ontology_rid(ctx)` + `get_format(ctx)` 从 ctx.obj 读取
  - adapter.py：`async_session_context()` 捕获 DB 连接异常 → handle_db_error
  - **全局选项传递**：所有子命令（T004~T020）通过 `ctx: typer.Context` + adapter 辅助函数读取全局值。各命令实现已预设接收 ctx 参数。
  **测试**: T021 全部通过
  **覆盖 AC**: AC-37, AC-38, AC-39
  **依赖**: T002, T004, T021

### Phase 5: SKILL.md 知识定义

- [ ] **T023**: L1 SKILL.md — 前 5 个（OT + Property 相关）
  **文件**: `apps/server/app/agent/skills/{create-object-type,update-object-type,delete-object-type,create-property,list-object-types}/SKILL.md`
  **逻辑**: 每个 SKILL.md 含：frontmatter(name, description, level: L1) + ## 参数(表格) + ## 约束 + ## CLI 命令 + ## 使用场景 + ## 示例。
  - **create-object-type**：参数 displayName(必填), apiName(可选,PascalCase), description(可选), id(可选,kebab-case)。约束 INV-1(apiName唯一)。CLI `oo object-type create --name <n> [--api-name <a>]`
  - **update-object-type**：参数 rid(必填), displayName/apiName/description/status(可选)。CLI `oo object-type update <rid> [--name <n>]`
  - **delete-object-type**：参数 rid(必填)。约束 INV-4(active不可删)。CLI `oo object-type delete <rid>`
  - **create-property**：参数 objectTypeRid(必填), displayName(必填), apiName(必填,camelCase), baseType(必填)。支持类型：string,integer,double,boolean,date,timestamp,long,float,short,byte,decimal,geohash,geoshape,marking,attachment,mediaReference。CLI `oo property create --object-type <rid> --name <n> --api-name <a> --type <t>`
  - **list-object-types**：参数 page(可选), pageSize(可选)。CLI `oo object-type list [--page N]`
  **覆盖 AC**: AC-40
  **依赖**: T004, T006

- [ ] **T024**: L1 SKILL.md — 后 5 个（LT + Dataset + Search + Validate）
  **文件**: `apps/server/app/agent/skills/{create-link-type,update-link-type,import-dataset,search-ontology,validate-ontology}/SKILL.md`
  **逻辑**: 同 T023 格式：
  - **create-link-type**：参数 id, sideA(objectTypeRid+displayName+apiName), sideB(同), cardinality, joinTableDatasetRid(m2m时必填)。约束 INV-7, INV-8, INV-9。CLI `oo link-type create --id <id> --side-a-object <rid> ... [--join-table-dataset <rid>]`
  - **update-link-type**：参数 rid, sideAName/sideAApiName/sideBName/sideBApiName/status(可选)。CLI `oo link-type update <rid> [--side-a-name <n>]`
  - **import-dataset**：参数 filepath(必填), format(csv/excel), sheet(可选), name(可选)。约束 文件≤50MB。CLI `oo dataset import-csv <path>` / `oo dataset import-excel <path>`
  - **search-ontology**：参数 query(必填), type(可选), limit(可选)。CLI `oo search <query> [--type objectType]`
  - **validate-ontology**：无参数。CLI `oo validate`。场景：创建一批资源后验证一致性
  **覆盖 AC**: AC-40
  **依赖**: T008, T010, T012, T020

- [ ] **T025**: L2 SKILL.md（3 个组合级 Skill）
  **文件**: `apps/server/app/agent/skills/{create-object-type-with-properties,create-link-type-with-validation,batch-create-from-blueprint}/SKILL.md`
  **逻辑**: L1 格式 + `## 组合步骤`（引用 L1 skill 名称和调用顺序）+ `## 错误处理`（失败时策略）：
  - **create-object-type-with-properties**：1) create-object-type → OT RID 2) 逐个 create-property。失败策略：OT 已创建但部分属性失败 → 报告失败属性
  - **create-link-type-with-validation**：1) validate-ontology 预检 2) 检查两端 OT 存在 3) create-link-type。失败策略：预检不通过 → 不执行创建
  - **batch-create-from-blueprint**：1) 按依赖排序（OT→Property→LT）2) 逐项调用 L1 3) 记录成功/失败
  **覆盖 AC**: AC-41
  **依赖**: T023, T024

- [ ] **T026**: L3 SKILL.md（3 个编排级 Skill）
  **文件**: `apps/server/app/agent/skills/{analyze-materials,generate-blueprint,optimize-ontology}/SKILL.md`
  **逻辑**: L1 格式 + `## 编排策略` + `## 子 Agent 调度` + `## 上下文管理`：
  - **analyze-materials**：编排 — 按文件类型分流。子 Agent — 多文件并行。上下文 — 注入领域/范围
  - **generate-blueprint**：编排 — 汇总→合并→冲突检测→置信度。上下文 — 加载已有 Schema
  - **optimize-ontology**：编排 — validate→命名分析→缺失关系→优化建议。上下文 — 完整 Schema
  - **注**：实际执行逻辑由 F012/F014 实现，此处仅定义知识手册
  **覆盖 AC**: AC-42
  **依赖**: T023, T024

### Phase 6: Claude Code Skills

- [ ] **T027**: Claude Code Skills — 前 3 个
  **文件**: `.claude/skills/{ontology-create,ontology-search,ontology-validate}/SKILL.md`
  **逻辑**: 使用 `/skill-creator` 创建，每个含 frontmatter(name, description) + oo CLI 示例：
  - **ontology-create**: TRIGGER when 用户创建本体资源。含 `oo object-type create`, `oo property create`, `oo link-type create`
  - **ontology-search**: TRIGGER when 用户搜索。含 `oo search`
  - **ontology-validate**: TRIGGER when 用户校验。含 `oo validate`
  **覆盖 AC**: AC-43
  **依赖**: T004, T012, T020

- [ ] **T028**: Claude Code Skills — 后 3 个
  **文件**: `.claude/skills/{ontology-blueprint,ontology-analyze,ontology-optimize}/SKILL.md`
  **逻辑**: 使用 `/skill-creator` 创建：
  - **ontology-blueprint**: TRIGGER when 蓝图管理。含 `oo blueprint list/show/apply`（存根）
  - **ontology-analyze**: TRIGGER when 分析文件。含 `oo blueprint analyze`（存根）
  - **ontology-optimize**: TRIGGER when 优化本体。含 `oo validate` + 建议流程
  **覆盖 AC**: AC-43
  **依赖**: T016

### Phase 7: 集成验证

- [ ] **T029**: SKILL.md + CC Skills 格式验证
  **文件**: 无新文件（仅验证）
  **逻辑**:
  - 16 个 SKILL.md 存在且含 frontmatter（name + description + level）
  - L1（10 个）含 ## 参数、## 约束、## CLI 命令、## 使用场景、## 示例
  - L2（3 个）额外含 ## 组合步骤 + ## 错误处理
  - L3（3 个）额外含 ## 编排策略 + ## 子 Agent 调度 + ## 上下文管理
  - 6 个 CC Skills 存在且含 frontmatter(name+description) + oo 命令示例
  **覆盖 AC**: AC-40, AC-41, AC-42, AC-43
  **依赖**: T023, T024, T025, T026, T027, T028

- [ ] **T030**: 端到端集成验证
  **文件**: 无新文件
  **逻辑**:
  - `cd apps/server && uv run pytest tests/ -v` 全部通过（含 WS 重构后）
  - `cd apps/server && uv run pytest tests/unit/test_cli_*.py -v` 全部通过
  - `uv run oo --help` 显示所有 8 个命令组
  - `uv run oo --version` 输出 `oo 0.2.0`
  - **E2E 说明**：F013 为纯 CLI 后端特性，无前端页面变更，E2E 测试在后续 feature（F015+ 工坊页面）中覆盖 CLI 的端到端效果
  **覆盖 AC**: AC-01, AC-02
  **依赖**: T004, T006, T008, T010, T012, T014, T016, T020, T022, T029

---

## 实际偏差记录

> 完成后，在此记录实现与 spec.md 的偏差，供后续参考。

- *（待填充）*
