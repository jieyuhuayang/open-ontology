"""Unit tests for Phase 2 domain models (T006)."""

from datetime import datetime, timezone

import pytest


class TestDatasetModels:
    def test_dataset_serialization(self):
        from app.domain.dataset import Dataset

        now = datetime.now(timezone.utc)
        ds = Dataset(
            rid="ri.ontology.dataset.abc123",
            name="orders",
            source_type="mysql",
            source_metadata={"table": "orders"},
            row_count=100,
            column_count=5,
            imported_at=now,
            ontology_rid="ri.ontology.ontology.default",
            created_by="default",
        )
        data = ds.model_dump(by_alias=True)
        assert data["rid"] == "ri.ontology.dataset.abc123"
        assert data["sourceType"] == "mysql"
        assert data["rowCount"] == 100

    def test_dataset_default_status(self):
        from app.domain.dataset import Dataset

        now = datetime.now(timezone.utc)
        ds = Dataset(
            rid="ri.ontology.dataset.abc123",
            name="test",
            source_type="csv",
            source_metadata={},
            imported_at=now,
            ontology_rid="ri.ontology.ontology.default",
            created_by="default",
        )
        assert ds.status == "ready"

    def test_dataset_column_serialization(self):
        from app.domain.dataset import DatasetColumn

        col = DatasetColumn(name="id", inferred_type="integer", is_primary_key=True)
        data = col.model_dump(by_alias=True)
        assert data["inferredType"] == "integer"
        assert data["isPrimaryKey"] is True
        assert data["isNullable"] is True  # default

    def test_dataset_list_item(self):
        from app.domain.dataset import DatasetListItem

        now = datetime.now(timezone.utc)
        item = DatasetListItem(
            rid="ri.ontology.dataset.abc123",
            name="orders",
            source_type="mysql",
            row_count=100,
            column_count=5,
            imported_at=now,
        )
        assert item.in_use is False
        assert item.linked_object_type_name is None


class TestMySQLConnectionModels:
    def test_connection_response_excludes_password(self):
        from app.domain.mysql_connection import MySQLConnection

        now = datetime.now(timezone.utc)
        conn = MySQLConnection(
            rid="ri.ontology.mysql-connection.def456",
            name="Prod DB",
            host="db.example.com",
            port=3306,
            database_name="sales",
            username="reader",
            ssl_enabled=False,
            ontology_rid="ri.ontology.ontology.default",
            created_at=now,
            created_by="default",
        )
        data = conn.model_dump(by_alias=True)
        assert "encryptedPassword" not in data
        assert "password" not in data
        assert data["databaseName"] == "sales"

    def test_create_request_has_password(self):
        from app.domain.mysql_connection import MySQLConnectionCreateRequest

        req = MySQLConnectionCreateRequest(
            name="Test",
            host="localhost",
            database_name="test",
            username="root",
            password="secret",
        )
        assert req.password == "secret"
        assert req.port == 3306  # default

    def test_test_request_optional_connection_rid(self):
        from app.domain.mysql_connection import MySQLConnectionTestRequest

        req = MySQLConnectionTestRequest(
            host="localhost",
            database_name="test",
            username="root",
            password="secret",
        )
        assert req.connection_rid is None


class TestImportTaskModel:
    def test_status_enum_values(self):
        from app.domain.import_task import ImportTaskStatus

        assert ImportTaskStatus.PENDING.value == "pending"
        assert ImportTaskStatus.RUNNING.value == "running"
        assert ImportTaskStatus.COMPLETED.value == "completed"
        assert ImportTaskStatus.FAILED.value == "failed"

    def test_import_task_defaults(self):
        from app.domain.import_task import ImportTask, ImportTaskStatus

        now = datetime.now(timezone.utc)
        task = ImportTask(task_id="task-001", created_at=now)
        assert task.status == ImportTaskStatus.PENDING
        assert task.dataset_rid is None
        assert task.row_count is None
        assert task.error_code is None

    def test_import_task_serialization(self):
        from app.domain.import_task import ImportTask, ImportTaskStatus

        now = datetime.now(timezone.utc)
        task = ImportTask(
            task_id="task-001",
            status=ImportTaskStatus.COMPLETED,
            dataset_rid="ri.ontology.dataset.abc123",
            row_count=100,
            column_count=5,
            duration_ms=1500,
            created_at=now,
        )
        data = task.model_dump(by_alias=True)
        assert data["taskId"] == "task-001"
        assert data["status"] == "completed"
        assert data["datasetRid"] == "ri.ontology.dataset.abc123"


class TestValidateIntendedActions:
    def test_valid_actions(self):
        from app.domain.validators import validate_intended_actions

        validate_intended_actions(["create"])
        validate_intended_actions(["modify", "delete"])
        validate_intended_actions(["create", "modify", "delete"])

    def test_empty_list_is_valid(self):
        from app.domain.validators import validate_intended_actions

        validate_intended_actions([])

    def test_none_is_valid(self):
        from app.domain.validators import validate_intended_actions

        validate_intended_actions(None)

    def test_invalid_action_raises(self):
        from app.domain.validators import validate_intended_actions
        from app.exceptions import AppError

        with pytest.raises(AppError) as exc_info:
            validate_intended_actions(["create", "invalid"])
        assert exc_info.value.code == "INVALID_INTENDED_ACTION"

    def test_duplicate_actions_raises(self):
        from app.domain.validators import validate_intended_actions
        from app.exceptions import AppError

        with pytest.raises(AppError) as exc_info:
            validate_intended_actions(["create", "create"])
        assert exc_info.value.code == "INVALID_INTENDED_ACTION"
