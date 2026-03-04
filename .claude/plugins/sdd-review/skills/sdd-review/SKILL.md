---
name: sdd-review
description: 对 Open Ontology 项目的 SDD 文档执行审查。
  - spec：写完 spec.md 后调用，同时检查 PRD gap 和架构合规性，生成报告供用户参考
  - tasks：写完 tasks.md 后可选调用，检查 AC 追溯和任务原子化
  用法：/sdd-review <feature_dir> <doc_type>，doc_type 为 spec / tasks。
  TRIGGER when: 用户完成了 SDD 的 spec.md / tasks.md 编写，或者用户使用 /sdd-review 命令，或者 Claude 完成了这些文件的编写后需要审查。
---

# SDD Review Skill

## 调用方式

```
/sdd-review <feature_dir> <doc_type>
```

例：
```
/sdd-review features/v0.1.0/010-data-connection spec
/sdd-review features/v0.1.0/010-data-connection tasks
```

## 审查流程

### 第一步：解析参数

从用户输入或调用上下文中提取：
- `feature_dir`：特性目录路径（如 `features/v0.1.0/005-object-type-crud-frontend`）
- `doc_type`：文档类型，必须是 `spec` 或 `tasks`

若参数缺失或无效，向用户报告错误后停止。

---

### spec 模式（辅助审查，不自动推进）

spec.md 现在合并了需求规范和技术设计，因此 spec 审查同时覆盖原来的 spec 和 design 检查项。

**第二步（spec）：执行合并审查**

读取文件：
- `<feature_dir>/spec.md`（已写的规格文档）
- spec.md 中"关联 PRD"字段指向的文件（若未标注，读取 `docs/prd/` 下与特性名最相关的文件）
- `features/v0.1.0/release-contract.md`（不变量约束，确认 spec 未越界）
- `docs/architecture/02-domain-model.md`（领域模型规范）
- `docs/architecture/04-tech-stack-recommendations.md`（技术栈规范）

**需求分析维度**（原 spec 检查项）：
1. PRD 中描述的功能点 / 用户场景，spec 是否有对应 AC？
2. PRD 中提到的边界条件、错误场景，spec 是否有覆盖？
3. PRD 中提到的 UI 交互细节，spec 是否有对应业务 AC？
4. spec 的 AC 表格格式是否正确：`| ID | 角色 | 操作 | 预期结果 |`？
5. 是否有 AC 不可测试（过于模糊）？
6. 是否与 release-contract.md 的 INV 不变量冲突？

**架构合规维度**（原 design 检查项）：
7. spec.md 中每条 AC 是否都有技术覆盖（API 端点 / 数据结构 / 前端组件）？
8. 是否越界进入 release-contract.md 表1 中归属其他 feature 的领域？
9. API 契约完整性：端点列表、请求/响应示例、错误码表格是否完整（含关联 AC）？
10. 架构合规：
    - 分层严格自顶向下：routers → services → domain/storage，禁止反向导入
    - API JSON 输出 camelCase，内部 snake_case（alias_generator 转换）
    - 主键格式：rid TEXT，`ri.<namespace>.<type>.<uuid4>`
    - 错误格式：`{ "error": { "code": "UPPER_SNAKE_CASE", "message": "...", "details": {} } }`
11. 文档规范：设计部分只写 Why+What，不写 How，不写测试策略

**第三步（spec）：展示报告，等待用户确认**

向用户展示分析结果：
- 无 gap / 无问题：告知"审查通过，可继续确认"
- 有 gap / 有问题：展示每个问题（MISSING / FORMAT / CONFLICT / ISSUE），供用户决定是否修改

**等待用户确认**（唯一手动暂停点）。用户确认后，将 `<feature_dir>/tasks.md` 状态表中 spec.md 行更新为 `✅ 已评审`。

---

### tasks 模式（可选审查）

**第二步（tasks）：执行审查**

**优先使用 codex（若已安装）**：
```bash
# 检查 codex 是否存在
which codex 2>/dev/null

# tasks 审查
codex exec -s read-only --ephemeral -o /tmp/sdd-review-output.md "$(cat references/tasks-checklist.md | sed 's|{feature_dir}|<feature_dir>|g')"
```

**若 codex 未安装，由 Claude 直接审查**（见第三步检查清单）。

### 第三步：tasks.md 检查清单

读取文件：
- `<feature_dir>/spec.md`（验收标准 + 技术方案）

检查项：
1. **AC 追溯**：spec.md 中每条 AC 是否都有至少一个测试任务覆盖（带"覆盖 AC:"标注）？
2. **AC 标注**：是否存在缺少"覆盖 AC:"标注的测试任务？
3. **Test-First 顺序**：测试任务是否先于其配对的实现任务？
4. **依赖关系**：被依赖的任务 ID 是否存在、顺序是否合理？
5. **原子化**：每个任务范围是否 ≤ 2 个文件，能在一次会话内完成？
6. **自包含**：每个任务是否内联了文件、逻辑、测试上下文？

### 第四步：处理审查结果（tasks）

**输出格式**：
- tasks 问题：`- ISSUE: <描述> | SEVERITY: high/medium/low | TASK: <T-NN 若适用>`
- 无问题：`LGTM`

**处理逻辑**：
- `LGTM` → 更新 `<feature_dir>/tasks.md` 状态表，将 `tasks.md` 行改为 `✅ 已拆解`
- 有 `high`/`medium` ISSUE → 修复后重新审查（最多 2 轮）
- `low` ISSUE → 记录但跳过
- 2 轮后仍有 `high`/`medium` → 停止，向用户报告剩余问题

## 错误处理

- codex 未安装 → 由 Claude 直接执行审查，行为等价
- feature_dir 不存在 → 报告路径错误，停止
- doc_type 不是 spec / tasks → 报告参数错误，停止
- spec.md 不存在 → 报告"找不到 spec.md，请先完成 spec"，停止
