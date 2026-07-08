import json
import logging
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

ANTHROPIC_API_KEY: str = os.environ.get("ANTHROPIC_API_KEY", "")
GMAIL_USER: str = os.environ.get("GMAIL_USER", "")
GMAIL_APP_PASSWORD: str = os.environ.get("GMAIL_APP_PASSWORD", "")
SCHEDULER_TIMEZONE: str = os.getenv("SCHEDULER_TIMEZONE", "UTC")
LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
DB_PATH: Path = DATA_DIR / "fda_agent.db"
RECIPIENTS_FILE: Path = BASE_DIR / "recipients.json"
CLAUDE_MODEL: str = "claude-sonnet-4-6"

RELEVANCE_CATEGORIES = [
    "biological manufacturing",
    "API (active pharmaceutical ingredient) manufacturing",
    "drug substance manufacturing",
    "drug product manufacturing",
    "data integrity",
    "computer system validation (CSV)",
    "sterile manufacturing / aseptic processing",
    "GMP for excipients",
    "combination products",
]

REQUEST_TIMEOUT = 30
REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; FDAWarningAgent/1.0; "
        "+https://github.com/szymonkulesza/fda-warning-agent)"
    )
}


def load_recipients() -> list:
    with open(RECIPIENTS_FILE) as f:
        return json.load(f)["recipients"]


def setup_logging() -> None:
    logging.basicConfig(
        level=getattr(logging, LOG_LEVEL.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
