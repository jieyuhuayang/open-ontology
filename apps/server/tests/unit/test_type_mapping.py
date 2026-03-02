"""Unit tests for MySQL type mapping and Excel/CSV type inference (T004)."""

import pytest


class TestMySQLTypeMapping:
    """Test mysql_type_to_property_type() covers 30+ MySQL types."""

    def test_integer_types(self):
        from app.domain.type_mapping import mysql_type_to_property_type

        for mysql_type in ["tinyint", "smallint", "mediumint", "int", "integer", "bigint"]:
            assert mysql_type_to_property_type(mysql_type) == "integer", f"Failed for {mysql_type}"

    def test_float_types(self):
        from app.domain.type_mapping import mysql_type_to_property_type

        for mysql_type in ["float", "double", "decimal", "numeric"]:
            assert mysql_type_to_property_type(mysql_type) == "double", f"Failed for {mysql_type}"

    def test_string_types(self):
        from app.domain.type_mapping import mysql_type_to_property_type

        for mysql_type in [
            "char",
            "varchar",
            "tinytext",
            "text",
            "mediumtext",
            "longtext",
            "enum",
            "set",
            "binary",
            "varbinary",
            "blob",
            "tinyblob",
            "mediumblob",
            "longblob",
            "json",
        ]:
            assert mysql_type_to_property_type(mysql_type) == "string", f"Failed for {mysql_type}"

    def test_date_types(self):
        from app.domain.type_mapping import mysql_type_to_property_type

        assert mysql_type_to_property_type("date") == "date"

    def test_timestamp_types(self):
        from app.domain.type_mapping import mysql_type_to_property_type

        assert mysql_type_to_property_type("datetime") == "timestamp"
        assert mysql_type_to_property_type("timestamp") == "timestamp"

    def test_boolean_types(self):
        from app.domain.type_mapping import mysql_type_to_property_type

        assert mysql_type_to_property_type("bit") == "boolean"
        assert mysql_type_to_property_type("boolean") == "boolean"

    def test_time_maps_to_string(self):
        from app.domain.type_mapping import mysql_type_to_property_type

        assert mysql_type_to_property_type("time") == "string"

    def test_year_maps_to_integer(self):
        from app.domain.type_mapping import mysql_type_to_property_type

        assert mysql_type_to_property_type("year") == "integer"

    def test_unknown_type_falls_back_to_string(self):
        from app.domain.type_mapping import mysql_type_to_property_type

        assert mysql_type_to_property_type("geometry") == "string"
        assert mysql_type_to_property_type("unknown_type") == "string"

    def test_type_with_parentheses(self):
        """MySQL types like varchar(255), int(11) should strip parentheses."""
        from app.domain.type_mapping import mysql_type_to_property_type

        assert mysql_type_to_property_type("varchar(255)") == "string"
        assert mysql_type_to_property_type("int(11)") == "integer"
        assert mysql_type_to_property_type("decimal(10,2)") == "double"

    def test_case_insensitive(self):
        from app.domain.type_mapping import mysql_type_to_property_type

        assert mysql_type_to_property_type("VARCHAR") == "string"
        assert mysql_type_to_property_type("INT") == "integer"
        assert mysql_type_to_property_type("DateTime") == "timestamp"


class TestInferColumnType:
    """Test infer_column_type() for Excel/CSV data."""

    def test_integer_column(self):
        from app.domain.type_mapping import infer_column_type

        values = ["1", "2", "3", "100", "-5"]
        assert infer_column_type(values) == "integer"

    def test_double_column(self):
        from app.domain.type_mapping import infer_column_type

        values = ["1.5", "2.3", "3.14", "100.0", "-5.5"]
        assert infer_column_type(values) == "double"

    def test_date_column(self):
        from app.domain.type_mapping import infer_column_type

        values = ["2026-01-01", "2026-02-15", "2025-12-31"]
        assert infer_column_type(values) == "date"

    def test_timestamp_column(self):
        from app.domain.type_mapping import infer_column_type

        values = ["2026-01-01T10:00:00", "2026-02-15T14:30:00", "2025-12-31 23:59:59"]
        assert infer_column_type(values) == "timestamp"

    def test_boolean_column(self):
        from app.domain.type_mapping import infer_column_type

        values = ["true", "false", "True", "FALSE", "1", "0"]
        assert infer_column_type(values) == "boolean"

    def test_string_column(self):
        from app.domain.type_mapping import infer_column_type

        values = ["hello", "world", "foo bar"]
        assert infer_column_type(values) == "string"

    def test_five_percent_tolerance(self):
        """With 100 values, 5 mismatches (5%) should still infer the type."""
        from app.domain.type_mapping import infer_column_type

        values = ["1"] * 95 + ["not_a_number"] * 5
        assert infer_column_type(values) == "integer"

    def test_over_five_percent_falls_back_to_string(self):
        """With 100 values, 6 mismatches (6%) should fall back to string."""
        from app.domain.type_mapping import infer_column_type

        values = ["1"] * 94 + ["not_a_number"] * 6
        assert infer_column_type(values) == "string"

    def test_empty_values_return_string(self):
        from app.domain.type_mapping import infer_column_type

        assert infer_column_type([]) == "string"

    def test_all_none_values_return_string(self):
        from app.domain.type_mapping import infer_column_type

        assert infer_column_type([None, None, None]) == "string"

    def test_skips_none_and_empty_strings(self):
        from app.domain.type_mapping import infer_column_type

        values = [None, "", "1", "2", "3", None, ""]
        assert infer_column_type(values) == "integer"

    def test_samples_first_1000_rows(self):
        from app.domain.type_mapping import infer_column_type

        # First 1000 are integers, rest are strings — should infer integer
        values = ["1"] * 1000 + ["hello"] * 500
        assert infer_column_type(values) == "integer"

    def test_mixed_integer_and_double(self):
        """Integers take priority over doubles; pure integers → integer."""
        from app.domain.type_mapping import infer_column_type

        values = ["1", "2", "3"]
        assert infer_column_type(values) == "integer"

        # Mixed integer and double strings → double wins since integers fail the double regex
        values = ["1.0", "2.5", "3.14"]
        assert infer_column_type(values) == "double"
