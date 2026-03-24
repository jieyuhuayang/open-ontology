---
name: parse-csv
description: 解析 CSV 文件，提取列名、推断数据类型、识别主键候选和审计字段
level: L1
---

## 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file_path | string | 是 | CSV 文件的本地路径 |

## 约束

- 前 1000 行用于类型推断
- 类型匹配率 > 95% 才确认为该类型，否则默认 String
- 支持 UTF-8 和 GBK 编码（自动降级）
- 列名含 id/_id/Id 自动标记为主键候选
- 列名匹配 created_at/updated_at/created_by/updated_by/deleted_at/is_deleted 标记为审计字段

## CLI 命令

`oo material parse <file> --parser csv`

## 使用场景

When the Agent receives a CSV file upload and needs to extract structured column information before generating blueprint items. This skill produces high-confidence column metadata for object type and property suggestions.

## 示例

```bash
oo material parse orders.csv --parser csv
# Output: columns with names, types (Integer/Double/Date/Timestamp/Boolean/String), sample values, PK candidates, audit fields
```
