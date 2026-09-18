import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { redactStudentQuestions, stripAnswers } from '../src/postprocess.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Builds a one-question report block in the shape the model emits. */
function report({ question, code, answer = 'true', distractor = 'false' }) {
  return [
    '**app.js**',
    '',
    `1. **${question}**`,
    '',
    '```js',
    code,
    '```',
    '',
    '<!-- gmc:answer -->',
    `**Answer:** ${answer}`,
    '<!-- /gmc:answer -->',
    '',
    '**Distractors for Multiple-Choice Quiz:**',
    `- ${distractor}`,
  ].join('\n');
}

describe('stripAnswers placeholder sentinels', () => {
  it('leaves a bare FENCE<n> token in question prose alone', () => {
    const out = stripAnswers(
      report({ question: 'What does the constant FENCE1 hold?', code: 'const FENCE1 = true;' }),
    );
    expect(out).toContain('What does the constant FENCE1 hold?');
    expect(out).not.toContain('undefined');
  });

  it('leaves a bare GMC_SEP token in question prose alone', () => {
    const out = stripAnswers(
      report({ question: 'What is GMC_SEP assigned?', code: "const GMC_SEP = '---';" }),
    );
    expect(out).toContain('What is GMC_SEP assigned?');
    expect(out).not.toMatch(/What is --- assigned/);
  });

  // The sentinel was previously U+E001 / U+E000, Private Use Area codepoints
  // that a student can paste into their source and the model can echo back.
  // Null bytes close that route: collectRawFiles drops any file containing one.
  it.each([
    ['U+E001 around FENCE', '\uE001FENCE7\uE001'],
    ['U+E000 around GMC_SEP', '\uE000GMC_SEP\uE000'],
  ])('is not hijacked by a student-supplied %s', (_label, token) => {
    const out = stripAnswers(
      report({ question: `What does ${token} hold?`, code: `const ${token} = true;` }),
    );
    expect(out).not.toContain('undefined');
    expect(out).toContain(token);
  });

  it('never emits a null byte', () => {
    const out = stripAnswers(
      report({ question: 'What does \0FENCE9\0 hold?', code: 'const x = 1;' }),
    );
    expect(out).not.toContain('\0');
  });

  it('restores protected code blocks unchanged', () => {
    const code = "const MARKER = '<!-- gmc:answer -->';";
    const out = stripAnswers(report({ question: 'What is MARKER?', code }));
    expect(out).toContain(code);
    expect(out).not.toContain('**Answer:**');
    expect(out).not.toContain('Distractors for Multiple-Choice Quiz');
  });

  it('leaves a --- separator outside an answer container intact', () => {
    const input = [
      '**a.js**',
      '',
      '1. **Q one?**',
      '',
      '<!-- gmc:answer -->',
      '**Answer:** yes',
      '<!-- /gmc:answer -->',
      '',
      '---',
      '',
      '**b.js**',
      '',
      '2. **Q two?**',
    ].join('\n');
    const out = stripAnswers(input);
    expect(out).toContain('---');
    expect(out).not.toContain('**Answer:**');
  });

  it('keeps the answer but drops distractors when keepAnswers is set', () => {
    const out = stripAnswers(report({ question: 'What is x?', code: 'const x = 1;' }), {
      keepAnswers: true,
    });
    expect(out).toContain('**Answer:** true');
    expect(out).not.toContain('Distractors for Multiple-Choice Quiz');
    expect(out).not.toContain('<!-- gmc:answer -->');
  });
});

describe('stripAnswers source hygiene', () => {
  // The sentinels are invisible in an editor, which is how the previous PUA
  // characters went unnoticed. Pin them so a future edit cannot reintroduce a
  // printable placeholder — or a different invisible one — unremarked.
  it('uses only null-byte sentinels in the source', () => {
    const src = readFileSync(join(__dirname, '..', 'src', 'postprocess.js'), 'utf-8');
    // No Private Use Area codepoint, and no literal control character either —
    // the sentinel must be spelled `\\0` in the source, where a reader can see it.
    // Scanned by code point rather than by regex: a character class holding
    // these would itself be an unreadable literal, which is the whole complaint.
    const invisible = [...src].filter((ch) => {
      const cp = ch.codePointAt(0);
      const isControl = cp < 0x20 && ch !== '\n' && ch !== '\t';
      const isPrivateUse = cp >= 0xe000 && cp <= 0xf8ff;
      return isControl || isPrivateUse;
    });
    expect(invisible).toEqual([]);
    for (const line of src.split('\n')) {
      if (!/FENCE|GMC_SEP/.test(line)) continue;
      expect(line).toMatch(/\\0/);
    }
  });
});

describe('redactStudentQuestions', () => {
  const ANSWER = 'it returns true when the coordinate has already been attacked by the player';
  const DISTRACTORS = [
    '**Distractors for Multiple-Choice Quiz:**',
    `- ${ANSWER} but only on even rows`,
  ].join('\n');

  /** A well-formed question block; `innerSep` places a --- inside its container. */
  function goodBlock({ n = 1, innerSep = false } = {}) {
    return [
      '**a.js**',
      '',
      `${n}. **What does the helper return?**`,
      '',
      '<!-- gmc:answer -->',
      '**Answer:**',
      `- ${ANSWER}`,
      '',
      DISTRACTORS,
      ...(innerSep ? ['', '---'] : []),
      '<!-- /gmc:answer -->',
    ].join('\n');
  }

  // A drifted block of exactly the shape the structural guard exists to catch:
  // the answer sits in a fenced block with no **Answer:** heading and no
  // container, and the leak guard strips fenced code before it looks.
  const driftedBlock = [
    '**b.js**',
    '',
    '2. **What does this return?**',
    '',
    '```text',
    ANSWER,
    '```',
  ].join('\n');

  const blockCount = (text) => text.split(/\n-{3,}\n/).length;

  it('leaves a report without inner separators untouched', () => {
    const original = `${goodBlock()}\n\n---\n\n${goodBlock()}`;
    expect(blockCount(stripAnswers(original))).toBe(blockCount(original));
  });

  it('keeps the rule between questions when a --- sits inside a container', () => {
    const original = `${goodBlock({ innerSep: true })}\n\n${goodBlock({ n: 2 })}`;
    const { text, dropped } = redactStudentQuestions(original);
    expect(dropped).toBe(0);
    expect(blockCount(text)).toBe(2);
    expect(text).not.toContain(ANSWER);
  });

  // The student view used to be aligned against the original by splitting both
  // on ---, and a stray --- inside a container misaligned them and switched the
  // structural guard off for the whole assessment. Each block is now checked on
  // its own, so an unrelated question's --- cannot decide this.
  it.each([
    ['no inner separator', false],
    ['a --- inside an unrelated container', true],
  ])('withholds a drifted question when the report has %s', (_label, innerSep) => {
    const original = `${goodBlock({ innerSep })}\n\n---\n\n${driftedBlock}`;
    const { text, structural } = redactStudentQuestions(original);
    expect(structural).toBe(1);
    expect(text).not.toContain(ANSWER);
    expect(text).toContain('1. **What does the helper return?**');
  });

  // With no separator between them, a drifted question shares a block with a
  // well-formed one, whose answer heading must not vouch for both.
  it('withholds a drifted question that shares a block with a good one', () => {
    const original = `${goodBlock()}\n\n${driftedBlock}`;
    const { text, structural } = redactStudentQuestions(original);
    expect(structural).toBe(2);
    expect(text).not.toContain(ANSWER);
  });

  it('withholds a question whose answer has no heading and no container', () => {
    const noLabel = [
      '**c.js**',
      '',
      '2. **What does this return?**',
      '',
      ANSWER,
      '',
      DISTRACTORS,
    ].join('\n');
    const { text, structural } = redactStudentQuestions(`${goodBlock()}\n\n---\n\n${noLabel}`);
    expect(structural).toBe(1);
    expect(text).not.toContain(ANSWER);
  });

  it('keeps the next question when a container is never closed', () => {
    const unclosed = goodBlock().replace('\n<!-- /gmc:answer -->', '');
    const { text, dropped } = redactStudentQuestions(
      `${unclosed}\n\n---\n\n${goodBlock({ n: 2 })}`,
    );
    expect(dropped).toBe(0);
    expect(text).toContain('2. **What does the helper return?**');
    expect(text).not.toContain(ANSWER);
  });

  // A --- inside fenced code is content, not a separator: splitting there tore
  // the fence, which put the snippet's list items within reach of the bullet
  // sweep and padded its --- with blank lines.
  it('leaves a snippet carrying its own --- intact', () => {
    const snippet = ['```yaml', 'first: 1', '---', '- item', '```'].join('\n');
    const original = goodBlock().replace('**a.js**\n', `**a.yml**\n\n${snippet}\n`);
    const { text, dropped } = redactStudentQuestions(original);
    expect(dropped).toBe(0);
    expect(text).toContain(snippet);
    expect(text).not.toContain(ANSWER);
  });

  it('withholds a question whose answer is echoed into the prose', () => {
    const echoed = goodBlock({ n: 2 }).replace(
      '**What does the helper return?**',
      `**What does the helper return? Hint: ${ANSWER}**`,
    );
    const { text, leak } = redactStudentQuestions(`${goodBlock()}\n\n---\n\n${echoed}`);
    expect(leak).toBe(1);
    expect(text).toContain('1. **What does the helper return?**');
    expect(text).not.toContain(ANSWER);
  });
});

describe('stripAnswers with keepAnswers trims the container by position', () => {
  const ANSWER = 'the coordinate has already been attacked';
  const DISTRACTORS = ['the row is out of bounds', 'the map is empty', 'the ship has sunk'];

  /** One question whose container interior is the given lines. */
  function block(inner, { n = 1 } = {}) {
    return [
      '**a.js**',
      '',
      '```js',
      'check(x);',
      '```',
      '',
      `${n}. **What does check return?**`,
      '',
      '   <!-- gmc:answer -->',
      ...inner,
      '   <!-- /gmc:answer -->',
    ].join('\n');
  }

  const canonical = [
    '   **Answer:**',
    `   - ${ANSWER}`,
    '',
    '   **Distractors for Multiple-Choice Quiz:**',
    ...DISTRACTORS.map((d) => `   - ${d}`),
  ];

  const expectAnswerOnly = (out) => {
    expect(out).toContain(`- ${ANSWER}`);
    for (const d of DISTRACTORS) expect(out).not.toContain(d);
    expect(out).not.toMatch(/distractor/i);
    expect(out).not.toContain('gmc:answer');
  };

  it('keeps the answer and drops the distractors in the canonical anatomy', () => {
    const out = stripAnswers(block(canonical), { keepAnswers: true });
    expectAnswerOnly(out);
    expect(out).toContain('**Answer:**');
  });

  // The literal heading match let every option through on drift like this,
  // which gemini-3.5-flash-lite has been seen to emit.
  it.each([
    ['comment-wrapped', '   <!-- Distractors for Multiple-Choice Quiz: -->'],
    ['shortened', '   **Distractors:**'],
    ['unhyphenated', '   **Distractors for Multiple Choice Quiz:**'],
    ['colon outside the bold', '   **Distractors for Multiple-Choice Quiz**:'],
    ['list-marker prefixed', '   - **Distractors for Multiple-Choice Quiz:**'],
  ])('drops the distractors under a %s heading', (_label, heading) => {
    const inner = canonical.map((line) => (/Distractors/.test(line) ? heading : line));
    expectAnswerOnly(stripAnswers(block(inner), { keepAnswers: true }));
  });

  it('drops the distractors when the heading is missing and the list is flat', () => {
    const inner = ['   **Answer:**', `   - ${ANSWER}`, ...DISTRACTORS.map((d) => `   - ${d}`)];
    expectAnswerOnly(stripAnswers(block(inner), { keepAnswers: true }));
  });

  it('drops the distractors under a heading that never says "distractor"', () => {
    const inner = canonical.map((line) =>
      /Distractors/.test(line) ? '   **Wrong options:**' : line,
    );
    expectAnswerOnly(stripAnswers(block(inner), { keepAnswers: true }));
  });

  // An inline answer is not a bullet, so without the blank-line stop the first
  // distractor bullet would be kept as though it were the answer.
  it('does not promote a distractor when the answer is inline', () => {
    const inner = [`   **Answer:** ${ANSWER}`, '', '   **Wrong options:**', ...canonical.slice(4)];
    const out = stripAnswers(block(inner), { keepAnswers: true });
    expect(out).toContain(`**Answer:** ${ANSWER}`);
    for (const d of DISTRACTORS) expect(out).not.toContain(d);
  });

  it('handles a closing marker trailing the final bullet', () => {
    const last = `   - ${DISTRACTORS.at(-1)}`;
    const input = block(canonical).replace(
      `${last}\n   <!-- /gmc:answer -->`,
      `${last} <!-- /gmc:answer -->`,
    );
    expect(input).toContain(`${DISTRACTORS.at(-1)} <!-- /gmc:answer -->`);
    expectAnswerOnly(stripAnswers(input, { keepAnswers: true }));
  });

  it('keeps an answer bullet that itself mentions distractors', () => {
    const answer = 'distractor bullets are removed before rendering';
    const inner = canonical.map((line) => line.replace(ANSWER, answer));
    const out = stripAnswers(block(inner), { keepAnswers: true });
    expect(out).toContain(`- ${answer}`);
    for (const d of DISTRACTORS) expect(out).not.toContain(d);
  });

  it('trims each container independently and keeps the separator between them', () => {
    const input = `${block(canonical)}\n\n---\n\n${block(canonical, { n: 2 })}`;
    const out = stripAnswers(input, { keepAnswers: true });
    expect(out.match(new RegExp(`- ${ANSWER}`, 'g'))).toHaveLength(2);
    expect(out.split(/\n-{3,}\n/)).toHaveLength(2);
    for (const d of DISTRACTORS) expect(out).not.toContain(d);
  });

  it('re-emits a --- placed inside the container', () => {
    const input = `${block([...canonical, '', '---'])}\n\n${block(canonical, { n: 2 })}`;
    const out = stripAnswers(input, { keepAnswers: true });
    expect(out.split(/\n-{3,}\n/)).toHaveLength(2);
    for (const d of DISTRACTORS) expect(out).not.toContain(d);
  });

  it('leaves a marker inside student code alone', () => {
    const code = "const MARKER = '<!-- gmc:answer -->';";
    const input = block(canonical).replace('check(x);', code);
    const out = stripAnswers(input, { keepAnswers: true });
    expect(out).toContain(code);
    expect(out).toContain(`- ${ANSWER}`);
    for (const d of DISTRACTORS) expect(out).not.toContain(d);
  });
});
