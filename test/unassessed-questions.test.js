import { describe, expect, it } from 'vitest';
import { countQuestions, dropQuestionsOnUnassessedFiles } from '../src/postprocess.js';

/** One question block in the shape the model emits. */
function question(n, header, stem = 'What does this do?') {
  return [
    `**${header}**`,
    '',
    `${n}. **${stem}**`,
    '',
    '```',
    'code',
    '```',
    '',
    '<!-- gmc:answer -->',
    '**Answer:** it works',
    '<!-- /gmc:answer -->',
  ].join('\n');
}

const report = (...blocks) => blocks.join('\n\n---\n\n');

describe('dropQuestionsOnUnassessedFiles', () => {
  const files = ['src/app.py', 'src/models/User.java'];

  it('keeps a report whose questions all name assessed files unchanged', () => {
    const text = report(question(1, 'src/app.py'), question(2, '`User.java`'));
    expect(dropQuestionsOnUnassessedFiles(text, files)).toEqual({
      text,
      dropped: 0,
      unassessed: [],
      failedOpen: false,
    });
  });

  it('drops a question about an unassessed file and renumbers the rest', () => {
    const text = report(
      question(1, 'app.py'),
      question(2, 'README.md', 'What does the brief ask for?'),
      question(3, 'User.java'),
    );
    const out = dropQuestionsOnUnassessedFiles(text, files);
    expect(out.dropped).toBe(1);
    expect(out.unassessed).toEqual(['README.md']);
    expect(out.text).not.toContain('What does the brief ask for?');
    expect(countQuestions(out.text)).toBe(2);
    expect(out.text).toMatch(/^2\. /m);
    expect(out.text).not.toMatch(/^3\. /m);
  });

  it('matches headers case-insensitively and ignores a trailing line number', () => {
    const text = report(question(1, 'user.java:12-30'), question(2, './src/APP.py'));
    expect(dropQuestionsOnUnassessedFiles(text, files).dropped).toBe(0);
  });

  it('does not match a header that is only a suffix of a file name', () => {
    const text = report(question(1, 'app.py'), question(2, 'pp.py'));
    expect(dropQuestionsOnUnassessedFiles(text, files).dropped).toBe(1);
  });

  it('drops a multi-file question when any of its files is unassessed', () => {
    const multi = ['**app.py**', '', '```', 'a', '```', '', question(2, 'diagram.drawio')].join(
      '\n',
    );
    const text = report(question(1, 'User.java'), multi);
    const out = dropQuestionsOnUnassessedFiles(text, files);
    expect(out.dropped).toBe(1);
    expect(out.unassessed).toEqual(['diagram.drawio']);
  });

  it('ignores bold file names inside code blocks and answers', () => {
    const block = question(1, 'app.py').replace(
      '**Answer:** it works',
      '**Answer:** it reads **config.yaml**\n\n**config.yaml**',
    );
    expect(
      dropQuestionsOnUnassessedFiles(report(block, question(2, 'app.py')), files).dropped,
    ).toBe(0);
  });

  it('keeps a question with no filename header', () => {
    const text = report(question(1, 'app.py'), '2. **A question with no header?**');
    expect(dropQuestionsOnUnassessedFiles(text, files).dropped).toBe(0);
  });

  it('fails open when every question would be dropped', () => {
    const text = report(question(1, 'other.py'), question(2, 'more.py'));
    expect(dropQuestionsOnUnassessedFiles(text, files)).toEqual({
      text,
      dropped: 0,
      unassessed: ['other.py', 'more.py'],
      failedOpen: true,
    });
  });
});
