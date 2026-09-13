import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { stripAnswers } from '../src/main.js';

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
    const src = readFileSync(join(__dirname, '..', 'src', 'main.js'), 'utf-8');
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
