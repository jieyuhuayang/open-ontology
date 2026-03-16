"""Unit tests for link type validators."""

import pytest

from app.domain.link_type import Cardinality, JoinMethod
from app.domain.validators import (
    validate_cardinality_join_method_match,
    validate_link_side_api_name,
    validate_link_type_id,
)
from app.exceptions import AppError


class TestLinkTypeEnums:
    """Verify enum values include new members."""

    def test_cardinality_many_to_many(self):
        assert Cardinality.MANY_TO_MANY.value == "many-to-many"

    def test_join_method_join_table(self):
        assert JoinMethod.JOIN_TABLE.value == "join-table"

    def test_all_cardinalities(self):
        values = {c.value for c in Cardinality}
        assert values == {"one-to-one", "one-to-many", "many-to-one", "many-to-many"}


class TestValidateLinkTypeId:
    """Link type ID: lowercase letters, digits, hyphens; starts with letter."""

    def test_valid_simple(self):
        validate_link_type_id("employee-company")

    def test_valid_with_digits(self):
        validate_link_type_id("link2024")

    def test_reject_uppercase(self):
        with pytest.raises(AppError) as exc_info:
            validate_link_type_id("Employee")
        assert exc_info.value.code == "LINK_TYPE_INVALID_ID"

    def test_reject_starts_with_digit(self):
        with pytest.raises(AppError) as exc_info:
            validate_link_type_id("1-link")
        assert exc_info.value.code == "LINK_TYPE_INVALID_ID"

    def test_reject_empty(self):
        with pytest.raises(AppError) as exc_info:
            validate_link_type_id("")
        assert exc_info.value.code == "LINK_TYPE_INVALID_ID"

    def test_reject_underscores(self):
        with pytest.raises(AppError) as exc_info:
            validate_link_type_id("my_link")
        assert exc_info.value.code == "LINK_TYPE_INVALID_ID"


class TestValidateLinkSideApiName:
    """Link side apiName: camelCase, 1-100 chars, NFKC, no reserved words."""

    def test_valid_simple(self):
        validate_link_side_api_name("employer", "A")

    def test_valid_camel_case(self):
        validate_link_side_api_name("salesOrder", "B")

    def test_valid_with_digits(self):
        validate_link_side_api_name("asset2024", "A")

    def test_reject_uppercase_start(self):
        with pytest.raises(AppError) as exc_info:
            validate_link_side_api_name("Employer", "A")
        assert exc_info.value.code == "LINK_TYPE_INVALID_API_NAME"

    def test_reject_hyphens(self):
        with pytest.raises(AppError) as exc_info:
            validate_link_side_api_name("sales-order", "B")
        assert exc_info.value.code == "LINK_TYPE_INVALID_API_NAME"

    def test_reject_underscores(self):
        with pytest.raises(AppError) as exc_info:
            validate_link_side_api_name("sales_order", "A")
        assert exc_info.value.code == "LINK_TYPE_INVALID_API_NAME"

    def test_reject_empty(self):
        with pytest.raises(AppError) as exc_info:
            validate_link_side_api_name("", "A")
        assert exc_info.value.code == "LINK_TYPE_INVALID_API_NAME"

    def test_reject_starts_with_digit(self):
        with pytest.raises(AppError) as exc_info:
            validate_link_side_api_name("1order", "A")
        assert exc_info.value.code == "LINK_TYPE_INVALID_API_NAME"

    def test_reject_reserved_word(self):
        with pytest.raises(AppError) as exc_info:
            validate_link_side_api_name("ontology", "A")
        assert exc_info.value.code == "LINK_TYPE_RESERVED_API_NAME"

    def test_reject_reserved_word_property(self):
        with pytest.raises(AppError) as exc_info:
            validate_link_side_api_name("property", "B")
        assert exc_info.value.code == "LINK_TYPE_RESERVED_API_NAME"

    def test_reject_non_nfkc(self):
        """Non-NFKC characters should be rejected."""
        # \uff41 is fullwidth 'a', NFKC normalizes to 'a'
        with pytest.raises(AppError) as exc_info:
            validate_link_side_api_name("\uff41bc", "A")
        assert exc_info.value.code == "LINK_TYPE_API_NAME_NOT_NFKC"


class TestValidateCardinalityJoinMethodMatch:
    """Cardinality and join_method compatibility validation."""

    @pytest.mark.parametrize(
        "cardinality",
        ["one-to-one", "one-to-many", "many-to-one"],
    )
    def test_fk_cardinalities_with_fk_method_pass(self, cardinality: str):
        validate_cardinality_join_method_match(cardinality, "foreign-key")

    def test_many_to_many_with_join_table_pass(self):
        validate_cardinality_join_method_match("many-to-many", "join-table")

    @pytest.mark.parametrize(
        "cardinality",
        ["one-to-one", "one-to-many", "many-to-one"],
    )
    def test_fk_cardinalities_with_join_table_reject(self, cardinality: str):
        with pytest.raises(AppError) as exc_info:
            validate_cardinality_join_method_match(cardinality, "join-table")
        assert exc_info.value.code == "LINK_TYPE_CARDINALITY_JOIN_METHOD_MISMATCH"

    def test_many_to_many_with_fk_reject(self):
        with pytest.raises(AppError) as exc_info:
            validate_cardinality_join_method_match("many-to-many", "foreign-key")
        assert exc_info.value.code == "LINK_TYPE_CARDINALITY_JOIN_METHOD_MISMATCH"
