import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it, vi } from 'vitest';
import {
  answerKeyLocation,
  findAnswerKey,
  matchesReport,
  parseAnswerKey,
} from '../src/instructor/answer-key.js';
import { answerToHtml, instructorQuestionToHtml } from '../src/instructor/html.js';
import { GitHubError, listDirectCollaborators, readFile } from '../src/shared/github.js';
import { parseReport } from '../src/shared/report.js';

const CURRENT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'fixtures', 'current');

/** Every case in the current layout, with the answer key its run filed. */
const cases = readdirSync(CURRENT).map((name) => ({
  name,
  body: readFileSync(join(CURRENT, name, 'body.md'), 'utf-8'),
  expected: JSON.parse(readFileSync(join(CURRENT, name, 'expected.json'), 'utf-8')),
  key: readFileSync(join(CURRENT, name, 'questions.json'), 'utf-8'),
}));

const student = { assignment: 'cs-principles-lab-3', submitter: 'jsmith' };
const keyText = cases.find(({ name }) => name === 'default-branch').key;

describe('answerKeyLocation', () => {
  it("is the student's folder of the assignment's instructor repository", () => {
    expect(answerKeyLocation(student, { kind: 'branch', name: 'main' })).toEqual({
      repo: 'cs-principles-lab-3-grillmycode-instructor',
      path: 'jsmith/data/questions.json',
    });
    expect(answerKeyLocation(student, undefined).path).toBe('jsmith/data/questions.json');
  });

  it('is one folder down for a submission tag', () => {
    expect(answerKeyLocation(student, { kind: 'tag', name: 'submit/*' }).path).toBe(
      'jsmith/submit/data/questions.json',
    );
  });
});

describe('reading the fixtures', () => {
  it.each(cases)('$name: reads every question with its answer', ({ key, expected }) => {
    const questions = parseAnswerKey(key);
    // The issue's questions, as an extension reads them, are the key's.
    const asked = ({ number, broader, snippets, question }) => ({
      number,
      broader,
      snippets,
      question,
    });
    expect(questions.map(asked)).toEqual(expected.questions.map(asked));
    for (const question of questions) {
      expect(question.answer).toBeTruthy();
      expect(question.distractors).toHaveLength(3);
    }
  });

  it.each(cases)('$name: the key matches the issue of the same run', ({ key, body }) => {
    expect(matchesReport(parseReport(body).questions, parseAnswerKey(key))).toBe(true);
  });

  it('tells a key from the issue of another run', () => {
    const [first, , third] = cases;
    expect(matchesReport(parseReport(first.body).questions, parseAnswerKey(third.key))).toBe(false);
  });
});

describe('parseAnswerKey', () => {
  const entry = {
    number: 1,
    dropped: false,
    broader: false,
    snippets: [{ file: 'a.js', start_line: 1, end_line: 2, language: 'js', code: 'a();' }],
    question: 'Why?',
    answer: 'Because.',
    distractors: ['No.'],
  };
  const parse = (questions) => parseAnswerKey(JSON.stringify({ questions }));

  it('leaves out a question that was dropped, which the report never asked', () => {
    expect(parse([entry, { ...entry, number: null, dropped: true }])).toHaveLength(1);
  });

  it('leaves out what does not fit, and keeps the rest', () => {
    const [question] = parse([
      { ...entry, snippets: [{ file: 7 }, { file: 'a.js', start_line: '1', end_line: 2 }] },
      { ...entry, number: 'two' },
      { ...entry, number: 3, question: null },
      null,
    ]);
    expect(question.number).toBe(1);
    expect(question.snippets).toEqual([]);
  });

  it('reads a key written without distractors or an answer', () => {
    const [question] = parse([{ ...entry, answer: undefined, distractors: undefined }]);
    expect(question.answer).toBe('');
    expect(question.distractors).toEqual([]);
  });

  it('is undefined for anything that is not an answer key', () => {
    expect(parseAnswerKey('not JSON')).toBeUndefined();
    expect(parseAnswerKey('{"questions":"none"}')).toBeUndefined();
    expect(parseAnswerKey('null')).toBeUndefined();
    expect(parse([])).toBeUndefined();
  });
});

describe('matchesReport', () => {
  const key = parseAnswerKey(keyText);

  it('accepts a report that was cut short', () => {
    expect(matchesReport(key.slice(0, 2), key)).toBe(true);
  });

  it('refuses a question the key does not have, or has on other lines', () => {
    expect(matchesReport([{ ...key[0], number: 99 }], key)).toBe(false);
    const moved = { ...key[0], snippets: [{ ...key[0].snippets[0], start_line: 2 }] };
    expect(matchesReport([moved], key)).toBe(false);
  });
});

describe('findAnswerKey', () => {
  const request = { owner: 'my-school', repo: 'cs-principles-lab-3-jsmith', token: 'token' };
  const KEY_URL =
    'https://api.github.com/repos/my-school/cs-principles-lab-3-grillmycode-instructor' +
    '/contents/jsmith/data/questions.json';
  const COLLABORATORS_URL =
    'https://api.github.com/repos/my-school/cs-principles-lab-3-jsmith/collaborators' +
    '?affiliation=direct&per_page=100';

  /** A stand-in for GitHub that answers each address with a status and a body. */
  const github = (replies) =>
    vi.fn(async (url) => {
      const [status, body] = replies[url] ?? [404, ''];
      return {
        ok: status === 200,
        status,
        json: async () => body,
        text: async () => body,
      };
    });

  it('finds nothing for a student, with one request', async () => {
    const fetch = github({});
    const found = await findAnswerKey({ ...request, login: 'jsmith', fetch });
    expect(found.reason).toContain('404');
    expect(found.questions).toBeUndefined();
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([KEY_URL]);
  });

  it("finds an instructor's own key without listing collaborators", async () => {
    const fetch = github({ [KEY_URL]: [200, keyText] });
    const found = await findAnswerKey({ ...request, login: 'jsmith', fetch });
    expect(found.own).toBe(true);
    expect(found.questions).toHaveLength(5);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("finds the student of someone else's repository from its collaborators", async () => {
    const fetch = github({
      [COLLABORATORS_URL]: [200, [{ login: 'jsmith' }]],
      [KEY_URL]: [200, keyText],
    });
    const found = await findAnswerKey({ ...request, login: 'instructor', fetch });
    expect(found).toMatchObject({
      own: false,
      repo: 'cs-principles-lab-3-grillmycode-instructor',
      path: 'jsmith/data/questions.json',
    });
    expect(found.questions[0].answer).toBeTruthy();
  });

  it('reads the key of the submission tag whose questions are showing', async () => {
    const tagged = KEY_URL.replace('jsmith/data', 'jsmith/submit/data');
    const fetch = github({ [tagged]: [200, keyText] });
    const group = { kind: 'tag', name: 'submit/*' };
    const found = await findAnswerKey({ ...request, login: 'jsmith', group, fetch });
    expect(found.path).toBe('jsmith/submit/data/questions.json');
  });

  it('finds nothing when the collaborators cannot be listed', async () => {
    const fetch = github({ [COLLABORATORS_URL]: [403, ''], [KEY_URL]: [200, keyText] });
    const found = await findAnswerKey({ ...request, login: 'helper', fetch });
    expect(found.reason).toContain('403');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('finds nothing when no collaborator is the student', async () => {
    const fetch = github({ [COLLABORATORS_URL]: [200, [{ login: 'someone' }]] });
    const found = await findAnswerKey({ ...request, login: 'instructor', fetch });
    expect(found.reason).toContain('no direct collaborator');
  });

  it('finds nothing in a file that is not an answer key', async () => {
    const fetch = github({ [KEY_URL]: [200, '# Not JSON'] });
    const found = await findAnswerKey({ ...request, login: 'jsmith', fetch });
    expect(found.reason).toContain('is not an answer key');
  });

  it('finds nothing, and does not throw, when the request itself fails', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    expect(await findAnswerKey({ ...request, login: 'jsmith', fetch })).toEqual({
      reason: 'fetch failed',
    });
  });
});

describe('the requests', () => {
  const request = { owner: 'my-school', repo: 'cs-principles-lab-3-jsmith', token: 'token' };

  it('lists the logins of the direct collaborators', async () => {
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => [{ login: 'jsmith' }, { id: 4 }, null],
    }));
    expect(await listDirectCollaborators({ ...request, fetch })).toEqual(['jsmith']);
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer token');
  });

  it('asks for a file as it is, with each part of its path escaped', async () => {
    const fetch = vi.fn(async () => ({ ok: true, text: async () => 'content' }));
    expect(await readFile({ ...request, path: 'j smith/data/questions.json', fetch })).toBe(
      'content',
    );
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe(
      'https://api.github.com/repos/my-school/cs-principles-lab-3-jsmith' +
        '/contents/j%20smith/data/questions.json',
    );
    expect(options.headers.Accept).toBe('application/vnd.github.raw+json');
  });

  it('throws the status of a file that cannot be read', async () => {
    const fetch = vi.fn(async () => ({ ok: false, status: 404 }));
    const error = await readFile({ ...request, path: 'a.json', fetch }).catch((err) => err);
    expect(error).toBeInstanceOf(GitHubError);
    expect(error.status).toBe(404);
  });
});

describe('the instructor markup', () => {
  const question = {
    number: 2,
    broader: false,
    snippets: [],
    question: 'Why?',
    answer: 'Use `<b>` & stop.',
    distractors: ['<script>alert(1)</script>', 'A `second` one'],
  };

  it('adds the answer under the question', () => {
    const html = instructorQuestionToHtml(question);
    expect(html).toContain('<h2>Question 2</h2>');
    expect(html).toContain('<h3>Answer</h3>');
  });

  // Distractors are for the quiz. A spoken check has no use for them.
  it('leaves the distractors out', () => {
    const html = instructorQuestionToHtml(question);
    expect(html).not.toContain('Distractors');
    expect(html).not.toContain('second');
    expect(html).not.toContain('alert');
  });

  it('escapes the answer, which comes from a file on GitHub', () => {
    const html = answerToHtml({ ...question, answer: 'Use `<b>` & <script>stop</script>.' });
    expect(html).toContain('Use <code>&lt;b&gt;</code> &amp; &lt;script&gt;stop');
    expect(html).not.toContain('<script>');
  });

  it('leaves out the heading when there is no answer', () => {
    expect(answerToHtml({ ...question, answer: '' })).toBe('');
    expect(answerToHtml({ answer: 'Yes.' })).toBe('<h3>Answer</h3><p class="answer">Yes.</p>');
  });

  it('shows the prompt alone when no question is selected', () => {
    expect(instructorQuestionToHtml(undefined)).not.toContain('<h3>');
  });
});
