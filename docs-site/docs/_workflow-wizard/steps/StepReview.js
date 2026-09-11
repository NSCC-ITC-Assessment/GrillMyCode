import React, { useState } from 'react';
import styles from '../styles.module.css';
import { generateYaml, instructorRepoActive } from '../generateYaml';
import { resolveDispatchOverrides } from '../dispatchInputs';

function buildChecklist(cfg, docsBase) {
  const items = [
    {
      text: 'Copy the workflow above to `.github/workflows/grill-my-code.yml` in the student (or template) repository.',
    },
    {
      text: 'Ensure the repository has Actions enabled (Settings → Actions → Allow all actions).',
    },
  ];

  {
    const secretName = cfg.apiKeySecret || 'OPENROUTER_API_KEY';
    items.push({
      text: `Add the secret "${secretName}" at the organisation level via your GitHub organisation's Settings → Secrets and variables → Actions → New organization secret, then grant it access to the repositories that run GrillMyCode. An OpenRouter API key is required — the workflow will not run without it. If you do not have organisation access, add the same secret to the repository instead.`,
      linkHref: `${docsBase}/ai-providers/openrouter`,
      linkLabel: 'OpenRouter setup guide',
    });
  }

  {
    const overrides = resolveDispatchOverrides(cfg.dispatchOverrides);
    if (overrides.length > 0) {
      items.push({
        text:
          `To change ${overrides.map((k) => `"${k}"`).join(', ')} for a single run, go to ` +
          'Actions \u2192 GrillMyCode \u2192 Run workflow and edit the form fields. Leaving a field ' +
          'untouched uses the same value a push-triggered run would. If you later edit a default in ' +
          'the workflow file, change it in both places \u2014 the "default:" under ' +
          '"workflow_dispatch.inputs" and the fallback in the matching "${{ ... }}" expression.',
      });
    }
  }

  if (instructorRepoActive(cfg)) {
    const tokenSecret = cfg.instructorRepoTokenSecret || 'INSTRUCTOR_REPO_TOKEN';
    items.push({
      text: `Create a Personal Access Token with "repo" and "workflow" scopes and add it as an org-level secret named "${tokenSecret}". Instructor repository delivery works only in Classroom 50 assignment repositories.`,
      linkHref: `${docsBase}/guides/instructor-setup`,
      linkLabel: 'Instructor Setup guide',
    });
  }

  return items;
}

export default function StepReview({ cfg, actionRef = 'v1', docsBase = '/docs' }) {
  const yaml = generateYaml(cfg, { actionRef });
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(yaml).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const checklist = buildChecklist(cfg, docsBase);

  return (
    <div>
      <p className={styles.hint} style={{ marginBottom: '1rem' }}>
        Your workflow is ready. Copy it to{' '}
        <code>.github/workflows/grill-my-code.yml</code> in your assignment template repository and
        commit it.
      </p>

      <div className={styles.yamlBlock}>
        <button
          className={`${styles.copyBtn} ${copied ? styles.copyBtnDone : ''}`}
          onClick={handleCopy}
          aria-label="Copy workflow YAML to clipboard"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
        <pre>{yaml}</pre>
      </div>

      <h3 style={{ marginTop: '1.75rem', marginBottom: '0.5rem', fontSize: '1rem' }}>
        Next Steps (based on your choices)
      </h3>
      <ul className={styles.checklist}>
        {checklist.map((item, i) => (
          <li key={i}>
            {item.text}
            {item.linkHref && (
              <>
                {' '}
                <a href={item.linkHref} target="_blank" rel="noopener noreferrer">
                  {item.linkLabel}
                </a>
              </>
            )}
          </li>
        ))}
      </ul>

      <p style={{ marginTop: '1.25rem', fontSize: '0.875rem', color: 'var(--ifm-color-emphasis-700)' }}>
        The generated workflow is a starting point — you are free to make any changes or additions
        directly in the file, as long as it stays consistent with the{' '}
        <a href={`${docsBase}/reference/inputs-outputs`} target="_blank" rel="noopener noreferrer">
          inputs &amp; outputs reference
        </a>
        .
      </p>
    </div>
  );
}
