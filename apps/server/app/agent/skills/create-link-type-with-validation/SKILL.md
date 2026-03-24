---
name: create-link-type-with-validation
description: 先验证本体一致性并确认端点对象类型存在，再创建链接类型
level: L2
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

## 约束

- 端点 apiName 在对象类型的所有链接端点中必须唯一（INV-7）
- 两端对象类型必须已存在
- 创建前必须通过本体验证预检

## CLI 命令

```bash
oo validate
oo link-type create --id <id> --side-a-object <rid> --side-a-name <n> --side-a-api-name <a> --side-b-object <rid> --side-b-name <n> --side-b-api-name <a> --cardinality <c>
```

## 组合步骤

1. Step 1: 调用 `validate-ontology` L1 Skill → 执行本体一致性预检，获取当前问题列表
2. Step 2: 验证 sideA.objectTypeRid 和 sideB.objectTypeRid 对应的对象类型是否存在
3. Step 3: 若 Step 1 和 Step 2 均通过，调用 `create-link-type` L1 Skill 创建链接类型
4. Step 4: 返回创建结果

## 错误处理

- 当 Step 1（本体验证）发现 ERROR 级别问题时：终止操作，返回验证问题列表，建议用户先修复
- 当 Step 2（端点验证）失败时：终止操作，报告不存在的对象类型 rid
- 当 Step 1 仅有 WARNING 级别问题时：记录警告，继续执行 Step 3
- 当 Step 3（创建链接类型）失败时：返回具体错误信息（如 apiName 冲突）

## 使用场景

When the Agent needs to create a relationship between object types with safety checks, e.g. user says "link Customer to Order" or "create a many-to-many relationship between Student and Course".

## 示例

```bash
# Step 1: 验证本体一致性
oo validate
# 返回: 0 errors, 1 warning

# Step 2: 确认两端对象类型存在（内部检查）

# Step 3: 创建链接类型
oo link-type create --id customer-orders --side-a-object ri.ontology.object-type.customer --side-a-name "Orders" --side-a-api-name orders --side-b-object ri.ontology.object-type.order --side-b-name "Customer" --side-b-api-name customer --cardinality ONE_TO_MANY
```
