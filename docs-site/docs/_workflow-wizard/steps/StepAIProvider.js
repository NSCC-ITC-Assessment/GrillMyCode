import React from 'react';
import styles from '../styles.module.css';

const PROVIDERS = [
  {
    value: 'github-models',
    label: 'GitHub Models (default)',
    description:
      'Uses the built-in GITHUB_TOKEN — no API key needed. Ideal for Classroom 50. Requires a "models: read" permission.',
  },
  {
    value: 'openrouter',
    label: 'OpenRouter',
    description:
      'Routes to any available model via OpenRouter. Requires an OpenRouter account and an OpenRouter API key.',
  },
];

const PROVIDER_DEFAULT_SECRETS = {
  openrouter: 'OPENROUTER_KEY',
};

const GITHUB_MODELS = ['gpt-4.1'];
const OPENROUTER_MODELS = [
  { label: 'Deepseek V4 Flash', value: 'deepseek/deepseek-v4-flash' },
  { label: 'Google Gemini 3.1 Flash Lite', value: 'google/gemini-3.1-flash-lite' },
  { label: 'Minimax 2.7', value: 'minimax/minimax-m2.7' },
  { label: 'Step 3.5 Flash', value: 'stepfun/step-3.5-flash' },
  { label: 'Tencent Hy3', value: 'tencent/hy3' },
  { label: 'Xiaomi Mimo V2.5 Pro', value: 'xiaomi/mimo-v2.5-pro' }
];

export default function StepAIProvider({ cfg, onChange, docsBase = '/docs' }) {
  const isNonGitHub = cfg.aiProvider !== 'github-models';

  const isOpenRouter = cfg.aiProvider === 'openrouter';
  const modelSuggestions =
    cfg.aiProvider === 'github-models'
      ? GITHUB_MODELS
      : [];

  return (
    <div>
      <div className={styles.fieldGroup}>
        <label className={styles.label}>AI provider</label>
        <span className={styles.hint}>
          GitHub Models is the easiest to set up — it uses the built-in token and requires no external accounts.
          Openrouter provides more powerful model options but requires an account and may incur a small cost.
        </span>
        <div className={styles.radioGroup}>
          {PROVIDERS.map((p) => (
            <label
              key={p.value}
              className={p.comingSoon ? styles.radioLabelDisabled : styles.radioLabel}
            >
              <input
                type="radio"
                name="aiProvider"
                value={p.value}
                checked={cfg.aiProvider === p.value}
                disabled={!!p.comingSoon}
                onChange={() =>
                  onChange({
                    aiProvider: p.value,
                    aiModel: p.value === 'openrouter' ? OPENROUTER_MODELS[0].value : 'gpt-4.1',
                    apiKeySecret: PROVIDER_DEFAULT_SECRETS[p.value] ?? '',
                  })
                }
              />
              <span>
                <strong>
                  {p.label}
                  {p.comingSoon && <span className={styles.comingSoonBadge}>Coming Soon</span>}
                </strong>
                <div className={styles.radioDescription}>{p.description}</div>
              </span>
            </label>
          ))}
        </div>
      </div>

      {isOpenRouter && (
        <div className={styles.notice} style={{ borderLeftColor: 'var(--ifm-color-warning, #f59e0b)' }}>
          <strong>💸 Cost reminder:</strong> OpenRouter charges per token based on the model you
          select. Pricing varies significantly between models — some are free, others can be
          expensive at scale. Check{' '}
          <a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer">
            openrouter.ai/models
          </a>{' '}
          for the current pricing of your chosen model before deploying to a class of students.
          <br /><br />
          The pre-defined models in the list below have been specifically chosen because they are
          very cheap — typically <strong>less than 1 cent per API call</strong> — and have been
          tested to work well with GrillMyCode. If you choose your own model, be sure to verify
          its pricing first.
          <br /><br />
          <a href={`${docsBase}/ai-providers/openrouter`} target="_blank" rel="noopener noreferrer">
            Read more about OpenRouter setup here →
          </a>
        </div>
      )}

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Model</label>
        <span className={styles.hint}>
          {cfg.aiProvider === 'openrouter' &&
            'Select a pre-defined model or choose "Own Choice" to enter any OpenRouter model ID.'}
        </span>
        {isOpenRouter ? (
          <>
            <select
              className={styles.select}
              value={OPENROUTER_MODELS.some((m) => m.value === cfg.aiModel) ? cfg.aiModel : '__custom__'}
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
            {!OPENROUTER_MODELS.some((m) => m.value === cfg.aiModel) && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.5rem' }}>
                  <input
                    type="text"
                    className={styles.input}
                    style={{ flex: 2, borderColor: (cfg.aiModel && cfg.aiModel.trim() && !/^[^/]+\/[^/]+$/.test(cfg.aiModel.trim())) || (!cfg.aiModel || !cfg.aiModel.trim()) ? 'var(--ifm-color-danger)' : undefined }}
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
                {(!cfg.aiModel || !cfg.aiModel.trim()) && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--ifm-color-danger)', marginTop: '0.3rem', display: 'block' }}>
                    Please enter a model ID before continuing.
                  </span>
                )}
                {cfg.aiModel && cfg.aiModel.trim() && !/^[^/]+\/[^/]+$/.test(cfg.aiModel.trim()) && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--ifm-color-danger)', marginTop: '0.3rem', display: 'block' }}>
                    Model ID must be in <code>provider/model</code> format (e.g. <code>anthropic/claude-3-5-sonnet</code>).
                  </span>
                )}
              </>
            )}
          </>
        ) : modelSuggestions.length > 0 ? (
          <>
            <select
              className={styles.select}
              value={modelSuggestions.includes(cfg.aiModel) ? cfg.aiModel : '__custom__'}
              onChange={(e) => {
                if (e.target.value !== '__custom__') onChange({ aiModel: e.target.value });
                else onChange({ aiModel: '' });
              }}
            >
              {modelSuggestions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              <option value="__custom__">Own Choice…</option>
            </select>
            {!modelSuggestions.includes(cfg.aiModel) && (
              <>
                <div className={styles.notice} style={{ borderLeftColor: 'var(--ifm-color-warning, #f59e0b)', marginTop: '0.5rem', marginBottom: '0.4rem' }}>
                  <strong>⚠️ Unsupported model warning:</strong> Only <code>gpt-4.1</code> is currently
                  verified to work well with GrillMyCode. Other GitHub Models models may produce
                  unreliable or poor-quality assessments. Only proceed if you know what you're doing.
                </div>
                <input
                  type="text"
                  className={styles.input}
                  style={{
                    marginTop: '0.5rem',
                    borderColor: (!cfg.aiModel || !cfg.aiModel.trim()) ? 'var(--ifm-color-danger)' : undefined,
                  }}
                  value={cfg.aiModel}
                  onChange={(e) => onChange({ aiModel: e.target.value })}
                  placeholder="e.g. gpt-4.1-mini"
                />
                {(!cfg.aiModel || !cfg.aiModel.trim()) && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--ifm-color-danger)', marginTop: '0.3rem', display: 'block' }}>
                    Please enter a model ID before continuing.
                  </span>
                )}
              </>
            )}
          </>
        ) : (
          <input
            type="text"
            className={styles.input}
            value={cfg.aiModel}
            onChange={(e) => onChange({ aiModel: e.target.value })}
            placeholder="gpt-4.1"
          />
        )}
      </div>

      {isNonGitHub && (
        <div className={styles.subField}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>API key secret name</label>
            <span className={styles.hint}>
              The name of the org-level GitHub Actions secret that holds your API key. Enter just the secret
              name (e.g.{' '}
              <code>
                {cfg.aiProvider === 'openrouter' ? 'OPENROUTER_KEY' : 'OPENROUTER_KEY'}
              </code>
              ) — the workflow will reference it as{' '}
              <code>{'${{ secrets.YOUR_SECRET }}'}</code>.
            </span>
            <input
              type="text"
              className={styles.input}
              value={cfg.apiKeySecret || ''}
              onChange={(e) => onChange({ apiKeySecret: e.target.value })}
              placeholder="OPENROUTER_KEY"
            />
          </div>
        </div>
      )}
    </div>
  );
}
