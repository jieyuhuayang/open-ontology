"""Unit tests for MySQL Connections Router (T030)."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.domain.mysql_connection import (
    MySQLColumnInfo,
    MySQLConnection,
    MySQLTableInfo,
    MySQLTablePreview,
)
from app.exceptions import AppError


@pytest.fixture
def mock_mysql_service():
    return AsyncMock()


@pytest.fixture
async def client(mock_mysql_service):
    from app.database import get_db_session
    from app.main import app

    async def _mock_session():
        yield AsyncMock()

    app.dependency_overrides[get_db_session] = _mock_session

    with patch(
        "app.routers.mysql_connections.MySQLImportService",
        return_value=mock_mysql_service,
    ):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac
    app.dependency_overrides.clear()


_NOW = datetime.now(timezone.utc)


class TestListConnections:
    async def test_list_returns_connections(self, client, mock_mysql_service):
        mock_mysql_service.list_connections.return_value = [
            MySQLConnection(
                rid="ri.ontology.mysql-connection.c1",
                name="Production DB",
                host="localhost",
                port=3306,
                database_name="mydb",
                username="user",
                ssl_enabled=False,
                ontology_rid="ri.ontology.ontology.default",
                created_at=_NOW,
                created_by="default",
            ),
        ]
        resp = await client.get("/api/v1/mysql-connections")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "Production DB"
        # Password should NOT be in response
        assert "password" not in data[0]
        assert "encryptedPassword" not in data[0]


class TestSaveConnection:
    async def test_save_returns_201(self, client, mock_mysql_service):
        mock_mysql_service.save_connection.return_value = MySQLConnection(
            rid="ri.ontology.mysql-connection.c1",
            name="New DB",
            host="db.example.com",
            port=3306,
            database_name="testdb",
            username="admin",
            ssl_enabled=True,
            ontology_rid="ri.ontology.ontology.default",
            created_at=_NOW,
            created_by="default",
        )
        resp = await client.post(
            "/api/v1/mysql-connections",
            json={
                "name": "New DB",
                "host": "db.example.com",
                "port": 3306,
                "databaseName": "testdb",
                "username": "admin",
                "password": "secret",
                "sslEnabled": True,
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "New DB"


class TestTestConnection:
    async def test_success(self, client, mock_mysql_service):
        mock_mysql_service.test_connection.return_value = {"success": True}
        resp = await client.post(
            "/api/v1/mysql-connections/test",
            json={
                "host": "localhost",
                "port": 3306,
                "databaseName": "mydb",
                "username": "root",
                "password": "pass",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    async def test_failure_returns_422(self, client, mock_mysql_service):
        mock_mysql_service.test_connection.side_effect = AppError(
            code="MYSQL_CONNECTION_FAILED",
            message="Connection refused",
            status_code=422,
        )
        resp = await client.post(
            "/api/v1/mysql-connections/test",
            json={
                "host": "bad-host",
                "port": 3306,
                "databaseName": "mydb",
                "username": "root",
                "password": "pass",
            },
        )
        assert resp.status_code == 422


class TestBrowseTables:
    async def test_returns_tables(self, client, mock_mysql_service):
        mock_mysql_service.browse_tables.return_value = [
            MySQLTableInfo(name="users", row_count=1000),
            MySQLTableInfo(name="orders", row_count=5000),
        ]
        resp = await client.get("/api/v1/mysql-connections/ri.ontology.mysql-connection.c1/tables")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0]["name"] == "users"

    async def test_connection_not_found(self, client, mock_mysql_service):
        mock_mysql_service.browse_tables.side_effect = AppError(
            code="MYSQL_CONNECTION_NOT_FOUND",
            message="Connection not found",
            status_code=404,
        )
        resp = await client.get(
            "/api/v1/mysql-connections/ri.ontology.mysql-connection.missing/tables"
        )
        assert resp.status_code == 404


class TestGetTableColumns:
    async def test_returns_columns(self, client, mock_mysql_service):
        mock_mysql_service.get_table_columns.return_value = [
            MySQLColumnInfo(
                name="id",
                data_type="int",
                is_nullable=False,
                is_primary_key=True,
                inferred_property_type="integer",
            ),
            MySQLColumnInfo(
                name="name",
                data_type="varchar(255)",
                is_nullable=True,
                is_primary_key=False,
                inferred_property_type="string",
            ),
        ]
        resp = await client.get(
            "/api/v1/mysql-connections/ri.ontology.mysql-connection.c1/tables/users/columns"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0]["inferredPropertyType"] == "integer"


class TestPreviewTable:
    async def test_returns_preview(self, client, mock_mysql_service):
        mock_mysql_service.preview_table.return_value = MySQLTablePreview(
            columns=[
                MySQLColumnInfo(
                    name="id",
                    data_type="int",
                    is_nullable=False,
                    is_primary_key=True,
                    inferred_property_type="integer",
                ),
            ],
            rows=[{"id": 1}, {"id": 2}],
            total_rows=100,
        )
        resp = await client.get(
            "/api/v1/mysql-connections/ri.ontology.mysql-connection.c1/tables/users/preview"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["rows"]) == 2
        assert data["totalRows"] == 100
