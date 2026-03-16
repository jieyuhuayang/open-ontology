---
name: task-review
description: L1 任务级代码审查。在每个任务完成后执行轻量级约定合规检查，
  确保架构红线和编码约定在任务级别被守住，不让违规累积到特性级审查（L2）才发现。
  用法：/task-review <feature_dir> <task_id>
  TRIGGER when: 用户完成了一个 SDD 任务（实现或测试），或者用户使用 /task-review 命令。
---

# Task Review Skill（L1 任务级审查）

## 调用方式

```
/task-review <feature_dir> <task_id>
```

例：
```
/task-review features/v0.1.0/003-object-type-crud T003
/task-review features/v0.1.0/005-object-type-crud-frontend T007
```

## 审查流程

### Step 1: 解析参数 + 收集变更范围

1. 验证参数：
   - `feature_dir` 必须存在且包含 `tasks.md`
   - `task_id` 必须匹配 tasks.md 中的某个任务（格式：`T001`、`T003` 等）
   - 若参数缺失或无效，报告错误后停止

2. 从 `<feature_dir>/tasks.md` 中读取指定任务的元数据：
   - 任务类型（测试 / 实现 / 基础设施）
   - 目标文件列表
   - 前置依赖
   - 配对任务（测试↔实现）
   - 覆盖 AC 标注（测试任务）

3. 读取任务声明的所有目标文件内容（直接读取文件，不依赖 git diff）

### Step 2: 判断任务类型，选择检查子集

根据任务类型确定适用的检查项（参见 `references/task-checklist.md`）：

- **测试任务**：仅 #2 命名 + #5 i18n + AC 标注格式
- **实现任务**：完整 #1~#6 + 验证配对测试已完成
- **基础设施任务**：#1 层级导入 + #4 数据库约定 + #6 信息泄漏

任务类型判断规则：
- 文件路径包含 `tests/` 或 `__tests__/` → 测试任务
- 文件路径包含 `alembic/` 或 `migrations/` 或任务描述含"迁移""ORM""配置" → 基础设施任务
- 其他 → 实现任务
- 若任务同时包含测试和实现文件，按实现任务处理

### Step 3: 按检查清单执行检查

逐项执行 `references/task-checklist.md` 中适用的检查项。

**#1 层级导入**（仅后端 .py 文件）
- 检查 `app/services/*.py` 中是否有 `from app.routers` 导入
- 检查 `app/domain/*.py` 中是否有 `import asyncio`、`import aiohttp`、`from sqlalchemy.ext` 等 I/O 导入
- 检查 `app/storage/*.py` 中是否有 `from app.services` 导入
- 检查 `app/routers/*.py` 中是否有 `from app.storage` 导入

**#2 命名规范**
- Python 文件：文件名是否 `snake_case.py`
- Python 类定义：是否 `PascalCase`
- TS/TSX 文件：工具文件是否 `kebab-case.ts`，React 组件是否 `PascalCase.tsx`
- API 路径（若在 router 中定义）：是否 `/api/v1/kebab-case`
- 错误码：是否 `UPPER_SNAKE_CASE`

**#3 序列化约定**（仅 domain .py 文件）
- 新增的 Pydantic 模型类（继承 BaseModel 或已配置的基类）
- 检查是否有 `alias_generator` 和 `populate_by_name` 配置（直接或通过基类继承）

**#4 数据库约定**（仅 storage/migration .py 文件）
- 主键字段是否使用 `rid`（text 类型）
- 是否使用 async session（不出现 `create_engine` 同步调用）
- Schema 变更是否通过 Alembic（不出现裸 DDL 如 `CREATE TABLE`、`ALTER TABLE`）

**#5 前端约定**（仅 .tsx/.ts 文件）
- stores/ 目录下文件不得包含 `useQuery` 或 `useMutation`
- 组件中用户可见字符串是否使用 `t('...')` 或 `{t('...')}`
- API 类型是否来自 `generated/` 或 `api/` 目录（不在组件中手写 interface 定义 API 响应类型）

**#6 信息泄漏**（所有文件）
- 扫描硬编码的密钥模式：`password\s*=\s*['"]`、`secret\s*=\s*['"]`、`token\s*=\s*['"]`、连接字符串 `://.*:.*@`
- 排除：测试 fixtures、.env.example、文档中的示例

### Step 4: 元数据交叉验证

- **文件范围**：实际修改的文件（任务声明的目标文件）是否与任务描述一致，是否存在范围蔓延（修改了任务未声明的文件）
- **配对测试**：若为实现任务，检查 tasks.md 中配对的测试任务是否已打勾 ✅
- **前置依赖**：检查任务声明的依赖项是否已完成（tasks.md 中已打勾）

### Step 5: 输出报告

按以下格式输出：

```markdown
## Task Review: <task_id>

**任务**: <任务标题>
**类型**: 测试 / 实现 / 基础设施
**文件**: <文件列表>

| # | 检查项 | 结果 | 说明 |
|---|--------|------|------|
| 1 | 层级导入 | PASS / FAIL / N/A | <若 FAIL，具体描述> |
| 2 | 命名规范 | PASS / FAIL / N/A | |
| 3 | 序列化约定 | PASS / FAIL / N/A | |
| 4 | 数据库约定 | PASS / FAIL / N/A | |
| 5 | 前端约定 | PASS / FAIL / N/A | |
| 6 | 信息泄漏 | PASS / FAIL / N/A | |

**元数据验证**: 文件范围 PASS/FAIL | 配对测试 PASS/FAIL/N/A | 依赖 PASS/FAIL

**结果**: PASS / PASS_WITH_NOTES / NEEDS_FIX
```

### Step 6: 处理结果

| 结果 | 条件 | 动作 |
|------|------|------|
| **PASS** | 全部通过 | 告知用户可以打勾 |
| **PASS_WITH_NOTES** | 仅 MEDIUM 级提醒，无 HIGH | 告知用户可以打勾，列出提醒供参考 |
| **NEEDS_FIX** | 任何 HIGH 违规 | 列出需要修复的具体问题，修复后可再次调用 `/task-review` 重审（最多 1 轮重审） |

## 错误处理

- `feature_dir` 不存在 → 报告路径错误，停止
- `tasks.md` 不存在 → 报告"找不到 tasks.md"，停止
- `task_id` 不匹配 → 报告"未找到任务 <task_id>"，停止
- 目标文件不存在 → 标记为 WARNING（文件可能尚未创建），继续检查其他文件
