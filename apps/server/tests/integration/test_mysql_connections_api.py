"""Integration tests for MySQL Connections API (T038)."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestMySQLConnectionsAPI:
    async def test_save_and_list_connection(self, seeded_client: AsyncClient):
        """Save a connection and verify it appears in list."""
        resp = await seeded_client.post(
            "/api/v1/mysql-connections",
            json={
                "name": "Test DB",
                "host": "localhost",
                "port": 3306,
                "databaseName": "testdb",
                "username": "root",
                "password": "secret123",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Test DB"
        assert data["host"] == "localhost"
        # Password should NOT be in response
        assert "password" not in data
        assert "encryptedPassword" not in data

        connection_rid = data["rid"]

        # List connections
        resp = await seeded_client.get("/api/v1/mysql-connections")
        assert resp.status_code == 200
        connections = resp.json()
        assert len(connections) == 1
        assert connections[0]["rid"] == connection_rid

    async def test_test_connection_failure_returns_200_with_success_false(
        self, seeded_client: AsyncClient
    ):
        """Testing a bad connection returns 200 with success=false."""
        resp = await seeded_client.post(
            "/api/v1/mysql-connections/test",
            json={
                "host": "nonexistent-host",
                "port": 3306,
                "databaseName": "testdb",
                "username": "root",
                "password": "pass",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert data["error"] is not None
        assert data["latencyMs"] is not None

    async def test_browse_tables_connection_not_found(self, seeded_client: AsyncClient):
        """Browsing tables of nonexistent connection → 404."""
        resp = await seeded_client.get(
            "/api/v1/mysql-connections/ri.ontology.mysql-connection.missing/tables"
        )
        assert resp.status_code == 404
        assert resp.json()["error"]["code"] == "MYSQL_CONNECTION_NOT_FOUND"

    async def test_save_connection_has_untested_status(self, seeded_client: AsyncClient):
        """Newly saved connection should have status=untested."""
        resp = await seeded_client.post(
            "/api/v1/mysql-connections",
            json={
                "name": "Status Test DB",
                "host": "localhost",
                "port": 3306,
                "databaseName": "testdb",
                "username": "root",
                "password": "secret123",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "untested"
        assert data["lastTestedAt"] is None

    async def test_imported_tables_empty(self, seeded_client: AsyncClient):
        """Imported tables for a new connection should be empty."""
        resp = await seeded_client.post(
            "/api/v1/mysql-connections",
            json={
                "name": "Import Tables Test",
                "host": "localhost",
                "port": 3306,
                "databaseName": "testdb",
                "username": "root",
                "password": "secret123",
            },
        )
        assert resp.status_code == 201
        rid = resp.json()["rid"]

        resp = await seeded_client.get(f"/api/v1/mysql-connections/{rid}/imported-tables")
        assert resp.status_code == 200
        assert resp.json() == []
