#!/usr/bin/env python3
"""
generate.py — Fetch real A-share data via AKShare and generate SQL seed files.

Usage:
    cd ops/mysql-sample/finance
    pip install akshare   # or: uv pip install akshare
    python generate.py

Output: sql/01-schema.sql ~ sql/07-update-latest.sql
"""

import os
import random
import datetime
from pathlib import Path

import akshare as ak

random.seed(42)

SQL_DIR = Path(__file__).parent / "sql"
SQL_DIR.mkdir(exist_ok=True)

# ── Constants ─────────────────────────────────────────────────

# 50 target companies: well-known A-share stocks across sectors
# We'll pick from real data, but define a curated list of codes to ensure diversity
TARGET_COMPANY_CODES = [
    # 白酒
    "600519",
    "000858",
    "000568",
    # 银行
    "601398",
    "601288",
    "600036",
    "601166",
    "601818",
    # 保险
    "601318",
    "601601",
    # 券商
    "600030",
    "601688",
    # 地产
    "000002",
    "001979",
    # 新能源/光伏
    "300750",
    "601012",
    "600438",
    # 汽车
    "600104",
    "002594",
    "601238",
    # 医药
    "600276",
    "000538",
    "300760",
    "603259",
    # 科技/互联网
    "002415",
    "600588",
    "603501",
    "002230",
    # 家电
    "000651",
    "000333",
    "002032",
    # 食品饮料
    "600887",
    "002304",
    "603288",
    # 钢铁/有色
    "600019",
    "601899",
    "603993",
    # 电力/公用
    "600900",
    "601985",
    # 通信/电子
    "000063",
    "600183",
    "002049",
    # 建材/化工
    "600585",
    "000963",
    "600309",
    # 交运/物流
    "601006",
    "600029",
    # 传媒/教育
    "300413",
]
assert len(TARGET_COMPANY_CODES) == 50, (
    f"Need exactly 50 codes, got {len(TARGET_COMPANY_CODES)}"
)

# Real brokerage firms for analysts
BROKERAGES = [
    "中信证券",
    "海通证券",
    "国泰君安",
    "华泰证券",
    "广发证券",
    "招商证券",
    "申万宏源",
    "中金公司",
    "银河证券",
    "国信证券",
    "兴业证券",
    "东方证券",
    "光大证券",
    "中泰证券",
    "天风证券",
]

# Analyst specialties (matching sectors)
SPECIALTIES = [
    "白酒",
    "银行",
    "保险",
    "券商",
    "地产",
    "新能源",
    "汽车",
    "医药",
    "科技",
    "家电",
    "食品饮料",
    "钢铁有色",
    "电力公用",
    "通信电子",
    "建材化工",
]

# Chinese surnames and given name characters for generating names
SURNAMES = [
    "张",
    "王",
    "李",
    "赵",
    "陈",
    "刘",
    "杨",
    "黄",
    "周",
    "吴",
    "徐",
    "孙",
    "马",
    "朱",
    "胡",
    "郭",
    "何",
    "林",
    "罗",
    "郑",
    "梁",
    "谢",
    "宋",
    "唐",
    "韩",
    "曹",
    "许",
    "邓",
    "冯",
    "萧",
]
GIVEN_CHARS = [
    "伟",
    "芳",
    "娜",
    "敏",
    "静",
    "强",
    "磊",
    "洋",
    "勇",
    "艳",
    "杰",
    "娟",
    "涛",
    "明",
    "超",
    "秀",
    "霞",
    "平",
    "刚",
    "桂",
    "文",
    "华",
    "鑫",
    "宇",
    "翔",
    "峰",
    "博",
    "瑞",
    "嘉",
    "昊",
]

RATINGS = ["买入", "增持", "中性", "减持", "卖出"]
RATING_WEIGHTS = [0.35, 0.30, 0.20, 0.10, 0.05]  # buy-heavy like real market


def sql_escape(s: str | None) -> str:
    """Escape a string for MySQL SQL insertion."""
    if s is None:
        return "NULL"
    return "'" + str(s).replace("\\", "\\\\").replace("'", "\\'") + "'"


def sql_val(v) -> str:
    """Convert a Python value to SQL literal."""
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, (datetime.date, datetime.datetime)):
        return f"'{v}'"
    return sql_escape(str(v))


# ── Step 1: Fetch Company Data ────────────────────────────────


def fetch_companies() -> list[dict]:
    """Fetch real A-share company info for our 50 target codes."""
    print("📊 Fetching A-share company list...")
    all_stocks = ak.stock_info_a_code_name()
    # Build code→name mapping
    code_name = {}
    for _, row in all_stocks.iterrows():
        code_name[str(row["code"]).zfill(6)] = row["name"]

    companies = []
    for code in TARGET_COMPANY_CODES:
        name = code_name.get(code, f"未知公司{code}")
        print(f"  → Fetching details for {code} {name}...")
        try:
            info_df = ak.stock_individual_info_em(symbol=code)
            info = dict(zip(info_df["item"], info_df["value"]))
            market_cap = None
            if "总市值" in info:
                try:
                    market_cap = round(float(info["总市值"]) / 1e8, 2)  # to 亿元
                except (ValueError, TypeError):
                    pass
            sector = info.get("行业", None)
            founded = None
            if "上市时间" in info:
                try:
                    founded = int(str(info["上市时间"])[:4])
                except (ValueError, TypeError):
                    pass
        except Exception as e:
            print(f"    ⚠️ Failed to get details for {code}: {e}")
            market_cap = None
            sector = None
            founded = None

        companies.append(
            {
                "id": code,
                "name": name,
                "sector": sector,
                "market_cap": market_cap,
                "country": "中国",
                "founded_year": founded,
                "is_active": True,
            }
        )

    print(f"  ✅ Got {len(companies)} companies")
    return companies


# ── Step 2: Fetch Fund Data ───────────────────────────────────


def fetch_funds() -> list[dict]:
    """Fetch 30 real mutual funds (equity/mixed type)."""
    print("📊 Fetching mutual fund list...")
    fund_list = ak.fund_name_em()

    # Filter for equity/mixed funds
    equity_funds = fund_list[
        fund_list["基金类型"].str.contains("股票|混合", na=False)
    ].head(200)  # take a larger pool to pick from

    funds = []
    for _, row in equity_funds.iterrows():
        if len(funds) >= 30:
            break
        code = str(row["基金代码"]).strip()
        name = str(row["基金简称"]).strip()
        fund_type = str(row["基金类型"]).strip()

        print(f"  → Fetching details for fund {code} {name}...")
        try:
            overview = ak.fund_individual_basic_info_xq(symbol=code)
            info = dict(zip(overview["item"], overview["value"]))
            aum = None
            if "基金规模" in info:
                try:
                    aum_str = str(info["基金规模"]).replace("亿", "").strip()
                    aum = round(float(aum_str), 2)
                except (ValueError, TypeError):
                    pass
            manager = info.get("基金经理", None)
            inception = info.get("成立日期", None)
            if inception:
                try:
                    inception = str(inception)[:10]
                except (ValueError, TypeError):
                    inception = None
        except Exception as e:
            print(f"    ⚠️ Failed to get fund details for {code}: {e}")
            aum = None
            manager = None
            inception = None

        funds.append(
            {
                "id": code,
                "name": name,
                "fund_type": fund_type,
                "aum": aum,
                "inception_date": inception,
                "manager": manager,
                "is_active": True,
            }
        )

    print(f"  ✅ Got {len(funds)} funds")
    return funds


# ── Step 3: Fetch Holdings ────────────────────────────────────


def fetch_holdings(funds: list[dict], company_ids: set[str]) -> list[dict]:
    """Fetch fund portfolio holdings, keeping only holdings in our 50 companies."""
    print("📊 Fetching fund portfolio holdings...")
    holdings = []
    # Use recent reporting date
    year = "2025"
    report_dates = ["20250630", "20250331", "20241231", "20240930"]

    for fund in funds:
        fund_id = fund["id"]
        got_data = False
        for report_date in report_dates:
            if got_data:
                break
            try:
                print(
                    f"  → Fetching holdings for fund {fund_id} (date={report_date})..."
                )
                df = ak.fund_portfolio_hold_em(symbol=fund_id, date=report_date)
                if df is not None and not df.empty:
                    for _, row in df.iterrows():
                        stock_code = str(row["股票代码"]).zfill(6)
                        if stock_code in company_ids:
                            holdings.append(
                                {
                                    "fund_id": fund_id,
                                    "company_id": stock_code,
                                }
                            )
                    got_data = True
            except Exception as e:
                print(f"    ⚠️ Failed for fund {fund_id} date {report_date}: {e}")
                continue

    # Deduplicate
    seen = set()
    unique_holdings = []
    for h in holdings:
        key = (h["fund_id"], h["company_id"])
        if key not in seen:
            seen.add(key)
            unique_holdings.append(h)

    # If we have too few natural holdings, supplement with random ones
    if len(unique_holdings) < 100:
        print(f"  ⚠️ Only {len(unique_holdings)} natural holdings, supplementing...")
        company_list = list(company_ids)
        fund_ids = [f["id"] for f in funds]
        while len(unique_holdings) < 200:
            fid = random.choice(fund_ids)
            cid = random.choice(company_list)
            key = (fid, cid)
            if key not in seen:
                seen.add(key)
                unique_holdings.append({"fund_id": fid, "company_id": cid})

    print(f"  ✅ Got {len(unique_holdings)} holdings (fund-company pairs)")
    return unique_holdings


# ── Step 4: Generate Analysts ─────────────────────────────────


def generate_analysts(companies: list[dict]) -> list[dict]:
    """Generate 30 fictional analysts with real brokerage names."""
    print("📊 Generating analyst data...")
    analysts = []
    used_names = set()

    for i in range(30):
        # Generate unique Chinese name
        while True:
            surname = random.choice(SURNAMES)
            given = random.choice(GIVEN_CHARS) + random.choice(GIVEN_CHARS)
            full_name = surname + given
            if full_name not in used_names:
                used_names.add(full_name)
                break

        firm = BROKERAGES[i % len(BROKERAGES)]
        specialty = SPECIALTIES[i % len(SPECIALTIES)]
        company = companies[i % len(companies)]  # Primary coverage company
        hire_year = random.randint(2010, 2023)
        hire_month = random.randint(1, 12)
        hire_date = f"{hire_year}-{hire_month:02d}-01"

        analysts.append(
            {
                "id": f"ANL-{i + 1:03d}",
                "name": full_name,
                "firm": firm,
                "specialty": specialty,
                "company_id": company["id"],
                "hire_date": hire_date,
                "is_active": True,
            }
        )

    print(f"  ✅ Generated {len(analysts)} analysts")
    return analysts


# ── Step 5: Generate Rating Reports ──────────────────────────


def generate_reports(analysts: list[dict], companies: list[dict]) -> list[dict]:
    """Generate 60 rating reports with realistic data."""
    print("📊 Generating rating reports...")
    reports = []

    summaries_templates = [
        "公司基本面稳健，维持{rating}评级",
        "行业景气度回升，上调目标价至{target_price}元",
        "季报超预期，{rating}评级不变",
        "估值处于历史低位，首次覆盖给予{rating}",
        "新业务拓展顺利，维持{rating}评级",
        "短期承压但长期逻辑不变，维持{rating}",
        "产能释放带动业绩增长，{rating}评级",
        "行业竞争格局改善，上调至{rating}",
    ]

    for i in range(60):
        analyst = analysts[i % len(analysts)]
        company = companies[i % len(companies)]
        rating = random.choices(RATINGS, weights=RATING_WEIGHTS, k=1)[0]

        # Generate realistic target price based on market cap
        base_price = random.uniform(5, 300)
        target_price = round(base_price * random.uniform(0.9, 1.3), 2)

        # Random date in 2024-2025
        year = random.choice([2024, 2025])
        month = random.randint(1, 12)
        day = random.randint(1, 28)
        report_date = f"{year}-{month:02d}-{day:02d}"

        summary_tmpl = random.choice(summaries_templates)
        summary = summary_tmpl.format(rating=rating, target_price=target_price)

        reports.append(
            {
                "id": f"RPT-{i + 1:05d}",
                "analyst_id": analyst["id"],
                "company_id": company["id"],
                "rating": rating,
                "target_price": target_price,
                "report_date": report_date,
                "summary": summary,
            }
        )

    print(f"  ✅ Generated {len(reports)} reports")
    return reports


# ── Step 6: Compute latest_report_id ─────────────────────────


def compute_latest_reports(reports: list[dict]) -> tuple[dict, dict]:
    """For each analyst and company, find their latest report."""
    analyst_latest: dict[str, tuple[str, str]] = {}  # analyst_id → (report_id, date)
    company_latest: dict[str, tuple[str, str]] = {}  # company_id → (report_id, date)

    for r in reports:
        aid = r["analyst_id"]
        cid = r["company_id"]
        rid = r["id"]
        dt = r["report_date"]

        if aid not in analyst_latest or dt > analyst_latest[aid][1]:
            analyst_latest[aid] = (rid, dt)
        if cid not in company_latest or dt > company_latest[cid][1]:
            company_latest[cid] = (rid, dt)

    return (
        {k: v[0] for k, v in analyst_latest.items()},
        {k: v[0] for k, v in company_latest.items()},
    )


# ── SQL Writers ───────────────────────────────────────────────


def write_schema():
    """Write 01-schema.sql"""
    path = SQL_DIR / "01-schema.sql"
    path.write_text(
        """\
-- 01-schema.sql — Finance sample: 5 tables for Link Type testing
-- Generated by generate.py — DO NOT EDIT MANUALLY

CREATE TABLE companies (
  id              VARCHAR(10)  PRIMARY KEY COMMENT '股票代码 e.g. 600519',
  name            VARCHAR(100) NOT NULL    COMMENT '公司简称',
  sector          VARCHAR(50)              COMMENT '所属行业',
  market_cap      DOUBLE                   COMMENT '总市值(亿元)',
  country         VARCHAR(50) DEFAULT '中国',
  founded_year    INT                      COMMENT '上市年份',
  latest_report_id VARCHAR(20)             COMMENT 'FK → rating_reports.id (for BO link)',
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      DATETIME DEFAULT NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='A股上市公司';

CREATE TABLE analysts (
  id              VARCHAR(20)  PRIMARY KEY COMMENT '分析师ID e.g. ANL-001',
  name            VARCHAR(100) NOT NULL    COMMENT '分析师姓名(虚构)',
  firm            VARCHAR(100)             COMMENT '所属券商(真实)',
  specialty       VARCHAR(50)              COMMENT '覆盖行业',
  company_id      VARCHAR(10)              COMMENT 'FK → companies.id (主覆盖公司)',
  latest_report_id VARCHAR(20)             COMMENT 'FK → rating_reports.id (for BO link)',
  hire_date       DATE                     COMMENT '入职日期',
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      DATETIME DEFAULT NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='证券分析师';

CREATE TABLE rating_reports (
  id              VARCHAR(20)  PRIMARY KEY COMMENT '研报ID e.g. RPT-00001',
  analyst_id      VARCHAR(20)              COMMENT '分析师ID(信息列)',
  company_id      VARCHAR(10)              COMMENT '公司代码(信息列)',
  rating          VARCHAR(20)              COMMENT '评级: 买入/增持/中性/减持/卖出',
  target_price    DOUBLE                   COMMENT '目标价(元)',
  report_date     DATE                     COMMENT '研报日期',
  summary         VARCHAR(500)             COMMENT '摘要',
  created_at      DATETIME DEFAULT NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='研报评级(Backing Object)';

CREATE TABLE funds (
  id              VARCHAR(20)  PRIMARY KEY COMMENT '基金代码 e.g. 000001',
  name            VARCHAR(100) NOT NULL    COMMENT '基金简称',
  fund_type       VARCHAR(30)              COMMENT '基金类型: 股票型/混合型/指数型',
  aum             DOUBLE                   COMMENT '资产规模(亿元)',
  inception_date  DATE                     COMMENT '成立日期',
  manager         VARCHAR(100)             COMMENT '基金经理',
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      DATETIME DEFAULT NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公募基金';

CREATE TABLE fund_company_holdings (
  fund_id         VARCHAR(20) NOT NULL     COMMENT '→ funds.id',
  company_id      VARCHAR(10) NOT NULL     COMMENT '→ companies.id',
  PRIMARY KEY (fund_id, company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='基金持仓(Join Table)';
""",
        encoding="utf-8",
    )
    print(f"  📝 {path.name}")


def write_companies_sql(companies: list[dict]):
    """Write 02-seed-companies.sql"""
    path = SQL_DIR / "02-seed-companies.sql"
    lines = ["-- 02-seed-companies.sql — 50 real A-share companies", ""]
    for c in companies:
        vals = ", ".join(
            [
                sql_val(c["id"]),
                sql_val(c["name"]),
                sql_val(c["sector"]),
                sql_val(c["market_cap"]),
                sql_val(c["country"]),
                sql_val(c["founded_year"]),
                "TRUE",
            ]
        )
        lines.append(
            f"INSERT INTO companies (id, name, sector, market_cap, country, founded_year, is_active) "
            f"VALUES ({vals});"
        )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"  📝 {path.name}")


def write_funds_sql(funds: list[dict]):
    """Write 03-seed-funds.sql"""
    path = SQL_DIR / "03-seed-funds.sql"
    lines = ["-- 03-seed-funds.sql — 30 real mutual funds", ""]
    for f in funds:
        vals = ", ".join(
            [
                sql_val(f["id"]),
                sql_val(f["name"]),
                sql_val(f["fund_type"]),
                sql_val(f["aum"]),
                sql_val(f["inception_date"]),
                sql_val(f["manager"]),
                "TRUE",
            ]
        )
        lines.append(
            f"INSERT INTO funds (id, name, fund_type, aum, inception_date, manager, is_active) "
            f"VALUES ({vals});"
        )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"  📝 {path.name}")


def write_analysts_sql(analysts: list[dict]):
    """Write 04-seed-analysts.sql"""
    path = SQL_DIR / "04-seed-analysts.sql"
    lines = ["-- 04-seed-analysts.sql — 30 fictional analysts at real brokerages", ""]
    for a in analysts:
        vals = ", ".join(
            [
                sql_val(a["id"]),
                sql_val(a["name"]),
                sql_val(a["firm"]),
                sql_val(a["specialty"]),
                sql_val(a["company_id"]),
                sql_val(a["hire_date"]),
                "TRUE",
            ]
        )
        lines.append(
            f"INSERT INTO analysts (id, name, firm, specialty, company_id, hire_date, is_active) "
            f"VALUES ({vals});"
        )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"  📝 {path.name}")


def write_reports_sql(reports: list[dict]):
    """Write 05-seed-reports.sql"""
    path = SQL_DIR / "05-seed-reports.sql"
    lines = ["-- 05-seed-reports.sql — 60 rating reports", ""]
    for r in reports:
        vals = ", ".join(
            [
                sql_val(r["id"]),
                sql_val(r["analyst_id"]),
                sql_val(r["company_id"]),
                sql_val(r["rating"]),
                sql_val(r["target_price"]),
                sql_val(r["report_date"]),
                sql_val(r["summary"]),
            ]
        )
        lines.append(
            f"INSERT INTO rating_reports (id, analyst_id, company_id, rating, target_price, report_date, summary) "
            f"VALUES ({vals});"
        )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"  📝 {path.name}")


def write_holdings_sql(holdings: list[dict]):
    """Write 06-seed-holdings.sql"""
    path = SQL_DIR / "06-seed-holdings.sql"
    lines = ["-- 06-seed-holdings.sql — Fund-Company holdings (join table)", ""]
    for h in holdings:
        vals = f"{sql_val(h['fund_id'])}, {sql_val(h['company_id'])}"
        lines.append(
            f"INSERT INTO fund_company_holdings (fund_id, company_id) VALUES ({vals});"
        )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"  📝 {path.name}")


def write_latest_report_sql(
    analyst_latest: dict[str, str],
    company_latest: dict[str, str],
):
    """Write 07-update-latest.sql — backfill latest_report_id."""
    path = SQL_DIR / "07-update-latest.sql"
    lines = [
        "-- 07-update-latest.sql — Backfill latest_report_id for BO links",
        "",
        "-- Analysts: set latest_report_id to their most recent report",
    ]
    for analyst_id, report_id in sorted(analyst_latest.items()):
        lines.append(
            f"UPDATE analysts SET latest_report_id = {sql_val(report_id)} "
            f"WHERE id = {sql_val(analyst_id)};"
        )

    lines.append("")
    lines.append("-- Companies: set latest_report_id to their most recent report")
    for company_id, report_id in sorted(company_latest.items()):
        lines.append(
            f"UPDATE companies SET latest_report_id = {sql_val(report_id)} "
            f"WHERE id = {sql_val(company_id)};"
        )

    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"  📝 {path.name}")


# ── Main ──────────────────────────────────────────────────────


def main():
    print("=" * 60)
    print("🏦 Finance Mock Data Generator (A-share + AKShare)")
    print("=" * 60)
    print()

    # Fetch real data
    companies = fetch_companies()
    funds = fetch_funds()
    company_ids = {c["id"] for c in companies}
    holdings = fetch_holdings(funds, company_ids)

    # Generate synthetic data
    analysts = generate_analysts(companies)
    reports = generate_reports(analysts, companies)
    analyst_latest, company_latest = compute_latest_reports(reports)

    # Write SQL files
    print()
    print("📝 Writing SQL files...")
    write_schema()
    write_companies_sql(companies)
    write_funds_sql(funds)
    write_analysts_sql(analysts)
    write_reports_sql(reports)
    write_holdings_sql(holdings)
    write_latest_report_sql(analyst_latest, company_latest)

    print()
    print("=" * 60)
    print("✅ All SQL files generated in sql/ directory!")
    print()
    print("Summary:")
    print(f"  • Companies: {len(companies)}")
    print(f"  • Funds:     {len(funds)}")
    print(f"  • Holdings:  {len(holdings)}")
    print(f"  • Analysts:  {len(analysts)}")
    print(f"  • Reports:   {len(reports)}")
    print()
    print("Next step: bash load.sh")
    print("=" * 60)


if __name__ == "__main__":
    main()
