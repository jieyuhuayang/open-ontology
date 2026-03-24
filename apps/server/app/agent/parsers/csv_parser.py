"""CSV file parser — extracts columns, types, and metadata."""

import csv
import io
import re
from pathlib import Path

from app.agent.parsers.base import (
    BaseParser,
    ColumnInfo,
    ParseResult,
    is_audit_field,
    is_primary_key_candidate,
)

_DATE_RE = re.compile(r"^\d{4}[-/]\d{2}[-/]\d{2}$")
_TIMESTAMP_RE = re.compile(r"^\d{4}[-/]\d{2}[-/]\d{2}[T ]\d{2}:\d{2}")
_INT_RE = re.compile(r"^-?\d+$")
_FLOAT_RE = re.compile(r"^-?\d+\.\d+$")
_BOOL_VALUES = {"true", "false", "0", "1", "yes", "no", "t", "f"}

_MAX_INFER_ROWS = 1000
_SAMPLE_ROWS = 5
_TYPE_THRESHOLD = 0.95


def _infer_type(values: list[str]) -> str:
    """Infer column type from non-empty sample values."""
    if not values:
        return "String"

    type_counts: dict[str, int] = {
        "Integer": 0,
        "Double": 0,
        "Date": 0,
        "Timestamp": 0,
        "Boolean": 0,
        "String": 0,
    }

    for v in values:
        v = v.strip()
        if not v:
            continue
        if _TIMESTAMP_RE.match(v):
            type_counts["Timestamp"] += 1
        elif _DATE_RE.match(v):
            type_counts["Date"] += 1
        elif _INT_RE.match(v):
            type_counts["Integer"] += 1
        elif _FLOAT_RE.match(v):
            type_counts["Double"] += 1
        elif v.lower() in _BOOL_VALUES:
            type_counts["Boolean"] += 1
        else:
            type_counts["String"] += 1

    total = sum(type_counts.values())
    if total == 0:
        return "String"

    best_type = max(type_counts, key=lambda k: type_counts[k])
    if type_counts[best_type] / total >= _TYPE_THRESHOLD:
        return best_type
    return "String"


class CsvParser(BaseParser):
    async def parse(self, file_path: Path) -> ParseResult:
        text_content = self._read_file(file_path)
        if not text_content.strip():
            return ParseResult(file_type="csv", columns=[], row_count=0, metadata={"empty": True})

        # Detect delimiter
        try:
            dialect = csv.Sniffer().sniff(text_content[:4096])
            delimiter = dialect.delimiter
            # Sniffer can pick up letter chars as delimiters for single-column CSVs
            if delimiter.isalnum():
                delimiter = ","
        except csv.Error:
            delimiter = ","

        reader = csv.reader(io.StringIO(text_content), delimiter=delimiter)
        rows_iter = iter(reader)

        # Read header
        try:
            header = next(rows_iter)
        except StopIteration:
            return ParseResult(file_type="csv", columns=[], row_count=0)

        # Read data rows (up to _MAX_INFER_ROWS for type inference)
        data_rows: list[list[str]] = []
        for row in rows_iter:
            data_rows.append(row)
            if len(data_rows) >= _MAX_INFER_ROWS:
                # Count remaining rows
                remaining = sum(1 for _ in rows_iter)
                total_rows = len(data_rows) + remaining
                break
        else:
            total_rows = len(data_rows)

        # Build column info
        columns: list[ColumnInfo] = []
        for i, col_name in enumerate(header):
            col_values = [row[i] for row in data_rows if i < len(row)]
            samples = [v for v in col_values[:_SAMPLE_ROWS] if v.strip()]

            columns.append(
                ColumnInfo(
                    name=col_name.strip(),
                    inferred_type=_infer_type(col_values),
                    sample_values=samples,
                    is_primary_key_candidate=is_primary_key_candidate(col_name.strip()),
                    is_audit_field=is_audit_field(col_name.strip()),
                )
            )

        return ParseResult(
            file_type="csv",
            columns=columns,
            row_count=total_rows,
            metadata={"delimiter": delimiter, "encoding": "utf-8"},
        )

    @staticmethod
    def _read_file(file_path: Path) -> str:
        """Read file with UTF-8, fallback to GBK."""
        try:
            return file_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            try:
                return file_path.read_text(encoding="gbk")
            except UnicodeDecodeError:
                return file_path.read_text(encoding="utf-8", errors="replace")
