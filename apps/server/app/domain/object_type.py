"""Object Type domain models and request/response schemas."""

import enum
from datetime import datetime

from app.domain.common import DomainModel
from app.domain.working_state import ChangeState


class ResourceStatus(str, enum.Enum):
    ACTIVE = "active"
    EXPERIMENTAL = "experimental"
    DEPRECATED = "deprecated"


class Visibility(str, enum.Enum):
    PROMINENT = "prominent"
    NORMAL = "normal"
    HIDDEN = "hidden"


class Icon(DomainModel):
    name: str
    color: str


class ObjectType(DomainModel):
    rid: str
    id: str
    api_name: str
    display_name: str
    plural_display_name: str | None = None
    description: str | None = None
    icon: Icon
    status: ResourceStatus = ResourceStatus.EXPERIMENTAL
    visibility: Visibility = Visibility.NORMAL
    backing_datasource: dict | None = None
    primary_key_property_id: str | None = None
    title_key_property_id: str | None = None
    intended_actions: list[str] | None = None
    project_rid: str
    ontology_rid: str
    created_at: datetime
    created_by: str
    last_modified_at: datetime
    last_modified_by: str


class ObjectTypeWithChangeState(ObjectType):
    """ObjectType with change state annotation for merged view."""

    change_state: ChangeState = ChangeState.PUBLISHED


class ObjectTypeCreateRequest(DomainModel):
    display_name: str | None = None
    id: str | None = None
    api_name: str | None = None
    plural_display_name: str | None = None
    description: str | None = None
    icon: Icon | None = None
    intended_actions: list[str] | None = None
    backing_datasource_rid: str | None = None
    project_rid: str | None = None


class ObjectTypeUpdateRequest(DomainModel):
    display_name: str | None = None
    plural_display_name: str | None = None
    description: str | None = None
    icon: Icon | None = None
    status: ResourceStatus | None = None
    visibility: Visibility | None = None
    api_name: str | None = None
    intended_actions: list[str] | None = None
    backing_datasource_rid: str | None = None
    primary_key_property_id: str | None = None
    title_key_property_id: str | None = None


class ObjectTypeListResponse(DomainModel):
    items: list[ObjectTypeWithChangeState]
    total: int
    page: int
    page_size: int
