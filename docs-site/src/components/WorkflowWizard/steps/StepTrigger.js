import React from 'react';
import styles from '../styles.module.css';

const TRIGGERS = [
  {
    value: 'pull_request',
    label: 'Pull Request',
    description: 'Run when a student opens or updates a pull request. The most common trigger for GitHub Classroom.',
  },
  {
    value: 'push',
    label: 'Push to branch',
    description: 'Run when code is pushed directly to a branch (e.g. main). Good for non-PR workflows.',
  },
  {
    value: 'push+pull_request',
    label: 'Push + Pull Request',
    description: 'Run on both PR events and direct pushes.',
  },
  {
    value: 'workflow_dispatch',
    label: 'Manual (workflow_dispatch)',
    description: 'Run only when triggered manually from the Actions tab. Useful for testing.',
  },
  {
    value: 'push+workflow_dispatch',
    label: 'Push + Manual',
    description: 'Run on pushes and allow manual triggering.',
  },
];

const PR_TYPES = ['opened', 'synchronize', 'reopened'];

export default function StepTrigger({ cfg, onChange }) {
  function setPrType(type, checked) {
    const current = cfg.prTypes || ['opened', 'synchronize'];
    const next = checked ? [...current, type] : current.filter((t) => t !== type);
    onChange({ prTypes: next.length > 0 ? next : ['opened'] });
  }

  const prTypes = cfg.prTypes || ['opened', 'synchronize'];
  const showPrOptions =
    cfg.triggerEvent === 'pull_request' || cfg.triggerEvent === 'push+pull_request';
  const showBranchOption =
    cfg.triggerEvent === 'push' ||
    cfg.triggerEvent === 'push+workflow_dispatch' ||
    cfg.triggerEvent === 'push+pull_request';

  return (
    <div>
      <div className={styles.fieldGroup}>
        <label className={styles.label}>What triggers the workflow?</label>
        <span className={styles.hint}>
          Choose the GitHub event that should start the code assessment. For GitHub Classroom, Pull
          Request is recommended.
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

      {showPrOptions && (
        <div className={styles.subField}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>PR event types</label>
            <span className={styles.hint}>
              Which pull request actions should trigger a new assessment? "opened" and "synchronize"
              (new commits pushed) is the recommended default.
            </span>
            <div className={styles.checkboxGroup}>
              {PR_TYPES.map((type) => (
                <label key={type} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={prTypes.includes(type)}
                    onChange={(e) => setPrType(type, e.target.checked)}
                  />
                  <span>
                    <code>{type}</code>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {showBranchOption && (
        <div className={styles.subField}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Branch name <span className={styles.optionalBadge}>optional</span></label>
            <span className={styles.hint}>
              The branch that push events should be watched on (e.g. <code>main</code> or{' '}
              <code>feedback</code>).
            </span>
            <input
              type="text"
              className={styles.input}
              value={(cfg.pushBranches || ['main']).join(', ')}
              onChange={(e) =>
                onChange({
                  pushBranches: e.target.value
                    .split(',')
                    .map((b) => b.trim())
                    .filter(Boolean),
                })
              }
              placeholder="main"
            />
          </div>
        </div>
      )}
    </div>
  );
}
