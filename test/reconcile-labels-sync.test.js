import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Buffer } from 'node:buffer';
import { deliverToInstructorRepo } from '../src/delivery/instructor-repo.js';
import {
  REPO_LABEL_DESCRIPTION_SEPARATOR,
  REPO_LABEL_DESCRIPTION_SIGIL,
  REPO_LABEL_TOPIC,
  INSTRUCTOR_REPO_SUFFIX,
  GITHUB_API_VERSION,
  REPO_LABEL_SWEEP_IDLE_DAYS,
} from '../src/constants.js';

vi.mock('@actions/core', () => ({ info: vi.fn(), warning: vi.fn(), error: vi.fn() }));

const RECONCILE_PATH = '.github/workflows/reconcile-repo-labels.yml';
const WORKFLOW_SOURCE = readFileSync(
  join(import.meta.dirname, '../src/workflows/reconcile-repo-labels.yml'),
  'utf-8',
);

/**
 * The reconciliation workflow runs inside the instructor repository, so it
 * cannot import the action's constants — it carries its own copies. These
 * assertions are what keeps the two in step: change a value in constants.js
 * without updating the workflow and this fails, rather than the change quietly
 * orphaning every label written by an earlier release.
 */
describe('shipped workflow matches the action constants', () => {
  it('carries the current topic, separator and sigil', () => {
    expect(WORKFLOW_SOURCE).toContain(`const LABEL_TOPIC = '${REPO_LABEL_TOPIC}';`);
    expect(WORKFLOW_SOURCE).toContain(
      `const DESCRIPTION_SEPARATOR = '${REPO_LABEL_DESCRIPTION_SEPARATOR}';`,
    );
    expect(WORKFLOW_SOURCE).toContain(
      `const DESCRIPTION_SIGIL = '${REPO_LABEL_DESCRIPTION_SIGIL}';`,
    );
  });

  it('carries the current instructor repository suffix and API version', () => {
    expect(WORKFLOW_SOURCE).toContain(`const INSTRUCTOR_SUFFIX = '${INSTRUCTOR_REPO_SUFFIX}';`);
    expect(WORKFLOW_SOURCE).toContain(`'X-GitHub-Api-Version': '${GITHUB_API_VERSION}'`);
  });

  it('carries the current idle stand-down threshold', () => {
    expect(WORKFLOW_SOURCE).toContain(`const SWEEP_IDLE_DAYS = ${REPO_LABEL_SWEEP_IDLE_DAYS};`);
  });

  it('keys on the same issue label the action applies to assessment issues', () => {
    expect(WORKFLOW_SOURCE).toContain("const ASSESSMENT_LABEL = 'assessment';");
  });
});

/** An instructor-repository octokit stub whose existing files can be seeded. */
function fakeOctokit({ existing = {} } = {}) {
  const writes = [];
  return {
    writes,
    rest: {
      repos: {
        get: vi.fn(async () => ({ data: { default_branch: 'main' } })),
        getContent: vi.fn(async ({ path }) => {
          if (!(path in existing)) {
            const err = new Error('Not Found');
            err.status = 404;
            throw err;
          }
          return {
            data: {
              sha: 'seeded-sha',
              encoding: 'base64',
              content: Buffer.from(existing[path], 'utf-8').toString('base64'),
            },
          };
        }),
        createOrUpdateFileContents: vi.fn(async ({ path, message, content }) => {
          writes.push({ path, message, content: Buffer.from(content, 'base64').toString('utf-8') });
          return { data: {} };
        }),
      },
    },
  };
}

function deliver(octokit, labelRepos) {
  return deliverToInstructorRepo({
    octokit,
    owner: 'org',
    instructorRepoName: `assignment${INSTRUCTOR_REPO_SUFFIX}`,
    studentLogin: 'student',
    content: '## GrillMyCode\n\n1. Question?',
    headSha: 'abcdef1234567890',
    labelRepos,
  });
}

const written = (octokit, path) => octokit.writes.find((w) => w.path === path);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reconciliation workflow sync', () => {
  it('is not seeded for an assignment with label_repos off', async () => {
    // Otherwise the instructor repository would acquire a scheduled job that
    // writes to student repositories, for an assignment that turned labels off.
    const octokit = fakeOctokit();
    await deliver(octokit, false);
    expect(written(octokit, RECONCILE_PATH)).toBeUndefined();
  });

  it('is seeded with the switch rendered in when label_repos is on', async () => {
    const octokit = fakeOctokit();
    await deliver(octokit, true);

    const file = written(octokit, RECONCILE_PATH);
    expect(file).toBeDefined();
    expect(file.content).toContain('LABELS_ENABLED: "true"');
    expect(file.content).not.toContain('{{LABELS_ENABLED}}');
  });

  it('disarms an existing sweep in place when label_repos is turned off', async () => {
    // Leaving it enabled would keep a scheduled job reconciling labels that
    // nothing writes any more.
    const octokit = fakeOctokit({
      existing: { [RECONCILE_PATH]: WORKFLOW_SOURCE.replace(/\{\{LABELS_ENABLED\}\}/g, 'true') },
    });
    await deliver(octokit, false);

    const file = written(octokit, RECONCILE_PATH);
    expect(file).toBeDefined();
    expect(file.content).toContain('LABELS_ENABLED: "false"');
  });

  it('leaves the assessment write unaffected', async () => {
    const octokit = fakeOctokit();
    await deliver(octokit, true);
    expect(written(octokit, 'student/questions.md')).toBeDefined();
  });

  it('is not seeded when the caller passes no label_repos at all', async () => {
    const octokit = fakeOctokit();
    await deliverToInstructorRepo({
      octokit,
      owner: 'org',
      instructorRepoName: `assignment${INSTRUCTOR_REPO_SUFFIX}`,
      studentLogin: 'student',
      content: '## GrillMyCode\n\n1. Question?',
      headSha: 'abcdef1234567890',
    });
    expect(written(octokit, RECONCILE_PATH)).toBeUndefined();
  });
});
