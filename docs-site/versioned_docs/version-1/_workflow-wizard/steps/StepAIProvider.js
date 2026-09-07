import React from 'react';
import styles from '../styles.module.css';

// OpenRouter is currently the only supported provider, so the wizard no longer
// offers a provider choice — it configures the model and the API key secret.
// The first entry is the action's default model.
const OPENROUTER_MODELS = [
  { label: 'Google Gemini 3.5 Flash Lite — Recommended', value: 'google/gemini-3.5-flash-lite' },
  { label: 'Deepseek V4 Flash', value: 'deepseek/deepseek-v4-flash' },
  { label: 'Minimax 2.7', value: 'minimax/minimax-m2.7' },
  { label: 'Step 3.5 Flash', value: 'stepfun/step-3.5-flash' },
  { label: 'Tencent Hy3', value: 'tencent/hy3' },
  { label: 'Xiaomi Mimo V2.5 Pro', value: 'xiaomi/mimo-v2.5-pro' },
];

export default function StepAIProvider({ cfg, onChange, docsBase = '/docs' }) {
  const isKnownModel = OPENROUTER_MODELS.some((m) => m.value === cfg.aiModel);
  const modelTrimmed = (cfg.aiModel || '').trim();
  const modelEmpty = !modelTrimmed;
  const modelMalformed = !modelEmpty && !/^[^/]+\/[^/]+$/.test(modelTrimmed);
  const secretEmpty = !(cfg.apiKeySecret || '').trim();

  return (
    <div>
      <div className={styles.fieldGroup}>
        <label className={styles.label}>AI provider</label>
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
        <strong>💸 Cost reminder:</strong> OpenRouter charges per token based on the model you
        select. Pricing varies significantly between models — some are free, others can be expensive
        at scale. Check{' '}
        <a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer">
          openrouter.ai/models
        </a>{' '}
        for the current pricing of your chosen model before deploying to a class of students.
        <br />
        <br />
        The pre-defined models in the list below have been specifically chosen because they are very
        cheap — typically <strong>less than 1 cent per API call</strong> — and have been tested to
        work well with GrillMyCode. If you choose your own model, be sure to verify its pricing
        first.
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

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Model</label>
        <span className={styles.hint}>
          Select a pre-defined model or choose "Own Choice" to enter any OpenRouter model ID.
        </span>
        <select
          className={styles.select}
          value={isKnownModel ? cfg.aiModel : '__custom__'}
          onChange={(e) => {
            if (e.target.value !== '__custom__') onChange({ aiModel: e.target.value });
            else onChange({ aiModel: '' });
          }}
        >
          {OPENROUTER_MODELS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label} ({m.value})
            </option>
          ))}
          <option value="__custom__">Own Choice…</option>
        </select>
        {!isKnownModel && (
          <>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.5rem' }}
            >
              <input
                type="text"
                className={styles.input}
                style={{
                  flex: 2,
                  borderColor:
                    modelEmpty || modelMalformed ? 'var(--ifm-color-danger)' : undefined,
                }}
                value={cfg.aiModel}
                onChange={(e) => onChange({ aiModel: e.target.value })}
                placeholder="e.g. deepseek/deepseek-v4-flash"
              />
              <a
                href="https://openrouter.ai/models"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
              >
                Browse models ↗
              </a>
            </div>
            {modelEmpty && (
              <span
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--ifm-color-danger)',
                  marginTop: '0.3rem',
                  display: 'block',
                }}
              >
                Please enter a model ID before continuing.
              </span>
            )}
            {modelMalformed && (
              <span
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--ifm-color-danger)',
                  marginTop: '0.3rem',
                  display: 'block',
                }}
              >
                Model ID must be in <code>provider/model</code> format (e.g.{' '}
                <code>anthropic/claude-3-5-sonnet</code>).
              </span>
            )}
          </>
        )}
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
    </div>
  );
}
