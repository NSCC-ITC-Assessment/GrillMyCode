import React, { useState } from 'react';
import styles from '../styles.module.css';
import {
  MAX_DISPATCH_INPUTS,
  availableDispatchOverrides,
  resolveDispatchOverrides,
} from '../dispatchInputs';
import { isTagTrigger } from '../generateYaml';

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

export default function StepTrigger({ cfg, onChange, docsBase = '/docs' }) {
  const showBranchOption = cfg.triggerEvent === 'push+workflow_dispatch';
  const branchMode = cfg.branchMode || 'specify';
  const tagTrigger = isTagTrigger(cfg);

  const catalogue = availableDispatchOverrides({ tagTrigger });
  const selected = resolveDispatchOverrides(cfg.dispatchOverrides, { tagTrigger });
  const selectedSet = new Set(selected);
  const atCap = selected.length >= MAX_DISPATCH_INPUTS;

  // Always collapsed on entry so the trigger choice stays the focus of this
  // step. Some overrides are ticked by default, so seeding this from the
  // selection would mean it was never actually collapsed — the "n selected"
  // badge on the header carries that state instead.
  const [overridesOpen, setOverridesOpen] = useState(false);

  function toggleOverride(key, checked) {
    const next = checked
      ? [...selected, key]
      : selected.filter((k) => k !== key);
    onChange({ dispatchOverrides: resolveDispatchOverrides(next, { tagTrigger }) });
  }

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
              issue. The tagged commit must be on the default branch, or the run fails.
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
            </div>
          </div>
        </div>
      )}

      <div className={styles.fieldGroup} style={{ marginTop: '1.75rem' }}>
        <button
          type="button"
          className={styles.disclosureBtn}
          onClick={() => setOverridesOpen((o) => !o)}
          aria-expanded={overridesOpen}
          aria-controls="dispatch-overrides"
        >
          <span
            className={`${styles.disclosureChevron} ${overridesOpen ? styles.disclosureChevronOpen : ''}`}
            aria-hidden="true"
          >
            ▶
          </span>
          <span className={styles.disclosureTitle}>Manual run overrides</span>
          {selected.length > 0 ? (
            <span className={styles.disclosureCount}>{selected.length} selected</span>
          ) : (
            <span className={styles.optionalBadge} style={{ marginLeft: 0 }}>optional</span>
          )}
        </button>
        <span className={styles.hint} style={{ marginTop: '0.4rem' }}>
          Expose chosen settings as fields on the <strong>Run workflow</strong> button, so you can
          change them for a single manual run without editing the workflow file.
        </span>

        <div id="dispatch-overrides" hidden={!overridesOpen}>
          <span className={styles.hint}>
            Every setting you choose in this wizard is otherwise baked into the workflow file, so
            changing one means editing and committing the file again. Tick any setting below to
            also expose it as a field on the run form. The value you picked elsewhere in this
            wizard stays the default, and is what any run that leaves the field untouched
            continues to use.
          </span>

          <div className={styles.checkboxGroup} style={{ marginTop: '0.75rem' }}>
            {catalogue.map((o) => {
              const checked = selectedSet.has(o.key);
              const disabled = !checked && atCap;
              return (
                <label
                  key={o.key}
                  className={disabled ? styles.checkboxLabelDisabled : styles.checkboxLabel}
                  title={
                    disabled
                      ? `GitHub allows at most ${MAX_DISPATCH_INPUTS} workflow_dispatch inputs. Untick another to select this one.`
                      : undefined
                  }
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => toggleOverride(o.key, e.target.checked)}
                  />
                  <span>
                    <strong>{o.label}</strong> <code>{o.key}</code>
                    <div className={styles.radioDescription}>{o.hint}</div>
                  </span>
                </label>
              );
            })}
          </div>

          <div
            className={styles.notice}
            style={
              atCap
                ? { borderLeftColor: 'var(--ifm-color-warning, #f59e0b)', marginTop: '0.75rem' }
                : { marginTop: '0.75rem' }
            }
          >
            {/* Counted against the settings actually on offer, not GitHub's
                10-input cap — measuring against a number larger than the list
                reads as though options are hidden. The cap only becomes worth
                mentioning if the catalogue ever grows past it. */}
            {selected.length} of {catalogue.length} selected.{' '}
            {atCap ? (
              <>
                You have reached GitHub's limit — a workflow declaring more than{' '}
                {MAX_DISPATCH_INPUTS} <code>workflow_dispatch</code> inputs fails to parse. Untick one
                to choose a different setting.
              </>
            ) : (
              <>
                Each one becomes a field on the run form, so pick only the settings you genuinely
                expect to vary between runs.
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
