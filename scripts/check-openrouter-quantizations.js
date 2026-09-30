// Compares the quantization levels OpenRouter's API accepts with the ones
// GrillMyCode has decided on, and writes a Markdown report when they differ.
//
// Run by the weekly check-openrouter-quantizations workflow, which turns the
// report into a GitHub issue. Can also be run by hand:
//   node scripts/check-openrouter-quantizations.js [report-path]
//
// Every request sends AI_ALLOWED_QUANTIZATIONS as an allow-list, so:
// - a level OpenRouter adds is silently excluded until someone decides on it;
// - a level OpenRouter drops is still sent, and a request naming a level the
//   API no longer lists may be rejected, which would fail every run.
// The report covers both. Its fingerprint lets the workflow skip re-posting
// findings the tracking issue already holds.

import { createHash } from 'crypto';
import { appendFileSync, writeFileSync } from 'fs';
import { pathToFileURL } from 'url';
import { AI_ALLOWED_QUANTIZATIONS, AI_EXCLUDED_QUANTIZATIONS } from '../src/constants.js';

const SPEC_URL = 'https://openrouter.ai/openapi.json';
const DEFAULT_REPORT_PATH = 'quantization-report.md';

/** Returns the Quantization enum from OpenRouter's OpenAPI spec, or throws. */
export function extractQuantizations(spec) {
  const values = spec?.components?.schemas?.Quantization?.enum;
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    !values.every((v) => typeof v === 'string')
  ) {
    throw new Error('the spec has no components.schemas.Quantization.enum list of strings');
  }
  return values;
}

/**
 * Compares OpenRouter's levels with GrillMyCode's two lists.
 * - `added`: listed by OpenRouter but in neither list — needs a decision
 * - `removed`: allowed and sent with every request, but no longer listed
 * - `retired`: excluded, and no longer listed — harmless, tidy up when convenient
 */
export function compareQuantizations(
  published,
  { allowed = AI_ALLOWED_QUANTIZATIONS, excluded = AI_EXCLUDED_QUANTIZATIONS } = {},
) {
  const known = new Set([...allowed, ...excluded]);
  const listed = new Set(published);
  const added = [...listed].filter((v) => !known.has(v)).sort();
  const removed = allowed.filter((v) => !listed.has(v)).sort();
  const retired = excluded.filter((v) => !listed.has(v)).sort();
  return { added, removed, retired, attention: added.length > 0 || removed.length > 0 };
}

/**
 * A short hash of the findings, so the same findings posted again can be
 * recognized. A hash rather than the values themselves: they come from a
 * third-party spec and end up in a workflow output.
 */
export function fingerprint(findings) {
  const key = JSON.stringify({ added: findings.added, removed: findings.removed });
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

const code = (values) => values.map((v) => `\`${v}\``).join(', ');

/** The Markdown report for a comparison that needs attention. */
export function formatReport(findings, { specUrl = SPEC_URL } = {}) {
  const lines = [`<!-- quantization-check: ${fingerprint(findings)} -->`];
  lines.push(
    `OpenRouter's [API spec](${specUrl}) no longer matches the quantization levels GrillMyCode has decided on.`,
    '',
  );

  if (findings.removed.length > 0) {
    lines.push(
      '### Urgent: no longer listed, but still sent',
      '',
      `${code(findings.removed)} ${findings.removed.length === 1 ? 'is' : 'are'} in \`AI_ALLOWED_QUANTIZATIONS\`, which every request sends. If OpenRouter rejects a level it no longer lists, **every run fails**.`,
      '',
      '1. Remove it from `AI_ALLOWED_QUANTIZATIONS` in `src/constants.js`.',
      '2. Remove it from `ALLOWED_PRECISIONS` in `docs-site/docs/_workflow-wizard/modelCatalog.js`.',
      '3. Update the table in `docs-site/docs/ai-providers/openrouter.md#compressed-models`.',
      '4. Release a fix promptly.',
      '',
    );
  }

  if (findings.added.length > 0) {
    lines.push(
      '### New: needs a decision',
      '',
      `${code(findings.added)} ${findings.added.length === 1 ? 'is' : 'are'} listed by OpenRouter but in neither of GrillMyCode's lists, so ${findings.added.length === 1 ? 'it is' : 'they are'} excluded for now. Decide whether ${findings.added.length === 1 ? 'it is' : 'each is'} precise enough for question generation (8-bit or higher) or a compressed copy, then:`,
      '',
      '- **To allow it:** add it to `AI_ALLOWED_QUANTIZATIONS` in `src/constants.js` and to `ALLOWED_PRECISIONS` in `docs-site/docs/_workflow-wizard/modelCatalog.js`.',
      '- **To keep it excluded:** add it to `AI_EXCLUDED_QUANTIZATIONS` in `src/constants.js`.',
      '- Either way, add it to the table in `docs-site/docs/ai-providers/openrouter.md#compressed-models`.',
      '',
    );
  }

  if (findings.retired.length > 0) {
    lines.push(
      `Also no longer listed, and harmless because they're never sent: ${code(findings.retired)}. Remove ${findings.retired.length === 1 ? 'it' : 'them'} from \`AI_EXCLUDED_QUANTIZATIONS\` when convenient.`,
      '',
    );
  }

  lines.push('_Posted by the `check-openrouter-quantizations` workflow._');
  return lines.join('\n');
}

/** The Markdown report when the spec couldn't be fetched or read. */
export function formatFailure(error, { specUrl = SPEC_URL } = {}) {
  return [
    '<!-- quantization-check: failed -->',
    `The weekly check couldn't read the quantization levels from OpenRouter's [API spec](${specUrl}): ${error.message}`,
    '',
    "If this persists, OpenRouter may have moved or restructured its spec. Update `SPEC_URL` or `extractQuantizations` in `scripts/check-openrouter-quantizations.js`. Until then, nothing warns about changes to OpenRouter's quantization levels.",
    '',
    '_Posted by the `check-openrouter-quantizations` workflow._',
  ].join('\n');
}

/** Writes key=value pairs for the workflow, when run as an Actions step. */
function setOutputs(outputs) {
  if (!process.env.GITHUB_OUTPUT) return;
  const text = Object.entries(outputs)
    .map(([k, v]) => `${k}=${v}\n`)
    .join('');
  appendFileSync(process.env.GITHUB_OUTPUT, text);
}

async function main(reportPath) {
  let published;
  try {
    const response = await fetch(SPEC_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${SPEC_URL}`);
    published = extractQuantizations(await response.json());
  } catch (error) {
    writeFileSync(reportPath, formatFailure(error));
    setOutputs({ attention: true, fingerprint: 'failed' });
    console.error(`Could not check OpenRouter's quantization levels: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const findings = compareQuantizations(published);
  console.log(`OpenRouter lists: ${published.join(', ')}`);
  console.log(`New: ${findings.added.join(', ') || 'none'}`);
  console.log(`Allowed but no longer listed: ${findings.removed.join(', ') || 'none'}`);
  console.log(`Excluded and no longer listed: ${findings.retired.join(', ') || 'none'}`);

  if (findings.attention) writeFileSync(reportPath, formatReport(findings));
  setOutputs({ attention: findings.attention, fingerprint: fingerprint(findings) });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(process.argv[2] || DEFAULT_REPORT_PATH);
}
