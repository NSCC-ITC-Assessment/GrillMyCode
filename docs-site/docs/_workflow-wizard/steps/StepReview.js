import React, { useState } from 'react';
import styles from '../styles.module.css';
import { generateYaml, instructorRepoActive, isTagTrigger, submissionTagList } from '../generateYaml';
import { resolveDispatchOverrides } from '../dispatchInputs';

/** @import { StepProps } from '../index' */

function buildChecklist(cfg, docsBase, host) {
  const items = [
    {
      text: host
        ? 'Create the workflow file with the button above, or copy the workflow to `.github/workflows/grill-my-code.yml` in the student (or template) repository. Then commit it.'
        : 'Copy the workflow above to `.github/workflows/grill-my-code.yml` in the student (or template) repository.',
    },
    {
      text: 'Ensure the repository has Actions enabled (Settings → Actions → Allow all actions).',
    },
  ];

  {
    const secretName = cfg.apiKeySecret || 'OPENROUTER_API_KEY';
    items.push({
      text: `Add the secret "${secretName}" at the organization level via your GitHub organization's Settings → Secrets and variables → Actions → New organization secret, then grant it access to the repositories that run GrillMyCode. An OpenRouter API key is required — the workflow will not run without it. If you do not have organization access, add the same secret to the repository instead.`,
      linkHref: `${docsBase}/ai-providers/openrouter`,
      linkLabel: 'OpenRouter setup guide',
    });
  }

  if (isTagTrigger(cfg)) {
    const example = submissionTagList(cfg).find((t) => !/[*?+[\]]/.test(t));
    items.push({
      text:
        (example
          ? `Tell students how to submit: commit their finished work to the default branch, then run "git tag ${example} && git push origin ${example}". `
          : '') +
        'Nothing runs until they push one of your tags — on a Classroom 50 assignment, "gh student submit" alone does not. ' +
        'A tag on a commit that is not on the default branch fails the run. To resubmit under the same tag, ' +
        'move it with "git tag -f <name>" and push it with "git push --force origin <name>".',
      linkHref: `${docsBase}/example-workflows/tag-submission`,
      linkLabel: 'Tag submission example',
    });
  }

  {
    const overrides = resolveDispatchOverrides(cfg.dispatchOverrides, {
      tagTrigger: isTagTrigger(cfg),
      emptyRepo: cfg.repoStart === 'empty',
      starterAsk: cfg.starterCode === 'ask',
      enabled: cfg.dispatchOverridesEnabled === true,
    });
    if (overrides.includes('preview_only')) {
      items.push({
        text:
          'Before the first assessed run, check which files a run would assess: in a repository ' +
          'that holds some work, such as your own solution, go to Actions \u2192 GrillMyCode \u2192 ' +
          'Run workflow, set "preview_only" to "true" and run it. The run summary lists the files ' +
          'that would be assessed and the files left out, with the pattern responsible for each. ' +
          'No questions are generated, so it costs nothing.',
        linkHref: `${docsBase}/reference/exclude-patterns#previewing-in-a-run`,
        linkLabel: 'Previewing in a run',
      });
    }
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

// `host` is the editor the wizard is running in, if it is (see index.js). It
// can write the file, which a web page cannot.
/** @param {StepProps} props */
export default function StepReview({ cfg, actionRef = 'v0', docsBase = '/docs', host }) {
  const yaml = generateYaml(cfg, { actionRef });
  const [copied, setCopied] = useState(false);
  // 'saving', 'saved', 'failed' or '' — how the host's write went.
  const [saveState, setSaveState] = useState('');

  function handleSave() {
    setSaveState('saving');
    host?.saveWorkflow(yaml).then(
      // false: the instructor cancelled, which is not a failure.
      (written) => setSaveState(written ? 'saved' : ''),
      () => setSaveState('failed'),
    );
  }

  function handleCopy() {
    navigator.clipboard.writeText(yaml).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const checklist = buildChecklist(cfg, docsBase, host);

  return (
    <div>
      {host ? (
        <>
          <p className={styles.hint} style={{ marginBottom: '1rem' }}>
            Your workflow is ready.{' '}
            {host.openFolder ? (
              <>
                <strong>Create the workflow file</strong> writes it to{' '}
                <code>.github/workflows/grill-my-code.yml</code> in the folder open in the editor,
                and opens it. If that folder is not your assignment template repository, copy the
                workflow there instead. Then commit it.
              </>
            ) : (
              <>
                No folder is open in the editor, so <strong>Create the workflow file</strong> opens
                it as a new file that is not saved yet. Save it as{' '}
                <code>.github/workflows/grill-my-code.yml</code> in your assignment template
                repository and commit it.
              </>
            )}
          </p>
          <div className={styles.previewActions} style={{ marginBottom: '1rem' }}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleSave}
              disabled={saveState === 'saving'}
            >
              Create the workflow file
            </button>
            <span role="status">
              {saveState === 'saved' && '✓ Created'}
              {saveState === 'failed' && (
                <span className={styles.checkWarn}>
                  The file couldn’t be written. Copy the workflow below instead.
                </span>
              )}
            </span>
          </div>
        </>
      ) : (
        <p className={styles.hint} style={{ marginBottom: '1rem' }}>
          Your workflow is ready. Copy it to{' '}
          <code>.github/workflows/grill-my-code.yml</code> in your assignment template repository
          and commit it.
        </p>
      )}

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
