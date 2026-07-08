import { NextRequest } from 'next/server';
import { REGULATORY_SOURCES } from '@/lib/sources';
import { fetchPageAsText } from '@/lib/fetchPage';
import { analyzeSourceWithClaude } from '@/lib/anthropic';
import { getLatestSnapshot, saveSnapshot } from '@/lib/db';
import { PeriodSelection, ReviseEvent } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface RevisePayload {
  sourceIds: string[];
  period: PeriodSelection;
}

export async function POST(req: NextRequest) {
  let payload: RevisePayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const { sourceIds, period } = payload;
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
    return new Response('sourceIds must be a non-empty array', { status: 400 });
  }
  if (!period || !period.from || !period.to) {
    return new Response('period is required', { status: 400 });
  }

  const selectedSources = REGULATORY_SOURCES.filter((s) => sourceIds.includes(s.id));

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ReviseEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      };

      try {
        for (let i = 0; i < selectedSources.length; i++) {
          const source = selectedSources[i];

          send({
            type: 'progress',
            index: i + 1,
            total: selectedSources.length,
            sourceId: source.id,
            source: `${source.source} — ${source.area}`,
          });

          try {
            const fetchResult = await fetchPageAsText(source.url);

            if (!fetchResult.ok || !fetchResult.text) {
              send({
                type: 'source_done',
                status: {
                  sourceId: source.id,
                  source: source.source,
                  url: source.url,
                  ok: false,
                  error: fetchResult.error || 'Unknown fetch error',
                  changesFound: 0,
                },
                changes: [],
              });
              continue;
            }

            const previous = getLatestSnapshot(source.id);

            let changes;
            try {
              changes = await analyzeSourceWithClaude({
                source,
                currentText: fetchResult.text,
                previousText: previous ? previous.content : null,
                period,
              });
            } catch (claudeErr) {
              const message =
                claudeErr instanceof Error ? claudeErr.message : String(claudeErr);
              send({
                type: 'source_done',
                status: {
                  sourceId: source.id,
                  source: source.source,
                  url: source.url,
                  ok: false,
                  error: `Claude analysis error: ${message}`,
                  changesFound: 0,
                },
                changes: [],
              });
              // Still persist the snapshot even if analysis failed, so the
              // next revision has an up-to-date diff base.
              saveSnapshot({
                sourceId: source.id,
                url: source.url,
                content: fetchResult.text,
                contentHash: fetchResult.hash || '',
                fetchedAt: new Date().toISOString(),
              });
              continue;
            }

            saveSnapshot({
              sourceId: source.id,
              url: source.url,
              content: fetchResult.text,
              contentHash: fetchResult.hash || '',
              fetchedAt: new Date().toISOString(),
            });

            send({
              type: 'source_done',
              status: {
                sourceId: source.id,
                source: source.source,
                url: source.url,
                ok: true,
                changesFound: changes.length,
              },
              changes,
            });
          } catch (sourceErr) {
            const message = sourceErr instanceof Error ? sourceErr.message : String(sourceErr);
            send({
              type: 'source_done',
              status: {
                sourceId: source.id,
                source: source.source,
                url: source.url,
                ok: false,
                error: message,
                changesFound: 0,
              },
              changes: [],
            });
          }
        }

        send({ type: 'done', period, finishedAt: new Date().toISOString() });
      } catch (fatalErr) {
        const message = fatalErr instanceof Error ? fatalErr.message : String(fatalErr);
        send({ type: 'fatal', message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
