"""SidekickLlmEngine — lightweight LLM-based suggestion engine for Sidekick."""

from __future__ import annotations

import json
import logging
import os
import uuid

from app.domain.sidekick import (
    GenerateContentRequest,
    SidekickContext,
    Suggestion,
    SuggestionSource,
    SuggestionType,
)
from app.exceptions import AppError

logger = logging.getLogger(__name__)

# Mapping from LLM output type string to SuggestionType enum
_TYPE_MAP: dict[str, SuggestionType] = {
    "suggest_link": SuggestionType.SUGGEST_LINK,
    "cardinality_review": SuggestionType.CARDINALITY_REVIEW,
    "naming_improvement": SuggestionType.NAMING_IMPROVEMENT,
    "description_enhancement": SuggestionType.DESCRIPTION_ENHANCEMENT,
}

_SOURCE_MAP: dict[str, SuggestionSource] = {
    "completeness_check": SuggestionSource.COMPLETENESS_CHECK,
    "consistency_check": SuggestionSource.CONSISTENCY_CHECK,
    "pattern_matching": SuggestionSource.PATTERN_MATCHING,
    "semantic_inference": SuggestionSource.SEMANTIC_INFERENCE,
    "best_practices": SuggestionSource.BEST_PRACTICES,
}


def _confidence_level(confidence: float) -> str:
    if confidence >= 0.8:
        return "high"
    elif confidence >= 0.5:
        return "medium"
    return "low"


class SidekickLlmEngine:
    def is_available(self) -> bool:
        """Check if Anthropic API key is configured."""
        return bool(os.environ.get("ANTHROPIC_API_KEY"))

    async def analyze(
        self,
        context: SidekickContext,
        entity_data: dict,
        ontology_summary: dict,
    ) -> list[Suggestion]:
        """Generate semantic-level suggestions via LLM."""
        if not self.is_available():
            return []

        try:
            prompt = self._build_analyze_prompt(context, entity_data, ontology_summary)
            response = await self._call_llm(
                system="You are an ontology modeling expert. Analyze the given entity and return improvement suggestions as a JSON array.",
                user_message=prompt,
            )
            return self._parse_suggestions(response)
        except Exception:
            logger.warning("Sidekick LLM analysis failed", exc_info=True)
            return []

    async def generate_content(self, request: GenerateContentRequest) -> str:
        """Generate content (e.g., description) via LLM."""
        if not self.is_available():
            raise AppError(
                code="SIDEKICK_LLM_UNAVAILABLE",
                message="LLM service is not configured. Set ANTHROPIC_API_KEY to enable AI suggestions.",
                status_code=503,
            )

        prompt = self._build_generate_prompt(request)
        response = await self._call_llm(
            system="You are an ontology modeling expert. Generate concise, accurate content for the given entity.",
            user_message=prompt,
        )
        return response.content[0].text.strip()

    async def _call_llm(self, system: str, user_message: str):
        """Call Anthropic API. Separated for easy mocking."""
        if not hasattr(self, "_client"):
            import anthropic

            self._client = anthropic.AsyncAnthropic()
        model = os.environ.get("LLM_MODEL", "claude-sonnet-4-20250514")
        return await self._client.messages.create(
            model=model,
            max_tokens=1024,
            temperature=0.3,
            system=system,
            messages=[{"role": "user", "content": user_message}],
        )

    def _build_analyze_prompt(
        self,
        context: SidekickContext,
        entity_data: dict,
        ontology_summary: dict,
    ) -> str:
        return f"""Analyze this ontology entity and suggest improvements.

Entity type: {context.page_type.value}
Entity data: {json.dumps(entity_data, ensure_ascii=False, default=str)}
Ontology summary: {json.dumps(ontology_summary, ensure_ascii=False, default=str)}

Return a JSON array of suggestions. Each suggestion must have:
- "type": one of {list(_TYPE_MAP.keys())}
- "title": short title (Chinese)
- "description": detailed description (Chinese)
- "confidence": float between 0.5 and 0.9
- "source": one of {list(_SOURCE_MAP.keys())}
- "reasoning": explanation of why this suggestion is made (Chinese)

Return only the JSON array, no other text. If no suggestions, return [].
"""

    def _build_generate_prompt(self, request: GenerateContentRequest) -> str:
        context_str = json.dumps(request.context or {}, ensure_ascii=False, default=str)
        if request.content_type == "description":
            return f"""Generate a concise description (2-3 sentences, in Chinese) for this ontology entity.

Entity context: {context_str}

The description should:
1. Explain what this entity represents in the business domain
2. Mention key properties/attributes
3. Note any important relationships

Return only the description text, no other content.
"""
        return f"Generate {request.content_type} for entity: {context_str}"

    def _parse_suggestions(self, response) -> list[Suggestion]:
        """Parse LLM response into Suggestion objects."""
        try:
            text = response.content[0].text.strip()
            # Handle markdown code blocks
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            items = json.loads(text)
        except (json.JSONDecodeError, IndexError, AttributeError):
            logger.warning("Failed to parse LLM suggestions response")
            return []

        suggestions: list[Suggestion] = []
        for item in items:
            try:
                stype = _TYPE_MAP.get(item.get("type", ""))
                source = _SOURCE_MAP.get(
                    item.get("source", ""), SuggestionSource.SEMANTIC_INFERENCE
                )
                if not stype:
                    continue

                confidence = max(0.5, min(0.9, float(item.get("confidence", 0.7))))

                suggestions.append(
                    Suggestion(
                        id=uuid.uuid4().hex[:12],
                        suggestion_type=stype,
                        title=item.get("title", ""),
                        description=item.get("description", ""),
                        confidence=confidence,
                        confidence_level=_confidence_level(confidence),
                        source=source,
                        reasoning=item.get("reasoning", ""),
                        requires_llm=False,
                    )
                )
            except (ValueError, KeyError):
                continue

        return suggestions
