import re
import uuid

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

# MySQL identifier safety: only allow alphanumeric, underscore, dollar sign
_MYSQL_IDENT_PATTERN = re.compile(r"^[a-zA-Z0-9_$]+$")


class DomainModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


def generate_rid(namespace: str, type_name: str) -> str:
    short_id = uuid.uuid4().hex[:12]
    return f"ri.{namespace}.{type_name}.{short_id}"
