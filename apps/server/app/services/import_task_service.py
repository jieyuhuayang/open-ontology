"""Import task service — in-memory task tracking for async imports."""

import uuid
from datetime import datetime, timedelta, timezone

from app.domain.import_task import ImportTask, ImportTaskStatus

_TASK_TTL = timedelta(hours=1)


class ImportTaskService:
    def __init__(self) -> None:
        self._tasks: dict[str, ImportTask] = {}

    def create_task(self) -> ImportTask:
        self._cleanup_expired()
        task_id = uuid.uuid4().hex[:12]
        task = ImportTask(
            task_id=task_id,
            created_at=datetime.now(timezone.utc),
        )
        self._tasks[task_id] = task
        return task

    def get_task(self, task_id: str) -> ImportTask | None:
        return self._tasks.get(task_id)

    def update_status(self, task_id: str, status: ImportTaskStatus, **kwargs: object) -> None:
        task = self._tasks.get(task_id)
        if task is None:
            return
        self._tasks[task_id] = task.model_copy(update={"status": status, **kwargs})

    def _cleanup_expired(self) -> None:
        now = datetime.now(timezone.utc)
        expired = [tid for tid, t in self._tasks.items() if now - t.created_at > _TASK_TTL]
        for tid in expired:
            del self._tasks[tid]


# Shared singleton — all modules must import this instance, not create their own
shared_import_task_service = ImportTaskService()
