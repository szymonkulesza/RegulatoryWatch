export type Probability = 'high' | 'medium' | 'low';

export interface RegulatorySource {
  id: string;
  source: string;
  area: string;
  url: string;
  requiresLogin?: boolean;
}

export type PeriodPreset = '3m' | '1y' | 'custom';

export interface PeriodSelection {
  preset: PeriodPreset;
  from: string; // ISO date (YYYY-MM-DD)
  to: string; // ISO date (YYYY-MM-DD)
  label: string;
}

export interface RegulatoryChange {
  short_description: string;
  source: string;
  source_url: string;
  probability: Probability;
  interpretation: string;
}

export interface SourceStatus {
  sourceId: string;
  source: string;
  url: string;
  ok: boolean;
  error?: string;
  changesFound: number;
}

export type ReviseEvent =
  | { type: 'progress'; index: number; total: number; sourceId: string; source: string }
  | { type: 'source_done'; status: SourceStatus; changes: RegulatoryChange[] }
  | { type: 'done'; period: PeriodSelection; finishedAt: string }
  | { type: 'fatal'; message: string };
