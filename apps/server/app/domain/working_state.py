"""Working State and Change Management domain models."""

import enum
from datetime import datetime

from pydantic import Field

from app.domain.common import DomainModel


class ChangeType(str, enum.Enum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"


class ResourceType(str, enum.Enum):
    OBJECT_TYPE = "ObjectType"
    PROPERTY = "Property"
    LINK_TYPE = "LinkType"


class ChangeState(str, enum.Enum):
    """Change state annotation in merged view."""

    PUBLISHED = "published"
    CREATED = "created"
    MODIFIED = "modified"
    DELETED = "deleted"


class Change(DomainModel):
    id: str
    resource_type: ResourceType
    resource_rid: str
    change_type: ChangeType
    before: dict | None = None
    after: dict | None = None
    timestamp: datetime


class WorkingState(DomainModel):
    rid: str
    user_id: str
    ontology_rid: str
    changes: list[Change] = Field(default_factory=list)
    base_version: int
    created_at: datetime
    last_modified_at: datetime


class ChangeRecord(DomainModel):
    rid: str
    ontology_rid: str
    version: int
    changes: list[Change]
    saved_at: datetime
    saved_by: str
    description: str | None = None
