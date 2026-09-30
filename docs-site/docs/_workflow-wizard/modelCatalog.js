/**
 * OpenRouter's model catalogue, for the AI step: the searchable list behind
 * "Own Choice", which reasoning levels a model supports, what it does by
 * default, and what it costs.
 *
 * Fetched live from OpenRouter's public, keyless API once per page load, in
 * OpenRouter's own `{ data: [model, …] }` shape. If it cannot be reached the
 * step still works: the picker says so and the Reasoning dropdown lists every
 * level.
 */

import { useEffect, useState } from 'react';

const CATALOG_URL = 'https://openrouter.ai/api/v1/models';

/**
 * Every ai_reasoning_effort value, in the order the dropdown lists them. Mirrors
 * AI_REASONING_EFFORTS in the action's src/constants.js — keep the two in step.
 * `none` is offered as "Off"; the rest are OpenRouter's effort levels.
 */
export const REASONING_LEVELS = [
  { value: 'default', label: 'Model default' },
  { value: 'none', label: 'Off' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'Extra high' },
  { value: 'max', label: 'Maximum' },
];

/**
 * Whether `effort` asks for more reasoning than the model's default, which costs
 * more. False when the default isn't known, since there is nothing to compare.
 */
export function isAboveDefaultEffort(effort, defaultEffort) {
  const rank = (value) => REASONING_LEVELS.findIndex((l) => l.value === value);
  if (effort === 'default' || rank(defaultEffort) < 1) return false;
  return rank(effort) > rank(defaultEffort);
}

export function levelLabel(value) {
  return REASONING_LEVELS.find((l) => l.value === value)?.label ?? value;
}

// One request per page load, shared by every mount of the AI step, so going
// back to it never fetches again.
let catalogRequest = null;
let latest = { status: 'loading' };

function fetchCatalog() {
  return fetch(CATALOG_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`${response.status}`);
      return response.json();
    })
    .then((json) => {
      const models = new Map();
      for (const model of Array.isArray(json?.data) ? json.data : []) {
        if (model && typeof model.id === 'string') models.set(model.id, model);
      }
      if (models.size === 0) throw new Error('empty catalogue');
      return { status: 'ready', models };
    });
}

/**
 * The catalogue as `{ status: 'loading' | 'ready' | 'unavailable', models }`,
 * where `models` is a Map from model ID to OpenRouter's record.
 */
export function useModelCatalog() {
  const [catalog, setCatalog] = useState(latest);

  useEffect(() => {
    let active = true;
    catalogRequest ??= fetchCatalog();
    catalogRequest
      .catch(() => ({ status: 'unavailable' }))
      .then((next) => {
        latest = next;
        if (active) setCatalog(next);
      });
    return () => {
      active = false;
    };
  }, []);

  return catalog;
}

/**
 * The catalogue record for a model ID, or null. Tries the ID as typed first —
 * some suffixed IDs, such as `:free` ones, are catalogue entries of their own —
 * then without its last `:suffix`, which covers the `:nitro` and `:floor`
 * routing variants.
 */
export function lookupModel(catalog, modelId) {
  if (catalog.status !== 'ready' || !modelId) return null;
  const id = modelId.trim();
  if (catalog.models.has(id)) return catalog.models.get(id);
  const colon = id.lastIndexOf(':');
  return colon > 0 ? (catalog.models.get(id.slice(0, colon)) ?? null) : null;
}

/** Describes what a model does when no reasoning level is sent. */
function describeDefault(reasoning) {
  if (reasoning.default_enabled === false) return 'off unless you choose a level';
  if (reasoning.default_effort) {
    return `reasons at ${levelLabel(reasoning.default_effort).toLowerCase()} effort`;
  }
  if (reasoning.mandatory) return 'always reasons';
  return 'the model decides';
}

/**
 * The reasoning levels to offer for a catalogue record.
 *
 * Returns `{ options, known, reasons, defaultEffort, note }`: `options` for the
 * dropdown, `known` false when there is no record to go by (every level is then
 * offered), `reasons` false for a model that does not reason at all, and
 * `defaultEffort` the level the model uses when none is sent, if the catalogue
 * says.
 *
 * "Off" is offered unless reasoning is mandatory — OpenRouter rejects it for
 * such a model — even when `none` is missing from the model's efforts: it is
 * sent as `enabled: false`, which Claude Sonnet 5, for one, accepts without
 * listing `none`.
 */
export function reasoningOptions(model) {
  if (!model) {
    return { options: REASONING_LEVELS, known: false, reasons: true, defaultEffort: null, note: '' };
  }
  const reasoning = model.reasoning;
  if (!reasoning) {
    return {
      options: [REASONING_LEVELS[0]],
      known: true,
      reasons: false,
      defaultEffort: null,
      note: "This model doesn't reason, so there's nothing to set.",
    };
  }

  const efforts = Array.isArray(reasoning.supported_efforts) ? reasoning.supported_efforts : [];
  const options = [
    { value: 'default', label: `Model default — ${describeDefault(reasoning)}` },
    ...(reasoning.mandatory ? [] : [REASONING_LEVELS[1]]),
    ...REASONING_LEVELS.slice(2).filter((l) => efforts.includes(l.value)),
  ];

  const notes = [];
  if (reasoning.mandatory) notes.push("This model always reasons, so it can't be switched off.");
  if (efforts.filter((e) => e !== 'none').length === 0) {
    notes.push(
      reasoning.mandatory
        ? 'OpenRouter lists no effort levels for it, so the model chooses how much.'
        : 'OpenRouter lists no effort levels for it, so it can only be left at its default or switched off.',
    );
  }

  return {
    options,
    known: true,
    reasons: true,
    defaultEffort: reasoning.default_enabled === false ? 'none' : (reasoning.default_effort ?? null),
    note: notes.join(' '),
  };
}

/** A per-token price string as dollars per million tokens, or null if unusable. */
function perMillion(price) {
  const value = Number(price) * 1_000_000;
  if (!Number.isFinite(value) || value < 0) return null;
  return formatDollars(value);
}

/**
 * The model's input and output price per million tokens, or null when the
 * catalogue has no usable figures (OpenRouter's routers list negative prices).
 */
export function modelPricing(model) {
  if (!model?.pricing) return null;
  const input = perMillion(model.pricing.prompt);
  const output = perMillion(model.pricing.completion);
  if (!input || !output) return null;
  return { input, output, free: input === '$0' && output === '$0' };
}

// ── Model picker ─────────────────────────────────────────────────────────────

/**
 * Whether OpenRouter can hold the model to GrillMyCode's JSON schema. Models
 * without it still work, but return unusable replies more often.
 */
function hasStructuredOutputs(model) {
  return (model.supported_parameters ?? []).includes('structured_outputs');
}

/** A short description of the model's reasoning for a picker row. */
function reasoningSummary(reasoning) {
  if (!reasoning) return 'No reasoning';
  if (reasoning.default_enabled === false) return 'Reasoning off by default';
  if (reasoning.default_effort) {
    return `Reasons at ${levelLabel(reasoning.default_effort).toLowerCase()} by default`;
  }
  return reasoning.mandatory ? 'Always reasons' : 'Reasons by default';
}

/**
 * Smallest context window the list offers. A small script's run sends about
 * 20K tokens; codebase context, the assignment brief and a large diff can
 * multiply that, and a prompt past the window fails the run.
 */
export const MIN_CONTEXT_TOKENS = 128_000;

/**
 * Smallest output limit the list offers. A 20-question reply is about 4–5K
 * tokens, and reasoning counts against the same limit; a reply that reaches it
 * stops part-way and the run fails.
 */
export const MIN_OUTPUT_TOKENS = 16_000;

/** How recent "Released in the last year" means, in days. */
export const RECENT_DAYS = 365;

/**
 * Why a model is unsuitable for GrillMyCode whatever the instructor wants, as
 * sentences for the Model field — empty when there is nothing to say. Models
 * with any of these problems are left out of the list; this also covers one
 * typed by hand or chosen from the dropdown.
 *
 * A model with an expiry date is flagged whatever the date: OpenRouter sets
 * one only for a model it plans to remove, and an assessment set up now runs
 * all term.
 */
export function modelConcerns(model) {
  if (!model) return [];
  const concerns = [];
  const outputs = model.architecture?.output_modalities;
  if (Array.isArray(outputs) && !(outputs.length === 1 && outputs[0] === 'text')) {
    concerns.push("This model doesn't answer in text only, so it may not return usable questions.");
  }
  if (typeof model.context_length === 'number' && model.context_length < MIN_CONTEXT_TOKENS) {
    concerns.push(
      `Its context window is ${formatContext(model.context_length)} tokens, which a large submission can exceed.`,
    );
  }
  const maxOutput = model.top_provider?.max_completion_tokens;
  if (typeof maxOutput === 'number' && maxOutput < MIN_OUTPUT_TOKENS) {
    concerns.push(
      `It can write at most ${formatContext(maxOutput)} tokens per reply, which a full set of questions, plus any reasoning, can exceed.`,
    );
  }
  if (model.expiration_date) {
    concerns.push(`OpenRouter plans to retire it on ${model.expiration_date}.`);
  }
  return concerns;
}

/**
 * The catalogue as picker rows.
 *
 * Always left out:
 * - models modelConcerns flags: not text-only, too small a context window or
 *   output limit, or due to be retired;
 * - entries that can change which model answers during a term — OpenRouter's
 *   own routers (`openrouter/…`) and `~…-latest` aliases;
 * - `:batch` entries, each a second listing of a model that is also listed
 *   under its own ID;
 * - models without usable prices (the routers list negative ones).
 * `:free` entries are kept, since cost is what most instructors pick on.
 *
 * Left out on request: models without structured outputs (`structuredOnly`),
 * ones released more than RECENT_DAYS ago (`recentOnly`), ones whose output
 * price is outside `minOutputPrice` to `maxOutputPrice` dollars per million
 * tokens (either end may be null, for no limit), and ones that are not free
 * (`freeOnly`).
 */
export function pickerModels(
  catalog,
  {
    structuredOnly = true,
    recentOnly = true,
    maxOutputPrice = null,
    minOutputPrice = null,
    freeOnly = false,
  } = {},
) {
  if (catalog.status !== 'ready') return [];
  const releasedAfter = Date.now() / 1000 - RECENT_DAYS * 24 * 60 * 60;
  const rows = [];
  for (const model of catalog.models.values()) {
    if (!Array.isArray(model.architecture?.output_modalities)) continue;
    if (modelConcerns(model).length > 0) continue;
    if (model.id.startsWith('openrouter/') || model.id.startsWith('~')) continue;
    if (model.id.endsWith(':batch')) continue;
    const pricing = modelPricing(model);
    if (!pricing) continue;

    const structured = hasStructuredOutputs(model);
    if (structuredOnly && !structured) continue;
    if (recentOnly && !(model.created >= releasedAfter)) continue;
    const outputPrice = Number(model.pricing.completion);
    if (maxOutputPrice !== null && outputPrice * 1_000_000 > maxOutputPrice) continue;
    if (minOutputPrice !== null && outputPrice * 1_000_000 < minOutputPrice) continue;
    if (freeOnly && !pricing.free) continue;

    const codingIndex = model.benchmarks?.artificial_analysis?.coding_index;
    rows.push({
      id: model.id,
      name: model.name || model.id,
      pricing,
      inputPrice: Number(model.pricing.prompt),
      outputPrice,
      reasoning: reasoningSummary(model.reasoning),
      codingIndex: typeof codingIndex === 'number' ? codingIndex : null,
      contextLength: typeof model.context_length === 'number' ? model.context_length : null,
      structured,
      search: `${model.id} ${model.name ?? ''}`.toLowerCase(),
    });
  }
  return rows;
}

/**
 * Every distinct output price in the picker, in dollars per million tokens and
 * ascending: the stops of its price slider. Taken with no optional filter on,
 * so the slider's ends don't move as filters change.
 */
export function outputPriceSteps(catalog) {
  const prices = pickerModels(catalog, { structuredOnly: false, recentOnly: false }).map(
    (row) => row.outputPrice * 1_000_000,
  );
  return [...new Set(prices)].sort((a, b) => a - b);
}

export const PICKER_SORTS = [
  { value: 'coding', label: 'Highest coding score first' },
  { value: 'price', label: 'Cheapest output first' },
  { value: 'name', label: 'Name' },
];

/**
 * Filters picker rows to those containing every word of `query`, in their ID
 * or name, and sorts them. Output price leads the price sort because output —
 * reasoning included — is usually most of what a run is billed for. Models
 * without a coding score sort after those with one.
 */
export function searchModels(rows, query, sort) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matched = rows.filter((r) => words.every((w) => r.search.includes(w)));
  const byName = (a, b) => a.name.localeCompare(b.name);
  const compare = {
    price: (a, b) => a.outputPrice - b.outputPrice || a.inputPrice - b.inputPrice || byName(a, b),
    coding: (a, b) =>
      (b.codingIndex ?? -1) - (a.codingIndex ?? -1) || a.outputPrice - b.outputPrice,
    name: byName,
  }[sort] ?? byName;
  return matched.sort(compare);
}

/** "128K" or "1M" tokens of context, or null. */
export function formatContext(tokens) {
  if (!tokens) return null;
  if (tokens >= 1_000_000) return `${Number((tokens / 1_000_000).toPrecision(2))}M`;
  return `${Math.round(tokens / 1000)}K`;
}

// ── Providers per model (routing) ────────────────────────────────────────────

/**
 * Precisions that count as a compressed copy of a model. fp8 is not one: many
 * models are released at fp8, and their makers serve them that way, so only
 * precisions below it are flagged.
 */
const COMPRESSED_PRECISIONS = ['fp6', 'fp4', 'int4'];

// One request per model per page load, shared across mounts.
const endpointRequests = new Map();

function fetchEndpoints(modelId) {
  if (!endpointRequests.has(modelId)) {
    const url = `https://openrouter.ai/api/v1/models/${modelId}/endpoints`;
    endpointRequests.set(
      modelId,
      fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error(`${response.status}`);
          return response.json();
        })
        .then((json) => {
          const endpoints = json?.data?.endpoints;
          if (!Array.isArray(endpoints) || endpoints.length === 0) throw new Error('no endpoints');
          return endpoints;
        }),
    );
  }
  return endpointRequests.get(modelId);
}

/**
 * The providers serving a model, fetched live from OpenRouter when `modelId`
 * (a catalogue ID, routing variant removed) changes: `{ status: 'idle' |
 * 'loading' | 'ready' | 'unavailable', endpoints }`. The routing step simply
 * says less when this fails.
 */
export function useModelEndpoints(modelId) {
  const [state, setState] = useState({ status: 'idle', modelId: null });

  useEffect(() => {
    if (!modelId) return undefined;
    let active = true;
    setState({ status: 'loading', modelId });
    fetchEndpoints(modelId).then(
      (endpoints) => active && setState({ status: 'ready', modelId, endpoints }),
      () => active && setState({ status: 'unavailable', modelId }),
    );
    return () => {
      active = false;
    };
  }, [modelId]);

  // A result for the previous model is never shown against the new one.
  return state.modelId === modelId ? state : { status: modelId ? 'loading' : 'idle' };
}

/**
 * The tier an endpoint belongs to, read from the end of its tag
 * (`google-vertex/global/flex`, `google-ai-studio/priority`). Balanced routing
 * uses standard endpoints; `:floor` also lets flex ones compete and `:nitro`
 * priority ones — see MODEL_ROUTING_VARIANTS in generateYaml.js.
 */
function endpointTier(endpoint) {
  const tag = typeof endpoint.tag === 'string' ? endpoint.tag : '';
  if (tag.endsWith('/flex')) return 'flex';
  if (tag.endsWith('/priority')) return 'priority';
  return 'standard';
}

function outputPrice(endpoint) {
  const value = Number(endpoint.pricing?.completion) * 1_000_000;
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * What each routing option means for this model's providers, from its
 * endpoint list. Prices are output prices in dollars per million tokens:
 *
 * - `providers`: how many distinct providers serve the model
 * - `balanced`: `{ min, max }` across standard endpoints
 * - `floor`: the cheapest standard or flex endpoint, its precision, and
 *   whether that precision is compressed
 * - `nitro`: the dearest standard or priority endpoint — OpenRouter reports no
 *   speeds to say which is fastest, so this is the most `:nitro` can cost
 * - `compressed`: how many endpoints run a compressed copy, whether any is a
 *   standard one Balanced can pick, and which precisions
 *
 * Returns null when no endpoint has a usable price.
 */
export function routingSummary(endpoints) {
  const priced = endpoints
    .map((e) => ({ price: outputPrice(e), tier: endpointTier(e), quantization: e.quantization }))
    .filter((e) => e.price !== null);
  if (priced.length === 0) return null;

  const standard = priced.filter((e) => e.tier === 'standard');
  const balancedPool = standard.length > 0 ? standard : priced;
  const floorPool = priced.filter((e) => e.tier !== 'priority');
  const nitroPool = priced.filter((e) => e.tier !== 'flex');
  const cheapest = [...(floorPool.length ? floorPool : priced)].sort((a, b) => a.price - b.price)[0];
  const compressed = priced.filter((e) => COMPRESSED_PRECISIONS.includes(e.quantization));

  return {
    providers: new Set(endpoints.map((e) => e.provider_name)).size,
    endpoints: priced.length,
    balanced: {
      min: Math.min(...balancedPool.map((e) => e.price)),
      max: Math.max(...balancedPool.map((e) => e.price)),
    },
    floor: {
      price: cheapest.price,
      quantization: cheapest.quantization,
      compressed: COMPRESSED_PRECISIONS.includes(cheapest.quantization),
    },
    nitro: { price: Math.max(...(nitroPool.length ? nitroPool : priced).map((e) => e.price)) },
    compressed: {
      count: compressed.length,
      balanced: compressed.filter((e) => e.tier === 'standard').length > 0,
      precisions: [...new Set(compressed.map((e) => e.quantization))].sort(),
    },
  };
}

/** A dollars-per-million-tokens amount as the Wizard shows it. */
export function formatDollars(value) {
  if (value === 0) return '$0';
  return `$${value >= 0.1 ? value.toFixed(2) : Number(value.toPrecision(2))}`;
}
