"""Unit tests for link type validators."""

import pytest

from app.domain.validators import validate_link_side_api_name, validate_link_type_id
from app.exceptions import AppError


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
