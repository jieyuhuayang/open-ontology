"""Tests for dataset CLI commands."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from typer.testing import CliRunner

from app.domain.dataset import DatasetListItem, DatasetListResponse
from app.domain.import_task import ImportTask, ImportTaskStatus
from cli.main import app

runner = CliRunner()

_SAMPLE_DATASET_ITEM = DatasetListItem(
    rid="ri.ontology.dataset.abc123",
    name="orders",
    mode="snapshot",
    source_type="csv",
    row_count=100,
    column_count=5,
    imported_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    in_use=False,
    linked_object_type_name=None,
)

_SAMPLE_IMPORT_TASK = ImportTask(
    task_id="task-001",
    status=ImportTaskStatus.PENDING,
    created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
)

_MOD = "cli.commands.dataset"


@patch(f"{_MOD}._do_list", new_callable=AsyncMock)
def test_list(mock_do: AsyncMock) -> None:
    mock_do.return_value = DatasetListResponse(items=[_SAMPLE_DATASET_ITEM], total=1)
    result = runner.invoke(app, ["dataset", "list"])
    assert result.exit_code == 0
    assert "orders" in result.output
    assert "ri.ontology.datas" in result.output  # Rich table may truncate long RIDs


@patch(f"{_MOD}._do_import_csv", new_callable=AsyncMock)
def test_import_csv(mock_do: AsyncMock, tmp_path) -> None:
    mock_do.return_value = _SAMPLE_IMPORT_TASK
    csv_file = tmp_path / "data.csv"
    csv_file.write_text("a,b\n1,2\n")
    result = runner.invoke(app, ["dataset", "import-csv", str(csv_file), "--name", "mydata"])
    assert result.exit_code == 0
    assert "Imported dataset" in result.output
    assert "mydata" in result.output
    mock_do.assert_awaited_once()


@patch(f"{_MOD}._do_import_excel", new_callable=AsyncMock)
def test_import_excel(mock_do: AsyncMock, tmp_path) -> None:
    mock_do.return_value = _SAMPLE_IMPORT_TASK
    xlsx_file = tmp_path / "data.xlsx"
    xlsx_file.write_bytes(b"\x00" * 10)  # dummy content; _do_import_excel is mocked
    result = runner.invoke(
        app, ["dataset", "import-excel", str(xlsx_file), "--sheet", "Sheet1", "--name", "myexcel"]
    )
    assert result.exit_code == 0
    assert "Imported dataset" in result.output
    assert "myexcel" in result.output
    mock_do.assert_awaited_once()
    # Verify --sheet was passed through
    call_args = mock_do.call_args
    assert call_args[0][2] == "Sheet1" or call_args.kwargs.get("sheet") == "Sheet1"


def test_import_file_not_found() -> None:
    result = runner.invoke(app, ["dataset", "import-csv", "/nonexistent/path/data.csv"])
    assert result.exit_code == 1
    assert "File not found" in result.output


def test_import_file_too_large(tmp_path) -> None:
    big_file = tmp_path / "big.csv"
    big_file.write_bytes(b"\x00" * 10)  # small file, but we mock os.path.getsize

    with patch(f"{_MOD}.os.path.getsize", return_value=51 * 1024 * 1024):
        with patch(f"{_MOD}.os.path.exists", return_value=True):
            result = runner.invoke(app, ["dataset", "import-csv", str(big_file)])
    assert result.exit_code == 1
    assert "exceeds maximum size" in result.output
