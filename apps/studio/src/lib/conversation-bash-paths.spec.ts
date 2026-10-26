import { bashWritePaths } from './conversation-bash-paths';

describe('bashWritePaths', () => {
  it('extracts redirects, append, tee, cp, mv and sed -i targets', () => {
    expect(bashWritePaths('$ echo x > a/one.md && echo y >> a/two.md')).toEqual(['a/one.md', 'a/two.md']);
    expect(bashWritePaths('$ cat f | tee -a out/three.md out/four.md')).toEqual(['out/three.md', 'out/four.md']);
    expect(bashWritePaths('$ cp src/a.md dest/b.md; mv x.md dest/c.md')).toEqual(['dest/b.md', 'dest/c.md']);
    expect(bashWritePaths('$ cp src/a.md dest/')).toEqual(['dest/a.md']);
    expect(bashWritePaths("$ sed -i 's/a/b/' f/one.md f/two.md")).toEqual(['f/one.md', 'f/two.md']);
    expect(bashWritePaths("$ sed -i '' -e 's/a/b/' f/one.md")).toEqual(['f/one.md']);
    expect(bashWritePaths("$ sed -n 's/a/b/p' f/one.md")).toEqual([]);
  });

  it('resolves cd and variables sequentially', () => {
    expect(bashWritePaths('$ cd /w/sdd/specs/s/cycles/cycle-01; cat > functional.md')).toEqual(['/w/sdd/specs/s/cycles/cycle-01/functional.md']);
    expect(bashWritePaths('$ D=sdd/x && mkdir -p $D && cat > ${D}/cycle.json')).toEqual(['sdd/x/cycle.json']);
    expect(bashWritePaths('$ cd a; cd ../b; echo > f.md')).toEqual(['b/f.md']);
    expect(bashWritePaths('$ cd a && cd - && echo > f.md')).toEqual([]);
  });

  it('ignores heredoc bodies, stderr redirects, dev null and comments', () => {
    expect(bashWritePaths("$ cat > real.md <<'EOF'\ncat > fake.md\nEOF\necho > after.md")).toEqual(['real.md', 'after.md']);
    expect(bashWritePaths('$ ls 2>/tmp/err.log >/dev/null; echo > ok.md # > no.md')).toEqual(['ok.md']);
    expect(bashWritePaths('$ echo "a > b.md" ; echo \'c > d.md\'')).toEqual([]);
  });

  it('never invents paths from unresolved variables, substitutions or globs', () => {
    expect(bashWritePaths('$ cat > $UNSET/a.md')).toEqual([]);
    expect(bashWritePaths('$ cat > $(date).md')).toEqual([]);
    expect(bashWritePaths('$ cat > docs/*.md')).toEqual([]);
    expect(bashWritePaths('$ for f in a b; do cat > $f/x.md; done')).toEqual([]);
    expect(bashWritePaths('$ cat > ../../out.md')).toEqual([]);
    expect(bashWritePaths('$ cat > noext')).toEqual([]);
  });

  it('drops the word cut by truncation but keeps completed ones', () => {
    expect(bashWritePaths("$ cd /w/c; cat > functional.md <<'…")).toEqual(['/w/c/functional.md']);
    expect(bashWritePaths('$ cat > sdd/specs/s/cycles/cycle-01/pla…')).toEqual([]);
    expect(bashWritePaths("$ cat > 'sdd/my dir/pla…")).toEqual([]);
    expect(bashWritePaths('…')).toEqual([]);
  });
});
