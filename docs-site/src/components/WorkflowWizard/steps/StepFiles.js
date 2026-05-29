import React from 'react';
import styles from '../styles.module.css';

// Kept in sync with DEFAULT_EXCLUDE_PATTERNS in src/constants.js
const DEFAULT_EXCLUDE_PATTERNS = [
  // JavaScript / Node.js
  'node_modules/**',
  '**/*.lock',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '**/*.min.js',
  '**/*.min.css',
  
  // Common build output
  'dist/**',
  'build/**',
  'out/**',
  'coverage/**',
  '.nyc_output/**',
  
  // Next.js / Nuxt
  '.next/**',
  '.nuxt/**',
  '.output/**',
  
  // SvelteKit / Astro / Expo / Parcel / Turborepo
  '.svelte-kit/**',
  '.astro/**',
  '.expo/**',
  '.parcel-cache/**',
  '.turbo/**',
  
  // Python
  '__pycache__/**',
  '**/*.pyc',
  '.venv/**',
  'venv/**',
  '.pytest_cache/**',
  '**/*.egg-info/**',
  '.tox/**',
  
  // Java / JVM
  '**/*.class',
  '**/*.jar',
  'target/**',
  '.gradle/**',
  
  // Ruby
  '.bundle/**',
  
  // PHP / Go / Ruby vendor
  'vendor/**',
  
  // .NET
  'obj/**',
  
  // C / C++
  '**/*.o',
  '**/*.a',
  '**/*.so',
  
  // Version control
  '.git/**',
  '.gitignore',
  
  // Images
  '**/*.png',
  '**/*.jpg',
  '**/*.jpeg',
  '**/*.gif',
  '**/*.ico',
  '**/*.svg',
  
  // Fonts
  '**/*.woff',
  '**/*.woff2',
  '**/*.ttf',
  '**/*.eot',
  
  // Documents / archives
  '**/*.md',
  '**/*.pdf',
  '**/*.zip',
  '**/*.tar.gz',
  
  // Source maps and logs
  '**/*.map',
  '**/*.log',
  
  // GrillMyCode assessment internals
  '.assessment/**',
].join(', ');

const DEFAULT_PATTERN_GROUPS = [
  {
    heading: 'JavaScript / Frontend',
    patterns: [
      'node_modules/**', '**/*.lock', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
      '**/*.min.js', '**/*.min.css', 'dist/**', 'build/**', 'out/**', 'coverage/**',
      '.nyc_output/**', '.next/**', '.nuxt/**', '.output/**', '.svelte-kit/**',
      '.astro/**', '.expo/**', '.parcel-cache/**', '.turbo/**',
    ],
  },
  {
    heading: 'Python',
    patterns: [
      '__pycache__/**', '**/*.pyc', '.venv/**', 'venv/**',
      '.pytest_cache/**', '**/*.egg-info/**', '.tox/**',
    ],
  },
  {
    heading: 'Java · Ruby · PHP · .NET · C/C++',
    patterns: [
      '**/*.class', '**/*.jar', 'target/**', '.gradle/**',
      '.bundle/**', 'vendor/**', 'obj/**',
      '**/*.o', '**/*.a', '**/*.so',
    ],
  },
  {
    heading: 'Assets & Misc',
    patterns: [
      '.git/**', '.gitignore',
      '**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.gif', '**/*.ico', '**/*.svg',
      '**/*.woff', '**/*.woff2', '**/*.ttf', '**/*.eot',
      '**/*.md', '**/*.pdf', '**/*.zip', '**/*.tar.gz',
      '**/*.map', '**/*.log', '.assessment/**',
    ],
  },
];

export default function StepFiles({ cfg, onChange }) {
  return (
    <div>
      <div className={styles.fieldGroup}>
        <label className={styles.label}>Exclude patterns <span className={styles.optionalBadge}>optional</span></label>
        <span className={styles.hint}>
          Comma-separated glob patterns for files to <strong>exclude</strong>. The action has a
          sensible built-in default list (node_modules, lock files, build artefacts, images, etc.).{' '}
          <strong>Warning:</strong> providing a value here <em>replaces</em> the default list
          entirely — repeat the defaults alongside your additions if you want both.
        </span>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', marginBottom: '0.6rem', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                {DEFAULT_PATTERN_GROUPS.map(g => (
                  <th key={g.heading} style={{ padding: '0.3rem 0.5rem', background: 'var(--ifm-color-emphasis-100)', border: '1px solid var(--ifm-color-emphasis-300)', textAlign: 'left', fontWeight: 600, width: '25%' }}>
                    {g.heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {DEFAULT_PATTERN_GROUPS.map(g => (
                  <td key={g.heading} style={{ padding: '0.4rem 0.5rem', border: '1px solid var(--ifm-color-emphasis-200)', verticalAlign: 'top' }}>
                    {g.patterns.map(p => (
                      <div key={p}><code style={{ fontSize: '0.68rem' }}>{p}</code></div>
                    ))}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <textarea
            className={styles.input}
            style={{ flex: 1, resize: 'vertical', minHeight: '4rem', fontFamily: 'var(--ifm-font-family-monospace)', fontSize: '0.82rem' }}
            value={cfg.excludePatterns}
            onChange={(e) => onChange({ excludePatterns: e.target.value })}
            placeholder="Leave empty to use built-in defaults"
          />
          <button
            type="button"
            className={styles.secondaryBtn}
            title="Populate with the built-in default exclude patterns so you can add to or modify them"
            onClick={() => onChange({ excludePatterns: DEFAULT_EXCLUDE_PATTERNS })}
          >
            Load defaults
          </button>
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label}>Include patterns <span className={styles.optionalBadge}>optional</span></label>
        <span className={styles.hint}>
          Comma-separated glob patterns for files to <strong>include</strong> in the assessment. Leave
          empty to include all files not matched by the exclude list. Most instructors can leave this
          blank.{' '}
          <em>Example: </em>
          <code>src/**/*.py</code>
        </span>
        <input
          type="text"
          className={styles.input}
          value={cfg.includePatterns}
          onChange={(e) => onChange({ includePatterns: e.target.value })}
          placeholder="Leave empty to include all non-excluded files"
        />
      </div>

    </div>
  );
}
