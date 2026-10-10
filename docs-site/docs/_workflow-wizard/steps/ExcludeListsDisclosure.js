import React, { useEffect, useState } from 'react';
import styles from '../styles.module.css';

const TEMPLATE_BASE = 'https://github.com/github/gitignore/blob/main/';

// The template's own name, without its github/gitignore folder.
const templateName = (key) => key.split('/').pop();

const count = (n) => `${n} pattern${n === 1 ? '' : 's'}`;

function Patterns({ patterns }) {
  return (
    <ul className={styles.patternList}>
      {patterns.map((p) => (
        <li key={p}>
          <code>{p}</code>
        </li>
      ))}
    </ul>
  );
}

function Groups({ groups }) {
  return groups.map((g) => (
    <div key={g.label} className={styles.patternGroup}>
      <span className={styles.patternGroupLabel}>{g.label}</span>
      <Patterns patterns={g.patterns} />
    </div>
  ));
}

// While searching, a section or template is opened by remounting it with
// `open` set (the key changes with `searching`), and clearing the search
// remounts it closed again; in between, the reader can still toggle it.
function Section({ title, total, shown, searching, children }) {
  return (
    <details
      key={searching ? 'search' : 'browse'}
      className={styles.subDisclosure}
      open={searching || undefined}
    >
      <summary>
        {title}{' '}
        <span className={styles.subDisclosureCount}>
          {searching ? `${shown} of ${count(total)}` : count(total)}
        </span>
      </summary>
      <div className={styles.subDisclosureBody}>{children}</div>
    </details>
  );
}

// One entry turned on by a language or project file: a github/gitignore
// template (templateKey) or a fixed set of patterns, collapsed under its name
// and what turns it on. Opened while searching only when the match is in its
// patterns, since a match on its name is already visible.
function Entry({ name, templateKey, patterns, total, open, children }) {
  return (
    <details key={open ? 'open' : 'closed'} className={styles.nestedDisclosure} open={open || undefined}>
      <summary>
        <strong>{name}</strong> — {children}{' '}
        <span className={styles.subDisclosureCount}>
          {patterns.length < total ? `${patterns.length} of ${count(total)}` : count(total)}
        </span>
      </summary>
      {templateKey && (
        <a
          href={`${TEMPLATE_BASE}${templateKey}.gitignore`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {templateKey}.gitignore
        </a>
      )}
      <Patterns patterns={patterns} />
    </details>
  );
}

function Signals({ signals }) {
  return signals.map((s, i) => (
    <React.Fragment key={`${s.in}:${s.name}`}>
      {i > 0 && ', '}
      <code>{s.name}</code>
      {s.in !== 'folder' && (
        <>
          {' '}
          in <code>{s.in}</code>
        </>
      )}
    </React.Fragment>
  ));
}

const sum = (items, size) => items.reduce((n, item) => n + size(item), 0);

function Lists({ lists }) {
  const [query, setQuery] = useState('');
  const { templates } = lists;
  const q = query.trim().toLowerCase();
  const searching = q !== '';
  const hit = (text) => text.toLowerCase().includes(q);

  // Everything a heading names matches as a whole; otherwise only the
  // patterns that contain the search text are kept.
  const narrow = (patterns, headingHit) =>
    !searching || headingHit ? patterns : patterns.filter(hit);

  const groups = (list) =>
    list
      .map((g) => ({ ...g, patterns: narrow(g.patterns, hit(g.label)) }))
      .filter((g) => g.patterns.length > 0);

  // Entries for templates or pattern sets, each with the words that name it.
  const entries = (list, toEntry) =>
    list
      .map(toEntry)
      .map((e) => {
        const headingHit = searching && e.words.some(hit);
        const patterns = narrow(e.all, headingHit);
        return { ...e, patterns, open: searching && !headingHit };
      })
      .filter((e) => e.patterns.length > 0);

  const signalWords = (signals) => signals.flatMap((sig) => [sig.name, sig.in]);
  const fromTemplate = (e, words) => ({
    id: e.template,
    name: templateName(e.template),
    templateKey: e.template,
    all: templates[e.template],
    words: [e.template, ...words],
  });

  const always = groups(lists.always);
  const editors = groups(lists.editors);
  const ideTemplates = entries(lists.ideTemplates, (e) => ({
    ...fromTemplate(e, signalWords(e.signals)),
    signals: e.signals,
  }));
  const nonCode = groups(lists.nonCode);
  const languages = entries(lists.languages, (l) => ({
    ...fromTemplate(l, l.languages),
    languages: l.languages,
  }));
  const projectFiles = entries(lists.projectFiles, (e) =>
    e.template
      ? { ...fromTemplate(e, signalWords(e.signals)), signals: e.signals }
      : {
          id: e.signals[0].name,
          name: e.signals.find((sig) => sig.in !== 'folder')?.name ?? e.signals[0].name,
          all: e.patterns,
          words: signalWords(e.signals),
          signals: e.signals,
        },
  );
  const fallback = narrow(lists.fallback, false);

  const groupSize = (g) => g.patterns.length;
  const entrySize = (e) => e.patterns.length;
  const allSize = (e) => (e.patterns ?? templates[e.template]).length;
  const renderEntries = (list, describe) =>
    list.map((e) => (
      <Entry
        key={e.id}
        name={e.name}
        templateKey={e.templateKey}
        patterns={e.patterns}
        total={e.all.length}
        open={e.open}
      >
        {describe(e)}
      </Entry>
    ));

  const sections = [
    {
      title: 'Always excluded',
      total: sum(lists.always, groupSize),
      shown: sum(always, groupSize),
      body: <Groups groups={always} />,
    },
    {
      title: 'Editor and IDE files',
      total: sum(lists.editors, groupSize) + sum(lists.ideTemplates, allSize),
      shown: sum(editors, groupSize) + sum(ideTemplates, entrySize),
      body: (
        <>
          {editors.length > 0 && (
            <>
              <span className={styles.hint}>Always excluded:</span>
              <Groups groups={editors} />
            </>
          )}
          {ideTemplates.length > 0 && (
            <>
              <span className={styles.hint}>Also excluded when the repository has:</span>
              {renderEntries(ideTemplates, (e) => <Signals signals={e.signals} />)}
            </>
          )}
        </>
      ),
    },
    {
      title: 'Diagrams and data files',
      total: sum(lists.nonCode, groupSize),
      shown: sum(nonCode, groupSize),
      body: (
        <>
          <span className={styles.hint}>Always excluded.</span>
          <Groups groups={nonCode} />
        </>
      ),
    },
    {
      title: "Detected from the repository's languages",
      total: sum(lists.languages, allSize),
      shown: sum(languages, entrySize),
      body: (
        <>
          <span className={styles.hint}>
            GitHub&apos;s Languages API reports the languages a repository uses. Each language
            below adds the github/gitignore template it&apos;s listed under.
          </span>
          {renderEntries(languages, (e) => e.languages.join(', '))}
        </>
      ),
    },
    {
      title: 'Detected from project files',
      total: sum(lists.projectFiles, allSize),
      shown: sum(projectFiles, entrySize),
      body: (
        <>
          <span className={styles.hint}>
            A file or folder at the repository root or in any folder below it, or a dependency
            listed in that folder&apos;s manifest, adds the template or patterns for its framework
            or tool. Patterns that don&apos;t start with <code>**/</code> apply inside that folder,
            so each project in a monorepo gets its own.
          </span>
          {renderEntries(projectFiles, (e) => <Signals signals={e.signals} />)}
        </>
      ),
    },
    {
      title: 'If nothing is detected',
      total: lists.fallback.length,
      shown: fallback.length,
      body: (
        <>
          <span className={styles.hint}>
            If GrillMyCode can&apos;t identify the stack, because GitHub&apos;s API can&apos;t be
            reached or no language or project file above matches, it uses this list in place of
            the detected templates. The always-excluded, editor and data-file lists still apply.
          </span>
          <Patterns patterns={fallback} />
        </>
      ),
    },
  ];
  const shownSections = searching ? sections.filter((sec) => sec.shown > 0) : sections;

  return (
    <>
      <input
        type="search"
        className={styles.input}
        style={{ margin: '0.75rem 0 0.25rem' }}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search, such as node_modules, .idea, Python or package.json"
        aria-label="Search the exclude patterns"
      />
      {searching && shownSections.length === 0 && (
        <span className={styles.hint}>Nothing matches “{query.trim()}”.</span>
      )}
      {shownSections.map((sec) => (
        <Section
          key={sec.title}
          title={sec.title}
          total={sec.total}
          shown={sec.shown}
          searching={searching}
        >
          {sec.body}
        </Section>
      ))}
    </>
  );
}

// The exclude patterns the action applies on its own, collapsed at first. The
// lists are generated from src/ by scripts/build-wizard-exclude-lists.js, and
// loaded only when opened, since they hold thousands of patterns.
export default function ExcludeListsDisclosure() {
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState(/** @type {any} */ (null));
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!open || lists) return;
    import('../excludeLists.json')
      .then((m) => setLists(m.default ?? m))
      .catch(() => setLoadError(true));
  }, [open, lists]);

  return (
    // A notice box like the AI step's cost reminders, so it stands out from
    // the fields below it.
    <div className={styles.notice}>
      <details onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary style={{ cursor: 'pointer' }}>
          <strong style={{ fontSize: '1rem' }}>
            🔍 Built-in and auto-detected exclude patterns (expand to view)
          </strong>
          {/* In the summary, so it shows whether the list is open or not. */}
          <span className={styles.hint} style={{ marginTop: '0.4rem' }}>
            GrillMyCode skips build output, dependencies, editor files and more on its own, so you
            only need to add patterns below for files specific to your assignment.
          </span>
        </summary>
        <div style={{ marginTop: '0.75rem' }}>
          <span className={styles.hint}>
            When the action runs it identifies your repository&apos;s stack from GitHub&apos;s
            Languages API and the project files in each of its folders, and applies the matching{' '}
            <a href="https://github.com/github/gitignore" target="_blank" rel="noopener noreferrer">
              github/gitignore
            </a>{' '}
            templates on top of the lists that always apply. Every pattern it can use is listed
            below. Exclude pattern overrides, below, bring back anything they match.
          </span>
          {loadError && <span className={styles.hint}>The lists couldn&apos;t be loaded.</span>}
          {open && !lists && !loadError && <span className={styles.hint}>Loading…</span>}
          {lists && <Lists lists={lists} />}
        </div>
      </details>
    </div>
  );
}
