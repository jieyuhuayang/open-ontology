---
name: sdd-review
description: 对 Open Ontology 项目的 SDD 文档执行审查。
  - spec：写完 spec.md 后调用，生成 PRD gap 报告供用户参考（不自动修改，需用户确认）
  - design：写完 design.md 后自动调用，通过则自动写 tasks.md
  - tasks：写完 tasks.md 后自动调用，通过则自动开始实现
  用法：/sdd-review <feature_dir> <doc_type>，doc_type 为 spec / design / tasks。
  TRIGGER when: 用户完成了 SDD 的 spec.md / design.md / tasks.md 编写，或者用户使用 /sdd-review 命令，或者 Claude 完成了这些文件的编写后需要自动审查。
---

# SDD Review Skill

## 调用方式

```
/sdd-review <feature_dir> <doc_type>
```

例：
```
/sdd-review features/v0.1.0/010-data-connection spec
/sdd-review features/v0.1.0/010-data-connection design
/sdd-review features/v0.1.0/010-data-connection tasks
```

## 审查流程

### 第一步：解析参数

从用户输入或调用上下文中提取：
- `feature_dir`：特性目录路径（如 `features/v0.1.0/005-object-type-crud-frontend`）
- `doc_type`：文档类型，必须是 `spec`、`design` 或 `tasks`

若参数缺失或无效，向用户报告错误后停止。

---

### spec 模式（辅助审查，不自动推进）

**第二步（spec）：执行 PRD gap 分析**

读取文件：
- `<feature_dir>/spec.md`（已写的规范）
- spec.md 中"关联 PRD"字段指向的文件（若未标注，读取 `docs/prd/` 下与特性名最相关的文件）
- `features/v0.1.0/release-contract.md`（不变量约束，确认 spec 未越界）

分析维度：
1. PRD 中描述的功能点 / 用户场景，spec 是否有对应 AC？
2. PRD 中提到的边界条件、错误场景，spec 是否有覆盖？
3. PRD 中提到的 UI 交互细节（spec 应有对应业务 AC，UI 细节可留 design.md 覆盖）
4. spec 的 AC 表格格式是否正确：`| ID | 角色 | 操作 | 预期结果 |`？
5. 是否有 AC 不可测试（过于模糊）？
6. 是否与 release-contract.md 的 INV 不变量冲突？

**第三步（spec）：展示 gap 报告，等待用户确认**

向用户展示分析结果：
- 无 gap：告知"未发现 PRD gap，可继续确认"
- 有 gap：展示每个问题（MISSING / FORMAT / CONFLICT），供用户决定是否补充 AC

**等待用户说"可以写 design 了"**（唯一手动暂停点）。用户确认后，将 `<feature_dir>/tasks.md` 状态表中 spec.md 行更新为 `✅ 已评审`。

---

### design / tasks 模式（全自动）

**第二步（design/tasks）：执行审查**

**优先使用 codex（若已安装）**：
```bash
# 检查 codex 是否存在
which codex 2>/dev/null

# design 审查
codex exec -s read-only --ephemeral -o /tmp/sdd-review-output.md "$(cat references/design-checklist.md | sed 's|{feature_dir}|<feature_dir>|g')"

# tasks 审查
codex exec -s read-only --ephemeral -o /tmp/sdd-review-output.md "$(cat references/tasks-checklist.md | sed 's|{feature_dir}|<feature_dir>|g')"
```

**若 codex 未安装，由 Claude 直接审查**（见第三步 / 第四步检查清单）。

### 第三步：design.md 检查清单

读取文件：
- `<feature_dir>/spec.md`（验收标准）
- `features/v0.1.0/release-contract.md`（不变量和领域归属）
- spec.md 中"关联 PRD"字段指向的文件
- `docs/architecture/02-domain-model.md`（领域模型规范）
- `docs/architecture/04-tech-stack-recommendations.md`（技术栈规范）

检查项：
1. **AC 覆盖**：spec.md 中每条 AC 是否都有技术覆盖（API 端点 / 数据结构 / 前端组件）？
2. **不变量合规**：是否违反 release-contract.md 中任何 INV 不变量？
3. **领域边界**：是否越界进入 release-contract.md 表1 中归属其他 feature 的领域？
4. **API 契约完整性**：端点列表、请求/响应示例、错误码表格是否完整（含关联 AC）？
5. **架构合规**：
   - 分层严格自顶向下：routers → services → domain/storage，禁止反向导入
   - API JSON 输出 camelCase，内部 snake_case（alias_generator 转换）
   - 主键格式：rid TEXT，`ri.<namespace>.<type>.<uuid4>`
   - 错误格式：`{ "error": { "code": "UPPER_SNAKE_CASE", "message": "...", "details": {} } }`
6. **文档规范**：design.md 只写 Why+What，不写 How，不写测试策略

### 第四步：tasks.md 检查清单

读取文件：
- `<feature_dir>/spec.md`（验收标准）
- `<feature_dir>/design.md`（技术方案）

检查项：
1. **AC 追溯**：spec.md 中每条 AC 是否都有至少一个测试任务覆盖（带"覆盖 AC:"标注）？
2. **AC 标注**：是否存在缺少"覆盖 AC:"标注的测试任务？
3. **Test-First 顺序**：测试任务是否先于其配对的实现任务？
4. **依赖关系**：被依赖的任务 ID 是否存在、顺序是否合理？
5. **原子化**：每个任务范围是否 ≤ 2 个文件，能在一次会话内完成？

### 第五步：处理审查结果（design / tasks）

**输出格式**：
- design 问题：`- ISSUE: <描述> | SEVERITY: high/medium/low | AC: <AC-XX 若适用>`
- tasks 问题：`- ISSUE: <描述> | SEVERITY: high/medium/low | TASK: <T-NN 若适用>`
- 无问题：`LGTM`

**处理逻辑**：
- `LGTM` → 更新 `<feature_dir>/tasks.md` 状态表：
  - design 审查通过：将 `design.md` 行改为 `✅ 已评审`
  - tasks 审查通过：将 `tasks.md` 行改为 `✅ 已拆解`
  - **立即自动推进**（无需用户确认）
- 有 `high`/`medium` ISSUE → 修复 `<feature_dir>/design.md` 或 `tasks.md` 后重新审查（最多 2 轮）
- `low` ISSUE → 记录但跳过
- 2 轮后仍有 `high`/`medium` → 停止，向用户报告剩余问题

### 第六步：通过后自动推进

- **design 审查通过** → 立即开始编写 `<feature_dir>/tasks.md`，无需等待用户确认
- **tasks 审查通过** → 立即开始执行第一个任务（T001），无需等待用户确认

## 错误处理

- codex 未安装 → 由 Claude 直接执行审查，行为等价
- feature_dir 不存在 → 报告路径错误，停止
- doc_type 不是 spec / design / tasks → 报告参数错误，停止
- spec.md 不存在 → 报告"找不到 spec.md，请先完成 spec 评审"，停止
