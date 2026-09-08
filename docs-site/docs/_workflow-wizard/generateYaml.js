/**
 * Pure function: config state → GitHub Actions workflow YAML string.
 * Only emits inputs that differ from their defaults to keep output minimal.
 */

import {
  DISPATCH_OVERRIDES_BY_KEY,
  resolveDispatchOverrides,
} from './dispatchInputs';

/**
 * Normalises a pattern string that may use commas, newlines, or a mix as
 * delimiters. Returns a single comma-separated string with each entry trimmed
 * and empty entries removed.
 */
function normalizePatterns(value) {
  return value
    .split(/[,\r\n]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .join(', ');
}

const DEFAULTS = {
  aiProvider: 'openrouter',
  aiModel: 'google/gemini-3.5-flash-lite',
  aiTemperature: 0.5,
  aiRetryMaxAttempts: 5,
  numQuestions: 20,
  includeAnswers: false,
  instructorContext: '',
  assignmentContext: '',
  assignmentContextMaxChars: 20000,
  excludePatternOverrides: '',
  additionalExcludePatterns: '',
  keepComments: false,
  includeInitialCommit: false,
  skipCommitters: 'github-actions[bot]',
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

// ── workflow_dispatch overrides ──────────────────────────────────────────────

/** Single-quoted YAML scalar. Inside single quotes YAML escapes ' by doubling. */
function yamlSingle(val) {
  return `'${String(val).replace(/'/g, "''")}'`;
}

/**
 * Collapses a value to the single line that both a dispatch input default and a
 * GitHub expression string literal are limited to. Applies the pattern
 * normaliser for the comma/newline-delimited inputs.
 *
 * Inputs carrying an `envFallback` never reach here with a multi-line value —
 * usesEnvFallback routes those to a job-level env var instead, so nothing is
 * silently flattened.
 */
function overrideValue(cfg, meta) {
  const raw = cfg[meta.cfgKey];
  const str = raw === undefined || raw === null ? '' : String(raw);
  const value = meta.normalize ? normalizePatterns(str) : str;
  return value.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * True when this override's default must live in a job-level env var rather
 * than inline in the expression — i.e. it declares an envFallback and its value
 * actually spans multiple lines, which neither a dispatch `default:` nor an
 * expression string literal can hold.
 *
 * A single-line value needs none of this and is inlined like any other input.
 */
function usesEnvFallback(cfg, meta) {
  if (!meta.envFallback) return false;
  const raw = cfg[meta.cfgKey];
  return typeof raw === 'string' && raw.trim() !== '' && /\r?\n/.test(raw.trim());
}

/**
 * The `with:` value for an overridden input.
 *
 * Uses `github.event.inputs.*` rather than the `inputs` context deliberately.
 * `inputs` hands back a real boolean for a boolean-typed dispatch input, and
 * `false || 'true'` would then silently substitute the fallback for a value the
 * instructor explicitly chose. `github.event.inputs.*` is always a string, and
 * GitHub casts the non-empty string 'false' to true, so the `||` fallback fires
 * only when the key is genuinely absent — i.e. on a non-dispatch run. Boolean
 * inputs are declared as `type: choice` below for the same reason.
 *
 * The whole expression is double-quoted so a fallback containing ': ' or a
 * leading special character cannot break the YAML.
 */
function dispatchExpr(key, fallback, { envVar = null } = {}) {
  if (envVar) {
    // env is available in a step's `with:`, so a multi-line default can be held
    // in a block scalar and referenced here without being flattened.
    return `"\${{ github.event.inputs.${key} || env.${envVar} }}"`;
  }
  const literal = String(fallback).replace(/'/g, "''").replace(/"/g, '\\"');
  return `"\${{ github.event.inputs.${key} || '${literal}' }}"`;
}

/** The `on.workflow_dispatch.inputs:` block for the selected override keys. */
function dispatchInputLines(cfg, overrideKeys) {
  const lines = [];
  lines.push('    # Manual-run overrides. Starting this workflow from the Actions tab');
  lines.push('    # shows a form pre-filled with these defaults; anything changed there');
  lines.push('    # applies to that run only. Any run that supplies no value — a cleared');
  lines.push('    # field, or any automatic trigger — uses the fallback baked into the');
  lines.push('    # matching `${{ ... || \'...\' }}` expression below.');
  lines.push('    #');
  lines.push('    # Keep each default here in sync with its fallback below — they are the');
  lines.push('    # same value in two places, and if they drift, clearing a field on the');
  lines.push('    # form stops matching what leaving it at its default does.');
  lines.push('    inputs:');
  overrideKeys.forEach((key) => {
    const meta = DISPATCH_OVERRIDES_BY_KEY[key];
    const value = overrideValue(cfg, meta);
    lines.push(`      ${key}:`);
    // The Run workflow form labels each field with its description alone — the
    // input name is never shown — so prefix it, or an instructor faced with two
    // similar-sounding fields cannot tell which action input they are editing.
    lines.push(`        description: ${yamlSingle(`${key} - ${meta.description}`)}`);
    if (meta.type === 'boolean') {
      // Declared as choice, not boolean — see dispatchExpr for why.
      lines.push('        type: choice');
      lines.push("        options: ['false', 'true']");
      lines.push(`        default: ${yamlSingle(value === 'true' ? 'true' : 'false')}`);
    } else {
      lines.push('        required: false');
      lines.push(`        default: ${yamlSingle(value)}`);
    }
  });
  return lines;
}

export function generateYaml(cfg, { actionRef = 'v1' } = {}) {
  const lines = [];

  const overrideKeys = resolveDispatchOverrides(cfg.dispatchOverrides);
  const overridden = new Set(overrideKeys);

  /**
   * Emits one action input under `with:`.
   *
   * An overridden key is always emitted, even when its value matches the action
   * default — the expression is the only thing wiring the dispatch input to the
   * action, so omitting it as "same as default" would silently discard the
   * override. Non-overridden keys keep the existing minimal-output behaviour.
   */
  function pushInput(actionKey, cfgKey, rendered) {
    if (overridden.has(actionKey)) {
      const meta = DISPATCH_OVERRIDES_BY_KEY[actionKey];
      const envVar = usesEnvFallback(cfg, meta) ? meta.envFallback : null;
      lines.push(
        `          ${actionKey}: ${dispatchExpr(actionKey, overrideValue(cfg, meta), { envVar })}`,
      );
      return true;
    }
    if (differ(cfg, cfgKey)) {
      lines.push(`          ${actionKey}: ${rendered}`);
      return true;
    }
    return false;
  }

  // ── name ───────────────────────────────────────────────────────────────────
  lines.push('name: GrillMyCode');
  lines.push('');

  // ── on ────────────────────────────────────────────────────────────────────
  lines.push('on:');

  const hasPush = cfg.triggerEvent === 'push+workflow_dispatch';
  const dynamicBranch = hasPush && cfg.branchMode === 'default';

  if (hasPush) {
    lines.push('  push:');
    if (!dynamicBranch) {
      const branches = cfg.pushBranches && cfg.pushBranches.length > 0 ? cfg.pushBranches : ['main', 'master'];
      lines.push(`    branches: [${branches.map((b) => `"${b}"`).join(', ')}]`);
    }
  }

  lines.push('  workflow_dispatch:');
  if (overrideKeys.length > 0) {
    dispatchInputLines(cfg, overrideKeys).forEach((l) => lines.push(l));
  }

  lines.push('');

  // ── concurrency ─────────────────────────────────────────────────────────────
  // Kept identical to the concurrency comment used by every workflow example in
  // the docs, so a wizard-generated file and a copied example look the same.
  lines.push('# A new push cancels any run still in progress for the same branch,');
  lines.push('# so only the latest commit is ever assessed (see FAQ).');
  lines.push('# Do not modify this setting unless you have a compelling reason to.');
  lines.push('concurrency:');
  lines.push('  group: grillmycode-${{ github.workflow }}-${{ github.ref }}');
  lines.push('  cancel-in-progress: true');
  lines.push('');

  // ── jobs ──────────────────────────────────────────────────────────────────
  lines.push('jobs:');
  lines.push('  generate-questions:');
  if (dynamicBranch) {
    lines.push(`    if: github.event_name == 'workflow_dispatch' || github.ref == format('refs/heads/{0}', github.event.repository.default_branch)`);
  }
  lines.push('    runs-on: ubuntu-latest');
  lines.push('    timeout-minutes: 15');

  // permissions
  lines.push('    permissions:');
  lines.push('      contents: write  # gmc-assessments release + PDF asset');
  lines.push('      issues: write    # assessment issue');

  // ── env (multi-line dispatch defaults) ─────────────────────────────────────
  // GitHub has no multi-line workflow_dispatch input, and an expression string
  // literal cannot contain newlines either — so a multi-line default is held
  // here as a block scalar and referenced from the step's `with:` (the env
  // context is available there). Leaving the dispatch input blank falls back to
  // this value with its formatting intact.
  const envDefaults = overrideKeys
    .map((key) => DISPATCH_OVERRIDES_BY_KEY[key])
    .filter((meta) => usesEnvFallback(cfg, meta));
  if (envDefaults.length > 0) {
    lines.push('    env:');
    envDefaults.forEach((meta) => {
      lines.push(`      # Canonical default for "${meta.key}", used by every automatic run`);
      lines.push(`      # and by a manual run that clears the field. The dispatch form prefills`);
      lines.push(`      # the same text collapsed to one line (GitHub has no multi-line input),`);
      lines.push(`      # so a manual run submitted as-is sends that single-line form. Edit both`);
      lines.push(`      # if you change the wording.`);
      lines.push(`      ${meta.envFallback}: |`);
      String(cfg[meta.cfgKey])
        .replace(/\s+$/, '')
        .split('\n')
        .forEach((l) => lines.push(`        ${l}`));
    });
  }

  lines.push('    steps:');
  lines.push('      - uses: actions/checkout@v6');
  lines.push('        with:');
  lines.push('          fetch-depth: 0    # full history required for diff resolution');
  lines.push('');
  lines.push(`      - uses: NSCC-ITC-Assessment/GrillMyCode@${actionRef}`);
  lines.push('        with:');

  // ── Authentication ─────────────────────────────────────────────────────────
  // Both credentials are emitted together so they read as a pair in the copied
  // file. api_key is always emitted: OpenRouter requires it and the action
  // fails without it.
  lines.push('          github_token: ${{ secrets.GITHUB_TOKEN }}');
  {
    const secretName = cfg.apiKeySecret || 'OPENROUTER_API_KEY';
    lines.push(`          api_key: ${secretRef(secretName)}`);
  }

  // ── AI Provider ────────────────────────────────────────────────────────────
  if (differ(cfg, 'aiProvider')) {
    lines.push(`          ai_provider: ${yamlStr(cfg.aiProvider)}`);
  }
  if (!pushInput('ai_model', 'aiModel', yamlStr(cfg.aiModel))) {
    // The model is the input instructors are most likely to revisit later, so
    // keep it visible even when it matches the default — commented out, so
    // uncommenting the line is the only edit needed to switch models.
    lines.push(`          # If desired, uncomment this input and edit to use a different one —`);
    lines.push(`          # any model from https://openrouter.ai/models (provider/model-name).`);
    lines.push(`          # ai_model: ${yamlStr(cfg.aiModel)}`);
  }
  if (differ(cfg, 'aiRetryMaxAttempts')) {
    lines.push(`          ai_retry_max_attempts: ${yamlStr(cfg.aiRetryMaxAttempts)}`);
  }
  pushInput('ai_temperature', 'aiTemperature', yamlStr(cfg.aiTemperature));

  // ── Question generation ────────────────────────────────────────────────────
  pushInput('num_questions', 'numQuestions', yamlStr(cfg.numQuestions));
  pushInput('include_answers', 'includeAnswers', yamlStr(cfg.includeAnswers));
  if (cfg.assignmentContext && differ(cfg, 'assignmentContext')) {
    lines.push(`          assignment_context: ${yamlStr(cfg.assignmentContext)}`);
  }
  if (differ(cfg, 'assignmentContextMaxChars')) {
    lines.push(`          assignment_context_max_chars: ${yamlStr(cfg.assignmentContextMaxChars)}`);
  }
  if (overridden.has('instructor_context')) {
    // A dispatch form field and an expression literal are both single-line, so
    // the multi-line block scalar cannot be used here — overrideValue has
    // already collapsed the context to one line.
    pushInput('instructor_context', 'instructorContext', null);
  } else if (cfg.instructorContext && differ(cfg, 'instructorContext')) {
    lines.push('          instructor_context: |');
    cfg.instructorContext.split('\n').forEach((l) => {
      lines.push(`            ${l}`);
    });
  }

  // ── File filtering ─────────────────────────────────────────────────────────
  if (overridden.has('exclude_pattern_overrides') || cfg.excludePatternOverrides) {
    pushInput(
      'exclude_pattern_overrides',
      'excludePatternOverrides',
      yamlStr(normalizePatterns(cfg.excludePatternOverrides)),
    );
  }
  if (overridden.has('additional_exclude_patterns') || cfg.additionalExcludePatterns) {
    pushInput(
      'additional_exclude_patterns',
      'additionalExcludePatterns',
      yamlStr(normalizePatterns(cfg.additionalExcludePatterns)),
    );
  }
  pushInput('keep_comments', 'keepComments', yamlStr(cfg.keepComments));
  pushInput('include_initial_commit', 'includeInitialCommit', yamlStr(cfg.includeInitialCommit));
  if (differ(cfg, 'skipCommitters')) {
    lines.push(`          skip_committers: ${yamlStr(cfg.skipCommitters)}`);
  }

  // ── Instructor repository ──────────────────────────────────────────────────
  if (cfg.instructorRepoEnabled) {
    const tokenSecret = cfg.instructorRepoTokenSecret || 'INSTRUCTOR_REPO_TOKEN';
    lines.push(`          instructor_repo_token: ${secretRef(tokenSecret)}`);
  }

  // ── SHA overrides ──────────────────────────────────────────────────────────
  // Deliberately not exposed as workflow_dispatch inputs — see dispatchInputs.js
  // for why. Set on the Advanced step, they are baked into the file as a pair,
  // which is the only form the action applies.
  if (cfg.baseSha && cfg.headSha) {
    lines.push(`          base_sha: ${yamlStr(cfg.baseSha)}`);
    lines.push(`          head_sha: ${yamlStr(cfg.headSha)}`);
  }

  return lines.join('\n');
}
