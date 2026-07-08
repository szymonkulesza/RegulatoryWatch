'use client';

import { PeriodSelection, PeriodPreset } from '@/lib/types';

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function computeDefaultPeriod(preset: PeriodPreset = '3m'): PeriodSelection {
  const to = new Date();
  const from = new Date();

  if (preset === '1y') {
    from.setFullYear(from.getFullYear() - 1);
  } else {
    from.setMonth(from.getMonth() - 3);
  }

  return {
    preset,
    from: toIsoDate(from),
    to: toIsoDate(to),
    label: preset === '1y' ? 'Last year' : 'Last 3 months',
  };
}

interface Props {
  period: PeriodSelection;
  onChange: (period: PeriodSelection) => void;
  disabled?: boolean;
}

export function PeriodSelector({ period, onChange, disabled }: Props) {
  const setPreset = (preset: PeriodPreset) => {
    if (preset === 'custom') {
      const to = new Date();
      const from = new Date();
      from.setMonth(from.getMonth() - 3);
      onChange({
        preset: 'custom',
        from: toIsoDate(from),
        to: toIsoDate(to),
        label: 'Custom range',
      });
    } else {
      onChange(computeDefaultPeriod(preset));
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Analysis period</h2>
      <div className="flex flex-wrap gap-2">
        {(
          [
            { value: '3m', label: 'Last 3 months' },
            { value: '1y', label: 'Last year' },
            { value: 'custom', label: 'Custom range' },
          ] as { value: PeriodPreset; label: string }[]
        ).map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => setPreset(opt.value)}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              period.preset === opt.value
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {period.preset === 'custom' && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            From
            <input
              type="date"
              value={period.from}
              disabled={disabled}
              max={period.to}
              onChange={(e) =>
                onChange({ ...period, from: e.target.value, label: 'Custom range' })
              }
              className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            To
            <input
              type="date"
              value={period.to}
              disabled={disabled}
              min={period.from}
              onChange={(e) =>
                onChange({ ...period, to: e.target.value, label: 'Custom range' })
              }
              className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
            />
          </label>
        </div>
      )}

      <p className="mt-2 text-xs text-slate-500">
        Selected range: <span className="font-medium">{period.from}</span> —{' '}
        <span className="font-medium">{period.to}</span>
      </p>
    </div>
  );
}
