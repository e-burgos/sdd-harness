export const REQUIRED_CHECK = 'sdd:validate';
export const BRANCH_PREFIX = 'feat/';

const SPEC_PREFIX = /^spec-[a-z0-9]+(?:-[a-z0-9]+)*?-\d{3}-(.+)$/;
const MAX_TITLE = 200;

export function specSlugOf(specId) {
  const match = SPEC_PREFIX.exec(String(specId ?? ''));
  return match ? match[1] : specId;
}

export function branchNameFor(specId, cycle) {
  return `${BRANCH_PREFIX}${specSlugOf(specId)}-${cycle}`;
}

export function branchPolicy(global) {
  const explicit = global?.github?.branch_per_cycle;
  if (explicit === 'on' || explicit === 'off') return explicit;
  return global?.profile === 'solo' ? 'off' : 'on';
}

export function defaultBranchOf(global) {
  return global?.github?.default_branch ?? 'main';
}

export function prTitleFor({ specId, specTitle, module, cycle }) {
  return `feat(${module}): ${specTitle} (${specId} ${cycle})`.slice(0, MAX_TITLE);
}

function entriesOf(value) {
  if (Array.isArray(value)) return value.map((entry) => `- ${entry}`);
  return Object.entries(value ?? {}).map(([id, text]) => `- **${id}** — ${text}`);
}

function section(heading, lines) {
  return lines.length ? [`## ${heading}`, '', ...lines, ''] : [];
}

export function prBodyFor({ specId, cycle, cycleJson }) {
  const report = cycleJson?.reviewer_report;
  const objectives = (cycleJson?.objectives ?? []).map((objective) => `- ${objective}`);
  const reviewer = entriesOf(report?.ca_results);
  const tests = entriesOf(report?.tests);
  const issues = (cycleJson?.issues_found ?? []).map((issue) => `- ${issue}`);
  const parts = [
    ...section('Summary', objectives),
    ...(report ? section('Reviewer', reviewer) : []),
    ...section('Tests', tests),
    ...section('Issues', issues),
    `_Opened with \`pnpm sdd:pr ${specId} ${cycle}\`._`,
  ];
  return parts.join('\n');
}

export function parseRemoteUrl(url) {
  const text = String(url ?? '').trim();
  const match =
    /^https?:\/\/(?:[^@/]+@)?github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(text) ??
    /^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/.exec(text) ??
    /^ssh:\/\/git@github\.com(?::\d+)?\/([^/\s]+)\/([^/\s]+?)(?:\.git)?$/.exec(text);
  return match ? { owner: match[1], name: match[2] } : null;
}
