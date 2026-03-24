---
name: batch-create-from-blueprint
description: 按依赖顺序批量创建蓝图中的对象类型、属性和链接类型
level: L2
---

## 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| blueprint | object | 是 | 蓝图对象，包含 objectTypes、properties、linkTypes 三个列表 |
| continueOnError | boolean | 否 | 单项失败时是否继续处理，默认 true |

## 约束

- 必须按依赖顺序执行：Object Type → Property → Link Type
- 链接类型的两端对象类型必须在本批次或已有本体中存在
- 每个条目的创建结果独立记录（成功/失败/跳过）

## CLI 命令

```bash
oo object-type create --name <n> [--api-name <a>] [--description <d>]
oo property create --object-type <rid> --name <n> --api-name <a> --type <t>
oo link-type create --id <id> --side-a-object <rid> --side-a-name <n> --side-a-api-name <a> --side-b-object <rid> --side-b-name <n> --side-b-api-name <a> --cardinality <c>
```

## 组合步骤

1. Step 1: 解析蓝图，按依赖关系排序（Object Type → Property → Link Type）
2. Step 2: 遍历 objectTypes 列表，逐一调用 `create-object-type` L1 Skill，记录每个 OT 的 RID 映射
3. Step 3: 遍历 properties 列表，通过 Step 2 的 RID 映射解析 objectTypeRid，逐一调用 `create-property` L1 Skill
4. Step 4: 遍历 linkTypes 列表，通过 Step 2 的 RID 映射解析两端 objectTypeRid，逐一调用 `create-link-type` L1 Skill
5. Step 5: 汇总所有条目的执行结果，返回批量创建报告

## 错误处理

- 当某个 Object Type 创建失败时：标记为失败，跳过依赖它的 Property 和 Link Type（标记为跳过）
- 当某个 Property 创建失败时：标记为失败，继续处理其他 Property
- 当某个 Link Type 创建失败时：标记为失败，继续处理其他 Link Type
- 最终报告包含三类统计：成功数、失败数、跳过数

## 使用场景

When the Agent has a complete ontology blueprint (from `generate-blueprint` L3 Skill or user-provided JSON) and needs to materialize it into actual ontology entities, e.g. "apply this blueprint" or "create all entities from the design".

## 示例

```bash
# Step 2: 创建对象类型
oo object-type create --name "Customer" --api-name Customer
# → rid: ri.ontology.object-type.cust001
oo object-type create --name "Order" --api-name Order
# → rid: ri.ontology.object-type.ord001

# Step 3: 创建属性
oo property create --object-type ri.ontology.object-type.cust001 --name "Name" --api-name name --type string
oo property create --object-type ri.ontology.object-type.ord001 --name "Total" --api-name totalAmount --type decimal

# Step 4: 创建链接类型
oo link-type create --id customer-orders --side-a-object ri.ontology.object-type.cust001 --side-a-name "Orders" --side-a-api-name orders --side-b-object ri.ontology.object-type.ord001 --side-b-name "Customer" --side-b-api-name customer --cardinality ONE_TO_MANY

# 报告: 2 OT 成功, 2 Property 成功, 1 LinkType 成功, 0 失败, 0 跳过
```
