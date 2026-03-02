"""Unit tests for ImportTaskService (T012)."""

from datetime import datetime, timedelta, timezone

import pytest

from app.domain.import_task import ImportTaskStatus


class TestImportTaskService:
    def test_create_task_returns_unique_id(self):
        from app.services.import_task_service import ImportTaskService

        svc = ImportTaskService()
        t1 = svc.create_task()
        t2 = svc.create_task()
        assert t1.task_id != t2.task_id
        assert t1.status == ImportTaskStatus.PENDING

    def test_get_task(self):
        from app.services.import_task_service import ImportTaskService

        svc = ImportTaskService()
        created = svc.create_task()
        fetched = svc.get_task(created.task_id)
        assert fetched is not None
        assert fetched.task_id == created.task_id

    def test_get_task_not_found(self):
        from app.services.import_task_service import ImportTaskService

        svc = ImportTaskService()
        assert svc.get_task("nonexistent") is None

    def test_update_status_to_running(self):
        from app.services.import_task_service import ImportTaskService

        svc = ImportTaskService()
        task = svc.create_task()
        svc.update_status(task.task_id, ImportTaskStatus.RUNNING)
        updated = svc.get_task(task.task_id)
        assert updated is not None
        assert updated.status == ImportTaskStatus.RUNNING

    def test_update_status_to_completed(self):
        from app.services.import_task_service import ImportTaskService

        svc = ImportTaskService()
        task = svc.create_task()
        svc.update_status(
            task.task_id,
            ImportTaskStatus.COMPLETED,
            dataset_rid="ri.ontology.dataset.abc",
            row_count=100,
            column_count=5,
            duration_ms=1500,
        )
        updated = svc.get_task(task.task_id)
        assert updated is not None
        assert updated.status == ImportTaskStatus.COMPLETED
        assert updated.dataset_rid == "ri.ontology.dataset.abc"
        assert updated.row_count == 100
        assert updated.duration_ms == 1500

    def test_update_status_to_failed(self):
        from app.services.import_task_service import ImportTaskService

        svc = ImportTaskService()
        task = svc.create_task()
        svc.update_status(
            task.task_id,
            ImportTaskStatus.FAILED,
            error_code="IMPORT_ERROR",
            error_message="Connection refused",
        )
        updated = svc.get_task(task.task_id)
        assert updated is not None
        assert updated.status == ImportTaskStatus.FAILED
        assert updated.error_code == "IMPORT_ERROR"

    def test_cleanup_expired_tasks(self):
        from app.services.import_task_service import ImportTaskService

        svc = ImportTaskService()
        task = svc.create_task()
        # Manually set created_at to 2 hours ago
        svc._tasks[task.task_id] = task.model_copy(
            update={"created_at": datetime.now(timezone.utc) - timedelta(hours=2)}
        )
        svc._cleanup_expired()
        assert svc.get_task(task.task_id) is None

    def test_fresh_tasks_not_cleaned(self):
        from app.services.import_task_service import ImportTaskService

        svc = ImportTaskService()
        task = svc.create_task()
        svc._cleanup_expired()
        assert svc.get_task(task.task_id) is not None
