import React from 'react';
import styles from '../styles.module.css';
import {
  MAX_DISPATCH_INPUTS,
  availableDispatchOverrides,
  resolveDispatchOverrides,
} from '../dispatchInputs';
import {
  MAX_STARTER_QUESTIONS_ONE_IN,
  MIN_STARTER_QUESTIONS_ONE_IN,
  isTagTrigger,
  starterShareDefaultError,
} from '../generateYaml';

/** @import { StepProps } from '../index' */

// Its own step, after every setting it can expose has been chosen, so the
// instructor ticks a setting they have already seen. Every trigger allows a
// manual run, so the step applies whichever trigger was picked.
/** @param {StepProps} props */
export default function StepManualRuns({ cfg, onChange }) {
  const offer = {
    tagTrigger: isTagTrigger(cfg),
    emptyRepo: cfg.repoStart === 'empty',
    starterAsk: cfg.starterCode === 'ask',
  };
  const selected = resolveDispatchOverrides(cfg.dispatchOverrides, offer);
  const selectedSet = new Set(selected);
  // Ticking Starter code brings the starter code share onto the list, since a
  // run switched to ask can use it.
  const catalogue = availableDispatchOverrides({
    ...offer,
    starterAsk: offer.starterAsk || selectedSet.has('starter_code'),
  });
  const atCap = selected.length >= MAX_DISPATCH_INPUTS;

  const shareError = starterShareDefaultError(cfg);

  function toggleOverride(key, checked) {
    const next = checked
      ? [...selected, key]
      : selected.filter((k) => k !== key);
    onChange({ dispatchOverrides: resolveDispatchOverrides(next, offer) });
  }

  const enabled = cfg.dispatchOverridesEnabled === true;

  return (
    <div>
      <div className={styles.fieldGroup}>
        <label className={styles.label}>
          Do you want to be able to change various settings for a single manual run?
        </label>
        <span className={styles.hint}>
          Every setting you choose in this wizard is otherwise baked into the workflow file, so
          changing one means editing and committing the file again.
        </span>
        <div className={styles.radioGroup}>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="dispatchOverridesEnabled"
              checked={enabled}
              onChange={() => onChange({ dispatchOverridesEnabled: true })}
            />
            <span>
              <strong>Yes — put chosen settings on the Run workflow form</strong>
              <div className={styles.radioDescription}>
                Each setting you tick below becomes a field on the <strong>Run workflow</strong>{' '}
                form. The value you picked earlier in this wizard stays the default, and is what any
                run that leaves the field untouched continues to use.
              </div>
            </span>
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="dispatchOverridesEnabled"
              checked={cfg.dispatchOverridesEnabled === false}
              onChange={() => onChange({ dispatchOverridesEnabled: false })}
            />
            <span>
              <strong>No — every run uses the workflow file&apos;s settings</strong>
              <div className={styles.radioDescription}>
                You can still start a run by hand from the Actions tab; it just has no fields to
                change. The workflow file is shorter.
              </div>
            </span>
          </label>
        </div>
        {cfg.dispatchOverridesEnabled === null && (
          <span style={{ fontSize: '0.78rem', color: 'var(--ifm-color-danger)', marginTop: '0.3rem', display: 'block' }}>
            Please choose an answer before continuing.
          </span>
        )}
      </div>

      {enabled && (
        <div className={styles.fieldGroup}>
          <label className={styles.label}>
            Select the settings you want to be able to change for a manual run
          </label>
          <div className={styles.checkboxGroup}>
            {catalogue.map((o) => {
              const checked = selectedSet.has(o.key);
              const disabled = !checked && atCap;
              // The starter code share is set on the Questions step only under
              // ask, so otherwise the run form's pre-filled value is set here.
              const shareField =
                o.key === 'starter_questions_one_in' && checked && cfg.starterCode !== 'ask';
              return (
                <React.Fragment key={o.key}>
                  <label
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
                  {shareField && (
                    <div style={{ marginLeft: '1.9rem' }}>
                      <span className={styles.hint}>
                        Pre-filled on the form as: up to 1 in{' '}
                        <input
                          type="number"
                          aria-label="Starter code question share on the run form"
                          className={`${styles.input} ${styles.numberInput}`}
                          style={{
                            display: 'inline-block',
                            width: '5rem',
                            margin: '0 0.3rem',
                            borderColor: shareError ? 'var(--ifm-color-danger)' : undefined,
                          }}
                          min={MIN_STARTER_QUESTIONS_ONE_IN}
                          max={MAX_STARTER_QUESTIONS_ONE_IN}
                          step={1}
                          value={cfg.starterQuestionsOneIn}
                          onChange={(e) =>
                            onChange({
                              starterQuestionsOneIn:
                                e.target.value === '' ? '' : parseInt(e.target.value, 10),
                            })
                          }
                        />{' '}
                        questions, when a run switches Starter code to ask.
                      </span>
                      {shareError && (
                        <span
                          className={styles.hint}
                          style={{ color: 'var(--ifm-color-danger)', marginTop: '0.3rem', display: 'block' }}
                        >
                          {shareError}
                        </span>
                      )}
                    </div>
                  )}
                </React.Fragment>
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
                input cap — measuring against a number larger than the list
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
      )}
    </div>
  );
}
