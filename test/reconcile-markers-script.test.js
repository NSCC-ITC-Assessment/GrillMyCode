import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { createRequire } from 'node:module';
import { Buffer } from 'node:buffer';
import {
  REPO_MARKER_DESCRIPTION_SEPARATOR,
  REPO_MARKER_DESCRIPTION_SIGIL,
  REPO_MARKER_SWEEP_IDLE_DAYS,
} from '../src/constants.js';

/**
 * The reconciliation sweep is a Node script embedded in the workflow YAML that
 * is seeded into each instructor repository, so it cannot be imported — the
 * same situation as the quiz generator (see quiz-option-text.test.js). Here the
 * whole script is lifted out of the heredoc and run in a VM against a fake
 * GitHub API, because what matters is not any one helper but which writes it
 * decides to make: this is the only thing standing between a logic slip and a
 * scheduled job that strips topics off a live cohort.
 *
 * An extraction failure throws rather than silently testing nothing.
 */
const WORKFLOW = readFileSync(
  join(import.meta.dirname, '../src/workflows/reconcile-repo-markers.yml'),
  'utf8',
);

function extractScript() {
  const lines = WORKFLOW.split('\n');
  const start = lines.findIndex((l) => l.trim().startsWith('node <<'));
  const end = lines.findIndex((l) => l.trim() === 'JSEOF');
  if (start === -1 || end === -1) {
    throw new Error('the embedded script heredoc was not found in reconcile-repo-markers.yml');
  }
  return lines.slice(start + 1, end).join('\n');
}

const SCRIPT = extractScript();

const repo = (name, extra = {}) => ({
  name,
  topics: [],
  description: '',
  archived: false,
  ...extra,
});
const OPEN_ASSESSMENT = { number: 1, title: 'GrillMyCode Questions' };
const INSTRUCTOR_REPO = 'nscc/appd5000-lab3-grillmycode-instructor';

/**
 * Runs the extracted script with a stubbed fetch, returning every API call it
 * made and the job summary it wrote.
 */
async function runSweep({
  mode,
  dryRun = false,
  repos = [],
  issues = {},
  idleDays = 0,
  eventName = 'schedule',
}) {
  const calls = [];
  const reply = (data, status = 200) => ({
    ok: status < 400,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  });

  const fetchStub = async (url, options = {}) => {
    const method = options.method || 'GET';
    const path = String(url).replace('https://api.github.com', '');
    calls.push({ method, path, body: options.body ? JSON.parse(options.body) : undefined });

    if (path.startsWith('/orgs/') && path.includes('/repos?')) {
      return reply(path.includes('page=1') ? repos : []);
    }
    // The instructor repository's own metadata, read for the idle check.
    if (method === 'GET' && path === `/repos/${INSTRUCTOR_REPO}`) {
      return reply({ pushed_at: new Date(Date.now() - idleDays * 86400000).toISOString() });
    }
    const issueMatch = path.match(/^\/repos\/[^/]+\/([^/?]+)\/issues\?/);
    if (issueMatch) return reply(issues[issueMatch[1]] || []);
    if (method === 'PUT' && path.endsWith('/topics')) {
      return reply({ names: JSON.parse(options.body).names });
    }
    if (method === 'PATCH' && /^\/repos\/[^/]+\/[^/?]+$/.test(path)) return reply({});
    return reply({ message: 'Not Found' }, 404);
  };

  const summaryChunks = [];
  const require = createRequire(import.meta.url);
  const context = {
    fetch: fetchStub,
    Buffer,
    setTimeout,
    console: { log: () => {}, error: () => {} },
    process: {
      env: {
        GMC_TOKEN: 'test-token',
        MARKER_MODE: mode,
        DRY_RUN: String(dryRun),
        GITHUB_REPOSITORY: `nscc/${INSTRUCTOR_REPO.split('/')[1]}`,
        GITHUB_EVENT_NAME: eventName,
        GITHUB_STEP_SUMMARY: '/dev/null',
      },
      exit: (code) => {
        throw new Error(`script exited with ${code}`);
      },
    },
    // The script appends its summary through fs; capture it instead of writing.
    require: (name) =>
      name === 'fs' ? { appendFileSync: (_p, body) => summaryChunks.push(body) } : require(name),
  };
  context.globalThis = context;
  createContext(context);
  runInContext(SCRIPT, context);

  // The script's work happens inside an async IIFE; let the microtask queue and
  // the stubbed fetch promises drain before inspecting what it did.
  await new Promise((resolve) => setTimeout(resolve, 50));
  return { calls, summary: summaryChunks.join('') };
}

const writes = (calls) => calls.filter((c) => c.method !== 'GET');
const topicWrite = (calls) => calls.find((c) => c.method === 'PUT' && c.path.endsWith('/topics'));
const descriptionWrite = (calls) => calls.find((c) => c.method === 'PATCH');

describe('reconciliation sweep: disabled states', () => {
  it('makes no API calls at all when the mode is off', async () => {
    const { calls, summary } = await runSweep({ mode: 'off' });
    expect(calls).toEqual([]);
    expect(summary).toContain('**off**');
  });

  it('treats an unrendered placeholder as off rather than guessing a mode', async () => {
    // A file copied by hand instead of synced by the action must not start
    // writing to student repositories on a guess.
    const { calls } = await runSweep({ mode: '{{MARKER_MODE}}' });
    expect(calls).toEqual([]);
  });
});

describe('reconciliation sweep: winding down when an assignment finishes', () => {
  // The sweep runs on a schedule but is only re-synced when a student pushes,
  // so a finished assignment would otherwise sweep forever on a version no fix
  // could reach.
  it('stands down on a schedule once the assignment has been quiet', async () => {
    const { calls, summary } = await runSweep({
      mode: 'both',
      idleDays: REPO_MARKER_SWEEP_IDLE_DAYS,
      repos: [repo('appd5000-lab3-jsmith', { topics: ['grillmycode'] })],
    });
    // One call — its own metadata — and nothing else is even listed.
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe(`/repos/${INSTRUCTOR_REPO}`);
    expect(summary).toContain('stood down');
  });

  it('still runs the day before the threshold', async () => {
    const { calls } = await runSweep({
      mode: 'both',
      idleDays: REPO_MARKER_SWEEP_IDLE_DAYS - 1,
      repos: [repo('appd5000-lab3-jsmith', { topics: ['grillmycode'] })],
    });
    expect(topicWrite(calls)).toBeDefined();
  });

  it('ignores the idle check on a manual run, however long it has been quiet', async () => {
    // An instructor who presses Run wants it to run.
    const { calls } = await runSweep({
      mode: 'both',
      eventName: 'workflow_dispatch',
      idleDays: REPO_MARKER_SWEEP_IDLE_DAYS * 3,
      repos: [repo('appd5000-lab3-jsmith', { topics: ['grillmycode'] })],
    });
    expect(topicWrite(calls)).toBeDefined();
  });

  it('does not read its own metadata at all when the mode is off', async () => {
    const { calls } = await runSweep({ mode: 'off', idleDays: 99 });
    expect(calls).toEqual([]);
  });
});

describe('reconciliation sweep: scope', () => {
  it('only touches repositories named for this assignment', async () => {
    const { calls } = await runSweep({
      mode: 'both',
      repos: [repo('appd5000-lab3-jsmith'), repo('some-other-course-lab1-jsmith')],
      issues: { 'appd5000-lab3-jsmith': [OPEN_ASSESSMENT] },
    });
    expect(calls.some((c) => c.path.includes('some-other-course'))).toBe(false);
  });

  it('leaves archived repositories alone', async () => {
    const { calls } = await runSweep({
      mode: 'both',
      repos: [repo('appd5000-lab3-jsmith', { topics: ['grillmycode'], archived: true })],
    });
    expect(writes(calls)).toEqual([]);
  });
});

describe('reconciliation sweep: topics', () => {
  it('adds the topic to a repository whose assessment is live but unmarked', async () => {
    const { calls } = await runSweep({
      mode: 'both',
      repos: [repo('appd5000-lab3-jsmith')],
      issues: { 'appd5000-lab3-jsmith': [OPEN_ASSESSMENT] },
    });
    expect(topicWrite(calls).body.names).toContain('grillmycode');
  });

  it('removes the topic once no open assessment issue remains', async () => {
    const { calls } = await runSweep({
      mode: 'both',
      repos: [repo('appd5000-lab3-jsmith', { topics: ['python', 'grillmycode'] })],
    });
    expect(topicWrite(calls).body.names).not.toContain('grillmycode');
  });

  it("preserves the instructor's other topics when removing the marker", async () => {
    const { calls } = await runSweep({
      mode: 'both',
      repos: [repo('appd5000-lab3-jsmith', { topics: ['python', 'grillmycode', 'week-3'] })],
    });
    expect(topicWrite(calls).body.names).toEqual(['python', 'week-3']);
  });

  it('does not count a labelled pull request as a live assessment', async () => {
    const { calls } = await runSweep({
      mode: 'topic',
      repos: [repo('appd5000-lab3-jsmith', { topics: ['grillmycode'] })],
      issues: { 'appd5000-lab3-jsmith': [{ number: 2, pull_request: { url: 'x' } }] },
    });
    expect(topicWrite(calls).body.names).not.toContain('grillmycode');
  });

  it('writes nothing when the marker already matches reality', async () => {
    const { calls, summary } = await runSweep({
      mode: 'both',
      repos: [repo('appd5000-lab3-jsmith', { topics: ['grillmycode'] })],
      issues: { 'appd5000-lab3-jsmith': [OPEN_ASSESSMENT] },
    });
    expect(writes(calls)).toEqual([]);
    expect(summary).toContain('nothing to do');
  });
});

describe('reconciliation sweep: descriptions', () => {
  const marked = `Week 3 lab${REPO_MARKER_DESCRIPTION_SEPARATOR}${REPO_MARKER_DESCRIPTION_SIGIL}: 20 questions`;

  it('strips a stale marker back to the instructor’s own text', async () => {
    const { calls } = await runSweep({
      mode: 'both',
      repos: [repo('appd5000-lab3-jsmith', { description: marked })],
    });
    expect(descriptionWrite(calls).body.description).toBe('Week 3 lab');
  });

  it('never re-adds a description marker, because it cannot know the count', async () => {
    const { calls } = await runSweep({
      mode: 'both',
      repos: [repo('appd5000-lab3-jsmith', { description: 'Week 3 lab' })],
      issues: { 'appd5000-lab3-jsmith': [OPEN_ASSESSMENT] },
    });
    expect(descriptionWrite(calls)).toBeUndefined();
  });

  it('leaves a description that merely mentions GrillMyCode alone', async () => {
    const { calls } = await runSweep({
      mode: 'both',
      repos: [repo('appd5000-lab3-jsmith', { description: 'Week 3 lab, graded with GrillMyCode' })],
    });
    expect(descriptionWrite(calls)).toBeUndefined();
  });
});

describe('reconciliation sweep: dry run', () => {
  it('makes no writes but still reports the drift it found', async () => {
    const { calls, summary } = await runSweep({
      mode: 'both',
      dryRun: true,
      repos: [
        repo('appd5000-lab3-jsmith'),
        repo('appd5000-lab3-bsmith', { topics: ['grillmycode'] }),
      ],
      issues: { 'appd5000-lab3-jsmith': [OPEN_ASSESSMENT] },
    });
    expect(writes(calls)).toEqual([]);
    expect(summary).toContain('would change');
  });
});
