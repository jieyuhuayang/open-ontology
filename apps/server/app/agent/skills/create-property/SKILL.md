---
name: create-property
description: 为指定对象类型创建一个新属性（Property）
level: L1
---

## 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| objectTypeRid | string | 是 | 所属对象类型的资源标识符 |
| displayName | string | 是 | 属性的显示名称 |
| apiName | string | 是 | camelCase 格式的 API 名称 |
| baseType | string | 是 | 属性的基础类型（见下方支持列表） |

**支持的 baseType**：`string`, `integer`, `double`, `boolean`, `date`, `timestamp`, `long`, `float`, `short`, `byte`, `decimal`, `geohash`, `geoshape`, `geopoint`, `marking`, `attachment`, `mediaReference`, `array`, `struct`, `vector`

## 约束

- apiName 必须为 camelCase 格式（如 `firstName`）
- apiName 在同一对象类型内必须唯一
- baseType 必须为上述支持列表中的值

## CLI 命令

`oo property create --object-type <rid> --name <n> --api-name <a> --type <t>`

## 使用场景

When the Agent needs to add a field/attribute to an existing object type, e.g. user says "add a name field to Customer" or "Customer needs an email property".

## 示例

```bash
oo property create --object-type ri.ontology.object-type.abc123 --name "First Name" --api-name firstName --type string
oo property create --object-type ri.ontology.object-type.abc123 --name "Created At" --api-name createdAt --type timestamp
```
