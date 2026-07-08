"""Scrape FDA warning letters and 483 observation summaries."""
import io
import logging
import re
import time
from datetime import datetime, timedelta
from typing import Optional

import pdfplumber
import requests
from bs4 import BeautifulSoup

from . import config

logger = logging.getLogger(__name__)

FDA_BASE = "https://www.fda.gov"
WARNING_LETTERS_URL = (
    "https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations"
    "/compliance-actions-and-activities/warning-letters"
)
FORM_483_URL = (
    "https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations"
    "/inspection-references/inspection-observation-summaries"
)


def _get(url: str, retries: int = 3) -> Optional[requests.Response]:
    for attempt in range(retries):
        try:
            resp = requests.get(
                url,
                headers=config.REQUEST_HEADERS,
                timeout=config.REQUEST_TIMEOUT,
                allow_redirects=True,
            )
            resp.raise_for_status()
            return resp
        except requests.RequestException as exc:
            logger.warning("GET %s attempt %d failed: %s", url, attempt + 1, exc)
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
    return None


def _parse_date(text: str) -> Optional[datetime]:
    text = text.strip()
    for fmt in ("%m/%d/%Y", "%B %d, %Y", "%b %d, %Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def _text_from_html(soup: BeautifulSoup) -> str:
    for tag in soup(["script", "style", "nav", "header", "footer"]):
        tag.decompose()
    return " ".join(soup.get_text(separator=" ").split())


def _text_from_pdf(content: bytes) -> str:
    try:
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            pages = [page.extract_text() or "" for page in pdf.pages[:20]]
            return " ".join(pages)
    except Exception as exc:
        logger.warning("PDF extraction failed: %s", exc)
        return ""


def _fetch_document_text(url: str) -> tuple[str, str]:
    """Return (text_content, resolved_url)."""
    resp = _get(url)
    if resp is None:
        return "", url
    final_url = resp.url
    content_type = resp.headers.get("content-type", "")
    if "pdf" in content_type or final_url.lower().endswith(".pdf"):
        return _text_from_pdf(resp.content), final_url
    soup = BeautifulSoup(resp.text, "lxml")
    return _text_from_html(soup), final_url


def _extract_company_country(soup: BeautifulSoup, text: str) -> tuple[str, str]:
    company = ""
    country = ""

    # Try structured fields first
    for label in soup.find_all(["dt", "th", "strong", "b"]):
        label_text = label.get_text(strip=True).lower()
        sibling = label.find_next_sibling() or label.parent.find_next_sibling()
        if not sibling:
            continue
        value = sibling.get_text(strip=True)
        if "company" in label_text or "firm" in label_text or "recipient" in label_text:
            company = value
        if "country" in label_text or "location" in label_text:
            country = value

    # Fallback: title tag
    if not company:
        title_tag = soup.find("title")
        if title_tag:
            title_text = title_tag.get_text()
            # Title format: "Company Name - date"
            parts = title_text.split("|")
            if parts:
                company = parts[0].strip()

    return company, country


def scrape_warning_letters(days_back: int = 8) -> list[dict]:
    """Scrape warning letters issued in the last `days_back` days."""
    cutoff = datetime.utcnow() - timedelta(days=days_back)
    documents = []

    resp = _get(WARNING_LETTERS_URL)
    if resp is None:
        logger.error("Could not fetch warning letters listing page")
        return []

    soup = BeautifulSoup(resp.text, "lxml")

    # FDA warning letters table: columns are Company/Individual, Issuing Office, Subject, Issue Date
    table = soup.find("table")
    if not table:
        logger.warning("No table found on warning letters page")
        return []

    rows = table.find_all("tr")[1:]  # skip header
    for row in rows:
        cells = row.find_all(["td", "th"])
        if len(cells) < 4:
            continue

        link_tag = cells[0].find("a")
        if not link_tag:
            continue

        href = link_tag.get("href", "")
        if not href.startswith("http"):
            href = FDA_BASE + href

        date_text = cells[3].get_text(strip=True) if len(cells) > 3 else ""
        issue_date = _parse_date(date_text)

        if issue_date and issue_date < cutoff:
            continue

        company_name = cells[0].get_text(strip=True)
        subject = cells[2].get_text(strip=True) if len(cells) > 2 else ""

        documents.append({
            "url": href,
            "company": company_name,
            "subject": subject,
            "date": issue_date.strftime("%Y-%m-%d") if issue_date else date_text,
            "document_type": "Warning Letter",
            "country": "",
            "text_content": "",
        })

    logger.info("Found %d warning letter links from listing", len(documents))

    # Fetch detail pages
    for doc in documents:
        logger.debug("Fetching detail: %s", doc["url"])
        resp = _get(doc["url"])
        if resp is None:
            continue
        detail_soup = BeautifulSoup(resp.text, "lxml")
        doc["text_content"] = _text_from_html(detail_soup)
        _, country = _extract_company_country(detail_soup, doc["text_content"])
        if country:
            doc["country"] = country
        time.sleep(0.5)

    return documents


def scrape_483s(days_back: int = 8) -> list[dict]:
    """Scrape Form 483 observation summaries from the last `days_back` days."""
    cutoff = datetime.utcnow() - timedelta(days=days_back)
    documents = []

    resp = _get(FORM_483_URL)
    if resp is None:
        logger.error("Could not fetch 483 listing page")
        return []

    soup = BeautifulSoup(resp.text, "lxml")

    # 483 page has a table with columns: Firm Name, FEI Number, Inspection End Date, Download
    table = soup.find("table")
    if not table:
        logger.warning("No table found on 483 page")
        return []

    rows = table.find_all("tr")[1:]
    for row in rows:
        cells = row.find_all(["td", "th"])
        if len(cells) < 3:
            continue

        company_name = cells[0].get_text(strip=True)
        date_text = cells[2].get_text(strip=True) if len(cells) > 2 else ""
        issue_date = _parse_date(date_text)

        if issue_date and issue_date < cutoff:
            continue

        # Find PDF link
        link_tag = row.find("a")
        if not link_tag:
            continue
        href = link_tag.get("href", "")
        if not href.startswith("http"):
            href = FDA_BASE + href

        text_content, resolved_url = _fetch_document_text(href)

        documents.append({
            "url": resolved_url,
            "company": company_name,
            "subject": "FDA Form 483 Inspectional Observations",
            "date": issue_date.strftime("%Y-%m-%d") if issue_date else date_text,
            "document_type": "Form 483",
            "country": "",
            "text_content": text_content,
        })
        time.sleep(0.5)

    logger.info("Found %d Form 483 entries", len(documents))
    return documents
