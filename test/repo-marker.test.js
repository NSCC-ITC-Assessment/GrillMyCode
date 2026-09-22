import { describe, expect, it, vi } from 'vitest';
import {
  applyRepoMarker,
  buildDescriptionMarker,
  mergeMarkerTopic,
  removeMarkerTopic,
  stripDescriptionMarker,
  withDescriptionMarker,
} from '../src/repo-marker.js';
import { REPO_DESCRIPTION_MAX_CHARS, REPO_MARKER_TOPIC } from '../src/constants.js';

describe('mergeMarkerTopic', () => {
  it('keeps every topic the instructor already set', () => {
    expect(mergeMarkerTopic(['python', 'week-3'])).toEqual({
      names: ['python', 'week-3', REPO_MARKER_TOPIC],
      changed: true,
    });
  });

  it('reports no change when the marker is already present, so no write is made', () => {
    expect(mergeMarkerTopic(['python', REPO_MARKER_TOPIC])).toEqual({
      names: ['python', REPO_MARKER_TOPIC],
      changed: false,
    });
  });

  it('matches case-insensitively, since GitHub stores topics lowercased', () => {
    expect(mergeMarkerTopic(['GrillMyCode']).changed).toBe(false);
  });

  it('handles a repository with no topics at all', () => {
    expect(mergeMarkerTopic([])).toEqual({ names: [REPO_MARKER_TOPIC], changed: true });
    expect(mergeMarkerTopic(undefined)).toEqual({ names: [REPO_MARKER_TOPIC], changed: true });
  });
});

describe('removeMarkerTopic', () => {
  it('removes only the marker', () => {
    expect(removeMarkerTopic(['python', REPO_MARKER_TOPIC, 'week-3'])).toEqual({
      names: ['python', 'week-3'],
      changed: true,
    });
  });

  it('reports no change when there is nothing to remove', () => {
    expect(removeMarkerTopic(['python']).changed).toBe(false);
  });
});

describe('buildDescriptionMarker', () => {
  it('pluralises the question count', () => {
    expect(buildDescriptionMarker(20)).toBe('🔥 GrillMyCode: 20 questions');
    expect(buildDescriptionMarker(1)).toBe('🔥 GrillMyCode: 1 question');
  });
});

describe('stripDescriptionMarker', () => {
  it('removes a marker this module previously appended', () => {
    expect(stripDescriptionMarker('Week 3 lab · 🔥 GrillMyCode: 20 questions')).toBe('Week 3 lab');
  });

  it('removes a marker that stands alone, with no separator in front of it', () => {
    expect(stripDescriptionMarker('🔥 GrillMyCode: 20 questions')).toBe('');
  });

  it('leaves a description that merely mentions GrillMyCode alone', () => {
    const text = 'Week 3 lab, assessed with 🔥 GrillMyCode every push';
    expect(stripDescriptionMarker(text)).toBe(text);
  });

  it('treats an absent description as empty', () => {
    expect(stripDescriptionMarker(null)).toBe('');
  });
});

describe('withDescriptionMarker', () => {
  it("appends the marker after the instructor's own text", () => {
    expect(withDescriptionMarker('Week 3 lab', 20)).toEqual({
      description: 'Week 3 lab · 🔥 GrillMyCode: 20 questions',
      changed: true,
      tooLong: false,
    });
  });

  it('replaces a stale marker rather than appending a second one', () => {
    const result = withDescriptionMarker('Week 3 lab · 🔥 GrillMyCode: 12 questions', 20);
    expect(result.description).toBe('Week 3 lab · 🔥 GrillMyCode: 20 questions');
    expect(result.changed).toBe(true);
  });

  it('is idempotent once the count is current, so repeated pushes make no write', () => {
    const marked = 'Week 3 lab · 🔥 GrillMyCode: 20 questions';
    expect(withDescriptionMarker(marked, 20)).toEqual({
      description: marked,
      changed: false,
      tooLong: false,
    });
  });

  it('writes the marker alone when the repository has no description', () => {
    expect(withDescriptionMarker('', 20).description).toBe('🔥 GrillMyCode: 20 questions');
    expect(withDescriptionMarker(null, 20).description).toBe('🔥 GrillMyCode: 20 questions');
  });

  it("leaves an over-long description untouched rather than truncating the instructor's words", () => {
    const long = 'x'.repeat(REPO_DESCRIPTION_MAX_CHARS - 5);
    const result = withDescriptionMarker(long, 20);
    expect(result).toEqual({ description: long, changed: false, tooLong: true });
  });
});

/** Minimal Octokit double exposing only the four endpoints the marker uses. */
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

describe('applyRepoMarker', () => {
  it('writes nothing at all when the mode is off', async () => {
    const octokit = mockOctokit();
    const result = await applyRepoMarker({ octokit, ...args, mode: 'off' });
    expect(result).toEqual({ topic: 'skipped', description: 'skipped', error: '' });
    expect(octokit.rest.repos.getAllTopics).not.toHaveBeenCalled();
    expect(octokit.rest.repos.get).not.toHaveBeenCalled();
  });

  it('reads the existing topics before writing, so none are destroyed', async () => {
    // The endpoint replaces the whole set rather than adding to it, so writing
    // without reading first would silently delete the instructor's topics.
    const octokit = mockOctokit({ topics: ['python', 'week-3'] });
    const result = await applyRepoMarker({ octokit, ...args, mode: 'topic' });

    expect(octokit.rest.repos.getAllTopics).toHaveBeenCalledOnce();
    expect(octokit.rest.repos.replaceAllTopics).toHaveBeenCalledWith({
      owner: 'nscc',
      repo: 'appd5000-lab3-jsmith',
      names: ['python', 'week-3', REPO_MARKER_TOPIC],
    });
    expect(result.topic).toBe('applied');
  });

  it('makes no topic write when the marker is already there', async () => {
    const octokit = mockOctokit({ topics: [REPO_MARKER_TOPIC] });
    const result = await applyRepoMarker({ octokit, ...args, mode: 'topic' });
    expect(octokit.rest.repos.replaceAllTopics).not.toHaveBeenCalled();
    expect(result.topic).toBe('unchanged');
  });

  it('leaves the description alone in topic mode, and the topics alone in description mode', async () => {
    const topicOnly = mockOctokit();
    await applyRepoMarker({ octokit: topicOnly, ...args, mode: 'topic' });
    expect(topicOnly.rest.repos.update).not.toHaveBeenCalled();

    const descriptionOnly = mockOctokit();
    await applyRepoMarker({ octokit: descriptionOnly, ...args, mode: 'description' });
    expect(descriptionOnly.rest.repos.replaceAllTopics).not.toHaveBeenCalled();
    expect(descriptionOnly.rest.repos.update).toHaveBeenCalledWith({
      owner: 'nscc',
      repo: 'appd5000-lab3-jsmith',
      description: '🔥 GrillMyCode: 20 questions',
    });
  });

  it('writes both surfaces in two separate calls under mode both', async () => {
    // PATCH /repos cannot set topics, so `both` is necessarily two writes.
    const octokit = mockOctokit({ topics: ['python'], description: 'Week 3 lab' });
    const result = await applyRepoMarker({ octokit, ...args, mode: 'both' });

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
    const result = await applyRepoMarker({ octokit, ...args, mode: 'both' });

    expect(result.topic).toBe('failed');
    expect(result.error).toContain('not accessible');
    expect(result.description).toBe('applied');
  });

  it('reports an over-long description instead of writing one', async () => {
    const octokit = mockOctokit({ description: 'x'.repeat(REPO_DESCRIPTION_MAX_CHARS - 5) });
    const result = await applyRepoMarker({ octokit, ...args, mode: 'description' });
    expect(result.description).toBe('too-long');
    expect(octokit.rest.repos.update).not.toHaveBeenCalled();
  });
});
