"""Tests for search CLI command."""

from unittest.mock import AsyncMock, patch

from typer.testing import CliRunner

from app.domain.object_type import ResourceStatus, Visibility
from app.domain.search import (
    SearchResourceType,
    SearchResponse,
    SearchResultItem,
    SearchTypeResult,
)
from app.domain.working_state import ChangeState
from cli.main import app

runner = CliRunner()

_MOD = "cli.commands.search"

_SAMPLE_ITEM = SearchResultItem(
    rid="ri.ontology.object-type.abc123",
    resource_type=SearchResourceType.OBJECT_TYPE,
    display_name="Order",
    description="A test order",
    status=ResourceStatus.EXPERIMENTAL,
    visibility=Visibility.NORMAL,
    change_state=ChangeState.PUBLISHED,
    matched_fields=["name"],
)


@patch(f"{_MOD}._do_search", new_callable=AsyncMock)
def test_search(mock_do: AsyncMock) -> None:
    mock_do.return_value = SearchResponse(
        query="Order",
        results={
            "objectTypes": SearchTypeResult(items=[_SAMPLE_ITEM], total=1),
        },
        total_count=1,
    )
    result = runner.invoke(app, ["search", "Order"])
    assert result.exit_code == 0
    assert "Order" in result.output
    assert "Found 1 result(s)." in result.output


@patch(f"{_MOD}._do_search", new_callable=AsyncMock)
def test_search_with_type(mock_do: AsyncMock) -> None:
    mock_do.return_value = SearchResponse(
        query="Order",
        results={
            "objectTypes": SearchTypeResult(items=[_SAMPLE_ITEM], total=1),
        },
        total_count=1,
    )
    result = runner.invoke(app, ["search", "Order", "--type", "objectType"])
    assert result.exit_code == 0
    assert "Order" in result.output
    # Verify the mock was called with correct type filter
    call_args = mock_do.call_args
    assert call_args[0][2] == ["objectType"]  # types argument


@patch(f"{_MOD}._do_search", new_callable=AsyncMock)
def test_search_no_results(mock_do: AsyncMock) -> None:
    mock_do.return_value = SearchResponse(
        query="nonexistent",
        results={},
        total_count=0,
    )
    result = runner.invoke(app, ["search", "nonexistent"])
    assert result.exit_code == 0
    assert "No results found." in result.output
