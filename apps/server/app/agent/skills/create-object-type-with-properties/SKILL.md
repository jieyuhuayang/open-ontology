---
name: create-object-type-with-properties
description: 创建对象类型并批量添加其属性，自动关联属性到新建的对象类型
level: L2
---

## 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| displayName | string | 是 | 对象类型的显示名称 |
| apiName | string | 否 | PascalCase 格式，未提供时自动生成 |
| description | string | 否 | 对象类型的描述信息 |
| properties | array | 是 | 属性列表，每项包含 displayName、apiName、baseType |

## 约束

- 对象类型的 apiName 在 Ontology 内必须唯一（INV-1）
- 每个属性的 apiName 在该对象类型内必须唯一
- 属性的 apiName 必须为 camelCase 格式
- 至少包含一个属性

## CLI 命令

```bash
oo object-type create --name <n> [--api-name <a>] [--description <d>]
oo property create --object-type <rid> --name <n> --api-name <a> --type <t>
```

## 组合步骤

1. Step 1: 调用 `create-object-type` L1 Skill → 获取新建对象类型的 RID
2. Step 2: 遍历 properties 列表，逐一调用 `create-property` L1 Skill，传入 Step 1 获取的 RID
3. Step 3: 汇总结果，返回对象类型 RID + 各属性创建状态

## 错误处理

- 当 Step 1（创建对象类型）失败时：直接终止，返回错误信息
- 当 Step 2（创建属性）部分失败时：不回滚已创建的对象类型，继续处理剩余属性，最终报告成功/失败属性清单
- 当属性 apiName 冲突时：跳过该属性，标记为失败并附冲突原因

## 使用场景

When the Agent needs to create an entity with its fields in one operation, e.g. user says "create a Customer with name, email, and phone" or "define a Flight Record entity with departure time, arrival time, and status".

## 示例

```bash
# Step 1: 创建对象类型
oo object-type create --name "Customer" --description "Represents a customer entity"
# 返回 rid: ri.ontology.object-type.abc123

# Step 2: 逐一创建属性
oo property create --object-type ri.ontology.object-type.abc123 --name "Full Name" --api-name fullName --type string
oo property create --object-type ri.ontology.object-type.abc123 --name "Email" --api-name email --type string
oo property create --object-type ri.ontology.object-type.abc123 --name "Created At" --api-name createdAt --type timestamp
```
