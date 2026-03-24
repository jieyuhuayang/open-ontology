---
name: ontology-blueprint
description: 管理本体蓝图（列表、查看、应用）。TRIGGER when: 用户要求管理蓝图，或使用 /ontology-blueprint 命令。注意：蓝图功能需要 F014 实现后才可用。
---

蓝图管理命令（当前为存根，需要 F014 实现）：

```bash
cd apps/server && PYTHONPATH=. uv run oo blueprint list
cd apps/server && PYTHONPATH=. uv run oo blueprint show <blueprint_rid>
cd apps/server && PYTHONPATH=. uv run oo blueprint apply <blueprint_rid> [--auto-accept-high-confidence]
```
