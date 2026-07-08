import Anthropic from '@anthropic-ai/sdk';
import { PeriodSelection, RegulatoryChange, RegulatorySource } from './types';

const MODEL = 'claude-sonnet-4-5';

const COMPANY_CONTEXT = `Rezon Bio is a biotechnology/pharmaceutical company that manufactures
biological medicinal products (biologics). It operates under an eQMS/GxP regime (GMP, GDP,
computer system validation) and sells/registers products in the EU, Poland, US, and Canada
markets. It is particularly interested in: changes to GMP for biological products, requirements
for electronic records/signatures (21 CFR Part 11), inspections and warning letters concerning
biological manufacturing, biosimilars, and changes to pharmaceutical law in the EU/Poland/US/Canada.`;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const hint = process.env.VERCEL
      ? 'Add it in Vercel → Project Settings → Environment Variables, then redeploy (env var changes do not apply to existing deployments).'
      : 'Add it to .env.local (see .env.local.example), then restart the dev server.';
    throw new Error(`ANTHROPIC_API_KEY is not set. ${hint}`);
  }
  client = new Anthropic({ apiKey });
  return client;
}

function buildPrompt(params: {
  source: RegulatorySource;
  currentText: string;
  previousText: string | null;
  period: PeriodSelection;
}): string {
  const { source, currentText, previousText, period } = params;

  return `Company context:
${COMPANY_CONTEXT}

Task: Analyze the following regulatory page content and identify RELEVANT regulatory changes
(new guidance, document updates, announcements, warning letters, changes in law) that fall within
the selected analysis period: ${period.label} (from ${period.from} to ${period.to}).

Source: ${source.source} — ${source.area}
URL: ${source.url}

=== CURRENT PAGE CONTENT (text cleaned of HTML) ===
${currentText || '(no content — the page may not have returned readable text)'}

${
  previousText
    ? `=== PREVIOUSLY SAVED CONTENT (from the last revision) ===\n${previousText}\n\nCompare both versions and pay particular attention to what is new or changed compared to the previous version.`
    : '=== NO PREVIOUS VERSION ===\nThis is the first revision of this source — assess the page content for changes/announcements that fall within the selected analysis period.'
}

Return ONLY valid JSON — an array of objects, with no text before or after, and no markdown blocks.
Each object has the structure:
{
  "short_description": "short description of the change",
  "source": "${source.source}",
  "source_url": "${source.url}",
  "probability": "high" | "medium" | "low",
  "interpretation": "a short, practical interpretation (2-4 sentences) of what this may mean for Rezon Bio, or an empty string if it cannot be clearly assessed"
}

Assess "probability" based on how likely the change is to apply to Rezon Bio (biological
manufacturing, GxP/eQMS, EU/Poland/US/Canada markets).

If no relevant changes within the selected period were detected, return an empty array: []`;
}

function extractJsonArray(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\[[\s\S]*\]/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error('Model response was not valid JSON');
  }
}

function isValidChange(item: unknown): item is RegulatoryChange {
  if (!item || typeof item !== 'object') return false;
  const c = item as Record<string, unknown>;
  return (
    typeof c.short_description === 'string' &&
    typeof c.source === 'string' &&
    typeof c.source_url === 'string' &&
    (c.probability === 'high' || c.probability === 'medium' || c.probability === 'low') &&
    typeof c.interpretation === 'string'
  );
}

export async function analyzeSourceWithClaude(params: {
  source: RegulatorySource;
  currentText: string;
  previousText: string | null;
  period: PeriodSelection;
}): Promise<RegulatoryChange[]> {
  const prompt = buildPrompt(params);

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    return [];
  }

  const parsed = extractJsonArray(textBlock.text);
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter(isValidChange);
}
