import React from 'react';
import styles from '../styles.module.css';

const DEFAULTS = {
  outputFile: 'grill-my-code.md',
  aiTemperature: 0.5,
  aiRetryMaxAttempts: 5,
  assignmentContextMaxChars: 20000,
};

export default function StepAdvanced({ cfg, onChange }) {
  return (
    <div>
      <div className={styles.notice}>
        These inputs have carefully chosen defaults that work well for most setups. Only change them
        if you have a specific reason. Values that remain at their defaults will be omitted from
        the generated workflow to keep it clean.
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Output file name</label>
        <span className={styles.hint}>
          Basename of the Markdown file written to the student's repository under{' '}
          <code>.assessment/</code>. Directory components are ignored — only the filename matters.
          Default: <code>grill-my-code.md</code>
        </span>
        <input
          type="text"
          className={styles.input}
          value={cfg.outputFile}
          onChange={(e) => onChange({ outputFile: e.target.value })}
          placeholder={DEFAULTS.outputFile}
        />
      </div>

      <div className={styles.inlineRow}>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>AI temperature</label>
          <span className={styles.hint}>
            Controls randomness (0.0 = deterministic, 1.0 = most varied). Lower values produce
            more consistent questions across runs. Default: <code>0.5</code>
          </span>
          <input
            type="number"
            className={`${styles.input} ${styles.numberInput}`}
            min={0}
            max={1}
            step={0.05}
            value={cfg.aiTemperature}
            onChange={(e) =>
              onChange({
                aiTemperature: Math.min(1, Math.max(0, parseFloat(e.target.value) || 0)),
              })
            }
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Max retry attempts</label>
          <span className={styles.hint}>
            Total attempts (initial + retries) when the AI provider returns an error or rate-limit
            response. Values below 1 are clamped to 1. Default: <code>5</code>
          </span>
          <input
            type="number"
            className={`${styles.input} ${styles.numberInput}`}
            min={1}
            step={1}
            value={cfg.aiRetryMaxAttempts}
            onChange={(e) =>
              onChange({ aiRetryMaxAttempts: Math.max(1, parseInt(e.target.value, 10) || 1) })
            }
          />
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Assignment context max characters</label>
        <span className={styles.hint}>
          Maximum total characters read from all <code>assignment_context</code> files combined.
          Increase if your assignment brief is large; decrease to limit token usage. Values below 1
          are clamped to 1. Default: <code>20000</code>
        </span>
        <input
          type="number"
          className={`${styles.input} ${styles.numberInput}`}
          min={1}
          step={1000}
          value={cfg.assignmentContextMaxChars}
          onChange={(e) =>
            onChange({
              assignmentContextMaxChars: Math.max(1, parseInt(e.target.value, 10) || 1),
            })
          }
        />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Base SHA override</label>
        <span className={styles.hint}>
          Manually override the base commit SHA for the diff. Leave empty for automatic detection
          (recommended). Must be paired with a Head SHA for both to take effect.
        </span>
        <input
          type="text"
          className={styles.input}
          value={cfg.baseSha}
          onChange={(e) => onChange({ baseSha: e.target.value })}
          placeholder="Leave empty for automatic detection"
        />
      </div>

      {cfg.baseSha && (
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Head SHA override</label>
          <span className={styles.hint}>
            The head commit SHA to diff against. Only applied when Base SHA is also provided.
          </span>
          <input
            type="text"
            className={styles.input}
            value={cfg.headSha}
            onChange={(e) => onChange({ headSha: e.target.value })}
            placeholder="Leave empty for automatic detection"
          />
        </div>
      )}
    </div>
  );
}
