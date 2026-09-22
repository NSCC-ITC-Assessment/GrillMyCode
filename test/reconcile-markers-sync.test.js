import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Buffer } from 'node:buffer';
import { deliverToInstructorRepo } from '../src/delivery/instructor-repo.js';
import {
  REPO_MARKER_DESCRIPTION_SEPARATOR,
  REPO_MARKER_DESCRIPTION_SIGIL,
  REPO_MARKER_TOPIC,
  INSTRUCTOR_REPO_SUFFIX,
  GITHUB_API_VERSION,
} from '../src/constants.js';

vi.mock('@actions/core', () => ({ info: vi.fn(), warning: vi.fn(), error: vi.fn() }));

const RECONCILE_PATH = '.github/workflows/reconcile-repo-markers.yml';
const WORKFLOW_SOURCE = readFileSync(
  join(import.meta.dirname, '../src/workflows/reconcile-repo-markers.yml'),
  'utf-8',
);

/**
 * The reconciliation workflow runs inside the instructor repository, so it
 * cannot import the action's constants — it carries its own copies. These
 * assertions are what keeps the two in step: change a value in constants.js
 * without updating the workflow and this fails, rather than the change quietly
 * orphaning every marker written by an earlier release.
 */
describe('shipped workflow matches the action constants', () => {
  it('carries the current topic, separator and sigil', () => {
    expect(WORKFLOW_SOURCE).toContain(`const MARKER_TOPIC = '${REPO_MARKER_TOPIC}';`);
    expect(WORKFLOW_SOURCE).toContain(
      `const DESCRIPTION_SEPARATOR = '${REPO_MARKER_DESCRIPTION_SEPARATOR}';`,
    );
    expect(WORKFLOW_SOURCE).toContain(
      `const DESCRIPTION_SIGIL = '${REPO_MARKER_DESCRIPTION_SIGIL}';`,
    );
  });

  it('carries the current instructor repository suffix and API version', () => {
    expect(WORKFLOW_SOURCE).toContain(`const INSTRUCTOR_SUFFIX = '${INSTRUCTOR_REPO_SUFFIX}';`);
    expect(WORKFLOW_SOURCE).toContain(`'X-GitHub-Api-Version': '${GITHUB_API_VERSION}'`);
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

function deliver(octokit, repoMarker) {
  return deliverToInstructorRepo({
    octokit,
    owner: 'org',
    instructorRepoName: `assignment${INSTRUCTOR_REPO_SUFFIX}`,
    studentLogin: 'student',
    content: '## GrillMyCode\n\n1. Question?',
    headSha: 'abcdef1234567890',
    repoMarker,
  });
}

const written = (octokit, path) => octokit.writes.find((w) => w.path === path);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reconciliation workflow sync', () => {
  it('is not seeded for an assignment that does not use repo_marker', async () => {
    // Otherwise every instructor repository would acquire a scheduled job that
    // writes to student repositories, including for instructors who never
    // asked for a marker.
    const octokit = fakeOctokit();
    await deliver(octokit, 'off');
    expect(written(octokit, RECONCILE_PATH)).toBeUndefined();
  });

  it('is seeded with the mode rendered in when repo_marker is on', async () => {
    const octokit = fakeOctokit();
    await deliver(octokit, 'both');

    const file = written(octokit, RECONCILE_PATH);
    expect(file).toBeDefined();
    expect(file.content).toContain('MARKER_MODE: "both"');
    expect(file.content).not.toContain('{{MARKER_MODE}}');
  });

  it('renders each mode it is given', async () => {
    for (const mode of ['topic', 'description', 'both']) {
      const octokit = fakeOctokit();
      await deliver(octokit, mode);
      expect(written(octokit, RECONCILE_PATH).content).toContain(`MARKER_MODE: "${mode}"`);
    }
  });

  it('disarms an existing sweep in place when repo_marker is turned off', async () => {
    // Leaving the previous mode behind would keep a scheduled job reconciling
    // markers that nothing writes any more.
    const octokit = fakeOctokit({
      existing: { [RECONCILE_PATH]: WORKFLOW_SOURCE.replace(/\{\{MARKER_MODE\}\}/g, 'both') },
    });
    await deliver(octokit, 'off');

    const file = written(octokit, RECONCILE_PATH);
    expect(file).toBeDefined();
    expect(file.content).toContain('MARKER_MODE: "off"');
  });

  it('leaves the assessment write unaffected whatever the mode', async () => {
    const octokit = fakeOctokit();
    await deliver(octokit, 'both');
    expect(written(octokit, 'student/questions.md')).toBeDefined();
  });

  it('defaults to off when no mode is passed at all', async () => {
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
