---
name: parse-ddl
description: 解析 SQL DDL 文件，提取表定义、列类型、主键、外键、唯一约束
level: L1
---

## 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file_path | string | 是 | SQL DDL 文件的本地路径 |

## 约束

- 解析 CREATE TABLE 语句
- PRIMARY KEY → 主键属性
- FOREIGN KEY → 链接类型候选（自动推断基数）
- UNIQUE INDEX → 唯一约束属性
- NOT NULL → 必填属性
- 支持 MySQL 和 PostgreSQL DDL 语法

## CLI 命令

`oo material parse <file> --parser ddl`

## 使用场景

When the Agent receives a SQL DDL export (e.g. `SHOW CREATE TABLE` output). DDL provides precise type information, producing high-confidence suggestions. Foreign keys directly map to link types.

## 示例

```bash
oo material parse schema.sql --parser ddl
# Output: tables with columns, types, primary keys, foreign key relationships
```
