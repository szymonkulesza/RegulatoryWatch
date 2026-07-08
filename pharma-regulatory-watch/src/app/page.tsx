'use client';

import { useState } from 'react';
import { REGULATORY_SOURCES } from '@/lib/sources';
import { PeriodSelection, RegulatoryChange, ReviseEvent, SourceStatus } from '@/lib/types';
import { PeriodSelector, computeDefaultPeriod } from '@/components/PeriodSelector';
import { SourceChecklist } from '@/components/SourceChecklist';
import { ResultsTable } from '@/components/ResultsTable';
import { ReviseStatus } from '@/components/ReviseStatus';
import { ExportButton } from '@/components/ExportButton';

function initialSelection(): Record<string, boolean> {
  return Object.fromEntries(REGULATORY_SOURCES.map((s) => [s.id, true]));
}

export default function Home() {
  const [selected, setSelected] = useState<Record<string, boolean>>(initialSelection());
  const [period, setPeriod] = useState<PeriodSelection>(computeDefaultPeriod('3m'));
  const [isRevising, setIsRevising] = useState(false);
  const [progress, setProgress] = useState<{ index: number; total: number; source: string } | null>(
    null
  );
  const [results, setResults] = useState<RegulatoryChange[]>([]);
  const [statuses, setStatuses] = useState<SourceStatus[]>([]);
  const [revisedAt, setRevisedAt] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const selectedIds = REGULATORY_SOURCES.filter((s) => selected[s.id]).map((s) => s.id);

  const handleToggle = (id: string) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleToggleAll = (value: boolean) => {
    setSelected(Object.fromEntries(REGULATORY_SOURCES.map((s) => [s.id, value])));
  };

  const handleRevise = async () => {
    if (selectedIds.length === 0) {
      setError('Select at least one source.');
      return;
    }

    setError(null);
    setIsRevising(true);
    setResults([]);
    setStatuses([]);
    setProgress({ index: 0, total: selectedIds.length, source: 'Initializing…' });

    try {
      const res = await fetch('/api/revise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceIds: selectedIds, period }),
      });

      if (!res.ok || !res.body) {
        const message = await res.text();
        throw new Error(message || `Server returned an error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const collectedResults: RegulatoryChange[] = [];
      const collectedStatuses: SourceStatus[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const event: ReviseEvent = JSON.parse(line);

          if (event.type === 'progress') {
            setProgress({ index: event.index, total: event.total, source: event.source });
          } else if (event.type === 'source_done') {
            collectedStatuses.push(event.status);
            collectedResults.push(...event.changes);
            setStatuses([...collectedStatuses]);
            setResults([...collectedResults]);
          } else if (event.type === 'done') {
            setRevisedAt(event.finishedAt);
          } else if (event.type === 'fatal') {
            throw new Error(event.message);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRevising(false);
      setProgress(null);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Pharma Regulatory Watch</h1>
        <p className="mt-1 text-sm text-slate-600">
          Monitoring changes in pharmaceutical industry legal regulations — Rezon Bio
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <SourceChecklist
            sources={REGULATORY_SOURCES}
            selected={selected}
            onToggle={handleToggle}
            onToggleAll={handleToggleAll}
            disabled={isRevising}
          />
          <PeriodSelector period={period} onChange={setPeriod} disabled={isRevising} />

          <button
            type="button"
            onClick={handleRevise}
            disabled={isRevising}
            className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRevising ? 'Revision in progress…' : 'Run Revision'}
          </button>

          {isRevising && progress && (
            <div className="rounded-lg border border-brand-100 bg-brand-50 p-3 text-sm text-brand-800">
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                <span>
                  Checking {progress.index}/{progress.total}: {progress.source}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="space-y-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Revision Results</h2>
            <ExportButton
              results={results}
              period={period}
              revisedAt={revisedAt || new Date().toISOString()}
              disabled={results.length === 0}
            />
          </div>

          <ResultsTable results={results} />

          <ReviseStatus statuses={statuses} />
        </div>
      </div>
    </main>
  );
}
