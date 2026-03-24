---
name: optimize-ontology
description: 分析现有本体结构，识别命名不一致、缺失关系等问题并提出优化建议
level: L3
---

## 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| ontologyRid | string | 是 | 目标本体的 rid |
| scope | string | 否 | 优化范围：naming / relations / properties / all（默认 all） |
| autoFix | boolean | 否 | 是否自动应用低风险修复，默认 false |

## 约束

- 优化建议分为三级：INFO（建议）、WARNING（推荐修复）、ERROR（必须修复）
- autoFix 仅对 INFO 级别的命名规范问题生效，不自动修改结构
- 实际执行逻辑由 F012/F014 实现，本文件仅为知识手册

## CLI 命令

```bash
oo validate
oo ontology optimize --ontology <rid> [--scope <s>] [--auto-fix]
```

## 编排策略

Agent 按维度逐步分析本体质量：

1. **验证阶段**：调用 `validate-ontology` L1 Skill 获取现有问题列表（INV 违规）
2. **命名一致性分析**：检查 apiName 命名风格是否统一（如混用 camelCase 和 snake_case）、displayName 是否有拼写/大小写不一致
3. **关系完整性分析**：基于对象类型语义，识别可能缺失的关系（如 Order 存在但无关联 Customer 的链接类型）
4. **属性规范分析**：检查是否有重复属性（不同 OT 下同语义属性可提取为共享属性）、属性类型是否合理
5. **建议生成**：汇总所有发现，按严重度排序，输出结构化优化建议列表

## 子 Agent 调度

- 命名分析和关系分析可并行执行，各自生成子报告
- 当本体规模较大（>50 个对象类型）时，按模块拆分子 Agent 分析
- 最终由主 Agent 合并各子报告

## 上下文管理

- 加载完整本体 Schema（所有 objectTypes、properties、linkTypes）到上下文
- 大型本体按模块分页加载，每页不超过 20 个对象类型
- Token 预算分配：验证 10%、命名分析 25%、关系分析 35%、属性分析 20%、建议生成 10%

## 使用场景

When the user wants to improve an existing ontology's quality, e.g. "review my ontology for issues" or "suggest improvements for the current data model" or "check naming consistency across all object types".

## 示例

```bash
# 全面优化分析
oo ontology optimize --ontology ri.ontology.main

# 输出:
# === Optimization Report ===
# ERROR (1):
#   - Link Type "emp-dept" references non-existent Object Type "Department"
# WARNING (3):
#   - Naming: "customerName" vs "customer_email" - inconsistent apiName style
#   - Missing relation: "Order" has no link to "Product"
#   - Duplicate: "createdAt" (timestamp) defined in 5 Object Types, consider Shared Property
# INFO (2):
#   - "Cstmr" → consider renaming to "Customer" for clarity
#   - "order_item" apiName should be "orderItem" (camelCase convention)

# 仅检查命名并自动修复低风险项
oo ontology optimize --ontology ri.ontology.main --scope naming --auto-fix
```
