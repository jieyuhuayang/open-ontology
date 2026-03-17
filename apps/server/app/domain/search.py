"""Search domain models and response schemas."""

import enum

from app.domain.common import DomainModel
from app.domain.object_type import Icon, ResourceStatus, Visibility
from app.domain.working_state import ChangeState


class SearchResourceType(str, enum.Enum):
    OBJECT_TYPE = "objectType"
    PROPERTY = "property"
    LINK_TYPE = "linkType"


class SearchResultItem(DomainModel):
    rid: str
    resource_type: SearchResourceType
    display_name: str
    description: str | None = None
    icon: Icon | None = None
    status: ResourceStatus
    visibility: Visibility
    change_state: ChangeState
    matched_fields: list[str]
    # Property-specific
    object_type_rid: str | None = None
    object_type_display_name: str | None = None
    base_type: str | None = None
    # LinkType-specific
    side_a_display_name: str | None = None
    side_b_display_name: str | None = None


class SearchTypeResult(DomainModel):
    items: list[SearchResultItem]
    total: int


class SearchResponse(DomainModel):
    query: str
    results: dict[str, SearchTypeResult]
    total_count: int
