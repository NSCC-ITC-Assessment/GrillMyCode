import React, { useState } from 'react';
import styles from '../styles.module.css';
import { generateYaml } from '../generateYaml';

function buildChecklist(cfg) {
  const items = [
    {
      text: 'Copy the workflow above to `.github/workflows/grill-my-code.yml` in the student (or template) repository.',
    },
    {
      text: 'Ensure the repository has Actions enabled (Settings → Actions → Allow all actions).',
    },
  ];

  if (cfg.aiProvider === 'github-models') {
    items.push({
      text: 'GitHub Models is selected — no API key needed. The built-in GITHUB_TOKEN is used automatically.',
    });
  } else {
    const secretName = cfg.apiKeySecret || 'OPENAI_API_KEY';
    items.push({
      text: `Add the secret "${secretName}" to the repository (or organisation) via Settings → Secrets and variables → Actions.`,
      linkHref: '/docs/ai-providers',
      linkLabel: 'AI Providers docs',
    });
  }

  if (cfg.aiProvider === 'azure-openai') {
    const endpointSecret = cfg.azureEndpointSecret || 'AZURE_OPENAI_ENDPOINT';
    items.push({
      text: `Add the Azure endpoint secret "${endpointSecret}" with the full deployment URL.`,
      linkHref: '/docs/ai-providers',
      linkLabel: 'AI Providers docs',
    });
  }

  if (cfg.instructorRepoEnabled) {
    const tokenSecret = cfg.instructorRepoTokenSecret || 'INSTRUCTOR_REPO_TOKEN';
    items.push({
      text: `Create a Personal Access Token with "repo" and "workflow" scopes and add it as an org-level secret named "${tokenSecret}".`,
      linkHref: '/docs/guides/instructor-setup',
      linkLabel: 'Instructor Setup guide',
    });
  }

  if (cfg.postDiscussion) {
    items.push({
      text: `Ensure the Discussion category "${cfg.discussionCategory || 'Assessments'}" exists in the repository's Discussion settings.`,
      linkHref: '/docs/example-workflows/post-to-discussions',
      linkLabel: 'Post to Discussions example',
    });
  }

  return items;
}

export default function StepReview({ cfg }) {
  const yaml = generateYaml(cfg);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(yaml).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const checklist = buildChecklist(cfg);

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
    </div>
  );
}
