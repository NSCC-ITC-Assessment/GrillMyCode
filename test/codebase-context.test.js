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
  keepsLinePositions,
  selectCodebaseContext,
} from '../src/files.js';
import { buildPrompt, maxStarterQuestions } from '../src/prompt/prompt.js';
import { resolveSnippets } from '../src/postprocess.js';
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

  // An editor starts a new line at a lone CR, so the marked file has to as
  // well, or its line numbers would drift from the student's.
  it('treats a lone CR as a line break', () => {
    expect(diffLines('a\rb\r', 'a\rb\rc\r')).toEqual([
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
  it('numbers a new file’s lines and counts every one as the student’s', () => {
    const { content, sources, markedFiles, addedLines } = buildAssessedCodeContent(
      [{ filepath: 'src/new.py', content: 'x = 1\r\ny = 2\n\n' }],
      new Map(),
    );
    expect(content).toBe('### `src/new.py`\n```py\n1 | x = 1\n2 | y = 2\n```');
    expect(sources).toEqual([
      {
        filepath: 'src/new.py',
        lines: ['x = 1', 'y = 2'],
        studentLines: 'all',
        starterLines: new Set(),
      },
    ]);
    expect(markedFiles).toEqual([]);
    expect(addedLines).toBe(2);
  });

  it('marks the student’s lines in a file that existed at the base, numbering the file as it is now', () => {
    const { content, sources, markedFiles, addedLines } = buildAssessedCodeContent(
      [{ filepath: 'app.js', content: 'const a = 1;\nconst b = 3;\n' }],
      new Map([['app.js', 'const a = 1;\nconst b = 2;\n']]),
    );
    expect(markedFiles).toEqual(['app.js']);
    expect(addedLines).toBe(1);
    expect(content).toBe(
      "### `app.js` (existed before this submission — student's lines marked)\n" +
        '```js\n  1 | const a = 1;\n-   | const b = 2;\n+ 2 | const b = 3;\n```',
    );
    expect(sources).toEqual([
      {
        filepath: 'app.js',
        lines: ['const a = 1;', 'const b = 3;'],
        studentLines: new Set([2]),
        starterLines: new Set(),
      },
    ]);
  });

  it('pads line numbers to the widest one', () => {
    const content = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join('\n');
    const numbered = buildAssessedCodeContent([{ filepath: 'a.txt', content }], new Map()).content;
    expect(numbered).toContain('\n 9 | line 9\n10 | line 10\n');
  });

  // The blank lines a removed comment leaves behind are shown once, and the
  // numbers skip them, so each line keeps its number in the student's file.
  it('shows one blank line of a run and keeps every line’s own number', () => {
    const { content, sources } = buildAssessedCodeContent(
      [{ filepath: 'a.js', content: '\nconst a = 1;\n\n\n\nconst b = 2;\n' }],
      new Map(),
    );
    expect(content).toBe('### `a.js`\n```js\n1 |\n2 | const a = 1;\n3 |\n6 | const b = 2;\n```');
    expect(sources[0].lines[5]).toBe('const b = 2;');
  });

  it('never counts a blank line as the student’s, nor shows a removed one', () => {
    const { content, sources, addedLines } = buildAssessedCodeContent(
      [{ filepath: 'a.js', content: 'const a = 1;\n\nconst b = 2;\n' }],
      new Map([['a.js', 'const a = 1;\n\n\nconst b = 2;\n']]),
    );
    expect(addedLines).toBe(0);
    expect(sources[0].studentLines).toEqual(new Set());
    expect(content).not.toMatch(/^- +\|$/m);
  });

  it('counts only the non-blank lines of a new file', () => {
    const { addedLines } = buildAssessedCodeContent(
      [{ filepath: 'a.py', content: 'x = 1\n\ny = 2\n' }],
      new Map(),
    );
    expect(addedLines).toBe(2);
  });

  // starter_code: ask. The first commit's copy tells the instructor's lines
  // from the student's earlier work, which a later base leaves unmarked too.
  it('marks lines unchanged since the first commit as starter code', () => {
    const { content, sources, starterLines } = buildAssessedCodeContent(
      [{ filepath: 'app.js', content: 'given();\nearlier();\nnow();\n' }],
      new Map([['app.js', 'given();\nearlier();\n']]),
      new Map([['app.js', 'given();\n']]),
    );
    expect(content).toBe(
      "### `app.js` (existed before this submission — student's lines marked)\n" +
        '```js\ns 1 | given();\n  2 | earlier();\n+ 3 | now();\n```',
    );
    expect(sources[0].studentLines).toEqual(new Set([3]));
    expect(sources[0].starterLines).toEqual(new Set([1]));
    expect(starterLines).toBe(1);
  });

  it('marks no starter lines without the first commit’s copies', () => {
    const { content, starterLines } = buildAssessedCodeContent(
      [{ filepath: 'app.js', content: 'given();\nnow();\n' }],
      new Map([['app.js', 'given();\n']]),
    );
    expect(content).not.toMatch(/^s /m);
    expect(starterLines).toBe(0);
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

// Output of rmcm, the comment remover, run without collapsing blank lines.
describe('keepsLinePositions', () => {
  const original = '<?php\n// note\n/**\n * doc\n */\n$a = 1; // why\n$b = /* x */ 2;\n';
  const stripped = '<?php\n\n\n\n\n$a = 1; \n$b =  2;\n';

  it('accepts a copy with comments taken out of lines that stay put', () => {
    expect(keepsLinePositions(original, stripped)).toBe(true);
    expect(keepsLinePositions(original.replace(/\n/g, '\r\n'), stripped)).toBe(true);
    expect(keepsLinePositions(original, stripped.slice(0, -1))).toBe(true);
  });

  it('rejects a copy whose blank lines were collapsed', () => {
    expect(keepsLinePositions(original, '<?php\n\n$a = 1; \n$b =  2;\n')).toBe(false);
  });

  it('rejects a copy with a line changed rather than cut down', () => {
    expect(keepsLinePositions(original, stripped.replace('$a = 1;', '$a = 2;'))).toBe(false);
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

  it('numbers the chosen files and counts none of their lines as the student’s', () => {
    const { starterContent, sources } = selectCodebaseContext(
      [{ filepath: 'src/board.py', content: 'rows = 3\n', kind: 'starter' }],
      ['src/game.py'],
      1000,
    );
    expect(starterContent).toBe('### `src/board.py`\n```py\n1 | rows = 3\n```');
    expect(sources).toEqual([
      {
        filepath: 'src/board.py',
        lines: ['rows = 3'],
        studentLines: new Set(),
        starterLines: new Set(),
      },
    ]);
  });
});

describe('selectCodebaseContext under starter_code: ask', () => {
  it('lets the starter files be asked about, but never the earlier work', () => {
    const { sources } = selectCodebaseContext(
      [
        { filepath: 'src/board.py', content: 'rows = 3\n', kind: 'starter' },
        { filepath: 'src/old.py', content: 'x = 1\n', kind: 'earlier' },
      ],
      ['src/game.py'],
      1000,
      { askStarter: true },
    );
    expect(sources.map((s) => [s.filepath, s.starterLines])).toEqual([
      ['src/board.py', 'all'],
      ['src/old.py', new Set()],
    ]);
  });
});

// A starter file the student changed before the range, and not in it: earlier
// work that still holds lines of starter code as given.
describe('selectCodebaseContext with earlier files that began as starter code', () => {
  const edited = {
    filepath: 'src/main.py',
    content: 'def main():\n    play()\n\ndef helper():\n    return 1\n',
    kind: 'earlier',
    starterCopy: 'def main():\n    pass\n\ndef helper():\n    return 1\n',
  };
  const select = (candidates, askStarter) =>
    selectCodebaseContext(candidates, ['src/game.py'], 10_000, { askStarter });

  it('marks the lines still as given under ask, and lets only those be asked about', () => {
    const { earlierContent, sources, earlierFromStarter, earlierStarterLines } = select(
      [edited],
      true,
    );
    expect(earlierContent).toBe(
      [
        '### `src/main.py` (began as starter code)',
        '```py',
        's 1 | def main():',
        '  2 |     play()',
        '  3 |',
        's 4 | def helper():',
        's 5 |     return 1',
        '```',
      ].join('\n'),
    );
    expect(sources[0].starterLines).toEqual(new Set([1, 4, 5]));
    expect(sources[0].studentLines).toEqual(new Set());
    expect(earlierFromStarter).toBe(true);
    expect(earlierStarterLines).toBe(3);
  });

  it('heads the file but marks nothing without ask', () => {
    const { earlierContent, sources, earlierFromStarter, earlierStarterLines } = select(
      [edited],
      false,
    );
    expect(earlierContent).toContain(
      '### `src/main.py` (began as starter code)\n```py\n1 | def main():',
    );
    expect(sources[0].starterLines).toEqual(new Set());
    expect(earlierFromStarter).toBe(true);
    expect(earlierStarterLines).toBe(0);
  });

  it('keeps no marker column when no line is still as given', () => {
    const { earlierContent, earlierStarterLines } = select(
      [{ ...edited, starterCopy: 'pass\n' }],
      true,
    );
    expect(earlierContent).toContain('```py\n1 | def main():');
    expect(earlierStarterLines).toBe(0);
  });

  it('leaves the student’s own earlier files unheaded and unmarked', () => {
    const { earlierContent, earlierFromStarter } = select(
      [{ filepath: 'src/player.py', content: 'class Player:\n', kind: 'earlier' }],
      true,
    );
    expect(earlierContent).toBe('### `src/player.py`\n```py\n1 | class Player:\n```');
    expect(earlierFromStarter).toBe(false);
  });

  it('counts the marker column against the budget', () => {
    const marked = select([edited], true).earlierContent;
    const { earlierFiles, omitted } = selectCodebaseContext(
      [edited],
      ['src/game.py'],
      marked.length - 1,
      { askStarter: true },
    );
    expect(earlierFiles).toEqual([]);
    expect(omitted).toEqual(['src/main.py']);
  });

  it('keeps a question about its starter lines as a starter-code question', () => {
    const { sources } = select([edited], true);
    const question = (start, end) => ({
      question: 'Q',
      answer: 'A',
      snippets: [{ file: 'src/main.py', start, end }],
    });
    const { questions, notStudentWork } = resolveSnippets(
      [question(4, 5), question(2, 2)],
      sources,
    );
    expect(questions.map((q) => [q.snippets[0].start, q.aboutStarter])).toEqual([[4, true]]);
    expect(notStudentWork.map((q) => q.snippets[0].start)).toEqual([2]);
  });
});

describe('buildPrompt starter-code questions', () => {
  const base = { codeContent: 'code', files: ['a.js'], numQuestions: 10 };

  it('allows none unless a limit is given and there is starter code to ask about', () => {
    for (const extra of [{ starterContext: 'S' }, { starterQuestions: 2 }]) {
      expect(buildPrompt({ ...base, ...extra })[0].content).not.toContain('STARTER CODE QUESTIONS');
    }
  });

  it('states the limit and marks the starter block as askable', () => {
    const [system, user] = buildPrompt({ ...base, starterContext: 'S', starterQuestions: 2 });
    expect(system.content).toContain('At most 2 of the 10 questions may be starter-code questions');
    expect(system.content).toContain('CODEBASE CONTEXT — BACKGROUND:');
    expect(user.content).toContain('up to 2 questions may be about it');
  });

  it('explains the s marker only when starter lines are marked', () => {
    const marked = { ...base, markedFiles: ['a.js'], starterQuestions: 2 };
    expect(buildPrompt({ ...marked, starterLinesMarked: true })[0].content).toContain(
      '- `s` — a line of starter code',
    );
    expect(buildPrompt({ ...marked, starterContext: 'S' })[0].content).not.toContain(
      '- `s` — a line of starter code',
    );
  });
});

describe('buildPrompt earlier work that began as starter code', () => {
  const base = { codeContent: 'code', files: ['a.js'], numQuestions: 10, earlierContext: 'E' };

  it('explains the heading whenever such a file is sent', () => {
    const [system, user] = buildPrompt({ ...base, earlierFromStarter: true });
    expect(system.content).toContain('A file headed "(began as starter code)"');
    expect(system.content).not.toContain('STARTER CODE QUESTIONS — ALLOWED');
    expect(user.content).toContain('context only, not for questions on its own');
  });

  it('lets its s lines be asked about under ask', () => {
    const [system, user] = buildPrompt({
      ...base,
      earlierFromStarter: true,
      earlierStarterMarked: true,
      starterQuestions: 2,
    });
    expect(system.content).toContain('CODEBASE CONTEXT — BACKGROUND:');
    expect(system.content).toContain(
      'the lines marked `s` in the earlier-work files headed "(began as starter code)"',
    );
    expect(system.content).toContain('`s` marks a line of starter code still as the student');
    expect(user.content).toContain('context only apart from its lines marked `s`');
  });

  it('says nothing of it for earlier work that is all the student’s', () => {
    const [system] = buildPrompt(base);
    expect(system.content).not.toContain('began as starter code');
    expect(system.content).toContain('CODEBASE CONTEXT — BACKGROUND ONLY');
  });
});

describe('maxStarterQuestions', () => {
  it.each([
    [1, 0],
    [2, 1],
    [5, 1],
    [9, 1],
    [10, 2],
    [20, 4],
  ])('%i questions allow %i about starter code', (n, max) => {
    expect(maxStarterQuestions(n)).toBe(max);
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

  // The student answers with the whole repository open, so without codebase
  // context the model has to be told there is code it cannot see.
  it('warns of unseen code only when there is no codebase context', () => {
    expect(buildPrompt(base)[0].content).toContain('OTHER CODE YOU WERE NOT SENT');
    for (const context of [{ starterContext: 'S' }, { earlierContext: 'E' }]) {
      expect(buildPrompt({ ...base, ...context })[0].content).not.toContain(
        'OTHER CODE YOU WERE NOT SENT',
      );
    }
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

  it('gives a starter file changed in phase 1 its first-commit copy', () => {
    const found = findCodebaseContextFiles({
      baseSha: commits.phase1,
      headSha: commits.phase2,
      firstCommit: commits.starter,
      excludePatterns: ['**/*.md'],
      excludePatternOverrides: [],
      assessedFiles: ['src/game.py'],
      skippedRange: { from: commits.starter, to: commits.bot },
    });
    const byPath = Object.fromEntries(found.map((f) => [f.filepath, f]));
    expect(byPath['src/main.py'].starterCopy).toBe('def main():\n    pass\n');
    expect(byPath['src/player.py']).not.toHaveProperty('starterCopy');
    expect(byPath['src/board.py']).not.toHaveProperty('starterCopy');
  });

  it('gives no first-commit copy when the first commit is the student’s', () => {
    const found = findCodebaseContextFiles({
      baseSha: commits.phase1,
      headSha: commits.phase2,
      firstCommit: null,
      excludePatterns: ['**/*.md'],
      excludePatternOverrides: [],
      assessedFiles: ['src/game.py'],
    });
    expect(found.some((f) => 'starterCopy' in f)).toBe(false);
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
