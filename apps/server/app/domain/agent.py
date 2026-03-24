"""Agent domain models — AgentSession, AgentMessage, AgentAuditLog + SSE events."""

import enum
from datetime import datetime

from pydantic import Field

from app.domain.common import DomainModel


# --- Enums ---


class SessionStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class MessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


# --- Session models ---


class AgentSession(DomainModel):
    rid: str
    ontology_rid: str
    user_id: str | None = None
    title: str | None = None
    domain: str | None = None
    goal: str | None = None
    scope_hint: str | None = None
    status: SessionStatus = SessionStatus.ACTIVE
    created_at: datetime
    updated_at: datetime


class AgentSessionCreate(DomainModel):
    ontology_rid: str
    title: str | None = None
    domain: str | None = None
    goal: str | None = None
    scope_hint: str | None = None


class AgentSessionList(DomainModel):
    items: list[AgentSession]
    total_count: int
    page: int
    page_size: int


# --- Message models ---


class AgentMessage(DomainModel):
    rid: str
    session_rid: str
    role: MessageRole
    content: str
    metadata: dict = Field(default_factory=dict)
    created_at: datetime


class AgentSessionDetail(DomainModel):
    session: AgentSession
    messages: list[AgentMessage]


# --- Audit log models ---


class AgentAuditLog(DomainModel):
    rid: str
    session_rid: str | None = None
    action: str
    details: dict = Field(default_factory=dict)
    created_at: datetime


# --- Request models ---


class ChatRequest(DomainModel):
    session_rid: str
    content: str = Field(..., max_length=4096)


# --- SSE event data models ---


class TextDeltaEvent(DomainModel):
    text: str


class PlanStepEvent(DomainModel):
    step: str
    index: int
    total: int


class DoneEvent(DomainModel):
    session_rid: str
    summary: str


class ErrorEvent(DomainModel):
    code: str
    message: str
