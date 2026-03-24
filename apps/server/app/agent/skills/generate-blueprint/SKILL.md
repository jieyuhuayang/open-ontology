---
name: generate-blueprint
description: 聚合素材分析结果，合并去重并生成可执行的本体蓝图
level: L3
---

## 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| candidates | array | 是 | 来自 `analyze-materials` 的候选实体/关系列表 |
| existingOntologyRid | string | 否 | 已有本体的 rid，用于避免重复创建 |
| confidenceThreshold | number | 否 | 置信度阈值，低于此值的候选项标记为待确认，默认 0.7 |

## 约束

- 同名实体必须合并，属性取并集
- 与已有本体中重名的实体标记为"已存在"，不纳入蓝图
- 蓝图输出必须符合 `batch-create-from-blueprint` L2 Skill 的输入格式
- 实际执行逻辑由 F014 实现，本文件仅为知识手册

## CLI 命令

```bash
oo blueprint generate --from-analysis <analysis_result> [--ontology <rid>] [--threshold <n>]
oo blueprint preview
oo blueprint apply
```

## 编排策略

1. **聚合阶段**：收集所有 `analyze-materials` 子 Agent 的输出候选列表
2. **合并去重**：按实体名称（标准化后）合并同名实体，属性列表取并集，保留最高置信度
3. **冲突检测**：识别属性类型冲突（同名属性不同 baseType）、关系方向歧义，标记为需用户确认
4. **已有本体比对**：加载 existingOntologyRid 的 Schema，过滤已存在的实体和属性
5. **置信度评估**：低于 confidenceThreshold 的候选项标记为"待确认"，需用户审核
6. **蓝图生成**：输出结构化蓝图（objectTypes + properties + linkTypes），可直接传递给 `batch-create-from-blueprint`

## 子 Agent 调度

- 蓝图生成为单 Agent 串行任务，不拆分子 Agent
- 但在冲突检测阶段，可调用 `validate-ontology` L1 Skill 预检蓝图合规性

## 上下文管理

- 加载已有本体 Schema 缓存（objectTypes + linkTypes 列表），避免重复查询
- Token 预算主要用于冲突检测的 LLM 推理（属性类型消歧、关系方向判断）
- 蓝图结构化输出不消耗 LLM Token

## 使用场景

When the Agent has completed material analysis and needs to produce a concrete, executable ontology design, e.g. "generate the ontology blueprint from analysis results" or after `analyze-materials` completes.

## 示例

```bash
# 从分析结果生成蓝图
oo blueprint generate --from-analysis analysis_001 --ontology ri.ontology.main --threshold 0.75

# 预览蓝图内容
oo blueprint preview
# 输出:
# Object Types (3): Customer, Order, Product
# Properties (8): customer.name, customer.email, order.totalAmount, ...
# Link Types (2): customer-orders (ONE_TO_MANY), order-products (MANY_TO_MANY)
# 待确认 (1): Product.category (confidence: 0.65)

# 确认后应用蓝图
oo blueprint apply
```
