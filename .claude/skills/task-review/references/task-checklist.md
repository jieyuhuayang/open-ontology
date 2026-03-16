# L1 任务审查检查清单

本清单定义了 `/task-review` 在每个任务完成后执行的精简检查项。
L1 聚焦约定合规和架构红线，不检查边界条件、权限、并发、测试覆盖（留给 L2）。

## 检查项

| # | 检查项 | 适用文件 | 严重度 | 检查方法 |
|---|--------|---------|--------|---------|
| 1 | 层级导入 | 后端 `*.py` | HIGH | services/ 不得 `from app.routers`；domain/ 无 I/O（不得 `import asyncio\|aiohttp\|sqlalchemy.ext\|aiofiles`）；storage/ 不得 `from app.services` |
| 2 | 命名规范 | 全部 | MEDIUM | Python 文件 `snake_case.py`；Python 类 `PascalCase`；TS 工具文件 `kebab-case.ts`；React 组件 `PascalCase.tsx`；API 路径 `/api/v1/kebab-case`；错误码 `UPPER_SNAKE` |
| 3 | 序列化约定 | domain `*.py` | HIGH | 新增 Pydantic 模型（含 API 响应/请求）必须有 `alias_generator=to_camel` + `populate_by_name=True`（或继承自已配置的基类） |
| 4 | 数据库约定 | storage/migration `*.py` | HIGH | 主键使用 `rid`（text 类型）；Schema 变更通过 Alembic 迁移；使用 async session（不得 `create_engine` 同步引擎） |
| 5 | 前端约定 | `*.tsx` / `*.ts` | MEDIUM | 用户可见字符串使用 `t('key')` i18n；服务端数据不入 Zustand（stores/ 中不得 `useQuery\|useMutation`）；API 类型来自 `generated/`（不手写接口类型） |
| 6 | 信息泄漏 | 全部 | HIGH | 无硬编码密钥、密码、token、连接字符串（排除测试 fixtures 和 .env.example） |

## 差异化处理规则

### 测试任务（通常为奇数编号）
- 仅检查：#2 命名规范 + #5 前端约定中的 i18n + AC 标注格式（`覆盖 AC: AC-NN`）
- 跳过：#1 架构分层、#3 序列化、#4 数据库

### 实现任务（通常为偶数编号）
- 完整执行 #1~#6
- 额外验证：配对的测试任务是否已完成（tasks.md 中已打勾）

### 基础设施任务（迁移、ORM 模型、配置）
- 检查：#1 层级导入、#4 数据库约定（rid/Alembic/async）、#6 信息泄漏
- 跳过：#5 前端约定

## 判定规则

| 结果 | 条件 | 动作 |
|------|------|------|
| **PASS** | 全部通过 | 打勾，继续下一任务 |
| **PASS_WITH_NOTES** | 仅 MEDIUM 级信息性提醒 | 打勾 + 记录偏差，继续 |
| **NEEDS_FIX** | 任何 HIGH 违规 | 修复 → 重审（最多 1 轮） |
