---
name: create-object-type
description: 创建一个新的对象类型（Object Type），支持自动生成 apiName 和 id
level: L1
---

## 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| displayName | string | 是 | 对象类型的显示名称 |
| apiName | string | 否 | PascalCase 格式，未提供时根据 displayName 自动生成 |
| description | string | 否 | 对象类型的描述信息 |
| id | string | 否 | kebab-case 格式，未提供时根据 displayName 自动生成 |

## 约束

- INV-1: apiName 在同一 Ontology 内必须唯一
- apiName 必须为 PascalCase 格式（如 `FlightRecord`）
- id 必须为 kebab-case 格式（如 `flight-record`）

## CLI 命令

`oo object-type create --name <n> [--api-name <a>] [--description <d>]`

## 使用场景

When the Agent needs to define a new entity concept in the ontology, e.g. user says "add a Customer object type" or "create an entity for orders".

## 示例

```bash
oo object-type create --name "Flight Record" --description "Represents a single flight event"
oo object-type create --name "Customer" --api-name CustomerProfile
```
