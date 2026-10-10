import { describe, expect, it } from 'vitest';
import { escapeHtml, proseToHtml, questionToHtml } from '../src/shared/html.js';
import {
  adjacentQuestion,
  describeDrift,
  describeLines,
  groupQuestions,
  isSafeRelativePath,
  openableSnippets,
  questionFiles,
} from '../src/shared/questions.js';

const snippet = (file, start_line, end_line = start_line) => ({
  file,
  start_line,
  end_line,
  language: 'js',
  code: 'code();',
});
const question = (number, snippets, overrides = {}) => ({
  number,
  broader: false,
  snippets,
  question: `Question text ${number}?`,
  ...overrides,
});

describe('describeLines', () => {
  it('names one line or a range, as the report does', () => {
    expect(describeLines(snippet('a.js', 12))).toBe('line 12');
    expect(describeLines(snippet('a.js', 28, 37))).toBe('lines 28–37');
  });
});

describe('isSafeRelativePath', () => {
  it.each(['src/cart.js', 'cart.js', 'src/a b/c.js', 'src/..hidden/c.js', '.github/x.yml'])(
    'accepts %s',
    (file) => {
      expect(isSafeRelativePath(file)).toBe(true);
    },
  );

  it.each([
    '/etc/passwd',
    '\\\\server\\share\\x',
    'C:\\Users\\jsmith\\x.js',
    'c:/Users/jsmith/x.js',
    '../outside.js',
    'src/../../outside.js',
    'src\\..\\..\\outside.js',
    'src/\0x.js',
    '',
    undefined,
  ])('rejects %j', (file) => {
    expect(isSafeRelativePath(file)).toBe(false);
  });
});

describe('openableSnippets', () => {
  it('leaves out an unsafe path and an impossible range', () => {
    const q = question(1, [
      snippet('src/a.js', 3, 9),
      snippet('../b.js', 1),
      snippet('src/c.js', 0),
      snippet('src/d.js', 9, 3),
      snippet('', 1),
    ]);
    expect(openableSnippets(q).map((s) => s.file)).toEqual(['src/a.js']);
  });
});

describe('groupQuestions', () => {
  it('groups by the file of the first snippet, in order of first use', () => {
    const groups = groupQuestions([
      question(1, [snippet('src/b.js', 1)]),
      question(2, [snippet('src/a.js', 1), snippet('src/b.js', 4)]),
      question(3, [snippet('src/b.js', 9)]),
    ]);
    expect(groups.map((g) => [g.file, g.questions.map((q) => q.number)])).toEqual([
      ['src/b.js', [1, 3]],
      ['src/a.js', [2]],
    ]);
  });

  it('puts questions that show no code last', () => {
    const groups = groupQuestions([
      question(1, [], { broader: true }),
      question(2, [snippet('src/a.js', 1)]),
      question(3, [snippet('../x.js', 1)]),
    ]);
    expect(groups.map((g) => [g.file, g.questions.map((q) => q.number)])).toEqual([
      ['src/a.js', [2]],
      [null, [1, 3]],
    ]);
  });

  it('returns no groups for no questions', () => {
    expect(groupQuestions([])).toEqual([]);
  });
});

describe('adjacentQuestion', () => {
  // Listed as src/b.js (1 and 3), src/a.js (2), then the broader question (4).
  const questions = [
    question(1, [snippet('src/b.js', 1)]),
    question(2, [snippet('src/a.js', 1)]),
    question(3, [snippet('src/b.js', 9)]),
    question(4, [], { broader: true }),
  ];
  const steps = (current, step, count) =>
    Array.from({ length: count }, () => {
      current = adjacentQuestion(questions, current, step)?.number;
      return current;
    });

  it('follows the order of the list, not of the numbers', () => {
    expect(steps(1, 1, 3)).toEqual([3, 2, 4]);
    expect(steps(4, -1, 3)).toEqual([2, 3, 1]);
  });

  it('goes round from either end to the other', () => {
    expect(adjacentQuestion(questions, 4, 1)?.number).toBe(1);
    expect(adjacentQuestion(questions, 1, -1)?.number).toBe(4);
  });

  it('starts at the first question going forward, and at the last going back', () => {
    expect(adjacentQuestion(questions, undefined, 1)?.number).toBe(1);
    expect(adjacentQuestion(questions, undefined, -1)?.number).toBe(4);
  });

  it('starts again when the question showing is no longer listed', () => {
    expect(adjacentQuestion(questions, 9, 1)?.number).toBe(1);
    expect(adjacentQuestion(questions, 9, -1)?.number).toBe(4);
  });

  it('stays on the only question there is', () => {
    const [only] = questions;
    expect(adjacentQuestion([only], 1, 1)).toBe(only);
    expect(adjacentQuestion([only], 1, -1)).toBe(only);
  });

  it('returns nothing for no questions', () => {
    expect(adjacentQuestion([], undefined, 1)).toBeUndefined();
    expect(adjacentQuestion([], 1, -1)).toBeUndefined();
  });
});

describe('questionFiles', () => {
  it('lists each file once', () => {
    const files = questionFiles([
      question(1, [snippet('src/b.js', 1), snippet('src/a.js', 1)]),
      question(2, [snippet('src/b.js', 5)]),
      question(3, []),
    ]);
    expect(files).toEqual(['src/b.js', 'src/a.js']);
  });
});

describe('describeDrift', () => {
  const base = {
    headSha: '9b8e7d6',
    folderCommit: '9b8e7d6c5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c',
    changedFiles: [],
    files: ['src/a.js', 'src/b.js', 'src/c.js'],
  };

  it('says nothing when the folder matches the report', () => {
    expect(describeDrift(base)).toBe('');
    expect(describeDrift({ ...base, changedFiles: ['README.md'] })).toBe('');
  });

  it('says nothing about the commit when the folder has none yet', () => {
    expect(describeDrift({ ...base, folderCommit: undefined })).toBe('');
  });

  it('names both commits when the folder has moved on', () => {
    const message = describeDrift({ ...base, folderCommit: '1234567890abcdef' });
    expect(message).toContain('commit 9b8e7d6');
    expect(message).toContain('this folder is at 1234567.');
  });

  it('compares the whole commit when the report gives it, and still names it short', () => {
    const full = { ...base, headSha: base.folderCommit };
    expect(describeDrift(full)).toBe('');
    const message = describeDrift({ ...full, folderCommit: '1234567890abcdef' });
    expect(message).toContain('commit 9b8e7d6,');
    expect(message).toContain('this folder is at 1234567.');
    // The same first seven characters, and a different commit.
    const lookalike = `${base.headSha}${'f'.repeat(33)}`;
    expect(describeDrift({ ...full, folderCommit: lookalike })).not.toBe('');
  });

  it('names up to two changed files, and counts more', () => {
    expect(describeDrift({ ...base, changedFiles: ['src/a.js'] })).toMatch(/^src\/a\.js changed/);
    expect(describeDrift({ ...base, changedFiles: ['src/b.js', 'src/a.js'] })).toMatch(
      /^src\/a\.js and src\/b\.js changed/,
    );
    expect(describeDrift({ ...base, changedFiles: base.files })).toMatch(/^3 files changed/);
  });
});

describe('escapeHtml', () => {
  it('escapes every character that could open markup or close an attribute', () => {
    expect(escapeHtml(`<img src="x" onerror='alert(1)'> & more`)).toBe(
      '&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt; &amp; more',
    );
  });
});

describe('proseToHtml', () => {
  it('turns inline code into code elements and escapes the rest', () => {
    expect(proseToHtml('Is `a < b` true when <b>bold</b>?')).toBe(
      'Is <code>a &lt; b</code> true when &lt;b&gt;bold&lt;/b&gt;?',
    );
  });
});

describe('questionToHtml', () => {
  it('prompts when nothing is selected', () => {
    expect(questionToHtml(undefined)).toContain('Select a question');
  });

  it('shows the number, the text and each snippet with its caption', () => {
    const html = questionToHtml(
      question(3, [snippet('src/a.js', 3, 9), snippet('src/b.js', 2)], {
        question: 'What does `x` do?',
      }),
    );
    expect(html).toContain('<h2>Question 3</h2>');
    expect(html).toContain('What does <code>x</code> do?');
    expect(html).toContain('<code>src/a.js</code>, lines 3–9');
    expect(html).toContain('<code>src/b.js</code>, line 2');
    expect(html.match(/<pre>/g)).toHaveLength(2);
  });

  it('lets nothing from the issue through as markup', () => {
    const hostile = '<script>alert(1)</script>';
    const html = questionToHtml({
      number: hostile,
      broader: false,
      snippets: [{ file: hostile, start_line: 1, end_line: 1, language: '', code: hostile }],
      question: `${hostile} \`${hostile}\``,
    });
    expect(html).not.toContain('<script');
  });
});
