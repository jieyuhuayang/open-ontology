# MySQL Sample Clone for MVP Import Testing

This workflow creates a local MySQL sample clone from an external source database for Open Ontology MVP import testing.

## Goals

- Do not write to the external production-grade database.
- Keep only a small sample: latest `100` rows per table (configurable via `SAMPLE_LIMIT`).
- Keep test data local and out of GitHub.

## Scope and Boundaries

- This is a testing fixture for MySQL dataset import (Object Type wizard), not an Open Ontology runtime dependency.
- The clone runs as an on-demand local Docker container.
- Only scripts and docs are committed; sampled data is local-only.

## Prerequisites

- Docker
- MySQL client tools on host (`mysql`, `mysqldump`)
- Network access to source MySQL

## Files

- `ops/mysql-sample/refresh.sh`: recreate local sample clone
- `ops/mysql-sample/cleanup.sh`: remove local sample clone container/artifacts
- `ops/mysql-sample/.env.mysql-sample.example`: env template

## Quick Start

1. Initialize local env:

```bash
just mysql-sample-init-env
```

2. Edit local env file:

```bash
ops/mysql-sample/.env.mysql-sample.local
```

3. Build or refresh sample clone:

```bash
just mysql-sample-refresh
```

4. Use in Open Ontology MySQL import wizard:
- Host: `127.0.0.1`
- Port: `13306` (or `TARGET_MYSQL_PORT`)
- Database: `cofco_grease_mvp_sample` (or `TARGET_MYSQL_DB`)
- Username/Password: from `.env.mysql-sample.local`

5. Cleanup when done:

```bash
just mysql-sample-clean
```

To also remove persisted MySQL data volume:

```bash
just mysql-sample-clean-purge
```

## Sampling Rule (Latest 100 per Table)

For each base table, row sampling uses this sort-column priority:

`update_time, updated_at, gmt_modified, modified_at, insert_time, created_at, create_time, gmt_create, t_date, date_time`

Then append primary key columns (if not already included), descending order.

If none exist, fallback to the first physical column descending.

Final query pattern per table:

```sql
SELECT * FROM <table> ORDER BY <derived_order_clause> LIMIT 100;
```

## Validation Output

After `just mysql-sample-refresh`, a report is written to:

`ops/mysql-sample/runtime/refresh-report.tsv`

Fields:

- `table`
- `row_count`
- `limit`
- `status` (`ok` or `exceeded`)

## GitHub Hygiene

- Never commit real credentials into repository files.
- Keep credentials only in `ops/mysql-sample/.env.mysql-sample.local`.
- Never commit runtime SQL artifacts or sampled data (`ops/mysql-sample/runtime/` is gitignored).
- If backend runs inside Docker, use `host.docker.internal` instead of `127.0.0.1`.

## Troubleshooting

- `Can't connect to MySQL server`: verify source host/port/network and credentials.
- `Target MySQL container did not become ready`: rerun `just mysql-sample-clean-purge` then `just mysql-sample-refresh`.
- Import wizard cannot connect:
  - backend running on host: use `127.0.0.1:<TARGET_MYSQL_PORT>`
  - backend running in container: use `host.docker.internal:<TARGET_MYSQL_PORT>`
