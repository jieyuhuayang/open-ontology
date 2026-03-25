---
name: Vitest 进程管理
description: 前端 vitest 测试在 Claude Code 中容易被后台化导致进程堆积，需要特殊处理
type: feedback
---

前端 Vitest 测试命令在 Claude Code Bash tool 中会被自动后台化（run_in_background），导致多次调用堆积大量 Node.js worker 进程。

**Why:** Vitest 的输出管道行为与 Bash tool 的管道检测不兼容，stderr 输出被误判为无输出。

**How to apply:**
1. 运行 vitest 时只运行一次，使用 `run_in_background: true` 显式标记，等待完成通知再查看结果
2. 如果第一次运行没有返回结果，先用 `pgrep -f vitest | wc -l` 检查是否仍在运行，不要重复启动
3. 需要清理时使用 `pkill -f vitest`
4. 优先运行单个测试文件（如 `pnpm test --run src/stores/__tests__/sidekick-store.test.ts`）而非全量测试，减少 worker 数量
5. 全量前端测试使用 `run_in_background: true` 并等待通知
