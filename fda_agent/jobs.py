"""In-memory job store for background pipeline runs."""
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    ERROR = "error"


@dataclass
class Job:
    id: str
    status: JobStatus = JobStatus.PENDING
    progress: str = "Queued..."
    documents: list = field(default_factory=list)
    error: Optional[str] = None
    started_at: Optional[str] = None
    finished_at: Optional[str] = None


_store: dict[str, Job] = {}
_lock = threading.Lock()


def create_job() -> Job:
    job = Job(id=str(uuid.uuid4()))
    with _lock:
        _store[job.id] = job
    return job


def get_job(job_id: str) -> Optional[Job]:
    with _lock:
        return _store.get(job_id)


def update_job(job_id: str, **kwargs) -> None:
    with _lock:
        job = _store.get(job_id)
        if job:
            for k, v in kwargs.items():
                setattr(job, k, v)
