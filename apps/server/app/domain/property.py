"""Property domain models and request/response schemas."""

from datetime import datetime

from app.domain.common import DomainModel
from app.domain.object_type import ResourceStatus, Visibility
from app.domain.working_state import ChangeState

# ---------------------------------------------------------------------------
# Primary key and title key type constraints
# ---------------------------------------------------------------------------

PRIMARY_KEY_TYPES: frozenset[str] = frozenset(
    {
        "string",
        "integer",
        "short",
        "date",
        "timestamp",
        "boolean",
        "byte",
        "long",
    }
)

TITLE_KEY_TYPES: frozenset[str] = frozenset(
    {
        "string",
        "integer",
        "short",
        "date",
        "timestamp",
        "boolean",
        "byte",
        "long",
        "float",
        "double",
        "decimal",
        "geopoint",
        "cipher",
        "array",
    }
)

# All valid base types (mirrors PropertyBaseType enum)
ALL_BASE_TYPES: frozenset[str] = frozenset(
    {
        "string",
        "integer",
        "long",
        "float",
        "double",
        "decimal",
        "boolean",
        "date",
        "timestamp",
        "byte",
        "short",
        "array",
        "struct",
        "vector",
        "geopoint",
        "geoshape",
        "attachment",
        "time-series",
        "media-reference",
        "marking",
        "cipher",
    }
)

# Types that can be used as struct field types (exclude complex types)
STRUCT_FIELD_TYPES: frozenset[str] = frozenset(
    {
        "string",
        "integer",
        "long",
        "float",
        "double",
        "decimal",
        "boolean",
        "date",
        "timestamp",
        "byte",
        "short",
    }
)

# Maximum number of properties per object type
MAX_PROPERTIES_PER_OBJECT_TYPE = 200


# ---------------------------------------------------------------------------
# Domain models
# ---------------------------------------------------------------------------


class StructField(DomainModel):
    name: str
    type: str  # must be one of STRUCT_FIELD_TYPES


class Property(DomainModel):
    rid: str
    id: str
    api_name: str
    object_type_rid: str
    display_name: str
    description: str | None = None
    base_type: str  # PropertyBaseType value as string
    array_inner_type: str | None = None
    struct_schema: list[StructField] | None = None
    backing_column: str | None = None
    status: ResourceStatus = ResourceStatus.EXPERIMENTAL
    visibility: Visibility = Visibility.NORMAL
    is_primary_key: bool = False
    is_title_key: bool = False
    sort_order: int = 0
    created_at: datetime
    created_by: str
    last_modified_at: datetime
    last_modified_by: str


class PropertyWithChangeState(Property):
    """Property with change state annotation for merged view."""

    change_state: ChangeState = ChangeState.PUBLISHED


class PropertyCreateRequest(DomainModel):
    id: str
    api_name: str
    display_name: str
    base_type: str  # required, immutable after creation
    array_inner_type: str | None = None  # required when base_type=array
    struct_schema: list[StructField] | None = None  # required when base_type=struct
    backing_column: str | None = None
    description: str | None = None
    status: ResourceStatus = ResourceStatus.EXPERIMENTAL
    visibility: Visibility = Visibility.NORMAL


class PropertyUpdateRequest(DomainModel):
    display_name: str | None = None
    description: str | None = None
    api_name: str | None = None  # forbidden when status=active
    backing_column: str | None = None  # empty string "" → null (unmap)
    status: ResourceStatus | None = None
    visibility: Visibility | None = None
    is_primary_key: bool | None = None  # triggers PK cascade update
    is_title_key: bool | None = None  # triggers TK cascade update


class PropertySortOrderItem(DomainModel):
    rid: str
    sort_order: int


class PropertySortOrderRequest(DomainModel):
    property_orders: list[PropertySortOrderItem]


class PropertyListResponse(DomainModel):
    items: list[PropertyWithChangeState]
    total: int
