"""Pipeline variant that writes progress to the job store."""
import logging

from . import config, database, scraper, classifier, summarizer
from .jobs import JobStatus, update_job

logger = logging.getLogger(__name__)


def run_for_job(job_id: str, days_back: int = 7) -> None:
    """Run the full pipeline and store results in the job store."""
    from datetime import datetime

    update_job(job_id,
               status=JobStatus.RUNNING,
               started_at=datetime.utcnow().isoformat(),
               progress="Initialising database...")
    database.init_db()

    try:
        update_job(job_id, progress="Scraping FDA warning letters...")
        warning_letters = scraper.scrape_warning_letters(days_back=days_back)

        update_job(job_id, progress="Scraping FDA Form 483 observations...")
        form_483s = scraper.scrape_483s(days_back=days_back)

        all_docs = warning_letters + form_483s
        new_docs = [d for d in all_docs if not database.is_processed(d["url"])]

        update_job(job_id,
                   progress=f"Found {len(new_docs)} new documents. Classifying with Claude AI...")

        relevant = []
        for i, doc in enumerate(new_docs):
            update_job(job_id,
                       progress=f"Classifying document {i+1}/{len(new_docs)}: {doc['company']}...")
            doc = classifier.classify(doc)
            if doc.get("relevant"):
                update_job(job_id,
                           progress=f"Summarising: {doc['company']}...")
                doc = summarizer.summarize(doc)
                relevant.append(doc)

        update_job(job_id,
                   status=JobStatus.DONE,
                   progress=f"Complete. {len(relevant)} relevant document(s) found.",
                   documents=relevant,
                   finished_at=datetime.utcnow().isoformat())

    except Exception as exc:
        logger.exception("Pipeline failed for job %s", job_id)
        update_job(job_id,
                   status=JobStatus.ERROR,
                   error=str(exc),
                   progress="Pipeline failed — see logs.")
