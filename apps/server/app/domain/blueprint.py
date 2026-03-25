"""Blueprint domain models — ontology blueprints and blueprint items."""

import enum
from datetime import datetime

from pydantic import Field

from app.domain.common import DomainModel


# --- Enums ---


class BlueprintStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPLIED = "applied"
    DISCARDED = "discarded"


class BlueprintItemType(str, enum.Enum):
    OBJECT_TYPE = "object_type"
    PROPERTY = "property"
    LINK_TYPE = "link_type"


class ConfidenceLevel(str, enum.Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ItemSource(str, enum.Enum):
    FIELD_ANALYSIS = "field_analysis"
    PATTERN_MATCHING = "pattern_matching"
    SEMANTIC_INFERENCE = "semantic_inference"
    BEST_PRACTICES = "best_practices"


class UserDecision(str, enum.Enum):
    ACCEPTED = "accepted"
    EDITED = "edited"
    REJECTED = "rejected"


# --- Blueprint models ---


class Blueprint(DomainModel):
    rid: str
    session_rid: str
    ontology_rid: str
    name: str
    status: BlueprintStatus = BlueprintStatus.DRAFT
    source_summary: str | None = None
    created_at: datetime
    updated_at: datetime


class BlueprintCreate(DomainModel):
    session_rid: str
    ontology_rid: str
    name: str
    source_summary: str | None = None


class BlueprintUpdate(DomainModel):
    name: str | None = None
    status: BlueprintStatus | None = None
    source_summary: str | None = None


class BlueprintList(DomainModel):
    items: list[Blueprint]
    total_count: int
    page: int
    page_size: int


# --- BlueprintItem models ---


class BlueprintItem(DomainModel):
    rid: str
    blueprint_rid: str
    item_type: BlueprintItemType
    suggestion: dict
    confidence: float = Field(..., ge=0.0, le=1.0)
    confidence_level: ConfidenceLevel
    reasoning: str | None = None
    source: ItemSource
    user_decision: UserDecision | None = None
    user_edits: dict | None = None
    rejection_reason: str | None = None
    created_entity_rid: str | None = None
    sort_order: int = 0
    created_at: datetime
    updated_at: datetime


class BlueprintItemCreate(DomainModel):
    item_type: BlueprintItemType
    suggestion: dict
    confidence: float = Field(..., ge=0.0, le=1.0)
    reasoning: str | None = None
    source: ItemSource
    sort_order: int = 0


class BlueprintItemUpdate(DomainModel):
    user_decision: UserDecision
    user_edits: dict | None = None
    rejection_reason: str | None = None


class BlueprintDetail(DomainModel):
    blueprint: Blueprint
    items: list[BlueprintItem]


# --- Apply result models ---


class ApplyItemResult(DomainModel):
    item_rid: str
    item_type: BlueprintItemType
    status: str  # "success" | "failed" | "skipped"
    created_entity_rid: str | None = None
    error: str | None = None


class BlueprintApplyResult(DomainModel):
    blueprint_rid: str
    total: int
    succeeded: int
    failed: int
    skipped: int
    results: list[ApplyItemResult]


# --- F017: HITL Review & Apply models ---


class BlueprintItemBatchUpdate(DomainModel):
    """Batch decision update request."""

    item_rids: list[str]
    user_decision: UserDecision
    rejection_reason: str | None = None


class ConflictCheckResult(DomainModel):
    """Single conflict check result."""

    item_rid: str
    conflict_type: str  # "api_name_collision" | "dependency_missing"
    message: str
    conflicting_entity_rid: str | None = None


class BlueprintPreApplyCheck(DomainModel):
    """Pre-apply check response."""

    can_apply: bool
    conflicts: list[ConflictCheckResult]
    actionable_count: int
    undecided_count: int


class BlueprintItemRetryRequest(DomainModel):
    """Single item retry request."""

    user_edits: dict | None = None


class BlueprintItemRetryResult(DomainModel):
    """Single item retry result."""

    item_rid: str
    status: str  # "success" | "failed"
    created_entity_rid: str | None = None
    error: str | None = None
