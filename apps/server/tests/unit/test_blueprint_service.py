"""Unit tests for BlueprintService — CRUD, state machine, item decisions, and apply."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.domain.blueprint import (
    BlueprintCreate,
    BlueprintItemBatchUpdate,
    BlueprintItemCreate,
    BlueprintItemType,
    BlueprintItemUpdate,
    BlueprintStatus,
    BlueprintUpdate,
    ConfidenceLevel,
    ItemSource,
    UserDecision,
)
from app.exceptions import AppError
from app.services.blueprint_service import BlueprintService

_NOW = datetime(2026, 3, 24, 10, 0, 0, tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# Mock factory helpers
# ---------------------------------------------------------------------------


def _make_blueprint_orm(**overrides):
    """Create a mock ORM object that behaves like BlueprintModel."""
    defaults = {
        "rid": "ri.ontology.blueprint.bp001",
        "session_rid": "ri.ontology.agent-session.sess001",
        "ontology_rid": "ri.ontology.ontology.ont001",
        "name": "Test Blueprint",
        "status": BlueprintStatus.DRAFT.value,
        "source_summary": None,
        "items": [],
        "created_at": _NOW,
        "updated_at": _NOW,
    }
    defaults.update(overrides)
    orm = MagicMock()
    for k, v in defaults.items():
        setattr(orm, k, v)
    return orm


def _make_item_orm(**overrides):
    """Create a mock ORM object that behaves like BlueprintItemModel."""
    defaults = {
        "rid": "ri.ontology.blueprint-item.item001",
        "blueprint_rid": "ri.ontology.blueprint.bp001",
        "item_type": BlueprintItemType.OBJECT_TYPE.value,
        "suggestion": {"displayName": "Customer", "apiName": "customer"},
        "confidence": 0.9,
        "confidence_level": ConfidenceLevel.HIGH.value,
        "reasoning": "High confidence match",
        "source": ItemSource.FIELD_ANALYSIS.value,
        "user_decision": None,
        "user_edits": None,
        "rejection_reason": None,
        "created_entity_rid": None,
        "sort_order": 0,
        "created_at": _NOW,
        "updated_at": _NOW,
    }
    defaults.update(overrides)
    orm = MagicMock()
    for k, v in defaults.items():
        setattr(orm, k, v)
    return orm


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def db_session_mock():
    return AsyncMock()


@pytest.fixture
def service(db_session_mock):
    return BlueprintService(db_session_mock)


# ---------------------------------------------------------------------------
# Blueprint CRUD
# ---------------------------------------------------------------------------


class TestCreateBlueprint:
    """AC-11: creates blueprint with status=draft."""

    @pytest.mark.asyncio
    async def test_create_blueprint(self, service, db_session_mock):
        req = BlueprintCreate(
            session_rid="ri.ontology.agent-session.sess001",
            ontology_rid="ri.ontology.ontology.ont001",
            name="My Blueprint",
        )

        # Mock session lookup
        session_orm = MagicMock()
        session_orm.rid = req.session_rid

        # Mock ontology existence check (scalar query)
        scalar_result = MagicMock()
        scalar_result.scalar_one_or_none.return_value = req.ontology_rid
        db_session_mock.execute = AsyncMock(return_value=scalar_result)

        # Mock BlueprintModel constructor to return a mock ORM with timestamps
        mock_orm = _make_blueprint_orm(
            name="My Blueprint",
            session_rid=req.session_rid,
            ontology_rid=req.ontology_rid,
        )

        with (
            patch(
                "app.services.blueprint_service.AgentStorage.get_session",
                new_callable=AsyncMock,
                return_value=session_orm,
            ),
            patch(
                "app.services.blueprint_service.BlueprintStorage.create",
                new_callable=AsyncMock,
            ) as mock_create,
            patch(
                "app.services.blueprint_service.BlueprintModel",
                return_value=mock_orm,
            ),
        ):
            result = await service.create(req)

        assert result.status == BlueprintStatus.DRAFT
        assert result.name == "My Blueprint"
        assert result.session_rid == req.session_rid
        assert result.ontology_rid == req.ontology_rid
        mock_create.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_create_session_not_found(self, service, db_session_mock):
        """AC-12: 404 AGENT_SESSION_NOT_FOUND when session doesn't exist."""
        req = BlueprintCreate(
            session_rid="ri.ontology.agent-session.nonexistent",
            ontology_rid="ri.ontology.ontology.ont001",
            name="My Blueprint",
        )

        with patch(
            "app.services.blueprint_service.AgentStorage.get_session",
            new_callable=AsyncMock,
            return_value=None,
        ):
            with pytest.raises(AppError) as exc_info:
                await service.create(req)

        assert exc_info.value.code == "AGENT_SESSION_NOT_FOUND"
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_create_ontology_not_found(self, service, db_session_mock):
        """Ontology not found should raise 404."""
        req = BlueprintCreate(
            session_rid="ri.ontology.agent-session.sess001",
            ontology_rid="ri.ontology.ontology.nonexistent",
            name="My Blueprint",
        )

        session_orm = MagicMock()
        scalar_result = MagicMock()
        scalar_result.scalar_one_or_none.return_value = None
        db_session_mock.execute = AsyncMock(return_value=scalar_result)

        with patch(
            "app.services.blueprint_service.AgentStorage.get_session",
            new_callable=AsyncMock,
            return_value=session_orm,
        ):
            with pytest.raises(AppError) as exc_info:
                await service.create(req)

        assert exc_info.value.code == "ONTOLOGY_NOT_FOUND"
        assert exc_info.value.status_code == 404


class TestGetBlueprint:
    """AC-15: BLUEPRINT_NOT_FOUND when blueprint doesn't exist."""

    @pytest.mark.asyncio
    async def test_get_success(self, service):
        orm = _make_blueprint_orm()
        with patch(
            "app.services.blueprint_service.BlueprintStorage.get",
            new_callable=AsyncMock,
            return_value=orm,
        ):
            result = await service.get("ri.ontology.blueprint.bp001")

        assert result.rid == "ri.ontology.blueprint.bp001"
        assert result.name == "Test Blueprint"

    @pytest.mark.asyncio
    async def test_get_not_found(self, service):
        with patch(
            "app.services.blueprint_service.BlueprintStorage.get",
            new_callable=AsyncMock,
            return_value=None,
        ):
            with pytest.raises(AppError) as exc_info:
                await service.get("ri.ontology.blueprint.nonexistent")

        assert exc_info.value.code == "BLUEPRINT_NOT_FOUND"
        assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# Status Transitions (State Machine)
# ---------------------------------------------------------------------------


class TestStatusTransitions:
    """AC-16 ~ AC-20: validate blueprint status state machine."""

    @pytest.mark.asyncio
    async def test_status_draft_to_pending(self, service):
        """AC-16: draft -> pending_review is valid."""
        orm = _make_blueprint_orm(status=BlueprintStatus.DRAFT.value)
        updated_orm = _make_blueprint_orm(status=BlueprintStatus.PENDING_REVIEW.value)

        with (
            patch(
                "app.services.blueprint_service.BlueprintStorage.get",
                new_callable=AsyncMock,
                return_value=orm,
            ),
            patch(
                "app.services.blueprint_service.BlueprintStorage.update",
                new_callable=AsyncMock,
                return_value=updated_orm,
            ),
        ):
            result = await service.update(
                "ri.ontology.blueprint.bp001",
                BlueprintUpdate(status=BlueprintStatus.PENDING_REVIEW),
            )

        assert result.status == BlueprintStatus.PENDING_REVIEW

    @pytest.mark.asyncio
    async def test_status_pending_to_discarded(self, service):
        """AC-17: pending_review -> discarded is valid."""
        orm = _make_blueprint_orm(status=BlueprintStatus.PENDING_REVIEW.value)
        updated_orm = _make_blueprint_orm(status=BlueprintStatus.DISCARDED.value)

        with (
            patch(
                "app.services.blueprint_service.BlueprintStorage.get",
                new_callable=AsyncMock,
                return_value=orm,
            ),
            patch(
                "app.services.blueprint_service.BlueprintStorage.update",
                new_callable=AsyncMock,
                return_value=updated_orm,
            ),
        ):
            result = await service.update(
                "ri.ontology.blueprint.bp001",
                BlueprintUpdate(status=BlueprintStatus.DISCARDED),
            )

        assert result.status == BlueprintStatus.DISCARDED

    @pytest.mark.asyncio
    async def test_status_applied_to_any(self, service):
        """AC-18: applied is terminal -- no transitions allowed."""
        orm = _make_blueprint_orm(status=BlueprintStatus.APPLIED.value)

        with patch(
            "app.services.blueprint_service.BlueprintStorage.get",
            new_callable=AsyncMock,
            return_value=orm,
        ):
            with pytest.raises(AppError) as exc_info:
                await service.update(
                    "ri.ontology.blueprint.bp001",
                    BlueprintUpdate(status=BlueprintStatus.DRAFT),
                )

        assert exc_info.value.code == "BLUEPRINT_INVALID_STATUS_TRANSITION"
        assert exc_info.value.status_code == 422

    @pytest.mark.asyncio
    async def test_status_discarded_to_any(self, service):
        """AC-19: discarded is terminal -- no transitions allowed."""
        orm = _make_blueprint_orm(status=BlueprintStatus.DISCARDED.value)

        with patch(
            "app.services.blueprint_service.BlueprintStorage.get",
            new_callable=AsyncMock,
            return_value=orm,
        ):
            with pytest.raises(AppError) as exc_info:
                await service.update(
                    "ri.ontology.blueprint.bp001",
                    BlueprintUpdate(status=BlueprintStatus.PENDING_REVIEW),
                )

        assert exc_info.value.code == "BLUEPRINT_INVALID_STATUS_TRANSITION"
        assert exc_info.value.status_code == 422

    @pytest.mark.asyncio
    async def test_status_draft_to_applied(self, service):
        """AC-20: draft -> applied is invalid (must go through pending_review)."""
        orm = _make_blueprint_orm(status=BlueprintStatus.DRAFT.value)

        with patch(
            "app.services.blueprint_service.BlueprintStorage.get",
            new_callable=AsyncMock,
            return_value=orm,
        ):
            with pytest.raises(AppError) as exc_info:
                await service.update(
                    "ri.ontology.blueprint.bp001",
                    BlueprintUpdate(status=BlueprintStatus.APPLIED),
                )

        assert exc_info.value.code == "BLUEPRINT_INVALID_STATUS_TRANSITION"
        assert exc_info.value.status_code == 422

    @pytest.mark.asyncio
    async def test_status_pending_to_draft(self, service):
        """pending_review -> draft is invalid (no backward transitions)."""
        orm = _make_blueprint_orm(status=BlueprintStatus.PENDING_REVIEW.value)

        with patch(
            "app.services.blueprint_service.BlueprintStorage.get",
            new_callable=AsyncMock,
            return_value=orm,
        ):
            with pytest.raises(AppError) as exc_info:
                await service.update(
                    "ri.ontology.blueprint.bp001",
                    BlueprintUpdate(status=BlueprintStatus.DRAFT),
                )

        assert exc_info.value.code == "BLUEPRINT_INVALID_STATUS_TRANSITION"
        assert exc_info.value.status_code == 422


# ---------------------------------------------------------------------------
# Blueprint Item Creation
# ---------------------------------------------------------------------------


class TestCreateItem:
    """AC-21 ~ AC-23: item creation with confidence/source validation."""

    @pytest.mark.asyncio
    async def test_create_item_confidence_high(self, service):
        """AC-21: confidence >= 0.8 -> HIGH level."""
        bp_orm = _make_blueprint_orm()
        mock_item_orm = _make_item_orm(confidence=0.9, confidence_level=ConfidenceLevel.HIGH.value)

        with (
            patch(
                "app.services.blueprint_service.BlueprintStorage.get",
                new_callable=AsyncMock,
                return_value=bp_orm,
            ),
            patch(
                "app.services.blueprint_service.BlueprintItemModel",
                return_value=mock_item_orm,
            ),
            patch(
                "app.services.blueprint_service.BlueprintItemStorage.create",
                new_callable=AsyncMock,
            ),
        ):
            result = await service.create_item(
                "ri.ontology.blueprint.bp001",
                BlueprintItemCreate(
                    item_type=BlueprintItemType.OBJECT_TYPE,
                    suggestion={"displayName": "Customer"},
                    confidence=0.9,
                    source=ItemSource.FIELD_ANALYSIS,
                ),
            )

        assert result.confidence_level == ConfidenceLevel.HIGH

    @pytest.mark.asyncio
    async def test_create_item_confidence_medium(self, service):
        """AC-21: confidence 0.5-0.79 -> MEDIUM level."""
        bp_orm = _make_blueprint_orm()
        mock_item_orm = _make_item_orm(
            confidence=0.65, confidence_level=ConfidenceLevel.MEDIUM.value
        )

        with (
            patch(
                "app.services.blueprint_service.BlueprintStorage.get",
                new_callable=AsyncMock,
                return_value=bp_orm,
            ),
            patch(
                "app.services.blueprint_service.BlueprintItemModel",
                return_value=mock_item_orm,
            ),
            patch(
                "app.services.blueprint_service.BlueprintItemStorage.create",
                new_callable=AsyncMock,
            ),
        ):
            result = await service.create_item(
                "ri.ontology.blueprint.bp001",
                BlueprintItemCreate(
                    item_type=BlueprintItemType.OBJECT_TYPE,
                    suggestion={"displayName": "Order"},
                    confidence=0.65,
                    source=ItemSource.PATTERN_MATCHING,
                ),
            )

        assert result.confidence_level == ConfidenceLevel.MEDIUM

    @pytest.mark.asyncio
    async def test_create_item_confidence_low(self, service):
        """AC-21: confidence < 0.5 -> LOW level."""
        bp_orm = _make_blueprint_orm()
        mock_item_orm = _make_item_orm(confidence=0.3, confidence_level=ConfidenceLevel.LOW.value)

        with (
            patch(
                "app.services.blueprint_service.BlueprintStorage.get",
                new_callable=AsyncMock,
                return_value=bp_orm,
            ),
            patch(
                "app.services.blueprint_service.BlueprintItemModel",
                return_value=mock_item_orm,
            ),
            patch(
                "app.services.blueprint_service.BlueprintItemStorage.create",
                new_callable=AsyncMock,
            ),
        ):
            result = await service.create_item(
                "ri.ontology.blueprint.bp001",
                BlueprintItemCreate(
                    item_type=BlueprintItemType.OBJECT_TYPE,
                    suggestion={"displayName": "Widget"},
                    confidence=0.3,
                    source=ItemSource.SEMANTIC_INFERENCE,
                ),
            )

        assert result.confidence_level == ConfidenceLevel.LOW

    @pytest.mark.asyncio
    async def test_create_item_confidence_boundary_high(self, service):
        """AC-21: confidence exactly 0.8 -> HIGH level."""
        bp_orm = _make_blueprint_orm()
        mock_item_orm = _make_item_orm(confidence=0.8, confidence_level=ConfidenceLevel.HIGH.value)

        with (
            patch(
                "app.services.blueprint_service.BlueprintStorage.get",
                new_callable=AsyncMock,
                return_value=bp_orm,
            ),
            patch(
                "app.services.blueprint_service.BlueprintItemModel",
                return_value=mock_item_orm,
            ),
            patch(
                "app.services.blueprint_service.BlueprintItemStorage.create",
                new_callable=AsyncMock,
            ),
        ):
            result = await service.create_item(
                "ri.ontology.blueprint.bp001",
                BlueprintItemCreate(
                    item_type=BlueprintItemType.PROPERTY,
                    suggestion={"displayName": "Name"},
                    confidence=0.8,
                    source=ItemSource.BEST_PRACTICES,
                ),
            )

        assert result.confidence_level == ConfidenceLevel.HIGH

    @pytest.mark.asyncio
    async def test_create_item_confidence_boundary_medium(self, service):
        """AC-21: confidence exactly 0.5 -> MEDIUM level."""
        bp_orm = _make_blueprint_orm()
        mock_item_orm = _make_item_orm(
            confidence=0.5, confidence_level=ConfidenceLevel.MEDIUM.value
        )

        with (
            patch(
                "app.services.blueprint_service.BlueprintStorage.get",
                new_callable=AsyncMock,
                return_value=bp_orm,
            ),
            patch(
                "app.services.blueprint_service.BlueprintItemModel",
                return_value=mock_item_orm,
            ),
            patch(
                "app.services.blueprint_service.BlueprintItemStorage.create",
                new_callable=AsyncMock,
            ),
        ):
            result = await service.create_item(
                "ri.ontology.blueprint.bp001",
                BlueprintItemCreate(
                    item_type=BlueprintItemType.PROPERTY,
                    suggestion={"displayName": "Email"},
                    confidence=0.5,
                    source=ItemSource.FIELD_ANALYSIS,
                ),
            )

        assert result.confidence_level == ConfidenceLevel.MEDIUM

    @pytest.mark.asyncio
    async def test_create_item_invalid_confidence_negative(self, service):
        """AC-22: confidence < 0 -> 400 BLUEPRINT_ITEM_INVALID_CONFIDENCE.

        The service validates confidence range. We bypass Pydantic field
        validation by constructing a valid object then mutating it.
        """
        bp_orm = _make_blueprint_orm()
        req = BlueprintItemCreate(
            item_type=BlueprintItemType.OBJECT_TYPE,
            suggestion={"displayName": "Bad"},
            confidence=0.5,
            source=ItemSource.FIELD_ANALYSIS,
        )
        # Bypass Pydantic ge/le to test service-level validation
        object.__setattr__(req, "confidence", -0.1)

        with patch(
            "app.services.blueprint_service.BlueprintStorage.get",
            new_callable=AsyncMock,
            return_value=bp_orm,
        ):
            with pytest.raises(AppError) as exc_info:
                await service.create_item("ri.ontology.blueprint.bp001", req)

        assert exc_info.value.code == "BLUEPRINT_ITEM_INVALID_CONFIDENCE"
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_create_item_invalid_confidence_over_one(self, service):
        """AC-22: confidence > 1.0 -> 400 BLUEPRINT_ITEM_INVALID_CONFIDENCE."""
        bp_orm = _make_blueprint_orm()
        req = BlueprintItemCreate(
            item_type=BlueprintItemType.OBJECT_TYPE,
            suggestion={"displayName": "Bad"},
            confidence=0.5,
            source=ItemSource.FIELD_ANALYSIS,
        )
        object.__setattr__(req, "confidence", 1.5)

        with patch(
            "app.services.blueprint_service.BlueprintStorage.get",
            new_callable=AsyncMock,
            return_value=bp_orm,
        ):
            with pytest.raises(AppError) as exc_info:
                await service.create_item("ri.ontology.blueprint.bp001", req)

        assert exc_info.value.code == "BLUEPRINT_ITEM_INVALID_CONFIDENCE"
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_create_item_missing_source(self, service):
        """AC-23: missing source -> 400 BLUEPRINT_ITEM_MISSING_SOURCE."""
        bp_orm = _make_blueprint_orm()
        req = BlueprintItemCreate(
            item_type=BlueprintItemType.OBJECT_TYPE,
            suggestion={"displayName": "NoSource"},
            confidence=0.8,
            source=ItemSource.FIELD_ANALYSIS,
        )
        # Override source to None to simulate missing source
        object.__setattr__(req, "source", None)

        with patch(
            "app.services.blueprint_service.BlueprintStorage.get",
            new_callable=AsyncMock,
            return_value=bp_orm,
        ):
            with pytest.raises(AppError) as exc_info:
                await service.create_item("ri.ontology.blueprint.bp001", req)

        assert exc_info.value.code == "BLUEPRINT_ITEM_MISSING_SOURCE"
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_create_item_blueprint_not_found(self, service):
        """Item creation fails if blueprint doesn't exist."""
        req = BlueprintItemCreate(
            item_type=BlueprintItemType.OBJECT_TYPE,
            suggestion={"displayName": "Customer"},
            confidence=0.9,
            source=ItemSource.FIELD_ANALYSIS,
        )

        with patch(
            "app.services.blueprint_service.BlueprintStorage.get",
            new_callable=AsyncMock,
            return_value=None,
        ):
            with pytest.raises(AppError) as exc_info:
                await service.create_item("ri.ontology.blueprint.nonexistent", req)

        assert exc_info.value.code == "BLUEPRINT_NOT_FOUND"
        assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# Item Decisions
# ---------------------------------------------------------------------------


class TestItemDecision:
    """AC-26, AC-29, AC-30: item decision updates."""

    @pytest.mark.asyncio
    async def test_accept_item(self, service):
        """AC-26: set userDecision=accepted on an undecided item."""
        bp_orm = _make_blueprint_orm(status=BlueprintStatus.PENDING_REVIEW.value)
        item_orm = _make_item_orm(user_decision=None)
        updated_item_orm = _make_item_orm(user_decision=UserDecision.ACCEPTED.value)

        req = BlueprintItemUpdate(user_decision=UserDecision.ACCEPTED)

        with (
            patch(
                "app.services.blueprint_service.BlueprintStorage.get",
                new_callable=AsyncMock,
                return_value=bp_orm,
            ),
            patch(
                "app.services.blueprint_service.BlueprintItemStorage.get",
                new_callable=AsyncMock,
                return_value=item_orm,
            ),
            patch(
                "app.services.blueprint_service.BlueprintItemStorage.update_decision",
                new_callable=AsyncMock,
                return_value=updated_item_orm,
            ),
        ):
            result = await service.update_item_decision(
                "ri.ontology.blueprint.bp001",
                "ri.ontology.blueprint-item.item001",
                req,
            )

        assert result.user_decision == UserDecision.ACCEPTED

    @pytest.mark.asyncio
    async def test_reject_item(self, service):
        """Set userDecision=rejected with a reason."""
        bp_orm = _make_blueprint_orm(status=BlueprintStatus.PENDING_REVIEW.value)
        item_orm = _make_item_orm(user_decision=None)
        updated_item_orm = _make_item_orm(
            user_decision=UserDecision.REJECTED.value,
            rejection_reason="Not relevant",
        )

        req = BlueprintItemUpdate(
            user_decision=UserDecision.REJECTED,
            rejection_reason="Not relevant",
        )

        with (
            patch(
                "app.services.blueprint_service.BlueprintStorage.get",
                new_callable=AsyncMock,
                return_value=bp_orm,
            ),
            patch(
                "app.services.blueprint_service.BlueprintItemStorage.get",
                new_callable=AsyncMock,
                return_value=item_orm,
            ),
            patch(
                "app.services.blueprint_service.BlueprintItemStorage.update_decision",
                new_callable=AsyncMock,
                return_value=updated_item_orm,
            ),
        ):
            result = await service.update_item_decision(
                "ri.ontology.blueprint.bp001",
                "ri.ontology.blueprint-item.item001",
                req,
            )

        assert result.user_decision == UserDecision.REJECTED
        assert result.rejection_reason == "Not relevant"

    @pytest.mark.asyncio
    async def test_decision_immutable(self, service):
        """AC-29: once set, decision cannot be changed (INV-11)."""
        bp_orm = _make_blueprint_orm(status=BlueprintStatus.PENDING_REVIEW.value)
        item_orm = _make_item_orm(user_decision=UserDecision.ACCEPTED.value)

        req = BlueprintItemUpdate(user_decision=UserDecision.REJECTED)

        with (
            patch(
                "app.services.blueprint_service.BlueprintStorage.get",
                new_callable=AsyncMock,
                return_value=bp_orm,
            ),
            patch(
                "app.services.blueprint_service.BlueprintItemStorage.get",
                new_callable=AsyncMock,
                return_value=item_orm,
            ),
        ):
            with pytest.raises(AppError) as exc_info:
                await service.update_item_decision(
                    "ri.ontology.blueprint.bp001",
                    "ri.ontology.blueprint-item.item001",
                    req,
                )

        assert exc_info.value.code == "BLUEPRINT_ITEM_DECISION_IMMUTABLE"
        assert exc_info.value.status_code == 422

    @pytest.mark.asyncio
    async def test_decision_requires_pending_review(self, service):
        """AC-30: decision update only allowed when blueprint is pending_review."""
        bp_orm = _make_blueprint_orm(status=BlueprintStatus.DRAFT.value)

        req = BlueprintItemUpdate(user_decision=UserDecision.ACCEPTED)

        with patch(
            "app.services.blueprint_service.BlueprintStorage.get",
            new_callable=AsyncMock,
            return_value=bp_orm,
        ):
            with pytest.raises(AppError) as exc_info:
                await service.update_item_decision(
                    "ri.ontology.blueprint.bp001",
                    "ri.ontology.blueprint-item.item001",
                    req,
                )

        assert exc_info.value.code == "BLUEPRINT_INVALID_STATUS_TRANSITION"
        assert exc_info.value.status_code == 422

    @pytest.mark.asyncio
    async def test_decision_item_not_found(self, service):
        """Item not found in the given blueprint -> 404."""
        bp_orm = _make_blueprint_orm(status=BlueprintStatus.PENDING_REVIEW.value)

        req = BlueprintItemUpdate(user_decision=UserDecision.ACCEPTED)

        with (
            patch(
                "app.services.blueprint_service.BlueprintStorage.get",
                new_callable=AsyncMock,
                return_value=bp_orm,
            ),
            patch(
                "app.services.blueprint_service.BlueprintItemStorage.get",
                new_callable=AsyncMock,
                return_value=None,
            ),
        ):
            with pytest.raises(AppError) as exc_info:
                await service.update_item_decision(
                    "ri.ontology.blueprint.bp001",
                    "ri.ontology.blueprint-item.nonexistent",
                    req,
                )

        assert exc_info.value.code == "BLUEPRINT_ITEM_NOT_FOUND"
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_decision_item_wrong_blueprint(self, service):
        """Item exists but belongs to a different blueprint -> 404."""
        bp_orm = _make_blueprint_orm(status=BlueprintStatus.PENDING_REVIEW.value)
        item_orm = _make_item_orm(blueprint_rid="ri.ontology.blueprint.OTHER")

        req = BlueprintItemUpdate(user_decision=UserDecision.ACCEPTED)

        with (
            patch(
                "app.services.blueprint_service.BlueprintStorage.get",
                new_callable=AsyncMock,
                return_value=bp_orm,
            ),
            patch(
                "app.services.blueprint_service.BlueprintItemStorage.get",
                new_callable=AsyncMock,
                return_value=item_orm,
            ),
        ):
            with pytest.raises(AppError) as exc_info:
                await service.update_item_decision(
                    "ri.ontology.blueprint.bp001",
                    "ri.ontology.blueprint-item.item001",
                    req,
                )

        assert exc_info.value.code == "BLUEPRINT_ITEM_NOT_FOUND"
        assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# Apply
# ---------------------------------------------------------------------------


class TestApply:
    """AC-32, AC-35, AC-36: blueprint apply logic."""

    @pytest.mark.asyncio
    async def test_apply_success(self, service):
        """AC-32: happy path -- apply accepted OT item creates entity."""
        bp_orm = _make_blueprint_orm(
            rid="ri.ontology.blueprint.bp001",
            status=BlueprintStatus.PENDING_REVIEW.value,
        )
        ot_item = _make_item_orm(
            rid="ri.ontology.blueprint-item.ot01",
            item_type=BlueprintItemType.OBJECT_TYPE.value,
            user_decision=UserDecision.ACCEPTED.value,
            suggestion={
                "displayName": "Customer",
                "apiName": "customer",
                "description": "A customer",
            },
        )

        mock_created_ot = MagicMock()
        mock_created_ot.rid = "ri.ontology.object-type.created001"

        with (
            patch(
                "app.services.blueprint_service.BlueprintStorage.get_for_update",
                new_callable=AsyncMock,
                return_value=bp_orm,
            ),
            patch(
                "app.services.blueprint_service.BlueprintItemStorage.list_by_blueprint",
                new_callable=AsyncMock,
                return_value=[ot_item],
            ),
            patch(
                "app.services.blueprint_service.BlueprintItemStorage.update_created_entity_rid",
                new_callable=AsyncMock,
            ),
            patch(
                "app.services.blueprint_service.BlueprintStorage.update_status",
                new_callable=AsyncMock,
            ) as mock_update_status,
            patch(
                "app.services.object_type_service.ObjectTypeService.create",
                new_callable=AsyncMock,
                return_value=mock_created_ot,
            ),
        ):
            result = await service.apply("ri.ontology.blueprint.bp001")

        assert result.blueprint_rid == "ri.ontology.blueprint.bp001"
        assert result.total == 1
        assert result.succeeded == 1
        assert result.failed == 0
        assert result.skipped == 0
        assert len(result.results) == 1
        assert result.results[0].status == "success"
        assert result.results[0].created_entity_rid == "ri.ontology.object-type.created001"
        mock_update_status.assert_awaited_once_with(
            service._session, "ri.ontology.blueprint.bp001", BlueprintStatus.APPLIED.value
        )

    @pytest.mark.asyncio
    async def test_apply_with_edited_items(self, service):
        """Apply also processes items with user_decision=edited."""
        bp_orm = _make_blueprint_orm(status=BlueprintStatus.PENDING_REVIEW.value)
        edited_item = _make_item_orm(
            rid="ri.ontology.blueprint-item.ot02",
            item_type=BlueprintItemType.OBJECT_TYPE.value,
            user_decision=UserDecision.EDITED.value,
            suggestion={"displayName": "Original"},
            user_edits={"displayName": "Edited Customer", "apiName": "editedCustomer"},
        )

        mock_created_ot = MagicMock()
        mock_created_ot.rid = "ri.ontology.object-type.created002"

        with (
            patch(
                "app.services.blueprint_service.BlueprintStorage.get_for_update",
                new_callable=AsyncMock,
                return_value=bp_orm,
            ),
            patch(
                "app.services.blueprint_service.BlueprintItemStorage.list_by_blueprint",
                new_callable=AsyncMock,
                return_value=[edited_item],
            ),
            patch(
                "app.services.blueprint_service.BlueprintItemStorage.update_created_entity_rid",
                new_callable=AsyncMock,
            ),
            patch(
                "app.services.blueprint_service.BlueprintStorage.update_status",
                new_callable=AsyncMock,
            ),
            patch(
                "app.services.object_type_service.ObjectTypeService.create",
                new_callable=AsyncMock,
                return_value=mock_created_ot,
            ),
        ):
            result = await service.apply("ri.ontology.blueprint.bp001")

        assert result.succeeded == 1
        assert result.results[0].status == "success"

    @pytest.mark.asyncio
    async def test_apply_not_pending(self, service):
        """AC-35: apply fails if blueprint is not pending_review."""
        bp_orm = _make_blueprint_orm(status=BlueprintStatus.DRAFT.value)

        with patch(
            "app.services.blueprint_service.BlueprintStorage.get_for_update",
            new_callable=AsyncMock,
            return_value=bp_orm,
        ):
            with pytest.raises(AppError) as exc_info:
                await service.apply("ri.ontology.blueprint.bp001")

        assert exc_info.value.code == "BLUEPRINT_INVALID_STATUS_FOR_APPLY"
        assert exc_info.value.status_code == 422

    @pytest.mark.asyncio
    async def test_apply_already_applied(self, service):
        """Apply fails on an already-applied blueprint."""
        bp_orm = _make_blueprint_orm(status=BlueprintStatus.APPLIED.value)

        with patch(
            "app.services.blueprint_service.BlueprintStorage.get_for_update",
            new_callable=AsyncMock,
            return_value=bp_orm,
        ):
            with pytest.raises(AppError) as exc_info:
                await service.apply("ri.ontology.blueprint.bp001")

        assert exc_info.value.code == "BLUEPRINT_INVALID_STATUS_FOR_APPLY"
        assert exc_info.value.status_code == 422

    @pytest.mark.asyncio
    async def test_apply_no_actionable(self, service):
        """AC-36: no accepted/edited items -> 422 BLUEPRINT_NO_ACTIONABLE_ITEMS."""
        bp_orm = _make_blueprint_orm(status=BlueprintStatus.PENDING_REVIEW.value)
        rejected_item = _make_item_orm(user_decision=UserDecision.REJECTED.value)

        with (
            patch(
                "app.services.blueprint_service.BlueprintStorage.get_for_update",
                new_callable=AsyncMock,
                return_value=bp_orm,
            ),
            patch(
                "app.services.blueprint_service.BlueprintItemStorage.list_by_blueprint",
                new_callable=AsyncMock,
                return_value=[rejected_item],
            ),
        ):
            with pytest.raises(AppError) as exc_info:
                await service.apply("ri.ontology.blueprint.bp001")

        assert exc_info.value.code == "BLUEPRINT_NO_ACTIONABLE_ITEMS"
        assert exc_info.value.status_code == 422

    @pytest.mark.asyncio
    async def test_apply_no_items_at_all(self, service):
        """Apply with empty item list -> 422 BLUEPRINT_NO_ACTIONABLE_ITEMS."""
        bp_orm = _make_blueprint_orm(status=BlueprintStatus.PENDING_REVIEW.value)

        with (
            patch(
                "app.services.blueprint_service.BlueprintStorage.get_for_update",
                new_callable=AsyncMock,
                return_value=bp_orm,
            ),
            patch(
                "app.services.blueprint_service.BlueprintItemStorage.list_by_blueprint",
                new_callable=AsyncMock,
                return_value=[],
            ),
        ):
            with pytest.raises(AppError) as exc_info:
                await service.apply("ri.ontology.blueprint.bp001")

        assert exc_info.value.code == "BLUEPRINT_NO_ACTIONABLE_ITEMS"
        assert exc_info.value.status_code == 422

    @pytest.mark.asyncio
    async def test_apply_not_found(self, service):
        """Apply on nonexistent blueprint -> 404."""
        with patch(
            "app.services.blueprint_service.BlueprintStorage.get_for_update",
            new_callable=AsyncMock,
            return_value=None,
        ):
            with pytest.raises(AppError) as exc_info:
                await service.apply("ri.ontology.blueprint.nonexistent")

        assert exc_info.value.code == "BLUEPRINT_NOT_FOUND"
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_apply_mixed_items_filters_rejected(self, service):
        """Apply only processes accepted/edited items, skips rejected/undecided."""
        bp_orm = _make_blueprint_orm(status=BlueprintStatus.PENDING_REVIEW.value)
        accepted_item = _make_item_orm(
            rid="ri.ontology.blueprint-item.ot01",
            item_type=BlueprintItemType.OBJECT_TYPE.value,
            user_decision=UserDecision.ACCEPTED.value,
            suggestion={"displayName": "Customer", "apiName": "customer"},
        )
        rejected_item = _make_item_orm(
            rid="ri.ontology.blueprint-item.ot02",
            item_type=BlueprintItemType.OBJECT_TYPE.value,
            user_decision=UserDecision.REJECTED.value,
            suggestion={"displayName": "Ignored"},
        )
        undecided_item = _make_item_orm(
            rid="ri.ontology.blueprint-item.ot03",
            item_type=BlueprintItemType.OBJECT_TYPE.value,
            user_decision=None,
            suggestion={"displayName": "Pending"},
        )

        mock_created = MagicMock()
        mock_created.rid = "ri.ontology.object-type.created001"

        with (
            patch(
                "app.services.blueprint_service.BlueprintStorage.get_for_update",
                new_callable=AsyncMock,
                return_value=bp_orm,
            ),
            patch(
                "app.services.blueprint_service.BlueprintItemStorage.list_by_blueprint",
                new_callable=AsyncMock,
                return_value=[accepted_item, rejected_item, undecided_item],
            ),
            patch(
                "app.services.blueprint_service.BlueprintItemStorage.update_created_entity_rid",
                new_callable=AsyncMock,
            ),
            patch(
                "app.services.blueprint_service.BlueprintStorage.update_status",
                new_callable=AsyncMock,
            ),
            patch(
                "app.services.object_type_service.ObjectTypeService.create",
                new_callable=AsyncMock,
                return_value=mock_created,
            ),
        ):
            result = await service.apply("ri.ontology.blueprint.bp001")

        # Only the accepted item should be processed
        assert result.total == 1
        assert result.succeeded == 1
        assert len(result.results) == 1

    @pytest.mark.asyncio
    async def test_apply_multi_phase_ot_property_linktype(self, service):
        """Apply processes OT -> Property -> LinkType in order with placeholder resolution."""
        bp_orm = _make_blueprint_orm(
            rid="ri.ontology.blueprint.bp001",
            status=BlueprintStatus.PENDING_REVIEW.value,
        )
        ot_item = _make_item_orm(
            rid="ri.ontology.blueprint-item.ot01",
            item_type=BlueprintItemType.OBJECT_TYPE.value,
            user_decision=UserDecision.ACCEPTED.value,
            suggestion={
                "displayName": "Customer",
                "apiName": "customer",
                "placeholderRid": "ph-ot-1",
            },
        )
        prop_item = _make_item_orm(
            rid="ri.ontology.blueprint-item.prop01",
            item_type=BlueprintItemType.PROPERTY.value,
            user_decision=UserDecision.ACCEPTED.value,
            suggestion={
                "displayName": "Name",
                "apiName": "name",
                "baseType": "string",
                "objectTypePlaceholderRid": "ph-ot-1",
            },
        )
        lt_item = _make_item_orm(
            rid="ri.ontology.blueprint-item.lt01",
            item_type=BlueprintItemType.LINK_TYPE.value,
            user_decision=UserDecision.ACCEPTED.value,
            suggestion={
                "displayName": "has orders",
                "id": "has-orders",
                "description": "Customer has orders",
                "sideAPlaceholderRid": "ph-ot-1",
                "sideBObjectTypeRid": "ri.ontology.object-type.order",
                "cardinality": "many-to-many",
            },
        )

        mock_created_ot = MagicMock()
        mock_created_ot.rid = "ri.ontology.object-type.real001"

        mock_created_prop = MagicMock()
        mock_created_prop.rid = "ri.ontology.property.real001"

        mock_created_lt = MagicMock()
        mock_created_lt.rid = "ri.ontology.link-type.real001"

        # Mock service classes at construction level AND domain request models
        # so that Pydantic validation (which runs before .create) is bypassed.
        mock_ot_svc = MagicMock()
        mock_ot_svc.create = AsyncMock(return_value=mock_created_ot)
        mock_ot_cls = MagicMock(return_value=mock_ot_svc)

        mock_prop_svc = MagicMock()
        mock_prop_svc.create = AsyncMock(return_value=mock_created_prop)
        mock_prop_cls = MagicMock(return_value=mock_prop_svc)

        mock_lt_svc = MagicMock()
        mock_lt_svc.create = AsyncMock(return_value=mock_created_lt)
        mock_lt_cls = MagicMock(return_value=mock_lt_svc)

        with (
            patch(
                "app.services.blueprint_service.BlueprintStorage.get_for_update",
                new_callable=AsyncMock,
                return_value=bp_orm,
            ),
            patch(
                "app.services.blueprint_service.BlueprintItemStorage.list_by_blueprint",
                new_callable=AsyncMock,
                return_value=[ot_item, prop_item, lt_item],
            ),
            patch(
                "app.services.blueprint_service.BlueprintItemStorage.update_created_entity_rid",
                new_callable=AsyncMock,
            ),
            patch(
                "app.services.blueprint_service.BlueprintStorage.update_status",
                new_callable=AsyncMock,
            ),
            patch(
                "app.services.object_type_service.ObjectTypeService",
                mock_ot_cls,
            ),
            patch(
                "app.services.property_service.PropertyService",
                mock_prop_cls,
            ),
            patch(
                "app.services.link_type_service.LinkTypeService",
                mock_lt_cls,
            ),
            # Patch Pydantic domain request models so validation is skipped
            patch("app.domain.object_type.ObjectTypeCreateRequest", MagicMock()),
            patch("app.domain.property.PropertyCreateRequest", MagicMock()),
            patch("app.domain.link_type.LinkTypeCreateRequest", MagicMock()),
        ):
            result = await service.apply("ri.ontology.blueprint.bp001")

        assert result.total == 3
        assert result.succeeded == 3
        assert result.failed == 0
        assert result.skipped == 0
        statuses = [r.status for r in result.results]
        assert statuses == ["success", "success", "success"]
        # Verify each service's create was called
        mock_ot_svc.create.assert_awaited_once()
        mock_prop_svc.create.assert_awaited_once()
        mock_lt_svc.create.assert_awaited_once()


# ---------------------------------------------------------------------------
# _compute_confidence_level (unit test for helper)
# ---------------------------------------------------------------------------


class TestComputeConfidenceLevel:
    """Direct tests for the confidence level computation function."""

    def test_high_threshold(self):
        from app.services.blueprint_service import _compute_confidence_level

        assert _compute_confidence_level(0.8) == ConfidenceLevel.HIGH
        assert _compute_confidence_level(0.95) == ConfidenceLevel.HIGH
        assert _compute_confidence_level(1.0) == ConfidenceLevel.HIGH

    def test_medium_threshold(self):
        from app.services.blueprint_service import _compute_confidence_level

        assert _compute_confidence_level(0.5) == ConfidenceLevel.MEDIUM
        assert _compute_confidence_level(0.65) == ConfidenceLevel.MEDIUM
        assert _compute_confidence_level(0.79) == ConfidenceLevel.MEDIUM

    def test_low_threshold(self):
        from app.services.blueprint_service import _compute_confidence_level

        assert _compute_confidence_level(0.0) == ConfidenceLevel.LOW
        assert _compute_confidence_level(0.3) == ConfidenceLevel.LOW
        assert _compute_confidence_level(0.49) == ConfidenceLevel.LOW


# ---------------------------------------------------------------------------
# F017: Batch Update Decisions
# ---------------------------------------------------------------------------


class TestBatchUpdateDecisions:
    """Tests for BlueprintService.batch_update_decisions()."""

    @pytest.mark.asyncio
    async def test_batch_accept_all_undecided(self, service, db_session_mock):
        """3 undecided items → all accepted, returns 3."""
        bp_orm = _make_blueprint_orm(status=BlueprintStatus.PENDING_REVIEW.value)
        items = [
            _make_item_orm(rid=f"ri.ontology.blueprint-item.item{i}", user_decision=None)
            for i in range(3)
        ]
        # After update_decision, items get the new decision
        updated_items = [
            _make_item_orm(
                rid=f"ri.ontology.blueprint-item.item{i}", user_decision=UserDecision.ACCEPTED.value
            )
            for i in range(3)
        ]

        with (
            patch("app.services.blueprint_service.BlueprintStorage") as mock_bp_storage,
            patch("app.services.blueprint_service.BlueprintItemStorage") as mock_item_storage,
        ):
            mock_bp_storage.get = AsyncMock(return_value=bp_orm)
            mock_item_storage.batch_get = AsyncMock(return_value=items)
            mock_item_storage.update_decision = AsyncMock(side_effect=updated_items)

            req = BlueprintItemBatchUpdate(
                item_rids=[f"ri.ontology.blueprint-item.item{i}" for i in range(3)],
                user_decision=UserDecision.ACCEPTED,
            )
            result = await service.batch_update_decisions(bp_orm.rid, req)

        assert len(result) == 3
        assert all(item.user_decision == UserDecision.ACCEPTED for item in result)

    @pytest.mark.asyncio
    async def test_batch_skips_already_decided(self, service, db_session_mock):
        """2 already decided + 1 undecided → returns only 1 updated."""
        bp_orm = _make_blueprint_orm(status=BlueprintStatus.PENDING_REVIEW.value)
        items = [
            _make_item_orm(
                rid="ri.ontology.blueprint-item.d1", user_decision=UserDecision.ACCEPTED.value
            ),
            _make_item_orm(
                rid="ri.ontology.blueprint-item.d2", user_decision=UserDecision.REJECTED.value
            ),
            _make_item_orm(rid="ri.ontology.blueprint-item.u1", user_decision=None),
        ]
        updated = _make_item_orm(
            rid="ri.ontology.blueprint-item.u1",
            user_decision=UserDecision.ACCEPTED.value,
        )

        with (
            patch("app.services.blueprint_service.BlueprintStorage") as mock_bp_storage,
            patch("app.services.blueprint_service.BlueprintItemStorage") as mock_item_storage,
        ):
            mock_bp_storage.get = AsyncMock(return_value=bp_orm)
            mock_item_storage.batch_get = AsyncMock(return_value=items)
            mock_item_storage.update_decision = AsyncMock(return_value=updated)

            req = BlueprintItemBatchUpdate(
                item_rids=[i.rid for i in items],
                user_decision=UserDecision.ACCEPTED,
            )
            result = await service.batch_update_decisions(bp_orm.rid, req)

        assert len(result) == 1
        assert result[0].rid == "ri.ontology.blueprint-item.u1"

    @pytest.mark.asyncio
    async def test_batch_reject_with_reason(self, service, db_session_mock):
        """Batch reject with rejection reason → each item has the reason."""
        bp_orm = _make_blueprint_orm(status=BlueprintStatus.PENDING_REVIEW.value)
        items = [
            _make_item_orm(rid="ri.ontology.blueprint-item.r1", user_decision=None),
        ]
        updated = _make_item_orm(
            rid="ri.ontology.blueprint-item.r1",
            user_decision=UserDecision.REJECTED.value,
            rejection_reason="与业务不相关",
        )

        with (
            patch("app.services.blueprint_service.BlueprintStorage") as mock_bp_storage,
            patch("app.services.blueprint_service.BlueprintItemStorage") as mock_item_storage,
        ):
            mock_bp_storage.get = AsyncMock(return_value=bp_orm)
            mock_item_storage.batch_get = AsyncMock(return_value=items)
            mock_item_storage.update_decision = AsyncMock(return_value=updated)

            req = BlueprintItemBatchUpdate(
                item_rids=["ri.ontology.blueprint-item.r1"],
                user_decision=UserDecision.REJECTED,
                rejection_reason="与业务不相关",
            )
            result = await service.batch_update_decisions(bp_orm.rid, req)

        assert len(result) == 1
        assert result[0].rejection_reason == "与业务不相关"

    @pytest.mark.asyncio
    async def test_batch_requires_pending_review(self, service, db_session_mock):
        """Blueprint in draft → raises BLUEPRINT_INVALID_STATUS_TRANSITION."""
        bp_orm = _make_blueprint_orm(status=BlueprintStatus.DRAFT.value)

        with patch("app.services.blueprint_service.BlueprintStorage") as mock_bp_storage:
            mock_bp_storage.get = AsyncMock(return_value=bp_orm)

            req = BlueprintItemBatchUpdate(
                item_rids=["ri.ontology.blueprint-item.x"],
                user_decision=UserDecision.ACCEPTED,
            )
            with pytest.raises(AppError, match="pending_review"):
                await service.batch_update_decisions(bp_orm.rid, req)

    @pytest.mark.asyncio
    async def test_batch_empty_rids(self, service, db_session_mock):
        """Empty item_rids → returns empty list."""
        bp_orm = _make_blueprint_orm(status=BlueprintStatus.PENDING_REVIEW.value)

        with (
            patch("app.services.blueprint_service.BlueprintStorage") as mock_bp_storage,
            patch("app.services.blueprint_service.BlueprintItemStorage") as mock_item_storage,
        ):
            mock_bp_storage.get = AsyncMock(return_value=bp_orm)
            mock_item_storage.batch_get = AsyncMock(return_value=[])

            req = BlueprintItemBatchUpdate(
                item_rids=[],
                user_decision=UserDecision.ACCEPTED,
            )
            result = await service.batch_update_decisions(bp_orm.rid, req)

        assert result == []


# ---------------------------------------------------------------------------
# F017: Pre-Apply Check
# ---------------------------------------------------------------------------


class TestPreApplyCheck:
    """Tests for BlueprintService.pre_apply_check()."""

    @pytest.mark.asyncio
    async def test_precheck_no_conflicts(self, service, db_session_mock):
        """Accepted OTs + LT with valid deps → canApply=true, no conflicts."""
        bp_orm = _make_blueprint_orm(status=BlueprintStatus.PENDING_REVIEW.value)
        ot_item = _make_item_orm(
            rid="ri.ontology.blueprint-item.ot1",
            item_type=BlueprintItemType.OBJECT_TYPE.value,
            suggestion={"displayName": "Order", "apiName": "Order", "placeholderRid": "ph-ot1"},
            user_decision=UserDecision.ACCEPTED.value,
        )
        lt_item = _make_item_orm(
            rid="ri.ontology.blueprint-item.lt1",
            item_type=BlueprintItemType.LINK_TYPE.value,
            suggestion={
                "displayName": "Contains",
                "sideA": {"objectTypeRid": "ph-ot1"},
                "sideB": {"objectTypeRid": "ph-ot1"},
            },
            user_decision=UserDecision.ACCEPTED.value,
        )

        with (
            patch("app.services.blueprint_service.BlueprintStorage") as mock_bp_storage,
            patch("app.services.blueprint_service.BlueprintItemStorage") as mock_item_storage,
        ):
            mock_bp_storage.get = AsyncMock(return_value=bp_orm)
            mock_item_storage.list_by_blueprint = AsyncMock(return_value=[ot_item, lt_item])

            # Mock ObjectTypeStorage to return no existing OT with same apiName
            with patch(
                "app.services.blueprint_service.ObjectTypeStorage", create=True
            ) as mock_ot_storage:
                mock_ot_storage.get_by_api_name = AsyncMock(return_value=None)
                result = await service.pre_apply_check(bp_orm.rid)

        assert result.can_apply is True
        assert result.conflicts == []
        assert result.actionable_count == 2
        assert result.undecided_count == 0

    @pytest.mark.asyncio
    async def test_precheck_apiname_collision(self, service, db_session_mock):
        """OT apiName conflicts with existing → conflict reported."""
        bp_orm = _make_blueprint_orm(status=BlueprintStatus.PENDING_REVIEW.value)
        ot_item = _make_item_orm(
            rid="ri.ontology.blueprint-item.ot1",
            item_type=BlueprintItemType.OBJECT_TYPE.value,
            suggestion={"displayName": "Order", "apiName": "Order", "placeholderRid": "ph-ot1"},
            user_decision=UserDecision.ACCEPTED.value,
        )
        existing_ot = MagicMock()
        existing_ot.rid = "ri.ontology.object-type.existing"

        with (
            patch("app.services.blueprint_service.BlueprintStorage") as mock_bp_storage,
            patch("app.services.blueprint_service.BlueprintItemStorage") as mock_item_storage,
        ):
            mock_bp_storage.get = AsyncMock(return_value=bp_orm)
            mock_item_storage.list_by_blueprint = AsyncMock(return_value=[ot_item])

            with patch(
                "app.services.blueprint_service.ObjectTypeStorage", create=True
            ) as mock_ot_storage:
                mock_ot_storage.get_by_api_name = AsyncMock(return_value=existing_ot)
                result = await service.pre_apply_check(bp_orm.rid)

        assert len(result.conflicts) == 1
        assert result.conflicts[0].conflict_type == "api_name_collision"
        assert result.conflicts[0].conflicting_entity_rid == "ri.ontology.object-type.existing"

    @pytest.mark.asyncio
    async def test_precheck_dependency_missing(self, service, db_session_mock):
        """LT references rejected OT placeholder → dependency_missing conflict."""
        bp_orm = _make_blueprint_orm(status=BlueprintStatus.PENDING_REVIEW.value)
        ot_item = _make_item_orm(
            rid="ri.ontology.blueprint-item.ot1",
            item_type=BlueprintItemType.OBJECT_TYPE.value,
            suggestion={"displayName": "Order", "apiName": "Order", "placeholderRid": "ph-ot1"},
            user_decision=UserDecision.REJECTED.value,
        )
        lt_item = _make_item_orm(
            rid="ri.ontology.blueprint-item.lt1",
            item_type=BlueprintItemType.LINK_TYPE.value,
            suggestion={
                "displayName": "HasOrder",
                "sideA": {"objectTypeRid": "ph-ot1"},
                "sideB": {"objectTypeRid": "ph-ot1"},
            },
            user_decision=UserDecision.ACCEPTED.value,
        )

        with (
            patch("app.services.blueprint_service.BlueprintStorage") as mock_bp_storage,
            patch("app.services.blueprint_service.BlueprintItemStorage") as mock_item_storage,
        ):
            mock_bp_storage.get = AsyncMock(return_value=bp_orm)
            mock_item_storage.list_by_blueprint = AsyncMock(return_value=[ot_item, lt_item])

            result = await service.pre_apply_check(bp_orm.rid)

        assert result.can_apply is False
        dep_conflicts = [c for c in result.conflicts if c.conflict_type == "dependency_missing"]
        assert len(dep_conflicts) >= 1

    @pytest.mark.asyncio
    async def test_precheck_counts_undecided(self, service, db_session_mock):
        """2 accepted + 1 undecided → correct counts."""
        bp_orm = _make_blueprint_orm(status=BlueprintStatus.PENDING_REVIEW.value)
        items = [
            _make_item_orm(
                rid="ri.ontology.blueprint-item.a1",
                user_decision=UserDecision.ACCEPTED.value,
                item_type=BlueprintItemType.OBJECT_TYPE.value,
                suggestion={"displayName": "A", "apiName": "A", "placeholderRid": "ph-a1"},
            ),
            _make_item_orm(
                rid="ri.ontology.blueprint-item.a2",
                user_decision=UserDecision.ACCEPTED.value,
                item_type=BlueprintItemType.OBJECT_TYPE.value,
                suggestion={"displayName": "B", "apiName": "B", "placeholderRid": "ph-a2"},
            ),
            _make_item_orm(
                rid="ri.ontology.blueprint-item.u1",
                user_decision=None,
                item_type=BlueprintItemType.OBJECT_TYPE.value,
                suggestion={"displayName": "C", "apiName": "C", "placeholderRid": "ph-u1"},
            ),
        ]

        with (
            patch("app.services.blueprint_service.BlueprintStorage") as mock_bp_storage,
            patch("app.services.blueprint_service.BlueprintItemStorage") as mock_item_storage,
        ):
            mock_bp_storage.get = AsyncMock(return_value=bp_orm)
            mock_item_storage.list_by_blueprint = AsyncMock(return_value=items)

            with patch(
                "app.services.blueprint_service.ObjectTypeStorage", create=True
            ) as mock_ot_storage:
                mock_ot_storage.get_by_api_name = AsyncMock(return_value=None)
                result = await service.pre_apply_check(bp_orm.rid)

        assert result.actionable_count == 2
        assert result.undecided_count == 1

    @pytest.mark.asyncio
    async def test_precheck_requires_pending_review(self, service, db_session_mock):
        """Blueprint not in pending_review → raises error."""
        bp_orm = _make_blueprint_orm(status=BlueprintStatus.APPLIED.value)

        with patch("app.services.blueprint_service.BlueprintStorage") as mock_bp_storage:
            mock_bp_storage.get = AsyncMock(return_value=bp_orm)

            with pytest.raises(AppError, match="pending_review"):
                await service.pre_apply_check(bp_orm.rid)


# ---------------------------------------------------------------------------
# F017: Retry Item
# ---------------------------------------------------------------------------


class TestRetryItem:
    """Tests for BlueprintService.retry_item()."""

    @pytest.mark.asyncio
    async def test_retry_success_ot(self, service, db_session_mock):
        """Applied blueprint + accepted OT with no created_entity_rid → retry succeeds."""
        bp_orm = _make_blueprint_orm(status=BlueprintStatus.APPLIED.value)
        item_orm = _make_item_orm(
            rid="ri.ontology.blueprint-item.fail1",
            item_type=BlueprintItemType.OBJECT_TYPE.value,
            suggestion={"displayName": "Order", "apiName": "Order", "placeholderRid": "ph1"},
            user_decision=UserDecision.ACCEPTED.value,
            created_entity_rid=None,
        )

        mock_created_ot = MagicMock()
        mock_created_ot.rid = "ri.ontology.object-type.new1"

        with (
            patch("app.services.blueprint_service.BlueprintStorage") as mock_bp_storage,
            patch("app.services.blueprint_service.BlueprintItemStorage") as mock_item_storage,
        ):
            mock_bp_storage.get = AsyncMock(return_value=bp_orm)
            mock_item_storage.get = AsyncMock(return_value=item_orm)
            mock_item_storage.get_succeeded_items = AsyncMock(return_value=[])
            mock_item_storage.update_created_entity_rid = AsyncMock()
            mock_item_storage.update_decision = AsyncMock()

            with patch(
                "app.services.blueprint_service.ObjectTypeService", create=True
            ) as mock_ot_svc_cls:
                mock_ot_svc = MagicMock()
                mock_ot_svc.create = AsyncMock(return_value=mock_created_ot)
                mock_ot_svc_cls.return_value = mock_ot_svc

                result = await service.retry_item(bp_orm.rid, item_orm.rid)

        assert result.status == "success"
        assert result.created_entity_rid == "ri.ontology.object-type.new1"

    @pytest.mark.asyncio
    async def test_retry_with_user_edits(self, service, db_session_mock):
        """Retry with user_edits merges edits before creating."""
        bp_orm = _make_blueprint_orm(status=BlueprintStatus.APPLIED.value)
        item_orm = _make_item_orm(
            rid="ri.ontology.blueprint-item.fail2",
            item_type=BlueprintItemType.OBJECT_TYPE.value,
            suggestion={"displayName": "Order", "apiName": "Order", "placeholderRid": "ph2"},
            user_decision=UserDecision.ACCEPTED.value,
            created_entity_rid=None,
            user_edits=None,
        )

        mock_created_ot = MagicMock()
        mock_created_ot.rid = "ri.ontology.object-type.new2"

        with (
            patch("app.services.blueprint_service.BlueprintStorage") as mock_bp_storage,
            patch("app.services.blueprint_service.BlueprintItemStorage") as mock_item_storage,
        ):
            mock_bp_storage.get = AsyncMock(return_value=bp_orm)
            mock_item_storage.get = AsyncMock(return_value=item_orm)
            mock_item_storage.get_succeeded_items = AsyncMock(return_value=[])
            mock_item_storage.update_created_entity_rid = AsyncMock()
            mock_item_storage.update_decision = AsyncMock()

            with patch(
                "app.services.blueprint_service.ObjectTypeService", create=True
            ) as mock_ot_svc_cls:
                mock_ot_svc = MagicMock()
                mock_ot_svc.create = AsyncMock(return_value=mock_created_ot)
                mock_ot_svc_cls.return_value = mock_ot_svc

                result = await service.retry_item(
                    bp_orm.rid, item_orm.rid, user_edits={"apiName": "CustomerOrder"}
                )

        assert result.status == "success"

    @pytest.mark.asyncio
    async def test_retry_not_retryable_already_created(self, service, db_session_mock):
        """Item with created_entity_rid → not retryable."""
        bp_orm = _make_blueprint_orm(status=BlueprintStatus.APPLIED.value)
        item_orm = _make_item_orm(
            rid="ri.ontology.blueprint-item.ok1",
            user_decision=UserDecision.ACCEPTED.value,
            created_entity_rid="ri.ontology.object-type.exists",
        )

        with (
            patch("app.services.blueprint_service.BlueprintStorage") as mock_bp_storage,
            patch("app.services.blueprint_service.BlueprintItemStorage") as mock_item_storage,
        ):
            mock_bp_storage.get = AsyncMock(return_value=bp_orm)
            mock_item_storage.get = AsyncMock(return_value=item_orm)

            with pytest.raises(AppError, match="not retryable"):
                await service.retry_item(bp_orm.rid, item_orm.rid)

    @pytest.mark.asyncio
    async def test_retry_not_retryable_rejected(self, service, db_session_mock):
        """Rejected item → not retryable."""
        bp_orm = _make_blueprint_orm(status=BlueprintStatus.APPLIED.value)
        item_orm = _make_item_orm(
            rid="ri.ontology.blueprint-item.rej1",
            user_decision=UserDecision.REJECTED.value,
            created_entity_rid=None,
        )

        with (
            patch("app.services.blueprint_service.BlueprintStorage") as mock_bp_storage,
            patch("app.services.blueprint_service.BlueprintItemStorage") as mock_item_storage,
        ):
            mock_bp_storage.get = AsyncMock(return_value=bp_orm)
            mock_item_storage.get = AsyncMock(return_value=item_orm)

            with pytest.raises(AppError, match="not retryable"):
                await service.retry_item(bp_orm.rid, item_orm.rid)

    @pytest.mark.asyncio
    async def test_retry_requires_applied_status(self, service, db_session_mock):
        """Blueprint not in applied → raises error."""
        bp_orm = _make_blueprint_orm(status=BlueprintStatus.PENDING_REVIEW.value)

        with patch("app.services.blueprint_service.BlueprintStorage") as mock_bp_storage:
            mock_bp_storage.get = AsyncMock(return_value=bp_orm)

            with pytest.raises(AppError, match="applied"):
                await service.retry_item(bp_orm.rid, "ri.ontology.blueprint-item.x")

    @pytest.mark.asyncio
    async def test_retry_builds_rid_map_from_succeeded(self, service, db_session_mock):
        """LT retry resolves placeholder OT RID from succeeded items."""
        bp_orm = _make_blueprint_orm(status=BlueprintStatus.APPLIED.value)
        # A succeeded OT item
        succeeded_ot = _make_item_orm(
            rid="ri.ontology.blueprint-item.ot-ok",
            item_type=BlueprintItemType.OBJECT_TYPE.value,
            suggestion={"displayName": "Order", "apiName": "Order", "placeholderRid": "ph-ot1"},
            user_decision=UserDecision.ACCEPTED.value,
            created_entity_rid="ri.ontology.object-type.real-ot1",
        )
        # A failed LT item referencing the succeeded OT
        lt_item = _make_item_orm(
            rid="ri.ontology.blueprint-item.lt-fail",
            item_type=BlueprintItemType.LINK_TYPE.value,
            suggestion={
                "displayName": "HasOrder",
                "apiName": "hasOrder",
                "sideA": {"objectTypeRid": "ph-ot1"},
                "sideB": {"objectTypeRid": "ph-ot1"},
                "cardinality": "one-to-many",
            },
            user_decision=UserDecision.ACCEPTED.value,
            created_entity_rid=None,
        )

        mock_created_lt = MagicMock()
        mock_created_lt.rid = "ri.ontology.link-type.new-lt1"

        with (
            patch("app.services.blueprint_service.BlueprintStorage") as mock_bp_storage,
            patch("app.services.blueprint_service.BlueprintItemStorage") as mock_item_storage,
        ):
            mock_bp_storage.get = AsyncMock(return_value=bp_orm)
            mock_item_storage.get = AsyncMock(return_value=lt_item)
            mock_item_storage.get_succeeded_items = AsyncMock(return_value=[succeeded_ot])
            mock_item_storage.update_created_entity_rid = AsyncMock()

            with patch(
                "app.services.blueprint_service.LinkTypeService", create=True
            ) as mock_lt_svc_cls:
                mock_lt_svc = MagicMock()
                mock_lt_svc.create = AsyncMock(return_value=mock_created_lt)
                mock_lt_svc_cls.return_value = mock_lt_svc

                result = await service.retry_item(bp_orm.rid, lt_item.rid)

        assert result.status == "success"
        assert result.created_entity_rid == "ri.ontology.link-type.new-lt1"
