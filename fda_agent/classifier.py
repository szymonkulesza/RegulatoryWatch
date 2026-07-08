"""Classify documents for relevance using Claude API."""
import json
import logging
import time

import anthropic

from . import config

logger = logging.getLogger(__name__)
_client = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
    return _client


CLASSIFICATION_PROMPT = """\
You are a pharmaceutical GMP expert. Analyze the following FDA regulatory document and determine if it is relevant to any of these topics:
- Biological manufacturing (biologics, vaccines, blood products, gene therapy)
- API (Active Pharmaceutical Ingredient) / drug substance manufacturing
- Drug product manufacturing (finished dosage forms)
- Data Integrity violations (audit trails, raw data, ALCOA+)
- Computer System Validation (CSV) / 21 CFR Part 11
- Sterile manufacturing / aseptic processing
- GMP for excipients
- Combination products (drug-device)

Exclude documents primarily about: food, cosmetics, tobacco, dietary supplements, veterinary products (unless they involve the above), or medical devices without drug component.

Document type: {document_type}
Company: {company}
Subject/Title: {subject}

Document text (first 3000 characters):
{text_snippet}

Respond ONLY with a JSON object:
{{
  "relevant": true or false,
  "categories": ["list", "of", "matched", "categories"],
  "reasoning": "one sentence explanation"
}}"""


def classify(doc: dict) -> dict:
    """Return doc with added keys: relevant (bool), categories (list), reasoning (str)."""
    text_snippet = doc.get("text_content", "")[:3000]
    prompt = CLASSIFICATION_PROMPT.format(
        document_type=doc.get("document_type", ""),
        company=doc.get("company", ""),
        subject=doc.get("subject", ""),
        text_snippet=text_snippet,
    )

    for attempt in range(3):
        try:
            response = _get_client().messages.create(
                model=config.CLAUDE_MODEL,
                max_tokens=256,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = response.content[0].text.strip()
            # Strip markdown fences if present
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            result = json.loads(raw)
            doc["relevant"] = bool(result.get("relevant", False))
            doc["categories"] = result.get("categories", [])
            doc["reasoning"] = result.get("reasoning", "")
            return doc
        except (anthropic.RateLimitError, anthropic.APIStatusError) as exc:
            logger.warning("Claude API error on classify attempt %d: %s", attempt + 1, exc)
            time.sleep(2 ** attempt * 5)
        except (json.JSONDecodeError, KeyError, IndexError) as exc:
            logger.warning("Failed to parse classification response: %s", exc)
            break

    doc["relevant"] = False
    doc["categories"] = []
    doc["reasoning"] = "Classification failed"
    return doc
