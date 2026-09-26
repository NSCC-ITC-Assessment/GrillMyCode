import { describe, expect, it } from 'vitest';
import { normaliseSeparators, redactStudentQuestions } from '../src/postprocess.js';

const ANSWER = 'it returns true when the coordinate has already been attacked by the player';

/** One well-formed question: header, snippet, stem and answer container. */
function question(n, file = `q${n}.js`, { snippet = 'check(x);' } = {}) {
  return [
    `**\`${file}\`**`,
    '',
    '```js',
    snippet,
    '```',
    '',
    `${n}. **What does check return?**`,
    '',
    '   <!-- gmc:answer -->',
    '   **Answer:**',
    `   - ${ANSWER}`,
    '',
    '   **Distractors for Multiple-Choice Quiz:**',
    '   - it throws',
    '   - it returns false',
    '   - it returns null',
    '   <!-- /gmc:answer -->',
  ].join('\n');
}

const separators = (text) => text.split('\n').filter((line) => line === '---').length;

describe('normaliseSeparators', () => {
  it('restores a separator the model left out between two questions', () => {
    const out = normaliseSeparators(`${question(1)}\n\n${question(2)}`);
    expect(out).toBe(`${question(1)}\n\n---\n\n${question(2)}`);
  });

  it('leaves well-formed output byte-identical', () => {
    const input = `${question(1)}\n\n---\n\n${question(2)}\n\n---\n\n${question(3)}\n\n---`;
    expect(normaliseSeparators(input)).toBe(input);
  });

  // Two headers ahead of one stem are one question showing two files; cutting
  // between them would strip the first file's snippet from its question.
  it('keeps a question that shows two files whole', () => {
    const twoFiles = question(2).replace(
      '**`q2.js`**',
      '**`helper.js`**\n\n```js\nhelper();\n```\n\n**`q2.js`**',
    );
    const input = `${question(1)}\n\n---\n\n${twoFiles}`;
    expect(normaliseSeparators(input)).toBe(input);
  });

  it('still separates a two-file question from the question before it', () => {
    const twoFiles = question(2).replace(
      '**`q2.js`**',
      '**`helper.js`**\n\n```js\nhelper();\n```\n\n**`q2.js`**',
    );
    const out = normaliseSeparators(`${question(1)}\n\n${twoFiles}`);
    expect(separators(out)).toBe(1);
    expect(out).toContain('---\n\n**`helper.js`**');
  });

  it('does not separate text ahead of the first question from it', () => {
    const input = `Here are your questions.\n\n${question(1)}`;
    expect(normaliseSeparators(input)).toBe(input);
  });

  // A bold filename inside a Markdown snippet is snippet content, even when the
  // snippet follows a stem.
  it('leaves a bold filename inside fenced code alone', () => {
    const input = question(1).replace(
      '   <!-- gmc:answer -->',
      '```md\n**notes.md**\n```\n\n   <!-- gmc:answer -->',
    );
    expect(normaliseSeparators(input)).toBe(input);
  });

  it('leaves a bold filename inside an answer container alone', () => {
    const input = question(1).replace('   **Answer:**', '**utils.js**\n   **Answer:**');
    expect(normaliseSeparators(input)).toBe(input);
  });

  // Both downstream splits cut on a --- inside the container, so adding another
  // after it would leave an empty block and a doubled rule.
  it('does not double a separator the model placed inside the container', () => {
    const input = `${question(1).replace('   <!-- /gmc:answer -->', '---\n   <!-- /gmc:answer -->')}\n\n${question(2)}`;
    expect(normaliseSeparators(input)).toBe(input);
  });

  it('ignores a --- inside fenced code when deciding', () => {
    const yaml = question(1, 'a.yml', { snippet: 'a: 1\n---\nb: 2' });
    const out = normaliseSeparators(`${yaml}\n\n${question(2)}`);
    expect(out).toContain('a: 1\n---\nb: 2');
    expect(out).toContain('<!-- /gmc:answer -->\n\n---\n\n**`q2.js`**');
  });

  it.each([
    ['a longer run of dashes', '----'],
    ['trailing whitespace', '--- '],
    ['indentation', '  ---'],
  ])('rewrites a separator spelled with %s to exactly ---', (_label, variant) => {
    const out = normaliseSeparators(`${question(1)}\n\n${variant}\n\n${question(2)}`);
    expect(out).toBe(`${question(1)}\n\n---\n\n${question(2)}`);
  });

  // The quiz parser does not split on an indented --- today, so the question
  // parses; rewriting it would tear the container and withhold the question.
  it('leaves an indented --- inside an answer container as it is', () => {
    const input = question(1).replace('\n\n   **Distractors', '\n\n   ---\n\n   **Distractors');
    expect(normaliseSeparators(input)).toBe(input);
  });

  // A question with no header or snippet — typical under a Broader Questions
  // heading — has only its stem to show where it starts.
  const bare = (n) => question(n).split('\n').slice(6).join('\n');

  it('restores a separator before a question with no header or snippet', () => {
    const out = normaliseSeparators(`${question(1)}\n\n${bare(2)}`);
    expect(out).toBe(`${question(1)}\n\n---\n\n${bare(2)}`);
  });

  it.each(['## Broader Questions', '**## Broader Questions**'])(
    'moves a %j heading below the restored separator',
    (heading) => {
      const out = normaliseSeparators(`${question(1)}\n\n${heading}\n\n${bare(2)}`);
      expect(out).toBe(`${question(1)}\n\n---\n\n${heading}\n\n${bare(2)}`);
    },
  );

  it('moves a heading above a filename header below the restored separator', () => {
    const out = normaliseSeparators(`${question(1)}\n\n## Broader Questions\n\n${question(2)}`);
    expect(out).toBe(`${question(1)}\n\n---\n\n## Broader Questions\n\n${question(2)}`);
  });

  it('leaves a heading after a separator where it is', () => {
    const input = `${question(1)}\n\n---\n\n## Broader Questions\n\n${bare(2)}`;
    expect(normaliseSeparators(input)).toBe(input);
  });

  // Without a closed container nothing marks where the question before ended,
  // and a numbered line could still belong to it.
  it('does not split on a stem when no answer container has closed', () => {
    const input = `${bare(1).replace(/ *<!-- \/?gmc:answer -->\n?/g, '')}\n\n${bare(2)}`;
    expect(normaliseSeparators(input)).toBe(input);
  });

  // The reason this runs before the student view is cut: with the separator
  // restored, a drifted question sits in a block of its own and is withheld
  // alone, rather than taking its well-formed neighbour down with it.
  it('lets redaction withhold a drifted question without its neighbour', () => {
    const drifted = [
      '**`b.js`**',
      '',
      '2. **What does this return?**',
      '',
      '```text',
      ANSWER,
      '```',
    ].join('\n');
    const { text, structural } = redactStudentQuestions(
      normaliseSeparators(`${question(1)}\n\n${drifted}`),
    );
    expect(structural).toBe(1);
    expect(text).toContain('1. **What does check return?**');
    expect(text).not.toContain(ANSWER);
  });
});
