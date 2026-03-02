"""MySQL and Excel/CSV data type to PropertyBaseType mapping rules."""

import re

# --- MySQL → PropertyBaseType ---
# Per PRD §8.7: BIGINT/INT/TINYINT → integer, DECIMAL/FLOAT/DOUBLE → double,
# BOOLEAN/BIT(1) → boolean
MYSQL_TYPE_MAP: dict[str, str] = {
    # Integer types → integer
    "tinyint": "integer",
    "smallint": "integer",
    "mediumint": "integer",
    "int": "integer",
    "integer": "integer",
    "bigint": "integer",
    # Float / decimal → double
    "float": "double",
    "double": "double",
    "decimal": "double",
    "numeric": "double",
    # String types
    "char": "string",
    "varchar": "string",
    "tinytext": "string",
    "text": "string",
    "mediumtext": "string",
    "longtext": "string",
    "enum": "string",
    "set": "string",
    # Binary
    "binary": "string",
    "varbinary": "string",
    "blob": "string",
    "tinyblob": "string",
    "mediumblob": "string",
    "longblob": "string",
    # Date/time
    "date": "date",
    "datetime": "timestamp",
    "timestamp": "timestamp",
    "time": "string",
    "year": "integer",
    # Boolean
    "bit": "boolean",
    "boolean": "boolean",
    # JSON
    "json": "string",
}


def mysql_type_to_property_type(mysql_type: str) -> str:
    """Map a MySQL column type to a PropertyBaseType.

    Strips parentheses (e.g. varchar(255) → varchar) and is case-insensitive.
    Unknown types fall back to "string".
    """
    base = mysql_type.lower().split("(")[0].strip()
    return MYSQL_TYPE_MAP.get(base, "string")


# --- Excel/CSV value inference ---
# Scan up to first 1000 rows. Priority: integer > double > date > timestamp > boolean > string.
# If more than 5% of non-empty values don't match, fall back to string.

_INTEGER_RE = re.compile(r"^-?\d+$")
_FLOAT_RE = re.compile(r"^-?\d+\.\d+$")
_ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_ISO_TIMESTAMP_RE = re.compile(r"^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?")
_BOOLEAN_VALUES = frozenset({"true", "false", "1", "0"})

INFER_SAMPLE_SIZE = 1000
INFER_MISMATCH_THRESHOLD = 0.05  # 5%


def infer_column_type(values: list[str | None]) -> str:
    """Infer PropertyBaseType from a column of string values.

    Skips None and empty strings. Returns "string" if no valid values.
    """
    non_empty = [v for v in values[:INFER_SAMPLE_SIZE] if v is not None and v.strip() != ""]
    if not non_empty:
        return "string"

    total = len(non_empty)
    threshold = int(total * INFER_MISMATCH_THRESHOLD)

    # Try each type in priority order
    checks: list[tuple[str, re.Pattern[str]]] = [
        ("integer", _INTEGER_RE),
        ("double", _FLOAT_RE),
        ("date", _ISO_DATE_RE),
        ("timestamp", _ISO_TIMESTAMP_RE),
    ]

    for prop_type, pattern in checks:
        mismatches = sum(1 for v in non_empty if not pattern.match(v.strip()))
        if mismatches <= threshold:
            return prop_type

    # Boolean check
    bool_mismatches = sum(1 for v in non_empty if v.strip().lower() not in _BOOLEAN_VALUES)
    if bool_mismatches <= threshold:
        return "boolean"

    return "string"
