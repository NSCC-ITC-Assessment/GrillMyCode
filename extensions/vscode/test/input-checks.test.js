import { describe, expect, it } from 'vitest';
import { checkWorkflow, closestInput } from '../src/shared/input-checks.js';
import { workflow } from './workflow-sample.js';

const KEY = 'api_key: ${{ secrets.OPENROUTER_API_KEY }}';

/** The problems of a step with these inputs, each with the text it underlines. */
function problems(inputs, options = {}) {
  const text = workflow(inputs, options);
  return checkWorkflow(text, options).map(({ start, end, ...problem }) => ({
    ...problem,
    text: text.slice(start, end),
  }));
}

/** The one problem a step with these inputs and a key has. */
function problem(inputs, options) {
  const found = problems([KEY, ...inputs], options);
  expect(found).toHaveLength(1);
  return found[0];
}

describe('a workflow with nothing wrong', () => {
  it('has no problems', () => {
    expect(
      problems([
        KEY,
        'num_questions: 10',
        'starter_code: Ask',
        'starter_questions_one_in: 4',
        'question_emphasis: tracing',
        'ai_temperature: 0.7',
        'keep_comments: true',
        'label_repos: "true"',
        'instructor_repo_token: ${{ secrets.INSTRUCTOR_REPO_TOKEN }}',
      ]),
    ).toEqual([]);
  });

  it('has none where the file has no GrillMyCode step', () => {
    expect(checkWorkflow('jobs:\n  a:\n    steps:\n      - uses: actions/checkout@v6\n')).toEqual(
      [],
    );
    expect(checkWorkflow('')).toEqual([]);
  });

  it('is not checked where GitHub works the value out at run time', () => {
    expect(
      problems([
        KEY,
        'num_questions: ${{ inputs.num_questions }}',
        'starter_code: ${{ inputs.starter_code || "ignore" }}',
        'label_repos: ${{ vars.LABEL_REPOS }}',
      ]),
    ).toEqual([]);
  });
});

describe('a value the action rejects', () => {
  it.each([
    ['starter_code: asks', 'asks', '"none", "ignore", "context" or "ask"'],
    ['base_sha: ${{ inputs.base_sha }}\nprevious_work: none', 'none', '"context" or "ignore"'],
    ['question_emphasis: "trace"', '"trace"', '"balanced", "research" or "tracing"'],
    ['ai_reasoning_effort: maximum', 'maximum', '"xhigh" or "max"'],
    ['ai_provider: OpenRouter', 'OpenRouter', 'must be "openrouter"'],
    ['instructor_repo_token: ${{ secrets.T }}\nlabel_repos: yes', 'yes', '"true" or "false"'],
    ['preview_only: 1', '1', '"true" or "false"'],
  ])('%s is an error', (lines, text, allowed) => {
    const found = problem(lines.split('\n'));
    expect(found).toMatchObject({ severity: 'error', code: 'invalid-value', text });
    expect(found.message).toContain(allowed);
    expect(found.message).toContain('fails');
  });

  it('accepts tag_diff_base naming a tag, and rejects a name that is a pattern', () => {
    const tags = ['submission_tags: phase1, phase2'];
    expect(problems([KEY, ...tags, 'tag_diff_base: tag:phase1'])).toEqual([]);
    expect(problems([KEY, ...tags, 'tag_diff_base: Previous-Tag'])).toEqual([]);
    expect(problem([...tags, 'tag_diff_base: tag:phase*'])).toMatchObject({
      severity: 'error',
      text: 'tag:phase*',
    });
    expect(problem([...tags, 'tag_diff_base: earliest']).message).toContain('"tag:<tag name>"');
  });

  it('names the submission tag patterns the action does not support', () => {
    const found = problem(['submission_tags: phase1, !draft, two words']);
    expect(found).toMatchObject({ severity: 'error', code: 'invalid-value' });
    expect(found.message).toContain('"!draft", "two words"');
    expect(found.message).not.toContain('"phase1"');
  });
});

describe('a value the action changes or ignores', () => {
  it.each([
    ['num_questions: 70', 'so 50 is used'],
    ['num_questions: 0', 'so 1 is used'],
    ['starter_code: ask\nstarter_questions_one_in: 1', 'so 2 is used'],
    ['ai_retry_max_attempts: 0', 'so 1 is used'],
    ['num_questions: 5.5', 'is read as 5'],
    ['ai_temperature: 3', 'from 0 to 2'],
    ['ai_temperature: warm', 'from 0 to 2'],
    ['keep_comments: yes', 'is read as "false"'],
    ['include_answers: "True"', 'is read as "false"'],
  ])('%s is a warning', (lines, said) => {
    const found = problem(lines.split('\n'));
    expect(found.severity).toBe('warning');
    expect(found.message).toContain(said);
  });

  it('is an error when it is not a number at all', () => {
    expect(problem(['num_questions: twenty'])).toMatchObject({
      severity: 'error',
      text: 'twenty',
    });
  });

  // YAML reads an unquoted True as a boolean, and GitHub passes it on as "true".
  it('accepts a boolean in any letter case when it is not quoted', () => {
    expect(problems([KEY, 'keep_comments: True', 'fail_on_empty_assessment: FALSE'])).toEqual([]);
  });
});

describe('an input the action does not declare', () => {
  it('is a warning that offers the input it is close to', () => {
    const found = problem(['num_question: 10']);
    expect(found).toMatchObject({
      severity: 'warning',
      code: 'unknown-input',
      text: 'num_question',
    });
    expect(found.message).toContain('Did you mean "num_questions"?');
  });

  it('says the extension may be out of date when nothing is close', () => {
    expect(problem(['rubric_file: rubric.md']).message).toContain('update the extension');
  });

  it('is left to the GitHub Actions extension when that reports it', () => {
    expect(problems([KEY, 'num_question: 10'], { unknownInputs: false })).toEqual([]);
  });

  it('is not one whose name differs only in letter case', () => {
    expect(problems([KEY, 'Num_Questions: 70'])).toMatchObject([{ code: 'out-of-range' }]);
  });

  it('never offers the hidden input', () => {
    expect(closestInput('log_prompts')).toBeUndefined();
    expect(closestInput('api_keys')).toBe('api_key');
  });
});

describe('a deprecated input', () => {
  it('is a warning that names its replacement', () => {
    const found = problem(['include_initial_commit: true']);
    expect(found).toMatchObject({
      severity: 'warning',
      code: 'deprecated-input',
      deprecated: true,
      text: 'include_initial_commit',
    });
    expect(found.message).toContain('Use starter_code: none instead.');
    expect(found.message).not.toContain('ignored');
  });

  it('says so when its replacement is set and it is ignored', () => {
    const [found] = problems([KEY, 'starter_code: none', 'include_initial_commit: true']);
    expect(found.message).toContain('It is ignored here');
  });
});

describe('the API key', () => {
  it('is an error when it is missing', () => {
    expect(problems(['num_questions: 10'])).toMatchObject([
      { severity: 'error', code: 'missing-api-key', text: 'with' },
    ]);
    expect(problems(['api_key: ""'])).toMatchObject([{ code: 'missing-api-key', text: 'api_key' }]);
  });

  it('is underlined on the step when the step has no inputs', () => {
    const text = 'steps:\n  - uses: NSCC-ITC-Assessment/GrillMyCode@v0\n';
    const [found] = checkWorkflow(text);
    expect(found.code).toBe('missing-api-key');
    expect(text.slice(found.start, found.end)).toBe('NSCC-ITC-Assessment/GrillMyCode@v0');
  });

  it('is not needed by a preview', () => {
    expect(problems(['preview_only: true'])).toEqual([]);
    expect(problems(['preview_only: ${{ inputs.preview_only }}'])).toEqual([]);
    expect(problems(['preview_only: false'])).toMatchObject([{ code: 'missing-api-key' }]);
  });

  it('is a warning when it is written into the file', () => {
    expect(problems(['api_key: sk-or-v1-0000'])).toMatchObject([
      { severity: 'warning', code: 'secret-in-workflow', text: 'sk-or-v1-0000' },
    ]);
  });

  it('is a warning when it is read from a workflow input', () => {
    for (const value of ['${{ inputs.api_key }}', '${{ github.event.inputs.api_key }}']) {
      expect(problems([`api_key: ${value}`])).toMatchObject([{ code: 'secret-in-workflow' }]);
    }
  });

  it('covers the other tokens too', () => {
    expect(problem(['instructor_repo_token: ghp_0000'])).toMatchObject({
      code: 'secret-in-workflow',
    });
    expect(problems([KEY, 'github_token: ${{ github.token }}'])).toEqual([]);
  });
});

describe('inputs that depend on one another', () => {
  it('warns when label_repos has no instructor_repo_token', () => {
    expect(problem(['label_repos: true'])).toMatchObject({
      severity: 'warning',
      code: 'needs-other-input',
      text: 'label_repos',
    });
    expect(problems([KEY, 'label_repos: false'])).toEqual([]);
  });

  it('notes a starter question share that has no effect', () => {
    expect(problem(['starter_questions_one_in: 4'])).toMatchObject({
      severity: 'info',
      code: 'no-effect',
    });
    expect(problem(['starter_code: context', 'starter_questions_one_in: 4']).code).toBe(
      'no-effect',
    );
    expect(
      problems([KEY, 'starter_code: ${{ inputs.mode }}', 'starter_questions_one_in: 4']),
    ).toEqual([]);
  });

  it('notes previous_work where no run has earlier work', () => {
    const tags = 'submission_tags: phase1';
    expect(problem(['previous_work: ignore'])).toMatchObject({
      severity: 'info',
      code: 'no-effect',
    });
    expect(problems([KEY, tags, 'tag_diff_base: previous-tag', 'previous_work: ignore'])).toEqual(
      [],
    );
    expect(problems([KEY, 'base_sha: ${{ inputs.base_sha }}', 'previous_work: ignore'])).toEqual(
      [],
    );
  });

  it('notes tag_diff_base where no run is started by a tag', () => {
    expect(problem(['tag_diff_base: previous-tag'])).toMatchObject({
      severity: 'info',
      code: 'no-effect',
      text: 'tag_diff_base',
    });
    expect(problems([KEY, 'tag_diff_base: cumulative'])).toEqual([]);
  });
});

describe('submission tags and the tags the workflow runs on', () => {
  const on = 'on:\n  push:\n    tags: ["phase1", "phase2"]';

  it('are an error when the workflow runs on tags and lists none', () => {
    expect(problems([KEY], { on })).toMatchObject([
      { severity: 'error', code: 'missing-submission-tags', text: 'with' },
    ]);
  });

  it('are fine when the two lists are the same, in any order and layout', () => {
    expect(problems([KEY, 'submission_tags: phase2, phase1'], { on })).toEqual([]);
    expect(problems([KEY, 'submission_tags: |', '  phase1', '  phase2'], { on })).toEqual([]);
  });

  it('are a warning when either list has an entry the other lacks', () => {
    const [missing] = problems([KEY, 'submission_tags: phase1'], { on });
    expect(missing).toMatchObject({
      severity: 'warning',
      code: 'tag-lists-differ',
      text: 'phase1',
    });
    expect(missing.message).toContain('does not list "phase2"');

    const [extra] = problems([KEY, 'submission_tags: phase1, phase2, final'], { on });
    expect(extra.message).toContain('lists "final"');
  });

  it('are not compared when the list is worked out at run time', () => {
    expect(problems([KEY, 'submission_tags: ${{ vars.SUBMISSION_TAGS }}'], { on })).toEqual([]);
  });
});
