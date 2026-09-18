import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { normaliseSeparators } from '../src/postprocess.js';

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

// normaliseSeparators runs on the text that becomes questions.md, so a
// separator the model left out no longer reaches the parser as one merged
// item carrying both questions' options — two of them correct.
describe('parseQuestions after normaliseSeparators', () => {
  const containered = (n, answer) =>
    [
      `**\`q${n}.php\`**`,
      '',
      '```php',
      '$stars = 4;',
      '```',
      '',
      `${n}. **Question ${n}?**`,
      '',
      '   <!-- gmc:answer -->',
      '   **Answer:**',
      `   - ${answer}`,
      '',
      '   **Distractors for Multiple-Choice Quiz:**',
      `   - wrong ${n}a`,
      `   - wrong ${n}b`,
      `   - wrong ${n}c`,
      '   <!-- /gmc:answer -->',
    ].join('\n');

  const merged = `${containered(1, 'first answer')}\n\n${containered(2, 'second answer')}`;

  it('merges two questions into one item without it', () => {
    const questions = parseQuestions(merged);
    expect(questions).toHaveLength(1);
    expect(questions[0].incorrect).toContain('second answer');
  });

  it('parses each question with its own options once restored', () => {
    const questions = parseQuestions(normaliseSeparators(merged));
    expect(questions.map((q) => [q.question, q.answer, q.incorrect.length])).toEqual([
      ['Question 1?', 'first answer', 3],
      ['Question 2?', 'second answer', 3],
    ]);
  });

  it.each(['----', '--- '])(
    'parses both questions across a %j separator once rewritten',
    (variant) => {
      const source = `${containered(1, 'first answer')}\n\n${variant}\n\n${containered(2, 'second answer')}`;
      expect(parseQuestions(source)).toHaveLength(1);
      expect(parseQuestions(normaliseSeparators(source)).map((q) => q.answer)).toEqual([
        'first answer',
        'second answer',
      ]);
    },
  );
});
