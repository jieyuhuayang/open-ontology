"""SSE event adapter — maps LangGraph/deepagents events to PRD-defined SSE format."""

import enum
import json
from collections.abc import AsyncGenerator


class SSEEventType(str, enum.Enum):
    TEXT_DELTA = "text-delta"
    PLAN_STEP = "plan-step"
    DONE = "done"
    ERROR = "error"


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
) -> AsyncGenerator[str, None]:
    """Transform LangGraph astream_events() into PRD-defined SSE events.

    Yields SSE-formatted strings for: text-delta, plan-step, done, error.
    F014+ will extend with blueprint-item, subgraph-update, etc.
    """
    accumulated_text = ""

    try:
        async for event in astream_events:
            event_kind = event.get("event", "")
            event_name = event.get("name", "")

            # Text streaming from chat model
            if event_kind == "on_chat_model_stream":
                chunk = event.get("data", {})
                if hasattr(chunk, "content") and chunk.content:
                    text = chunk.content
                    accumulated_text += text
                    yield format_sse_event(SSEEventType.TEXT_DELTA, {"text": text})

            # Planning tool (write_todos) output
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

        # Stream completed successfully
        yield format_sse_event(
            SSEEventType.DONE,
            {
                "sessionRid": session_rid,
                "summary": accumulated_text[:200] if accumulated_text else "",
            },
        )

    except Exception as e:
        yield format_sse_event(
            SSEEventType.ERROR,
            {"code": "LLM_API_ERROR", "message": str(e)},
        )
