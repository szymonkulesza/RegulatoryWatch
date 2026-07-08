# FDA Warning Letter & 483 Monitoring Agent

Monitors FDA warning letters and Form 483 inspection observations weekly, filters for pharma manufacturing relevance using Claude AI, and sends a structured HTML digest by email.

## Covered Topics
- Biological manufacturing (biologics, vaccines, gene therapy)
- API / drug substance manufacturing
- Drug product manufacturing
- Data Integrity violations
- Computer System Validation (CSV) / 21 CFR Part 11
- Sterile / aseptic manufacturing
- GMP for excipients
- Combination products

## Quick Start

### 1. Clone & install

```bash
git clone https://github.com/szymonkulesza/fda-warning-agent.git
cd fda-warning-agent
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and fill in your keys
```

Required variables in `.env`:
| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (get at console.anthropic.com) |
| `GMAIL_USER` | Your Gmail address |
| `GMAIL_APP_PASSWORD` | Gmail App Password (see below) |
| `SCHEDULER_TIMEZONE` | Timezone string, e.g. `Europe/Warsaw` or `UTC` |

**Gmail App Password setup:**
1. Enable 2-Factor Authentication on your Google account
2. Go to Google Account → Security → App Passwords
3. Generate a password for "Mail" — use the 16-character code

### 3. Configure recipients

Copy `recipients.example.json` to `recipients.json` and edit it — add or remove entries freely (this file is gitignored so your real recipients never get committed):

```json
{
  "recipients": [
    {"name": "Your Name", "email": "you@example.com"},
    {"name": "Quality Manager", "email": "qm@yourcompany.com"}
  ]
}
```

### 4. Run

**Test run (no email sent):**
```bash
python main.py --dry-run
```

**Send digest immediately:**
```bash
python main.py --run-now
```

**Start weekly scheduler (Monday 8am):**
```bash
python main.py --schedule
```

**Look back further (e.g. catch up on 30 days):**
```bash
python main.py --run-now --days-back 30
```

## Docker Deployment (recommended for production)

```bash
cp .env.example .env
# Edit .env with your credentials

docker compose up -d
```

The SQLite database is stored in `./data/fda_agent.db` (persisted via volume mount).

Logs: `docker compose logs -f`

## How It Works

```
FDA Website → Scraper → Claude Classifier → Claude Summarizer → Email Digest
                  ↓
             SQLite DB (skip already-processed URLs)
```

1. **Scraper** fetches the FDA warning letters listing and 483 observation summaries page, extracts links published in the last 8 days, and downloads each document (HTML or PDF).
2. **Classifier** sends each document to Claude with a pharma-expert prompt to determine relevance. Irrelevant documents (food, cosmetics, devices, etc.) are excluded.
3. **Summarizer** extracts key findings, CFR citations, and a lesson for industry from each relevant document.
4. **Email digest** is sent every Monday at 8am to all recipients in `recipients.json`.

## Email Digest Format

Each document entry shows:
- Company name + country
- Document type badge (Warning Letter / Form 483)
- GMP category badges
- 3 key findings
- CFR citations
- Lesson for industry
- Link to original FDA document
