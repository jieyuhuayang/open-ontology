---
name: create-link-type
description: 创建两个对象类型之间的链接类型（Link Type），定义语义关系
level: L1
---

## 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 链接类型的唯一标识 |
| sideA.objectTypeRid | string | 是 | A 端对象类型的 rid |
| sideA.displayName | string | 是 | A 端端点的显示名称 |
| sideA.apiName | string | 是 | A 端端点的 API 名称 |
| sideB.objectTypeRid | string | 是 | B 端对象类型的 rid |
| sideB.displayName | string | 是 | B 端端点的显示名称 |
| sideB.apiName | string | 是 | B 端端点的 API 名称 |
| cardinality | string | 是 | 基数：ONE_TO_ONE / ONE_TO_MANY / MANY_TO_MANY |
| joinTableDatasetRid | string | 否 | MANY_TO_MANY 时必填，关联表的 dataset rid |

## 约束

- INV-7: 端点 apiName 在对象类型的所有链接端点中必须唯一
- INV-8: MANY_TO_MANY 基数时必须提供 joinTableDatasetRid
- INV-9: id 在 Ontology 内必须唯一

## CLI 命令

`oo link-type create --id <id> --side-a-object <rid> --side-a-name <n> --side-a-api-name <a> --side-b-object <rid> --side-b-name <n> --side-b-api-name <a> --cardinality <c> [--join-table-dataset <rid>]`

## 使用场景

When the Agent needs to define a relationship between two object types, e.g. "Customer has many Orders" or "Employee belongs to Department".

## 示例

```bash
oo link-type create --id customer-orders --side-a-object ri.ontology.object-type.customer --side-a-name "Orders" --side-a-api-name orders --side-b-object ri.ontology.object-type.order --side-b-name "Customer" --side-b-api-name customer --cardinality ONE_TO_MANY
```
