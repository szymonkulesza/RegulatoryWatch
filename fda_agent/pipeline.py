"""Main pipeline: scrape -> classify -> summarize -> email."""
import logging

from . import config, database, scraper, classifier, summarizer, email_sender

logger = logging.getLogger(__name__)


def run(dry_run: bool = False, days_back: int = 8) -> None:
    database.init_db()
    recipients = config.load_recipients()

    logger.info("Starting FDA agent pipeline (days_back=%d, dry_run=%s)", days_back, dry_run)

    # Scrape
    all_docs = []
    all_docs.extend(scraper.scrape_warning_letters(days_back=days_back))
    all_docs.extend(scraper.scrape_483s(days_back=days_back))
    logger.info("Total documents scraped: %d", len(all_docs))

    # Filter already processed
    new_docs = [d for d in all_docs if not database.is_processed(d["url"])]
    logger.info("New (unprocessed) documents: %d", len(new_docs))

    # Classify
    relevant_docs = []
    for doc in new_docs:
        doc = classifier.classify(doc)
        included = doc.get("relevant", False)
        if included:
            doc = summarizer.summarize(doc)
            relevant_docs.append(doc)
        if not dry_run:
            database.mark_processed(
                url=doc["url"],
                title=doc.get("subject", ""),
                company=doc.get("company", ""),
                document_type=doc["document_type"],
                included=included,
            )
        logger.info(
            "[%s] %s — relevant=%s categories=%s",
            doc["document_type"], doc["company"], included, doc.get("categories", [])
        )

    logger.info("Relevant documents after classification: %d", len(relevant_docs))

    # Send digest (always send, even if empty, so recipients know the agent ran)
    email_sender.send_digest(relevant_docs, recipients, dry_run=dry_run)
