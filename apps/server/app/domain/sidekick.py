"""Sidekick domain models — suggestions, context, apply requests."""

from __future__ import annotations

import enum

from pydantic import Field

from app.domain.common import DomainModel


# --- Enums ---


class SidekickPageType(str, enum.Enum):
    OBJECT_TYPE_DETAIL = "object_type_detail"
    PROPERTY_LIST = "property_list"
    LINK_TYPE_DETAIL = "link_type_detail"


class SuggestionType(str, enum.Enum):
    MISSING_DESCRIPTION = "missing_description"
    MISSING_TITLE_KEY = "missing_title_key"
    MISSING_PRIMARY_KEY = "missing_primary_key"
    ORPHAN_LINK = "orphan_link"
    DUPLICATE_PROPERTY_NAME = "duplicate_property_name"
    SUGGEST_LINK = "suggest_link"
    CARDINALITY_REVIEW = "cardinality_review"
    NAMING_IMPROVEMENT = "naming_improvement"
    DESCRIPTION_ENHANCEMENT = "description_enhancement"


class SuggestionSource(str, enum.Enum):
    COMPLETENESS_CHECK = "completeness_check"
    CONSISTENCY_CHECK = "consistency_check"
    PATTERN_MATCHING = "pattern_matching"
    SEMANTIC_INFERENCE = "semantic_inference"
    BEST_PRACTICES = "best_practices"


# --- Request / Response models ---


class SidekickContext(DomainModel):
    page_type: SidekickPageType
    entity_rid: str
    ontology_rid: str


class Suggestion(DomainModel):
    id: str
    suggestion_type: SuggestionType
    title: str
    description: str
    confidence: float = Field(ge=0.0, le=1.0)
    confidence_level: str  # "high" | "medium" | "low"
    source: SuggestionSource
    reasoning: str
    requires_llm: bool = False
    action_payload: dict | None = None


class SuggestionsResponse(DomainModel):
    suggestions: list[Suggestion]
    has_llm_suggestions: bool


class SuggestionApplyRequest(DomainModel):
    suggestion_type: SuggestionType
    entity_rid: str
    action_payload: dict | None = None


class SuggestionApplyResponse(DomainModel):
    success: bool
    message: str


class GenerateContentRequest(DomainModel):
    content_type: str
    entity_rid: str
    context: dict | None = None


class GenerateContentResponse(DomainModel):
    content: str
