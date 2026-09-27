import { describe, expect, it } from 'vitest';
import {
  arrangeQuestions,
  carriesAnswer,
  dropQuestionsOnUnassessedFiles,
  findLeakedAnswers,
  numberQuestions,
  parseQuestionsReply,
  renderQuestions,
  stripLineMarkers,
} from '../src/postprocess.js';

/** One question object as the model is asked to write it. */
const raw = (n, overrides = {}) => ({
  snippets: [{ file: 'app.js', language: 'javascript', code: `const total${n} = items.length;` }],
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
        snippets: [
          { file: 'app.js', language: 'javascript', code: 'const total1 = items.length;' },
        ],
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

  it('normalises the fields for rendering', () => {
    const [q] = parseQuestionsReply(
      reply(
        raw(1, {
          question: 'What does\n`x` return?',
          answer: 'It returns\n  the count',
          distractors: ['wrong one', '', 'wrong two', 7],
          snippets: [
            { file: '`src/app.js`', language: 'js', code: 'const x = 1;\r\nx++;\r\n' },
            { file: 'empty.js', language: 'js', code: '\n  \n' },
            { file: 'b.js', language: 'not a language!', code: '\n\n    indented();  \n\n' },
          ],
        }),
      ),
    ).questions;
    expect(q.question).toBe('What does `x` return?');
    expect(q.answer).toBe('It returns the count');
    expect(q.distractors).toEqual(['wrong one', 'wrong two']);
    expect(q.snippets).toEqual([
      { file: 'src/app.js', language: 'js', code: 'const x = 1;\nx++;' },
      { file: 'b.js', language: '', code: '    indented();' },
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

describe('stripLineMarkers', () => {
  const on = (file, code) => ({ question: 'Q', snippets: [{ file, language: 'php', code }] });

  it('removes the marker column the model copied from a marked file', () => {
    const questions = [
      on('data/entries.php', "+    ['author' => 'Billy'],\n     ['author' => 'Anita'],\n+"),
      on('index.php', '-$old = 1;\n+$new = 2;\n echo $new;'),
    ];
    const { questions: result, stripped } = stripLineMarkers(questions, [
      'data/entries.php',
      'index.php',
    ]);
    expect(stripped).toBe(2);
    expect(result[0].snippets[0].code).toBe(
      "    ['author' => 'Billy'],\n    ['author' => 'Anita'],",
    );
    // A removed line is no longer in the file, so it goes.
    expect(result[1].snippets[0].code).toBe('$new = 2;\necho $new;');
  });

  it('leaves code the model already cleaned up', () => {
    const questions = [
      on('index.php', '    $total += $stars;\n    $count++;'),
      on('index.php', '$a = 1;\n+$b = 2;'),
    ];
    const result = stripLineMarkers(questions, ['index.php']);
    expect(result.stripped).toBe(0);
    expect(result.questions.map((q) => q.snippets[0].code)).toEqual([
      '    $total += $stars;\n    $count++;',
      '$a = 1;\n+$b = 2;',
    ]);
  });

  it('only touches snippets from marked files', () => {
    const questions = [on('new.php', '+$x = 1;\n+$y = 2;')];
    expect(stripLineMarkers(questions, ['index.php']).stripped).toBe(0);
    expect(stripLineMarkers(questions, []).questions).toBe(questions);
  });
});

describe('dropQuestionsOnUnassessedFiles', () => {
  const on = (...files) => ({ snippets: files.map((file) => ({ file, code: 'x' })) });

  it('keeps questions that all show assessed files', () => {
    const questions = [on('src/app.py'), on('app.py')];
    const result = dropQuestionsOnUnassessedFiles(questions, ['src/app.py']);
    expect(result).toEqual({ questions, dropped: 0, unassessed: [], failedOpen: false });
  });

  it('drops a question about an unassessed file', () => {
    const result = dropQuestionsOnUnassessedFiles([on('app.py'), on('README.md')], ['app.py']);
    expect(result.questions).toHaveLength(1);
    expect(result.dropped).toBe(1);
    expect(result.unassessed).toEqual(['README.md']);
  });

  it('matches case-insensitively and ignores a trailing line number', () => {
    const result = dropQuestionsOnUnassessedFiles([on('./SRC/App.py:12-20')], ['src/app.py']);
    expect(result.dropped).toBe(0);
    expect(result.failedOpen).toBe(false);
  });

  it('does not match a name that is only a suffix of a file name', () => {
    const result = dropQuestionsOnUnassessedFiles([on('pp.py'), on('app.py')], ['app.py']);
    expect(result.dropped).toBe(1);
  });

  it('drops a multi-file question when any of its files is unassessed', () => {
    const result = dropQuestionsOnUnassessedFiles(
      [on('app.py', 'secret.py'), on('app.py')],
      ['app.py'],
    );
    expect(result.dropped).toBe(1);
    expect(result.unassessed).toEqual(['secret.py']);
  });

  it('keeps a question with no snippet', () => {
    expect(dropQuestionsOnUnassessedFiles([on(), on('x.py')], ['app.py']).dropped).toBe(1);
  });

  it('fails open when every question would be dropped', () => {
    const questions = [on('a.py'), on('b.py')];
    const result = dropQuestionsOnUnassessedFiles(questions, ['app.py']);
    expect(result).toEqual({
      questions,
      dropped: 0,
      unassessed: ['a.py', 'b.py'],
      failedOpen: true,
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
    numberQuestions(parseQuestionsReply(reply(...questions)).questions);

  it('renders the instructor view with answers and distractors', () => {
    expect(renderQuestions(parsed(raw(1), raw(2)), { view: 'instructor' })).toBe(
      [
        '**`app.js`**',
        '',
        '```javascript',
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
        '```javascript',
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
    const code = '<!-- gmc:answer -->\n```\n**Answer:**\n```';
    const out = renderQuestions(
      parsed(raw(1, { snippets: [{ file: 'README.md', language: 'markdown', code }] })),
      { view: 'student' },
    );
    expect(out).toContain('````markdown\n' + code + '\n````');
  });

  it('shows a snippet without a file name without a header', () => {
    const out = renderQuestions(
      parsed(raw(1, { snippets: [{ file: '', language: '', code: 'x = 1' }] })),
      { view: 'student' },
    );
    expect(out.startsWith('```\nx = 1\n```\n\n1. ')).toBe(true);
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
        parseQuestionsReply(
          reply(raw(1, { broader: true, snippets: [] }), raw(2), raw(3, { broader: true })),
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
