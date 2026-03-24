---
name: parse-excel
description: 解析 Excel (.xlsx) 文件，支持多 sheet，提取列名和数据类型
level: L1
---

## 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file_path | string | 是 | Excel 文件的本地路径 |

## 约束

- 支持 .xlsx 格式（openpyxl）
- 每个 sheet 独立分析
- 类型推断逻辑与 CSV 解析器一致

## CLI 命令

`oo material parse <file> --parser excel`

## 使用场景

When the Agent receives an Excel file upload. Each sheet may represent a different entity, so the Agent should consider sheet names as potential object type names.

## 示例

```bash
oo material parse products.xlsx --parser excel
# Output: per-sheet columns with types, row counts
```
