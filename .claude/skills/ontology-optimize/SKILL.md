---
name: ontology-optimize
description: 优化现有本体（命名一致性、缺失关系、质量改进建议）。TRIGGER when: 用户要求优化本体，或使用 /ontology-optimize 命令。
---

> 完整参数与约束定义：`apps/server/app/agent/skills/optimize-ontology/SKILL.md`

通过验证和分析现有本体提出优化建议：

```bash
# 第一步：运行验证获取问题列表
cd apps/server && PYTHONPATH=. uv run oo validate

# 第二步：根据验证结果，使用 search 和 list 命令分析命名一致性
cd apps/server && PYTHONPATH=. uv run oo object-type list --format json
cd apps/server && PYTHONPATH=. uv run oo search "<pattern>" --type objectType
```

优化维度：命名一致性、缺失关系识别、属性类型规范化、描述完整性。
