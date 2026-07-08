"""Summarize relevant documents using Claude API."""
import json
import logging
import time

import anthropic

from . import config

logger = logging.getLogger(__name__)

SUMMARY_PROMPT = """\
You are a pharmaceutical GMP expert reviewing an FDA regulatory document. Provide a concise, structured summary for a quality professional audience.

Document type: {document_type}
Company: {company}
Date: {date}
Relevant GMP categories: {categories}

Full document text (up to 6000 characters):
{text}

Respond ONLY with a JSON object:
{{
  "key_findings": [
    "Finding 1: brief description (include CFR citation if present)",
    "Finding 2: brief description",
    "Finding 3: brief description"
  ],
  "violation_types": ["e.g. Data Integrity", "Aseptic Process Failures"],
  "cfr_citations": ["21 CFR 211.68", "21 CFR Part 11"],
  "country": "country of the facility if determinable, else empty string",
  "lesson": "One actionable lesson for industry in 1-2 sentences"
}}

Limit key_findings to the 3 most significant findings. Be concise and factual."""


def summarize(doc: dict) -> dict:
    """Add summary fields to doc: key_findings, violation_types, cfr_citations, lesson."""
    prompt = SUMMARY_PROMPT.format(
        document_type=doc.get("document_type", ""),
        company=doc.get("company", ""),
        date=doc.get("date", ""),
        categories=", ".join(doc.get("categories", [])),
        text=doc.get("text_content", "")[:6000],
    )

    client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)

    for attempt in range(3):
        try:
            response = client.messages.create(
                model=config.CLAUDE_MODEL,
                max_tokens=512,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = response.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            result = json.loads(raw)
            doc["key_findings"] = result.get("key_findings", [])
            doc["violation_types"] = result.get("violation_types", [])
            doc["cfr_citations"] = result.get("cfr_citations", [])
            doc["lesson"] = result.get("lesson", "")
            if result.get("country") and not doc.get("country"):
                doc["country"] = result["country"]
            return doc
        except (anthropic.RateLimitError, anthropic.APIStatusError) as exc:
            logger.warning("Claude API error on summarize attempt %d: %s", attempt + 1, exc)
            time.sleep(2 ** attempt * 5)
        except (json.JSONDecodeError, KeyError, IndexError) as exc:
            logger.warning("Failed to parse summary response: %s", exc)
            break

    doc["key_findings"] = ["Summary unavailable"]
    doc["violation_types"] = []
    doc["cfr_citations"] = []
    doc["lesson"] = ""
    return doc
