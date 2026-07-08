'use client';

import { SourceStatus } from '@/lib/types';

interface Props {
  statuses: SourceStatus[];
}

export function ReviseStatus({ statuses }: Props) {
  const failed = statuses.filter((s) => !s.ok);

  if (statuses.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold text-slate-700">
        Revision status ({statuses.length} checked, {failed.length} errors)
      </h2>
      {failed.length === 0 ? (
        <p className="text-sm text-green-700">
          All selected sources responded successfully.
        </p>
      ) : (
        <ul className="space-y-1 text-sm">
          {failed.map((s) => (
            <li key={s.sourceId} className="flex items-start gap-2 text-red-700">
              <span className="mt-0.5 inline-block h-2 w-2 flex-shrink-0 rounded-full bg-red-500" />
              <span>
                <span className="font-medium">{s.source}</span> — source unavailable
                {s.error ? `: ${s.error}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
