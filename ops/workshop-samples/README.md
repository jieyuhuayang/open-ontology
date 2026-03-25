# Workshop 样本素材

用于本地开发调试 Workshop 全流程的预置样本文件。数据来源于 `cofco_grease_mvp_sample`（大宗商品交易域）。

## 文件列表

| 文件 | 内容 | 行数 | 大小 |
|------|------|------|------|
| `cofco-grease-ddl.sql` | 6 张核心表的 DDL（含中文业务 COMMENT） | 119 | ~28KB |
| `soybean-balance.csv` | 美/巴/阿大豆供需平衡表 | 30 | ~3KB |
| `weather-data.csv` | 美国降水+气温周度数据 | 20 | ~2KB |
| `trade-export.csv` | 周度出口明细 + 油粕压榨利润 | 20 | ~2KB |

## 使用方式

1. 启动 Workshop：`http://localhost:5173/workshop`
2. 创建新会话（域名填"大宗商品"或"commodity trading"）
3. 将文件拖入 Chat Panel 的上传区
4. 与 Agent 对话，观察素材分析 → 蓝图生成 → 审查 → 应用

## 重新生成

如果 MySQL 样本数据更新了，可重新生成：

```bash
cd ops/workshop-samples && python3 generate.py
```

前提：`ops/mysql-sample/runtime/` 下有 schema.sql 和 data/ 目录（由 `ops/mysql-sample/refresh.sh` 生成）。

## 数据覆盖的业务域

- **大豆供需平衡**：USDA 月度报告，含产量/进口/出口/库存/价格（美国/巴西/阿根廷）
- **气象观测**：美国各州周度降水量和平均气温，含 5 年/30 年历史均值
- **出口贸易**：美国大豆/豆粕/豆油周度出口明细（按目的国/品种）
- **压榨利润**：油粕榨利（美元/吨），含同比和 5 年均值

Agent 应能从中推断出：`SoybeanBalanceSheet`、`WeatherObservation`、`ExportDetail`、`CrushMargin`、`Country`、`Commodity` 等对象类型及它们之间的链接关系。
