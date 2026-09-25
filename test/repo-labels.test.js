import { describe, expect, it, vi } from 'vitest';
import {
  applyRepoLabels,
  buildDescriptionLabel,
  mergeLabelTopic,
  removeLabelTopic,
  stripDescriptionLabel,
  withDescriptionLabel,
} from '../src/repo-labels.js';
import { REPO_DESCRIPTION_MAX_CHARS, REPO_LABEL_TOPIC } from '../src/constants.js';

describe('mergeLabelTopic', () => {
  it('keeps every topic the instructor already set', () => {
    expect(mergeLabelTopic(['python', 'week-3'])).toEqual({
      names: ['python', 'week-3', REPO_LABEL_TOPIC],
      changed: true,
    });
  });

  it('reports no change when the label is already present, so no write is made', () => {
    expect(mergeLabelTopic(['python', REPO_LABEL_TOPIC])).toEqual({
      names: ['python', REPO_LABEL_TOPIC],
      changed: false,
    });
  });

  it('matches case-insensitively, since GitHub stores topics lowercased', () => {
    expect(mergeLabelTopic(['GrillMyCode']).changed).toBe(false);
  });

  it('handles a repository with no topics at all', () => {
    expect(mergeLabelTopic([])).toEqual({ names: [REPO_LABEL_TOPIC], changed: true });
    expect(mergeLabelTopic(undefined)).toEqual({ names: [REPO_LABEL_TOPIC], changed: true });
  });
});

describe('removeLabelTopic', () => {
  it('removes only the label', () => {
    expect(removeLabelTopic(['python', REPO_LABEL_TOPIC, 'week-3'])).toEqual({
      names: ['python', 'week-3'],
      changed: true,
    });
  });

  it('reports no change when there is nothing to remove', () => {
    expect(removeLabelTopic(['python']).changed).toBe(false);
  });
});

describe('buildDescriptionLabel', () => {
  it('pluralises the question count', () => {
    expect(buildDescriptionLabel(20)).toBe('🔥 GrillMyCode: 20 questions');
    expect(buildDescriptionLabel(1)).toBe('🔥 GrillMyCode: 1 question');
  });
});

describe('stripDescriptionLabel', () => {
  it('removes a label this module previously appended', () => {
    expect(stripDescriptionLabel('Week 3 lab · 🔥 GrillMyCode: 20 questions')).toBe('Week 3 lab');
  });

  it('removes a label that stands alone, with no separator in front of it', () => {
    expect(stripDescriptionLabel('🔥 GrillMyCode: 20 questions')).toBe('');
  });

  it('leaves a description that merely mentions GrillMyCode alone', () => {
    const text = 'Week 3 lab, assessed with 🔥 GrillMyCode every push';
    expect(stripDescriptionLabel(text)).toBe(text);
  });

  it('treats an absent description as empty', () => {
    expect(stripDescriptionLabel(null)).toBe('');
  });
});

describe('withDescriptionLabel', () => {
  it("appends the label after the instructor's own text", () => {
    expect(withDescriptionLabel('Week 3 lab', 20)).toEqual({
      description: 'Week 3 lab · 🔥 GrillMyCode: 20 questions',
      changed: true,
      tooLong: false,
    });
  });

  it('replaces a stale label rather than appending a second one', () => {
    const result = withDescriptionLabel('Week 3 lab · 🔥 GrillMyCode: 12 questions', 20);
    expect(result.description).toBe('Week 3 lab · 🔥 GrillMyCode: 20 questions');
    expect(result.changed).toBe(true);
  });

  it('is idempotent once the count is current, so repeated pushes make no write', () => {
    const marked = 'Week 3 lab · 🔥 GrillMyCode: 20 questions';
    expect(withDescriptionLabel(marked, 20)).toEqual({
      description: marked,
      changed: false,
      tooLong: false,
    });
  });

  it('writes the label alone when the repository has no description', () => {
    expect(withDescriptionLabel('', 20).description).toBe('🔥 GrillMyCode: 20 questions');
    expect(withDescriptionLabel(null, 20).description).toBe('🔥 GrillMyCode: 20 questions');
  });

  it("leaves an over-long description untouched rather than truncating the instructor's words", () => {
    const long = 'x'.repeat(REPO_DESCRIPTION_MAX_CHARS - 5);
    const result = withDescriptionLabel(long, 20);
    expect(result).toEqual({ description: long, changed: false, tooLong: true });
  });
});

/** Minimal Octokit double exposing only the four endpoints the label uses. */
function mockOctokit({ topics = [], description = '', failTopics = false } = {}) {
  return {
    rest: {
      repos: {
        getAllTopics: vi.fn(async () => {
          if (failTopics) throw new Error('Resource not accessible by integration');
          return { data: { names: topics } };
        }),
        replaceAllTopics: vi.fn(async () => ({ data: {} })),
        get: vi.fn(async () => ({ data: { description } })),
        update: vi.fn(async () => ({ data: {} })),
      },
    },
  };
}

const args = { owner: 'nscc', repo: 'appd5000-lab3-jsmith', questionCount: 20 };

describe('applyRepoLabels', () => {
  it('reads the existing topics before writing, so none are destroyed', async () => {
    // The endpoint replaces the whole set rather than adding to it, so writing
    // without reading first would silently delete the instructor's topics.
    const octokit = mockOctokit({ topics: ['python', 'week-3'] });
    const result = await applyRepoLabels({ octokit, ...args });

    expect(octokit.rest.repos.getAllTopics).toHaveBeenCalledOnce();
    expect(octokit.rest.repos.replaceAllTopics).toHaveBeenCalledWith({
      owner: 'nscc',
      repo: 'appd5000-lab3-jsmith',
      names: ['python', 'week-3', REPO_LABEL_TOPIC],
    });
    expect(result.topic).toBe('applied');
  });

  it('makes no topic write when the label is already there', async () => {
    const octokit = mockOctokit({ topics: [REPO_LABEL_TOPIC] });
    const result = await applyRepoLabels({ octokit, ...args });
    expect(octokit.rest.repos.replaceAllTopics).not.toHaveBeenCalled();
    expect(result.topic).toBe('unchanged');
  });

  it('writes both surfaces in two separate calls', async () => {
    // PATCH /repos cannot set topics, so a label is necessarily two writes.
    const octokit = mockOctokit({ topics: ['python'], description: 'Week 3 lab' });
    const result = await applyRepoLabels({ octokit, ...args });

    expect(octokit.rest.repos.replaceAllTopics).toHaveBeenCalledOnce();
    expect(octokit.rest.repos.update).toHaveBeenCalledWith({
      owner: 'nscc',
      repo: 'appd5000-lab3-jsmith',
      description: 'Week 3 lab · 🔥 GrillMyCode: 20 questions',
    });
    expect(result).toMatchObject({ topic: 'applied', description: 'applied' });
  });

  it('reports a failed topic write without throwing, and still writes the description', async () => {
    const octokit = mockOctokit({ failTopics: true, description: 'Week 3 lab' });
    const result = await applyRepoLabels({ octokit, ...args });

    expect(result.topic).toBe('failed');
    expect(result.error).toContain('not accessible');
    expect(result.description).toBe('applied');
  });

  it('reports an over-long description instead of writing one, and still writes the topic', async () => {
    const octokit = mockOctokit({ description: 'x'.repeat(REPO_DESCRIPTION_MAX_CHARS - 5) });
    const result = await applyRepoLabels({ octokit, ...args });
    expect(result.description).toBe('too-long');
    expect(octokit.rest.repos.update).not.toHaveBeenCalled();
    expect(result.topic).toBe('applied');
  });

  it('writes the label alone to a repository with no description', async () => {
    const octokit = mockOctokit();
    await applyRepoLabels({ octokit, ...args });
    expect(octokit.rest.repos.update).toHaveBeenCalledWith({
      owner: 'nscc',
      repo: 'appd5000-lab3-jsmith',
      description: '🔥 GrillMyCode: 20 questions',
    });
  });
});
