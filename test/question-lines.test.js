import { describe, expect, it } from 'vitest';
import {
  boldQuestionLines,
  countQuestions,
  renumberQuestions,
  splitBoldAroundCode,
  truncateToMaxQuestions,
} from '../src/postprocess.js';

const lines = (...ls) => ls.join('\n');

describe('boldQuestionLines', () => {
  it('bolds a top-level question stem', () => {
    expect(boldQuestionLines('1. What is x?')).toBe('1. **What is x?**');
  });

  it('leaves an already-bold stem alone', () => {
    expect(boldQuestionLines('1. **What is x?**')).toBe('1. **What is x?**');
  });

  it('does not touch numbered lines inside a fenced code block', () => {
    const input = lines('1. What is x?', '', '```text', '1. step one', '```');
    expect(boldQuestionLines(input)).toBe(
      lines('1. **What is x?**', '', '```text', '1. step one', '```'),
    );
  });

  it('does not touch numbered lines inside an answer region', () => {
    const input = lines(
      '1. What is x?',
      '<!-- gmc:answer -->',
      '**Answer:**',
      '1. the first item',
      '<!-- /gmc:answer -->',
    );
    expect(boldQuestionLines(input)).toBe(
      lines(
        '1. **What is x?**',
        '<!-- gmc:answer -->',
        '**Answer:**',
        '1. the first item',
        '<!-- /gmc:answer -->',
      ),
    );
  });

  it('resumes after an answer region closes', () => {
    const input = lines('<!-- gmc:answer -->', '1. item', '<!-- /gmc:answer -->', '2. Next?');
    expect(boldQuestionLines(input)).toBe(
      lines('<!-- gmc:answer -->', '1. item', '<!-- /gmc:answer -->', '2. **Next?**'),
    );
  });

  it('preserves CRLF line endings', () => {
    expect(boldQuestionLines('1. What is x?\r\n2. And y?\r\n')).toBe(
      '1. **What is x?**\r\n2. **And y?**\r\n',
    );
  });
});

describe('fence tracking', () => {
  it('treats ~~~ inside a ``` block as content, not a closing fence', () => {
    const input = lines('```', '~~~', '1. inside', '```', '2. After?');
    expect(boldQuestionLines(input)).toBe(lines('```', '~~~', '1. inside', '```', '2. **After?**'));
  });

  it('treats ``` inside a ```` block as content, not a closing fence', () => {
    const input = lines('````md', '```', '1. inside', '```', '````', '2. After?');
    expect(boldQuestionLines(input)).toBe(
      lines('````md', '```', '1. inside', '```', '````', '2. **After?**'),
    );
  });

  it('does not close a fence on a line with trailing text', () => {
    const input = lines('```', '``` not a closer', '1. inside', '```', '2. After?');
    expect(boldQuestionLines(input)).toBe(
      lines('```', '``` not a closer', '1. inside', '```', '2. **After?**'),
    );
  });

  it('recognises an indented fence', () => {
    const input = lines('1. Q?', '   ```js', '   2. inside', '   ```', '3. After?');
    expect(boldQuestionLines(input)).toBe(
      lines('1. **Q?**', '   ```js', '   2. inside', '   ```', '3. **After?**'),
    );
  });

  it('leaves everything after an unclosed fence alone', () => {
    const input = lines('1. Q?', '```js', '2. inside', '3. maybe a question');
    expect(boldQuestionLines(input)).toBe(
      lines('1. **Q?**', '```js', '2. inside', '3. maybe a question'),
    );
  });

  it('ignores answer markers inside a fence', () => {
    const input = lines('```js', "const M = '<!-- gmc:answer -->';", '```', '1. After?');
    expect(boldQuestionLines(input)).toBe(
      lines('```js', "const M = '<!-- gmc:answer -->';", '```', '1. **After?**'),
    );
  });
});

describe('answer marker tracking', () => {
  it('does not open an answer region on a marker quoted mid-line', () => {
    const input = lines('Note `<!-- gmc:answer -->` here', '1. Q?');
    expect(boldQuestionLines(input)).toBe(lines('Note `<!-- gmc:answer -->` here', '1. **Q?**'));
  });

  it('opens on a marker sharing a line with the answer heading', () => {
    const input = lines('<!-- gmc:answer --> **Answer:**', '1. item', '<!-- /gmc:answer -->');
    expect(boldQuestionLines(input)).toBe(input);
  });

  it('closes on a marker trailing the final bullet', () => {
    const input = lines('<!-- gmc:answer -->', '- false <!-- /gmc:answer -->', '2. Next?');
    expect(boldQuestionLines(input)).toBe(
      lines('<!-- gmc:answer -->', '- false <!-- /gmc:answer -->', '2. **Next?**'),
    );
  });

  it('handles an answer region opened and closed on one line', () => {
    const input = lines('<!-- gmc:answer --> **Answer:** x <!-- /gmc:answer -->', '2. Next?');
    expect(boldQuestionLines(input)).toBe(
      lines('<!-- gmc:answer --> **Answer:** x <!-- /gmc:answer -->', '2. **Next?**'),
    );
  });
});

describe('splitBoldAroundCode', () => {
  it('splits bold around inline code on a question stem', () => {
    expect(splitBoldAroundCode('1. **What does `x` return?**')).toBe(
      '1. **What does** `x` **return?**',
    );
  });

  it('does not touch a bold numbered line inside a fence', () => {
    const input = lines('```md', '1. **run `npm test`**', '```');
    expect(splitBoldAroundCode(input)).toBe(input);
  });

  it('does not touch a bold numbered line inside an answer region', () => {
    const input = lines('<!-- gmc:answer -->', '1. **use `x`**', '<!-- /gmc:answer -->');
    expect(splitBoldAroundCode(input)).toBe(input);
  });
});

describe('renumberQuestions', () => {
  it('renumbers top-level stems and skips fences and answer regions', () => {
    const input = lines(
      '1. A?',
      '```',
      '~~~',
      '9. code',
      '```',
      '<!-- gmc:answer -->',
      '7. item',
      '<!-- /gmc:answer -->',
      '1. B?',
    );
    expect(renumberQuestions(input)).toBe(
      lines(
        '1. A?',
        '```',
        '~~~',
        '9. code',
        '```',
        '<!-- gmc:answer -->',
        '7. item',
        '<!-- /gmc:answer -->',
        '2. B?',
      ),
    );
  });
});

describe('the reported reproduction', () => {
  it('bolds only the question stem', () => {
    const input = lines(
      '1. What is x?',
      '',
      '```text',
      '1. step one in the student data file',
      '```',
      '',
      '<!-- gmc:answer -->',
      '**Answer:**',
      '1. the first item',
      '<!-- /gmc:answer -->',
    );
    expect(splitBoldAroundCode(boldQuestionLines(input))).toBe(
      input.replace('1. What is x?', '1. **What is x?**'),
    );
  });
});

describe('truncateToMaxQuestions', () => {
  it('cuts at the first top-level stem past the limit', () => {
    expect(truncateToMaxQuestions(lines('1. A?', 'body', '', '2. B?', 'body'), 1)).toBe(
      lines('1. A?', 'body'),
    );
  });

  it('leaves text with no overflow untouched', () => {
    const input = lines('1. A?', '2. B?');
    expect(truncateToMaxQuestions(input, 2)).toBe(input);
  });

  it('does not cut on a numbered line inside a fenced code block', () => {
    const input = lines('1. A?', '```', '2. step', '```', 'more of A');
    expect(truncateToMaxQuestions(input, 1)).toBe(input);
  });

  it('does not cut on a numbered line inside an answer region', () => {
    const input = lines('1. A?', '<!-- gmc:answer -->', '2. item', '<!-- /gmc:answer -->');
    expect(truncateToMaxQuestions(input, 1)).toBe(input);
  });

  it('matches the exact number, not a longer one sharing its digits', () => {
    const input = lines('1. A?', '12. not question two');
    expect(truncateToMaxQuestions(input, 1)).toBe(input);
  });
});

describe('countQuestions', () => {
  it('counts only top-level stems', () => {
    const input = lines(
      '1. A?',
      '```',
      '1. code',
      '```',
      '<!-- gmc:answer -->',
      '1. item',
      '<!-- /gmc:answer -->',
      '2. B?',
    );
    expect(countQuestions(input)).toBe(2);
  });
});
