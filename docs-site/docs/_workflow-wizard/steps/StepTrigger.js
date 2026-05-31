import React from 'react';
import styles from '../styles.module.css';

const TRIGGERS = [
  {
    value: 'workflow_dispatch',
    label: 'Manual only',
    description: 'Run only when triggered manually from the Actions tab.',
  },
  {
    value: 'pull_request+workflow_dispatch',
    label: 'Pull Request or Manual',
    description: 'Run on pull request events and allow manual triggering from the Actions tab.',
  },
  {
    value: 'push+workflow_dispatch',
    label: 'Push or Manual',
    description: 'Run on pushes and allow manual triggering.',
  },
  {
    value: 'push+pull_request+workflow_dispatch',
    label: 'Push or Pull Request or Manual',
    description: 'Run on pushes, PR events, and allow manual triggering.',
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
  const showPrOptions = [
    'pull_request+workflow_dispatch',
    'push+pull_request+workflow_dispatch',
  ].includes(cfg.triggerEvent);

  const showBranchOption = [
    'push+workflow_dispatch',
    'push+pull_request+workflow_dispatch',
  ].includes(cfg.triggerEvent);

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
