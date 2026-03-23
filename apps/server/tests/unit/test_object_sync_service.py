"""Unit tests for ObjectSyncService (T003)."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.domain.object_instance import ObjectInstance, SyncJob
from app.services.object_sync_service import ObjectSyncService


@pytest.fixture
def mock_session():
    return AsyncMock()


@pytest.fixture
def sync_service(mock_session):
    return ObjectSyncService(mock_session)


class TestComputeHash:
    """Test _compute_hash determinism and order-independence."""

    def test_compute_hash_deterministic(self):
        """Same properties produce same hash."""
        props = {"name": "Alice", "age": 30}
        h1 = ObjectSyncService._compute_hash(props)
        h2 = ObjectSyncService._compute_hash(props)
        assert h1 == h2
        assert len(h1) == 64  # SHA-256 hex digest

    def test_compute_hash_order_independent(self):
        """Key order does not affect hash."""
        h1 = ObjectSyncService._compute_hash({"a": 1, "b": 2})
        h2 = ObjectSyncService._compute_hash({"b": 2, "a": 1})
        assert h1 == h2

    def test_compute_hash_different_values(self):
        """Different values produce different hashes."""
        h1 = ObjectSyncService._compute_hash({"name": "Alice"})
        h2 = ObjectSyncService._compute_hash({"name": "Bob"})
        assert h1 != h2


class TestSyncIncremental:
    """Test incremental sync diff logic (AC-02 ~ AC-05)."""

    @pytest.mark.asyncio
    async def test_sync_incremental_first_time(self, sync_service, mock_session):
        """AC-02: First sync inserts all rows."""
        with (
            patch(
                "app.services.object_sync_service.ObjectInstanceStorage.get_pk_hash_map",
                new_callable=AsyncMock,
                return_value={},  # no existing instances
            ),
            patch(
                "app.services.object_sync_service.ObjectInstanceStorage.bulk_insert",
                new_callable=AsyncMock,
            ) as mock_insert,
            patch(
                "app.services.object_sync_service.ObjectInstanceStorage.bulk_delete_by_rids",
                new_callable=AsyncMock,
            ),
            patch(
                "app.services.object_sync_service.ObjectInstanceStorage.bulk_update",
                new_callable=AsyncMock,
            ),
        ):
            mapped_rows = [
                {
                    "properties": {"id": "1", "name": "Alice"},
                    "primary_key_value": "1",
                    "title_value": "Alice",
                    "data_hash": "hash1",
                    "row_index": 0,
                },
                {
                    "properties": {"id": "2", "name": "Bob"},
                    "primary_key_value": "2",
                    "title_value": "Bob",
                    "data_hash": "hash2",
                    "row_index": 1,
                },
            ]
            stats = await sync_service._sync_incremental("ot1", "ds1", mapped_rows)

        assert stats["inserted"] == 2
        assert stats["updated"] == 0
        assert stats["deleted"] == 0
        assert stats["unchanged"] == 0
        mock_insert.assert_called_once()
        assert len(mock_insert.call_args[0][1]) == 2

    @pytest.mark.asyncio
    async def test_sync_incremental_new_rows(self, sync_service, mock_session):
        """AC-03: New rows are inserted, existing unchanged."""
        with (
            patch(
                "app.services.object_sync_service.ObjectInstanceStorage.get_pk_hash_map",
                new_callable=AsyncMock,
                return_value={"1": ("rid-1", "hash1")},
            ),
            patch(
                "app.services.object_sync_service.ObjectInstanceStorage.bulk_insert",
                new_callable=AsyncMock,
            ) as mock_insert,
            patch(
                "app.services.object_sync_service.ObjectInstanceStorage.bulk_delete_by_rids",
                new_callable=AsyncMock,
            ),
            patch(
                "app.services.object_sync_service.ObjectInstanceStorage.bulk_update",
                new_callable=AsyncMock,
            ),
        ):
            mapped_rows = [
                {
                    "properties": {"id": "1"},
                    "primary_key_value": "1",
                    "title_value": None,
                    "data_hash": "hash1",
                    "row_index": 0,
                },
                {
                    "properties": {"id": "2"},
                    "primary_key_value": "2",
                    "title_value": None,
                    "data_hash": "hash2",
                    "row_index": 1,
                },
            ]
            stats = await sync_service._sync_incremental("ot1", "ds1", mapped_rows)

        assert stats["inserted"] == 1
        assert stats["unchanged"] == 1
        assert stats["deleted"] == 0
        assert stats["updated"] == 0

    @pytest.mark.asyncio
    async def test_sync_incremental_modified_rows(self, sync_service, mock_session):
        """AC-04: Modified rows (hash changed) are updated."""
        with (
            patch(
                "app.services.object_sync_service.ObjectInstanceStorage.get_pk_hash_map",
                new_callable=AsyncMock,
                return_value={"1": ("rid-1", "old-hash")},
            ),
            patch(
                "app.services.object_sync_service.ObjectInstanceStorage.bulk_insert",
                new_callable=AsyncMock,
            ),
            patch(
                "app.services.object_sync_service.ObjectInstanceStorage.bulk_delete_by_rids",
                new_callable=AsyncMock,
            ),
            patch(
                "app.services.object_sync_service.ObjectInstanceStorage.bulk_update",
                new_callable=AsyncMock,
            ) as mock_update,
        ):
            mapped_rows = [
                {
                    "properties": {"id": "1", "name": "Updated"},
                    "primary_key_value": "1",
                    "title_value": None,
                    "data_hash": "new-hash",
                    "row_index": 0,
                },
            ]
            stats = await sync_service._sync_incremental("ot1", "ds1", mapped_rows)

        assert stats["updated"] == 1
        assert stats["unchanged"] == 0
        mock_update.assert_called_once()

    @pytest.mark.asyncio
    async def test_sync_incremental_deleted_rows(self, sync_service, mock_session):
        """AC-05: Rows missing from source are deleted."""
        with (
            patch(
                "app.services.object_sync_service.ObjectInstanceStorage.get_pk_hash_map",
                new_callable=AsyncMock,
                return_value={"1": ("rid-1", "hash1"), "2": ("rid-2", "hash2")},
            ),
            patch(
                "app.services.object_sync_service.ObjectInstanceStorage.bulk_insert",
                new_callable=AsyncMock,
            ),
            patch(
                "app.services.object_sync_service.ObjectInstanceStorage.bulk_delete_by_rids",
                new_callable=AsyncMock,
            ) as mock_delete,
            patch(
                "app.services.object_sync_service.ObjectInstanceStorage.bulk_update",
                new_callable=AsyncMock,
            ),
        ):
            mapped_rows = [
                {
                    "properties": {"id": "1"},
                    "primary_key_value": "1",
                    "title_value": None,
                    "data_hash": "hash1",
                    "row_index": 0,
                },
            ]
            stats = await sync_service._sync_incremental("ot1", "ds1", mapped_rows)

        assert stats["deleted"] == 1
        assert stats["unchanged"] == 1
        mock_delete.assert_called_once()
        assert "rid-2" in mock_delete.call_args[0][1]


class TestSyncFullReplace:
    """Test full replace logic (AC-06)."""

    @pytest.mark.asyncio
    async def test_sync_full_replace_no_primary_key(self, sync_service, mock_session):
        """AC-06: Without primary key, delete all + insert all."""
        with (
            patch(
                "app.services.object_sync_service.ObjectInstanceStorage.delete_by_object_type",
                new_callable=AsyncMock,
                return_value=3,
            ) as mock_delete_all,
            patch(
                "app.services.object_sync_service.ObjectInstanceStorage.bulk_insert",
                new_callable=AsyncMock,
            ) as mock_insert,
        ):
            mapped_rows = [
                {
                    "properties": {"a": 1},
                    "primary_key_value": None,
                    "title_value": None,
                    "data_hash": "h1",
                    "row_index": 0,
                },
                {
                    "properties": {"a": 2},
                    "primary_key_value": None,
                    "title_value": None,
                    "data_hash": "h2",
                    "row_index": 1,
                },
            ]
            stats = await sync_service._sync_full_replace("ot1", "ds1", mapped_rows)

        assert stats["deleted"] == 3
        assert stats["inserted"] == 2
        assert stats["updated"] == 0
        assert stats["unchanged"] == 0
        mock_delete_all.assert_called_once()
        mock_insert.assert_called_once()


class TestSyncFailure:
    """Test sync failure handling (AC-07)."""

    @pytest.mark.asyncio
    async def test_sync_failure_records_error(self, sync_service, mock_session):
        """AC-07: Exception → SyncJob marked failed."""
        with (
            patch(
                "app.services.object_sync_service.SyncJobStorage.create",
                new_callable=AsyncMock,
            ),
            patch(
                "app.services.object_sync_service.SyncJobStorage.update_status",
                new_callable=AsyncMock,
            ) as mock_update,
            patch(
                "app.services.object_sync_service.DatasetStorage.get_by_rid",
                new_callable=AsyncMock,
                side_effect=ValueError("Connection refused"),
            ),
        ):
            job = await sync_service.sync(
                "ot1",
                "ds1",
                triggered_by="manual",
                has_primary_key=True,
                primary_key_property_api_name="id",
            )

        assert job.status == "failed"
        assert "Connection refused" in (job.error_message or "")
        mock_update.assert_called_once()
        assert mock_update.call_args[1]["status"] == "failed"
