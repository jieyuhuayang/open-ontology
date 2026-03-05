"""Unit tests for DatasetStorage _to_domain / _to_list_item (T014)."""

from datetime import datetime, timezone
from unittest.mock import MagicMock


class TestDatasetStorageToDomain:
    def test_to_domain_maps_all_fields(self):
        from app.storage.dataset_storage import DatasetStorage

        now = datetime.now(timezone.utc)
        col_orm = MagicMock()
        col_orm.name = "id"
        col_orm.inferred_type = "integer"
        col_orm.is_nullable = False
        col_orm.is_primary_key = True
        col_orm.sort_order = 0

        orm = MagicMock()
        orm.rid = "ri.ontology.dataset.abc123"
        orm.name = "orders"
        orm.source_type = "mysql"
        orm.source_metadata = {"table": "orders"}
        orm.row_count = 100
        orm.column_count = 5
        orm.status = "ready"
        orm.imported_at = now
        orm.ontology_rid = "ri.ontology.ontology.default"
        orm.created_by = "default"
        orm.columns = [col_orm]

        ds = DatasetStorage._to_domain(orm)
        assert ds.rid == "ri.ontology.dataset.abc123"
        assert ds.name == "orders"
        assert ds.source_type == "mysql"
        assert ds.row_count == 100
        assert len(ds.columns) == 1
        assert ds.columns[0].name == "id"
        assert ds.columns[0].inferred_type == "integer"
        assert ds.columns[0].is_primary_key is True

    def test_to_list_item(self):
        from app.storage.dataset_storage import DatasetStorage

        now = datetime.now(timezone.utc)
        orm = MagicMock()
        orm.rid = "ri.ontology.dataset.abc123"
        orm.name = "orders"
        orm.source_type = "mysql"
        orm.row_count = 100
        orm.column_count = 5
        orm.imported_at = now

        item = DatasetStorage._to_list_item(orm)
        assert item.rid == "ri.ontology.dataset.abc123"
        assert item.in_use is False
        assert item.linked_object_type_name is None


class TestMySQLConnectionStorageToDomain:
    def test_to_domain_maps_all_fields(self):
        from app.storage.mysql_connection_storage import MySQLConnectionStorage

        now = datetime.now(timezone.utc)
        orm = MagicMock()
        orm.rid = "ri.ontology.mysql-connection.def456"
        orm.name = "Prod DB"
        orm.host = "db.example.com"
        orm.port = 3306
        orm.database_name = "sales"
        orm.username = "reader"
        orm.encrypted_password = "encrypted_data"
        orm.ssl_enabled = False
        orm.ontology_rid = "ri.ontology.ontology.default"
        orm.created_at = now
        orm.created_by = "default"
        orm.last_used_at = None
        orm.status = "untested"
        orm.last_tested_at = None

        conn = MySQLConnectionStorage._to_domain(orm)
        assert conn.rid == "ri.ontology.mysql-connection.def456"
        assert conn.host == "db.example.com"
        assert conn.database_name == "sales"
        # encrypted_password should not be in domain model
        assert not hasattr(conn, "encrypted_password")
