import React, { useMemo, useState } from 'react';
import styles from '../styles.module.css';
import {
  MIN_CONTEXT_TOKENS,
  MIN_OUTPUT_TOKENS,
  PICKER_SORTS,
  PRICE_LIMITS,
  catalogAge,
  formatContext,
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
  // Index into PRICE_LIMITS; a <select> value cannot be null.
  const [priceLimit, setPriceLimit] = useState(0);

  const rows = useMemo(
    () =>
      pickerModels(catalog, {
        structuredOnly,
        recentOnly,
        freeOnly,
        maxOutputPrice: PRICE_LIMITS[priceLimit].value,
      }),
    [catalog, structuredOnly, recentOnly, freeOnly, priceLimit],
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
        <select
          className={styles.select}
          value={priceLimit}
          disabled={freeOnly}
          onChange={(e) => setPriceLimit(Number(e.target.value))}
          aria-label="Output price limit"
        >
          {PRICE_LIMITS.map((p, i) => (
            <option key={p.label} value={i}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <span className={styles.hint} style={{ marginTop: '0.4rem' }}>
        {matches.length} {matches.length === 1 ? 'model' : 'models'}.{' '}
        Prices are per million tokens, {catalogAge(catalog)}. The coding score is Artificial
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
