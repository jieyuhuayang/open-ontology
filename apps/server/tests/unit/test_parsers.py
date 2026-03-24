"""Unit tests for file parsers (CSV, DDL, Document)."""

import pytest

from app.agent.parsers.csv_parser import CsvParser
from app.agent.parsers.ddl_parser import DdlParser
from app.agent.parsers.document_parser import DocumentParser


# --- CSV Parser ---


class TestCsvParseBasic:
    @pytest.mark.asyncio
    async def test_parse_simple_csv(self, tmp_path):
        csv_file = tmp_path / "test.csv"
        csv_file.write_text("name,age,email\nAlice,30,a@b.com\nBob,25,b@c.com\n")
        parser = CsvParser()
        result = await parser.parse(csv_file)

        assert result.file_type == "csv"
        assert result.row_count == 2
        assert len(result.columns) == 3
        assert result.columns[0].name == "name"
        assert result.columns[1].name == "age"
        assert result.columns[2].name == "email"

    @pytest.mark.asyncio
    async def test_type_inference_integer(self, tmp_path):
        csv_file = tmp_path / "ints.csv"
        csv_file.write_text("id,count\n1,100\n2,200\n3,300\n")
        parser = CsvParser()
        result = await parser.parse(csv_file)

        assert result.columns[0].inferred_type == "Integer"
        assert result.columns[1].inferred_type == "Integer"

    @pytest.mark.asyncio
    async def test_type_inference_double(self, tmp_path):
        csv_file = tmp_path / "floats.csv"
        csv_file.write_text("price,rate\n10.5,0.95\n20.3,0.88\n")
        parser = CsvParser()
        result = await parser.parse(csv_file)

        assert result.columns[0].inferred_type == "Double"

    @pytest.mark.asyncio
    async def test_type_inference_date(self, tmp_path):
        csv_file = tmp_path / "dates.csv"
        csv_file.write_text("date\n2024-01-01\n2024-02-15\n2024-03-20\n")
        parser = CsvParser()
        result = await parser.parse(csv_file)

        assert result.columns[0].inferred_type == "Date"

    @pytest.mark.asyncio
    async def test_type_inference_timestamp(self, tmp_path):
        csv_file = tmp_path / "timestamps.csv"
        csv_file.write_text("ts\n2024-01-01T10:00:00\n2024-02-15 14:30:00\n")
        parser = CsvParser()
        result = await parser.parse(csv_file)

        assert result.columns[0].inferred_type == "Timestamp"

    @pytest.mark.asyncio
    async def test_type_inference_boolean(self, tmp_path):
        csv_file = tmp_path / "bools.csv"
        csv_file.write_text("active\ntrue\nfalse\ntrue\n")
        parser = CsvParser()
        result = await parser.parse(csv_file)

        assert result.columns[0].inferred_type == "Boolean"


class TestCsvPrimaryKeyCandidate:
    @pytest.mark.asyncio
    async def test_id_column_detected(self, tmp_path):
        csv_file = tmp_path / "pk.csv"
        csv_file.write_text("id,name,user_id\n1,Alice,10\n")
        parser = CsvParser()
        result = await parser.parse(csv_file)

        assert result.columns[0].is_primary_key_candidate is True  # "id"
        assert result.columns[1].is_primary_key_candidate is False  # "name"
        assert result.columns[2].is_primary_key_candidate is True  # "user_id"


class TestCsvAuditFieldDetection:
    @pytest.mark.asyncio
    async def test_audit_fields_detected(self, tmp_path):
        csv_file = tmp_path / "audit.csv"
        csv_file.write_text(
            "name,created_at,updated_at,is_deleted\nA,2024-01-01,2024-01-02,false\n"
        )
        parser = CsvParser()
        result = await parser.parse(csv_file)

        assert result.columns[0].is_audit_field is False  # "name"
        assert result.columns[1].is_audit_field is True  # "created_at"
        assert result.columns[2].is_audit_field is True  # "updated_at"
        assert result.columns[3].is_audit_field is True  # "is_deleted"


class TestCsvGbkEncoding:
    @pytest.mark.asyncio
    async def test_gbk_fallback(self, tmp_path):
        csv_file = tmp_path / "gbk.csv"
        csv_file.write_bytes("名称,数量\n产品A,10\n".encode("gbk"))
        parser = CsvParser()
        result = await parser.parse(csv_file)

        assert result.columns[0].name == "名称"
        assert result.row_count == 1


class TestCsvEmptyFile:
    @pytest.mark.asyncio
    async def test_empty_file(self, tmp_path):
        csv_file = tmp_path / "empty.csv"
        csv_file.write_text("")
        parser = CsvParser()
        result = await parser.parse(csv_file)

        assert result.row_count == 0
        assert result.columns == []


# --- DDL Parser ---


class TestDdlParseCreateTable:
    @pytest.mark.asyncio
    async def test_simple_table(self, tmp_path):
        ddl_file = tmp_path / "schema.sql"
        ddl_file.write_text(
            """
            CREATE TABLE orders (
                id INTEGER NOT NULL,
                customer_name VARCHAR(255),
                amount DECIMAL(10,2),
                created_at TIMESTAMP,
                PRIMARY KEY (id)
            );
            """
        )
        parser = DdlParser()
        result = await parser.parse(ddl_file)

        assert len(result.tables) == 1
        t = result.tables[0]
        assert t.name == "orders"
        assert len(t.columns) == 4
        assert t.primary_key == ["id"]
        assert t.columns[0].inferred_type == "Integer"
        assert t.columns[2].inferred_type == "Double"
        assert t.columns[3].inferred_type == "Timestamp"


class TestDdlParseForeignKey:
    @pytest.mark.asyncio
    async def test_foreign_key_extraction(self, tmp_path):
        ddl_file = tmp_path / "fk.sql"
        ddl_file.write_text(
            """
            CREATE TABLE orders (
                id INTEGER NOT NULL,
                customer_id INTEGER,
                PRIMARY KEY (id),
                FOREIGN KEY (customer_id) REFERENCES customers(id)
            );
            """
        )
        parser = DdlParser()
        result = await parser.parse(ddl_file)

        t = result.tables[0]
        assert len(t.foreign_keys) == 1
        fk = t.foreign_keys[0]
        assert fk.from_column == "customer_id"
        assert fk.to_table == "customers"
        assert fk.to_column == "id"


class TestDdlParseMultipleTables:
    @pytest.mark.asyncio
    async def test_multiple_tables(self, tmp_path):
        ddl_file = tmp_path / "multi.sql"
        ddl_file.write_text(
            """
            CREATE TABLE customers (
                id INTEGER NOT NULL,
                name VARCHAR(255),
                PRIMARY KEY (id)
            );

            CREATE TABLE orders (
                id INTEGER NOT NULL,
                customer_id INTEGER,
                PRIMARY KEY (id)
            );
            """
        )
        parser = DdlParser()
        result = await parser.parse(ddl_file)

        assert len(result.tables) == 2
        assert result.tables[0].name == "customers"
        assert result.tables[1].name == "orders"


# --- Document Parser ---


class TestDocumentParseTxt:
    @pytest.mark.asyncio
    async def test_parse_txt(self, tmp_path):
        txt_file = tmp_path / "doc.txt"
        txt_file.write_text("This is a business document about orders and customers.")
        parser = DocumentParser()
        result = await parser.parse(txt_file)

        assert result.file_type == "txt"
        assert "orders" in result.text_content
        assert result.metadata["char_count"] > 0


class TestDocumentParseMarkdown:
    @pytest.mark.asyncio
    async def test_parse_markdown(self, tmp_path):
        md_file = tmp_path / "doc.md"
        md_file.write_text("# Business Model\n\nCustomers place orders.")
        parser = DocumentParser()
        result = await parser.parse(md_file)

        assert result.file_type == "md"
        assert "Business Model" in result.text_content
