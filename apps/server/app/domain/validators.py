"""Domain validators for Object Type and Link Type fields."""

import re
import unicodedata

from app.exceptions import AppError

PASCAL_CASE_PATTERN = re.compile(r"^[A-Z][a-zA-Z0-9_]*$")
ID_PATTERN = re.compile(r"^[a-z][a-z0-9-]*$")
LINK_SIDE_API_NAME_PATTERN = re.compile(r"^[a-z][a-zA-Z0-9]{0,99}$")

RESERVED_API_NAMES = frozenset(
    {
        "ontology",
        "object",
        "property",
        "link",
        "relation",
        "rid",
        "primarykey",
        "typeid",
        "ontologyobject",
    }
)


def validate_api_name(api_name: str) -> None:
    """Validate apiName: PascalCase format + reserved word check (AD-7)."""
    if not PASCAL_CASE_PATTERN.match(api_name):
        raise AppError(
            code="OBJECT_TYPE_INVALID_API_NAME",
            message=f"apiName must be PascalCase: {api_name!r}",
            status_code=400,
        )
    if api_name.lower() in RESERVED_API_NAMES:
        raise AppError(
            code="OBJECT_TYPE_RESERVED_API_NAME",
            message=f"apiName is a reserved word: {api_name!r}",
            status_code=400,
        )


def validate_object_type_id(id_value: str) -> None:
    """Validate id: lowercase letters, digits, hyphens; must start with letter."""
    if not ID_PATTERN.match(id_value):
        raise AppError(
            code="OBJECT_TYPE_INVALID_ID",
            message=f"id must match ^[a-z][a-z0-9-]*$: {id_value!r}",
            status_code=400,
        )
