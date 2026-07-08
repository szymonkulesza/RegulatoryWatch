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
      return { ok: false, error: `HTTP ${res.status} ${res.statusText}` };
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('html') && !contentType.includes('xml') && contentType !== '') {
      return { ok: false, error: `Unsupported content-type: ${contentType}` };
    }

    const html = await res.text();
    const text = htmlToCleanText(html);

    if (!text) {
      return { ok: false, error: 'No readable text content found on the page' };
    }

    const truncated = text.slice(0, MAX_CONTENT_CHARS);
    const hash = crypto.createHash('sha256').update(truncated).digest('hex');

    return { ok: true, text: truncated, hash };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.name === 'AbortError'
          ? `Timeout after ${FETCH_TIMEOUT_MS / 1000}s`
          : err.message
        : String(err);
    return { ok: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
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
