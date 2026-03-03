# MySQL 样本克隆（用于 MVP 导入测试）

本流程用于从外部源 MySQL 数据库生成一个本地样本克隆，供 Open Ontology MVP 阶段做导入测试使用。

## 目标

- 不对外部生产级数据库执行写操作。
- 仅保留小规模样本：每张表最新 `100` 行（可通过 `SAMPLE_LIMIT` 配置）。
- 测试数据仅保留在本地，不进入 GitHub。

## 范围与边界

- 该流程是 MySQL 数据集导入（对象类型向导）的测试夹具，不是 Open Ontology 的运行时依赖。
- 克隆库以按需方式运行在本地 Docker 容器中。
- 仓库只提交脚本和文档；样本数据只允许本地保存。

## 前置条件

- 已安装 Docker
- 主机已安装 MySQL 客户端工具（`mysql`、`mysqldump`）
- 可访问源 MySQL 的网络连接

## 相关文件

- `ops/mysql-sample/refresh.sh`：重建/刷新本地样本克隆
- `ops/mysql-sample/cleanup.sh`：清理本地样本容器与相关产物
- `ops/mysql-sample/.env.mysql-sample.example`：环境变量模板

## 快速开始

1. 初始化本地环境文件：

```bash
just mysql-sample-init-env
```

2. 编辑本地环境文件：

```bash
ops/mysql-sample/.env.mysql-sample.local
```

3. 构建或刷新样本克隆：

```bash
just mysql-sample-refresh
```

4. 在 Open Ontology 的 MySQL 导入向导中使用以下连接信息：
- Host：`127.0.0.1`
- Port：`13306`（或 `TARGET_MYSQL_PORT`）
- Database：`cofco_grease_mvp_sample`（或 `TARGET_MYSQL_DB`）
- Username/Password：以 `.env.mysql-sample.local` 中配置为准

5. 使用完成后清理：

```bash
just mysql-sample-clean
```

如果还需要删除持久化的 MySQL 数据卷：

```bash
just mysql-sample-clean-purge
```

## 抽样规则（每表最新 100 行）

每张基础表按以下字段优先级选择排序列：

`update_time, updated_at, gmt_modified, modified_at, insert_time, created_at, create_time, gmt_create, t_date, date_time`

随后追加主键列（若未包含），统一按降序排序。

若以上列都不存在，则回退为按第一列物理字段降序排序。

每张表最终查询模式：

```sql
SELECT * FROM <table> ORDER BY <derived_order_clause> LIMIT 100;
```

## 校验输出

执行 `just mysql-sample-refresh` 后，会生成报告：

`ops/mysql-sample/runtime/refresh-report.tsv`

字段说明：

- `table`
- `row_count`
- `limit`
- `status`（`ok` 或 `exceeded`）

## GitHub 提交规范

- 严禁将真实凭据提交到仓库。
- 凭据仅允许放在 `ops/mysql-sample/.env.mysql-sample.local`。
- 严禁提交运行时 SQL 产物或抽样数据（`ops/mysql-sample/runtime/` 已被 gitignore）。
- 若后端运行在 Docker 容器内，连接主机请使用 `host.docker.internal`，不要使用 `127.0.0.1`。

## 故障排查

- `Can't connect to MySQL server`：检查源库主机、端口、网络连通性和账号密码。
- `Target MySQL container did not become ready`：先执行 `just mysql-sample-clean-purge`，再执行 `just mysql-sample-refresh`。
- 导入向导无法连接：
  - 后端运行在主机：使用 `127.0.0.1:<TARGET_MYSQL_PORT>`
  - 后端运行在容器：使用 `host.docker.internal:<TARGET_MYSQL_PORT>`
