import React from 'react';
import styles from '../styles.module.css';
import CodebaseContextLimit, { codebaseLimitStep } from './CodebaseContextLimit';

export default function StepAdvanced({ cfg, onChange }) {
  return (
    <div>
      <div className={styles.notice}>
        These inputs have carefully chosen defaults that work well for most setups. Only change them
        if you have a specific reason. Values that remain at their defaults will be omitted from
        the generated workflow to keep it clean.
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Max retry attempts <span className={styles.optionalBadge}>optional</span></label>
        <span className={styles.hint}>
          Total attempts (initial + retries) when the AI provider returns an error or rate-limit
          response, or a reply GrillMyCode can't use. Values below 1 are clamped to 1. Default:{' '}
          <code>5</code>
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

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Assignment context max characters <span className={styles.optionalBadge}>optional</span></label>
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

      {/* Shown here only for earlier work left by a base_sha override; starter
          code and tag runs show it on their own steps. */}
      {codebaseLimitStep(cfg) === 'Advanced' && <CodebaseContextLimit cfg={cfg} onChange={onChange} />}

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Skip committers <span className={styles.optionalBadge}>optional</span></label>
        <span className={styles.hint}>
          Comma-separated list of author name or email substrings. A leading run of commits whose
          author matches any entry is skipped (e.g. bot commits from a template's own CI). Only
          skips a <em>contiguous leading run</em>, not all matching commits. Set to empty to disable
          entirely. Classroom 50's own setup commit isn't bot-authored, so this default has no
          effect on it — its metadata file is excluded by pattern instead. Default:{' '}
          <code>github-actions[bot]</code>
        </span>
        <input
          type="text"
          className={styles.input}
          value={cfg.skipCommitters}
          onChange={(e) => onChange({ skipCommitters: e.target.value })}
          placeholder="github-actions[bot]"
        />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Base SHA override <span className={styles.optionalBadge}>optional</span></label>
        <span className={styles.hint}>
          Manually override the base commit SHA for the diff. Leave empty for automatic detection
          (recommended). Takes effect on its own; the head is still auto-detected unless you
          override it too.
        </span>
        <input
          type="text"
          className={styles.input}
          value={cfg.baseSha}
          onChange={(e) => onChange({ baseSha: e.target.value })}
          placeholder="Leave empty for automatic detection"
        />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Head SHA override <span className={styles.optionalBadge}>optional</span></label>
        <span className={styles.hint}>
          The head commit SHA to diff against. Takes effect on its own; the base is still
          auto-detected unless you override it too.
        </span>
        <input
          type="text"
          className={styles.input}
          value={cfg.headSha}
          onChange={(e) => onChange({ headSha: e.target.value })}
          placeholder="Leave empty for automatic detection"
        />
      </div>
    </div>
  );
}
