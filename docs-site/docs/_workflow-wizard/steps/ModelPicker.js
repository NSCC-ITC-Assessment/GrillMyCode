import React, { useMemo, useState } from 'react';
import styles from '../styles.module.css';
import {
  MIN_CONTEXT_TOKENS,
  MIN_OUTPUT_TOKENS,
  PICKER_SORTS,
  formatContext,
  formatDollars,
  outputPriceSteps,
  pickerModels,
  searchModels,
} from '../modelCatalog';

/**
 * Searchable list of OpenRouter models, shown under "Own Choice". Picking a row
 * sets the model ID; the text box above it stays editable for anything the list
 * leaves out.
 *
 * `selectedId` is the catalogue ID of the current model (routing variant
 * removed), `testedIds` the models the Wizard's dropdown recommends.
 */
export default function ModelPicker({ catalog, selectedId, testedIds, onPick }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('coding');
  const [structuredOnly, setStructuredOnly] = useState(true);
  const [recentOnly, setRecentOnly] = useState(true);
  const [freeOnly, setFreeOnly] = useState(false);
  // Output prices in dollars per million tokens; null leaves that end open.
  const [priceRange, setPriceRange] = useState({ min: null, max: null });
  const priceSteps = useMemo(() => outputPriceSteps(catalog), [catalog]);

  const rows = useMemo(
    () =>
      pickerModels(catalog, {
        structuredOnly,
        recentOnly,
        freeOnly,
        // The price slider is disabled while free-only is ticked, so it must
        // not filter then: a raised minimum would empty the list.
        maxOutputPrice: freeOnly ? null : priceRange.max,
        minOutputPrice: freeOnly ? null : priceRange.min,
      }),
    [catalog, structuredOnly, recentOnly, freeOnly, priceRange],
  );
  const matches = useMemo(() => searchModels(rows, query, sort), [rows, query, sort]);

  if (catalog.status === 'loading') {
    return <span className={styles.hint}>Loading OpenRouter's model list…</span>;
  }
  if (catalog.status === 'unavailable') {
    return (
      <span className={styles.hint}>
        OpenRouter's model list couldn't be loaded. Type a model ID above, or browse{' '}
        <a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer">
          openrouter.ai/models
        </a>
        .
      </span>
    );
  }

  return (
    <div className={styles.modelPicker}>
      <div className={styles.modelControls}>
        <input
          type="search"
          className={styles.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search models, e.g. claude, deepseek, free"
          aria-label="Search models"
        />
        <select
          className={styles.select}
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sort models"
        >
          {PICKER_SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.modelFilters}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={structuredOnly}
            onChange={(e) => setStructuredOnly(e.target.checked)}
          />
          Only models that support structured outputs (recommended)
        </label>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={recentOnly}
            onChange={(e) => setRecentOnly(e.target.checked)}
          />
          Released in the last year
        </label>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={freeOnly}
            onChange={(e) => setFreeOnly(e.target.checked)}
          />
          Free models only
        </label>
        <PriceRangeSlider
          steps={priceSteps}
          range={priceRange}
          disabled={freeOnly}
          onChange={setPriceRange}
        />
      </div>
      <span className={styles.hint} style={{ marginTop: '0.4rem' }}>
        {matches.length} {matches.length === 1 ? 'model' : 'models'}.{' '}
        Prices are per million tokens, live from OpenRouter. The coding score is Artificial
        Analysis's benchmark for writing code, not a test of question quality. Always left out:
        models with less than {formatContext(MIN_CONTEXT_TOKENS)} tokens of context or a reply
        limit under {formatContext(MIN_OUTPUT_TOKENS)} tokens, and models OpenRouter plans to
        retire.
      </span>
      {freeOnly && structuredOnly && (
        <span className={styles.hint}>
          Most free models don't support structured outputs. Untick that filter to see them, but
          expect more replies GrillMyCode can't use.
        </span>
      )}

      <div className={styles.modelList}>
        {matches.map((m) => {
          const selected = m.id === selectedId;
          const context = formatContext(m.contextLength);
          return (
            <button
              key={m.id}
              type="button"
              className={`${styles.modelRow} ${selected ? styles.modelRowSelected : ''}`}
              aria-pressed={selected}
              onClick={() => onPick(m.id)}
            >
              <span className={styles.modelName}>
                {m.name}
                {testedIds.includes(m.id) && <span className={styles.testedBadge}>Tested</span>}
                {selected && <span className={styles.testedBadge}>Selected</span>}
              </span>
              <code className={styles.modelId}>{m.id}</code>
              <span className={styles.modelMeta}>
                {m.pricing.free ? 'Free' : `${m.pricing.input} in · ${m.pricing.output} out`}
                {' · '}
                {m.reasoning}
                {m.codingIndex !== null && ` · Coding score ${m.codingIndex}`}
                {context && ` · ${context} context`}
                {!m.structured && ' · No structured outputs'}
              </span>
            </button>
          );
        })}
        {matches.length === 0 && (
          <span className={styles.hint} style={{ padding: '0.75rem' }}>
            No models match. Try fewer words, or loosen the filters above.
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Two-handled slider over `steps`, the catalogue's distinct output prices in
 * ascending order. Each stop is a price some model has, so the cheap end, where
 * most models are, gets most of the track. `range` holds the chosen prices, with
 * null for an end left at the lowest or highest price, so a changed catalogue
 * never strands the selection.
 */
function PriceRangeSlider({ steps, range, disabled, onChange }) {
  const last = steps.length - 1;
  if (last < 1) return null;

  const indexOf = (price, fallback) => {
    const i = price === null ? -1 : steps.indexOf(price);
    return i === -1 ? fallback : i;
  };
  const low = indexOf(range.min, 0);
  const high = indexOf(range.max, last);
  const setLow = (i) => {
    const next = Math.min(i, high);
    onChange({ ...range, min: next === 0 ? null : steps[next] });
  };
  const setHigh = (i) => {
    const next = Math.max(i, low);
    onChange({ ...range, max: next === last ? null : steps[next] });
  };
  // Thumbs sit 0.5rem in from each end of the track, so the fill between them
  // is placed on the same scale.
  const at = (i) => `calc(${i / last} * (100% - 1rem) + 0.5rem)`;
  const narrowed = low > 0 || high < last;

  return (
    <div className={`${styles.priceRange} ${disabled ? styles.priceRangeDisabled : ''}`}>
      <span className={styles.priceRangeLabel}>
        Output price: {formatDollars(steps[low])} to {formatDollars(steps[high])} per million
        tokens
      </span>
      <div className={styles.priceSliderRow}>
        <div className={styles.priceSlider}>
        <div className={styles.priceSliderTrack} />
        <div
          className={styles.priceSliderFill}
          style={{ left: at(low), right: `calc(100% - ${at(high)})` }}
        />
        <input
          type="range"
          min={0}
          max={last}
          value={low}
          disabled={disabled}
          onChange={(e) => setLow(Number(e.target.value))}
          aria-label="Lowest output price"
          aria-valuetext={`${formatDollars(steps[low])} per million tokens`}
          // Both thumbs at the top end: only the low one can move, so it goes on top.
          style={low === last ? { zIndex: 2 } : undefined}
        />
        <input
          type="range"
          min={0}
          max={last}
          value={high}
          disabled={disabled}
          onChange={(e) => setHigh(Number(e.target.value))}
          aria-label="Highest output price"
          aria-valuetext={`${formatDollars(steps[high])} per million tokens`}
        />
        </div>
        {/* Hidden rather than removed at full range, so the slider doesn't jump. */}
        <button
          type="button"
          className={styles.priceReset}
          onClick={() => onChange({ min: null, max: null })}
          disabled={disabled || !narrowed}
          style={narrowed ? undefined : { visibility: 'hidden' }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
