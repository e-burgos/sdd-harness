export interface UsageEntry {
  agent: string | null;
  model: string | null;
  tokensIn: number;
  tokensOut: number;
  approx: boolean;
}

export interface UsageRecord extends UsageEntry {
  origin: string;
}

export interface PricingTable {
  prices: Record<string, { input: number; output: number }>;
  currency: string;
}

export interface CostBucket {
  key: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  units: number;
  approxUnits: number;
  assumed: boolean;
}

export interface CostTotals {
  tokensIn: number;
  tokensOut: number;
  cost: number;
  units: number;
  approxUnits: number;
}

export const ASSUMED_TIER = 'claude/sonnet';
export const UNKNOWN_KEY = '_unknown';
const LEGACY_TIERS = new Set(['haiku', 'sonnet', 'opus', 'fable']);

type Json = Record<string, unknown>;

const asRecord = (value: unknown): Json | null => (typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : null);
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asCount = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0);
const asText = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value : null);

export function normalizeModel(model: string | null): string | null {
  if (model === null) return null;
  return LEGACY_TIERS.has(model) ? `claude/${model}` : model;
}

export function parsePricing(raw: Record<string, unknown> | null | undefined): PricingTable | null {
  const table = asRecord(raw?.model_prices_per_mtok);
  if (table === null) return null;
  const prices: PricingTable['prices'] = {};
  for (const [model, value] of Object.entries(table)) {
    const price = asRecord(value);
    if (price === null) continue;
    const input = price.input;
    const output = price.output;
    if (typeof input === 'number' && Number.isFinite(input) && typeof output === 'number' && Number.isFinite(output)) prices[model] = { input, output };
  }
  if (Object.keys(prices).length === 0) return null;
  return { prices, currency: asText(raw?.currency) ?? 'USD' };
}

export function costOf(entry: UsageEntry, pricing: PricingTable): { cost: number; assumed: boolean } {
  const key = normalizeModel(entry.model);
  const known = key === null ? undefined : pricing.prices[key];
  const price = known ?? pricing.prices[ASSUMED_TIER] ?? Object.values(pricing.prices)[0];
  if (!price) return { cost: 0, assumed: true };
  return { cost: (entry.tokensIn / 1_000_000) * price.input + (entry.tokensOut / 1_000_000) * price.output, assumed: known === undefined };
}

function entryFromRecord(raw: unknown, fallback: Partial<UsageEntry> = {}): UsageEntry | null {
  const record = asRecord(raw);
  if (record === null) return null;
  const tokensIn = asCount(record.tokens_in);
  const tokensOut = asCount(record.tokens_out);
  if (tokensIn + tokensOut === 0) return null;
  return {
    agent: asText(record.agent) ?? fallback.agent ?? null,
    model: asText(record.provider_model) ?? asText(record.model_tier) ?? fallback.model ?? null,
    tokensIn,
    tokensOut,
    approx: record.approx === true || fallback.approx === true,
  };
}

const compact = (entries: (UsageEntry | null)[]): UsageEntry[] => entries.filter((entry): entry is UsageEntry => entry !== null);

function entriesFromTierMap(tiers: Json, parentApprox: boolean): UsageEntry[] {
  return compact(Object.entries(tiers).map(([model, raw]) => entryFromRecord(raw, { model, approx: parentApprox })));
}

export function cycleUsageEntries(cycle: unknown, tasks: unknown): UsageEntry[] {
  const usage = asRecord(asRecord(asRecord(cycle)?.metrics)?.usage);
  const byAgent = compact(asArray(usage?.by_agent).map((raw) => entryFromRecord(raw)));
  if (byAgent.length > 0) return byAgent;
  const byTier = asRecord(usage?.by_tier);
  if (byTier !== null) {
    const fromTiers = entriesFromTierMap(byTier, usage?.approx === true);
    if (fromTiers.length > 0) return fromTiers;
  }
  const fromTasks = compact(asArray(asRecord(tasks)?.tasks).map((task) => entryFromRecord(asRecord(task)?.usage)));
  if (fromTasks.length > 0) return fromTasks;
  const top = entryFromRecord(usage);
  return top === null ? [] : [top];
}

export function fixUsageEntries(fix: unknown): UsageEntry[] {
  const usage = asRecord(asRecord(fix)?.usage);
  if (usage === null) return [];
  const byAgent = compact(asArray(usage.by_agent).map((raw) => entryFromRecord(raw)));
  if (byAgent.length > 0) return byAgent;
  const single = entryFromRecord(usage);
  return single === null ? [] : [single];
}

export function aggregateUsage(records: readonly UsageRecord[], pricing: PricingTable, keyOf: (record: UsageRecord) => string): CostBucket[] {
  const buckets = new Map<string, CostBucket>();
  for (const record of records) {
    const key = keyOf(record);
    const bucket = buckets.get(key) ?? { key, tokensIn: 0, tokensOut: 0, cost: 0, units: 0, approxUnits: 0, assumed: false };
    const priced = costOf(record, pricing);
    bucket.tokensIn += record.tokensIn;
    bucket.tokensOut += record.tokensOut;
    bucket.cost += priced.cost;
    bucket.units += 1;
    if (record.approx) bucket.approxUnits += 1;
    bucket.assumed ||= priced.assumed;
    buckets.set(key, bucket);
  }
  return [...buckets.values()].sort((a, b) => b.cost - a.cost || a.key.localeCompare(b.key));
}

export const agentKeyOf = (record: UsageRecord): string => record.agent ?? UNKNOWN_KEY;
export const modelKeyOf = (record: UsageRecord): string => normalizeModel(record.model) ?? UNKNOWN_KEY;
export const originKeyOf = (record: UsageRecord): string => record.origin;

export function totalsOf(buckets: readonly CostBucket[]): CostTotals {
  return buckets.reduce<CostTotals>(
    (sum, bucket) => ({ tokensIn: sum.tokensIn + bucket.tokensIn, tokensOut: sum.tokensOut + bucket.tokensOut, cost: sum.cost + bucket.cost, units: sum.units + bucket.units, approxUnits: sum.approxUnits + bucket.approxUnits }),
    { tokensIn: 0, tokensOut: 0, cost: 0, units: 0, approxUnits: 0 },
  );
}

export interface RtkSummary {
  commands: number;
  input: number;
  output: number;
  saved: number;
  avgSavingsPct: number | null;
}

export interface RtkCommandRow {
  command: string;
  commands: number;
  saved: number;
  savingsPct: number | null;
}

export function rtkSummaryOf(gain: Record<string, unknown> | null): RtkSummary | null {
  const summary = asRecord(gain?.summary);
  if (summary === null) return null;
  const pct = summary.avg_savings_pct;
  return {
    commands: asCount(summary.total_commands),
    input: asCount(summary.total_input),
    output: asCount(summary.total_output),
    saved: asCount(summary.total_saved),
    avgSavingsPct: typeof pct === 'number' && Number.isFinite(pct) ? pct : null,
  };
}

export function rtkCommandsOf(gain: Record<string, unknown> | null, limit = 10): RtkCommandRow[] {
  return asArray(gain?.by_command)
    .flatMap((raw) => {
      const row = asRecord(raw);
      const command = asText(row?.command);
      if (row === null || command === null) return [];
      const pct = row.savings_pct;
      return [{ command, commands: asCount(row.commands), saved: asCount(row.saved_tokens), savingsPct: typeof pct === 'number' && Number.isFinite(pct) ? pct : null }];
    })
    .sort((a, b) => b.saved - a.saved)
    .slice(0, limit);
}

export function rtkEquivalentUsd(saved: number, pricing: PricingTable | null): number | null {
  const price = pricing?.prices[ASSUMED_TIER] ?? (pricing ? Object.values(pricing.prices)[0] : undefined);
  return price ? (saved / 1_000_000) * price.input : null;
}
