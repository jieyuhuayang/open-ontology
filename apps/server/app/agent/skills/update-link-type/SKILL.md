---
name: update-link-type
description: 更新已有链接类型的端点名称、API 名称或状态
level: L1
---

## 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| rid | string | 是 | 链接类型的资源标识符 |
| sideADisplayName | string | 否 | A 端新的显示名称 |
| sideAApiName | string | 否 | A 端新的 API 名称 |
| sideBDisplayName | string | 否 | B 端新的显示名称 |
| sideBApiName | string | 否 | B 端新的 API 名称 |
| status | string | 否 | 状态变更：active / deprecated |

## 约束

- 至少提供一个可选参数
- apiName 变更后仍须满足 INV-7 端点唯一性约束

## CLI 命令

`oo link-type update <rid> [--side-a-name <n>] [--side-a-api-name <a>] [--side-b-name <n>] [--side-b-api-name <a>] [--status <s>]`

## 使用场景

When the Agent needs to rename a link type endpoint or change its status, e.g. "rename the Orders link on Customer to PurchaseOrders".

## 示例

```bash
oo link-type update ri.ontology.link-type.abc123 --side-a-name "Purchase Orders" --side-a-api-name purchaseOrders
oo link-type update ri.ontology.link-type.abc123 --status deprecated
```
