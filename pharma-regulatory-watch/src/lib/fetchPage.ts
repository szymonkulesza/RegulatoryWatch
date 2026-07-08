import * as cheerio from 'cheerio';
import crypto from 'crypto';

const FETCH_TIMEOUT_MS = 20_000;
const MAX_CONTENT_CHARS = 20_000;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 PharmaRegulatoryWatch/1.0';

export interface FetchResult {
  ok: boolean;
  text?: string;
  hash?: string;
  error?: string;
}

/**
 * Fetches a URL server-side and reduces the HTML to clean, whitespace-collapsed
 * text so it can be diffed and fed to the LLM. Never throws — failures are
 * reported in the returned object so one bad source doesn't abort the batch.
 */
export async function fetchPageAsText(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,pl;q=0.8',
      },
    });

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status} ${res.statusText}${httpStatusHint(res.status)}` };
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('html') && !contentType.includes('xml') && contentType !== '') {
      return {
        ok: false,
        error: `Server returned "${contentType}" instead of a web page (e.g. a PDF or file download) — this source can't be parsed as text`,
      };
    }

    const html = await res.text();
    const text = htmlToCleanText(html);

    if (!text) {
      return {
        ok: false,
        error:
          'The page loaded but contained no readable text — it likely renders its content via JavaScript or requires a login session, neither of which the server-side fetch can execute',
      };
    }

    const truncated = text.slice(0, MAX_CONTENT_CHARS);
    const hash = crypto.createHash('sha256').update(truncated).digest('hex');

    return { ok: true, text: truncated, hash };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.name === 'AbortError'
          ? `No response after ${FETCH_TIMEOUT_MS / 1000}s — the site is slow, unreachable, or silently blocking automated requests`
          : networkErrorHint(err)
        : String(err);
    return { ok: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

function httpStatusHint(status: number): string {
  if (status === 403) return ' — the site is blocking this request (bot/WAF protection or geo-restriction)';
  if (status === 404) return ' — the page has moved or been removed; the URL in sources.ts likely needs updating';
  if (status === 401) return ' — the page requires authentication';
  if (status === 429) return ' — rate limited by the site; try again later';
  if (status >= 500) return ' — the source server is having issues (not something we can fix on our end)';
  return '';
}

function networkErrorHint(err: Error): string {
  const cause = (err as { cause?: { code?: string } }).cause;
  const code = cause?.code;
  if (code === 'ENOTFOUND') return `Could not resolve the domain (DNS lookup failed) — check the URL is still valid`;
  if (code === 'ECONNREFUSED') return `Connection refused by the server`;
  if (code === 'ECONNRESET') return `Connection was reset by the server mid-request`;
  if (code === 'CERT_HAS_EXPIRED' || code?.startsWith('ERR_TLS')) return `TLS/certificate error connecting to the site`;
  return err.message;
}

function htmlToCleanText(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, noscript, svg, iframe').remove();

  const main = $('main, article').first();
  const scope = main.length ? main : $('body');

  const raw = scope.text();
  return raw
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');
}
