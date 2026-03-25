---
name: ontology-analyze
description: 分析资料文件生成本体蓝图。TRIGGER when: 用户要求分析文件（CSV、Excel、SQL DDL、PDF 等）生成本体，或使用 /ontology-analyze 命令。注意：需要 F014 实现后才可用。
---

> 完整参数与约束定义：`apps/server/app/agent/skills/analyze-materials/SKILL.md`（及 `parse-csv/`、`parse-ddl/`、`parse-document/`、`parse-excel/` 子技能）

分析资料文件并生成本体蓝图（当前为存根，需要 F014 实现）：

```bash
cd apps/server && PYTHONPATH=. uv run oo blueprint analyze schema.sql products.csv --ontology ri.ontology.main.xxx
```

支持文件类型：CSV, Excel (.xlsx), SQL DDL, JSON Schema, PDF, Markdown, Word。
