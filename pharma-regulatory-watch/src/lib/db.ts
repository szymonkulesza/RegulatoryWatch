import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

// SQLite file lives under ./data so it survives restarts of `npm run dev`.
// On Vercel the project filesystem is read-only except /tmp, which is wiped
// between invocations — swap this for a hosted DB (Turso/libSQL, Postgres,
// etc.) before relying on history persistence in that environment.
const DATA_DIR =
  process.env.VERCEL === '1'
    ? '/tmp'
    : path.join(process.cwd(), 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'regulatory_watch.db');

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id TEXT NOT NULL,
      url TEXT NOT NULL,
      content TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_snapshots_source_fetched
      ON snapshots (source_id, fetched_at DESC);
  `);
  return db;
}

export interface SnapshotRow {
  id: number;
  source_id: string;
  url: string;
  content: string;
  content_hash: string;
  fetched_at: string;
}

export function getLatestSnapshot(sourceId: string): SnapshotRow | undefined {
  return getDb()
    .prepare(
      `SELECT * FROM snapshots WHERE source_id = ? ORDER BY fetched_at DESC LIMIT 1`
    )
    .get(sourceId) as SnapshotRow | undefined;
}

export function saveSnapshot(params: {
  sourceId: string;
  url: string;
  content: string;
  contentHash: string;
  fetchedAt: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO snapshots (source_id, url, content, content_hash, fetched_at)
       VALUES (@sourceId, @url, @content, @contentHash, @fetchedAt)`
    )
    .run(params);
}

export function getSnapshotHistory(sourceId: string, limit = 20): SnapshotRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM snapshots WHERE source_id = ? ORDER BY fetched_at DESC LIMIT ?`
    )
    .all(sourceId, limit) as SnapshotRow[];
}
