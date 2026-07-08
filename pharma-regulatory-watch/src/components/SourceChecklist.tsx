'use client';

import { RegulatorySource } from '@/lib/types';

interface Props {
  sources: RegulatorySource[];
  selected: Record<string, boolean>;
  onToggle: (id: string) => void;
  onToggleAll: (value: boolean) => void;
  disabled?: boolean;
}

export function SourceChecklist({ sources, selected, onToggle, onToggleAll, disabled }: Props) {
  const selectedCount = sources.filter((s) => selected[s.id]).length;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">
          Monitored sources ({selectedCount}/{sources.length})
        </h2>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onToggleAll(true)}
            className="text-brand-700 hover:underline disabled:opacity-50"
          >
            Select all
          </button>
          <span className="text-slate-300">|</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onToggleAll(false)}
            className="text-brand-700 hover:underline disabled:opacity-50"
          >
            Deselect all
          </button>
        </div>
      </div>

      <ul className="max-h-[28rem] space-y-1 overflow-y-auto pr-1">
        {sources.map((s) => (
          <li key={s.id}>
            <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={!!selected[s.id]}
                disabled={disabled}
                onChange={() => onToggle(s.id)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
              />
              <span className="text-sm leading-tight">
                <span className="font-medium text-slate-800">{s.source}</span>
                <span className="text-slate-500"> — {s.area}</span>
                {s.requiresLogin && (
                  <span
                    title="Requires login — may not be available for automatic scanning"
                    className="ml-1.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700"
                  >
                    requires login
                  </span>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
