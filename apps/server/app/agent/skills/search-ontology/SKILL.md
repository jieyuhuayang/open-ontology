---
name: search-ontology
description: 在本体中搜索对象类型、属性或链接类型
level: L1
---

## 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| query | string | 是 | 搜索关键词，支持模糊匹配 |
| type | string | 否 | 限定搜索类型：objectType / property / linkType |
| limit | integer | 否 | 返回结果数量上限，默认 20 |

## 约束

- query 不可为空字符串
- 搜索范围覆盖 displayName、apiName、description
- 使用 PostgreSQL 全文搜索（MVP 阶段不使用 Elasticsearch）

## CLI 命令

`oo search <query> [--type objectType] [--limit 20]`

## 使用场景

When the Agent needs to find existing resources before creating new ones to avoid duplicates, or when the user asks "is there already a Customer type?" or "find anything related to orders".

## 示例

```bash
oo search "customer"
oo search "order" --type objectType --limit 10
oo search "email" --type property
```
