import { describe, expect, it } from 'vitest';
import {
  countQuestions,
  redactStudentQuestions,
  renumberQuestions,
  repairOrphanFences,
} from '../src/postprocess.js';

/** One question in the shape the model emits, with its snippet fenced. */
function question({ n, file = 'partials/header.php', code, stem, answer, distractor }) {
  return [
    `**\`${file}\`**`,
    '',
    '```php',
    code,
    '```',
    '',
    `${n}. ${stem}`,
    '',
    '   <!-- gmc:answer -->',
    '   **Answer:**',
    `   - ${answer}`,
    '',
    '   **Distractors for Multiple-Choice Quiz:**',
    `   - ${distractor}`,
    '   <!-- /gmc:answer -->',
  ].join('\n');
}

const before = question({
  n: 23,
  file: 'data/collection.php',
  code: "'estimatedCost' => 900.00,",
  stem: 'What data type is used for the `estimatedCost` value?',
  answer: 'Float',
  distractor: 'Integer',
});
// Reproduces a gemini-3.5-flash-lite reply: the snippet has its closing fence
// but not its opening one.
const orphaned = question({
  n: 24,
  code: '<body>\n\n<h1><?= htmlspecialchars($pageTitle) ?></h1>',
  stem: 'What HTML heading level tag is used to wrap `$pageTitle`?',
  answer: 'h1 heading wraps the page title right after the body tag',
  distractor: 'h2',
}).replace('```php\n', '');
const after = question({
  n: 25,
  code: '<meta charset="UTF-8">',
  stem: 'What character set meta tag is declared?',
  answer: 'UTF-8',
  distractor: 'ASCII',
});
const report = [before, orphaned, after].join('\n\n---\n\n');

describe('repairOrphanFences', () => {
  it('restores the missing opening fence after the filename header', () => {
    const { text, repaired } = repairOrphanFences(report);
    expect(repaired).toBe(1);
    expect(text).toContain('**`partials/header.php`**\n\n```\n<body>');
  });

  it('brings the swallowed question back into the count and the numbering', () => {
    expect(countQuestions(report)).toBe(2);
    const { text } = repairOrphanFences(report);
    expect(countQuestions(text)).toBe(3);
    const stems = renumberQuestions(text).match(/^\d+\. What/gm);
    expect(stems).toEqual(['1. What', '2. What', '3. What']);
  });

  it('leaves a well-formed report unchanged', () => {
    const wellFormed = [before, after].join('\n\n---\n\n');
    expect(repairOrphanFences(wellFormed)).toEqual({ text: wellFormed, repaired: 0 });
  });

  it('leaves a header followed by its stem alone', () => {
    const stemFirst = [
      '**app.js**',
      '',
      '1. What does this return?',
      '',
      '```js',
      'return 1;',
      '```',
    ].join('\n');
    expect(repairOrphanFences(stemFirst).repaired).toBe(0);
  });

  it('does not reach past a stem to a fence belonging to a later question', () => {
    const unfenced = [
      '**app.js**',
      '',
      'const x = 1;',
      '',
      '1. What is x?',
      '',
      '---',
      '',
      '```',
      'const y = 2;',
      '```',
    ].join('\n');
    expect(repairOrphanFences(unfenced).repaired).toBe(0);
  });
});

describe('redactStudentQuestions with an orphaned closing fence', () => {
  it('withholds both questions the fake fence merged rather than leak an answer', () => {
    const { text, structural } = redactStudentQuestions(renumberQuestions(report));
    expect(structural).toBe(2);
    expect(text).not.toContain('**Answer:**');
    expect(text).not.toContain('gmc:answer');
    expect(text).not.toContain('h1 heading wraps the page title');
  });

  it('withholds nothing once the fence is repaired', () => {
    const { text: repaired } = repairOrphanFences(report);
    const { text, dropped } = redactStudentQuestions(renumberQuestions(repaired));
    expect(dropped).toBe(0);
    expect(countQuestions(text)).toBe(3);
    expect(text).not.toContain('**Answer:**');
    expect(text).not.toContain('h1 heading wraps the page title');
  });

  it('does not trip on a marker quoted mid-line in student code', () => {
    const quoted = question({
      n: 1,
      code: "const MARKER = '<!-- gmc:answer -->';",
      stem: 'What is MARKER?',
      answer: 'the opening answer marker string',
      distractor: 'an empty string',
    });
    const { text, dropped } = redactStudentQuestions(quoted);
    expect(dropped).toBe(0);
    expect(text).toContain("const MARKER = '<!-- gmc:answer -->';");
  });
});
