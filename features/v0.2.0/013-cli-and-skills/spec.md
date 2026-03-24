# F013: CLI 工具与 Skills 体系

**关联 PRD**: `docs/prd/0.2.0/AI 辅助本体构建 PRD.md` §4.5 模块 E
**优先级**: P0
**所属版本**: v0.2.0

---

## 1. 概述与用户故事

### 背景

v0.2.0 引入 **统一能力层** 原则：`oo` CLI 是本体操作的唯一执行路径，deepagents Agent、开发者、Claude Code 均通过同一路径操作本体。SKILL.md 是 Agent 的唯一知识源，定义参数、约束、使用场景和对应 CLI 命令。

### US-1 开发者通过 CLI 管理本体

作为 **开发者**，我希望通过 `oo` 命令行工具执行本体 CRUD 操作，以便在终端或 CI/CD 流程中高效管理本体资源。

### US-2 Agent 通过 CLI 执行原子操作

作为 **deepagents Agent**，我希望读取 SKILL.md 获取调用知识并执行 `oo` CLI 命令，以便按照统一能力层完成本体构建操作。

### US-3 Claude Code 用户通过 Skills 操作本体

作为 **Claude Code 用户**，我希望通过 `/ontology-*` 快捷技能调用 `oo` CLI 命令，以便在 IDE 中快速执行本体操作。

---

## 2. 验收标准

| ID | 角色 | 操作 | 预期结果 |
|----|------|------|---------|
| **CLI 基础** | | | |
| AC-01 | 开发者 | 在 `apps/server` 下运行 `uv run oo --help` | 显示所有命令组（object-type, property, link-type, dataset, blueprint, search, validate, working-state），exit code 0 |
| AC-02 | 开发者 | 运行 `uv run oo --version` | 显示 `oo 0.2.0`，exit code 0 |
| **object-type 组** | | | |
| AC-03 | 开发者 | `oo object-type create --name "Order"` | stdout: `Created object type "Order" (ApiName: Order). RID: ri.ontology.object-type.<uuid>`，exit 0，进入 WorkingState 草稿 |
| AC-04 | 开发者 | `oo object-type create --name "Order" --api-name "OrderV2"` | 使用指定 apiName 而非自动推断，stdout 含 `ApiName: OrderV2` |
| AC-05 | 开发者 | `oo object-type list` | stdout 文本表格显示列表（RID, DisplayName, ApiName, Status, ChangeState），exit 0 |
| AC-06 | 开发者 | `oo object-type list --format json` | stdout JSON 数组格式 |
| AC-07 | 开发者 | `oo object-type get <rid>` | stdout 多行 key: value 详情，exit 0 |
| AC-08 | 开发者 | `oo object-type get <不存在的rid>` | stderr: `Error: Object type '<rid>' not found`，exit 1 |
| AC-09 | 开发者 | `oo object-type update <rid> --name "新名称"` | stdout: `Updated object type "<rid>".`，exit 0 |
| AC-10 | 开发者 | `oo object-type delete <rid>` | stdout: `Deleted object type "<rid>".`，exit 0 |
| AC-11 | 开发者 | `oo object-type delete <active状态的rid>` | stderr: `Error: Cannot delete an active object type`，exit 1 |
| **property 组** | | | |
| AC-12 | 开发者 | `oo property create --object-type <ot_rid> --name "金额" --api-name "amount" --type double` | stdout: `Created property "金额" (amount: double). RID: ri.ontology.property.<uuid>`，exit 0 |
| AC-13 | 开发者 | `oo property list --object-type <ot_rid>` | stdout 文本表格显示属性列表 |
| AC-14 | 开发者 | `oo property update <prop_rid> --object-type <ot_rid> --name "总金额"` | stdout: `Updated property "<rid>".`，exit 0 |
| AC-15 | 开发者 | `oo property delete <prop_rid> --object-type <ot_rid>` | stdout: `Deleted property "<rid>".`，exit 0 |
| **link-type 组** | | | |
| AC-16 | 开发者 | `oo link-type create --id "order-items" --side-a-object <ot_a> --side-a-name "Items" --side-a-api-name "items" --side-b-object <ot_b> --side-b-name "Order" --side-b-api-name "order" --cardinality many-to-one` | stdout: `Created link type "order-items". RID: ri.ontology.link-type.<uuid>`，exit 0 |
| AC-17 | 开发者 | `oo link-type list` | stdout 文本表格 |
| AC-18 | 开发者 | `oo link-type get <rid>` | stdout 详情 |
| AC-19 | 开发者 | `oo link-type delete <rid>` | stdout: `Deleted link type "<rid>".`，exit 0 |
| **dataset 组** | | | |
| AC-20 | 开发者 | `oo dataset list` | stdout 文本表格（RID, Name, Source, RowCount） |
| AC-21 | 开发者 | `oo dataset import-csv <filepath>` | 读取本地 CSV，stdout: `Imported dataset "<name>". RID: ri.ontology.dataset.<uuid>. Columns: N, Rows: M`，exit 0 |
| AC-22 | 开发者 | `oo dataset import-excel <filepath> --sheet "Sheet1"` | 读取 Excel 指定 sheet |
| AC-23 | 开发者 | `oo dataset import-csv <不存在的文件>` | stderr: `Error: File not found: <path>`，exit 1 |
| **search** | | | |
| AC-24 | 开发者 | `oo search "客户"` | stdout 跨资源搜索结果（按 objectType/property/linkType 分区显示），exit 0 |
| AC-25 | 开发者 | `oo search "客户" --type objectType` | 仅搜索对象类型 |
| AC-26 | 开发者 | `oo search "无匹配"` | stdout: `No results found.`，exit 0 |
| **validate** | | | |
| AC-27 | 开发者 | `oo validate`（本体完整无问题） | stdout: `Validation passed. No issues found.`，exit 0 |
| AC-28 | 开发者 | `oo validate`（存在不完整 OT） | stdout 含 `ERROR: Object type "X" is incomplete: missing <fields>`，exit 1 |
| AC-29 | 开发者 | `oo validate`（存在类型不兼容） | stdout 含 `ERROR: Property "x" type "integer" incompatible with column "y" type "string"`，exit 1 |
| AC-30 | 开发者 | `oo validate`（存在孤立链接类型） | stdout 含 `WARNING: Link type "x" references deleted object type`，exit 0（warning 不导致失败） |
| **working-state 组** | | | |
| AC-31 | 开发者 | `oo working-state show` | 显示草稿变更列表（ResourceType, RID, ChangeType），无草稿时输出 `No pending changes.` |
| AC-32 | 开发者 | `oo working-state save` | 发布草稿，stdout: `Published N changes (version M).`，exit 0 |
| AC-33 | 开发者 | `oo working-state save`（无草稿） | stderr: `Error: No changes to publish`，exit 1 |
| AC-34 | 开发者 | `oo working-state discard` | 丢弃草稿，stdout: `Discarded all draft changes.`，exit 0 |
| **blueprint 存根** | | | |
| AC-35 | 开发者 | `oo blueprint analyze/list/show/apply` | stderr: `Error: Blueprint commands not yet implemented (requires F014).`，exit 2 |
| **全局行为** | | | |
| AC-36 | 开发者 | 任意命令加 `--format json` | 输出切换为 JSON |
| AC-37 | 开发者 | 任意命令失败 | 错误信息到 stderr，exit code 非 0 |
| AC-38 | 开发者 | `oo --ontology <rid> object-type list` | 使用指定 ontology RID |
| **SKILL.md** | | | |
| AC-39 | Agent | 查看 L1 SKILL.md（7 个） | 每个文件含 frontmatter（name, description, level: L1）+ 参数 + 约束 + CLI 命令 + 使用场景 + 示例 |
| AC-40 | Agent | 查看 L2 SKILL.md（3 个） | 每个文件额外含组合步骤（引用 L1 skills）和编排逻辑 |
| AC-41 | Agent | 查看 L3 SKILL.md（3 个） | 每个文件含编排策略、子 Agent 调度建议、上下文管理提示 |
| **Claude Code Skills** | | | |
| AC-42 | CC 用户 | 查看 `.claude/skills/ontology-*/SKILL.md`（6 个） | 每个文件为薄壳封装，含描述 + `oo` CLI 调用示例 |

---

## 3. 边界情况

- 数据库连接不可用时，stderr 输出 `Error: Database connection failed`，exit 1
- `--ontology` 指定不存在的 RID 时，stderr 输出 `Error: Ontology not found`，exit 1
- `--format` 指定无效格式时，stderr 输出 `Error: Unsupported format. Use 'text' or 'json'.`，exit 1
- CSV/Excel 导入超过 50MB 限制时，stderr 输出 `Error: File exceeds maximum size`，exit 1
- **不支持**：交互式输入（LLM-Native 设计，所有输入通过参数传入）
- **不支持**：管道输入（stdin），延后到 v0.3.0
- **不支持**：blueprint 命令实际逻辑（仅存根，实际由 F014/F017 实现）

---

## 4. 架构决策

| ID | 决策 | 结论 | 理由 |
|----|------|------|------|
| AD-01 | CLI 框架 | typer + rich | typer 类型安全声明式命令定义，rich 美观表格输出 |
| AD-02 | CLI 目录位置 | `apps/server/cli/`（与 `app/` 平级） | CLI 是独立入口，不属于 FastAPI app 包 |
| AD-03 | async 桥接 | `asyncio.run()` per command | 每个命令独立同步入口，内部调用 async Service，简洁无并发需求 |
| AD-04 | Session 管理 | CLI adapter 自建 session | CLI 不经过 FastAPI，独立创建 async_session_factory 管理 session |
| AD-05 | 输出格式 | 默认 text + `--format json` | LLM-Native：默认纯文本低 token 消耗，开发者可选 JSON |
| AD-06 | Entry point | `pyproject.toml` `[project.scripts]` | 标准 Python 包方式，`uv run oo` 即可执行 |
| AD-07 | SKILL.md 位置 | `apps/server/app/agent/skills/<name>/SKILL.md` | 运行时资产（Agent 按需加载），扁平目录结构 |
| AD-08 | blueprint 命令 | 创建存根返回 "not implemented" | 保持命令结构完整，F014 填充逻辑 |
| AD-09 | validate 实现 | 提取为独立 ValidationService | 从 WorkingStateService 重构验证逻辑为独立服务，CLI 和 publish 共用 |
| AD-10 | dataset import | CLI adapter 直接调用 FileImportService | 读取本地文件传递给 Service 解析逻辑，绕过 HTTP multipart |

---

## 5. 数据库 & Domain 模型

本特性不引入新数据库表。CLI 完全复用 v0.1.0 的 Service 层和现有 Domain 模型。

**新增 Service**：

```python
# app/services/validation_service.py
class ValidationResult(DomainModel):
    severity: Literal["error", "warning"]  # error = 阻止发布, warning = 信息性
    code: str                              # 错误码
    message: str                           # 人类可读描述
    resource_type: str                     # objectType / property / linkType
    resource_rid: str | None = None        # 相关资源 RID

class ValidationService:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def validate(self, ontology_rid: str) -> list[ValidationResult]:
        """运行所有验证规则，返回问题列表（不抛异常）。"""
        # 从 WorkingStateService 提取的验证逻辑
```

**重构**：`WorkingStateService.publish()` 调用 `ValidationService.validate()`，将 error 级别结果转为 AppError。

---

## 6. CLI 命令规格

### 6.1 全局选项

| 选项 | 短写 | 类型 | 默认值 | 说明 |
|------|------|------|--------|------|
| `--ontology` | `-o` | str | `ri.ontology.ontology.default` | 目标本体 RID |
| `--format` | `-f` | text / json | text | 输出格式 |
| `--version` | | flag | | 显示版本号 |
| `--help` | `-h` | flag | | 显示帮助 |

### 6.2 object-type 命令组

| 命令 | 参数 | 必填 | 说明 |
|------|------|------|------|
| `create` | `--name` | 否 | displayName（不填自动生成占位名） |
| | `--api-name` | 否 | apiName（不填从 name 推断 PascalCase） |
| | `--id` | 否 | 唯一 ID（不填从 name 推断 kebab-case） |
| | `--description` | 否 | 描述 |
| `list` | `--page` | 否 | 页码，默认 1 |
| | `--page-size` | 否 | 每页条数，默认 20 |
| `get` | `<rid>` 位置参数 | 是 | 对象类型 RID |
| `update` | `<rid>` 位置参数 | 是 | |
| | `--name`, `--api-name`, `--description`, `--status` | 否 | 可更新字段 |
| `delete` | `<rid>` 位置参数 | 是 | |

### 6.3 property 命令组

| 命令 | 参数 | 必填 | 说明 |
|------|------|------|------|
| `create` | `--object-type` | 是 | 所属 OT RID |
| | `--name` | 是 | displayName |
| | `--api-name` | 是 | apiName (camelCase) |
| | `--type` | 是 | baseType (string, integer, double, boolean, date, timestamp, ...) |
| | `--id` | 否 | 属性 ID（不填从 api-name 推断） |
| | `--description` | 否 | |
| | `--backing-column` | 否 | 映射列名 |
| `list` | `--object-type` | 是 | 所属 OT RID |
| `update` | `<rid>` + `--object-type` | 是 | |
| | `--name`, `--api-name`, `--description` | 否 | 可更新字段 |
| `delete` | `<rid>` + `--object-type` | 是 | |

### 6.4 link-type 命令组

| 命令 | 参数 | 必填 | 说明 |
|------|------|------|------|
| `create` | `--id` | 是 | 唯一 ID |
| | `--side-a-object`, `--side-a-name`, `--side-a-api-name` | 是 | Side A 定义 |
| | `--side-b-object`, `--side-b-name`, `--side-b-api-name` | 是 | Side B 定义 |
| | `--cardinality` | 是 | one-to-one / one-to-many / many-to-one / many-to-many |
| `list` | `--object-type` | 否 | 按 OT 筛选 |
| `get` | `<rid>` | 是 | |
| `delete` | `<rid>` | 是 | |

### 6.5 dataset 命令组

| 命令 | 参数 | 必填 | 说明 |
|------|------|------|------|
| `list` | — | — | 列出所有数据集 |
| `import-csv` | `<filepath>` | 是 | 本地 CSV 路径 |
| | `--name` | 否 | 数据集名称（默认取文件名） |
| `import-excel` | `<filepath>` | 是 | 本地 Excel 路径 |
| | `--sheet` | 否 | Sheet 名（默认首个） |
| | `--name` | 否 | 数据集名称 |

### 6.6 search

| 参数 | 必填 | 说明 |
|------|------|------|
| `<query>` 位置参数 | 是 | 搜索关键词 |
| `--type` | 否 | 资源类型筛选（objectType/property/linkType） |
| `--limit` | 否 | 最大结果数，默认 20 |

### 6.7 validate

无额外参数。对当前本体运行全部校验规则。

校验项：
1. 不完整对象类型（缺 displayName/id/apiName/backingDatasource/primaryKeyPropertyId/titleKeyPropertyId/mappedProperties）
2. 属性类型与数据集列类型不兼容
3. 孤立链接类型（引用已删除的 OT）
4. apiName 唯一性冲突（跨已发布 + 草稿）

### 6.8 working-state

| 命令 | 参数 | 必填 | 说明 |
|------|------|------|------|
| `show` | — | — | 显示草稿变更列表 |
| `save` | — | — | 发布草稿（调用 publish） |
| `discard` | — | — | 丢弃所有草稿变更 |

### 6.9 blueprint（存根）

`analyze`, `list`, `show`, `apply` 四个子命令均输出 "not implemented"，exit 2。

---

## 7. Service / CLI Adapter 层逻辑

### CLI Adapter 架构

```
typer CLI command
  → cli/adapter.py: run_async(async_fn)
    → asyncio.run(wrapper())
      → async_session_factory() → session
        → Service(session).method()
      → session.commit() / rollback()
    → 格式化输出 → stdout
    → 捕获 AppError → stderr + exit 1
```

### ValidationService 提取

从 `WorkingStateService` 提取 `_validate_completeness()` 和 `_validate_type_compatibility()` 为独立 `ValidationService`：

- 返回 `list[ValidationResult]` 而非抛异常
- 新增校验：孤立链接类型检测、apiName 冲突检测
- `WorkingStateService.publish()` 改为调用 `ValidationService.validate()`，将 error 级别结果转为 AppError

---

## 8. SKILL.md 格式与目录

### SKILL.md 模板

```markdown
---
name: <skill-name>
description: <一句话描述，Agent 懒加载时使用>
level: L1 | L2 | L3
---

## 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 否 | ... |

## 约束

- 约束条件

## CLI 命令

\`oo <resource> <action> [--args]\`

## 使用场景

何时调用此 Skill。

## 示例

\`\`\`bash
oo object-type create --name "Order"
\`\`\`
```

L2 额外含「组合步骤」，L3 额外含「编排策略」和「子 Agent 调度」。

### 目录（扁平结构）

```
apps/server/app/agent/skills/
├── create-object-type/SKILL.md      # L1
├── update-object-type/SKILL.md      # L1
├── delete-object-type/SKILL.md      # L1
├── create-property/SKILL.md         # L1
├── create-link-type/SKILL.md        # L1
├── search-ontology/SKILL.md         # L1
├── validate-ontology/SKILL.md       # L1
├── create-object-type-with-properties/SKILL.md  # L2
├── create-link-type-with-validation/SKILL.md    # L2
├── batch-create-from-blueprint/SKILL.md         # L2
├── analyze-materials/SKILL.md       # L3
├── generate-blueprint/SKILL.md      # L3
└── optimize-ontology/SKILL.md       # L3
```

---

## 9. Claude Code Skills

6 个薄壳 Skill，使用 `/skill-creator` 创建：

| Skill 名 | 描述 | 对应 oo 命令 |
|-----------|------|-------------|
| ontology-create | 创建本体资源（OT/Property/LT） | `oo object-type create`, `oo property create`, `oo link-type create` |
| ontology-search | 搜索本体资源 | `oo search` |
| ontology-validate | 验证本体一致性 | `oo validate` |
| ontology-blueprint | 管理本体蓝图 | `oo blueprint *`（存根） |
| ontology-analyze | 分析资料生成本体 | `oo blueprint analyze`（存根） |
| ontology-optimize | 优化现有本体 | `oo validate` + 建议优化 |

存放位置：`.claude/skills/ontology-*/SKILL.md`

---

## 10. 文件清单

### 新建文件

```
apps/server/
├── cli/
│   ├── __init__.py
│   ├── main.py                  # typer App 入口 + 全局选项
│   ├── adapter.py               # async 桥接 + session 管理 + 错误处理
│   ├── output.py                # text 表格 + JSON 输出格式化
│   └── commands/
│       ├── __init__.py
│       ├── object_type.py       # object-type 命令组
│       ├── property_cmd.py      # property 命令组（避免与 Python builtin 冲突）
│       ├── link_type.py         # link-type 命令组
│       ├── dataset.py           # dataset 命令组
│       ├── search.py            # search 命令
│       ├── validate.py          # validate 命令
│       ├── working_state.py     # working-state 命令组
│       └── blueprint.py         # blueprint 存根
├── app/
│   └── services/
│       └── validation_service.py  # 新增：从 WorkingStateService 提取的验证逻辑
├── app/agent/
│   └── skills/                    # 13 个 SKILL.md（见 §8）
│       └── <name>/SKILL.md

.claude/skills/                    # 6 个 Claude Code Skills（见 §9）
└── ontology-*/SKILL.md
```

### 修改文件

```
apps/server/pyproject.toml                           # +typer, +rich 依赖 + [project.scripts] oo 入口
apps/server/app/services/working_state_service.py     # 重构：验证逻辑委托给 ValidationService
```

---

## 11. 非功能要求

- **性能**：CLI 冷启动（含 Python + 模块加载）< 2 秒；单 CRUD 命令端到端 < 1 秒
- **输出设计**：LLM-Native — 默认纯文本简明输出，错误输出到 stderr，便于 Agent 解析和自我纠正
- **INV-14 合规**：所有本体操作通过 `oo` CLI 统一入口，Agent 破坏性操作的授权确认由 Agent 编排层（F012）负责

---

## 12. 相关文档

| 文档 | 路径 |
|------|------|
| PRD | `docs/prd/0.2.0/AI 辅助本体构建 PRD.md` §4.5 |
| Release Contract | `features/v0.2.0/release-contract.md` |
| Service 层 | `apps/server/app/services/*.py` |
| Domain 模型 | `apps/server/app/domain/*.py` |
| 架构文档 | `docs/architecture/04-tech-stack-recommendations.md` |
