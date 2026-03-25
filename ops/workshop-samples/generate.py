#!/usr/bin/env python3
"""
从 ops/mysql-sample/runtime/ 的 MySQL dump 文件中提取样本数据，
生成 Workshop 可用的 CSV + DDL 文件。

用法：
    cd ops/workshop-samples && python generate.py

输出：
    cofco-grease-ddl.sql    - 6 张核心表的 CREATE TABLE DDL（含中文 COMMENT）
    soybean-balance.csv     - 美/巴/阿 大豆平衡表数据
    weather-data.csv        - 降水+温度数据
    trade-export.csv        - 出口明细+油粕价格
"""

import csv
import re
import sys
from pathlib import Path

RUNTIME_DIR = Path(__file__).parent.parent / "mysql-sample" / "runtime"
SCHEMA_FILE = RUNTIME_DIR / "schema.sql"
DATA_DIR = RUNTIME_DIR / "data"
OUTPUT_DIR = Path(__file__).parent

# --- DDL 提取 ---

DDL_TABLES = [
    "usa_soybean_balance",
    "brazil_soybean_balance",
    "argentina_soybean_balance",
    "usa_weekly_export_detail",
    "usa_oil_meal_price_cost",
    "usa_weather_precipitation",
]


def extract_ddl(schema_text: str, table_names: list[str]) -> str:
    """从 schema.sql 提取指定表的 CREATE TABLE 语句，去掉 MySQL 噪音。"""
    lines = []
    lines.append("-- COFCO Grease MVP 样本数据库 DDL（精选 6 张核心表）")
    lines.append("-- 来源：cofco_grease_mvp_sample（大宗商品交易数据）")
    lines.append("-- 数据覆盖：大豆供需平衡（美/巴/阿）、气象、出口贸易、油粕价格")
    lines.append("")

    for table_name in table_names:
        # 匹配 CREATE TABLE `table_name` ( ... ) ENGINE=... COMMENT='...';
        pattern = rf"CREATE TABLE `{table_name}` \(.*?\)(?:\s*ENGINE=.*?;)"
        match = re.search(pattern, schema_text, re.DOTALL)
        if not match:
            print(f"WARNING: Table '{table_name}' not found in schema.sql")
            continue

        ddl = match.group(0)
        # 清理 CHARACTER SET / COLLATE 噪音（保留 COMMENT）
        ddl = re.sub(r" CHARACTER SET utf8mb3 COLLATE utf8mb3_bin", "", ddl)
        ddl = re.sub(r" COLLATE utf8mb3_bin", "", ddl)
        ddl = re.sub(r" DEFAULT CHARSET=utf8mb3", "", ddl)
        lines.append(f"-- ===== {table_name} =====")
        lines.append(ddl)
        lines.append("")

    return "\n".join(lines)


# --- 数据解析 ---


def extract_columns(schema_text: str, table_name: str) -> list[str]:
    """从 CREATE TABLE 提取列名列表。"""
    pattern = rf"CREATE TABLE `{table_name}` \((.*?)\)\s*(?:ENGINE=|$)"
    match = re.search(pattern, schema_text, re.DOTALL)
    if not match:
        return []

    body = match.group(1)
    columns = []
    for line in body.split("\n"):
        line = line.strip()
        col_match = re.match(r"`(\w+)`", line)
        if (
            col_match
            and not line.startswith("PRIMARY KEY")
            and not line.startswith("KEY ")
        ):
            columns.append(col_match.group(1))
    return columns


def parse_insert_values(sql_file: Path) -> list[tuple]:
    """解析 mysqldump INSERT INTO ... VALUES (...),(...); 格式，返回行元组列表。"""
    text = sql_file.read_text(encoding="utf-8")

    # 找到 INSERT INTO ... VALUES 部分
    match = re.search(r"INSERT INTO `\w+` VALUES\s*", text)
    if not match:
        return []

    values_str = text[match.end() :].rstrip().rstrip(";")

    rows = []
    # 用状态机解析，处理字符串内的逗号和括号
    i = 0
    while i < len(values_str):
        if values_str[i] == "(":
            # 找到匹配的右括号
            depth = 1
            j = i + 1
            in_string = False
            escape_next = False
            while j < len(values_str) and depth > 0:
                ch = values_str[j]
                if escape_next:
                    escape_next = False
                elif ch == "\\":
                    escape_next = True
                elif ch == "'" and not in_string:
                    in_string = True
                elif ch == "'" and in_string:
                    in_string = False
                elif ch == "(" and not in_string:
                    depth += 1
                elif ch == ")" and not in_string:
                    depth -= 1
                j += 1

            row_str = values_str[i + 1 : j - 1]
            row = parse_row(row_str)
            rows.append(row)
            i = j
        else:
            i += 1

    return rows


def parse_row(row_str: str) -> tuple:
    """解析单行值字符串，如 "'2026-02','2025/2026',NULL,2026,2,325" """
    values = []
    i = 0
    while i < len(row_str):
        if row_str[i] == "'":
            # 字符串值
            j = i + 1
            escape_next = False
            while j < len(row_str):
                if escape_next:
                    escape_next = False
                elif row_str[j] == "\\":
                    escape_next = True
                elif row_str[j] == "'":
                    break
                j += 1
            val = row_str[i + 1 : j].replace("\\'", "'").replace("\\\\", "\\")
            values.append(val)
            i = j + 1
            # Skip comma
            if i < len(row_str) and row_str[i] == ",":
                i += 1
        elif row_str[i : i + 4] == "NULL":
            values.append(None)
            i += 4
            if i < len(row_str) and row_str[i] == ",":
                i += 1
        elif row_str[i] == ",":
            i += 1
        else:
            # Numeric value
            j = i
            while j < len(row_str) and row_str[j] != ",":
                j += 1
            values.append(row_str[i:j])
            i = j
            if i < len(row_str) and row_str[i] == ",":
                i += 1

    return tuple(values)


def write_csv(filepath: Path, headers: list[str], rows: list[tuple]):
    """写 CSV 文件。"""
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        for row in rows:
            writer.writerow(row)


# --- 样本文件生成 ---


def generate_soybean_balance(schema_text: str) -> None:
    """生成大豆平衡表 CSV（美/巴/阿各 10 行）。"""
    output_headers = [
        "country",
        "date_time",
        "market_year",
        "market_year_flag",
        "year",
        "month",
        "beginning_stocks",
        "production",
        "imports",
        "crush",
        "exports",
        "ending_stocks",
        "stock_sales_ratio",
        "main_price",
    ]

    all_rows = []
    for table, country in [
        ("usa_soybean_balance", "USA"),
        ("brazil_soybean_balance", "Brazil"),
        ("argentina_soybean_balance", "Argentina"),
    ]:
        columns = extract_columns(schema_text, table)
        data_file = DATA_DIR / f"{table}.sql"
        if not data_file.exists():
            print(f"WARNING: {data_file} not found, skipping")
            continue

        rows = parse_insert_values(data_file)

        # 巴西表的 crush 字段名可能不同
        col_map = {c: i for i, c in enumerate(columns)}

        for row in rows[:10]:
            out = [country]
            for h in output_headers[1:]:
                # 处理字段名差异
                field = h
                if h == "crush" and h not in col_map:
                    field = "crushings" if "crushings" in col_map else "crush"
                idx = col_map.get(field)
                out.append(row[idx] if idx is not None and idx < len(row) else "")
            all_rows.append(out)

    output_file = OUTPUT_DIR / "soybean-balance.csv"
    write_csv(output_file, output_headers, all_rows)
    print(f"  Generated {output_file.name}: {len(all_rows)} rows")


def generate_weather_data(schema_text: str) -> None:
    """生成气象数据 CSV（降水 10 行 + 温度 10 行，仅 GRAND TOTAL）。"""
    output_headers = [
        "data_type",
        "date_time",
        "state",
        "alias",
        "weekly",
        "year",
        "value",
        "five_year_avg",
        "thirty_year_avg",
    ]

    all_rows = []

    # 降水
    precip_cols = extract_columns(schema_text, "usa_weather_precipitation")
    precip_file = DATA_DIR / "usa_weather_precipitation.sql"
    if precip_file.exists():
        precip_col_map = {c: i for i, c in enumerate(precip_cols)}
        precip_rows = parse_insert_values(precip_file)
        # 取前 10 行（含不同州，让 Agent 识别州维度）
        for row in precip_rows[:10]:
            all_rows.append(
                [
                    "precipitation",
                    row[precip_col_map["date_time"]],
                    row[precip_col_map["state"]],
                    row[precip_col_map.get("alias", 0)]
                    if "alias" in precip_col_map
                    else "",
                    row[precip_col_map["weekly"]],
                    row[precip_col_map["year"]],
                    row[precip_col_map["precipitation"]],
                    row[precip_col_map["five_year_avg_precipitation"]],
                    row[precip_col_map.get("year_avg_30_precipitation", 0)]
                    if "year_avg_30_precipitation" in precip_col_map
                    else "",
                ]
            )

    # 温度
    temp_cols = extract_columns(schema_text, "usa_weather_temperature")
    temp_file = DATA_DIR / "usa_weather_temperature.sql"
    if temp_file.exists():
        temp_col_map = {c: i for i, c in enumerate(temp_cols)}
        temp_rows = parse_insert_values(temp_file)
        # 取前 10 行
        for row in temp_rows[:10]:
            all_rows.append(
                [
                    "temperature",
                    row[temp_col_map["date_time"]],
                    row[temp_col_map["state"]],
                    row[temp_col_map.get("alias", 0)]
                    if "alias" in temp_col_map
                    else "",
                    row[temp_col_map["weekly"]],
                    row[temp_col_map["year"]],
                    row[temp_col_map["avg_temperature"]],
                    row[temp_col_map["five_year_avg_avg_temperature"]],
                    row[temp_col_map.get("year_avg_30_avg_temperature", 0)]
                    if "year_avg_30_avg_temperature" in temp_col_map
                    else "",
                ]
            )

    output_file = OUTPUT_DIR / "weather-data.csv"
    write_csv(output_file, output_headers, all_rows)
    print(f"  Generated {output_file.name}: {len(all_rows)} rows")


def generate_trade_export(schema_text: str) -> None:
    """生成贸易出口 CSV（出口明细 10 行 + 油粕价格 10 行）。"""

    # Part 1: 出口明细
    export_headers = [
        "data_type",
        "date",
        "country",
        "commodity",
        "crop_year",
        "weekly_exports",
        "accum_exports",
        "outstanding_sales",
        "net_sales",
        "total_commitments",
    ]

    all_rows = []

    export_cols = extract_columns(schema_text, "usa_weekly_export_detail")
    export_file = DATA_DIR / "usa_weekly_export_detail.sql"
    if export_file.exists():
        export_col_map = {c: i for i, c in enumerate(export_cols)}
        export_rows = parse_insert_values(export_file)
        # 取前 10 行（已按 update_time DESC 排序）
        for row in export_rows[:10]:
            all_rows.append(
                [
                    "export_detail",
                    row[export_col_map["t_date"]],
                    row[export_col_map["country"]],
                    row[export_col_map["commodity"]],
                    row[export_col_map["crop_year"]],
                    row[export_col_map["weekly_exports"]],
                    row[export_col_map["accum_exports"]],
                    row[export_col_map["outstanding_sales"]],
                    row[export_col_map["net_sales"]],
                    row[export_col_map["total_commitments"]],
                ]
            )

    # Part 2: 油粕价格
    price_cols = extract_columns(schema_text, "usa_oil_meal_price_cost")
    price_file = DATA_DIR / "usa_oil_meal_price_cost.sql"
    if price_file.exists():
        price_col_map = {c: i for i, c in enumerate(price_cols)}
        price_rows = parse_insert_values(price_file)
        for row in price_rows[:10]:
            all_rows.append(
                [
                    "price_cost",
                    row[price_col_map["date_time"]],
                    "",  # no country
                    "",  # no commodity
                    "",  # no crop_year
                    "",  # margin as weekly_exports placeholder
                    row[price_col_map["margin"]],
                    row[price_col_map["margin_year_ago"]],
                    row[price_col_map["five_year_avg_margin"]],
                    "",
                ]
            )

    output_file = OUTPUT_DIR / "trade-export.csv"
    write_csv(output_file, export_headers, all_rows)
    print(f"  Generated {output_file.name}: {len(all_rows)} rows")


def main():
    if not SCHEMA_FILE.exists():
        print(f"ERROR: Schema file not found: {SCHEMA_FILE}")
        print(
            "Please run 'ops/mysql-sample/refresh.sh' first to generate the sample database."
        )
        sys.exit(1)

    if not DATA_DIR.exists():
        print(f"ERROR: Data directory not found: {DATA_DIR}")
        sys.exit(1)

    schema_text = SCHEMA_FILE.read_text(encoding="utf-8")

    print("Generating workshop sample materials...")

    # 1. DDL
    ddl_content = extract_ddl(schema_text, DDL_TABLES)
    ddl_file = OUTPUT_DIR / "cofco-grease-ddl.sql"
    ddl_file.write_text(ddl_content, encoding="utf-8")
    print(f"  Generated {ddl_file.name}: {len(DDL_TABLES)} tables")

    # 2. 大豆平衡表
    generate_soybean_balance(schema_text)

    # 3. 气象数据
    generate_weather_data(schema_text)

    # 4. 贸易+价格
    generate_trade_export(schema_text)

    print("\nDone! Files are in:", OUTPUT_DIR)
    print("Drag these files into the Workshop Chat Panel to start building ontology.")


if __name__ == "__main__":
    main()
