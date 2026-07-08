import sqlite3
from datetime import datetime
from pathlib import Path

from . import config


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS processed_documents (
                url TEXT PRIMARY KEY,
                title TEXT,
                company TEXT,
                document_type TEXT,
                processed_at TEXT NOT NULL,
                included INTEGER NOT NULL DEFAULT 0
            )
        """)
        conn.commit()


def is_processed(url: str) -> bool:
    with _connect() as conn:
        row = conn.execute(
            "SELECT 1 FROM processed_documents WHERE url = ?", (url,)
        ).fetchone()
        return row is not None


def mark_processed(url: str, title: str, company: str, document_type: str, included: bool) -> None:
    with _connect() as conn:
        conn.execute(
            """INSERT OR IGNORE INTO processed_documents
               (url, title, company, document_type, processed_at, included)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (url, title, company, document_type, datetime.utcnow().isoformat(), int(included)),
        )
        conn.commit()
