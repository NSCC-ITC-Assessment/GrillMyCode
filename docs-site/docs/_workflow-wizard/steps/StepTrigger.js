import React from 'react';
import styles from '../styles.module.css';
import { isTagTrigger } from '../generateYaml';
import CodebaseContextLimit, { codebaseLimitStep } from './CodebaseContextLimit';

/** @import { StepProps } from '../index' */

const TRIGGERS = [
  {
    value: 'push+workflow_dispatch',
    label: 'Push, PR Merge, or Manual',
    description: 'Run whenever code lands on the default branch — direct push or pull request merge — and allow manual triggering from the Actions tab.',
  },
  {
    value: 'tag+workflow_dispatch',
    label: 'Submission tag or Manual',
    description: 'Run only when a student pushes a tag you name (e.g. complete) to say their work is done, and allow manual triggering from the Actions tab. Ordinary pushes do not run it.',
  },
  {
    value: 'workflow_dispatch',
    label: 'Manual only',
    description: 'Run only when triggered manually from the Actions tab.',
  },
];

/** @param {StepProps} props */
export default function StepTrigger({ cfg, onChange, docsBase = '/docs' }) {
  const showBranchOption = cfg.triggerEvent === 'push+workflow_dispatch';
  const branchMode = cfg.branchMode || 'specify';
  const tagTrigger = isTagTrigger(cfg);
  const namedTagMode = (cfg.tagDiffBase || '').startsWith('tag:');
  const namedTag = namedTagMode ? cfg.tagDiffBase.slice('tag:'.length) : '';

  return (
    <div>
      <div className={styles.fieldGroup}>
        <span className={styles.hint} style={{ marginBottom: '0.75rem' }}>
          Not sure which to pick? See{' '}
          <a href={`${docsBase}/guides/choosing-a-trigger`} target="_blank" rel="noopener noreferrer">
            Choosing a Trigger
          </a>{' '}
          for when each option fits.
        </span>
        <div className={styles.radioGroup}>
          {TRIGGERS.map((t) => (
            <label key={t.value} className={styles.radioLabel}>
              <input
                type="radio"
                name="triggerEvent"
                value={t.value}
                checked={cfg.triggerEvent === t.value}
                onChange={() => onChange({ triggerEvent: t.value })}
              />
              <span>
                <strong>{t.label}</strong>
                <div className={styles.radioDescription}>{t.description}</div>
              </span>
            </label>
          ))}
        </div>
      </div>

      {showBranchOption && (
        <div className={styles.subField}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Which branch?</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="branchMode"
                  value="specify"
                  checked={branchMode === 'specify'}
                  onChange={() => onChange({ branchMode: 'specify' })}
                />
                <span>
                  <strong>Specify branch names</strong>
                  <div className={styles.radioDescription}>
                    List the exact branch names to watch. Most repositories use <code>main</code> or{' '}
                    <code>master</code> as their default branch — entering both covers either case.
                  </div>
                </span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="branchMode"
                  value="default"
                  checked={branchMode === 'default'}
                  onChange={() => onChange({ branchMode: 'default' })}
                />
                <span>
                  <strong>Default branch only (dynamic)</strong>
                  <div className={styles.radioDescription}>
                    The workflow detects the repository's default branch at runtime — no branch names
                    needed. Useful when repositories may use different default branch names and you want the default to be the trigger.
                  </div>
                </span>
              </label>
            </div>
          </div>

          {branchMode === 'specify' && (
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Branch names</label>
              <input
                type="text"
                className={styles.input}
                value={(cfg.pushBranches || ['main', 'master']).join(', ')}
                onChange={(e) =>
                  onChange({
                    pushBranches: e.target.value
                      .split(',')
                      .map((b) => b.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="main, master"
              />
            </div>
          )}
        </div>
      )}

      {tagTrigger && (
        <div className={styles.subField}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Submission tag names</label>
            <span className={styles.hint}>
              One per line or comma-separated. These are your tags: nothing else starts a run, and
              GrillMyCode never infers one — including the <code>submit/…</code> tags Classroom 50
              creates for its own grading. A student submits by tagging their finished commit and
              pushing the tag, e.g. <code>git tag complete &amp;&amp; git push origin complete</code>.
              Each name gets its own assessment issue, PDF and instructor-repository folder, so
              milestones such as <code>phase1</code> and <code>phase2</code> are kept apart.
              Wildcards (<code>*</code>, <code>**</code>, <code>?</code>, <code>+</code>,{' '}
              <code>[0-9]</code>) are allowed; every tag matching one entry shares that entry's
              issue. Names are case-sensitive, so <code>Phase1</code> won’t match <code>phase1</code>.
              The tagged commit must be on the default branch, or the run fails.
            </span>
            <textarea
              className={styles.textarea}
              rows={3}
              value={cfg.submissionTags || ''}
              onChange={(e) => onChange({ submissionTags: e.target.value })}
              placeholder={'complete'}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>What should a later tag assess?</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="tagDiffBase"
                  value="cumulative"
                  checked={(cfg.tagDiffBase || 'cumulative') === 'cumulative'}
                  onChange={() => onChange({ tagDiffBase: 'cumulative' })}
                />
                <span>
                  <strong>All work to date</strong> <code>cumulative</code>
                  <div className={styles.radioDescription}>
                    Every tag assesses everything the student has written, exactly as a push-triggered
                    run would.
                  </div>
                </span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="tagDiffBase"
                  value="previous-tag"
                  checked={cfg.tagDiffBase === 'previous-tag'}
                  onChange={() => onChange({ tagDiffBase: 'previous-tag' })}
                />
                <span>
                  <strong>Only work since the previous tag</strong> <code>previous-tag</code>
                  <div className={styles.radioDescription}>
                    <code>phase2</code> assesses only what changed since <code>phase1</code> — the
                    nearest earlier commit carrying any of the tags above. The first tag assesses
                    all work to date.
                  </div>
                </span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="tagDiffBase"
                  value="tag:"
                  checked={namedTagMode}
                  onChange={() => onChange({ tagDiffBase: `tag:${namedTag}` })}
                />
                <span>
                  <strong>Only work since a tag you name</strong> <code>tag:&lt;name&gt;</code>
                  <div className={styles.radioDescription}>
                    Every run assesses only what changed since the one tag you type below, which
                    doesn’t need to be in the list above. Suits a workflow file that runs for one
                    stage only. The name is case-sensitive. The run fails if that tag is missing,
                    isn’t an earlier commit, or is on the commit being assessed.
                  </div>
                </span>
              </label>
            </div>
            {namedTagMode && (
              <div className={styles.fieldGroup} style={{ marginTop: '0.75rem' }}>
                <label className={styles.label}>Tag to compare against</label>
                <input
                  type="text"
                  className={styles.input}
                  value={namedTag}
                  onChange={(e) => onChange({ tagDiffBase: `tag:${e.target.value.trim()}` })}
                  placeholder="phase1"
                />
              </div>
            )}
          </div>

          {(cfg.tagDiffBase || 'cumulative') !== 'cumulative' && (
            <div className={styles.fieldGroup}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={cfg.previousWork === 'context'}
                  onChange={(e) =>
                    onChange({ previousWork: e.target.checked ? 'context' : 'ignore' })
                  }
                />
                <span>
                  <strong>Give the AI the student's earlier work as context</strong>{' '}
                  <code>previous_work</code>
                  <div className={styles.radioDescription}>
                    Earlier files that this tag's work didn't touch, such as phase 1 code while
                    phase 2 is assessed, are sent as background, so questions can ask how the new
                    code fits with them. They are never asked about on their own, except starter code
                    still in them when the AI may ask about your starter code. Untick to send only the
                    new work, which costs less per run.
                  </div>
                </span>
              </label>
              {cfg.previousWork === 'context' && codebaseLimitStep(cfg) === 'Repositories' && (
                <span className={styles.hint} style={{ marginTop: '0.5rem' }}>
                  Earlier work shares the codebase context limit you set on the Repositories step.
                </span>
              )}
            </div>
          )}
          {codebaseLimitStep(cfg) === 'Trigger' && <CodebaseContextLimit cfg={cfg} onChange={onChange} />}
        </div>
      )}
    </div>
  );
}
