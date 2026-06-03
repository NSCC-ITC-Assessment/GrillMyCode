import React from 'react';
import styles from '../styles.module.css';

const TRIGGERS = [
  {
    value: 'push+workflow_dispatch',
    label: 'Push, PR Merge, or Manual (Recommended)',
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
    </div>
  );
}
