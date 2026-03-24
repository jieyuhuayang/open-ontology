"""Unit tests for SSE adapter (T010)."""

import json

import pytest

from app.agent.sse_adapter import format_sse_event, SSEEventType


class TestFormatSSEEvent:
    def test_text_delta_event(self):
        result = format_sse_event(SSEEventType.TEXT_DELTA, {"text": "hello"})
        assert result == 'event: text-delta\ndata: {"text": "hello"}\n\n'

    def test_plan_step_event(self):
        data = {"step": "analyze files", "index": 0, "total": 3}
        result = format_sse_event(SSEEventType.PLAN_STEP, data)
        assert result.startswith("event: plan-step\n")
        parsed = json.loads(result.split("data: ")[1].strip())
        assert parsed["step"] == "analyze files"
        assert parsed["index"] == 0
        assert parsed["total"] == 3

    def test_done_event(self):
        data = {"sessionRid": "ri.ontology.agent-session.abc123", "summary": "completed"}
        result = format_sse_event(SSEEventType.DONE, data)
        assert result.startswith("event: done\n")
        parsed = json.loads(result.split("data: ")[1].strip())
        assert parsed["sessionRid"] == "ri.ontology.agent-session.abc123"

    def test_error_event(self):
        data = {"code": "LLM_API_ERROR", "message": "timeout"}
        result = format_sse_event(SSEEventType.ERROR, data)
        assert result.startswith("event: error\n")
        parsed = json.loads(result.split("data: ")[1].strip())
        assert parsed["code"] == "LLM_API_ERROR"

    def test_event_ends_with_double_newline(self):
        result = format_sse_event(SSEEventType.TEXT_DELTA, {"text": "x"})
        assert result.endswith("\n\n")

    def test_unicode_content(self):
        result = format_sse_event(SSEEventType.TEXT_DELTA, {"text": "你好世界"})
        parsed = json.loads(result.split("data: ")[1].strip())
        assert parsed["text"] == "你好世界"
