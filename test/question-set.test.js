import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QUESTIONS_COMMENT_OPEN, formatReport, questionsComment } from '../src/report.js';
import { questionSetSlug } from '../src/context.js';
import { assessmentFolder, deliverToInstructorRepo } from '../src/delivery/instructor-repo.js';
import { postIssue } from '../src/delivery/issue.js';
import { readInputs } from '../src/inputs.js';

vi.mock('@actions/core', async (importOriginal) => ({
  ...(await importOriginal()),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

const HEAD_SHA = '9b8e7d6c5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c';
const LAB_3 = { name: 'Lab 3', slug: 'lab-3' };

describe('questionSetSlug', () => {
  it('lowers the case and makes each run of other characters one -', () => {
    expect(questionSetSlug('Lab 3')).toBe('lab-3');
    expect(questionSetSlug('lab-3')).toBe('lab-3');
    expect(questionSetSlug('Lab 3: the  sequel!')).toBe('lab-3-the-sequel');
    expect(questionSetSlug('.github/workflows/quiz.yml')).toBe('github-workflows-quiz-yml');
  });

  it('is no set for an empty value or the default workflow name', () => {
    expect(questionSetSlug('')).toBe('');
    expect(questionSetSlug('GrillMyCode')).toBe('');
    expect(questionSetSlug('grillmycode')).toBe('');
    // Spaced out, it is a set of its own: only the default name is exempt.
    expect(questionSetSlug('Grill My Code')).toBe('grill-my-code');
    expect(questionSetSlug('GrillMyCode phase 2')).toBe('grillmycode-phase-2');
  });

  it('is null for a value with nothing filename-safe in it', () => {
    expect(questionSetSlug('!!!')).toBeNull();
    expect(questionSetSlug('🧪')).toBeNull();
  });
});

describe('question_set input', () => {
  const KEYS = ['INPUT_GITHUB_TOKEN', 'INPUT_API_KEY', 'INPUT_QUESTION_SET'];
  const saved = {};

  beforeEach(() => {
    for (const key of KEYS) saved[key] = process.env[key];
    process.env.INPUT_GITHUB_TOKEN = 'token';
    process.env.INPUT_API_KEY = 'key';
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  const questionSet = (value) => {
    if (value === undefined) delete process.env.INPUT_QUESTION_SET;
    else process.env.INPUT_QUESTION_SET = value;
    return readInputs().questionSet;
  };

  it('is no set when it is not given, or names the default workflow', () => {
    expect(questionSet(undefined)).toEqual({ name: '', slug: '' });
    expect(questionSet('  ')).toEqual({ name: '', slug: '' });
    expect(questionSet('GrillMyCode')).toEqual({ name: '', slug: '' });
  });

  it('keeps the name as written, its white space made single spaces', () => {
    expect(questionSet('  Lab 3 ')).toEqual(LAB_3);
    expect(questionSet('Lab\n 3')).toEqual(LAB_3);
  });

  it('fails a value with no letter, digit, - or _', () => {
    expect(() => questionSet('!!!')).toThrow(/question_set "!!!" has no letter, digit/);
  });

  it('fails a value over the limit', () => {
    expect(questionSet('x'.repeat(100)).slug).toHaveLength(100);
    expect(() => questionSet('x'.repeat(101))).toThrow(/at most 100/);
  });
});

describe('a question set in the instructor repository', () => {
  it('files the assessment under set.<slug>/, tag groups inside it', () => {
    expect(assessmentFolder('jsmith')).toBe('jsmith');
    expect(assessmentFolder('jsmith', 'phase1')).toBe('jsmith/phase1');
    expect(assessmentFolder('jsmith', '', 'lab-3')).toBe('jsmith/set.lab-3');
    expect(assessmentFolder('jsmith', 'phase1', 'lab-3')).toBe('jsmith/set.lab-3/phase1');
  });

  it('writes every file there', async () => {
    const writes = [];
    const octokit = {
      rest: {
        repos: {
          get: vi.fn(async () => ({ data: { default_branch: 'main' } })),
          getContent: vi.fn(async () => {
            throw Object.assign(new Error('Not Found'), { status: 404 });
          }),
          createOrUpdateFileContents: vi.fn(async ({ path, message }) => {
            writes.push({ path, message });
            return { data: {} };
          }),
        },
      },
    };
    await deliverToInstructorRepo({
      octokit,
      owner: 'my-school',
      instructorRepoName: 'lab-3-grillmycode-instructor',
      studentLogin: 'jsmith',
      questionSet: 'lab-3',
      content: '## GrillMyCode\n\n1. Question?',
      questions: [],
      headSha: 'abcdef1234567890',
      rawOutput: 'raw',
    });
    const student = writes.filter(({ path }) => path.startsWith('jsmith/'));
    expect(student.map(({ path }) => path)).toEqual([
      'jsmith/set.lab-3/data/raw-ai-output.md',
      'jsmith/set.lab-3/questions.md',
      'jsmith/set.lab-3/data/questions.json',
    ]);
    expect(student[1].message).toBe('chore: update assessment for jsmith (set lab-3) at abcdef1');
  });
});

describe('a question set in the issue', () => {
  /** The title postIssue gives a new issue, in a repository with none. */
  async function title(options) {
    const create = vi.fn(async () => ({
      data: { number: 9, html_url: 'https://example.test/9', node_id: 'I_9' },
    }));
    await postIssue({
      octokit: {
        graphql: vi.fn(async () => ({ pinIssue: { issue: { title: 'x' } } })),
        rest: {
          issues: {
            listForRepo: vi.fn(async () => ({ data: [] })),
            createComment: vi.fn(async () => ({})),
            create,
          },
        },
      },
      ctx: { repo: { owner: 'my-school', repo: 'cs-principles-lab-3-jsmith' } },
      report: '1. Question?',
      headSha: 'abcdef1234567890',
      studentLogin: 'jsmith',
      ...options,
    });
    return create.mock.calls[0][0].title;
  }

  it('goes in the title after a colon, before the group', async () => {
    expect(await title({ branchName: 'main' })).toBe('GrillMyCode Questions (main)');
    expect(await title({ branchName: 'main', questionSetName: 'Lab 3' })).toBe(
      'GrillMyCode Questions: Lab 3 (main)',
    );
    expect(
      await title({ branchName: 'main', tagPattern: 'phase1', questionSetName: 'Lab 3' }),
    ).toBe('GrillMyCode Questions: Lab 3 (tag: phase1)');
  });

  it('is in the hidden data only when there is one', () => {
    const read = (comment) => JSON.parse(comment.slice(QUESTIONS_COMMENT_OPEN.length, -4));
    expect(read(questionsComment({ headSha: HEAD_SHA, questions: [] }))).not.toHaveProperty('set');
    expect(
      read(questionsComment({ headSha: HEAD_SHA, questionSet: 'lab-3', questions: [] })),
    ).toEqual(expect.objectContaining({ headSha: HEAD_SHA, set: 'lab-3' }));
  });

  it('is named in the report, which is unchanged without one', () => {
    const report = (questionSet) =>
      formatReport({
        questions: '**Question 1:**',
        files: ['src/cart.js'],
        baseSha: '4f1c9a2b7d3e5f60718293a4b5c6d7e8f9012345',
        headSha: HEAD_SHA,
        provider: 'openrouter',
        model: 'a-model',
        issueQuestions: [],
        questionSet,
      });
    const withSet = report({ name: 'Lab `3`', slug: 'lab-3' });
    expect(withSet).toContain("> **Question set:** `Lab '3'`\n");
    expect(withSet).toContain('"set":"lab-3"');
    const strip = (text) => text.replace(/> \*\*Generated:\*\*.*/, '');
    expect(
      strip(withSet.replace("> **Question set:** `Lab '3'`\n\n", '')).replace(',"set":"lab-3"', ''),
    ).toBe(strip(report(undefined)));
  });
});
