/**
 * Saves a trimmed copy of OpenRouter's model catalogue for the Workflow Wizard.
 *
 * Writes static/data/openrouter-models.json, which the Wizard's AI step shows
 * immediately and falls back to when OpenRouter's live catalogue cannot be
 * reached — see docs/_workflow-wizard/modelCatalog.js, which reads it. The file
 * is generated, not committed: deploy-docs.yml runs this before every build,
 * including a nightly one, so the copy on the site is at most a day old.
 *
 * Never fails the build. If OpenRouter is unreachable the file is simply not
 * written, and the Wizard relies on the live catalogue alone.
 *
 * Usage (from docs-site/): node scripts/fetch-openrouter-models.mjs
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const URL = 'https://openrouter.ai/api/v1/models';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'static', 'data', 'openrouter-models.json');
const TIMEOUT_MS = 30_000;

/** The supported_parameters modelCatalog.js checks; the rest are dropped. */
const KEPT_PARAMETERS = ['structured_outputs', 'response_format'];

/** Only the fields modelCatalog.js reads, in OpenRouter's own shape. */
function trim(model) {
  const codingIndex = model.benchmarks?.artificial_analysis?.coding_index;
  return {
    id: model.id,
    name: model.name,
    created: model.created,
    expiration_date: model.expiration_date ?? null,
    context_length: model.context_length,
    top_provider: { max_completion_tokens: model.top_provider?.max_completion_tokens ?? null },
    architecture: { output_modalities: model.architecture?.output_modalities },
    pricing: { prompt: model.pricing?.prompt, completion: model.pricing?.completion },
    supported_parameters: (model.supported_parameters ?? []).filter((p) =>
      KEPT_PARAMETERS.includes(p),
    ),
    ...(model.reasoning ? { reasoning: model.reasoning } : {}),
    ...(typeof codingIndex === 'number'
      ? { benchmarks: { artificial_analysis: { coding_index: codingIndex } } }
      : {}),
  };
}

try {
  const response = await fetch(URL, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const { data } = await response.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error('the catalogue was empty');

  const models = data.filter((m) => m && typeof m.id === 'string').map(trim);
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({ fetchedAt: new Date().toISOString(), data: models }));
  console.log(`Saved ${models.length} OpenRouter models to ${OUT}`);
} catch (error) {
  // ::warning:: surfaces on the Actions run page; locally it is just a line.
  console.log(
    `::warning::Could not save OpenRouter's model catalogue (${error.message}). ` +
      'The Workflow Wizard will use the live catalogue only.',
  );
}
