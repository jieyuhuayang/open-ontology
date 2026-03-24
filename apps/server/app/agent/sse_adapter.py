"""SSE event adapter — maps LangGraph/deepagents events to PRD-defined SSE format."""

import enum
import json
from collections.abc import AsyncGenerator
from dataclasses import dataclass, field


class SSEEventType(str, enum.Enum):
    TEXT_DELTA = "text-delta"
    PLAN_STEP = "plan-step"
    DONE = "done"
    ERROR = "error"
    # F014: Material & Blueprint events
    MATERIAL_UPLOADED = "material-uploaded"
    BLUEPRINT_ITEM = "blueprint-item"
    BLUEPRINT_COMPLETE = "blueprint-complete"


@dataclass
class StreamResult:
    """Accumulated result from an adapt_stream() run."""

    text_parts: list[str] = field(default_factory=list)

    @property
    def full_text(self) -> str:
        return "".join(self.text_parts)


def format_sse_event(event_type: SSEEventType | str, data: dict) -> str:
    """Format a single SSE event string.

    Returns:
        SSE-formatted string: ``event: <type>\\ndata: <json>\\n\\n``
    """
    event_name = event_type.value if isinstance(event_type, SSEEventType) else event_type
    json_data = json.dumps(data, ensure_ascii=False)
    return f"event: {event_name}\ndata: {json_data}\n\n"


async def adapt_stream(
    astream_events: AsyncGenerator,
    session_rid: str,
    result: StreamResult | None = None,
) -> AsyncGenerator[str, None]:
    """Transform LangGraph astream_events() into PRD-defined SSE events.

    Yields SSE-formatted strings for: text-delta, plan-step, done, error.
    If a StreamResult is provided, accumulated text is stored there for the caller.
    """
    if result is None:
        result = StreamResult()

    try:
        async for event in astream_events:
            event_kind = event.get("event", "")
            event_name = event.get("name", "")

            if event_kind == "on_chat_model_stream":
                chunk = event.get("data", {})
                if hasattr(chunk, "content") and chunk.content:
                    text = chunk.content
                    result.text_parts.append(text)
                    yield format_sse_event(SSEEventType.TEXT_DELTA, {"text": text})

            elif event_kind == "on_tool_end" and event_name == "write_todos":
                tool_output = event.get("data", {})
                if hasattr(tool_output, "content"):
                    try:
                        todos = json.loads(tool_output.content)
                        if isinstance(todos, list):
                            for i, todo in enumerate(todos):
                                step_text = (
                                    todo.get("todo", str(todo))
                                    if isinstance(todo, dict)
                                    else str(todo)
                                )
                                yield format_sse_event(
                                    SSEEventType.PLAN_STEP,
                                    {"step": step_text, "index": i, "total": len(todos)},
                                )
                    except (json.JSONDecodeError, AttributeError):
                        pass

        yield format_sse_event(
            SSEEventType.DONE,
            {
                "sessionRid": session_rid,
                "summary": result.full_text[:200] if result.text_parts else "",
            },
        )

    except Exception as e:
        yield format_sse_event(
            SSEEventType.ERROR,
            {"code": "LLM_API_ERROR", "message": str(e)},
        )
