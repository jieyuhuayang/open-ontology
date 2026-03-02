"""Domain validators for Object Type, Link Type, and Property fields."""

import re
import unicodedata

from app.exceptions import AppError

PASCAL_CASE_PATTERN = re.compile(r"^[A-Z][a-zA-Z0-9_]*$")
ID_PATTERN = re.compile(r"^[a-z][a-z0-9-]*$")
LINK_SIDE_API_NAME_PATTERN = re.compile(r"^[a-z][a-zA-Z0-9]{0,99}$")
PROPERTY_ID_PATTERN = re.compile(r"^[a-zA-Z][a-zA-Z0-9_-]*$")
PROPERTY_API_NAME_PATTERN = re.compile(r"^[a-z][a-zA-Z0-9]{0,99}$")

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


def validate_link_type_id(id_value: str) -> None:
    """Validate link type id: same format as object type id."""
    if not ID_PATTERN.match(id_value):
        raise AppError(
            code="LINK_TYPE_INVALID_ID",
            message=f"id must match ^[a-z][a-z0-9-]*$: {id_value!r}",
            status_code=400,
        )


def validate_property_id(id_value: str) -> None:
    """Validate property id: starts with letter, contains letters/digits/hyphens/underscores."""
    if not PROPERTY_ID_PATTERN.match(id_value):
        raise AppError(
            code="PROPERTY_INVALID_ID",
            message=f"Property id must match ^[a-zA-Z][a-zA-Z0-9_-]*$: {id_value!r}",
            status_code=400,
        )


def validate_property_api_name(api_name: str) -> None:
    """Validate property apiName: camelCase, 1-100 chars, NFKC, no reserved words."""
    normalized = unicodedata.normalize("NFKC", api_name)
    if normalized != api_name:
        raise AppError(
            code="PROPERTY_INVALID_API_NAME",
            message=f"Property apiName must be NFKC normalized: {api_name!r}",
            status_code=400,
        )
    if not PROPERTY_API_NAME_PATTERN.match(api_name):
        raise AppError(
            code="PROPERTY_INVALID_API_NAME",
            message=f"Property apiName must start with lowercase letter and contain only letters and digits (1-100 chars): {api_name!r}",
            status_code=400,
        )
    if api_name.lower() in RESERVED_API_NAMES:
        raise AppError(
            code="PROPERTY_RESERVED_API_NAME",
            message=f"Property apiName is a reserved word: {api_name!r}",
            status_code=400,
        )


def validate_link_side_api_name(api_name: str, side: str) -> None:
    """Validate link side apiName: camelCase, 1-100 chars, NFKC, no reserved words."""
    normalized = unicodedata.normalize("NFKC", api_name)
    if normalized != api_name:
        raise AppError(
            code="LINK_TYPE_API_NAME_NOT_NFKC",
            message=f"Side {side} apiName must be NFKC normalized: {api_name!r}",
            status_code=400,
        )
    if not LINK_SIDE_API_NAME_PATTERN.match(api_name):
        raise AppError(
            code="LINK_TYPE_INVALID_API_NAME",
            message=f"Side {side} apiName must be camelCase (1-100 chars): {api_name!r}",
            status_code=400,
        )
    if api_name.lower() in RESERVED_API_NAMES:
        raise AppError(
            code="LINK_TYPE_RESERVED_API_NAME",
            message=f"Side {side} apiName is a reserved word: {api_name!r}",
            status_code=400,
        )
