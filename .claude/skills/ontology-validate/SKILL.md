---
name: ontology-validate
description: 验证本体一致性（检查不完整对象类型、类型不兼容、孤立链接、命名冲突）。TRIGGER when: 用户要求校验本体，或使用 /ontology-validate 命令。
---

> 完整参数与约束定义：`apps/server/app/agent/skills/validate-ontology/SKILL.md`

运行本体一致性校验，返回错误和警告列表。

```bash
cd apps/server && PYTHONPATH=. uv run oo validate
```

exit 0 = 无错误；exit 1 = 有 ERROR 级别问题。
