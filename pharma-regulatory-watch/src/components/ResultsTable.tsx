'use client';

import { useMemo, useState } from 'react';
import { Probability, RegulatoryChange } from '@/lib/types';

const PROBABILITY_ORDER: Record<Probability, number> = { high: 3, medium: 2, low: 1 };

const BADGE_STYLES: Record<Probability, string> = {
  high: 'bg-red-100 text-red-800 border-red-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  low: 'bg-green-100 text-green-800 border-green-300',
};

const BADGE_LABELS: Record<Probability, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

interface Props {
  results: RegulatoryChange[];
}

export function ResultsTable({ results }: Props) {
  const [sortDir, setSortDir] = useState<'desc' | 'asc' | null>('desc');

  const sorted = useMemo(() => {
    if (!sortDir) return results;
    const copy = [...results];
    copy.sort((a, b) => {
      const diff = PROBABILITY_ORDER[a.probability] - PROBABILITY_ORDER[b.probability];
      return sortDir === 'desc' ? -diff : diff;
    });
    return copy;
  }, [results, sortDir]);

  const cycleSort = () => {
    setSortDir((prev) => (prev === 'desc' ? 'asc' : prev === 'asc' ? null : 'desc'));
  };

  if (results.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
        No results to display yet. Run a revision to see detected regulatory changes.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Short description</th>
              <th className="px-4 py-3 font-semibold">Source</th>
              <th className="px-4 py-3 font-semibold">
                <button
                  type="button"
                  onClick={cycleSort}
                  className="flex items-center gap-1 font-semibold hover:text-slate-900"
                >
                  Probability
                  <span className="text-[10px]">
                    {sortDir === 'desc' ? '▼' : sortDir === 'asc' ? '▲' : '↕'}
                  </span>
                </button>
              </th>
              <th className="px-4 py-3 font-semibold">Interpretation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((row, idx) => (
              <tr key={idx} className="align-top hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-800">{row.short_description}</td>
                <td className="px-4 py-3">
                  <a
                    href={row.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-700 hover:underline"
                  >
                    {row.source}
                  </a>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${BADGE_STYLES[row.probability]}`}
                  >
                    {BADGE_LABELS[row.probability]}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{row.interpretation || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
