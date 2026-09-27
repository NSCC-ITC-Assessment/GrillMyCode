import { describe, expect, it } from 'vitest';
import {
  arrangeQuestions,
  carriesAnswer,
  findLeakedAnswers,
  numberQuestions,
  parseQuestionsReply,
  renderQuestions,
  resolveSnippets,
} from '../src/postprocess.js';
import { SNIPPET_MAX_LINES } from '../src/constants.js';

/** The files the model was sent, as buildAssessedCodeContent describes them. */
const APP = {
  filepath: 'app.js',
  lines: [1, 2, 3, 4, 5].map((n) => `const total${n} = items.length;`),
  studentLines: 'all',
};
const SOURCES = [APP];

/** One question object as the model is asked to write it: line n of app.js. */
const raw = (n, overrides = {}) => ({
  snippets: [{ file: 'app.js', start_line: n, end_line: n }],
  question: `What does \`total${n}\` hold after this line runs?`,
  answer: `It holds the number of entries in the items array for question ${n}`,
  distractors: [`wrong ${n}a`, `wrong ${n}b`, `wrong ${n}c`],
  broader: false,
  ...overrides,
});
const reply = (...questions) => JSON.stringify({ questions });

describe('parseQuestionsReply', () => {
  it('parses a well-formed reply', () => {
    const { questions, contextSummary, salvaged, malformed } = parseQuestionsReply(
      JSON.stringify({ questions: [raw(1)], context_summary: 'These questions are focused.' }),
    );
    expect(questions).toEqual([
      {
        snippets: [{ file: 'app.js', start: 1, end: 1 }],
        question: 'What does `total1` hold after this line runs?',
        answer: 'It holds the number of entries in the items array for question 1',
        distractors: ['wrong 1a', 'wrong 1b', 'wrong 1c'],
        broader: false,
      },
    ]);
    expect(contextSummary).toBe('These questions are focused.');
    expect(salvaged).toBe(false);
    expect(malformed).toEqual([]);
  });

  // The schema is only a routing preference, so a model without structured
  // outputs answers from the prompt alone and wraps the object in whatever it
  // likes.
  it.each([
    ['a Markdown fence', (json) => '```json\n' + json + '\n```'],
    ['a line of preamble', (json) => `Here are the questions:\n${json}`],
    ['a bare top-level array', () => JSON.stringify([raw(1)])],
  ])('accepts a reply wrapped in %s', (_, wrap) => {
    const { questions, salvaged } = parseQuestionsReply(wrap(reply(raw(1))));
    expect(questions).toHaveLength(1);
    expect(salvaged).toBe(false);
  });

  it('recovers the complete questions from a reply cut off mid-question', () => {
    const full = reply(raw(1), raw(2, { question: 'Is "}" or "{" or "\\"" a brace?' }), raw(3));
    const cut = full.slice(0, full.indexOf('wrong 3b'));
    const { questions, salvaged } = parseQuestionsReply(cut);
    expect(salvaged).toBe(true);
    expect(questions.map((q) => q.question)).toEqual([
      'What does `total1` hold after this line runs?',
      'Is "}" or "{" or "\\"" a brace?',
    ]);
  });

  it('throws when nothing can be recovered', () => {
    expect(() => parseQuestionsReply('1. **What does x do?**')).toThrow(/not valid JSON/);
    expect(() => parseQuestionsReply('{"questions": [{"question": "cut')).toThrow();
    expect(() => parseQuestionsReply('{"items": []}')).toThrow(/"questions" array/);
  });

  // The message reaches the Actions log, which the student can read. JSON.parse
  // quotes the text it failed on, so its message must not be passed on.
  it('never quotes the reply in its error', () => {
    const secret = 'THE-CORRECT-ANSWER-IS-42';
    let message = '';
    try {
      parseQuestionsReply(`{"questions": [{"answer": "${secret}", oops}]}`);
    } catch (err) {
      message = err.message;
    }
    expect(message).not.toBe('');
    expect(message).not.toContain(secret);
    expect(message).not.toContain('oops');
  });

  it('drops a question without question text or an answer and says where it was', () => {
    const { questions, entries, malformed } = parseQuestionsReply(
      reply(raw(1), raw(2, { answer: '  ' }), raw(3, { question: undefined }), 'nonsense'),
    );
    expect(questions).toHaveLength(1);
    expect(entries).toBe(4);
    expect(malformed).toEqual([2, 3, 4]);
  });

  it('throws when no question survives', () => {
    expect(() => parseQuestionsReply(reply(raw(1, { answer: '' })))).toThrow(/no question/);
    expect(() => parseQuestionsReply(reply())).toThrow(/no question/);
  });

  it('normalises the fields', () => {
    const [q] = parseQuestionsReply(
      reply(
        raw(1, {
          question: 'What does\n`x` return?',
          answer: 'It returns\n  the count',
          distractors: ['wrong one', '', 'wrong two', 7],
          snippets: [
            { file: ' src/app.js ', start_line: 3, end_line: '7' },
            { file: 'b.js', start_line: 2.5, end_line: 'seven' },
          ],
        }),
      ),
    ).questions;
    expect(q.question).toBe('What does `x` return?');
    expect(q.answer).toBe('It returns the count');
    expect(q.distractors).toEqual(['wrong one', 'wrong two']);
    expect(q.snippets).toEqual([
      { file: 'src/app.js', start: 3, end: 7 },
      { file: 'b.js', start: NaN, end: NaN },
    ]);
  });

  it('trims spaces the model left inside inline code', () => {
    const [q] = parseQuestionsReply(
      reply(
        raw(1, {
          question: 'Why is `htmlspecialchars()` used around `\t$pageTitle` here?',
          answer: 'It escapes ` $pageTitle `',
          distractors: ["It holds `' '`", 'It is ` `', 'It is `` `x` ``'],
        }),
      ),
    ).questions;
    expect(q.question).toBe('Why is `htmlspecialchars()` used around `$pageTitle` here?');
    expect(q.answer).toBe('It escapes `$pageTitle`');
    // A space that is the value, or padding that holds a backtick, stays.
    expect(q.distractors).toEqual(["It holds `' '`", 'It is ` `', 'It is `` `x` ``']);
  });

  it('reads missing distractors and snippets as empty lists', () => {
    const [q] = parseQuestionsReply(
      reply({ question: 'Why?', answer: 'Because', broader: 'yes' }),
    ).questions;
    expect(q).toMatchObject({ snippets: [], distractors: [], broader: false });
  });

  it('leaves the context summary empty when there is none', () => {
    expect(parseQuestionsReply(reply(raw(1))).contextSummary).toBe('');
  });
});

describe('arrangeQuestions', () => {
  const q = (name, broader = false) => ({ name, broader });

  it('puts broader questions last and cuts to the limit', () => {
    const { questions, surplus } = arrangeQuestions(
      [q('b1', true), q('c1'), q('b2', true), q('c2')],
      3,
    );
    expect(questions.map((x) => x.name)).toEqual(['c1', 'c2', 'b1']);
    expect(surplus).toBe(1);
  });

  it('reports no surplus when under the limit', () => {
    expect(arrangeQuestions([q('c1')], 3).surplus).toBe(0);
  });
});

describe('resolveSnippets', () => {
  const ask = (...snippets) => ({ question: 'Q', snippets });
  const ref = (file, start, end = start) => ({ file, start, end });
  const resolve = (questions, sources = SOURCES) => resolveSnippets(questions, sources);

  it('reads each snippet out of the file it names', () => {
    const { questions } = resolve([ask(ref('app.js', 2, 3))]);
    expect(questions[0].snippets).toEqual([
      {
        file: 'app.js',
        language: 'js',
        code: 'const total2 = items.length;\nconst total3 = items.length;',
        start: 2,
        end: 3,
      },
    ]);
  });

  it('leaves out blank lines at either end and reads an end past the file as its last line', () => {
    const source = {
      filepath: 'b.py',
      lines: ['', '    x = 1  ', 'y = 2', ''],
      studentLines: 'all',
    };
    const [q] = resolve([ask(ref('b.py', 1, 99))], [source]).questions;
    expect(q.snippets[0]).toMatchObject({ code: '    x = 1  \ny = 2', start: 2, end: 3 });
  });

  it('matches a file name case-insensitively, by the end of its path, and without decoration', () => {
    const source = { ...APP, filepath: 'src/App.js' };
    const names = ['src/app.js', 'App.js', './src/App.js', '`src/App.js`', 'src/App.js:12-20'];
    const { questions } = resolve(
      names.map((name) => ask(ref(name, 1))),
      [source],
    );
    expect(questions.map((q) => q.snippets[0].file)).toEqual(names.map(() => 'src/App.js'));
  });

  it.each([
    ['a file it was not sent', ref('secret.js', 1)],
    ['only the end of a file name', ref('pp.js', 1)],
    ['line 0', ref('app.js', 0, 1)],
    ['a line past the end of the file', ref('app.js', 9, 12)],
    ['a range that runs backwards', ref('app.js', 3, 2)],
    ['a line number that is not a whole number', ref('app.js', NaN, 2)],
  ])('drops a question naming %s', (_, snippet) => {
    const result = resolve([ask(snippet), ask(ref('app.js', 1))]);
    expect(result.questions).toHaveLength(1);
    expect(result.unresolved).toBe(1);
  });

  it('drops a question whose range is longer than a snippet may be', () => {
    const lines = Array.from({ length: SNIPPET_MAX_LINES + 1 }, (_, i) => `line ${i}`);
    const source = { filepath: 'long.js', lines, studentLines: 'all' };
    const result = resolve(
      [ask(ref('long.js', 1, SNIPPET_MAX_LINES + 1)), ask(ref('long.js', 1, SNIPPET_MAX_LINES))],
      [source],
    );
    expect(result.unresolved).toBe(1);
    expect(result.questions[0].snippets[0].end).toBe(SNIPPET_MAX_LINES);
  });

  it('drops a question whose range holds only blank lines', () => {
    const source = { filepath: 'b.py', lines: ['x = 1', '', ''], studentLines: 'all' };
    expect(resolve([ask(ref('b.py', 2, 3))], [source]).unresolved).toBe(1);
  });

  it('drops a question when a name matches more than one file', () => {
    const sources = [
      { ...APP, filepath: 'a/index.php' },
      { ...APP, filepath: 'b/index.php' },
    ];
    expect(resolve([ask(ref('index.php', 1))], sources).unresolved).toBe(1);
    expect(resolve([ask(ref('a/index.php', 1))], sources).unresolved).toBe(0);
  });

  it('drops a question when any one of its snippets cannot be read, and names the file', () => {
    const result = resolve([ask(ref('app.js', 1), ref('secret.js', 1))]);
    expect(result).toEqual({
      questions: [],
      unresolved: 1,
      notStudentWork: 0,
      unknownFiles: ['secret.js'],
    });
  });

  it('keeps a question with no snippet', () => {
    expect(resolve([ask()]).questions).toHaveLength(1);
  });

  describe("the student's own lines", () => {
    const marked = {
      filepath: 'index.php',
      lines: ['$a = 1;', '$b = 2;', '$c = 3;'],
      studentLines: new Set([2]),
    };
    const starter = { filepath: 'lib.php', lines: ['function f() {}'], studentLines: new Set() };
    const sources = [marked, starter, APP];

    it.each([
      ['an added line of a marked file', [ref('index.php', 1, 2)], true],
      ['only unchanged lines of a marked file', [ref('index.php', 1)], false],
      ['only codebase context', [ref('lib.php', 1)], false],
      ['codebase context beside a new file', [ref('lib.php', 1), ref('app.js', 1)], true],
      ['codebase context beside unchanged lines', [ref('lib.php', 1), ref('index.php', 3)], false],
    ])('%s', (_, snippets, kept) => {
      const result = resolve([ask(...snippets)], sources);
      expect(result.questions).toHaveLength(kept ? 1 : 0);
      expect(result.notStudentWork).toBe(kept ? 0 : 1);
    });
  });
});

describe('findLeakedAnswers', () => {
  const answer = 'It returns the number of entries in the items array';

  it('flags a question whose text carries a correct answer', () => {
    const leaky = { question: `Given that ${answer.toLowerCase()}, why?`, answer: 'Because' };
    const clean = { question: 'What does `count` return?', answer };
    expect(findLeakedAnswers([clean, leaky])).toEqual([leaky]);
  });

  it('ignores answer words inside inline code', () => {
    const q = { question: `What does \`${answer}\` mean?`, answer };
    expect(findLeakedAnswers([q])).toEqual([]);
  });

  it('ignores short answers', () => {
    const q = { question: 'Does it return null or false?', answer: 'null' };
    expect(findLeakedAnswers([q])).toEqual([]);
  });
});

describe('carriesAnswer', () => {
  const questions = [{ answer: 'It returns the number of entries in the items array' }];

  it('finds an answer in a context summary', () => {
    const summary =
      'These questions are focused towards how it returns the number of entries in the items array.';
    expect(carriesAnswer(summary, questions)).toBe(true);
  });

  it('passes a summary that only names the topic', () => {
    expect(carriesAnswer('These questions are focused towards array handling.', questions)).toBe(
      false,
    );
  });
});

describe('renderQuestions', () => {
  const parsed = (...questions) =>
    numberQuestions(
      resolveSnippets(parseQuestionsReply(reply(...questions)).questions, SOURCES).questions,
    );

  it('renders the instructor view with answers and distractors', () => {
    expect(renderQuestions(parsed(raw(1), raw(2)), { view: 'instructor' })).toBe(
      [
        '**`app.js`**',
        '',
        '```js',
        'const total1 = items.length;',
        '```',
        '',
        '1. **What does** `total1` **hold after this line runs?**',
        '',
        '   **Answer:**',
        '   - It holds the number of entries in the items array for question 1',
        '',
        '   **Distractors for Multiple-Choice Quiz:**',
        '   - wrong 1a',
        '   - wrong 1b',
        '   - wrong 1c',
        '',
        '---',
        '',
        '**`app.js`**',
        '',
        '```js',
        'const total2 = items.length;',
        '```',
        '',
        '2. **What does** `total2` **hold after this line runs?**',
        '',
        '   **Answer:**',
        '   - It holds the number of entries in the items array for question 2',
        '',
        '   **Distractors for Multiple-Choice Quiz:**',
        '   - wrong 2a',
        '   - wrong 2b',
        '   - wrong 2c',
      ].join('\n'),
    );
  });

  it('leaves the distractor heading out when there are none', () => {
    const out = renderQuestions(parsed(raw(1, { distractors: [] })), { view: 'instructor' });
    expect(out).not.toContain('Distractors');
    expect(out).toContain('**Answer:**');
  });

  it('renders the answer alone for include_answers', () => {
    const out = renderQuestions(parsed(raw(1)), { view: 'answers' });
    expect(out).toContain('   **Answer:**\n   - It holds the number of entries');
    expect(out).not.toMatch(/wrong|Distractors|gmc:answer/);
  });

  it('renders no answer content in the student view', () => {
    const out = renderQuestions(parsed(raw(1)), { view: 'student' });
    expect(out).toMatch(/1\. \*\*What does\*\* `total1`/);
    expect(out).not.toMatch(/Answer|entries in the items|wrong|gmc:answer/);
  });

  // Snippets are the student's own code, so they can carry anything.
  it('keeps a snippet carrying fences and markers inside a longer fence', () => {
    const lines = ['<!-- gmc:answer -->', '```', '**Answer:**', '```'];
    const readme = { filepath: 'README.md', lines, studentLines: 'all' };
    const [q] = resolveSnippets(
      parseQuestionsReply(
        reply(raw(1, { snippets: [{ file: 'README.md', start_line: 1, end_line: 4 }] })),
      ).questions,
      [readme],
    ).questions;
    const out = renderQuestions(numberQuestions([q]), { view: 'student' });
    expect(out).toContain('````md\n' + lines.join('\n') + '\n````');
  });

  it('shows a snippet from a file without an extension without a language', () => {
    const makefile = { filepath: 'Makefile', lines: ['all: build'], studentLines: 'all' };
    const [q] = resolveSnippets(
      parseQuestionsReply(
        reply(raw(1, { snippets: [{ file: 'Makefile', start_line: 1, end_line: 1 }] })),
      ).questions,
      [makefile],
    ).questions;
    const out = renderQuestions(numberQuestions([q]), { view: 'student' });
    expect(out.startsWith('**`Makefile`**\n\n```\nall: build\n```\n\n1. ')).toBe(true);
  });

  it('drops bold the model added to the question and bolds around code', () => {
    const out = renderQuestions(parsed(raw(1, { question: 'Why is **`a ** b`** used?' })), {
      view: 'student',
    });
    expect(out).toContain('1. **Why is** `a ** b` **used?**');
  });

  it('puts one Broader Questions heading above the first broader question', () => {
    const questions = numberQuestions(
      arrangeQuestions(
        resolveSnippets(
          parseQuestionsReply(
            reply(raw(1, { broader: true, snippets: [] }), raw(2), raw(3, { broader: true })),
          ).questions,
          SOURCES,
        ).questions,
        3,
      ).questions,
    );
    const blocks = renderQuestions(questions, { view: 'student' }).split('\n\n---\n\n');
    expect(blocks.map((b) => b.startsWith('## Broader Questions\n\n'))).toEqual([
      false,
      true,
      false,
    ]);
    expect(blocks[1]).toContain('2. **What does** `total1`');
  });

  it('keeps the numbers it was given, gaps included', () => {
    const [first, , third] = parsed(raw(1), raw(2), raw(3));
    const out = renderQuestions([first, third], { view: 'student' });
    expect(out).toMatch(/^1\. /m);
    expect(out).toMatch(/^3\. /m);
    expect(out).not.toMatch(/^2\. /m);
  });
});
