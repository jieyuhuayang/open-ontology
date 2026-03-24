---
name: analyze-materials
description: 分析用户提供的原始素材（文件、文本），提取实体和关系候选项
level: L3
---

## 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| materials | array | 是 | 素材列表，每项包含 type（file/text）和 content/path |
| domain | string | 否 | 目标领域描述，用于引导提取方向（如"电商"、"医疗"） |
| scope | string | 否 | 提取范围限定（如"仅提取核心实体"、"包含属性级别细节"） |

## 约束

- 结构化文件（CSV、JSON、SQL DDL）走直接解析，不消耗 LLM Token
- 非结构化文件（文档、需求描述、会议纪要）走 LLM 提取
- 每个素材独立分析，结果互不影响
- 实际执行逻辑由 F012/F014 实现，本文件仅为知识手册

## CLI 命令

```bash
oo analyze --input <file_or_text> [--domain <d>] [--scope <s>]
```

## 编排策略

Agent 根据素材类型选择处理路径：

1. **分类阶段**：按文件扩展名和内容特征将素材分为结构化/非结构化两类
2. **结构化解析**：CSV → 列名映射为属性候选；SQL DDL → 表映射为 OT 候选，外键映射为 LT 候选；JSON Schema → 直接映射
3. **非结构化提取**：构造 Prompt 注入 domain/scope 上下文，LLM 提取实体、属性、关系三元组
4. **结果标准化**：统一输出为候选实体列表（entityName, properties[], relations[]），附带置信度和来源标注

## 子 Agent 调度

- 多个素材文件时，为每个文件生成一个子 Agent 并行处理
- 子 Agent 独立完成分析，返回标准化候选列表
- 主 Agent 收集所有子 Agent 结果后传递给 `generate-blueprint`

## 上下文管理

- 结构化文件解析不消耗 Token 预算
- 非结构化文件的 LLM 提取按文件大小分配 Token 预算，单文件上限 4K Token
- 注入 domain/scope 作为系统提示，不重复注入已有本体 Schema

## 使用场景

When the user provides raw materials (database schemas, documents, spreadsheets) and wants the Agent to understand the domain and extract ontology candidates, e.g. "analyze this SQL dump" or "read this requirements doc and identify entities".

## 示例

```bash
# 分析一个 SQL DDL 文件（结构化，直接解析）
oo analyze --input schema.sql --domain "电商系统"

# 分析一段需求描述（非结构化，LLM 提取）
oo analyze --input requirements.md --domain "医疗管理" --scope "仅核心实体"

# 输出示例:
# - 候选实体: Patient (confidence: 0.95), Doctor (0.92), Appointment (0.88)
# - 候选关系: Patient → Appointment (ONE_TO_MANY, 0.90)
```
