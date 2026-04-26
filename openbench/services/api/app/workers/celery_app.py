from __future__ import annotations

from celery import Celery

from app.core.config import settings

celery = Celery(
    "openbench",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.workers.tasks"],
)
celery.conf.update(
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_default_retry_delay=10,
    task_max_retries=3,
)

# Daily retention sweep — applies each org's retention_policy_days to purge
# completed/cancelled runs older than the cutoff. Admins can also trigger it
# on demand via /api/admin/retention/purge.
celery.conf.beat_schedule = {
    "retention-purge-daily": {
        "task": "openbench.purge_retention",
        "schedule": 24 * 60 * 60,
    },
}
