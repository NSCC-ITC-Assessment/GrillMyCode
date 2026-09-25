import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { diffLines, listChangedPaths, listTreeFiles, readFileAt } from '../src/git.js';
import {
  buildAssessedCodeContent,
  collectFilesAt,
  findCodebaseContextFiles,
  folderDistance,
  selectCodebaseContext,
} from '../src/files.js';
import { dropQuestionsOnUnassessedFiles } from '../src/postprocess.js';
import { buildPrompt } from '../src/prompt.js';
import { GIT_EMPTY_TREE_SHA } from '../src/constants.js';

describe('diffLines', () => {
  it('marks added, removed and unchanged lines across the whole file', () => {
    const before = 'a\nb\nc\n';
    const after = 'a\nB\nc\nd\n';
    expect(diffLines(before, after)).toEqual([
      { marker: ' ', text: 'a' },
      { marker: '-', text: 'b' },
      { marker: '+', text: 'B' },
      { marker: ' ', text: 'c' },
      { marker: '+', text: 'd' },
    ]);
  });

  it('marks nothing when the texts are identical', () => {
    expect(diffLines('x\ny\n', 'x\ny\n')).toEqual([
      { marker: ' ', text: 'x' },
      { marker: ' ', text: 'y' },
    ]);
  });

  it('keeps blank lines and ignores a missing final newline', () => {
    expect(diffLines('a\n\nb', 'a\n\nb\nc')).toEqual([
      { marker: ' ', text: 'a' },
      { marker: ' ', text: '' },
      { marker: ' ', text: 'b' },
      { marker: '+', text: 'c' },
    ]);
  });

  it('ignores a switch between CRLF and LF line endings', () => {
    expect(diffLines('a\r\nb\r\n', 'a\nb\nc\n')).toEqual([
      { marker: ' ', text: 'a' },
      { marker: ' ', text: 'b' },
      { marker: '+', text: 'c' },
    ]);
  });

  it('keeps a long file in one piece, however far apart the changes are', () => {
    const lines = Array.from({ length: 200 }, (_, i) => `line ${i}`);
    const edited = [...lines];
    edited[0] = 'first';
    edited[199] = 'last';
    const result = diffLines(`${lines.join('\n')}\n`, `${edited.join('\n')}\n`);
    expect(result.filter((l) => l.marker !== '-')).toHaveLength(200);
  });
});

describe('buildAssessedCodeContent', () => {
  it('renders a new file plainly and counts every line as the student’s', () => {
    const { content, markedFiles, addedLines } = buildAssessedCodeContent(
      [{ filepath: 'src/new.py', content: 'x = 1\ny = 2\n' }],
      new Map(),
    );
    expect(content).toBe('### `src/new.py`\n```py\nx = 1\ny = 2\n```');
    expect(markedFiles).toEqual([]);
    expect(addedLines).toBe(2);
  });

  it('marks the student’s lines in a file that existed at the base', () => {
    const { content, markedFiles, addedLines } = buildAssessedCodeContent(
      [{ filepath: 'app.js', content: 'const a = 1;\nconst b = 3;\n' }],
      new Map([['app.js', 'const a = 1;\nconst b = 2;\n']]),
    );
    expect(markedFiles).toEqual(['app.js']);
    expect(addedLines).toBe(1);
    expect(content).toBe(
      "### `app.js` (existed before this submission — student's lines marked)\n" +
        '```js\n const a = 1;\n-const b = 2;\n+const b = 3;\n```',
    );
  });

  it('counts no student lines when a starter file is unchanged after processing', () => {
    const { markedFiles, addedLines } = buildAssessedCodeContent(
      [{ filepath: 'app.js', content: 'same\n' }],
      new Map([['app.js', 'same\n']]),
    );
    expect(markedFiles).toEqual(['app.js']);
    expect(addedLines).toBe(0);
  });
});

describe('folderDistance', () => {
  it('measures folder steps through the nearest shared folder', () => {
    expect(folderDistance('src/a.js', 'src/b.js')).toBe(0);
    expect(folderDistance('a.js', 'b.js')).toBe(0);
    expect(folderDistance('src/lib/a.js', 'src/b.js')).toBe(1);
    expect(folderDistance('src/lib/a.js', 'test/b.js')).toBe(3);
  });
});

describe('selectCodebaseContext', () => {
  const file = (filepath, size = 10, kind = 'starter') => ({
    filepath,
    content: 'x'.repeat(size),
    kind,
  });

  it('puts files in the student’s folders first, then the rest by path', () => {
    const { starterFiles } = selectCodebaseContext(
      [file('z/far.js'), file('src/util.js'), file('src/lib/deep.js'), file('a.js')],
      ['src/main.js'],
      10_000,
    );
    expect(starterFiles).toEqual(['src/util.js', 'a.js', 'src/lib/deep.js', 'z/far.js']);
  });

  it('leaves out a file that does not fit but still tries the smaller ones after it', () => {
    const { starterFiles, omitted, starterContent } = selectCodebaseContext(
      [file('src/a.js', 30), file('src/b.js', 500), file('src/c.js', 30)],
      ['src/main.js'],
      120,
    );
    expect(starterFiles).toEqual(['src/a.js', 'src/c.js']);
    expect(omitted).toEqual(['src/b.js']);
    expect(starterContent.length).toBeLessThanOrEqual(120);
  });

  it('splits starter code from earlier work but fills one shared budget', () => {
    const { starterFiles, earlierFiles, omitted, starterContent, earlierContent } =
      selectCodebaseContext(
        [
          file('src/board.py', 40, 'starter'),
          file('src/player.py', 40, 'earlier'),
          file('lib/far.py', 40, 'starter'),
        ],
        ['src/game.py'],
        150,
      );
    expect(starterFiles).toEqual(['src/board.py']);
    expect(earlierFiles).toEqual(['src/player.py']);
    expect(omitted).toEqual(['lib/far.py']);
    expect(starterContent.length + earlierContent.length).toBeLessThanOrEqual(150);
  });

  it('skips empty files', () => {
    const { starterFiles, earlierFiles, omitted } = selectCodebaseContext(
      [{ filepath: 'empty.js', content: '\n', kind: 'starter' }],
      ['main.js'],
      1000,
    );
    expect(starterFiles).toEqual([]);
    expect(earlierFiles).toEqual([]);
    expect(omitted).toEqual([]);
  });
});

describe('dropQuestionsOnUnassessedFiles with codebase context files', () => {
  const question = (n, ...headers) =>
    [
      ...headers.flatMap((h) => [`**${h}**`, '', '```', 'code', '```', '']),
      `${n}. What does this do?`,
      '',
      '<!-- gmc:answer -->',
      '**Answer:**',
      '- it works',
      '<!-- /gmc:answer -->',
    ].join('\n');
  const report = (...blocks) => blocks.join('\n\n---\n\n');

  it('keeps a question showing starter code beside the student’s code', () => {
    const text = report(question(1, 'src/main.py', 'src/board.py'), question(2, 'main.py'));
    const result = dropQuestionsOnUnassessedFiles(text, ['src/main.py'], ['src/board.py']);
    expect(result.dropped).toBe(0);
  });

  it('drops a question that shows only codebase context', () => {
    const text = report(question(1, 'src/board.py'), question(2, 'src/main.py'));
    const result = dropQuestionsOnUnassessedFiles(text, ['src/main.py'], ['src/board.py']);
    expect(result.dropped).toBe(1);
    expect(result.unassessed).toEqual(['src/board.py']);
  });

  it('still drops a question pairing student code with a file that is neither', () => {
    const text = report(question(1, 'src/main.py', 'README.md'), question(2, 'src/main.py'));
    const result = dropQuestionsOnUnassessedFiles(text, ['src/main.py'], ['src/board.py']);
    expect(result.dropped).toBe(1);
    expect(result.unassessed).toEqual(['README.md']);
  });
});

describe('buildPrompt codebase context and marked files', () => {
  const base = { codeContent: 'code', files: ['a.js'], numQuestions: 3 };

  it('adds neither section when there is nothing to mark and no codebase context', () => {
    const [system, user] = buildPrompt(base);
    expect(system.content).not.toContain('CODEBASE CONTEXT');
    expect(system.content).not.toContain('marker column');
    expect(user.content).not.toContain('STARTER_CODE_REFERENCE');
    expect(user.content).not.toContain('EARLIER_STUDENT_CODE');
  });

  it('explains the marker column when a file is marked', () => {
    const [system] = buildPrompt({ ...base, markedFiles: ['a.js'] });
    expect(system.content).toContain('marker column');
  });

  it('sends starter code in its own nonce-delimited block ahead of the submission', () => {
    const [system, user] = buildPrompt({ ...base, starterContext: 'STARTER BODY' });
    const open = user.content.match(/<<<STARTER_CODE_REFERENCE ([0-9a-f]+)>>>/);
    expect(open).not.toBeNull();
    const nonce = open[1];
    expect(system.content).toContain(`<<<STARTER_CODE_REFERENCE ${nonce}>>>`);
    const starterAt = user.content.indexOf('STARTER BODY');
    expect(starterAt).toBeLessThan(user.content.indexOf('<<<UNTRUSTED_STUDENT_SUBMISSION'));
    expect(starterAt).toBeLessThan(
      user.content.indexOf(`<<<END_STARTER_CODE_REFERENCE ${nonce}>>>`),
    );
    expect(system.content).not.toContain('Earlier work, between');
  });

  it('sends earlier work in an untrusted block and names it in the security rules', () => {
    const [system, user] = buildPrompt({ ...base, earlierContext: 'EARLIER BODY' });
    const nonce = user.content.match(/<<<UNTRUSTED_EARLIER_STUDENT_CODE ([0-9a-f]+)>>>/)[1];
    const security = system.content.slice(0, system.content.indexOf('Analyze the submitted'));
    expect(security).toContain(`<<<UNTRUSTED_EARLIER_STUDENT_CODE ${nonce}>>>`);
    expect(system.content).toContain('Earlier work, between');
    expect(system.content).not.toContain('Starter code, between');
    expect(user.content.indexOf('EARLIER BODY')).toBeLessThan(
      user.content.indexOf('<<<UNTRUSTED_STUDENT_SUBMISSION'),
    );
  });
});

// These read real git objects, so they run against a throwaway repository.
describe('reading codebase files from git', () => {
  let dir;
  let originalCwd;
  let first;
  let head;

  const run = (...args) => {
    const result = spawnSync('git', args, { cwd: dir, encoding: 'utf-8' });
    if (result.status !== 0) throw new Error(result.stderr);
    return result.stdout.trim();
  };

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'gmc-starter-'));
    run('init', '-q', '-b', 'main');
    run('config', 'user.email', 'test@example.com');
    run('config', 'user.name', 'Test');
    run('config', 'commit.gpgSign', 'false');
    mkdirSync(join(dir, 'src'));
    writeFileSync(join(dir, 'src', 'board.py'), 'BOARD = []\n');
    writeFileSync(join(dir, 'src', 'main.py'), 'def main():\n    pass\n');
    writeFileSync(join(dir, 'src', 'naïve.py'), 'x = 1\n');
    writeFileSync(join(dir, 'logo.bin'), Buffer.from([0, 1, 2]));
    run('add', '.');
    run('commit', '-q', '-m', 'starter');
    first = run('rev-parse', 'HEAD');
    writeFileSync(join(dir, 'src', 'main.py'), 'def main():\n    print(BOARD)\n');
    run('add', '.');
    run('commit', '-q', '-m', 'student');
    head = run('rev-parse', 'HEAD');
    originalCwd = process.cwd();
    process.chdir(dir);
  });

  afterAll(() => {
    process.chdir(originalCwd);
    rmSync(dir, { recursive: true, force: true });
  });

  it('lists every file in a commit, including paths git would quote', () => {
    expect(listTreeFiles(first).sort()).toEqual(
      ['logo.bin', 'src/board.py', 'src/main.py', 'src/naïve.py'].sort(),
    );
  });

  it('lists only the paths the student changed since the first commit', () => {
    expect(listChangedPaths(first, head)).toEqual(['src/main.py']);
  });

  it('reads a file at a commit, or null when it is not there', () => {
    expect(readFileAt(first, 'src/main.py')).toBe('def main():\n    pass\n');
    expect(readFileAt(first, 'src/missing.py')).toBeNull();
    expect(readFileAt(GIT_EMPTY_TREE_SHA, 'src/main.py')).toBeNull();
  });

  it('skips binary and missing files when collecting', () => {
    const found = collectFilesAt(['logo.bin', 'src/board.py', 'src/missing.py'], first);
    expect(found).toEqual([{ filepath: 'src/board.py', content: 'BOARD = []\n' }]);
  });
});

// Starter code, a phase 1 submission and a phase 2 submission, so the context
// can be checked for each base an assessment can have.
describe('findCodebaseContextFiles', () => {
  let dir;
  let originalCwd;
  const commits = {};

  const run = (...args) => {
    const result = spawnSync('git', args, { cwd: dir, encoding: 'utf-8' });
    if (result.status !== 0) throw new Error(result.stderr);
    return result.stdout.trim();
  };
  const commit = (name, files) => {
    for (const [path, content] of Object.entries(files)) {
      writeFileSync(join(dir, path), content);
    }
    run('add', '.');
    run('commit', '-q', '-m', name);
    commits[name] = run('rev-parse', 'HEAD');
  };
  const find = (baseSha, firstCommit, assessedFiles) =>
    findCodebaseContextFiles({
      baseSha,
      headSha: commits.phase2,
      firstCommit,
      excludePatterns: ['**/*.md'],
      excludePatternOverrides: [],
      assessedFiles,
      skippedRange: { from: commits.starter, to: commits.bot },
    })
      .map(({ filepath, kind }) => `${kind}:${filepath}`)
      .sort();

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'gmc-codebase-'));
    run('init', '-q', '-b', 'main');
    run('config', 'user.email', 'test@example.com');
    run('config', 'user.name', 'Test');
    run('config', 'commit.gpgSign', 'false');
    mkdirSync(join(dir, 'src'));
    commit('starter', {
      'README.md': '# Lab 3\n',
      'src/board.py': 'BOARD = []\n',
      'src/main.py': 'def main():\n    pass\n',
    });
    // A bot commit straight after the starter, as a template's own CI might make.
    commit('bot', { 'src/generated.py': 'VERSION = 1\n' });
    commit('phase1', {
      'src/player.py': 'class Player:\n    pass\n',
      'src/main.py': 'def main():\n    Player()\n',
    });
    commit('phase2', { 'src/game.py': 'class Game:\n    pass\n' });
    originalCwd = process.cwd();
    process.chdir(dir);
  });

  afterAll(() => {
    process.chdir(originalCwd);
    rmSync(dir, { recursive: true, force: true });
  });

  it('sends phase 1 work and unchanged starter code when phase 2 is assessed alone', () => {
    expect(find(commits.phase1, commits.starter, ['src/game.py'])).toEqual([
      'earlier:src/main.py',
      'earlier:src/player.py',
      'starter:src/board.py',
    ]);
  });

  it('sends only unchanged starter code when all work to date is assessed', () => {
    expect(
      find(commits.bot, commits.starter, ['src/game.py', 'src/main.py', 'src/player.py']),
    ).toEqual(['starter:src/board.py']);
  });

  it('counts nothing as starter code when the first commit is the student’s', () => {
    expect(find(commits.phase1, null, ['src/game.py'])).toEqual([
      'earlier:src/board.py',
      'earlier:src/main.py',
      'earlier:src/player.py',
    ]);
  });

  it('leaves out files written by bot commits that skip_committers stepped over', () => {
    const withoutSkip = findCodebaseContextFiles({
      baseSha: commits.phase1,
      headSha: commits.phase2,
      firstCommit: commits.starter,
      excludePatterns: ['**/*.md'],
      excludePatternOverrides: [],
      assessedFiles: ['src/game.py'],
    }).map(({ filepath }) => filepath);
    expect(withoutSkip).toContain('src/generated.py');
    expect(find(commits.phase1, commits.starter, ['src/game.py'])).not.toContain(
      'earlier:src/generated.py',
    );
  });

  it('finds nothing when the whole history is assessed', () => {
    expect(find(GIT_EMPTY_TREE_SHA, null, [])).toEqual([]);
  });
});
