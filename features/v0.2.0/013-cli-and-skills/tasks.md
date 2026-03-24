# Tasks: CLI 工具与 Skills 体系

**关联规格**: [spec.md](./spec.md)
**版本**: v0.2.0

---

## 状态

| 步骤 | 状态 | 备注 |
|------|------|------|
| spec.md | ✅ 已评审 | 2026-03-24 审查通过（补充 L1 Skills + link-type update） |
| tasks.md | 🔲 草稿 | 拆解完成后改为 ✅ 已拆解 |
| 实现 | 🔲 未开始 | 0 / 28 完成 |

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
  - `test_list`：验证表格输出
  - `test_get`：验证详情输出
  - `test_update`：传 --side-a-name，验证 "Updated"，exit 0
  - `test_delete`：验证 "Deleted"，exit 0
  **覆盖 AC**: AC-16, AC-17, AC-18, AC-19, AC-20
  **依赖**: T002

- [ ] **T008**: link-type 命令 — 实现
  **文件**: `apps/server/cli/commands/link_type.py`
  **逻辑**:
  - `create(id, side_a_object, side_a_name, side_a_api_name, side_b_*, cardinality)` → LinkTypeCreateRequest（含 LinkSideCreateInput）→ service.create()
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

- [ ] **T011**: search 命令 — 单元测试 + 实现
  **文件**: `apps/server/tests/unit/test_cli_search.py`, `apps/server/cli/commands/search.py`
  **逻辑**:
  - 测试（test_cli_search.py）：
    - `test_search`：mock SearchService.search()，验证按 objectType/property/linkType 分区输出
    - `test_search_with_type`：传 --type objectType，验证仅搜索该类型
    - `test_search_no_results`：mock 返回空，验证 "No results found."，exit 0
  - 实现（search.py）：
    - `search(query, type, limit)` → SearchService.search(ontology_rid, query, types, limit) → 分区格式化输出
    - 在 main.py 注册为顶级命令（非子 app）
  **覆盖 AC**: AC-25, AC-26, AC-27
  **依赖**: T002

- [ ] **T012**: working-state 命令 — 单元测试 + 实现
  **文件**: `apps/server/tests/unit/test_cli_working_state.py`, `apps/server/cli/commands/working_state.py`
  **逻辑**:
  - 测试：
    - `test_show`：mock WorkingStateService，验证变更列表输出
    - `test_show_empty`：无草稿时验证 "No pending changes."
    - `test_save`：mock publish()，验证 "Published N changes (version M)."，exit 0
    - `test_save_empty`：mock 抛 AppError("WORKING_STATE_EMPTY")，验证 stderr "No changes to publish"，exit 1
    - `test_discard`：验证 "Discarded all draft changes."，exit 0
  - 实现：
    - `show()` → get_or_create() → 遍历 changes 输出表格
    - `save()` → publish()
    - `discard()` → discard()
    - 在 main.py 注册
  **覆盖 AC**: AC-32, AC-33, AC-34, AC-35
  **依赖**: T002

- [ ] **T013**: blueprint 存根命令 — 单元测试 + 实现
  **文件**: `apps/server/tests/unit/test_cli_blueprint.py`, `apps/server/cli/commands/blueprint.py`
  **逻辑**:
  - 测试：
    - `test_analyze_stub`：验证 stderr 含 "not yet implemented"，exit 2
    - `test_list_stub`：验证 stderr 含 "not yet implemented"，exit 2
    - `test_show_stub`：验证 stderr 含 "not yet implemented"，exit 2
    - `test_apply_stub`：验证 stderr 含 "not yet implemented"，exit 2
  - 实现：
    - analyze/list/show/apply 四个方法均 print_error("Blueprint commands not yet implemented (requires F014).") + raise SystemExit(2)
    - 在 main.py 注册
  **覆盖 AC**: AC-36
  **依赖**: T002

### Phase 3: ValidationService 提取

- [ ] **T014**: ValidationService — 单元测试
  **文件**: `apps/server/tests/unit/test_validation_service.py`
  **逻辑**: mock db session + WorkingStateService 内部调用：
  - `test_validate_complete_ontology`：无问题时返回空 list
  - `test_validate_incomplete_ot`：缺字段时返回 ValidationResult(severity="error", code="INCOMPLETE_OBJECT_TYPE")
  - `test_validate_type_incompatibility`：属性类型与列类型不兼容时返回 error
  - `test_validate_orphan_link_type`：链接引用已删除 OT 时返回 warning
  - `test_validate_apiname_conflict`：apiName 冲突时返回 error
  **覆盖 AC**: AC-28, AC-29, AC-30, AC-31
  **依赖**: T002

- [ ] **T015**: ValidationService — 实现 + WorkingStateService 重构
  **文件**: `apps/server/app/services/validation_service.py`, `apps/server/app/services/working_state_service.py`
  **逻辑**:
  - 创建 `ValidationService(session)`，方法 `async def validate(ontology_rid) -> list[ValidationResult]`
  - 提取 `WorkingStateService._validate_completeness()` 逻辑 → `_check_completeness()` 方法，返回 ValidationResult 列表（不抛异常）
  - 提取 `WorkingStateService._validate_type_compatibility()` 逻辑 → `_check_type_compatibility()`
  - 新增 `_check_orphan_link_types()`：查询 LinkType 端点引用的 OT 是否在 merged view 中存在
  - 新增 `_check_apiname_conflicts()`：查询 merged view 中 apiName 重复
  - 重构 `WorkingStateService.publish()`：调用 `ValidationService.validate()`，将 severity="error" 的结果转为 AppError
  - **影响范围**：仅修改 validation 逻辑的提取方式，不修改 ObjectType/Property/LinkType 的写入行为。WorkingState 仍归属 003+009。现有 `test_working_state_service.py` 必须全部通过。
  **测试**: T014 全部通过 + `uv run pytest tests/unit/test_working_state_service.py -v` 通过
  **覆盖 AC**: AC-28, AC-29, AC-30, AC-31
  **依赖**: T002, T014

- [ ] **T016**: validate CLI 命令 — 单元测试
  **文件**: `apps/server/tests/unit/test_cli_validate.py`
  **逻辑**: CliRunner + mock ValidationService：
  - `test_validate_pass`：mock 返回空列表，验证 "Validation passed. No issues found."，exit 0
  - `test_validate_errors`：mock 返回 error 级别结果，验证 stdout 含 "ERROR:"，exit 1
  - `test_validate_warnings_only`：mock 返回仅 warning，验证 "WARNING:" + exit 0
  - `test_validate_mixed`：mock 返回 error + warning，验证两者都输出 + exit 1
  **覆盖 AC**: AC-28, AC-29, AC-30, AC-31
  **依赖**: T015

- [ ] **T017**: validate CLI 命令 — 实现
  **文件**: `apps/server/cli/commands/validate.py`
  **逻辑**:
  - `validate()` → ValidationService.validate(ontology_rid) → 遍历结果输出 `{SEVERITY}: {message}`
  - 末尾汇总 `Result: N errors, M warnings`
  - 有 error → exit 1；仅 warning 或无问题 → exit 0
  - 在 main.py 注册为顶级命令
  **测试**: T016 全部通过
  **覆盖 AC**: AC-28, AC-29, AC-30, AC-31
  **依赖**: T002, T015, T016

### Phase 4: 全局行为

- [ ] **T018**: 全局选项 — 单元测试
  **文件**: `apps/server/tests/unit/test_cli_global.py`
  **逻辑**: CliRunner 测试全局选项和边界情况：
  - `test_format_json_global`：`oo object-type list --format json` 验证 JSON 输出
  - `test_format_invalid`：`oo object-type list --format xml` 验证 stderr 含 "Unsupported format"，exit 1（typer 内置校验或 adapter 手动校验）
  - `test_ontology_override`：`oo --ontology ri.test object-type list` 验证 ontology_rid 传递给 Service
  - `test_ontology_not_found`：mock Service 抛 AppError("ONTOLOGY_NOT_FOUND")，验证 stderr + exit 1
  - `test_db_connection_error`：mock session 抛连接异常，验证 stderr 含 "Database connection failed"，exit 1
  **覆盖 AC**: AC-37, AC-38, AC-39
  **依赖**: T004（需要已实现的 object-type 命令作为测试载体）

- [ ] **T019**: 全局选项 — 实现
  **文件**: `apps/server/cli/main.py`（更新）, `apps/server/cli/adapter.py`（更新）
  **逻辑**:
  - main.py：添加 `--ontology` 全局选项（typer.Option, default `ri.ontology.ontology.default`），通过 typer.Context 传递给子命令
  - main.py：添加 `--format` 全局选项（typer.Option, enum OutputFormat），通过 Context 传递
  - adapter.py：添加 `get_ontology_rid(ctx)` 和 `get_format(ctx)` 辅助函数
  - adapter.py：在 `async_session_context()` 中捕获 DB 连接异常 → handle_db_error
  - **注**：T001 仅创建骨架（空子 app + --version），T019 添加 --ontology/--format 全局选项的完整实现
  **测试**: T018 全部通过
  **覆盖 AC**: AC-37, AC-38, AC-39
  **依赖**: T002, T004, T018

### Phase 5: SKILL.md 知识定义

- [ ] **T020**: L1 SKILL.md — 前 5 个（OT + Property 相关）
  **文件**: `apps/server/app/agent/skills/{create-object-type,update-object-type,delete-object-type,create-property,list-object-types}/SKILL.md`
  **逻辑**: 每个 SKILL.md 按以下结构创建：
  - frontmatter: `name`, `description`（一句话，Agent 懒加载用）, `level: L1`
  - `## 参数`：表格（参数名 | 类型 | 必填 | 说明）
  - `## 约束`：业务规则列表（如 apiName 唯一、PascalCase 格式）
  - `## CLI 命令`：精确的 `oo` 命令和参数
  - `## 使用场景`：Agent 何时调用此 Skill
  - `## 示例`：完整命令示例
  - **create-object-type** 参数：displayName(必填), apiName(可选,自动推断PascalCase), description(可选), id(可选,自动推断kebab-case)。约束：apiName 在 Ontology 内唯一(INV-1)。CLI: `oo object-type create --name <name> [--api-name <api>]`
  - **update-object-type** 参数：rid(必填), displayName/apiName/description/status(可选)。CLI: `oo object-type update <rid> [--name <n>]`
  - **delete-object-type** 参数：rid(必填)。约束：active 状态不可删除(INV-4)。CLI: `oo object-type delete <rid>`
  - **create-property** 参数：objectTypeRid(必填), displayName(必填), apiName(必填), baseType(必填), id(可选)。约束：支持类型列表。CLI: `oo property create --object-type <rid> --name <n> --api-name <a> --type <t>`
  - **list-object-types** 参数：page(可选), pageSize(可选)。CLI: `oo object-type list [--page N]`
  **覆盖 AC**: AC-40
  **依赖**: T004, T006（CLI 命令已实现，确保示例准确）

- [ ] **T021**: L1 SKILL.md — 后 5 个（LT + Dataset + Search + Validate）
  **文件**: `apps/server/app/agent/skills/{create-link-type,update-link-type,import-dataset,search-ontology,validate-ontology}/SKILL.md`
  **逻辑**: 同 T020 格式：
  - **create-link-type** 参数：id, sideA(objectTypeRid+displayName+apiName), sideB(同), cardinality。约束：INV-7(端点apiName唯一), INV-8(m2m需joinTable), INV-9(id唯一)。CLI: `oo link-type create --id <id> --side-a-object <rid> ...`
  - **update-link-type** 参数：rid, sideAName/sideAApiName/sideBName/sideBApiName/status(可选)。CLI: `oo link-type update <rid> [--side-a-name <n>]`
  - **import-dataset** 参数：filepath(必填), format(csv/excel), sheet(可选), name(可选)。约束：文件≤50MB。CLI: `oo dataset import-csv <path>` / `oo dataset import-excel <path>`
  - **search-ontology** 参数：query(必填), type(可选), limit(可选)。CLI: `oo search <query> [--type objectType]`
  - **validate-ontology** 无参数。CLI: `oo validate`。使用场景：创建一批资源后验证整体一致性
  **覆盖 AC**: AC-40
  **依赖**: T008, T010, T011, T017（相关 CLI 命令已实现）

- [ ] **T022**: L2 SKILL.md（3 个组合级 Skill）
  **文件**: `apps/server/app/agent/skills/{create-object-type-with-properties,create-link-type-with-validation,batch-create-from-blueprint}/SKILL.md`
  **逻辑**: L1 格式 + 额外「组合步骤」和「错误处理」：
  - **create-object-type-with-properties**：步骤 1) create-object-type → 获得 OT RID 2) 逐个 create-property（传入 OT RID）。失败时：OT 已创建但部分属性失败 → 报告失败属性，不回滚 OT
  - **create-link-type-with-validation**：步骤 1) validate-ontology 预检 2) 检查两端 OT 存在 3) create-link-type。失败时：预检不通过 → 报告问题，不执行创建
  - **batch-create-from-blueprint**：步骤 1) 按依赖排序（OT→Property→LT）2) 逐项调用 L1 Skills 3) 记录每项成功/失败。失败时：标记失败项，继续处理后续项
  **覆盖 AC**: AC-41
  **依赖**: T020, T021

- [ ] **T023**: L3 SKILL.md（3 个编排级 Skill）
  **文件**: `apps/server/app/agent/skills/{analyze-materials,generate-blueprint,optimize-ontology}/SKILL.md`
  **逻辑**: L1 格式 + 额外「编排策略」「子 Agent 调度」「上下文管理」：
  - **analyze-materials**：编排策略 — 按文件类型分流（结构化直接解析无需 LLM token，非结构化用 LLM 提取）。子 Agent — 多文件时每文件派子 Agent 并行。上下文 — 注入目标领域/范围
  - **generate-blueprint**：编排 — 汇总子 Agent 结果 → 合并同名实体 → 检测冲突 → 评估置信度。上下文 — 加载已有本体 Schema 避免重复
  - **optimize-ontology**：编排 — 1) validate-ontology 获取问题列表 2) 分析命名一致性 3) 识别缺失关系 4) 提出优化建议。上下文 — 加载完整本体 Schema
  - **注**：这些 Skill 的实际执行逻辑由 F012/F014 实现，此处仅定义 Agent 的知识手册
  **覆盖 AC**: AC-42
  **依赖**: T020, T021

### Phase 6: Claude Code Skills

- [ ] **T024**: Claude Code Skills（3 个：ontology-create, ontology-search, ontology-validate）
  **文件**: `.claude/skills/{ontology-create,ontology-search,ontology-validate}/SKILL.md`
  **逻辑**: 使用 `/skill-creator` 创建，每个文件含：
  - frontmatter: name, description（触发条件描述）
  - 正文：对应 `oo` CLI 命令调用示例
  - **ontology-create**: description="在本体中创建对象类型、属性或链接类型。TRIGGER when: 用户要求创建本体资源。"，正文含 `oo object-type create`, `oo property create`, `oo link-type create` 示例
  - **ontology-search**: description="搜索本体资源。TRIGGER when: 用户搜索本体。"，正文含 `oo search <query>` 示例
  - **ontology-validate**: description="验证本体一致性。TRIGGER when: 用户要求校验本体。"，正文含 `oo validate` 示例
  **覆盖 AC**: AC-43
  **依赖**: T004, T011, T017（对应 CLI 命令已实现）

- [ ] **T025**: Claude Code Skills（3 个：ontology-blueprint, ontology-analyze, ontology-optimize）
  **文件**: `.claude/skills/{ontology-blueprint,ontology-analyze,ontology-optimize}/SKILL.md`
  **逻辑**: 使用 `/skill-creator` 创建：
  - **ontology-blueprint**: description="管理本体蓝图。TRIGGER when: 用户管理蓝图。"，正文含 `oo blueprint list/show/apply` 示例（当前为存根）
  - **ontology-analyze**: description="分析资料生成本体。TRIGGER when: 用户要求分析文件。"，正文含 `oo blueprint analyze` 示例（当前为存根）
  - **ontology-optimize**: description="优化现有本体。TRIGGER when: 用户要求优化本体。"，正文含 `oo validate` + Agent 建议流程
  **覆盖 AC**: AC-43
  **依赖**: T013（blueprint 存根已实现）

### Phase 7: 集成验证

- [ ] **T026**: SKILL.md 格式验证
  **文件**: 无新文件（仅验证）
  **逻辑**:
  - 验证 16 个 SKILL.md 文件存在：`ls apps/server/app/agent/skills/*/SKILL.md | wc -l` = 16
  - 每个文件必须含 frontmatter（`---` 分隔的 name + description）
  - L1 文件（10 个）frontmatter 含 `level: L1`，正文含 ## 参数、## 约束、## CLI 命令、## 使用场景、## 示例
  - L2 文件（3 个）额外含 ## 组合步骤
  - L3 文件（3 个）额外含 ## 编排策略
  **覆盖 AC**: AC-40, AC-41, AC-42
  **依赖**: T020, T021, T022, T023

- [ ] **T027**: Claude Code Skills 格式验证
  **文件**: 无新文件（仅验证）
  **逻辑**:
  - 验证 6 个 Claude Code Skills 文件存在：`ls .claude/skills/ontology-*/SKILL.md | wc -l` = 6
  - 每个文件含 frontmatter（name + description）
  - 每个文件正文含至少一个 `oo` 命令示例
  **覆盖 AC**: AC-43
  **依赖**: T024, T025

- [ ] **T028**: 端到端集成验证
  **文件**: 无新文件
  **逻辑**:
  - 运行 `cd apps/server && uv run pytest tests/ -v` 确认所有现有测试通过（含 WorkingState 重构后）
  - 运行 `cd apps/server && uv run pytest tests/unit/test_cli_*.py -v` 确认所有 CLI 测试通过
  - 手动验证 `uv run oo --help` 显示所有命令组
  - 手动验证 `uv run oo --version` 输出 `oo 0.2.0`
  **覆盖 AC**: AC-01, AC-02
  **依赖**: T019, T026, T027

---

## 实际偏差记录

> 完成后，在此记录实现与 spec.md 的偏差，供后续参考。

- *（待填充）*
