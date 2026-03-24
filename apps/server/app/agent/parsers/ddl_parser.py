"""SQL DDL parser — extracts table definitions, columns, keys, and foreign keys."""

import re
from pathlib import Path

from app.agent.parsers.base import (
    BaseParser,
    ColumnInfo,
    ForeignKeyInfo,
    ParseResult,
    TableInfo,
)

# Regex patterns for DDL parsing
_CREATE_TABLE_RE = re.compile(
    r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`\"]?(\w+)[`\"]?\s*\((.*?)\)\s*(?:ENGINE|;|\Z)",
    re.IGNORECASE | re.DOTALL,
)
_PK_RE = re.compile(r"PRIMARY\s+KEY\s*\(([^)]+)\)", re.IGNORECASE)
_FK_RE = re.compile(
    r"FOREIGN\s+KEY\s*\([`\"]?(\w+)[`\"]?\)\s*REFERENCES\s+[`\"]?(\w+)[`\"]?\s*\([`\"]?(\w+)[`\"]?\)",
    re.IGNORECASE,
)
_UNIQUE_RE = re.compile(r"UNIQUE\s+(?:KEY|INDEX)?\s*(?:\w+\s*)?\(([^)]+)\)", re.IGNORECASE)
_COLUMN_RE = re.compile(
    r"^[`\"]?(\w+)[`\"]?\s+(\w+(?:\s*\([^)]*\))?)\s*(.*?)$",
    re.IGNORECASE,
)

# SQL type → ontology type mapping
_TYPE_MAP: dict[str, str] = {
    "int": "Integer",
    "integer": "Integer",
    "bigint": "Integer",
    "smallint": "Integer",
    "tinyint": "Integer",
    "mediumint": "Integer",
    "serial": "Integer",
    "float": "Double",
    "double": "Double",
    "decimal": "Double",
    "numeric": "Double",
    "real": "Double",
    "date": "Date",
    "datetime": "Timestamp",
    "timestamp": "Timestamp",
    "timestamptz": "Timestamp",
    "boolean": "Boolean",
    "bool": "Boolean",
    "text": "String",
    "varchar": "String",
    "char": "String",
    "json": "String",
    "jsonb": "String",
    "uuid": "String",
}


def _map_sql_type(sql_type: str) -> str:
    base = re.sub(r"\(.*\)", "", sql_type).strip().lower()
    return _TYPE_MAP.get(base, "String")


class DdlParser(BaseParser):
    async def parse(self, file_path: Path) -> ParseResult:
        content = file_path.read_text(encoding="utf-8")
        tables: list[TableInfo] = []

        for match in _CREATE_TABLE_RE.finditer(content):
            table_name = match.group(1)
            body = match.group(2)

            columns: list[ColumnInfo] = []
            primary_key: list[str] = []
            foreign_keys: list[ForeignKeyInfo] = []
            unique_constraints: list[list[str]] = []
            not_null_cols: set[str] = set()

            # Parse body line by line
            lines = [line.strip().rstrip(",") for line in body.split("\n") if line.strip()]

            for line in lines:
                # Primary key constraint
                pk_match = _PK_RE.search(line)
                if pk_match:
                    pk_cols = [c.strip().strip('`"') for c in pk_match.group(1).split(",")]
                    primary_key.extend(pk_cols)
                    continue

                # Foreign key constraint
                fk_match = _FK_RE.search(line)
                if fk_match:
                    foreign_keys.append(
                        ForeignKeyInfo(
                            from_column=fk_match.group(1),
                            to_table=fk_match.group(2),
                            to_column=fk_match.group(3),
                        )
                    )
                    continue

                # Unique constraint
                uq_match = _UNIQUE_RE.search(line)
                if uq_match:
                    uq_cols = [c.strip().strip('`"') for c in uq_match.group(1).split(",")]
                    unique_constraints.append(uq_cols)
                    continue

                # Skip other constraints (INDEX, KEY, CHECK, CONSTRAINT)
                if re.match(r"^\s*(INDEX|KEY|CHECK|CONSTRAINT)\b", line, re.IGNORECASE):
                    continue

                # Column definition
                col_match = _COLUMN_RE.match(line)
                if col_match:
                    col_name = col_match.group(1)
                    col_type = col_match.group(2)
                    modifiers = col_match.group(3).upper()

                    is_not_null = "NOT NULL" in modifiers
                    is_pk = "PRIMARY KEY" in modifiers
                    if is_not_null:
                        not_null_cols.add(col_name)
                    if is_pk:
                        primary_key.append(col_name)

                    columns.append(
                        ColumnInfo(
                            name=col_name,
                            inferred_type=_map_sql_type(col_type),
                            is_primary_key_candidate=is_pk or col_name in primary_key,
                        )
                    )

            # Update PK candidate flags
            for col in columns:
                if col.name in primary_key:
                    col.is_primary_key_candidate = True

            tables.append(
                TableInfo(
                    name=table_name,
                    columns=columns,
                    primary_key=primary_key,
                    foreign_keys=foreign_keys,
                    unique_constraints=unique_constraints,
                )
            )

        return ParseResult(
            file_type="sql",
            tables=tables,
            metadata={"table_count": len(tables)},
        )
