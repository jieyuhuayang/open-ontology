---
name: update-object-type
description: 更新已有对象类型的显示名称、API 名称、描述或状态
level: L1
---

## 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| rid | string | 是 | 对象类型的资源标识符 |
| displayName | string | 否 | 新的显示名称 |
| apiName | string | 否 | 新的 API 名称，PascalCase 格式 |
| description | string | 否 | 新的描述信息 |
| status | string | 否 | 状态变更：active / deprecated |

## 约束

- 至少提供一个可选参数
- apiName 变更后仍须满足 INV-1 唯一性约束
- apiName 必须为 PascalCase 格式

## CLI 命令

`oo object-type update <rid> [--name <n>] [--api-name <a>] [--description <d>] [--status <s>]`

## 使用场景

When the Agent needs to rename, re-describe, or change the status of an existing object type.

## 示例

```bash
oo object-type update ri.ontology.object-type.abc123 --name "Customer Profile"
oo object-type update ri.ontology.object-type.abc123 --status deprecated
```
