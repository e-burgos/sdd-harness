import { aggregateUsage, agentKeyOf, costOf, cycleUsageEntries, fixUsageEntries, modelKeyOf, normalizeModel, parsePricing, rtkCommandsOf, rtkEquivalentUsd, rtkSummaryOf, totalsOf, type UsageRecord } from './costs-model';

const pricing = parsePricing({ currency: 'USD', model_prices_per_mtok: { 'claude/sonnet': { input: 3, output: 15 }, 'claude/opus': { input: 5, output: 25 } } })!;

const record = (over: Partial<UsageRecord>): UsageRecord => ({ agent: 'sdd-planner', model: 'claude/sonnet', tokensIn: 1_000_000, tokensOut: 0, approx: false, origin: 'spec/cycle-01', ...over });

describe('parsePricing', () => {
  it('returns null when there are no usable prices so the view never shows 0 or NaN', () => {
    expect(parsePricing(null)).toBeNull();
    expect(parsePricing({})).toBeNull();
    expect(parsePricing({ model_prices_per_mtok: { 'claude/opus': { input: 'x', output: 1 } } })).toBeNull();
  });

  it('keeps valid prices and defaults the currency', () => {
    expect(parsePricing({ model_prices_per_mtok: { 'claude/opus': { input: 5, output: 25 }, bad: null } })).toEqual({ prices: { 'claude/opus': { input: 5, output: 25 } }, currency: 'USD' });
  });
});

describe('costOf', () => {
  it('prices by model and reads legacy bare tiers as claude/*', () => {
    expect(normalizeModel('opus')).toBe('claude/opus');
    expect(costOf(record({ model: 'opus', tokensIn: 1_000_000, tokensOut: 1_000_000 }), pricing)).toEqual({ cost: 30, assumed: false });
  });

  it('assumes the sonnet tier for unknown or missing models and flags it', () => {
    expect(costOf(record({ model: 'gemini/pro' }), pricing)).toEqual({ cost: 3, assumed: true });
    expect(costOf(record({ model: null }), pricing).assumed).toBe(true);
  });
});

describe('usage entries', () => {
  it('prefers by_agent, then by_tier, then task usage, then top-level tokens', () => {
    const agents = { metrics: { usage: { tokens_in: 9, tokens_out: 9, by_agent: [{ agent: 'a', provider_model: 'claude/opus', tokens_in: 10, tokens_out: 5 }], by_tier: { 'claude/opus': { tokens_in: 99, tokens_out: 1 } } } } };
    expect(cycleUsageEntries(agents, null)).toEqual([{ agent: 'a', model: 'claude/opus', tokensIn: 10, tokensOut: 5, approx: false }]);
    const tiers = { metrics: { usage: { approx: true, by_tier: { 'claude/opus': { tokens_in: 7, tokens_out: 1 } } } } };
    expect(cycleUsageEntries(tiers, null)).toEqual([{ agent: null, model: 'claude/opus', tokensIn: 7, tokensOut: 1, approx: true }]);
    const tasks = { tasks: [{ usage: { agent: 't', provider_model: 'claude/haiku', tokens_in: 3, tokens_out: 2 } }, { id: 'x' }] };
    expect(cycleUsageEntries({}, tasks)).toEqual([{ agent: 't', model: 'claude/haiku', tokensIn: 3, tokensOut: 2, approx: false }]);
    expect(cycleUsageEntries({ metrics: { usage: { tokens_in: 4, tokens_out: 4 } } }, null)).toHaveLength(1);
    expect(cycleUsageEntries(null, null)).toEqual([]);
  });

  it('reads fix usage as a single entry or a by_agent list', () => {
    expect(fixUsageEntries({ usage: { agent: 'x', provider_model: 'claude/opus', tokens_in: 1, tokens_out: 1 } })).toHaveLength(1);
    expect(fixUsageEntries({ usage: { by_agent: [{ tokens_in: 1, tokens_out: 0 }, { tokens_in: 2, tokens_out: 0 }] } })).toHaveLength(2);
    expect(fixUsageEntries({})).toEqual([]);
  });
});

describe('aggregation', () => {
  it('groups by agent and model, sorts by cost and totals the buckets', () => {
    const records = [record({}), record({ agent: 'sdd-reviewer', model: 'claude/opus', tokensIn: 2_000_000, approx: true }), record({ agent: null, model: null, tokensIn: 0, tokensOut: 1_000_000 })];
    const byAgent = aggregateUsage(records, pricing, agentKeyOf);
    expect(byAgent.map((b) => b.key)).toEqual(['_unknown', 'sdd-reviewer', 'sdd-planner']);
    expect(aggregateUsage(records, pricing, modelKeyOf).map((b) => b.key)).toEqual(['_unknown', 'claude/opus', 'claude/sonnet']);
    expect(totalsOf(byAgent)).toEqual({ tokensIn: 3_000_000, tokensOut: 1_000_000, cost: 28, units: 3, approxUnits: 1 });
  });
});

describe('rtk gain', () => {
  const gain = { summary: { total_commands: 4, total_input: 100, total_output: 40, total_saved: 60, avg_savings_pct: 60 }, by_command: [{ command: 'git', commands: 1, saved_tokens: 5 }, { command: 'pnpm', commands: 3, saved_tokens: 55, savings_pct: 70 }, { saved_tokens: 1 }] };

  it('reads the summary and the commands sorted by saving', () => {
    expect(rtkSummaryOf(gain)).toEqual({ commands: 4, input: 100, output: 40, saved: 60, avgSavingsPct: 60 });
    expect(rtkCommandsOf(gain).map((row) => row.command)).toEqual(['pnpm', 'git']);
    expect(rtkSummaryOf(null)).toBeNull();
    expect(rtkSummaryOf({})).toBeNull();
  });

  it('prices the saving at the assumed tier input rate and is null without pricing', () => {
    expect(rtkEquivalentUsd(2_000_000, pricing)).toBe(6);
    expect(rtkEquivalentUsd(1, null)).toBeNull();
  });
});
