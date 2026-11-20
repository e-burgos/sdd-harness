function segmentMatches(pattern: string, text: string): boolean {
  let p = 0;
  let t = 0;
  let starP = -1;
  let starT = 0;
  while (t < text.length) {
    const c = pattern.charAt(p);
    if (p < pattern.length && c === '*') {
      starP = p;
      starT = t;
      p++;
    } else if (p < pattern.length && (c === '?' || c === text.charAt(t))) {
      p++;
      t++;
    } else if (starP !== -1) {
      starT++;
      t = starT;
      p = starP + 1;
    } else return false;
  }
  while (pattern.charAt(p) === '*') p++;
  return p === pattern.length;
}

function collapseDoubleStars(segments: string[]): string[] {
  return segments.filter((seg, i) => !(seg === '**' && segments[i - 1] === '**'));
}

export function matchesGlob(rel: string, glob: string): boolean {
  const patternSegments = collapseDoubleStars(glob.replace(/\\/g, '/').split('/'));
  const pathSegments = rel.split('/');
  const lastPattern = patternSegments.length - 1;
  const memo = new Map<number, boolean>();
  const width = pathSegments.length + 1;

  const match = (g: number, r: number): boolean => {
    const key = g * width + r;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    let result: boolean;
    if (g > lastPattern) result = r === pathSegments.length;
    else if (patternSegments[g] === '**') {
      if (lastPattern === 0) result = true;
      else if (g === lastPattern) result = r < pathSegments.length;
      else {
        result = false;
        for (let skip = r; skip <= pathSegments.length && !result; skip++) {
          result = match(g + 1, skip);
        }
      }
    } else {
      result =
        r < pathSegments.length &&
        segmentMatches(patternSegments[g] ?? '', pathSegments[r] ?? '') &&
        match(g + 1, r + 1);
    }
    memo.set(key, result);
    return result;
  };

  return match(0, 0);
}
