---
name: validate-ontology
description: 校验当前本体的完整性和一致性，报告潜在问题
level: L1
---

## 参数

无参数。对当前 Ontology 执行全量校验。

## 约束

- 校验为只读操作，不修改任何数据
- 返回所有问题的列表，按严重程度排序（error > warning > info）

## 检查项

| 检查 | 严重程度 | 说明 |
|------|----------|------|
| 不完整的对象类型 | error | 对象类型缺少必要属性（如无任何 property） |
| 类型不兼容 | error | 属性类型与数据源实际类型不匹配 |
| 孤立的链接类型 | warning | 链接类型的端点指向已删除的对象类型 |
| apiName 冲突 | error | 同一 Ontology 内存在重复的 apiName |

## CLI 命令

`oo validate`

## 使用场景

When the Agent has finished creating or modifying multiple resources and needs to verify overall ontology consistency. Should be called as a final step after batch operations.

## 示例

```bash
oo validate
```
