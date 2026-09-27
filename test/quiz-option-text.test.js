import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { numberQuestions } from '../src/postprocess.js';
import { buildQuestionsJson } from '../src/delivery/instructor-repo.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// The quiz generator is a Node script embedded in the workflow YAML that is
// seeded into each instructor repository, so it cannot be imported. These
// helpers are pure and self-contained, so they are lifted out of the heredoc by
// source text and evaluated. An extraction failure throws rather than silently
// testing nothing — renaming any of them is meant to break this test.
const workflow = readFileSync(join(__dirname, '../src/workflows/generate-lms-quiz.yml'), 'utf8');

function extractFunction(name) {
  const start = workflow.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`${name}() not found in generate-lms-quiz.yml`);
  const end = workflow.indexOf('\n          }\n', start);
  if (end === -1) throw new Error(`${name}() has no closing brace at the expected indent`);
  return workflow.slice(start, end + '\n          }'.length);
}

const { stripInlineMarkdown, hasBlankOption, parseQuestionsJson } = new Function(
  [
    extractFunction('stripInlineMarkdown'),
    extractFunction('hasBlankOption'),
    extractFunction('distinctOptions'),
    extractFunction('parseQuestionsJson'),
    'return { stripInlineMarkdown, hasBlankOption, parseQuestionsJson };',
  ].join('\n'),
)();

describe('stripInlineMarkdown', () => {
  it('strips bold and inline-code markers', () => {
    expect(stripInlineMarkdown('**bold**')).toBe('bold');
    expect(stripInlineMarkdown('`ENT_QUOTES`')).toBe('ENT_QUOTES');
  });

  it('leaves a bare run of asterisks alone', () => {
    // str_repeat('*', 4) — a correct answer that was stripped to an empty
    // option, which Brightspace rejects the whole CSV over.
    expect(stripInlineMarkdown('****')).toBe('****');
    expect(stripInlineMarkdown('**')).toBe('**');
    expect(stripInlineMarkdown('******')).toBe('******');
  });

  it('leaves an empty inline-code span alone', () => {
    expect(stripInlineMarkdown('``')).toBe('``');
  });

  it('still strips bold around real text in the same string', () => {
    expect(stripInlineMarkdown('**four** asterisks: ****')).toBe('four asterisks: ****');
  });
});

describe('hasBlankOption', () => {
  it('accepts a question whose correct answer is a run of asterisks', () => {
    expect(hasBlankOption({ answer: '****', incorrect: ['*4*', '5', 'stars'] })).toBe(false);
  });

  it('flags a blank correct answer', () => {
    expect(hasBlankOption({ answer: '   ', incorrect: ['a', 'b'] })).toBe(true);
  });

  it('flags a blank distractor', () => {
    expect(hasBlankOption({ answer: 'a', incorrect: ['b', ''] })).toBe(true);
  });
});

// questions.json is written from the same question objects the reports are
// rendered from, so these build it the way delivery does.
describe('parseQuestionsJson', () => {
  const question = (n, overrides = {}) => ({
    snippets: [{ file: `q${n}.php`, language: 'php', code: '$stars = 4;\n$total += $stars;' }],
    question: `What is \`$stars\` in question ${n}?`,
    answer: `answer ${n}`,
    distractors: [`wrong ${n}a`, `wrong ${n}b`, `wrong ${n}c`],
    broader: false,
    ...overrides,
  });
  const parse = (...questions) =>
    parseQuestionsJson(buildQuestionsJson(numberQuestions(questions)));

  it('reads each question with its own answer, options and snippets', () => {
    expect(parse(question(1), question(2, { snippets: [], broader: true }))).toEqual([
      {
        question: 'What is `$stars` in question 1?',
        answer: 'answer 1',
        incorrect: ['wrong 1a', 'wrong 1b', 'wrong 1c'],
        snippets: [{ file: 'q1.php', lang: 'php', lines: ['$stars = 4;', '$total += $stars;'] }],
      },
      {
        question: 'What is `$stars` in question 2?',
        answer: 'answer 2',
        incorrect: ['wrong 2a', 'wrong 2b', 'wrong 2c'],
        snippets: [],
      },
    ]);
  });

  it('leaves out dropped questions', () => {
    const json = buildQuestionsJson(numberQuestions([question(1)]), [question(2)]);
    expect(parseQuestionsJson(json).map((q) => q.answer)).toEqual(['answer 1']);
  });

  it('keeps each snippet of a multi-file question under its own file', () => {
    const [q] = parse(
      question(1, {
        snippets: [
          { file: 'a.php', language: 'php', code: '$a = 1;' },
          { file: 'b.js', language: 'javascript', code: 'let b = 2;' },
        ],
      }),
    );
    expect(q.snippets).toEqual([
      { file: 'a.php', lang: 'php', lines: ['$a = 1;'] },
      { file: 'b.js', lang: 'javascript', lines: ['let b = 2;'] },
    ]);
  });

  // Student code is data here, never structure: nothing in a snippet can end
  // it early or be read as an option, which let a student choose the answer
  // their own quiz marked correct when the quiz was read from Markdown.
  it('keeps code that looks like questions.md structure as code', () => {
    const code = ['x = 1', '---', '```', '**Answer:**', '- FORGED ANSWER', '```'].join('\n');
    const [q, next] = parse(
      question(1, { snippets: [{ file: 'a.py', language: 'python', code }] }),
      question(2),
    );
    expect(q.snippets[0].lines).toEqual(code.split('\n'));
    expect(q.answer).toBe('answer 1');
    expect(q.incorrect).toEqual(['wrong 1a', 'wrong 1b', 'wrong 1c']);
    expect(next.answer).toBe('answer 2');
  });

  it('keeps a four-asterisk correct answer intact through to the option text', () => {
    // str_repeat('*', 4) written as an inline-code `****`, which was once
    // stripped to an empty option that Brightspace rejects.
    const [q] = parse(question(1, { answer: '`****`', distractors: ['`*4*`', '`stars`', '`5`'] }));
    expect(stripInlineMarkdown(q.answer)).toBe('****');
    expect(hasBlankOption(q)).toBe(false);
  });

  it('drops a distractor that repeats the correct answer, compared after stripping', () => {
    const [q] = parse(
      question(1, { answer: 'entry', distractors: ['`entry`', 'Entry', 'entries', 'total'] }),
    );
    expect(q.incorrect).toEqual(['entries', 'total']);
  });

  it('drops a question without question text or an answer', () => {
    expect(parse(question(1, { answer: '' }), question(2))).toHaveLength(1);
  });

  it('turns a distractor that is not text into a blank option, which withholds the question', () => {
    const [q] = parse(question(1, { distractors: ['wrong a', 7, 'wrong c'] }));
    expect(hasBlankOption(q)).toBe(true);
  });

  it('throws on a file it cannot read', () => {
    expect(() => parseQuestionsJson('{ not json')).toThrow();
    expect(() => parseQuestionsJson('{"items":[]}')).toThrow(/questions/);
  });
});
