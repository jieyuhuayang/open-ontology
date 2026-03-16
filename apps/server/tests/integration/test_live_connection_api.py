"""Integration tests for Live Connection API (T006)."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.domain.mysql_connection import MySQLColumnInfo


def _mock_columns():
    """Return mock column metadata as if from external MySQL."""
    return [
        MySQLColumnInfo(
            name="id",
            data_type="int",
            is_nullable=False,
            is_primary_key=True,
            inferred_property_type="integer",
        ),
        MySQLColumnInfo(
            name="customer_name",
            data_type="varchar",
            is_nullable=True,
            is_primary_key=False,
            inferred_property_type="string",
        ),
        MySQLColumnInfo(
            name="total",
            data_type="decimal",
            is_nullable=True,
            is_primary_key=False,
            inferred_property_type="double",
        ),
    ]


async def _create_connection(client: AsyncClient) -> str:
    """Helper: create a MySQL connection and return its RID."""
    resp = await client.post(
        "/api/v1/mysql-connections",
        json={
            "name": "Live Test DB",
            "host": "localhost",
            "port": 3306,
            "databaseName": "testdb",
            "username": "root",
            "password": "secret123",
        },
    )
    assert resp.status_code == 201
    return resp.json()["rid"]


@pytest.mark.asyncio
class TestLiveConnectionAPI:
    async def test_register_live_dataset(self, seeded_client: AsyncClient):
        """POST /datasets/register/live → 201 with mode=live (AC-LC06)."""
        conn_rid = await _create_connection(seeded_client)

        with (
            patch(
                "app.services.mysql_import_service.MySQLImportService._validate_table_exists",
                new_callable=AsyncMock,
            ),
            patch(
                "app.services.mysql_import_service.MySQLImportService.get_table_columns",
                new_callable=AsyncMock,
                return_value=_mock_columns(),
            ),
            patch(
                "app.services.mysql_import_service.MySQLConnectionStorage.update_last_used",
                new_callable=AsyncMock,
            ),
        ):
            resp = await seeded_client.post(
                "/api/v1/datasets/register/live",
                json={
                    "connectionRid": conn_rid,
                    "tableName": "orders",
                    "datasetName": "Orders Live",
                    "selectedColumns": ["id", "customer_name"],
                },
            )
        assert resp.status_code == 201
        data = resp.json()
        assert data["mode"] == "live"
        assert data["name"] == "Orders Live"
        assert data["sourceTable"] == "orders"
        assert data["connectionRid"] == conn_rid
        assert data["status"] == "ready"
        assert data["columnCount"] >= 2

    async def test_register_live_dataset_connection_not_found(self, seeded_client: AsyncClient):
        """POST /datasets/register/live with nonexistent connection → 404."""
        resp = await seeded_client.post(
            "/api/v1/datasets/register/live",
            json={
                "connectionRid": "ri.ontology.mysql-connection.nonexistent",
                "tableName": "orders",
                "datasetName": "Orders Live",
                "selectedColumns": ["id"],
            },
        )
        assert resp.status_code == 404

    async def test_live_dataset_in_list(self, seeded_client: AsyncClient):
        """GET /datasets includes Live Dataset with mode=live (AC-DM01)."""
        conn_rid = await _create_connection(seeded_client)

        with (
            patch(
                "app.services.mysql_import_service.MySQLImportService._validate_table_exists",
                new_callable=AsyncMock,
            ),
            patch(
                "app.services.mysql_import_service.MySQLImportService.get_table_columns",
                new_callable=AsyncMock,
                return_value=_mock_columns(),
            ),
            patch(
                "app.services.mysql_import_service.MySQLConnectionStorage.update_last_used",
                new_callable=AsyncMock,
            ),
        ):
            resp = await seeded_client.post(
                "/api/v1/datasets/register/live",
                json={
                    "connectionRid": conn_rid,
                    "tableName": "orders",
                    "datasetName": "Orders Live List",
                    "selectedColumns": ["id"],
                },
            )
            assert resp.status_code == 201

        # List datasets and verify Live Dataset appears
        resp = await seeded_client.get("/api/v1/datasets")
        assert resp.status_code == 200
        items = resp.json()["items"]
        live_items = [i for i in items if i["mode"] == "live"]
        assert len(live_items) >= 1
        assert live_items[0]["name"] == "Orders Live List"

    async def test_delete_live_dataset(self, seeded_client: AsyncClient):
        """DELETE Live Dataset → 204 (AC-DM07)."""
        conn_rid = await _create_connection(seeded_client)

        with (
            patch(
                "app.services.mysql_import_service.MySQLImportService._validate_table_exists",
                new_callable=AsyncMock,
            ),
            patch(
                "app.services.mysql_import_service.MySQLImportService.get_table_columns",
                new_callable=AsyncMock,
                return_value=_mock_columns(),
            ),
            patch(
                "app.services.mysql_import_service.MySQLConnectionStorage.update_last_used",
                new_callable=AsyncMock,
            ),
        ):
            resp = await seeded_client.post(
                "/api/v1/datasets/register/live",
                json={
                    "connectionRid": conn_rid,
                    "tableName": "orders",
                    "datasetName": "Delete Me Live",
                    "selectedColumns": ["id"],
                },
            )
            ds_rid = resp.json()["rid"]

        # Delete the Live Dataset
        resp = await seeded_client.delete(f"/api/v1/datasets/{ds_rid}")
        assert resp.status_code == 204

        # Verify it's gone
        resp = await seeded_client.get(f"/api/v1/datasets/{ds_rid}")
        assert resp.status_code == 404

    async def test_delete_connection_cascades_disconnected(self, seeded_client: AsyncClient):
        """DELETE connection → Live Datasets marked disconnected (AC-CM06)."""
        conn_rid = await _create_connection(seeded_client)

        with (
            patch(
                "app.services.mysql_import_service.MySQLImportService._validate_table_exists",
                new_callable=AsyncMock,
            ),
            patch(
                "app.services.mysql_import_service.MySQLImportService.get_table_columns",
                new_callable=AsyncMock,
                return_value=_mock_columns(),
            ),
            patch(
                "app.services.mysql_import_service.MySQLConnectionStorage.update_last_used",
                new_callable=AsyncMock,
            ),
        ):
            resp = await seeded_client.post(
                "/api/v1/datasets/register/live",
                json={
                    "connectionRid": conn_rid,
                    "tableName": "orders",
                    "datasetName": "Cascade Test",
                    "selectedColumns": ["id"],
                },
            )
            ds_rid = resp.json()["rid"]

        # Delete the connection — should cascade
        resp = await seeded_client.delete(f"/api/v1/mysql-connections/{conn_rid}")
        assert resp.status_code == 204

        # Verify Live Dataset is now disconnected
        resp = await seeded_client.get(f"/api/v1/datasets/{ds_rid}")
        assert resp.status_code == 200
        assert resp.json()["status"] == "disconnected"
