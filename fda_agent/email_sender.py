"""Build and send HTML email digest via Gmail SMTP."""
import logging
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from . import config

logger = logging.getLogger(__name__)

HTML_TEMPLATE = """\
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {{ font-family: Arial, sans-serif; font-size: 14px; color: #222; background: #f5f5f5; }}
  .container {{ max-width: 900px; margin: 24px auto; background: #fff; border-radius: 6px;
               box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }}
  .header {{ background: #003366; color: #fff; padding: 20px 28px; }}
  .header h1 {{ margin: 0; font-size: 20px; }}
  .header p {{ margin: 4px 0 0; font-size: 13px; opacity: 0.85; }}
  .section-title {{ background: #e8eef5; color: #003366; font-weight: bold;
                    padding: 10px 18px; font-size: 15px; border-left: 4px solid #003366; }}
  .doc-card {{ border-bottom: 1px solid #e0e0e0; padding: 18px 24px; }}
  .doc-card:last-child {{ border-bottom: none; }}
  .doc-header {{ display: flex; justify-content: space-between; align-items: flex-start;
                 flex-wrap: wrap; gap: 8px; }}
  .company {{ font-size: 16px; font-weight: bold; color: #003366; }}
  .meta {{ font-size: 12px; color: #666; margin-top: 4px; }}
  .badge {{ display: inline-block; padding: 2px 8px; border-radius: 12px;
             font-size: 11px; font-weight: bold; margin-right: 4px; }}
  .badge-wl {{ background: #fde8e8; color: #c0392b; }}
  .badge-483 {{ background: #fff3cd; color: #856404; }}
  .badge-cat {{ background: #e8f4e8; color: #276221; }}
  .findings {{ margin: 12px 0 8px; }}
  .findings ul {{ margin: 6px 0 0; padding-left: 20px; }}
  .findings li {{ margin-bottom: 4px; }}
  .lesson {{ background: #f0f7ff; border-left: 3px solid #2980b9;
             padding: 8px 12px; margin-top: 10px; font-size: 13px; color: #1a5276; }}
  .cfr {{ font-size: 12px; color: #555; margin-top: 6px; }}
  .view-link {{ display: inline-block; margin-top: 10px; padding: 6px 14px;
                background: #003366; color: #fff !important; text-decoration: none;
                border-radius: 4px; font-size: 13px; }}
  .footer {{ background: #f0f0f0; color: #888; font-size: 11px;
             padding: 12px 24px; text-align: center; }}
  .no-docs {{ padding: 24px; color: #888; text-align: center; }}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>FDA Warning Letters &amp; 483s Digest</h1>
    <p>Week of {week_of} &mdash; {total} relevant document(s) found</p>
  </div>

  {sections}

  <div class="footer">
    This digest is generated automatically from the FDA public database.<br>
    To update recipients, edit <code>recipients.json</code>.
    Generated: {generated_at}
  </div>
</div>
</body>
</html>"""


def _render_doc(doc: dict) -> str:
    badge_class = "badge-wl" if doc["document_type"] == "Warning Letter" else "badge-483"
    categories_html = " ".join(
        f'<span class="badge badge-cat">{c}</span>'
        for c in doc.get("categories", [])
    )
    findings_html = ""
    if doc.get("key_findings"):
        items = "".join(f"<li>{f}</li>" for f in doc["key_findings"])
        findings_html = f'<div class="findings"><strong>Key Findings:</strong><ul>{items}</ul></div>'

    cfr_html = ""
    if doc.get("cfr_citations"):
        cfr_html = f'<div class="cfr"><strong>CFR Citations:</strong> {", ".join(doc["cfr_citations"])}</div>'

    lesson_html = ""
    if doc.get("lesson"):
        lesson_html = f'<div class="lesson"><strong>Lesson for Industry:</strong> {doc["lesson"]}</div>'

    country_str = f" &mdash; {doc['country']}" if doc.get("country") else ""

    return f"""
    <div class="doc-card">
      <div class="doc-header">
        <div>
          <div class="company">{doc['company']}</div>
          <div class="meta">
            <span class="badge {badge_class}">{doc['document_type']}</span>
            {categories_html}
          </div>
          <div class="meta">Date: {doc.get('date','N/A')}{country_str}</div>
        </div>
      </div>
      {findings_html}
      {cfr_html}
      {lesson_html}
      <a href="{doc['url']}" class="view-link">View Original Document &rarr;</a>
    </div>"""


def build_html(docs: list) -> str:
    warning_letters = [d for d in docs if d["document_type"] == "Warning Letter"]
    form_483s = [d for d in docs if d["document_type"] == "Form 483"]
    week_of = datetime.utcnow().strftime("%B %d, %Y")
    generated_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    sections = ""
    if warning_letters:
        cards = "".join(_render_doc(d) for d in warning_letters)
        sections += f'<div class="section-title">Warning Letters ({len(warning_letters)})</div>{cards}'
    if form_483s:
        cards = "".join(_render_doc(d) for d in form_483s)
        sections += f'<div class="section-title">Form 483 Observations ({len(form_483s)})</div>{cards}'
    if not sections:
        sections = '<div class="no-docs">No relevant documents found this week.</div>'

    return HTML_TEMPLATE.format(
        week_of=week_of,
        total=len(docs),
        sections=sections,
        generated_at=generated_at,
    )


def send_digest(docs: list, recipients: list, dry_run: bool = False) -> None:
    html = build_html(docs)
    week_of = datetime.utcnow().strftime("%Y-%m-%d")
    subject = f"FDA Warning Letters & 483s Digest - Week of {week_of}"

    if dry_run:
        logger.info("[DRY RUN] Would send digest with %d documents to %d recipients", len(docs), len(recipients))
        print("\n--- EMAIL PREVIEW ---")
        print(f"Subject: {subject}")
        print(f"Recipients: {[r['email'] for r in recipients]}")
        print(f"Documents included: {len(docs)}")
        for doc in docs:
            print(f"  - [{doc['document_type']}] {doc['company']} ({doc.get('date','')}) : {doc['url']}")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = config.GMAIL_USER
    msg["To"] = ", ".join(r["email"] for r in recipients)
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(config.GMAIL_USER, config.GMAIL_APP_PASSWORD)
            smtp.sendmail(
                config.GMAIL_USER,
                [r["email"] for r in recipients],
                msg.as_string(),
            )
        logger.info("Digest sent to %d recipients", len(recipients))
    except smtplib.SMTPException as exc:
        logger.error("Failed to send email: %s", exc)
        raise
