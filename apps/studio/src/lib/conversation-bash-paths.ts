interface Word {
  text: string;
  dynamic: boolean;
}

interface Redirect {
  mode: 'out' | 'append' | 'in' | 'dup';
  fd: number;
}

interface Statement {
  words: Word[];
  redirects: { redirect: Redirect; target: Word | null }[];
}

interface Environment {
  cwd: string | null;
  vars: Map<string, string | null>;
}

const SINGLE_QUOTED_DOLLAR = '\u0001';
const TRUNCATION_MARK = '…';
const KEYWORD_PREFIXES = new Set(['do', 'then', 'else', 'elif', 'if', 'while', 'until', 'time', '!', '{']);
const ASSIGNMENT = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s;
const UNRESOLVABLE = /[*?[\]{}~]/;

function stripTruncation(command: string): string | null {
  if (!command.endsWith(TRUNCATION_MARK)) return command;
  const body = command.slice(0, -1);
  if (/\s$/.test(body)) return body;
  const lastGap = body.search(/\s\S*$/);
  return lastGap < 0 ? null : body.slice(0, lastGap + 1);
}

function skipBalanced(source: string, start: number): number {
  let depth = 1;
  let index = start;
  while (index < source.length && depth > 0) {
    if (source[index] === '(') depth += 1;
    else if (source[index] === ')') depth -= 1;
    index += 1;
  }
  return index;
}

function skipHeredocBodies(source: string, from: number, delimiters: string[]): number {
  let index = from;
  for (const delimiter of delimiters) {
    while (index < source.length) {
      const lineEnd = source.indexOf('\n', index);
      const end = lineEnd < 0 ? source.length : lineEnd;
      const line = source.slice(index, end).trim();
      index = lineEnd < 0 ? source.length : lineEnd + 1;
      if (line === delimiter) break;
    }
  }
  return index;
}

function tokenize(source: string): Statement[] {
  const statements: Statement[] = [];
  let current: Statement = { words: [], redirects: [] };
  let pendingRedirect: Redirect | null = null;
  let expectDelimiter = false;
  const delimiters: string[] = [];
  let buffer = '';
  let dynamic = false;
  let hasWord = false;
  let unterminated = false;

  const closeStatement = () => {
    if (current.words.length > 0 || current.redirects.length > 0) statements.push(current);
    current = { words: [], redirects: [] };
    pendingRedirect = null;
    expectDelimiter = false;
  };

  const flush = () => {
    if (!hasWord) return;
    const word: Word = { text: buffer, dynamic };
    buffer = '';
    dynamic = false;
    hasWord = false;
    if (expectDelimiter) {
      delimiters.push(word.text.replaceAll(SINGLE_QUOTED_DOLLAR, '$'));
      expectDelimiter = false;
    } else if (pendingRedirect) {
      current.redirects.push({ redirect: pendingRedirect, target: word });
      pendingRedirect = null;
    } else {
      current.words.push(word);
    }
  };

  let index = 0;
  while (index < source.length) {
    const char = source[index] as string;
    if (char === "'") {
      const close = source.indexOf("'", index + 1);
      hasWord = true;
      if (close < 0) {
        unterminated = true;
        break;
      }
      buffer += source.slice(index + 1, close).replaceAll('$', SINGLE_QUOTED_DOLLAR);
      index = close + 1;
    } else if (char === '"') {
      hasWord = true;
      let cursor = index + 1;
      let closed = false;
      while (cursor < source.length) {
        const inner = source[cursor] as string;
        if (inner === '\\' && cursor + 1 < source.length) {
          const escaped = source[cursor + 1] as string;
          buffer += escaped === '$' ? SINGLE_QUOTED_DOLLAR : escaped;
          cursor += 2;
        } else if (inner === '"') {
          closed = true;
          cursor += 1;
          break;
        } else if (inner === '`' || (inner === '$' && source[cursor + 1] === '(')) {
          dynamic = true;
          cursor = inner === '`' ? source.indexOf('`', cursor + 1) + 1 || source.length : skipBalanced(source, cursor + 2);
        } else {
          buffer += inner;
          cursor += 1;
        }
      }
      if (!closed) {
        unterminated = true;
        break;
      }
      index = cursor;
    } else if (char === '\\') {
      const escaped = source[index + 1];
      if (escaped === undefined) break;
      if (escaped !== '\n') {
        buffer += escaped === '$' ? SINGLE_QUOTED_DOLLAR : escaped;
        hasWord = true;
      }
      index += 2;
    } else if (char === '$' && source[index + 1] === "'") {
      index += 1;
    } else if (char === '$' && source[index + 1] === '(') {
      dynamic = true;
      hasWord = true;
      index = skipBalanced(source, index + 2);
    } else if (char === '`') {
      dynamic = true;
      hasWord = true;
      const close = source.indexOf('`', index + 1);
      index = close < 0 ? source.length : close + 1;
    } else if (char === ' ' || char === '\t' || char === '\r') {
      flush();
      index += 1;
    } else if (char === '\n') {
      flush();
      closeStatement();
      index = delimiters.length > 0 ? skipHeredocBodies(source, index + 1, delimiters.splice(0)) : index + 1;
    } else if (char === ';' || char === '(' || char === ')') {
      flush();
      closeStatement();
      index += 1;
    } else if (char === '|' || char === '&') {
      flush();
      if (char === '&' && source[index + 1] === '>') {
        const append = source[index + 2] === '>';
        pendingRedirect = { mode: append ? 'append' : 'out', fd: 1 };
        index += append ? 3 : 2;
      } else {
        closeStatement();
        index += source[index + 1] === char ? 2 : 1;
      }
    } else if (char === '>') {
      const fdFromBuffer = hasWord && /^\d+$/.test(buffer) ? Number(buffer) : null;
      if (fdFromBuffer !== null) {
        buffer = '';
        hasWord = false;
        dynamic = false;
      } else {
        flush();
      }
      const fd = fdFromBuffer ?? 1;
      if (source[index + 1] === '&') {
        pendingRedirect = { mode: 'dup', fd };
        index += 2;
      } else if (source[index + 1] === '>') {
        pendingRedirect = { mode: 'append', fd };
        index += 2;
      } else {
        pendingRedirect = { mode: 'out', fd };
        index += source[index + 1] === '|' ? 2 : 1;
      }
    } else if (char === '<') {
      flush();
      if (source.startsWith('<<<', index)) {
        pendingRedirect = { mode: 'in', fd: 0 };
        index += 3;
      } else if (source.startsWith('<<', index)) {
        expectDelimiter = true;
        index += source[index + 2] === '-' ? 3 : 2;
      } else {
        pendingRedirect = { mode: 'in', fd: 0 };
        index += 1;
      }
    } else if (char === '#' && !hasWord) {
      const lineEnd = source.indexOf('\n', index);
      index = lineEnd < 0 ? source.length : lineEnd;
    } else {
      buffer += char;
      hasWord = true;
      index += 1;
    }
  }
  if (!unterminated) flush();
  closeStatement();
  return statements;
}

function expand(word: Word, vars: Map<string, string | null>): string | null {
  if (word.dynamic) return null;
  let resolvable = true;
  const expanded = word.text.replace(/\$(?:\{([A-Za-z_][A-Za-z0-9_]*)\}|([A-Za-z_][A-Za-z0-9_]*)|[^A-Za-z_{])/g, (_match, braced?: string, bare?: string) => {
    const value = vars.get(braced ?? bare ?? '') ?? null;
    if (value === null) resolvable = false;
    return value ?? '';
  });
  if (!resolvable || expanded.includes('$')) return null;
  return expanded.replaceAll(SINGLE_QUOTED_DOLLAR, '$');
}

function normalize(path: string): string | null {
  const absolute = path.startsWith('/');
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (parts.length === 0) return absolute ? '/' : null;
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return (absolute ? '/' : '') + parts.join('/');
}

function resolve(cwd: string | null, path: string): string | null {
  if (path === '' || UNRESOLVABLE.test(path)) return null;
  if (path.startsWith('/')) return normalize(path);
  if (cwd === null) return null;
  return normalize(cwd === '' ? path : `${cwd}/${path}`);
}

const basename = (path: string): string => path.split('/').filter(Boolean).at(-1) ?? '';

const isOption = (word: string): boolean => word.startsWith('-') && word.length > 1;

function applyCd(args: string[], environment: Environment): void {
  const positional = args.filter((arg) => arg !== '-P' && arg !== '-L');
  const target = positional.length === 1 ? positional[0] : undefined;
  if (target === undefined || target === '-') {
    environment.cwd = null;
    return;
  }
  environment.cwd = resolve(environment.cwd, target);
}

function sedTargets(args: string[]): string[] {
  const inPlace = args.some((arg) => /^-[A-Za-z]*i/.test(arg) && !arg.startsWith('--'));
  if (!inPlace) return [];
  const positional: string[] = [];
  let scriptGiven = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] as string;
    if (/^-[A-Za-z]*[ef]$/.test(arg) || arg === '--expression' || arg === '--file') {
      scriptGiven = true;
      index += 1;
    } else if (!isOption(arg) && arg !== '') {
      positional.push(arg);
    }
  }
  return scriptGiven ? positional : positional.slice(1);
}

function copyDestinations(args: string[]): string[] {
  if (args.some((arg) => arg === '-t' || arg.startsWith('--target-directory'))) return [];
  const positional = args.filter((arg) => !isOption(arg));
  if (positional.length < 2) return [];
  const destination = positional.at(-1) as string;
  if (!destination.endsWith('/')) return [destination];
  return positional.slice(0, -1).map((source) => `${destination}${basename(source)}`);
}

function writeTargets(command: string, args: string[]): string[] {
  switch (command) {
    case 'tee':
      return args.filter((arg) => !isOption(arg));
    case 'sed':
      return sedTargets(args);
    case 'cp':
    case 'mv':
      return copyDestinations(args);
    default:
      return [];
  }
}

function applyAssignments(assignments: [string, Word][], vars: Map<string, string | null>): void {
  for (const [name, word] of assignments) vars.set(name, expand(word, vars));
}

function executeStatement(statement: Statement, environment: Environment): string[] {
  const words = [...statement.words];
  while (words.length > 0 && KEYWORD_PREFIXES.has((words[0] as Word).text)) words.shift();
  if (words[0]?.text === 'export') words.shift();

  const assignments: [string, Word][] = [];
  while (words.length > 0) {
    const match = ASSIGNMENT.exec((words[0] as Word).text);
    if (!match) break;
    assignments.push([match[1] as string, { text: match[2] as string, dynamic: (words[0] as Word).dynamic }]);
    words.shift();
  }
  if (words.length === 0) {
    applyAssignments(assignments, environment.vars);
    return redirectWrites(statement, environment.cwd, environment.vars);
  }

  const scopedVars = new Map(environment.vars);
  applyAssignments(assignments, scopedVars);
  const command = (words[0] as Word).dynamic ? null : (words[0] as Word).text;
  const expandedArgs = words.slice(1).map((word) => expand(word, scopedVars));
  const writes = redirectWrites(statement, environment.cwd, scopedVars);

  const resolvedArgs = expandedArgs.filter((arg): arg is string => arg !== null);
  const argsAreComplete = resolvedArgs.length === expandedArgs.length;

  if (command === 'cd') {
    applyCd(argsAreComplete ? resolvedArgs : [], environment);
    return writes;
  }
  if (command === 'pushd' || command === 'popd') {
    environment.cwd = null;
    return writes;
  }
  if (command === null) return writes;

  if (!argsAreComplete && command !== 'tee') return writes;
  const candidates = writeTargets(command, resolvedArgs);
  for (const candidate of candidates) {
    const path = resolve(environment.cwd, candidate);
    if (path) writes.push(path);
  }
  return writes;
}

function redirectWrites(statement: Statement, cwd: string | null, vars: Map<string, string | null>): string[] {
  const writes: string[] = [];
  for (const { redirect, target } of statement.redirects) {
    if (!target || redirect.fd !== 1 || (redirect.mode !== 'out' && redirect.mode !== 'append')) continue;
    const expanded = expand(target, vars);
    const path = expanded === null ? null : resolve(cwd, expanded);
    if (path && path !== '/dev/null') writes.push(path);
  }
  return writes;
}

export function bashWritePaths(summary: string): string[] {
  const command = summary.trim().replace(/^\$\s+/, '');
  const complete = stripTruncation(command);
  if (complete === null) return [];
  const environment: Environment = { cwd: '', vars: new Map() };
  const paths = new Set<string>();
  for (const statement of tokenize(complete)) {
    for (const path of executeStatement(statement, environment)) {
      if (basename(path).includes('.')) paths.add(path);
    }
  }
  return [...paths];
}
