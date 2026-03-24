---
name: list-object-types
description: 分页列出当前 Ontology 中的所有对象类型
level: L1
---

## 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | integer | 否 | 页码，默认 1 |
| pageSize | integer | 否 | 每页条数，默认 20 |

## 约束

- pageSize 最大值为 100
- 返回结果按创建时间倒序排列

## CLI 命令

`oo object-type list [--page N] [--page-size M]`

## 使用场景

When the Agent needs to enumerate existing object types before creating new ones, or when the user asks "what object types do we have?" or "show me all entities".

## 示例

```bash
oo object-type list
oo object-type list --page 2 --page-size 50
```
