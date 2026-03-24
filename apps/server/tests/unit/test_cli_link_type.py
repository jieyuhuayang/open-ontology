"""Tests for link-type CLI commands."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from typer.testing import CliRunner

from app.domain.link_type import (
    Cardinality,
    LinkSide,
    LinkTypeListResponse,
    LinkTypeWithChangeState,
)
from app.domain.object_type import ResourceStatus, Visibility
from app.domain.working_state import ChangeState
from cli.main import app

runner = CliRunner()

_SIDE_A = LinkSide(
    object_type_rid="ri.ontology.object-type.aaa",
    display_name="Order",
    api_name="order",
    visibility=Visibility.NORMAL,
)

_SIDE_B = LinkSide(
    object_type_rid="ri.ontology.object-type.bbb",
    display_name="Customer",
    api_name="customer",
    visibility=Visibility.NORMAL,
)

_SAMPLE_LT = LinkTypeWithChangeState(
    rid="ri.ontology.link-type.lt1",
    id="order-to-customer",
    side_a=_SIDE_A,
    side_b=_SIDE_B,
    cardinality=Cardinality.ONE_TO_MANY,
    status=ResourceStatus.EXPERIMENTAL,
    project_rid="ri.ontology.project.default",
    ontology_rid="ri.ontology.ontology.default",
    created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    created_by="system",
    last_modified_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    last_modified_by="system",
    change_state=ChangeState.CREATED,
)

_MOD = "cli.commands.link_type"


@patch(f"{_MOD}._do_create", new_callable=AsyncMock, return_value=_SAMPLE_LT)
def test_create(mock_do: AsyncMock) -> None:
    result = runner.invoke(
        app,
        [
            "link-type",
            "create",
            "--id",
            "order-to-customer",
            "--side-a-object",
            "ri.ontology.object-type.aaa",
            "--side-a-name",
            "Order",
            "--side-a-api-name",
            "order",
            "--side-b-object",
            "ri.ontology.object-type.bbb",
            "--side-b-name",
            "Customer",
            "--side-b-api-name",
            "customer",
            "--cardinality",
            "one-to-many",
        ],
    )
    assert result.exit_code == 0, result.output
    assert "Created link type" in result.output
    assert "ri.ontology.link-type.lt1" in result.output


@patch(f"{_MOD}._do_create", new_callable=AsyncMock)
def test_create_m2m_with_join_table(mock_do: AsyncMock) -> None:
    m2m = _SAMPLE_LT.model_copy(update={"cardinality": Cardinality.MANY_TO_MANY})
    mock_do.return_value = m2m
    result = runner.invoke(
        app,
        [
            "link-type",
            "create",
            "--id",
            "order-to-customer",
            "--side-a-object",
            "ri.ontology.object-type.aaa",
            "--side-a-name",
            "Order",
            "--side-a-api-name",
            "order",
            "--side-b-object",
            "ri.ontology.object-type.bbb",
            "--side-b-name",
            "Customer",
            "--side-b-api-name",
            "customer",
            "--cardinality",
            "many-to-many",
            "--join-table-dataset",
            "ri.ontology.dataset.join1",
        ],
    )
    assert result.exit_code == 0, result.output
    assert "Created link type" in result.output
    assert "many-to-many" in result.output


@patch(f"{_MOD}._do_list", new_callable=AsyncMock)
def test_list(mock_do: AsyncMock) -> None:
    mock_do.return_value = LinkTypeListResponse(items=[_SAMPLE_LT], total=1, page=1, page_size=20)
    result = runner.invoke(app, ["link-type", "list"])
    assert result.exit_code == 0, result.output
    assert "order-to" in result.output
    assert "Order" in result.output
    assert "Customer" in result.output


@patch(f"{_MOD}._do_get", new_callable=AsyncMock, return_value=_SAMPLE_LT)
def test_get(mock_do: AsyncMock) -> None:
    result = runner.invoke(app, ["link-type", "get", "ri.ontology.link-type.lt1"])
    assert result.exit_code == 0, result.output
    assert "ri.ontology.link-type.lt1" in result.output
    assert "Order" in result.output
    assert "Customer" in result.output
    assert "one-to-many" in result.output


@patch(f"{_MOD}._do_update", new_callable=AsyncMock, return_value=_SAMPLE_LT)
def test_update(mock_do: AsyncMock) -> None:
    result = runner.invoke(
        app,
        [
            "link-type",
            "update",
            "ri.ontology.link-type.lt1",
            "--side-a-name",
            "NewName",
        ],
    )
    assert result.exit_code == 0, result.output
    assert "Updated" in result.output


@patch(f"{_MOD}._do_delete", new_callable=AsyncMock, return_value=None)
def test_delete(mock_do: AsyncMock) -> None:
    result = runner.invoke(app, ["link-type", "delete", "ri.ontology.link-type.lt1"])
    assert result.exit_code == 0, result.output
    assert "Deleted" in result.output
