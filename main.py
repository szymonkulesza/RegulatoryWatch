#!/usr/bin/env python3
"""
FDA Warning Letter & 483 Monitoring Agent

Usage:
  python main.py --web              Start web app (default: http://localhost:8000)
  python main.py --run-now          Run the pipeline immediately and send email
  python main.py --dry-run          Run pipeline but print results instead of sending
  python main.py --schedule         Start weekly scheduler (Monday 8am)
  python main.py --days-back 14     Override the look-back window (default: 8 days)
  python main.py --port 8080        Web server port (default: 8000)
"""
import argparse
import sys

from fda_agent.config import setup_logging

setup_logging()

import logging
logger = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(description="FDA Warning Letter Monitoring Agent")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--web", action="store_true", help="Start interactive web app")
    group.add_argument("--run-now", action="store_true", help="Run pipeline immediately")
    group.add_argument("--dry-run", action="store_true", help="Run pipeline, print results, do not send email")
    group.add_argument("--schedule", action="store_true", help="Start weekly scheduler")
    parser.add_argument("--days-back", type=int, default=8, help="How many days back to look (default: 8)")
    parser.add_argument("--port", type=int, default=8000, help="Web server port (default: 8000)")
    args = parser.parse_args()

    if args.web:
        import uvicorn
        from fda_agent.web import app
        logger.info("Starting web app on http://localhost:%d", args.port)
        uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="info")
    elif args.schedule:
        from fda_agent.scheduler import start
        logger.info("Starting scheduler mode")
        start()
    elif args.run_now or args.dry_run:
        from fda_agent.pipeline import run
        run(dry_run=args.dry_run, days_back=args.days_back)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
