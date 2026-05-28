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
  },
];

const PROVIDER_DEFAULT_SECRETS = {
  openai: 'OPENAI_API_KEY',
  openrouter: 'OPENROUTER_KEY',
  'azure-openai': 'AZURE_OPENAI_API_KEY',
};

const GITHUB_MODELS = ['gpt-4o', 'gpt-4o-mini', 'Phi-3-mini-128k-instruct'];
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
            <label key={p.value} className={styles.radioLabel}>
              <input
                type="radio"
                name="aiProvider"
                value={p.value}
                checked={cfg.aiProvider === p.value}
                onChange={() =>
                  onChange({
                    aiProvider: p.value,
                    aiModel: p.value === 'openrouter' ? OPENROUTER_MODELS[0].value : 'gpt-4o',
                    apiKeySecret: PROVIDER_DEFAULT_SECRETS[p.value] ?? '',
                    azureEndpointSecret: p.value === 'azure-openai' ? 'AZURE_OPENAI_ENDPOINT' : '',
                  })
                }
              />
              <span>
                <strong>{p.label}</strong>
                <div className={styles.radioDescription}>{p.description}</div>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Model</label>
        <span className={styles.hint}>
          {cfg.aiProvider === 'github-models' &&
            'Pick from the models available via GitHub Models. "gpt-4o" is the recommended default.'}
          {cfg.aiProvider === 'openai' && 'Enter the OpenAI model ID (e.g. gpt-4o, gpt-4-turbo).'}
          {cfg.aiProvider === 'openrouter' &&
            'Select a pre-defined model or choose "Custom" to enter any OpenRouter model ID.'}
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
              <option value="__custom__">Custom…</option>
            </select>
            {!OPENROUTER_MODELS.some((m) => m.value === cfg.aiModel) && (
              <input
                type="text"
                className={styles.input}
                style={{ marginTop: '0.5rem' }}
                value={cfg.aiModel}
                onChange={(e) => onChange({ aiModel: e.target.value })}
                placeholder="e.g. anthropic/claude-3-5-sonnet"
              />
            )}
          </>
        ) : modelSuggestions.length > 0 ? (
          <select
            className={styles.select}
            value={cfg.aiModel}
            onChange={(e) => onChange({ aiModel: e.target.value })}
          >
            {modelSuggestions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            <option value="__custom__">Custom…</option>
          </select>
        ) : (
          <input
            type="text"
            className={styles.input}
            value={cfg.aiModel}
            onChange={(e) => onChange({ aiModel: e.target.value })}
            placeholder={
              cfg.aiProvider === 'azure-openai'
                ? 'my-deployment-name'
                : 'gpt-4o'
            }
          />
        )}
        {cfg.aiModel === '__custom__' && !isOpenRouter && (
          <input
            type="text"
            className={styles.input}
            style={{ marginTop: '0.5rem' }}
            placeholder="Enter model ID"
            onChange={(e) => onChange({ aiModel: e.target.value })}
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
