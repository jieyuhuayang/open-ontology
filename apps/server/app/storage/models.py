"""SQLAlchemy ORM models for Open Ontology.

All models live in this single file per AD-1.
Storage layer owns ORM models; domain layer owns Pydantic models.
"""

import enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.orm import DeclarativeBase, relationship


# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Python Enum mirrors of PostgreSQL ENUM types
# ---------------------------------------------------------------------------


class ResourceStatus(str, enum.Enum):
    active = "active"
    experimental = "experimental"
    deprecated = "deprecated"


class Visibility(str, enum.Enum):
    prominent = "prominent"
    normal = "normal"
    hidden = "hidden"


class Cardinality(str, enum.Enum):
    one_to_one = "one-to-one"
    one_to_many = "one-to-many"
    many_to_one = "many-to-one"
    many_to_many = "many-to-many"


class JoinMethod(str, enum.Enum):
    foreign_key = "foreign-key"
    join_table = "join-table"
    backing_object = "backing-object"


class LinkSide(str, enum.Enum):
    A = "A"
    B = "B"


class PropertyBaseType(str, enum.Enum):
    string = "string"
    integer = "integer"
    long = "long"
    float_ = "float"
    double = "double"
    decimal = "decimal"
    boolean = "boolean"
    date = "date"
    timestamp = "timestamp"
    byte = "byte"
    short = "short"
    array = "array"
    struct = "struct"
    vector = "vector"
    geopoint = "geopoint"
    geoshape = "geoshape"
    attachment = "attachment"
    time_series = "time-series"
    media_reference = "media-reference"
    marking = "marking"
    cipher = "cipher"


# ---------------------------------------------------------------------------
# ORM Models
# ---------------------------------------------------------------------------


class SpaceModel(Base):
    __tablename__ = "spaces"

    rid = Column(String, primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_by = Column(String(255), nullable=False)

    ontologies = relationship("OntologyModel", back_populates="space")


class OntologyModel(Base):
    __tablename__ = "ontologies"

    rid = Column(String, primary_key=True)
    space_rid = Column(
        String,
        ForeignKey("spaces.rid", ondelete="RESTRICT"),
        nullable=False,
    )
    display_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    version = Column(Integer, nullable=False, server_default="0")
    last_modified_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_modified_by = Column(String(255), nullable=False)

    space = relationship("SpaceModel", back_populates="ontologies")
    object_types = relationship(
        "ObjectTypeModel", back_populates="ontology", cascade="all, delete-orphan"
    )
    link_types = relationship(
        "LinkTypeModel", back_populates="ontology", cascade="all, delete-orphan"
    )
    working_states = relationship(
        "WorkingStateModel", back_populates="ontology", cascade="all, delete-orphan"
    )
    change_records = relationship(
        "ChangeRecordModel", back_populates="ontology", cascade="all, delete-orphan"
    )


class ObjectTypeModel(Base):
    __tablename__ = "object_types"

    rid = Column(String, primary_key=True)
    id = Column(String(255), nullable=False, unique=True)
    api_name = Column(String(255), nullable=False, unique=True)
    display_name = Column(String(255), nullable=False)
    plural_display_name = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    aliases = Column(JSONB, nullable=True)
    icon = Column(JSONB, nullable=False)
    status = Column(
        Enum(ResourceStatus, name="resource_status", create_type=False),
        nullable=False,
        server_default="experimental",
    )
    visibility = Column(
        Enum(Visibility, name="visibility", create_type=False),
        nullable=False,
        server_default="normal",
    )
    backing_datasource = Column(JSONB, nullable=True)
    primary_key_property_id = Column(String(255), nullable=True)
    title_key_property_id = Column(String(255), nullable=True)
    intended_actions = Column(JSONB, nullable=True)
    project_rid = Column(String, nullable=False)
    ontology_rid = Column(
        String,
        ForeignKey("ontologies.rid", ondelete="CASCADE"),
        nullable=False,
    )
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_by = Column(String(255), nullable=False)
    last_modified_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_modified_by = Column(String(255), nullable=False)
    search_vector = Column(TSVECTOR)

    ontology = relationship("OntologyModel", back_populates="object_types")
    properties = relationship(
        "PropertyModel", back_populates="object_type", cascade="all, delete-orphan"
    )
    link_type_endpoints = relationship("LinkTypeEndpointModel", back_populates="object_type")

    __table_args__ = (
        Index("ix_object_types_search_vector", "search_vector", postgresql_using="gin"),
    )


class PropertyModel(Base):
    __tablename__ = "properties"

    rid = Column(String, primary_key=True)
    id = Column(String(255), nullable=False)
    api_name = Column(String(255), nullable=False)
    object_type_rid = Column(
        String,
        ForeignKey("object_types.rid", ondelete="CASCADE"),
        nullable=False,
    )
    display_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    base_type = Column(
        Enum(PropertyBaseType, name="property_base_type", create_type=False),
        nullable=False,
    )
    array_inner_type = Column(
        Enum(PropertyBaseType, name="property_base_type", create_type=False),
        nullable=True,
    )
    struct_schema = Column(JSONB, nullable=True)
    backing_column = Column(String(255), nullable=True)
    status = Column(
        Enum(ResourceStatus, name="resource_status", create_type=False),
        nullable=False,
        server_default="experimental",
    )
    visibility = Column(
        Enum(Visibility, name="visibility", create_type=False),
        nullable=False,
        server_default="normal",
    )
    value_formatting = Column(JSONB, nullable=True)
    conditional_formatting = Column(JSONB, nullable=True)
    is_primary_key = Column(Boolean, nullable=False, server_default="false")
    is_title_key = Column(Boolean, nullable=False, server_default="false")
    sort_order = Column(Integer, nullable=False, server_default="0")
    shared_property_rid = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_by = Column(String(255), nullable=False, server_default="system")
    last_modified_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_modified_by = Column(String(255), nullable=False, server_default="system")
    search_vector = Column(TSVECTOR)

    object_type = relationship("ObjectTypeModel", back_populates="properties")

    __table_args__ = (
        UniqueConstraint("object_type_rid", "api_name", name="uq_properties_object_type_api_name"),
        UniqueConstraint("object_type_rid", "id", name="uq_properties_object_type_id"),
        Index("ix_properties_search_vector", "search_vector", postgresql_using="gin"),
    )


class LinkTypeModel(Base):
    __tablename__ = "link_types"

    rid = Column(String, primary_key=True)
    id = Column(String(255), nullable=False, unique=True)
    cardinality = Column(
        Enum(Cardinality, name="cardinality", create_type=False),
        nullable=False,
    )
    join_method = Column(
        Enum(JoinMethod, name="join_method", create_type=False),
        nullable=False,
    )
    status = Column(
        Enum(ResourceStatus, name="resource_status", create_type=False),
        nullable=False,
        server_default="experimental",
    )
    project_rid = Column(String, nullable=False)
    ontology_rid = Column(
        String,
        ForeignKey("ontologies.rid", ondelete="CASCADE"),
        nullable=False,
    )
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_by = Column(String(255), nullable=False)
    last_modified_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_modified_by = Column(String(255), nullable=False)

    ontology = relationship("OntologyModel", back_populates="link_types")
    endpoints = relationship(
        "LinkTypeEndpointModel", back_populates="link_type", cascade="all, delete-orphan"
    )


class LinkTypeEndpointModel(Base):
    __tablename__ = "link_type_endpoints"

    id = Column(Integer, primary_key=True, autoincrement=True)
    link_type_rid = Column(
        String,
        ForeignKey("link_types.rid", ondelete="CASCADE"),
        nullable=False,
    )
    side = Column(
        Enum(LinkSide, name="link_side", create_type=False),
        nullable=False,
    )
    object_type_rid = Column(
        String,
        ForeignKey("object_types.rid", ondelete="RESTRICT"),
        nullable=False,
    )
    display_name = Column(String(255), nullable=False)
    plural_display_name = Column(String(255), nullable=True)
    api_name = Column(String(255), nullable=False)
    visibility = Column(
        Enum(Visibility, name="visibility", create_type=False),
        nullable=False,
        server_default="normal",
    )
    foreign_key_property_id = Column(String(255), nullable=True)

    link_type = relationship("LinkTypeModel", back_populates="endpoints")
    object_type = relationship("ObjectTypeModel", back_populates="link_type_endpoints")

    __table_args__ = (
        UniqueConstraint("link_type_rid", "side", name="uq_link_type_endpoints_link_type_side"),
    )


class WorkingStateModel(Base):
    __tablename__ = "working_states"

    rid = Column(String, primary_key=True)
    user_id = Column(String(255), nullable=False)
    ontology_rid = Column(
        String,
        ForeignKey("ontologies.rid", ondelete="CASCADE"),
        nullable=False,
    )
    changes = Column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    base_version = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_modified_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    ontology = relationship("OntologyModel", back_populates="working_states")

    __table_args__ = (
        UniqueConstraint("user_id", "ontology_rid", name="uq_working_states_user_ontology"),
    )


class ChangeRecordModel(Base):
    __tablename__ = "change_records"

    rid = Column(String, primary_key=True)
    ontology_rid = Column(
        String,
        ForeignKey("ontologies.rid", ondelete="CASCADE"),
        nullable=False,
    )
    version = Column(Integer, nullable=False)
    changes = Column(JSONB, nullable=False)
    saved_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    saved_by = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    ontology = relationship("OntologyModel", back_populates="change_records")

    __table_args__ = (
        UniqueConstraint("ontology_rid", "version", name="uq_change_records_ontology_version"),
    )


class DatasetModel(Base):
    __tablename__ = "datasets"

    rid = Column(String, primary_key=True)
    name = Column(String(255), nullable=False)
    source_type = Column(String(20), nullable=False)  # mysql | excel | csv
    source_metadata = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    row_count = Column(Integer, nullable=False, server_default="0")
    column_count = Column(Integer, nullable=False, server_default="0")
    status = Column(String(20), nullable=False, server_default="ready")  # importing | ready
    imported_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    ontology_rid = Column(String, ForeignKey("ontologies.rid", ondelete="CASCADE"), nullable=False)
    created_by = Column(String(255), nullable=False)

    columns = relationship(
        "DatasetColumnModel", back_populates="dataset", cascade="all, delete-orphan"
    )
    rows = relationship("DatasetRowModel", back_populates="dataset", cascade="all, delete-orphan")


class DatasetColumnModel(Base):
    __tablename__ = "dataset_columns"

    rid = Column(String, primary_key=True)
    dataset_rid = Column(String, ForeignKey("datasets.rid", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    inferred_type = Column(String(50), nullable=False)
    is_nullable = Column(Boolean, nullable=False, server_default="true")
    is_primary_key = Column(Boolean, nullable=False, server_default="false")
    sort_order = Column(Integer, nullable=False, server_default="0")

    dataset = relationship("DatasetModel", back_populates="columns")

    __table_args__ = (UniqueConstraint("dataset_rid", "name", name="uq_dataset_columns_name"),)


class DatasetRowModel(Base):
    __tablename__ = "dataset_rows"

    dataset_rid = Column(
        String, ForeignKey("datasets.rid", ondelete="CASCADE"), nullable=False, primary_key=True
    )
    row_index = Column(Integer, nullable=False, primary_key=True)
    data = Column(JSONB, nullable=False)

    dataset = relationship("DatasetModel", back_populates="rows")

    __table_args__ = (Index("ix_dataset_rows_dataset", "dataset_rid"),)


class MySQLConnectionModel(Base):
    __tablename__ = "mysql_connections"

    rid = Column(String, primary_key=True)
    name = Column(String(255), nullable=False)
    host = Column(String(255), nullable=False)
    port = Column(Integer, nullable=False, server_default="3306")
    database_name = Column(String(255), nullable=False)
    username = Column(String(255), nullable=False)
    encrypted_password = Column(Text, nullable=False)
    ssl_enabled = Column(Boolean, nullable=False, server_default="false")
    ontology_rid = Column(String, ForeignKey("ontologies.rid", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_by = Column(String(255), nullable=False)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), nullable=False, server_default="untested")
    last_tested_at = Column(DateTime(timezone=True), nullable=True)
