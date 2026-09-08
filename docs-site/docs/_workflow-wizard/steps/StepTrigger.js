import React, { useState } from 'react';
import styles from '../styles.module.css';
import {
  DISPATCH_OVERRIDES,
  MAX_DISPATCH_INPUTS,
  resolveDispatchOverrides,
} from '../dispatchInputs';

const TRIGGERS = [
  {
    value: 'push+workflow_dispatch',
    label: 'Push, PR Merge, or Manual',
    description: 'Run whenever code lands on the default branch — direct push or pull request merge — and allow manual triggering from the Actions tab.',
  },
  {
    value: 'workflow_dispatch',
    label: 'Manual only',
    description: 'Run only when triggered manually from the Actions tab.',
  },
];

export default function StepTrigger({ cfg, onChange }) {
  const showBranchOption = cfg.triggerEvent === 'push+workflow_dispatch';
  const branchMode = cfg.branchMode || 'specify';

  const selected = resolveDispatchOverrides(cfg.dispatchOverrides);
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
    onChange({ dispatchOverrides: resolveDispatchOverrides(next) });
  }

  return (
    <div>
      <div className={styles.fieldGroup}>
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
            {DISPATCH_OVERRIDES.map((o) => {
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
            {selected.length} of {MAX_DISPATCH_INPUTS} selected.{' '}
            {atCap ? (
              <>
                You have reached GitHub's limit — a workflow declaring more than{' '}
                {MAX_DISPATCH_INPUTS} <code>workflow_dispatch</code> inputs fails to parse. Untick one
                to choose a different setting.
              </>
            ) : (
              <>
                GitHub allows at most {MAX_DISPATCH_INPUTS} <code>workflow_dispatch</code> inputs, so
                pick only the settings you genuinely expect to vary between runs.
              </>
            )}
          </div>

          {selectedSet.has('instructor_context') && (
            <div className={styles.notice} style={{ marginTop: '0.5rem' }}>
              <strong>GitHub has no multi-line dispatch field.</strong> The{' '}
              <strong>Run workflow</strong> form gives <code>instructor_context</code> a single-line
              text box, prefilled with the context you set on the Questions step so you can edit it in
              place. If that context spans several lines it is shown collapsed to one line, and a
              manual run submitted as-is sends the collapsed version — the wording is identical, only
              the line breaks are lost. Automatic runs always use the full multi-line version, and
              clearing the field restores it on a manual run too. To pass genuinely multi-line text on
              a manual run, use the CLI:{' '}
              <code>gh workflow run grill-my-code.yml -f instructor_context="$(cat brief.md)"</code>.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
