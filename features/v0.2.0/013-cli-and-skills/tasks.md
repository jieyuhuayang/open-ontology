# Tasks: CLI 工具与 Skills 体系

**关联规格**: [spec.md](./spec.md)
**版本**: v0.2.0

---

## 状态

| 步骤 | 状态 | 备注 |
|------|------|------|
| spec.md | ✅ 已评审 | 2026-03-24 审查通过（补充 L1 Skills + link-type update） |
| tasks.md | 🔲 草稿 | 拆解完成后改为 ✅ 已拆解 |
| 实现 | 🔲 未开始 | 0 / 21 完成 |

---

## 开发模式

**后端 Test-First**：CLI 命令测试在前，实现在后。
**基础设施任务**（依赖安装、框架搭建、SKILL.md、Claude Code Skills）无测试配对。
**自包含任务**：每个任务内联文件、逻辑、测试上下文。

---

## Tasks

### Phase 1: 基础设施

- [ ] **T001**: 依赖安装 + CLI 框架 + adapter
  **文件**: `apps/server/pyproject.toml`, `apps/server/cli/__init__.py`, `apps/server/cli/main.py`, `apps/server/cli/adapter.py`, `apps/server/cli/output.py`, `apps/server/cli/commands/__init__.py`
  **逻辑**:
  - pyproject.toml 添加 `typer[all]>=0.12.0`, `rich>=13.0.0` 依赖
  - 添加 `[project.scripts]` 段：`oo = "cli.main:app"`
  - `cli/main.py`：创建 typer.Typer app，注册全局选项（`--ontology`, `--format`, `--version`），注册所有命令组子 app
  - `cli/adapter.py`：`run_async(coro)` 封装 asyncio.run()；`get_session()` 创建 async session；`handle_error(e: AppError)` 输出到 stderr + sys.exit(1)
  - `cli/output.py`：`format_table(headers, rows)` 用 rich.Table 输出文本表格；`format_json(data)` 输出 JSON；`print_success(msg)` 输出到 stdout；`print_error(msg)` 输出到 stderr
  - `cli/commands/__init__.py`：空文件
  - 运行 `uv run oo --help` 验证框架可用
  **依赖**: 无

### Phase 2: CLI 命令（Test-First）

- [ ] **T002**: object-type 命令 — 单元测试
  **文件**: `apps/server/tests/unit/test_cli_object_type.py`
  **逻辑**: 使用 typer.testing.CliRunner 测试 object-type 子命令：
  - `test_create_success`：mock ObjectTypeService.create()，验证 stdout 含 "Created object type"，exit 0
  - `test_create_with_api_name`：传 --api-name 参数，验证 ObjectTypeCreateRequest 包含指定 api_name
  - `test_list`：mock ObjectTypeService.list()，验证 stdout 含表格输出
  - `test_list_json`：加 --format json，验证 stdout 为合法 JSON
  - `test_get_success`：mock get_by_rid()，验证输出含 key-value 详情
  - `test_get_not_found`：mock 返回 None/AppError，验证 stderr 含 "not found"，exit 1
  - `test_update`：验证 stdout 含 "Updated"
  - `test_delete`：验证 stdout 含 "Deleted"
  - `test_delete_active`：mock 抛 AppError，验证 stderr 含 "Cannot delete"，exit 1
  **覆盖 AC**: AC-03, AC-04, AC-05, AC-06, AC-07, AC-08, AC-09, AC-10, AC-11
  **依赖**: T001

- [ ] **T003**: object-type 命令 — 实现
  **文件**: `apps/server/cli/commands/object_type.py`
  **逻辑**:
  - 创建 `app = typer.Typer()` 子命令组
  - `create(name, api_name, id, description)` → ObjectTypeCreateRequest → service.create() → print_success
  - `list(page, page_size)` → service.list() → format_table/format_json
  - `get(rid)` → service.get_by_rid() → 多行 key-value 或 JSON
  - `update(rid, name, api_name, description, status)` → ObjectTypeUpdateRequest → service.update()
  - `delete(rid)` → service.delete() → print_success
  - 每个方法用 adapter.run_async() 包裹，handle_error 捕获 AppError
  **测试**: T002 全部通过
  **覆盖 AC**: AC-03, AC-04, AC-05, AC-06, AC-07, AC-08, AC-09, AC-10, AC-11
  **依赖**: T001

- [ ] **T004**: property 命令 — 单元测试
  **文件**: `apps/server/tests/unit/test_cli_property.py`
  **逻辑**: CliRunner 测试 property 子命令：
  - `test_create`：传 --object-type, --name, --api-name, --type，验证 stdout 含 "Created property"
  - `test_list`：传 --object-type，验证表格输出
  - `test_update`：验证 "Updated"
  - `test_delete`：验证 "Deleted"
  **覆盖 AC**: AC-12, AC-13, AC-14, AC-15
  **依赖**: T001

- [ ] **T005**: property 命令 — 实现
  **文件**: `apps/server/cli/commands/property_cmd.py`
  **逻辑**:
  - `create(object_type, name, api_name, type, id, description, backing_column)` → PropertyCreateRequest → service.create()
  - `list(object_type)` → service.list() → format_table
  - `update(rid, object_type, name, api_name, description)` → service.update()
  - `delete(rid, object_type)` → service.delete()
  **测试**: T004 全部通过
  **覆盖 AC**: AC-12, AC-13, AC-14, AC-15
  **依赖**: T001

- [ ] **T006**: link-type 命令 — 单元测试
  **文件**: `apps/server/tests/unit/test_cli_link_type.py`
  **逻辑**: CliRunner 测试：
  - `test_create`：传所有必填参数（--id, --side-a-object, --side-a-name, --side-a-api-name, --side-b-*, --cardinality），验证 "Created link type"
  - `test_list`：验证表格输出
  - `test_get`：验证详情
  - `test_update`：传 --side-a-name 等可选参数，验证 "Updated"
  - `test_delete`：验证 "Deleted"
  **覆盖 AC**: AC-16, AC-17, AC-18, AC-19, AC-20
  **依赖**: T001

- [ ] **T007**: link-type 命令 — 实现
  **文件**: `apps/server/cli/commands/link_type.py`
  **逻辑**:
  - `create(id, side_a_object, side_a_name, side_a_api_name, side_b_object, side_b_name, side_b_api_name, cardinality)` → LinkTypeCreateRequest（含 LinkSideCreateInput 构建）→ service.create()
  - `list(object_type)`, `get(rid)`, `update(rid, ...)`, `delete(rid)`
  **测试**: T006 全部通过
  **覆盖 AC**: AC-16, AC-17, AC-18, AC-19, AC-20
  **依赖**: T001

- [ ] **T008**: dataset 命令 — 单元测试
  **文件**: `apps/server/tests/unit/test_cli_dataset.py`
  **逻辑**: CliRunner 测试：
  - `test_list`：mock DatasetService.list()，验证表格输出
  - `test_import_csv`：mock FileImportService，验证 "Imported dataset"
  - `test_import_excel`：验证 --sheet 参数传递
  - `test_import_file_not_found`：不存在路径，验证 stderr 含 "File not found"，exit 1
  **覆盖 AC**: AC-21, AC-22, AC-23, AC-24
  **依赖**: T001

- [ ] **T009**: dataset 命令 — 实现
  **文件**: `apps/server/cli/commands/dataset.py`
  **逻辑**:
  - `list()` → DatasetService.list() → format_table
  - `import_csv(filepath, name)` → 检查文件存在 → 读取文件字节 → FileImportService 解析 → 创建 Dataset → print_success
  - `import_excel(filepath, sheet, name)` → 同上，支持 sheet 参数
  - 文件不存在时 print_error + exit 1
  **测试**: T008 全部通过
  **覆盖 AC**: AC-21, AC-22, AC-23, AC-24
  **依赖**: T001

- [ ] **T010**: search + working-state + blueprint 命令 — 单元测试
  **文件**: `apps/server/tests/unit/test_cli_misc.py`
  **逻辑**: CliRunner 测试：
  - search: `test_search`（验证结果分区显示）, `test_search_with_type`（--type 筛选）, `test_search_no_results`（"No results found."）
  - working-state: `test_show`（变更列表）, `test_show_empty`（"No pending changes."）, `test_save`（"Published"）, `test_save_empty`（stderr "No changes"）, `test_discard`（"Discarded"）
  - blueprint: `test_analyze_stub`（exit 2, stderr "not yet implemented"）
  **覆盖 AC**: AC-25, AC-26, AC-27, AC-32, AC-33, AC-34, AC-35, AC-36
  **依赖**: T001

- [ ] **T011**: search + working-state + blueprint 命令 — 实现
  **文件**: `apps/server/cli/commands/search.py`, `apps/server/cli/commands/working_state.py`, `apps/server/cli/commands/blueprint.py`
  **逻辑**:
  - search.py: `search(query, type, limit)` → SearchService.search() → 按 resource type 分区输出
  - working_state.py: `show()` → WorkingStateService.get_or_create() → 遍历 changes 输出表格；`save()` → WorkingStateService.publish()；`discard()` → WorkingStateService.discard()
  - blueprint.py: analyze/list/show/apply 四个方法均 print_error("not yet implemented") + raise SystemExit(2)
  **测试**: T010 全部通过
  **覆盖 AC**: AC-25, AC-26, AC-27, AC-32, AC-33, AC-34, AC-35, AC-36
  **依赖**: T001

### Phase 3: ValidationService 提取

- [ ] **T012**: ValidationService — 单元测试
  **文件**: `apps/server/tests/unit/test_validation_service.py`
  **逻辑**: 测试 ValidationService.validate()：
  - `test_validate_complete_ontology`：无问题时返回空列表
  - `test_validate_incomplete_ot`：缺字段时返回 error 级别 ValidationResult
  - `test_validate_type_incompatibility`：属性类型不兼容时返回 error
  - `test_validate_orphan_link_type`：孤立链接时返回 warning
  - `test_validate_apiname_conflict`：apiName 冲突时返回 error
  **覆盖 AC**: AC-28, AC-29, AC-30, AC-31
  **依赖**: T001

- [ ] **T013**: ValidationService — 实现 + WorkingStateService 重构
  **文件**: `apps/server/app/services/validation_service.py`, `apps/server/app/services/working_state_service.py`
  **逻辑**:
  - 创建 `ValidationService`，将 `_validate_completeness()` 和 `_validate_type_compatibility()` 逻辑提取过来
  - 新增校验：孤立链接类型（引用已删除 OT 的 LinkType）、apiName 冲突
  - 返回 `list[ValidationResult]` 而非抛异常
  - 重构 `WorkingStateService.publish()`：调用 `ValidationService.validate()`，将 error 级别结果转为 AppError
  - 确保现有 WorkingState 测试仍通过
  **测试**: T012 全部通过 + 现有 `test_working_state_service.py` 全部通过
  **覆盖 AC**: AC-28, AC-29, AC-30, AC-31
  **依赖**: T001

- [ ] **T014**: validate 命令 — 单元测试
  **文件**: `apps/server/tests/unit/test_cli_validate.py`
  **逻辑**: CliRunner 测试：
  - `test_validate_pass`：mock ValidationService 返回空列表，验证 "Validation passed"，exit 0
  - `test_validate_errors`：mock 返回 error 级别结果，验证 stdout 含 "ERROR:"，exit 1
  - `test_validate_warnings_only`：mock 返回 warning 级别结果，验证 stdout 含 "WARNING:"，exit 0
  **覆盖 AC**: AC-28, AC-29, AC-30, AC-31
  **依赖**: T013

- [ ] **T015**: validate 命令 — 实现
  **文件**: `apps/server/cli/commands/validate.py`
  **逻辑**:
  - `validate()` → ValidationService.validate(ontology_rid) → 格式化输出每个 ValidationResult
  - 有 error → exit 1；仅 warning 或无问题 → exit 0
  - 输出格式：`{SEVERITY}: {message}`，末尾汇总 `Result: N errors, M warnings`
  **测试**: T014 全部通过
  **覆盖 AC**: AC-28, AC-29, AC-30, AC-31
  **依赖**: T013

### Phase 4: 全局行为

- [ ] **T016**: 全局选项 + 错误处理 — 测试 + 实现
  **文件**: `apps/server/tests/unit/test_cli_global.py`, `apps/server/cli/main.py`（更新）, `apps/server/cli/adapter.py`（更新）
  **逻辑**:
  - 测试 `--format json` 全局切换：任意命令加 --format json 验证输出为 JSON
  - 测试 `--ontology <rid>` 传递：验证 ontology_rid 参数传递给 Service
  - 测试错误场景：DB 不可用时 stderr + exit 1
  - 在 adapter.py 中实现全局 ontology_rid 注入和 DB 连接错误捕获
  **覆盖 AC**: AC-37, AC-38, AC-39
  **依赖**: T003, T005, T007, T009, T011, T015

### Phase 5: SKILL.md 知识定义

- [ ] **T017**: L1 SKILL.md（10 个原子级 Skill）
  **文件**: `apps/server/app/agent/skills/{create-object-type,update-object-type,delete-object-type,create-property,create-link-type,update-link-type,import-dataset,list-object-types,search-ontology,validate-ontology}/SKILL.md`
  **逻辑**: 每个 SKILL.md 包含：
  - frontmatter: name, description, level: L1
  - 参数表格：参数名、类型、必填、说明
  - 约束：业务规则（apiName 唯一性、类型兼容等）
  - CLI 命令：对应的 `oo` 命令和参数
  - 使用场景：Agent 何时调用
  - 示例：完整命令示例
  - 参考 PRD §4.5 中的 create-object-type SKILL.md 示例格式
  **覆盖 AC**: AC-40
  **依赖**: T003（CLI 命令已实现，SKILL.md 中的 CLI 命令示例需准确）

- [ ] **T018**: L2 SKILL.md（3 个组合级 Skill）
  **文件**: `apps/server/app/agent/skills/{create-object-type-with-properties,create-link-type-with-validation,batch-create-from-blueprint}/SKILL.md`
  **逻辑**: 每个 SKILL.md 在 L1 基础上额外包含：
  - 组合步骤：引用哪些 L1 Skills，执行顺序
  - 编排逻辑：成功/失败处理
  - create-object-type-with-properties: 1) create-object-type → 2) 逐个 create-property
  - create-link-type-with-validation: 1) validate-ontology 预检 → 2) create-link-type
  - batch-create-from-blueprint: 1) 遍历蓝图项 → 2) 按依赖顺序调用 L1 Skills
  **覆盖 AC**: AC-41
  **依赖**: T017

- [ ] **T019**: L3 SKILL.md（3 个编排级 Skill）
  **文件**: `apps/server/app/agent/skills/{analyze-materials,generate-blueprint,optimize-ontology}/SKILL.md`
  **逻辑**: 每个 SKILL.md 额外包含：
  - 编排策略：Agent 如何规划执行
  - 子 Agent 调度建议：何时派生子 Agent
  - 上下文管理提示：token 预算、Schema 缓存策略
  - analyze-materials: 文件解析策略（结构化直接解析 vs 非结构化 LLM 提取）
  - generate-blueprint: 汇总多文件分析结果、合并去重、置信度评估
  - optimize-ontology: 分析现有本体、识别问题、提出优化建议
  - 注：这些 Skill 的实际执行逻辑由 F014 实现，此处仅定义知识
  **覆盖 AC**: AC-42
  **依赖**: T017

### Phase 6: Claude Code Skills

- [ ] **T020**: Claude Code Skills（6 个薄壳封装）
  **文件**: `.claude/skills/{ontology-create,ontology-search,ontology-validate,ontology-blueprint,ontology-analyze,ontology-optimize}/SKILL.md`
  **逻辑**: 使用 `/skill-creator` 创建 6 个 Claude Code Skills：
  - ontology-create: 创建本体资源，调用 `oo object-type create` / `oo property create` / `oo link-type create`
  - ontology-search: 搜索本体资源，调用 `oo search`
  - ontology-validate: 验证本体一致性，调用 `oo validate`
  - ontology-blueprint: 管理本体蓝图，调用 `oo blueprint *`（存根）
  - ontology-analyze: 分析资料生成本体，调用 `oo blueprint analyze`（存根）
  - ontology-optimize: 优化现有本体，调用 `oo validate` + 建议
  - 每个文件含 frontmatter（name, description）+ 对应 `oo` 命令调用示例
  **覆盖 AC**: AC-43
  **依赖**: T003（CLI 命令已实现）

### Phase 7: 集成验证

- [ ] **T021**: 端到端集成验证
  **文件**: 无新文件（运行现有测试 + 手动验证）
  **逻辑**:
  - 运行 `cd apps/server && uv run pytest tests/ -v` 确认所有现有测试仍通过（特别是 WorkingState 重构后）
  - 运行 `cd apps/server && uv run pytest tests/unit/test_cli_*.py -v` 确认所有 CLI 测试通过
  - 手动运行 `uv run oo --help` 验证所有命令组注册
  - 手动运行 `uv run oo --version` 验证版本输出
  - 验证所有 16 个 SKILL.md 文件存在且格式正确
  - 验证所有 6 个 Claude Code Skills 文件存在
  **覆盖 AC**: AC-01, AC-02
  **依赖**: T016, T017, T018, T019, T020

---

## 实际偏差记录

> 完成后，在此记录实现与 spec.md 的偏差，供后续参考。

- *（待填充）*
