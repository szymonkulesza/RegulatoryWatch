"""FastAPI web application."""
import threading
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import config, email_sender
from .jobs import JobStatus, create_job, get_job
from .web_pipeline import run_for_job

app = FastAPI(title="FDA Warning Agent")

STATIC_DIR = Path(__file__).parent.parent / "static"
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
def index():
    return FileResponse(str(STATIC_DIR / "index.html"))


@app.post("/api/search")
def start_search(days_back: int = 7):
    job = create_job()
    thread = threading.Thread(
        target=run_for_job,
        args=(job.id,),
        kwargs={"days_back": days_back},
        daemon=True,
    )
    thread.start()
    return {"job_id": job.id}


@app.get("/api/status/{job_id}")
def job_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "id": job.id,
        "status": job.status,
        "progress": job.progress,
        "document_count": len(job.documents),
        "documents": job.documents if job.status == JobStatus.DONE else [],
        "error": job.error,
        "started_at": job.started_at,
        "finished_at": job.finished_at,
    }


@app.get("/api/recipients")
def list_recipients():
    return {"recipients": config.load_recipients()}


class SendRequest(BaseModel):
    job_id: str
    selected_urls: list[str]
    recipient_emails: list[str]


@app.post("/api/send")
def send_digest(req: SendRequest):
    job = get_job(req.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != JobStatus.DONE:
        raise HTTPException(status_code=400, detail="Job not complete yet")

    # Filter to selected documents only
    selected_docs = [d for d in job.documents if d["url"] in req.selected_urls]
    if not selected_docs:
        raise HTTPException(status_code=400, detail="No documents selected")

    all_recipients = config.load_recipients()
    recipients = [r for r in all_recipients if r["email"] in req.recipient_emails]
    if not recipients:
        raise HTTPException(status_code=400, detail="No valid recipients selected")

    email_sender.send_digest(selected_docs, recipients, dry_run=False)
    return {"sent": True, "document_count": len(selected_docs), "recipient_count": len(recipients)}
