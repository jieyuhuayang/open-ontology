---
name: delete-object-type
description: 删除指定的对象类型及其关联的属性和链接类型
level: L1
---

## 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| rid | string | 是 | 待删除对象类型的资源标识符 |

## 约束

- INV-4: 状态为 active 的对象类型不可直接删除，需先设为 deprecated
- 级联删除：删除对象类型时，同时删除其所有属性和关联的链接类型
- 操作不可逆，执行前应确认用户意图

## CLI 命令

`oo object-type delete <rid>`

## 使用场景

When the Agent needs to remove an object type that is no longer needed, typically after the user confirms deletion. Always verify the object type status before attempting deletion.

## 示例

```bash
oo object-type delete ri.ontology.object-type.abc123
```
