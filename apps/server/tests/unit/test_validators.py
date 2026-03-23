"""Unit tests for domain validators (T001).

Tests validate_api_name() and validate_object_type_id().
"""

import pytest

from app.domain.validators import validate_api_name, validate_object_type_id, validate_rid
from app.exceptions import AppError


# ---------------------------------------------------------------------------
# validate_api_name
# ---------------------------------------------------------------------------


class TestValidateApiName:
    """AC3a: apiName must be PascalCase and not a reserved word."""

    def test_valid_pascal_case(self):
        validate_api_name("Employee")

    def test_valid_pascal_case_multi_word(self):
        validate_api_name("SalesOrder")

    def test_valid_with_digits(self):
        validate_api_name("Asset2024")

    def test_valid_with_underscore(self):
        validate_api_name("My_Type")

    def test_reject_lowercase_start(self):
        with pytest.raises(AppError) as exc_info:
            validate_api_name("employee")
        assert exc_info.value.code == "OBJECT_TYPE_INVALID_API_NAME"

    def test_reject_all_digits(self):
        with pytest.raises(AppError) as exc_info:
            validate_api_name("12345")
        assert exc_info.value.code == "OBJECT_TYPE_INVALID_API_NAME"

    def test_reject_special_characters(self):
        with pytest.raises(AppError) as exc_info:
            validate_api_name("Sales-Order")
        assert exc_info.value.code == "OBJECT_TYPE_INVALID_API_NAME"

    def test_reject_spaces(self):
        with pytest.raises(AppError) as exc_info:
            validate_api_name("Sales Order")
        assert exc_info.value.code == "OBJECT_TYPE_INVALID_API_NAME"

    def test_reject_empty_string(self):
        with pytest.raises(AppError) as exc_info:
            validate_api_name("")
        assert exc_info.value.code == "OBJECT_TYPE_INVALID_API_NAME"

    def test_reject_reserved_word_exact(self):
        with pytest.raises(AppError) as exc_info:
            validate_api_name("Ontology")
        assert exc_info.value.code == "OBJECT_TYPE_RESERVED_API_NAME"

    def test_reject_reserved_word_case_insensitive(self):
        """Reserved words are compared lowercase: 'Property' → 'property' matches."""
        with pytest.raises(AppError) as exc_info:
            validate_api_name("Property")
        assert exc_info.value.code == "OBJECT_TYPE_RESERVED_API_NAME"

    def test_reject_reserved_word_primarykey(self):
        with pytest.raises(AppError) as exc_info:
            validate_api_name("PrimaryKey")
        assert exc_info.value.code == "OBJECT_TYPE_RESERVED_API_NAME"

    def test_reject_reserved_word_rid(self):
        with pytest.raises(AppError) as exc_info:
            validate_api_name("Rid")
        assert exc_info.value.code == "OBJECT_TYPE_RESERVED_API_NAME"

    def test_reject_reserved_word_typeid(self):
        with pytest.raises(AppError) as exc_info:
            validate_api_name("TypeId")
        assert exc_info.value.code == "OBJECT_TYPE_RESERVED_API_NAME"


# ---------------------------------------------------------------------------
# validate_object_type_id
# ---------------------------------------------------------------------------


class TestValidateObjectTypeId:
    """AC3b: id must be lowercase letters, digits, hyphens; start with letter."""

    def test_valid_simple(self):
        validate_object_type_id("employee")

    def test_valid_with_hyphens(self):
        validate_object_type_id("my-type-1")

    def test_valid_with_digits(self):
        validate_object_type_id("asset2024")

    def test_reject_uppercase(self):
        with pytest.raises(AppError) as exc_info:
            validate_object_type_id("Employee")
        assert exc_info.value.code == "OBJECT_TYPE_INVALID_ID"

    def test_reject_special_characters(self):
        with pytest.raises(AppError) as exc_info:
            validate_object_type_id("my_type")
        assert exc_info.value.code == "OBJECT_TYPE_INVALID_ID"

    def test_reject_starts_with_digit(self):
        with pytest.raises(AppError) as exc_info:
            validate_object_type_id("1-type")
        assert exc_info.value.code == "OBJECT_TYPE_INVALID_ID"

    def test_reject_empty_string(self):
        with pytest.raises(AppError) as exc_info:
            validate_object_type_id("")
        assert exc_info.value.code == "OBJECT_TYPE_INVALID_ID"

    def test_reject_spaces(self):
        with pytest.raises(AppError) as exc_info:
            validate_object_type_id("my type")
        assert exc_info.value.code == "OBJECT_TYPE_INVALID_ID"


# ---------------------------------------------------------------------------
# validate_rid (2.1)
# ---------------------------------------------------------------------------


class TestValidateRid:
    """RID must match ri.<namespace>.<type>.<id> and not exceed 200 chars."""

    def test_valid_standard_rid(self):
        validate_rid("ri.ontology.object-type.abc123def456")

    def test_valid_ontology_rid(self):
        validate_rid("ri.ontology.ontology.default")

    def test_valid_working_state_rid(self):
        validate_rid("ri.ontology.working-state.ws123")

    def test_reject_no_ri_prefix(self):
        with pytest.raises(AppError) as exc_info:
            validate_rid("ontology.object-type.abc")
        assert exc_info.value.code == "INVALID_RID"

    def test_reject_too_long(self):
        long_rid = "ri.ontology.object-type." + "a" * 200
        with pytest.raises(AppError) as exc_info:
            validate_rid(long_rid)
        assert exc_info.value.code == "INVALID_RID"

    def test_reject_special_characters(self):
        with pytest.raises(AppError) as exc_info:
            validate_rid("ri.ontology.object-type.abc;DROP TABLE")
        assert exc_info.value.code == "INVALID_RID"

    def test_reject_empty(self):
        with pytest.raises(AppError) as exc_info:
            validate_rid("")
        assert exc_info.value.code == "INVALID_RID"

    def test_reject_sql_injection(self):
        with pytest.raises(AppError) as exc_info:
            validate_rid("ri.ontology.object-type.abc' OR '1'='1")
        assert exc_info.value.code == "INVALID_RID"
