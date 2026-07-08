"""APScheduler weekly job configuration."""
import logging

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

from . import config
from .pipeline import run

logger = logging.getLogger(__name__)


def start() -> None:
    scheduler = BlockingScheduler(timezone=config.SCHEDULER_TIMEZONE)
    scheduler.add_job(
        func=run,
        trigger=CronTrigger(day_of_week="mon", hour=8, minute=0),
        id="fda_weekly_digest",
        name="FDA Weekly Warning Letter Digest",
        misfire_grace_time=3600,
    )
    logger.info(
        "Scheduler started. Job: every Monday 08:00 %s", config.SCHEDULER_TIMEZONE
    )
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Scheduler stopped")
