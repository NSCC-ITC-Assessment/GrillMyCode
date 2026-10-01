import React, { useState } from 'react';
import styles from '../styles.module.css';
import {
  DEFAULTS,
  hasEarlierWork,
  sendsCodebaseContext,
  sendsStarterContext,
} from '../generateYaml';

/**
 * Which step shows the codebase context limit: the first one that switches
 * codebase context on. Starter code comes first, on the Repositories step;
 * then earlier work on a tag run, on the Trigger step; then earlier work left
 * by a base_sha override, which the Advanced step sets. null when nothing is
 * sent, so the limit isn't shown at all.
 */
export function codebaseLimitStep(cfg) {
  if (!sendsCodebaseContext(cfg)) return null;
  if (sendsStarterContext(cfg)) return 'Repositories';
  if (cfg.previousWork === 'context' && hasEarlierWork(cfg) && !cfg.baseSha) return 'Trigger';
  return 'Advanced';
}

// codebase_context_max_chars, shown beside whichever setting sends codebase
// context (see codebaseLimitStep), so it appears only where it applies. The
// number stays disabled at the default until the checkbox is ticked, and
// unticking it puts the default back, so the input is emitted only on purpose.
export default function CodebaseContextLimit({ cfg, onChange }) {
  const defaultLimit = DEFAULTS.codebaseContextMaxChars;
  // Starts ticked when the limit was already changed, such as on returning to
  // this step, since the component remounts with each step.
  const [changing, setChanging] = useState(cfg.codebaseContextMaxChars !== defaultLimit);
  return (
    <div className={styles.fieldGroup}>
      <label className={styles.label}>Codebase context max characters</label>
      <span className={styles.hint}>
        The most background code the AI is given, counted in characters. Files that don't fit
        are left out and listed in the run summary. Lower it to cut cost, or raise it for a
        large project. Default: <code>{defaultLimit}</code>
      </span>
      <label className={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={changing}
          onChange={(e) => {
            setChanging(e.target.checked);
            if (!e.target.checked) onChange({ codebaseContextMaxChars: defaultLimit });
          }}
        />
        <span>
          <strong>Change the limit</strong>
          <div className={styles.radioDescription}>
            Unticking restores the default.
          </div>
        </span>
      </label>
      <input
        type="number"
        aria-label="Codebase context max characters"
        className={`${styles.input} ${styles.numberInput}`}
        min={1}
        step={5000}
        disabled={!changing}
        value={cfg.codebaseContextMaxChars}
        onChange={(e) =>
          onChange({
            codebaseContextMaxChars: Math.max(1, parseInt(e.target.value, 10) || 1),
          })
        }
      />
    </div>
  );
}
