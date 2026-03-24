---
name: import-dataset
description: 从 CSV 或 Excel 文件导入数据集到本体平台
level: L1
---

## 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| filepath | string | 是 | 待导入文件的路径 |
| format | string | 否 | 文件格式：csv / excel，默认根据扩展名推断 |
| sheet | string | 否 | Excel 工作表名称，仅 Excel 格式有效 |
| name | string | 否 | 数据集显示名称，默认使用文件名 |

## 约束

- 文件大小不超过 50MB
- CSV 文件须为 UTF-8 编码
- Excel 仅支持 .xlsx 格式

## CLI 命令

`oo dataset import-csv <path> [--name <n>]`
`oo dataset import-excel <path> [--sheet <s>] [--name <n>]`

## 使用场景

When the Agent needs to ingest external data into the platform, e.g. user provides a CSV file of customer records or an Excel spreadsheet of product inventory.

## 示例

```bash
oo dataset import-csv /data/customers.csv --name "Customer Records Q4"
oo dataset import-excel /data/inventory.xlsx --sheet "Sheet1" --name "Product Inventory"
```
