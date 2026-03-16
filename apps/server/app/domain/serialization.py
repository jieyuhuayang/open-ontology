"""Value serialization utilities for MySQL data types."""

from datetime import date, datetime
from decimal import Decimal


def serialize_value(v: object) -> object:
    """Convert MySQL values to JSON-serializable types."""
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, bytes):
        return v.hex()
    return v
