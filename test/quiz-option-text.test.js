import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { numberQuestions, renderQuestions } from '../src/postprocess.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// The quiz generator is a Node script embedded in the workflow YAML that is
// seeded into each instructor repository, so it cannot be imported. These two
// helpers are pure and self-contained, so they are lifted out of the heredoc by
// source text and evaluated. An extraction failure throws rather than silently
// testing nothing — renaming either function is meant to break this test.
const workflow = readFileSync(join(__dirname, '../src/workflows/generate-lms-quiz.yml'), 'utf8');

function extractFunction(name) {
  const start = workflow.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`${name}() not found in generate-lms-quiz.yml`);
  const end = workflow.indexOf('\n          }\n', start);
  if (end === -1) throw new Error(`${name}() has no closing brace at the expected indent`);
  return workflow.slice(start, end + '\n          }'.length);
}

const { stripInlineMarkdown, hasBlankOption, parseQuestions } = new Function(
  [
    extractFunction('stripInlineMarkdown'),
    extractFunction('hasBlankOption'),
    extractFunction('parseQuestions'),
    'return { stripInlineMarkdown, hasBlankOption, parseQuestions };',
  ].join('\n'),
)();

/**
 * One question block in the shape the released v1 action delivers to the
 * instructor repository: the <!-- gmc:answer --> markers are stripped there, so
 * the parser is on its heading fallback path — which is how the blocks below
 * were actually generated.
 */
function block({ question, answer, distractors }) {
  return [
    '**`index.php`**',
    '',
    '```php',
    '$stars = 4;',
    '```',
    '',
    `1. **${question}**`,
    '',
    '   **Answer:**',
    `   - ${answer}`,
    '',
    '   **Distractors for Multiple-Choice Quiz:**',
    ...distractors.map((d) => `   - ${d}`),
    '',
  ].join('\n');
}

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

describe('parseQuestions option handling', () => {
  it('keeps a four-asterisk correct answer intact through to the option text', () => {
    // Verbatim from the questions.md that produced "Option element without
    // text": str_repeat('*', 4) written as an inline-code `****`.
    const [q] = parseQuestions(
      block({
        question: "What does `str_repeat('*', $stars)` output when `$stars` is 4?",
        answer: '`****`',
        distractors: ['`*4*`', '`stars`', '`5`'],
      }),
    );
    expect(stripInlineMarkdown(q.answer)).toBe('****');
    expect(hasBlankOption(q)).toBe(false);
  });

  it('drops a distractor that repeats the correct answer', () => {
    // Also verbatim: the model listed "Guestbook Wall" as both the answer and a
    // distractor, so the CSV offered the same text at 100 and at 0 points.
    const [q] = parseQuestions(
      block({
        question: 'What value does `$pageTitle` receive initially?',
        answer: 'Guestbook Wall',
        distractors: ['Kitts Guestbook', 'Guestbook Wall', 'null', 'Array'],
      }),
    );
    expect(q.incorrect).toEqual(['Kitts Guestbook', 'null', 'Array']);
  });

  it('compares options after stripping, so `entry` and entry are one option', () => {
    const [q] = parseQuestions(
      block({
        question: 'Which string is selected?',
        answer: 'entry',
        distractors: ['`entry`', 'entries', 'total'],
      }),
    );
    expect(q.incorrect).toEqual(['entries', 'total']);
  });
});

describe('parseQuestions stray marker residue', () => {
  it('ignores the `--><--` line the model leaves between the answer and the distractors', () => {
    const source = block({
      question: "What does `date('Y')` output?",
      answer: 'The current four-digit year as a string',
      distractors: ['The full current date and timestamp in ISO format', 'The two-digit month'],
    }).replace('   **Distractors', '   --><--\n   **Distractors');
    const [q] = parseQuestions(source);
    expect(q.incorrect).toHaveLength(2);
    expect(q.incorrect.join(' ')).not.toContain('--><--');
  });
});

// questions.md is rendered by renderQuestions, and this is the parser that
// reads it back. Every question has to come back whole, with its own options,
// whatever its answer, options or code contain.
describe('parseQuestions on the rendered instructor copy', () => {
  const question = (n, overrides = {}) => ({
    snippets: [{ file: `q${n}.php`, language: 'php', code: '$stars = 4;' }],
    question: `What is \`$stars\` in question ${n}?`,
    answer: `answer ${n}`,
    distractors: [`wrong ${n}a`, `wrong ${n}b`, `wrong ${n}c`],
    broader: false,
    ...overrides,
  });
  const parse = (...questions) =>
    parseQuestions(renderQuestions(numberQuestions(questions), { view: 'instructor' }));

  it('parses each question with its own answer, options and snippet', () => {
    expect(parse(question(1), question(2))).toEqual([
      {
        question: 'What is `$stars` in question 1?',
        answer: 'answer 1',
        incorrect: ['wrong 1a', 'wrong 1b', 'wrong 1c'],
        filePath: 'q1.php',
        snippetLang: 'php',
        snippet: ['$stars = 4;'],
      },
      {
        question: 'What is `$stars` in question 2?',
        answer: 'answer 2',
        incorrect: ['wrong 2a', 'wrong 2b', 'wrong 2c'],
        filePath: 'q2.php',
        snippetLang: 'php',
        snippet: ['$stars = 4;'],
      },
    ]);
  });

  it('parses an option that quotes the answer-container markers as text', () => {
    const parsed = parse(
      question(1, { answer: '<!-- /gmc:answer --> is a comment', distractors: ['- x', 'y', 'z'] }),
    );
    expect(parsed[0].answer).toBe('<!-- /gmc:answer --> is a comment');
    expect(parsed[0].incorrect).toEqual(['- x', 'y', 'z']);
  });

  // Student code is fenced with a longer run than any it contains. A ``` line
  // in it once ended the snippet for this parser, and answer markers written
  // below it in the code were read as the question's options — letting the
  // student choose the answer their own quiz marks correct.
  it('reads answer markers in the student code as code, not options', () => {
    const code = [
      'x = 1',
      '```',
      '<!-- gmc:answer -->',
      '- FORGED ANSWER',
      '- forged wrong',
      '<!-- /gmc:answer -->',
      '```',
      'y = 2',
    ].join('\n');
    const [parsed] = parse(question(1, { snippets: [{ file: 'a.py', language: 'python', code }] }));
    expect(parsed.answer).toBe('answer 1');
    expect(parsed.incorrect).toEqual(['wrong 1a', 'wrong 1b', 'wrong 1c']);
    expect(parsed.snippetLang).toBe('python');
    expect(parsed.snippet).toEqual(code.split('\n'));
  });

  it('parses a broader question with no snippet and no file', () => {
    const parsed = parse(question(1), question(2, { snippets: [], broader: true }));
    expect(parsed[1]).toMatchObject({ answer: 'answer 2', filePath: null, snippet: [] });
  });
});

// A question the model wrote without a snippet, most often under a Broader
// Questions heading. It must show no code in the quiz, not the code of the
// question before it, and a heading must never be taken for its filename.
describe('parseQuestions for a question with no snippet', () => {
  const withSnippet = block({
    question: 'What is $stars?',
    answer: '4',
    distractors: ['3', '5', '0'],
  });
  const bare = (question, lead = '') =>
    [
      lead,
      `41. **${question}**`,
      '',
      '   <!-- gmc:answer -->',
      '   **Answer:**',
      '   - right',
      '',
      '   **Distractors for Multiple-Choice Quiz:**',
      '   - wrong a',
      '   - wrong b',
      '   - wrong c',
      '   <!-- /gmc:answer -->',
    ].join('\n');
  const parseSecond = (lead) =>
    parseQuestions(`${withSnippet}\n---\n${bare('What does the page print?', lead)}`)[1];

  it.each([
    ['no heading', ''],
    ['a Markdown heading', '## Broader Questions\n'],
    ['a bold Markdown heading', '**## Broader Questions**\n'],
    ['a bold heading', '**Broader Questions**\n'],
  ])('shows no file or code under %s', (_label, lead) => {
    const q = parseSecond(lead);
    expect(q.question).toBe('What does the page print?');
    expect(q.filePath).toBeNull();
    expect(q.snippet).toEqual([]);
    expect(q.answer).toBe('right');
    expect(q.incorrect).toHaveLength(3);
  });

  it('keeps a filename header that has no snippet under it', () => {
    expect(parseSecond('**`index.php`**\n').filePath).toBe('index.php');
  });

  it('still reads a filename with a space when a snippet confirms it', () => {
    const q = parseSecond('## Broader Questions\n\n**My Page.php**\n\n```php\necho 1;\n```\n');
    expect(q.filePath).toBe('My Page.php');
    expect(q.snippet).toEqual(['echo 1;']);
    expect(q.snippetLang).toBe('php');
  });

  it('never takes a bold Markdown heading for the filename, even above a snippet', () => {
    const q = parseSecond('**## Broader Questions**\n\n```php\necho 1;\n```\n');
    expect(q.filePath).toBeNull();
    expect(q.snippet).toEqual(['echo 1;']);
  });
});
