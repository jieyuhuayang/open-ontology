"""Blueprint service — CRUD, state machine, item decisions, and apply logic."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.blueprint import (
    ApplyItemResult,
    Blueprint,
    BlueprintApplyResult,
    BlueprintCreate,
    BlueprintDetail,
    BlueprintItem,
    BlueprintItemBatchUpdate,
    BlueprintItemCreate,
    BlueprintItemRetryResult,
    BlueprintItemType,
    BlueprintItemUpdate,
    BlueprintList,
    BlueprintPreApplyCheck,
    BlueprintStatus,
    BlueprintUpdate,
    ConfidenceLevel,
    ConflictCheckResult,
    UserDecision,
)
from app.domain.common import generate_rid
from app.exceptions import AppError
from app.storage.agent_storage import AgentStorage
from app.storage.blueprint_storage import BlueprintItemStorage, BlueprintStorage
from app.storage.models import BlueprintItemModel, BlueprintModel

# Valid state transitions (source → allowed targets)
_VALID_TRANSITIONS: dict[str, set[str]] = {
    BlueprintStatus.DRAFT.value: {BlueprintStatus.PENDING_REVIEW.value},
    BlueprintStatus.PENDING_REVIEW.value: {BlueprintStatus.DISCARDED.value},
    # applied and discarded are terminal — no transitions allowed
    BlueprintStatus.APPLIED.value: set(),
    BlueprintStatus.DISCARDED.value: set(),
}


def _compute_confidence_level(confidence: float) -> ConfidenceLevel:
    if confidence >= 0.8:
        return ConfidenceLevel.HIGH
    if confidence >= 0.5:
        return ConfidenceLevel.MEDIUM
    return ConfidenceLevel.LOW


class BlueprintService:
    def __init__(self, session: AsyncSession):
        self._session = session

    # --- Blueprint CRUD ---

    async def create(self, req: BlueprintCreate) -> Blueprint:
        # Validate session exists
        session_orm = await AgentStorage.get_session(self._session, req.session_rid)
        if session_orm is None:
            raise AppError(
                code="AGENT_SESSION_NOT_FOUND",
                message=f"Agent session '{req.session_rid}' not found",
                status_code=404,
            )

        # Validate ontology exists (direct query to avoid cross-domain storage import)
        from sqlalchemy import select

        from app.storage.models import OntologyModel

        ontology_result = await self._session.execute(
            select(OntologyModel.rid).where(OntologyModel.rid == req.ontology_rid)
        )
        if ontology_result.scalar_one_or_none() is None:
            raise AppError(
                code="ONTOLOGY_NOT_FOUND",
                message=f"Ontology '{req.ontology_rid}' not found",
                status_code=404,
            )

        rid = generate_rid("ontology", "blueprint")
        orm = BlueprintModel(
            rid=rid,
            session_rid=req.session_rid,
            ontology_rid=req.ontology_rid,
            name=req.name,
            status=BlueprintStatus.DRAFT.value,
            source_summary=req.source_summary,
        )
        await BlueprintStorage.create(self._session, orm)
        return self._to_blueprint(orm)

    async def get(self, rid: str) -> Blueprint:
        orm = await BlueprintStorage.get(self._session, rid)
        if orm is None:
            raise AppError(
                code="BLUEPRINT_NOT_FOUND",
                message=f"Blueprint '{rid}' not found",
                status_code=404,
            )
        return self._to_blueprint(orm)

    async def get_detail(self, rid: str) -> BlueprintDetail:
        orm = await BlueprintStorage.get_with_items(self._session, rid)
        if orm is None:
            raise AppError(
                code="BLUEPRINT_NOT_FOUND",
                message=f"Blueprint '{rid}' not found",
                status_code=404,
            )
        return BlueprintDetail(
            blueprint=self._to_blueprint(orm),
            items=[self._to_item(item) for item in orm.items],
        )

    async def list_blueprints(
        self,
        session_rid: str | None = None,
        ontology_rid: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> BlueprintList:
        if session_rid:
            orms, total = await BlueprintStorage.list_by_session(
                self._session, session_rid, page, page_size
            )
        elif ontology_rid:
            orms, total = await BlueprintStorage.list_by_ontology(
                self._session, ontology_rid, page, page_size
            )
        else:
            orms, total = await BlueprintStorage.list_all(self._session, page, page_size)

        return BlueprintList(
            items=[self._to_blueprint(orm) for orm in orms],
            total_count=total,
            page=page,
            page_size=page_size,
        )

    async def update(self, rid: str, req: BlueprintUpdate) -> Blueprint:
        orm = await BlueprintStorage.get(self._session, rid)
        if orm is None:
            raise AppError(
                code="BLUEPRINT_NOT_FOUND",
                message=f"Blueprint '{rid}' not found",
                status_code=404,
            )

        # Validate status transition
        if req.status is not None:
            current = orm.status
            target = req.status.value
            allowed = _VALID_TRANSITIONS.get(current, set())
            if target not in allowed:
                raise AppError(
                    code="BLUEPRINT_INVALID_STATUS_TRANSITION",
                    message=f"Cannot transition from '{current}' to '{target}'",
                    status_code=422,
                )

        fields: dict[str, object] = {}
        if req.name is not None:
            fields["name"] = req.name
        if req.status is not None:
            fields["status"] = req.status.value
        if req.source_summary is not None:
            fields["source_summary"] = req.source_summary

        if fields:
            orm = await BlueprintStorage.update(self._session, rid, **fields)

        return self._to_blueprint(orm)

    # --- BlueprintItem CRUD ---

    async def create_item(self, blueprint_rid: str, req: BlueprintItemCreate) -> BlueprintItem:
        # Validate blueprint exists
        await self._get_blueprint_or_404(blueprint_rid)

        # INV-16: validate confidence and source
        self._validate_item_fields(req)

        rid = generate_rid("ontology", "blueprint-item")
        orm = BlueprintItemModel(
            rid=rid,
            blueprint_rid=blueprint_rid,
            item_type=req.item_type.value,
            suggestion=req.suggestion,
            confidence=req.confidence,
            confidence_level=_compute_confidence_level(req.confidence).value,
            reasoning=req.reasoning,
            source=req.source.value,
            sort_order=req.sort_order,
        )
        await BlueprintItemStorage.create(self._session, orm)
        return self._to_item(orm)

    async def batch_create_items(
        self, blueprint_rid: str, items: list[BlueprintItemCreate]
    ) -> list[BlueprintItem]:
        await self._get_blueprint_or_404(blueprint_rid)

        orms = []
        for req in items:
            self._validate_item_fields(req)
            rid = generate_rid("ontology", "blueprint-item")
            orm = BlueprintItemModel(
                rid=rid,
                blueprint_rid=blueprint_rid,
                item_type=req.item_type.value,
                suggestion=req.suggestion,
                confidence=req.confidence,
                confidence_level=_compute_confidence_level(req.confidence).value,
                reasoning=req.reasoning,
                source=req.source.value,
                sort_order=req.sort_order,
            )
            orms.append(orm)

        await BlueprintItemStorage.batch_create(self._session, orms)
        return [self._to_item(orm) for orm in orms]

    async def list_items(self, blueprint_rid: str) -> list[BlueprintItem]:
        await self._get_blueprint_or_404(blueprint_rid)
        orms = await BlueprintItemStorage.list_by_blueprint(self._session, blueprint_rid)
        return [self._to_item(orm) for orm in orms]

    # --- Item Decision ---

    async def update_item_decision(
        self, blueprint_rid: str, item_rid: str, req: BlueprintItemUpdate
    ) -> BlueprintItem:
        # Validate blueprint exists and is in pending_review
        bp_orm = await self._get_blueprint_or_404(blueprint_rid)
        if bp_orm.status != BlueprintStatus.PENDING_REVIEW.value:
            raise AppError(
                code="BLUEPRINT_INVALID_STATUS_TRANSITION",
                message=f"Blueprint must be in 'pending_review' to update item decisions (current: '{bp_orm.status}')",
                status_code=422,
            )

        # Validate item exists and belongs to this blueprint
        item_orm = await BlueprintItemStorage.get(self._session, item_rid)
        if item_orm is None or item_orm.blueprint_rid != blueprint_rid:
            raise AppError(
                code="BLUEPRINT_ITEM_NOT_FOUND",
                message=f"Blueprint item '{item_rid}' not found in blueprint '{blueprint_rid}'",
                status_code=404,
            )

        # INV-11: decision is immutable once set
        if item_orm.user_decision is not None:
            raise AppError(
                code="BLUEPRINT_ITEM_DECISION_IMMUTABLE",
                message=f"Decision already set to '{item_orm.user_decision}' and cannot be changed (INV-11)",
                status_code=422,
            )

        orm = await BlueprintItemStorage.update_decision(
            self._session,
            item_rid,
            decision=req.user_decision.value,
            edits=req.user_edits,
            rejection_reason=req.rejection_reason,
        )
        return self._to_item(orm)

    async def batch_update_decisions(
        self, blueprint_rid: str, req: BlueprintItemBatchUpdate
    ) -> list[BlueprintItem]:
        """Batch update decisions for multiple items, skipping already-decided ones."""
        bp_orm = await self._get_blueprint_or_404(blueprint_rid)
        if bp_orm.status != BlueprintStatus.PENDING_REVIEW.value:
            raise AppError(
                code="BLUEPRINT_INVALID_STATUS_TRANSITION",
                message=f"Blueprint must be in 'pending_review' to update item decisions (current: '{bp_orm.status}')",
                status_code=422,
            )

        items = await BlueprintItemStorage.batch_get(self._session, req.item_rids)
        updated: list[BlueprintItem] = []
        for item_orm in items:
            # Verify item belongs to this blueprint (prevent IDOR)
            if item_orm.blueprint_rid != blueprint_rid:
                continue
            if item_orm.user_decision is not None:
                continue
            orm = await BlueprintItemStorage.update_decision(
                self._session,
                item_orm.rid,
                decision=req.user_decision.value,
                rejection_reason=req.rejection_reason,
            )
            updated.append(self._to_item(orm))
        return updated

    # --- Pre-Apply Check ---

    async def pre_apply_check(self, rid: str) -> BlueprintPreApplyCheck:
        """Check for conflicts before applying a blueprint."""
        bp_orm = await self._get_blueprint_or_404(rid)
        if bp_orm.status != BlueprintStatus.PENDING_REVIEW.value:
            raise AppError(
                code="BLUEPRINT_INVALID_STATUS_TRANSITION",
                message=f"Blueprint must be in 'pending_review' for pre-apply check (current: '{bp_orm.status}')",
                status_code=422,
            )

        items = await BlueprintItemStorage.list_by_blueprint(self._session, rid)
        actionable = [
            i
            for i in items
            if i.user_decision in (UserDecision.ACCEPTED.value, UserDecision.EDITED.value)
        ]
        undecided = [i for i in items if i.user_decision is None]

        conflicts: list[ConflictCheckResult] = []
        has_blocking_conflict = False

        # Build placeholder set from accepted/edited OT items
        ot_placeholders: set[str] = set()
        for item in actionable:
            if item.item_type == BlueprintItemType.OBJECT_TYPE.value:
                suggestion = item.user_edits or item.suggestion
                placeholder = suggestion.get("placeholderRid", "")
                if placeholder:
                    ot_placeholders.add(placeholder)

        # Phase 1: apiName collision check for OT items
        from app.storage.object_type_storage import ObjectTypeStorage

        for item in actionable:
            if item.item_type != BlueprintItemType.OBJECT_TYPE.value:
                continue
            suggestion = item.user_edits or item.suggestion
            api_name = suggestion.get("apiName")
            if not api_name:
                continue
            existing = await ObjectTypeStorage.get_by_api_name(
                self._session, bp_orm.ontology_rid, api_name
            )
            if existing:
                conflicts.append(
                    ConflictCheckResult(
                        item_rid=item.rid,
                        conflict_type="api_name_collision",
                        message=f"apiName '{api_name}' conflicts with existing ObjectType '{existing.rid}'",
                        conflicting_entity_rid=existing.rid,
                    )
                )

        # Phase 2: dependency check for LT items
        for item in actionable:
            if item.item_type != BlueprintItemType.LINK_TYPE.value:
                continue
            suggestion = item.user_edits or item.suggestion
            # Support both nested and flat formats
            side_a_rid = suggestion.get("sideAPlaceholderRid") or (
                suggestion.get("sideA") or {}
            ).get("objectTypeRid", "")
            side_b_rid = suggestion.get("sideBPlaceholderRid") or (
                suggestion.get("sideB") or {}
            ).get("objectTypeRid", "")
            missing_sides = []
            for side_label, side_rid in [("sideA", side_a_rid), ("sideB", side_b_rid)]:
                if not side_rid:
                    continue
                # Skip if it's a real OT RID (already exists in ontology)
                if side_rid.startswith("ri.ontology."):
                    continue
                # Check if it's a placeholder that maps to an accepted/edited OT
                if side_rid not in ot_placeholders:
                    missing_sides.append(f"{side_label} ({side_rid})")
            if missing_sides:
                has_blocking_conflict = True
                conflicts.append(
                    ConflictCheckResult(
                        item_rid=item.rid,
                        conflict_type="dependency_missing",
                        message=f"LinkType '{suggestion.get('displayName', '')}' references missing OT: {', '.join(missing_sides)}",
                    )
                )

        can_apply = not has_blocking_conflict
        return BlueprintPreApplyCheck(
            can_apply=can_apply,
            conflicts=conflicts,
            actionable_count=len(actionable),
            undecided_count=len(undecided),
        )

    # --- Retry Item ---

    async def retry_item(
        self, blueprint_rid: str, item_rid: str, user_edits: dict | None = None
    ) -> BlueprintItemRetryResult:
        """Retry creating a single failed item from an applied blueprint."""
        bp_orm = await self._get_blueprint_or_404(blueprint_rid)
        if bp_orm.status != BlueprintStatus.APPLIED.value:
            raise AppError(
                code="BLUEPRINT_INVALID_STATUS_FOR_APPLY",
                message=f"Blueprint must be in 'applied' to retry items (current: '{bp_orm.status}')",
                status_code=422,
            )

        # Use FOR UPDATE lock to prevent concurrent retries on the same item
        from sqlalchemy import select as sa_select
        from app.storage.models import BlueprintItemModel

        stmt = (
            sa_select(BlueprintItemModel)
            .where(BlueprintItemModel.rid == item_rid)
            .with_for_update()
        )
        result = await self._session.execute(stmt)
        item_orm = result.scalar_one_or_none()

        if item_orm is None or item_orm.blueprint_rid != blueprint_rid:
            raise AppError(
                code="BLUEPRINT_ITEM_NOT_FOUND",
                message=f"Blueprint item '{item_rid}' not found",
                status_code=404,
            )

        if item_orm.user_decision not in (UserDecision.ACCEPTED.value, UserDecision.EDITED.value):
            raise AppError(
                code="BLUEPRINT_ITEM_NOT_RETRYABLE",
                message=f"Item is not retryable (decision: '{item_orm.user_decision}')",
                status_code=422,
            )

        if item_orm.created_entity_rid is not None:
            raise AppError(
                code="BLUEPRINT_ITEM_NOT_RETRYABLE",
                message=f"Item already created (rid: '{item_orm.created_entity_rid}'), not retryable",
                status_code=422,
            )

        # Merge user_edits if provided
        suggestion = dict(item_orm.user_edits or item_orm.suggestion)
        if user_edits:
            suggestion.update(user_edits)
            await BlueprintItemStorage.update_decision(
                self._session,
                item_rid,
                decision=item_orm.user_decision,
                edits=suggestion,
            )

        # Build OT RID map from succeeded items
        succeeded = await BlueprintItemStorage.get_succeeded_items(self._session, blueprint_rid)
        ot_rid_map: dict[str, str] = {}
        for s_item in succeeded:
            if s_item.item_type == BlueprintItemType.OBJECT_TYPE.value:
                s_suggestion = s_item.user_edits or s_item.suggestion
                placeholder = s_suggestion.get("placeholderRid", "")
                if placeholder and s_item.created_entity_rid:
                    ot_rid_map[placeholder] = s_item.created_entity_rid

        try:
            if item_orm.item_type == BlueprintItemType.OBJECT_TYPE.value:
                from app.domain.object_type import ObjectTypeCreateRequest
                from app.services.object_type_service import ObjectTypeService

                ot_service = ObjectTypeService(self._session)
                created = await ot_service.create(
                    ObjectTypeCreateRequest(
                        display_name=suggestion.get("displayName", ""),
                        api_name=suggestion.get("apiName"),
                        id=suggestion.get("id"),
                        description=suggestion.get("description", ""),
                    )
                )
                await BlueprintItemStorage.update_created_entity_rid(
                    self._session, item_rid, created.rid
                )
                return BlueprintItemRetryResult(
                    item_rid=item_rid, status="success", created_entity_rid=created.rid
                )

            elif item_orm.item_type == BlueprintItemType.PROPERTY.value:
                from app.domain.property import PropertyCreateRequest
                from app.services.property_service import PropertyService

                prop_service = PropertyService(self._session)
                owner_placeholder = suggestion.get("objectTypePlaceholderRid") or suggestion.get(
                    "objectTypeRid", ""
                )
                owner_rid = ot_rid_map.get(owner_placeholder, owner_placeholder)
                created = await prop_service.create(
                    owner_rid,
                    PropertyCreateRequest(
                        display_name=suggestion.get("displayName", ""),
                        api_name=suggestion.get("apiName"),
                        base_type=suggestion.get("baseType", "string"),
                    ),
                )
                await BlueprintItemStorage.update_created_entity_rid(
                    self._session, item_rid, created.rid
                )
                return BlueprintItemRetryResult(
                    item_rid=item_rid, status="success", created_entity_rid=created.rid
                )

            elif item_orm.item_type == BlueprintItemType.LINK_TYPE.value:
                from app.services.link_type_service import LinkTypeService

                lt_service = LinkTypeService(self._session)
                # Resolve placeholder RIDs — support both nested and flat formats
                side_a_placeholder = suggestion.get("sideAPlaceholderRid", "")
                side_b_placeholder = suggestion.get("sideBPlaceholderRid", "")
                if not side_a_placeholder:
                    side_a_placeholder = (suggestion.get("sideA") or {}).get("objectTypeRid", "")
                if not side_b_placeholder:
                    side_b_placeholder = (suggestion.get("sideB") or {}).get("objectTypeRid", "")

                side_a_ot = ot_rid_map.get(
                    side_a_placeholder, suggestion.get("sideAObjectTypeRid", side_a_placeholder)
                )
                side_b_ot = ot_rid_map.get(
                    side_b_placeholder, suggestion.get("sideBObjectTypeRid", side_b_placeholder)
                )

                from app.domain.link_type import LinkSideCreateInput, LinkTypeCreateRequest

                created = await lt_service.create(
                    LinkTypeCreateRequest(
                        id=suggestion.get("id", suggestion.get("apiName", "")),
                        side_a=LinkSideCreateInput(
                            object_type_rid=side_a_ot,
                            display_name=suggestion.get("displayName", ""),
                            api_name=(suggestion.get("sideA") or {}).get("apiName", "sideA"),
                        ),
                        side_b=LinkSideCreateInput(
                            object_type_rid=side_b_ot,
                            display_name=suggestion.get("displayName", ""),
                            api_name=(suggestion.get("sideB") or {}).get("apiName", "sideB"),
                        ),
                        cardinality=suggestion.get("cardinality", "many-to-many"),
                    )
                )
                await BlueprintItemStorage.update_created_entity_rid(
                    self._session, item_rid, created.rid
                )
                return BlueprintItemRetryResult(
                    item_rid=item_rid, status="success", created_entity_rid=created.rid
                )

            else:
                return BlueprintItemRetryResult(
                    item_rid=item_rid,
                    status="failed",
                    error=f"Unknown item type: {item_orm.item_type}",
                )

        except Exception as e:
            return BlueprintItemRetryResult(item_rid=item_rid, status="failed", error=str(e))

    # --- Apply ---

    async def apply(self, rid: str) -> BlueprintApplyResult:
        # Use row-level lock to prevent concurrent apply
        bp_orm = await BlueprintStorage.get_for_update(self._session, rid)
        if bp_orm is None:
            raise AppError(
                code="BLUEPRINT_NOT_FOUND",
                message=f"Blueprint '{rid}' not found",
                status_code=404,
            )

        # INV-10: must be pending_review
        if bp_orm.status != BlueprintStatus.PENDING_REVIEW.value:
            raise AppError(
                code="BLUEPRINT_INVALID_STATUS_FOR_APPLY",
                message=f"Blueprint must be in 'pending_review' to apply (current: '{bp_orm.status}')",
                status_code=422,
            )

        items = await BlueprintItemStorage.list_by_blueprint(self._session, rid)
        actionable = [
            i
            for i in items
            if i.user_decision in (UserDecision.ACCEPTED.value, UserDecision.EDITED.value)
        ]

        # INV-10: at least one accepted/edited item
        if not actionable:
            raise AppError(
                code="BLUEPRINT_NO_ACTIONABLE_ITEMS",
                message="No accepted or edited items to apply",
                status_code=422,
            )

        # Group by type
        ot_items = [i for i in actionable if i.item_type == BlueprintItemType.OBJECT_TYPE.value]
        prop_items = [i for i in actionable if i.item_type == BlueprintItemType.PROPERTY.value]
        lt_items = [i for i in actionable if i.item_type == BlueprintItemType.LINK_TYPE.value]

        results: list[ApplyItemResult] = []
        ot_rid_map: dict[str, str] = {}  # placeholderRid → real rid
        failed_placeholders: set[str] = set()

        # Import services here to avoid circular imports
        from app.services.link_type_service import LinkTypeService
        from app.services.object_type_service import ObjectTypeService
        from app.services.property_service import PropertyService

        ot_service = ObjectTypeService(self._session)
        prop_service = PropertyService(self._session)
        lt_service = LinkTypeService(self._session)

        # Phase 1: Object Types
        for item in ot_items:
            suggestion = item.user_edits or item.suggestion
            try:
                from app.domain.object_type import ObjectTypeCreateRequest

                created = await ot_service.create(
                    ObjectTypeCreateRequest(
                        display_name=suggestion.get("displayName", ""),
                        api_name=suggestion.get("apiName"),
                        id=suggestion.get("id"),
                        description=suggestion.get("description", ""),
                    )
                )
                placeholder = suggestion.get("placeholderRid", "")
                if placeholder:
                    ot_rid_map[placeholder] = created.rid
                await BlueprintItemStorage.update_created_entity_rid(
                    self._session, item.rid, created.rid
                )
                results.append(
                    ApplyItemResult(
                        item_rid=item.rid,
                        item_type=BlueprintItemType.OBJECT_TYPE,
                        status="success",
                        created_entity_rid=created.rid,
                    )
                )
            except Exception as e:
                placeholder = suggestion.get("placeholderRid", "")
                if placeholder:
                    failed_placeholders.add(placeholder)
                results.append(
                    ApplyItemResult(
                        item_rid=item.rid,
                        item_type=BlueprintItemType.OBJECT_TYPE,
                        status="failed",
                        error=str(e),
                    )
                )

        # Phase 2: Properties
        for item in prop_items:
            suggestion = item.user_edits or item.suggestion
            ot_placeholder = suggestion.get("objectTypePlaceholderRid", "")
            actual_ot_rid = ot_rid_map.get(ot_placeholder, suggestion.get("objectTypeRid"))

            if ot_placeholder and ot_placeholder in failed_placeholders:
                results.append(
                    ApplyItemResult(
                        item_rid=item.rid,
                        item_type=BlueprintItemType.PROPERTY,
                        status="skipped",
                        error="Parent object type creation failed",
                    )
                )
                continue

            if not actual_ot_rid:
                results.append(
                    ApplyItemResult(
                        item_rid=item.rid,
                        item_type=BlueprintItemType.PROPERTY,
                        status="skipped",
                        error="No object type RID available",
                    )
                )
                continue

            try:
                from app.domain.property import PropertyCreateRequest

                created = await prop_service.create(
                    actual_ot_rid,
                    PropertyCreateRequest(
                        display_name=suggestion.get("displayName", ""),
                        api_name=suggestion.get("apiName"),
                        base_type=suggestion.get("baseType", "string"),
                        description=suggestion.get("description"),
                    ),
                )
                await BlueprintItemStorage.update_created_entity_rid(
                    self._session, item.rid, created.rid
                )
                results.append(
                    ApplyItemResult(
                        item_rid=item.rid,
                        item_type=BlueprintItemType.PROPERTY,
                        status="success",
                        created_entity_rid=created.rid,
                    )
                )
            except Exception as e:
                results.append(
                    ApplyItemResult(
                        item_rid=item.rid,
                        item_type=BlueprintItemType.PROPERTY,
                        status="failed",
                        error=str(e),
                    )
                )

        # Phase 3: Link Types
        for item in lt_items:
            suggestion = item.user_edits or item.suggestion
            side_a_placeholder = suggestion.get("sideAPlaceholderRid", "")
            side_b_placeholder = suggestion.get("sideBPlaceholderRid", "")

            side_a_rid = ot_rid_map.get(side_a_placeholder, suggestion.get("sideAObjectTypeRid"))
            side_b_rid = ot_rid_map.get(side_b_placeholder, suggestion.get("sideBObjectTypeRid"))

            if (side_a_placeholder and side_a_placeholder in failed_placeholders) or (
                side_b_placeholder and side_b_placeholder in failed_placeholders
            ):
                results.append(
                    ApplyItemResult(
                        item_rid=item.rid,
                        item_type=BlueprintItemType.LINK_TYPE,
                        status="skipped",
                        error="Dependent object type creation failed",
                    )
                )
                continue

            if not side_a_rid or not side_b_rid:
                results.append(
                    ApplyItemResult(
                        item_rid=item.rid,
                        item_type=BlueprintItemType.LINK_TYPE,
                        status="skipped",
                        error="Missing side A or side B object type RID",
                    )
                )
                continue

            try:
                from app.domain.link_type import LinkTypeCreateRequest

                created = await lt_service.create(
                    LinkTypeCreateRequest(
                        display_name=suggestion.get("displayName", ""),
                        id=suggestion.get("id"),
                        description=suggestion.get("description", ""),
                        side_a_object_type_rid=side_a_rid,
                        side_b_object_type_rid=side_b_rid,
                        cardinality=suggestion.get("cardinality", "many-to-many"),
                    )
                )
                await BlueprintItemStorage.update_created_entity_rid(
                    self._session, item.rid, created.rid
                )
                results.append(
                    ApplyItemResult(
                        item_rid=item.rid,
                        item_type=BlueprintItemType.LINK_TYPE,
                        status="success",
                        created_entity_rid=created.rid,
                    )
                )
            except Exception as e:
                results.append(
                    ApplyItemResult(
                        item_rid=item.rid,
                        item_type=BlueprintItemType.LINK_TYPE,
                        status="failed",
                        error=str(e),
                    )
                )

        # Update blueprint status
        succeeded = sum(1 for r in results if r.status == "success")
        if succeeded > 0:
            await BlueprintStorage.update_status(self._session, rid, BlueprintStatus.APPLIED.value)

        return BlueprintApplyResult(
            blueprint_rid=rid,
            total=len(actionable),
            succeeded=succeeded,
            failed=sum(1 for r in results if r.status == "failed"),
            skipped=sum(1 for r in results if r.status == "skipped"),
            results=results,
        )

    # --- Private helpers ---

    async def _get_blueprint_or_404(self, rid: str) -> BlueprintModel:
        orm = await BlueprintStorage.get(self._session, rid)
        if orm is None:
            raise AppError(
                code="BLUEPRINT_NOT_FOUND",
                message=f"Blueprint '{rid}' not found",
                status_code=404,
            )
        return orm

    @staticmethod
    def _validate_item_fields(req: BlueprintItemCreate) -> None:
        if req.confidence < 0.0 or req.confidence > 1.0:
            raise AppError(
                code="BLUEPRINT_ITEM_INVALID_CONFIDENCE",
                message=f"Confidence must be between 0.0 and 1.0, got {req.confidence}",
                status_code=400,
            )
        if not req.source:
            raise AppError(
                code="BLUEPRINT_ITEM_MISSING_SOURCE",
                message="Source tag is required for blueprint items (INV-16)",
                status_code=400,
            )

    @staticmethod
    def _to_blueprint(orm: BlueprintModel) -> Blueprint:
        return Blueprint(
            rid=orm.rid,
            session_rid=orm.session_rid,
            ontology_rid=orm.ontology_rid,
            name=orm.name,
            status=orm.status,
            source_summary=orm.source_summary,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )

    @staticmethod
    def _to_item(orm: BlueprintItemModel) -> BlueprintItem:
        return BlueprintItem(
            rid=orm.rid,
            blueprint_rid=orm.blueprint_rid,
            item_type=orm.item_type,
            suggestion=orm.suggestion,
            confidence=orm.confidence,
            confidence_level=orm.confidence_level,
            reasoning=orm.reasoning,
            source=orm.source,
            user_decision=orm.user_decision,
            user_edits=orm.user_edits,
            rejection_reason=orm.rejection_reason,
            created_entity_rid=orm.created_entity_rid,
            sort_order=orm.sort_order,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
        )
