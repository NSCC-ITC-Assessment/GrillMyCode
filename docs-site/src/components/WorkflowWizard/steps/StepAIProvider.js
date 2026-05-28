import React from 'react';
import styles from '../styles.module.css';

const PROVIDERS = [
  {
    value: 'github-models',
    label: 'GitHub Models (default)',
    description:
      'Uses the built-in GITHUB_TOKEN — no API key needed. Ideal for GitHub Classroom. Requires a "models: read" permission.',
  },
  {
    value: 'openai',
    label: 'OpenAI',
    description: 'Calls the OpenAI API directly. Requires an OPENAI_API_KEY secret.',
    comingSoon: true,
  },
  {
    value: 'openrouter',
    label: 'OpenRouter',
    description:
      'Routes to any model via OpenRouter (e.g. anthropic/claude-3-5-sonnet). Requires an OPENROUTER_KEY secret.',
  },
  {
    value: 'azure-openai',
    label: 'Azure OpenAI',
    description:
      'Calls an Azure OpenAI deployment. Requires both an API key secret and an endpoint secret.',
    comingSoon: true,
  },
];

const PROVIDER_DEFAULT_SECRETS = {
  openai: 'OPENAI_API_KEY',
  openrouter: 'OPENROUTER_KEY',
  'azure-openai': 'AZURE_OPENAI_API_KEY',
};

const GITHUB_MODELS = ['gpt-4.1'];
const OPENAI_MODELS = ['gpt-4o', 'gpt-4-turbo', 'gpt-4o-mini'];
const OPENROUTER_MODELS = [
  { label: 'Deepseek V4 Flash', value: 'deepseek/deepseek-v4-flash' },
  { label: 'Minimax 2.7', value: 'minimax/minimax-m2.7' },
  { label: 'Step 3.5 Flash', value: 'stepfun/step-3.5-flash' },
  { label: 'Tencent Hy3 Preview', value: 'tencent/hy3-preview' },
];

export default function StepAIProvider({ cfg, onChange }) {
  const isNonGitHub = cfg.aiProvider !== 'github-models';
  const isAzure = cfg.aiProvider === 'azure-openai';

  const isOpenRouter = cfg.aiProvider === 'openrouter';
  const modelSuggestions =
    cfg.aiProvider === 'github-models'
      ? GITHUB_MODELS
      : cfg.aiProvider === 'openai'
        ? OPENAI_MODELS
        : [];

  return (
    <div>
      <div className={styles.fieldGroup}>
        <label className={styles.label}>AI provider</label>
        <span className={styles.hint}>
          Choose which AI service generates the comprehension questions. GitHub Models is the easiest
          to set up — it uses the built-in token and requires no external accounts.
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
                    azureEndpointSecret: p.value === 'azure-openai' ? 'AZURE_OPENAI_ENDPOINT' : '',
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
          The pre-defined models in the list above have been specifically chosen because they are
          very cheap — typically <strong>less than 1 cent per API call</strong> — and have been
          tested to work well with GrillMyCode. If you choose your own model, be sure to verify
          its pricing first.
        </div>
      )}

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Model</label>
        <span className={styles.hint}>
          {cfg.aiProvider === 'openai' && 'Enter the OpenAI model ID (e.g. gpt-4o, gpt-4-turbo).'}
          {cfg.aiProvider === 'openrouter' &&
            'Select a pre-defined model or choose "Own Choice" to enter any OpenRouter model ID.'}
          {cfg.aiProvider === 'azure-openai' && 'Enter your Azure OpenAI deployment name.'}
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
                    placeholder="e.g. anthropic/claude-3-5-sonnet"
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
            placeholder={
              cfg.aiProvider === 'azure-openai'
                ? 'my-deployment-name'
                : 'gpt-4.1'
            }
          />
        )}
      </div>

      {isNonGitHub && (
        <div className={styles.subField}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>API key secret name</label>
            <span className={styles.hint}>
              The name of the GitHub Actions secret that holds your API key. Enter just the secret
              name (e.g.{' '}
              <code>
                {cfg.aiProvider === 'openrouter' ? 'OPENROUTER_KEY' : 'OPENAI_API_KEY'}
              </code>
              ) — the workflow will reference it as{' '}
              <code>{'${{ secrets.YOUR_SECRET }}'}</code>.
            </span>
            <input
              type="text"
              className={styles.input}
              value={cfg.apiKeySecret || ''}
              onChange={(e) => onChange({ apiKeySecret: e.target.value })}
              placeholder={
                cfg.aiProvider === 'openrouter' ? 'OPENROUTER_KEY' : 'OPENAI_API_KEY'
              }
            />
          </div>

          {isAzure && (
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Azure endpoint secret name</label>
              <span className={styles.hint}>
                The name of the secret holding your Azure OpenAI endpoint URL (e.g.{' '}
                <code>AZURE_OPENAI_ENDPOINT</code>). The URL should look like{' '}
                <code>https://my-resource.openai.azure.com/openai/deployments/my-deployment</code>.
              </span>
              <input
                type="text"
                className={styles.input}
                value={cfg.azureEndpointSecret || ''}
                onChange={(e) => onChange({ azureEndpointSecret: e.target.value })}
                placeholder="AZURE_OPENAI_ENDPOINT"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
