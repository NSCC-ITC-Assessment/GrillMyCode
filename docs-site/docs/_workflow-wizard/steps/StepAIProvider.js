import React, { useEffect, useState } from 'react';
import styles from '../styles.module.css';
import ModelPicker from './ModelPicker';
import {
  effectiveAiModel,
  TEMPERATURE_MAX,
  TEMPERATURE_MIN,
  TEMPERATURE_STEP,
  temperatureError,
} from '../generateYaml';
import {
  formatDollars,
  isAboveDefaultEffort,
  levelLabel,
  lookupModel,
  modelConcerns,
  modelPricing,
  reasoningOptions,
  routingSummary,
  useModelCatalog,
  useModelEndpoints,
} from '../modelCatalog';

/** @import { StepProps } from '../index' */

// OpenRouter is currently the only supported provider, so the wizard no longer
// offers a provider choice — it configures the model and the API key secret.
// The first entry is the action's default model.
const OPENROUTER_MODELS = [
  { label: 'Google Gemini 3.5 Flash Lite — Recommended', value: 'google/gemini-3.5-flash-lite' },
  { label: 'OpenAI GPT-6 Luna Pro', value: 'openai/gpt-6-luna-pro' },
  { label: 'Deepseek V4 Flash', value: 'deepseek/deepseek-v4-flash' },
  { label: 'Minimax 2.7', value: 'minimax/minimax-m2.7' },
  { label: 'Step 3.7 Flash', value: 'stepfun/step-3.7-flash' },
  { label: 'Tencent Hy3', value: 'tencent/hy3' },
  { label: 'Xiaomi Mimo V2.5 Pro', value: 'xiaomi/mimo-v2.5-pro' },
];

// OpenRouter routing variants, appended to the model ID as a `:suffix`. They
// change which provider serves the model, not which model it is. Providers
// running a compressed copy (fp4, for example) are never used — the action
// sends an allow-list of precisions — so routingSummary leaves them out of the
// prices. Empty is the default: OpenRouter balances price, uptime and speed on
// its own.
const MODEL_VARIANTS = [
  {
    value: '',
    label: 'Balanced — let OpenRouter choose (recommended)',
    hint: 'OpenRouter picks among the providers serving your model, favouring good uptime and lower price.',
  },
  {
    value: 'nitro',
    label: 'Speed — :nitro',
    hint: 'Tries the fastest providers first (highest tokens per second) and allows their paid priority tiers. Useful when a whole class submits at once. This option is worth considering if you like the model output but receiving output takes inordinately long. It is suggested to review pricing before use as prices may be higher.',
  },
  {
    value: 'floor',
    label: 'Lowest cost — :floor',
    hint: 'Tries the cheapest providers first and allows their discounted flex tiers, which can be slower or queue at busy times.',
  },
];

/**
 * What each routing option means for the chosen model's providers. A model with
 * no usable provider is warned about under the model field instead, where it
 * can't be hidden by a collapsed section.
 */
function RoutingNotes({ routing }) {
  if (routing.unusable) return null;
  const { balanced, floor, nitro, skipped } = routing;
  const balancedPrice =
    balanced.min === balanced.max
      ? formatDollars(balanced.min)
      : `${formatDollars(balanced.min)}–${formatDollars(balanced.max)}`;
  const hint = { marginTop: '0.4rem' };

  return (
    <>
      <span className={styles.hint} style={hint}>
        {routing.providers === 1
          ? 'One provider serves this model'
          : `${routing.providers} providers serve this model`}
        , live from OpenRouter. Output per million tokens: Lowest cost from{' '}
        {formatDollars(floor.price)} · Balanced {balancedPrice} · Speed up to{' '}
        {formatDollars(nitro.price)}.
      </span>
      {routing.endpoints === 1 ? (
        <span className={styles.hint} style={hint}>
          With a single provider, routing makes no difference.
        </span>
      ) : (
        nitro.price <= floor.price * 1.1 && (
          <span className={styles.hint} style={hint}>
            Its providers charge about the same, so the choice makes little difference to cost.
          </span>
        )
      )}
      {skipped.count > 0 && (
        <span className={styles.hint} style={hint}>
          {skipped.count === 1
            ? '1 endpoint runs a compressed copy'
            : `${skipped.count} endpoints run a compressed copy`}{' '}
          of the model ({skipped.precisions.join(', ')}), which can write weaker questions.
          GrillMyCode never uses them, so they aren't counted in these prices.
        </span>
      )}
    </>
  );
}

/** @param {StepProps} props */
export default function StepAIProvider({ cfg, onChange, docsBase = '/docs' }) {
  const modelUnchosen = cfg.aiModel === null;
  const isKnownModel = OPENROUTER_MODELS.some((m) => m.value === cfg.aiModel);
  const modelTrimmed = (cfg.aiModel || '').trim();
  const modelEmpty = !modelTrimmed;
  const secretEmpty = !(cfg.apiKeySecret || '').trim();
  const variant = cfg.aiModelVariant || '';
  const selectedVariant = MODEL_VARIANTS.find((v) => v.value === variant) || MODEL_VARIANTS[0];
  const resolvedModel = effectiveAiModel({ ...cfg, aiProvider: 'openrouter' });

  const catalog = useModelCatalog();
  const modelUsable = !modelEmpty;
  const modelInfo = modelUsable ? lookupModel(catalog, modelTrimmed) : null;
  const reasoning = reasoningOptions(modelInfo);
  const pricing = modelPricing(modelInfo);
  const concerns = modelConcerns(modelInfo);
  const endpoints = useModelEndpoints(modelInfo?.id ?? null);
  const routing = endpoints.status === 'ready' ? routingSummary(endpoints.endpoints) : null;
  if (routing?.unusable) {
    concerns.push(
      `Every provider of this model runs a compressed copy (${routing.skipped.precisions.join(', ')}), ` +
        'which GrillMyCode never uses, so every run with it would fail. Choose another model.',
    );
  }
  const concernNote = concerns.length > 0 && (
    <span
      className={styles.hint}
      style={{ marginTop: '0.4rem', color: 'var(--ifm-color-warning-contrast-foreground)' }}
    >
      ⚠️ {concerns.join(' ')}
    </span>
  );
  const effort = cfg.aiReasoningEffort || 'default';
  const allowedEfforts = reasoning.options.map((o) => o.value).join(',');

  const tempEnabled = !!cfg.aiTemperatureEnabled;
  const tempError = temperatureError(cfg);

  const advancedChanged = [
    effort !== 'default',
    variant !== '',
    tempEnabled,
  ].filter(Boolean).length;
  const [advancedOpen, setAdvancedOpen] = useState(advancedChanged > 0);

  // A level the newly chosen model does not offer falls back to its default,
  // rather than staying selected but invisible in the dropdown.
  useEffect(() => {
    if (!allowedEfforts.split(',').includes(effort)) onChange({ aiReasoningEffort: 'default' });
  }, [allowedEfforts, effort]);

  return (
    <div>
      <div className={styles.fieldGroup}>
        <label className={styles.label}>AI provider - OpenRouter</label>
        <span className={styles.hint}>
          GrillMyCode generates questions through{' '}
          <a href="https://openrouter.ai/" target="_blank" rel="noopener noreferrer">
            OpenRouter
          </a>
          , a single gateway to models from Anthropic, Google, DeepSeek, Meta, Mistral and others.
          It is the only supported provider, so there is nothing to choose here — pick your model
          below.
        </span>
      </div>

      <div
        className={styles.notice}
        style={{ borderLeftColor: 'var(--ifm-color-warning, #f59e0b)' }}
      >
        <details>
          <summary style={{ cursor: 'pointer' }}>
            <strong>📌 Reminders about cost and OpenRouter</strong>
          </summary>
          <div style={{ marginTop: '0.75rem' }}>
            <strong>💸 Cost</strong>
            <br />
            OpenRouter charges per token based on the model you select. Pricing varies significantly
            between models — some are free, others can be expensive at scale. The pre-defined models
            in the list below were chosen partly for their low cost when tested, and have been
            tested to work well with GrillMyCode. An assessment can cost{' '}
            <strong>less than one cent</strong>, but the cost can rise sharply with the model, its
            reasoning setting and how much code is assessed.
            <br />
            <br />
            <strong>Estimating what it will cost your class is your responsibility.</strong> Before
            rolling it out, do a few trial runs with the settings you'll use and check their cost in
            your OpenRouter account.{' '}
            <a
              href={`${docsBase}/guides/choosing-a-model#estimate-your-cost-with-trial-runs`}
              target="_blank"
              rel="noopener noreferrer"
            >
              How to estimate your cost →
            </a>
            <br />
            <br />
            <strong>📡 Model details change constantly</strong>
            <br />
            The model list, prices, reasoning levels and providers on this step come from
            OpenRouter, where models are added and retired and prices, defaults and providers change
            all the time, sometimes daily. What you see is how things stood when
            this page loaded. Treat it as a guide: confirm your model's details on{' '}
            <a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer">
              openrouter.ai/models
            </a>{' '}
            before deploying, and check again before each new term.
            <br />
            <br />
            <a
              href={`${docsBase}/ai-providers/openrouter`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Read more about OpenRouter setup here →
            </a>
          </div>
        </details>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>API key secret name</label>
        <span className={styles.hint}>
          The name of the org-level GitHub Actions secret that holds your OpenRouter API key. Enter
          just the secret name (e.g. <code>OPENROUTER_API_KEY</code>) — the workflow will reference
          it as <code>{'${{ secrets.YOUR_SECRET }}'}</code>. This is required: OpenRouter cannot use
          the built-in <code>GITHUB_TOKEN</code>.
        </span>
        <input
          type="text"
          className={styles.input}
          style={{ borderColor: secretEmpty ? 'var(--ifm-color-danger)' : undefined }}
          value={cfg.apiKeySecret || ''}
          onChange={(e) => onChange({ apiKeySecret: e.target.value })}
          placeholder="OPENROUTER_API_KEY"
        />
        {secretEmpty && (
          <span
            style={{
              fontSize: '0.78rem',
              color: 'var(--ifm-color-danger)',
              marginTop: '0.3rem',
              display: 'block',
            }}
          >
            Please enter the name of the secret holding your OpenRouter API key.
          </span>
        )}
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Select your model</label>
        <span className={styles.hint}>
          Select a pre-tested model, or choose "Own Choice" to pick one from OpenRouter's
          catalogue.
        </span>
        <select
          className={styles.select}
          style={{ borderColor: modelUnchosen ? 'var(--ifm-color-danger)' : undefined }}
          value={modelUnchosen ? '' : isKnownModel ? (cfg.aiModel ?? '') : '__custom__'}
          onChange={(e) => {
            if (e.target.value !== '__custom__') onChange({ aiModel: e.target.value });
            else onChange({ aiModel: '' });
          }}
        >
          {/* Nothing is chosen for the instructor, so the cost of the model is
              a decision they make. Disabled so it can't be chosen again. */}
          <option value="" disabled>
            Select Model…
          </option>
          {OPENROUTER_MODELS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label} ({m.value})
            </option>
          ))}
          <option value="__custom__">Own Choice…</option>
        </select>
        {modelUnchosen && (
          <span
            style={{
              fontSize: '0.78rem',
              color: 'var(--ifm-color-danger)',
              marginTop: '0.3rem',
              display: 'block',
            }}
          >
            Please select a model before continuing.
          </span>
        )}
        {isKnownModel && concernNote}
        {!modelUnchosen && !isKnownModel && (
          <>
            {/* Picked from OpenRouter's list rather than typed, so the ID always
                exists and the model can handle a full assessment. */}
            {modelEmpty && (
              <span
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--ifm-color-danger)',
                  marginTop: '0.3rem',
                  display: 'block',
                }}
              >
                Please select a model from the list below before continuing.
              </span>
            )}
            {concernNote}
            <ModelPicker
              catalog={catalog}
              selectedId={modelInfo?.id ?? null}
              testedIds={OPENROUTER_MODELS.map((m) => m.value)}
              onPick={(id) => onChange({ aiModel: id })}
            />
          </>
        )}
        {modelUsable && (
          <div
            style={{
              marginTop: '1.5rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid var(--ifm-color-emphasis-300)',
              fontSize: '1.05rem',
            }}
          >
            <strong style={{ display: 'block', fontSize: '1.15rem', marginBottom: '0.3rem' }}>
              Currently Selected Model:
            </strong>
            {modelInfo && modelInfo.name !== modelInfo.id && (
              <>
                <strong>{modelInfo.name}</strong>{' '}
              </>
            )}
            <code>{modelInfo?.id ?? modelTrimmed}</code>
            {/* Linked only when the catalogue knows the model, so the link is
                OpenRouter's own ID (routing variant removed) and never a guess. */}
            {modelInfo && (
              <>
                {' '}
                <a
                  href={`https://openrouter.ai/${modelInfo.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                >
                  Model details on OpenRouter ↗
                </a>
              </>
            )}
          </div>
        )}
        {pricing && (
          <span className={styles.hint} style={{ marginTop: '0.4rem' }}>
            {pricing.free ? (
              <>This model is free on OpenRouter</>
            ) : (
              <>
                {modelInfo.name || modelTrimmed}: {pricing.input} per million input tokens,{' '}
                {pricing.output} per million output tokens, which include any reasoning
              </>
            )}{' '}
            (live from OpenRouter).
          </span>
        )}
      </div>

      {/* Every setting here depends on the chosen model, so it waits for one. */}
      {modelUsable && (
        <div className={styles.fieldGroup} style={{ marginTop: '1.75rem' }}>
          <button
            type="button"
            className={styles.disclosureBtn}
            onClick={() => setAdvancedOpen((o) => !o)}
            aria-expanded={advancedOpen}
            aria-controls="model-advanced-settings"
          >
            <span
              className={`${styles.disclosureChevron} ${advancedOpen ? styles.disclosureChevronOpen : ''}`}
              aria-hidden="true"
            >
              ▶
            </span>
            <span className={styles.disclosureTitle}>Advanced settings</span>
            {advancedChanged > 0 ? (
              <span className={styles.disclosureCount}>{advancedChanged} changed</span>
            ) : (
              <span className={styles.optionalBadge} style={{ marginLeft: 0 }}>optional</span>
            )}
          </button>
          <div id="model-advanced-settings" hidden={!advancedOpen} style={{ marginTop: '1rem' }}>
            <span className={styles.hint} style={{ marginBottom: '1rem' }}>
              Each of these starts at a default that suits most assignments. Only change one if you
              know how it will affect the questions or the cost.
            </span>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Reasoning</label>
              <span className={styles.hint}>
                Many models think before they answer. That thinking is billed as output, so it can
                multiply what each run costs several times over, and more of it doesn't always mean
                better questions. Some models do a lot of it unless told otherwise.
              </span>
              <select
                className={styles.select}
                value={effort}
                disabled={reasoning.options.length < 2}
                onChange={(e) => onChange({ aiReasoningEffort: e.target.value })}
              >
                {reasoning.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {modelUsable && (
                <span className={styles.hint} style={{ marginTop: '0.4rem' }}>
                  {catalog.status === 'loading' && "Checking OpenRouter's catalogue for this model…"}
                  {catalog.status === 'unavailable' &&
                    "OpenRouter's catalogue couldn't be reached, so every level is listed. A level the model doesn't support is mapped to its nearest one, and Off fails the run on a model that always reasons."}
                  {catalog.status === 'ready' &&
                    !modelInfo &&
                    "This model isn't in OpenRouter's catalogue, so every level is listed. Check the model ID."}
                  {reasoning.note}
                </span>
              )}
              {reasoning.known &&
                !pricing?.free &&
                isAboveDefaultEffort(effort, reasoning.defaultEffort) && (
                <span className={styles.hint} style={{ marginTop: '0.4rem' }}>
                  ⚠️ This is more reasoning than the model's default (
                  {levelLabel(reasoning.defaultEffort)}), which will likely require more tokens and
                  therefore result in a higher overall cost. Do a trial run and compare the questions
                  with the model default before settling on it.
                </span>
              )}
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Model routing</label>
              <span className={styles.hint}>
                Most models are served by several providers, which differ in speed and price.
                Optionally add an OpenRouter{' '}
                <a
                  href="https://openrouter.ai/docs/guides/routing/model-variants/overview"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  routing variant
                </a>{' '}
                to the model ID to say which of them should be tried first. This changes the
                provider, not the model. Providers that run a compressed copy of the model are
                never used, whichever you choose.
              </span>
              <select
                className={styles.select}
                value={variant}
                onChange={(e) => onChange({ aiModelVariant: e.target.value })}
              >
                {MODEL_VARIANTS.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
              <span className={styles.hint} style={{ marginTop: '0.4rem' }}>
                {selectedVariant.hint}
              </span>
              {endpoints.status === 'loading' && (
                <span className={styles.hint} style={{ marginTop: '0.4rem' }}>
                  Checking which providers serve this model…
                </span>
              )}
              {routing && <RoutingNotes routing={routing} />}
              {modelUsable && (
                <span className={styles.hint} style={{ marginTop: '0.4rem' }}>
                  The workflow will request <code>{resolvedModel}</code>
                </span>
              )}
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Temperature</label>
              <span className={styles.hint}>
                Temperature changes how varied the model's wording and choices are. Unless you set
                one, the model runs at its own temperature. Models differ in the range they accept,
                what they start at, and whether they use temperature at all, and OpenRouter doesn't
                publish this for each model. Any value you enter must come from what you know about
                the chosen model: you're responsible for checking that it's valid for that model, and
                for the questions it produces. <strong>If you're not sure, leave this unticked.</strong>
              </span>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={tempEnabled}
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? { aiTemperatureEnabled: true }
                        : { aiTemperatureEnabled: false, aiTemperature: '' },
                    )
                  }
                />
                <span>
                  <strong>Set a temperature</strong>
                  <div className={styles.radioDescription}>
                    Unticking clears the value, and no temperature is sent.
                  </div>
                </span>
              </label>
              <input
                type="number"
                aria-label="Temperature"
                className={`${styles.input} ${styles.numberInput}`}
                style={{ borderColor: tempError ? 'var(--ifm-color-danger)' : undefined }}
                min={TEMPERATURE_MIN}
                max={TEMPERATURE_MAX}
                step={TEMPERATURE_STEP}
                disabled={!tempEnabled}
                value={cfg.aiTemperature ?? ''}
                placeholder={`${TEMPERATURE_MIN} to ${TEMPERATURE_MAX}`}
                onChange={(e) => onChange({ aiTemperature: e.target.value })}
              />
              {tempError ? (
                <span
                  className={styles.hint}
                  style={{ color: 'var(--ifm-color-danger)', marginTop: '0.3rem', display: 'block' }}
                >
                  {tempError}
                </span>
              ) : (
                <span className={styles.hint} style={{ marginTop: '0.4rem' }}>
                  OpenRouter accepts {TEMPERATURE_MIN} to {TEMPERATURE_MAX}; enter up to two decimal
                  places, such as 0.75. The chosen model's own range may be narrower.
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
