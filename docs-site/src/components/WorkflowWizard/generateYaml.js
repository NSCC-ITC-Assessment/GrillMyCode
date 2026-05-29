/**
 * Pure function: config state → GitHub Actions workflow YAML string.
 * Only emits inputs that differ from their defaults to keep output minimal.
 */

const DEFAULTS = {
  aiProvider: 'github-models',
  aiModel: 'gpt-4.1',
  aiTemperature: 0.5,
  aiRetryMaxAttempts: 5,
  numQuestions: 20,
  includeAnswers: false,
  additionalContext: '',
  assignmentContext: '',
  assignmentContextMaxChars: 20000,
  includePatterns: '',
  excludePatterns: '',
  excludeWorkflowFiles: true,
  keepComments: false,
  skipInitialCommit: true,
  skipCommitters: 'github-classroom[bot],github-actions[bot]',
  outputFile: 'grill-my-code.md',
  postPrComment: false,
  postIssue: false,
  postDiscussion: false,
  discussionCategory: 'Assessments',
  instructorRepoEnabled: false,
  baseSha: '',
  headSha: '',
};

function differ(cfg, key) {
  return cfg[key] !== DEFAULTS[key];
}

function yamlStr(val) {
  // Wrap in double quotes; escape any internal double quotes.
  return `"${String(val).replace(/"/g, '\\"')}"`;
}

function secretRef(name) {
  return `\${{ secrets.${name} }}`;
}

export function generateYaml(cfg) {
  const lines = [];

  // ── name ───────────────────────────────────────────────────────────────────
  lines.push('name: Grill My Code');
  lines.push('');

  // ── on ────────────────────────────────────────────────────────────────────
  lines.push('on:');

  const hasPr = ['pull_request+workflow_dispatch', 'push+pull_request+workflow_dispatch'].includes(cfg.triggerEvent);
  const hasPush = ['push+workflow_dispatch', 'push+pull_request+workflow_dispatch'].includes(cfg.triggerEvent);
  const hasDispatch = true; // all options include workflow_dispatch

  if (hasPr) {
    lines.push('  pull_request:');
    const types = cfg.prTypes && cfg.prTypes.length > 0 ? cfg.prTypes : ['opened', 'synchronize'];
    lines.push(`    types: [${types.join(', ')}]`);
  }

  if (hasPush) {
    lines.push('  push:');
    const branches = cfg.pushBranches && cfg.pushBranches.length > 0 ? cfg.pushBranches : ['main'];
    lines.push(`    branches: [${branches.map((b) => `"${b}"`).join(', ')}]`);
  }

  if (hasDispatch) {
    lines.push('  workflow_dispatch:');
  }

  lines.push('');

  // ── jobs ──────────────────────────────────────────────────────────────────
  lines.push('jobs:');
  lines.push('  generate-questions:');
  lines.push('    runs-on: ubuntu-latest');

  // permissions
  lines.push('    permissions:');
  lines.push('      contents: write       # required to commit the output file');
  if (cfg.postPrComment) {
    lines.push('      pull-requests: write  # required to post the PR comment');
  }
  if (cfg.aiProvider === 'github-models') {
    lines.push('      models: read          # required to call GitHub Models API');
  }
  if (cfg.postIssue) {
    lines.push('      issues: write         # required to create issues');
  }
  if (cfg.postDiscussion) {
    lines.push('      discussions: write    # required to create discussions');
  }

  lines.push('    steps:');
  lines.push('      - uses: actions/checkout@v4');
  lines.push('        with:');
  lines.push('          fetch-depth: 0    # full history required for diff resolution');
  lines.push('');
  lines.push('      - uses: NSCC-ITC-Assessment/GrillMyCode@v1');
  lines.push('        with:');

  // ── Authentication ─────────────────────────────────────────────────────────
  lines.push('          github_token: ${{ secrets.GITHUB_TOKEN }}');

  // ── AI Provider ────────────────────────────────────────────────────────────
  if (differ(cfg, 'aiProvider')) {
    lines.push(`          ai_provider: ${yamlStr(cfg.aiProvider)}`);
  }
  if (differ(cfg, 'aiModel')) {
    lines.push(`          ai_model: ${yamlStr(cfg.aiModel)}`);
  }
  if (cfg.aiProvider !== 'github-models') {
    const secretName = cfg.apiKeySecret || 'OPENAI_API_KEY';
    lines.push(`          api_key: ${secretRef(secretName)}`);
  }
  if (cfg.aiProvider === 'azure-openai') {
    const endpointSecret = cfg.azureEndpointSecret || 'AZURE_OPENAI_ENDPOINT';
    lines.push(`          azure_endpoint: ${secretRef(endpointSecret)}`);
  }
  if (differ(cfg, 'aiRetryMaxAttempts')) {
    lines.push(`          ai_retry_max_attempts: ${yamlStr(cfg.aiRetryMaxAttempts)}`);
  }
  if (differ(cfg, 'aiTemperature')) {
    lines.push(`          ai_temperature: ${yamlStr(cfg.aiTemperature)}`);
  }

  // ── Question generation ────────────────────────────────────────────────────
  if (differ(cfg, 'numQuestions')) {
    lines.push(`          num_questions: ${yamlStr(cfg.numQuestions)}`);
  }
  if (differ(cfg, 'includeAnswers')) {
    lines.push(`          include_answers: ${yamlStr(cfg.includeAnswers)}`);
  }
  if (cfg.assignmentContext && differ(cfg, 'assignmentContext')) {
    lines.push(`          assignment_context: ${yamlStr(cfg.assignmentContext)}`);
  }
  if (differ(cfg, 'assignmentContextMaxChars')) {
    lines.push(`          assignment_context_max_chars: ${yamlStr(cfg.assignmentContextMaxChars)}`);
  }
  if (cfg.additionalContext && differ(cfg, 'additionalContext')) {
    lines.push('          additional_context: |');
    cfg.additionalContext.split('\n').forEach((l) => {
      lines.push(`            ${l}`);
    });
  }

  // ── File filtering ─────────────────────────────────────────────────────────
  if (cfg.includePatterns && differ(cfg, 'includePatterns')) {
    lines.push(`          include_patterns: ${yamlStr(cfg.includePatterns)}`);
  }
  if (cfg.excludePatterns && differ(cfg, 'excludePatterns')) {
    lines.push(`          exclude_patterns: ${yamlStr(cfg.excludePatterns)}`);
  }
  if (differ(cfg, 'excludeWorkflowFiles')) {
    lines.push(`          exclude_workflow_files: ${yamlStr(cfg.excludeWorkflowFiles)}`);
  }
  if (differ(cfg, 'keepComments')) {
    lines.push(`          keep_comments: ${yamlStr(cfg.keepComments)}`);
  }
  if (differ(cfg, 'skipInitialCommit')) {
    lines.push(`          skip_initial_commit: ${yamlStr(cfg.skipInitialCommit)}`);
  }
  if (differ(cfg, 'skipCommitters')) {
    lines.push(`          skip_committers: ${yamlStr(cfg.skipCommitters)}`);
  }

  // ── Output & delivery ──────────────────────────────────────────────────────
  if (differ(cfg, 'outputFile')) {
    lines.push(`          output_file: ${yamlStr(cfg.outputFile)}`);
  }
  if (differ(cfg, 'postPrComment')) {
    lines.push(`          post_pr_comment: ${yamlStr(cfg.postPrComment)}`);
  }
  if (differ(cfg, 'postIssue')) {
    lines.push(`          post_issue: ${yamlStr(cfg.postIssue)}`);
  }
  if (differ(cfg, 'postDiscussion')) {
    lines.push(`          post_discussion: ${yamlStr(cfg.postDiscussion)}`);
  }
  if (cfg.postDiscussion && differ(cfg, 'discussionCategory')) {
    lines.push(`          discussion_category: ${yamlStr(cfg.discussionCategory)}`);
  }
  if (cfg.instructorRepoEnabled) {
    const tokenSecret = cfg.instructorRepoTokenSecret || 'INSTRUCTOR_REPO_TOKEN';
    lines.push(`          instructor_repo_token: ${secretRef(tokenSecret)}`);
  }

  // ── SHA overrides ──────────────────────────────────────────────────────────
  if (cfg.baseSha && cfg.headSha) {
    lines.push(`          base_sha: ${yamlStr(cfg.baseSha)}`);
    lines.push(`          head_sha: ${yamlStr(cfg.headSha)}`);
  }

  return lines.join('\n');
}
