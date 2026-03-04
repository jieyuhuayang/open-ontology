---
name: sdd-review
description: 对 Open Ontology 项目的 SDD 文档执行审查。
  - spec：写完 spec.md 后调用，生成 PRD gap 报告供用户参考（不自动修改，需用户确认）
  - design：写完 design.md 后自动调用，通过则自动写 tasks.md
  - tasks：写完 tasks.md 后自动调用，通过则自动开始实现
  用法：/sdd-review <feature_dir> <doc_type>，doc_type 为 spec / design / tasks。
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

### spec 模式（辅助审查，不自动推进）

1. 读取 `<feature_dir>/spec.md`，提取"关联 PRD"路径
2. 读取 `references/spec-checklist.md` 中的提示词，将 `{feature_dir}` 和 `{prd_path}` 替换为实际值
3. 调用 codex（read-only sandbox）执行审查：
   ```bash
   codex exec -s read-only --ephemeral -o /tmp/sdd-review-output.md "<prompt>"
   ```
4. 读取 `/tmp/sdd-review-output.md`，向用户展示 gap 报告：
   - LGTM → 告知"未发现 PRD gap，可继续确认"
   - 有 MISSING/FORMAT/CONFLICT → 向用户展示报告，等待用户决定是否补充 AC
5. **等待用户确认**（唯一手动暂停点），用户说"可以写 design 了"后更新 tasks.md 状态表 spec.md 行为 ✅ 已评审

### design / tasks 模式（全自动）

1. **解析参数**：从用户输入或调用上下文中提取 `feature_dir` 和 `doc_type`（design 或 tasks）

2. **收集上下文**：读取以下文件（在提示词中列出，由 codex 在 read-only sandbox 中自行读取）：
   - `<feature_dir>/spec.md`（验收标准来源）
   - `features/v0.1.0/release-contract.md`（不变量约束）
   - 若 doc_type=tasks，还需 `<feature_dir>/design.md`
   - 相关架构文档（按 spec.md 中"关联文档"字段）

3. **调用 codex 执行审查**：
   ```bash
   codex exec -s read-only --ephemeral -o /tmp/sdd-review-output.md "<prompt>"
   ```
   - design 审查使用 `references/design-checklist.md` 中的提示词模板
   - tasks 审查使用 `references/tasks-checklist.md` 中的提示词模板
   - 将 `{feature_dir}` 替换为实际路径

4. **读取并解析输出** `/tmp/sdd-review-output.md`：
   - 只有 "LGTM" → **通过**，更新 tasks.md 状态表对应行为 ✅ 已评审 / ✅ 已拆解，继续下一步
   - 有 ISSUE 列表 → 按 severity 优先级修复：
     - `high`：必须修复
     - `medium`：必须修复
     - `low`：可选，记录但跳过
   - 修复后**重新调用 codex 审查**（最多 2 轮）
   - 2 轮后仍有 high/medium → 停止，向用户报告剩余问题

5. **通过后自动推进**：
   - design 审查通过 → 自动写 tasks.md，无需用户确认
   - tasks 审查通过 → 自动开始执行第一个任务，无需用户确认

## spec.md 审查提示词

见 `references/spec-checklist.md`

## design.md 审查提示词

见 `references/design-checklist.md`

## tasks.md 审查提示词

见 `references/tasks-checklist.md`

## 错误处理

- 若 codex 命令不存在：向用户报告"codex CLI 未安装，请先安装 codex"，并停止
- 若 feature_dir 不存在：报告路径错误
- 若 doc_type 不是 spec / design / tasks：报告参数错误
