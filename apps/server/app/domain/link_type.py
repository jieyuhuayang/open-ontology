"""Link Type domain models and request/response schemas."""

import enum
from datetime import datetime

from app.domain.common import DomainModel
from app.domain.object_type import ResourceStatus, Visibility
from app.domain.working_state import ChangeState


class Cardinality(str, enum.Enum):
    ONE_TO_ONE = "one-to-one"
    ONE_TO_MANY = "one-to-many"
    MANY_TO_ONE = "many-to-one"
    MANY_TO_MANY = "many-to-many"


class JoinMethod(str, enum.Enum):
    FOREIGN_KEY = "foreign-key"
    JOIN_TABLE = "join-table"
    BACKING_OBJECT = "backing-object"


class LinkSide(DomainModel):
    object_type_rid: str
    display_name: str
    api_name: str
    visibility: Visibility = Visibility.NORMAL
    object_type_display_name: str | None = None
    foreign_key_property_id: str | None = None
    join_table_column: str | None = None


class LinkType(DomainModel):
    rid: str
    id: str
    side_a: LinkSide
    side_b: LinkSide
    cardinality: Cardinality
    join_method: JoinMethod = JoinMethod.FOREIGN_KEY
    join_table_dataset_rid: str | None = None
    backing_object_type_rid: str | None = None
    side_a_link_type_rid: str | None = None
    side_b_link_type_rid: str | None = None
    backing_object_type_display_name: str | None = None
    side_a_link_type_id: str | None = None
    side_b_link_type_id: str | None = None
    status: ResourceStatus = ResourceStatus.EXPERIMENTAL
    project_rid: str
    ontology_rid: str
    created_at: datetime
    created_by: str
    last_modified_at: datetime
    last_modified_by: str


class LinkTypeWithChangeState(LinkType):
    """LinkType with change state annotation for merged view."""

    change_state: ChangeState = ChangeState.PUBLISHED


class LinkSideCreateInput(DomainModel):
    object_type_rid: str
    display_name: str
    api_name: str
    visibility: Visibility = Visibility.NORMAL
    foreign_key_property_id: str | None = None
    join_table_column: str | None = None


class LinkTypeCreateRequest(DomainModel):
    id: str
    side_a: LinkSideCreateInput
    side_b: LinkSideCreateInput
    cardinality: Cardinality
    join_table_dataset_rid: str | None = None
    project_rid: str | None = None
    status: ResourceStatus = ResourceStatus.EXPERIMENTAL


class LinkSideUpdateInput(DomainModel):
    display_name: str | None = None
    api_name: str | None = None
    visibility: Visibility | None = None
    foreign_key_property_id: str | None = None
    join_table_column: str | None = None


class LinkTypeUpdateRequest(DomainModel):
    side_a: LinkSideUpdateInput | None = None
    side_b: LinkSideUpdateInput | None = None
    status: ResourceStatus | None = None
    join_table_dataset_rid: str | None = None


class LinkTypeListResponse(DomainModel):
    items: list[LinkTypeWithChangeState]
    total: int
    page: int
    page_size: int
