# Pharma Regulatory Watch

A web application for monitoring changes in pharmaceutical industry legal regulations for
**Rezon Bio**. It lets you pick regulatory sources (FDA, EMA, MHRA, PIC/S, ICH, GIF, EDQM, USP,
etc.) and an analysis period, then run a revision that fetches the current content of each page,
compares it against the last saved snapshot, and uses Claude (Anthropic API) to extract relevant
regulatory changes along with an assessment of their probability of applicability to Rezon Bio.

## Tech stack

- **Next.js 14 (App Router) + TypeScript** — full-stack in a single project
- **better-sqlite3** — history of page content snapshots (`snapshots` table)
- **Tailwind CSS** — UI styling
- **cheerio** — HTML parsing into clean text
- **@anthropic-ai/sdk** — content analysis via Claude (`claude-sonnet-4-5`)
- **xlsx (SheetJS)** — export of results to Excel (generated in the browser)

## Installation

```bash
cd pharma-regulatory-watch
npm install
```

## API key configuration

1. Copy `.env.local.example` to `.env.local`:

   ```bash
   cp .env.local.example .env.local
   ```

2. Paste your Anthropic API key (available at [console.anthropic.com](https://console.anthropic.com)):

   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

`.env.local` is in `.gitignore` — the key will never end up in the repository.

## Running locally

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## How a revision works

1. Select the sources on the list that should be checked (all are selected by default).
   The EDQM and USP entries lead to login pages (CAS) and are flagged with a "requires login"
   label — the app will still try to fetch them.
2. Choose the analysis period: last 3 months, last year, or a custom range (from–to).
3. Click **"Run Revision"**. For each selected source, the app:
   - fetches the current page content server-side (Next.js API route) and reduces the HTML to
     clean text,
   - compares it against the last saved snapshot in SQLite (if one exists),
   - sends both versions to Claude with a prompt containing the Rezon Bio company context and the
     selected analysis period, asking it to extract relevant regulatory changes as JSON,
   - saves a new content snapshot to SQLite (the history of previous revisions is preserved — new
     rows are appended, nothing is overwritten).
4. Fetch or analysis errors for a single source do not interrupt the whole revision — they are
   collected in the "Revision status" section as unavailable sources.
5. Results appear live in a table that can be sorted by the "Probability" column (click the
   header).
6. The **"Export to Excel"** button generates an `.xlsx` file with the results, the revision date,
   and the selected analysis period.

## Code structure

```
src/
  app/
    page.tsx              — main view (checklist, period selection, results, export)
    api/revise/route.ts   — API route: fetch + diff + Claude call + snapshot save (NDJSON streaming)
    layout.tsx, globals.css
  components/
    SourceChecklist.tsx    — source checkboxes
    PeriodSelector.tsx     — analysis period selection
    ResultsTable.tsx       — results table (sorting, colored badges)
    ReviseStatus.tsx       — list of sources that returned an error
    ExportButton.tsx       — export to Excel (SheetJS)
  lib/
    sources.ts             — static list of 21 monitored sources
    fetchPage.ts           — fetch + HTML-to-clean-text parsing (cheerio), timeouts, error handling
    anthropic.ts           — Anthropic API calls (prompt, JSON parsing)
    db.ts                  — SQLite (better-sqlite3): snapshot history
    types.ts               — shared TypeScript types
```

## Deploying to Vercel

The code is written with Vercel in mind (App Router, Node.js runtime for the API route), but one
thing needs attention: **the filesystem on Vercel is read-only outside of `/tmp`, which is
ephemeral** (wiped between function invocations). This means SQLite in its current form will not
retain snapshot history across requests in Vercel's serverless environment — for a production
deployment on Vercel it's recommended to swap `src/lib/db.ts` for a client of a hosted database
(e.g. Turso/libSQL, Neon/Postgres, Vercel Postgres) — the module interface (`getLatestSnapshot`,
`saveSnapshot`, `getSnapshotHistory`) can be reimplemented analogously without changes to the rest
of the app. For running locally (`npm run dev`) or on your own server/VPS, better-sqlite3 works
out of the box, with the database file at `./data/regulatory_watch.db`.

Also remember to set the `ANTHROPIC_API_KEY` environment variable in your Vercel project settings
(Project Settings → Environment Variables) — analogous to `.env.local` locally.

## Known limitations

- Some pages (e.g. EudraGMDP, CFR Search, the EDQM/USP login pages) are heavily JavaScript-rendered
  or require a session/login — the server-side fetch will only retrieve the initial HTML, which may
  result in little readable text or a "No readable text content found" error. Such sources are
  reported as unavailable in the "Revision status" section, while the rest of the revision proceeds
  normally.
- The analysis is based on the content of the currently rendered HTML of the page, not the full
  publication history of the source — for pages without clear dates on announcements, the model
  assesses content based on what is new/changed relative to the previously saved snapshot.
