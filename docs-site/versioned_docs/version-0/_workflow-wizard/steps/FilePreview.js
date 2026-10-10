import React, { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import styles from '../styles.module.css';
import {
  PREVIEW_MAX_FILES,
  languageOptions,
  manifestPaths,
  parseFileList,
  patternProblems,
  previewFiles,
} from '../filePreview';
import {
  canPickFolder,
  readBinaryFiles,
  readDirectoryHandle,
  readFileInput,
  readManifests,
} from '../readFolder';

/** @import { StepProps } from '../index' */

// How long typing in a pattern box must pause before the preview is worked
// out again. Matching a large folder takes long enough to make typing lag.
const TYPING_PAUSE_MS = 250;

// Files shown in a list before "Show all".
const FILE_LIST_LIMIT = 100;

const files = (n) => `${n.toLocaleString()} file${n === 1 ? '' : 's'}`;

// The template's own name, without its github/gitignore folder.
const templateName = (key) => key.split('/').pop();

/** A pattern added to a pattern box, on a line of its own. */
export const appendPattern = (text, pattern) =>
  text.trim() ? `${text.replace(/\s+$/, '')}\n${pattern}` : pattern;

function useDebounced(value, ms) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/**
 * The preview for the wizard's current settings: { result, options, loadError }.
 * `result` is previewFiles' answer, or null until a folder or list is chosen
 * and the pattern data — loaded only then — has arrived; `options` are the
 * languages offered (see languageOptions).
 */
export function useFilePreview(cfg) {
  const source = cfg.previewSource;
  const [data, setData] = useState(/** @type {{ lists: any, languageFiles: any } | null} */ (null));
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!source || data) return undefined;
    let cancelled = false;
    Promise.all([import('../excludeLists.json'), import('../languageFiles.json')])
      .then(([lists, languageFiles]) => {
        if (cancelled) return;
        setData({
          lists: lists.default ?? lists,
          languageFiles: languageFiles.default ?? languageFiles,
        });
      })
      .catch(() => setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [source, data]);

  const additional = useDebounced(cfg.additionalExcludePatterns, TYPING_PAUSE_MS);
  const overrides = useDebounced(cfg.excludePatternOverrides, TYPING_PAUSE_MS);

  const options = useMemo(
    () =>
      source && data
        ? languageOptions(
            source.paths,
            data.languageFiles,
            data.lists.templates,
            cfg.previewLanguages,
          )
        : [],
    [source, data, cfg.previewLanguages],
  );

  const result = useMemo(
    () =>
      source && data
        ? previewFiles({
            paths: source.paths,
            texts: source.texts,
            unopened: source.unopened,
            binary: source.binary,
            languages: options.filter((o) => o.on).map((o) => o.name),
            lists: data.lists,
            languageFiles: data.languageFiles,
            additionalExcludePatterns: additional,
            excludePatternOverrides: overrides,
            stackTemplates: cfg.stackTemplates,
          })
        : null,
    [source, data, options, additional, overrides, cfg.stackTemplates],
  );

  return { result, options, loadError };
}

function problemText(problem, kind) {
  if (problem === 'negated') {
    const effect = kind === 'override' ? 'brings back' : 'leaves out';
    return `starts with “!”, so it ${effect} every file that does not match the rest of it. Remove the “!” unless you mean that.`;
  }
  return 'starts with “#”. Comments aren’t supported here, so it is read as a file name.';
}

// What a pattern does to the chosen files, as { warn, text }.
function excludeNote(check) {
  if (check.matched === 0) {
    // A dependency folder that wasn't opened has no files here to match.
    return check.unopened.length > 0 ? null : { warn: true, text: 'matches no file' };
  }
  const others = [
    check.already > 0 && `${check.already} already left out by another rule`,
    check.overridden > 0 && `${check.overridden} brought back by an override`,
  ]
    .filter(Boolean)
    .join(', ');
  if (check.leftOut === 0) return { warn: true, text: `leaves out nothing new (${others})` };
  return { warn: false, text: `leaves out ${files(check.leftOut)}${others ? ` (${others})` : ''}` };
}

function overrideNote(check) {
  if (check.matched === 0) {
    return check.unopened.length > 0 ? null : { warn: true, text: 'matches no file' };
  }
  if (check.broughtBack > 0) {
    const others = check.notLeftOut > 0 ? ` (${check.notLeftOut} more were not left out)` : '';
    return { warn: false, text: `brings back ${files(check.broughtBack)}${others}` };
  }
  if (check.notLeftOut > 0) {
    return {
      warn: true,
      text: `brings back nothing: the ${files(check.notLeftOut)} it matches ${check.notLeftOut === 1 ? 'was' : 'were'} not left out`,
    };
  }
  // The binary and protected files it matches each get a note of their own.
  return check.binary > 0 || check.blocked.length > 0
    ? null
    : { warn: true, text: 'brings back nothing new' };
}

/**
 * Under a pattern box: one line per pattern saying what it does to the chosen
 * files. Before any are chosen, only the patterns with a problem are listed.
 * `kind` is 'exclude' or 'override'.
 */
export function PatternChecks({ text, checks, kind }) {
  const rows = checks ?? patternProblems(text);
  if (rows.length === 0) return null;
  return (
    <ul className={styles.checkList}>
      {rows.map((check, i) => {
        const note = checks ? (kind === 'override' ? overrideNote : excludeNote)(check) : null;
        return (
          // A pattern may be written twice, so the row's place is its key.
          <li key={i}>
            <code>{check.written}</code>
            {note && (
              <span className={clsx(note.warn && styles.checkWarn)}>
                {' '}
                {note.warn && '⚠ '}
                {note.text}
              </span>
            )}
            {check.binary > 0 && (
              <span className={styles.checkWarn}>
                {' '}
                ⚠ {files(check.binary)} it matches {check.binary === 1 ? 'is' : 'are'} binary, such
                as an image, and can&apos;t be assessed
              </span>
            )}
            {check.blocked?.length > 0 && (
              <span className={styles.checkWarn}>
                {' '}
                ⚠ {files(check.blocked.length)} it matches{' '}
                {check.blocked.length === 1 ? 'stays' : 'stay'} out: environment files, lock files
                and dependency folders come back only when an entry names them, such as{' '}
                <code>{check.blocked[0]}</code>
              </span>
            )}
            {check.unopened?.length > 0 && (
              <span>
                {' '}
                covers <code>{check.unopened[0]}/</code>
                {check.unopened.length > 1 && ` and ${check.unopened.length - 1} more`}, which{' '}
                {check.unopened.length === 1 ? 'was' : 'were'} not opened
              </span>
            )}
            {check.problem && (
              <span className={styles.checkWarn}> ⚠ {problemText(check.problem, kind)}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function FileList({ items }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, FILE_LIST_LIMIT);
  return (
    <>
      <ul className={styles.fileList}>
        {shown.map((item) => (
          <li key={item.path}>
            {item.path}
            {item.note && <span className={styles.fileNote}> — {item.note}</span>}
          </li>
        ))}
      </ul>
      {items.length > FILE_LIST_LIMIT && !all && (
        <button type="button" className={styles.linkBtn} onClick={() => setAll(true)}>
          Show all {items.length.toLocaleString()}
        </button>
      )}
    </>
  );
}

function OriginText({ origin, pattern }) {
  const where = origin.folder ? (
    <>
      {' '}
      in <code>{origin.folder}/</code>
    </>
  ) : null;
  switch (origin.kind) {
    case 'yours':
      return origin.written === pattern ? (
        'your pattern'
      ) : (
        <>
          your pattern <code>{origin.written}</code>
        </>
      );
    case 'template':
      return (
        <>
          {templateName(origin.template)} template{where}
        </>
      );
    case 'project':
      return <>project file{where}</>;
    case 'fallback':
      return 'fallback list';
    default:
      return origin.label ? `always left out: ${origin.label}` : 'always left out';
  }
}

function Languages({ options, choices, onChange }) {
  return (
    <div className={styles.previewSection}>
      <span className={styles.previewSectionTitle}>Languages</span>
      <span className={styles.hint}>
        A run asks GitHub which languages the repository uses, and each one adds its own exclude
        patterns. Here they are worked out from file names, so tick or untick them to match the
        language bar on the repository&apos;s GitHub page.
      </span>
      {options.length === 0 ? (
        <span className={styles.hint}>None found that add exclude patterns.</span>
      ) : (
        <div className={styles.languageRow}>
          {options.map((option) => (
            <label key={option.name} className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={option.on}
                onChange={(e) => onChange({ ...choices, [option.name]: e.target.checked })}
              />
              <span>
                {option.name}{' '}
                <span className={styles.fileNote}>
                  ({option.via.join(', ')}
                  {!option.sure && ': may be another language'})
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function Stack({ result }) {
  if (result.usedFallback) {
    return (
      <span className={styles.hint}>
        No language or project file was recognized, so the fallback list is used in place of stack
        templates.
      </span>
    );
  }
  return (
    <ul className={styles.stackList}>
      {result.stack.map(({ folder, templates, patterns }) => (
        <li key={folder}>
          {folder ? (
            <>
              In <code>{folder}/</code>:
            </>
          ) : (
            'At the top of the repository:'
          )}{' '}
          {[
            ...templates.map(templateName),
            ...(patterns.length > 0 ? [`${patterns.length} project file patterns`] : []),
          ].join(', ')}
        </li>
      ))}
    </ul>
  );
}

/**
 * The tick box that writes the stack into the workflow as stack_templates, so
 * every run uses it in place of detecting one. `entries` is what ticking it
 * writes; `value` is what the workflow holds now, '' while it holds none.
 * Shown without a folder too, once ticked, so it can always be unticked.
 */
function PinStack({ value, entries, unnamed = [], onChange }) {
  const pinned = Boolean(value);
  if (!pinned && entries.length === 0) return null;
  return (
    <>
      <label className={styles.checkboxLabel} style={{ marginTop: '0.5rem' }}>
        <input
          type="checkbox"
          checked={pinned}
          onChange={(e) => onChange({ stackTemplates: e.target.checked ? entries.join(', ') : '' })}
        />
        <span>Use these templates for every student</span>
      </label>
      <span className={styles.hint}>
        {pinned ? (
          <>
            The workflow sets <code>stack_templates: {value}</code>, so every run applies these
            templates and no run works out its own. Untick to go back to detecting the stack in
            each repository.
          </>
        ) : (
          <>
            A run normally works out the stack from the repository it runs in, so two students
            can get different exclude patterns, and a file a student adds can turn a template on.
            Tick this to write the templates above into the workflow as{' '}
            <code>stack_templates</code>: every run then applies exactly these. If your students
            choose their own language or framework, or you&apos;re not sure every repository is
            laid out like this one, leave this unticked.
          </>
        )}
      </span>
      {!pinned && unnamed.length > 0 && (
        <div className={styles.previewWarning}>
          The templates in <code>{unnamed[0]}/</code>
          {unnamed.length > 1 && ` and ${unnamed.length - 1} more folders`} would be left out: a
          folder whose name has a comma, or starts or ends with a space, can&apos;t be named in{' '}
          <code>stack_templates</code>.
        </div>
      )}
    </>
  );
}

function Warnings({ source, result, cfg, onChange }) {
  const uncovered = result.unopened.filter((u) => u.assessed);
  const collisions = result.leftOut.filter((g) => g.codeFiles.length > 0);
  const collided = collisions.reduce((n, g) => n + g.codeFiles.length, 0);
  // A pasted list has no file contents, so the frameworks a manifest names
  // can't be found.
  // No manifest is read once the workflow names the stack.
  const unreadManifests =
    source.kind === 'list' && !result.pinned ? manifestPaths(source.paths) : [];

  return (
    <>
      {result.assessed.length === 0 && (
        <div className={styles.previewWarning}>
          <strong>No file would be assessed.</strong> A run with nothing to assess asks no
          questions.
        </div>
      )}
      {collisions.length > 0 && (
        <div className={styles.previewWarning}>
          <strong>
            {files(collided)} of source code {collided === 1 ? 'is' : 'are'} left out by the{' '}
            {result.pinned ? 'stack templates' : 'detected stack'}.
          </strong>{' '}
          These patterns are meant for build output and caches. Check that they aren&apos;t
          catching your students&apos; own work:
          <ul className={styles.collisionList}>
            {collisions.map((group) => (
              <li key={group.pattern}>
                <code>{group.pattern}</code> (<OriginText origin={group.origin} pattern={group.pattern} />
                ): {group.codeFiles.slice(0, 3).join(', ')}
                {group.codeFiles.length > 3 && ` and ${group.codeFiles.length - 3} more`}{' '}
                {group.override && (
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() =>
                      onChange({
                        excludePatternOverrides: appendPattern(
                          cfg.excludePatternOverrides,
                          group.override,
                        ),
                      })
                    }
                  >
                    Bring these back
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {uncovered.map(({ folder, pattern }) => (
        <div key={folder} className={styles.previewWarning}>
          <code>{folder}/</code> was not opened, and{' '}
          {pattern ? 'an override brings it back' : 'no rule leaves it out'}. If it is committed,
          its files are assessed.
          {!pattern && (
            <>
              {' '}
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() =>
                  onChange({
                    additionalExcludePatterns: appendPattern(
                      cfg.additionalExcludePatterns,
                      `${folder}/`,
                    ),
                  })
                }
              >
                Leave it out
              </button>
            </>
          )}
        </div>
      ))}
      {source.truncated && (
        <div className={styles.previewWarning}>
          Only the first {PREVIEW_MAX_FILES.toLocaleString()} files were read, shallowest folders
          first. Choose a smaller folder for a complete answer.
        </div>
      )}
      {result.foldersFound > result.foldersScanned && (
        <div className={styles.previewWarning}>
          Found {result.foldersFound} project folders. A run scans the {result.foldersScanned}{' '}
          shallowest; deeper ones get only the patterns that apply at any depth.
        </div>
      )}
      {unreadManifests.length > 0 && (
        <span className={styles.hint}>
          A pasted list has no file contents, so frameworks named only in{' '}
          <code>{unreadManifests[0]}</code>
          {unreadManifests.length > 1 && ` and ${unreadManifests.length - 1} more`} (such as
          Next.js or Laravel) aren&apos;t detected. Choose the folder to include them.
        </span>
      )}
    </>
  );
}

function Results({ source, result, options, cfg, onChange }) {
  const covered = result.unopened.filter((u) => !u.assessed);
  return (
    <div className={styles.previewPanel}>
      <div className={styles.previewHeadline}>
        {result.assessed.length.toLocaleString()} of {files(result.total)} would be assessed
      </div>
      <details className={styles.nestedDisclosure}>
        <summary>This is an estimate. How close is it to a real run?</summary>
        <ul>
          {result.pinned ? (
            <li>
              Every student&apos;s repository gets the stack templates shown here, because the
              workflow names them. A project folder with another name gets only the patterns
              that apply at any depth.
            </li>
          ) : (
            <>
              <li>
                Languages are worked out from file names. A run asks GitHub, which reads the
                files.
              </li>
              <li>
                Each student&apos;s repository is checked on its own. A student who adds another
                language or framework gets its patterns too, unless you tick{' '}
                <strong>Use these templates for every student</strong> below.
              </li>
            </>
          )}
          <li>
            A run assesses only the files a student added or changed. Every file here is treated
            as changed.
          </li>
          {source.kind === 'folder' && (
            <li>
              A folder on your computer can hold files that were never committed. For exactly the
              files in a repository, paste the output of <code>git ls-files</code> instead.
            </li>
          )}
          <li>
            To check a real repository, start a manual run with <code>preview_only</code> set to{' '}
            <code>true</code>. It lists the files that run would assess and stops, without
            generating questions. The <strong>Manual runs</strong> step puts it on the run form.
          </li>
        </ul>
      </details>

      {/* A run asks for no languages once the workflow names the stack. */}
      {!result.pinned && (
        <Languages
          options={options}
          choices={cfg.previewLanguages}
          onChange={(previewLanguages) => onChange({ previewLanguages })}
        />
      )}

      <div className={styles.previewSection}>
        <span className={styles.previewSectionTitle}>Stack templates in use</span>
        <Stack result={result} />
        <PinStack
          value={cfg.stackTemplates}
          entries={result.pin.entries}
          unnamed={result.pin.unnamed}
          onChange={onChange}
        />
      </div>

      <Warnings source={source} result={result} cfg={cfg} onChange={onChange} />

      <div className={styles.previewSection}>
        <details className={styles.subDisclosure} open>
          <summary>
            Would be assessed{' '}
            <span className={styles.subDisclosureCount}>{files(result.assessed.length)}</span>
          </summary>
          <FileList
            items={result.assessed.map(({ path, pattern }) => ({
              path,
              note: pattern && (
                <>
                  brought back by an override; <code>{pattern}</code> would leave it out
                </>
              ),
            }))}
          />
          {source.kind === 'list' && (
            <span className={styles.hint}>
              A pasted list has no file contents, so any images or other binary files in it are
              listed here. A run leaves them out. Choose the folder to have them found.
            </span>
          )}
        </details>

        <details className={styles.subDisclosure}>
          <summary>
            Would be left out{' '}
            <span className={styles.subDisclosureCount}>
              {files(result.leftOutCount)}, by the rule responsible
            </span>
          </summary>
          <div className={styles.subDisclosureBody}>
            {result.leftOut.map((group) => (
              <details key={group.pattern} className={styles.nestedDisclosure}>
                <summary>
                  <code>{group.pattern}</code> —{' '}
                  <OriginText origin={group.origin} pattern={group.pattern} />{' '}
                  <span className={styles.subDisclosureCount}>{files(group.files.length)}</span>
                  {group.codeFiles.length > 0 && <span className={styles.checkWarn}> ⚠</span>}
                </summary>
                <FileList items={group.files.map((path) => ({ path }))} />
              </details>
            ))}
            {result.binary.length > 0 && (
              <details className={styles.nestedDisclosure}>
                <summary>
                  Binary files — no text to assess, and no override brings them back{' '}
                  <span className={styles.subDisclosureCount}>{files(result.binary.length)}</span>
                </summary>
                <FileList items={result.binary.map((path) => ({ path }))} />
              </details>
            )}
            {covered.length > 0 && (
              <span className={styles.hint}>
                Not opened, and left out as a whole:{' '}
                {covered.map(({ folder, pattern }, i) => (
                  <React.Fragment key={folder}>
                    {i > 0 && ', '}
                    <code>{folder}/</code> (<code>{pattern}</code>)
                  </React.Fragment>
                ))}
              </span>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}

/**
 * The Files step's preview: choose a folder, or paste a list of files, and see
 * which a run would assess with the patterns entered, and why each of the rest
 * is left out. `preview` is useFilePreview's answer, worked out by the step so
 * its pattern boxes can show their checks too. `host` is the editor the
 * wizard is running in, if it is (see index.js): it finds the folder, in place
 * of the browser.
 *
 * @param {StepProps & { preview: ReturnType<typeof useFilePreview> }} props
 */
export default function FilePreview({ cfg, onChange, preview, host }) {
  const source = cfg.previewSource;
  const { result, options, loadError } = preview;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pasted, setPasted] = useState('');
  // Set once mounted: the wizard is also rendered on the server, which has no
  // folder picker to ask about.
  const [usesFileInput, setUsesFileInput] = useState(false);
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null));

  useEffect(() => setUsesFileInput(!host && !canPickFolder()), [host]);

  // A new set of files starts from its own language guesses.
  const show = (previewSource) => onChange({ previewSource, previewLanguages: {} });

  async function loadFolder(read) {
    setError('');
    setBusy(true);
    try {
      const folder = await read();
      const { label, paths, unopened, truncated } = folder;
      const texts = await readManifests(folder);
      const binary = await readBinaryFiles(folder);
      if (paths.length === 0) setError('That folder has no files to check.');
      else show({ kind: 'folder', label, paths, unopened, truncated, texts, binary });
    } catch (err) {
      // Closing the picker without choosing is not an error.
      if (err?.name !== 'AbortError') setError('That folder couldn’t be read.');
    } finally {
      setBusy(false);
    }
  }

  // `choose` matters to a host alone: it asks for a folder other than the one
  // open in the editor.
  function chooseFolder(choose) {
    if (host) {
      loadFolder(async () => readDirectoryHandle(await host.pickFolder({ choose })));
    } else if (canPickFolder()) {
      loadFolder(async () => readDirectoryHandle(await /** @type {any} */ (window).showDirectoryPicker()));
    } else {
      inputRef.current?.click();
    }
  }

  function loadPastedList() {
    const paths = parseFileList(pasted);
    setError(paths.length === 0 ? 'Paste at least one file path, one per line.' : '');
    if (paths.length === 0) return;
    show({
      kind: 'list',
      label: 'the pasted list',
      paths: paths.slice(0, PREVIEW_MAX_FILES),
      unopened: [],
      truncated: paths.length > PREVIEW_MAX_FILES,
      texts: {},
      binary: [],
    });
  }

  return (
    <div className={styles.fieldGroup}>
      <label className={styles.label}>
        Try the patterns on your files <span className={styles.optionalBadge}>optional</span>
      </label>
      <span className={styles.hint}>
        Choose a folder holding the kind of work your students will submit, such as your own
        solution, to see which of its files would be assessed and why the rest are left out. It
        updates as you change the patterns above. The files stay on your computer: nothing is
        uploaded.
        {usesFileInput &&
          ' Your browser may ask whether to “upload” the folder; that only lets this page read it.'}
      </span>

      <div className={styles.previewActions}>
        {host?.openFolder ? (
          <>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => chooseFolder(false)}
              disabled={busy}
            >
              {busy ? 'Reading…' : 'Use the open folder'}
            </button>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => chooseFolder(true)}
              disabled={busy}
            >
              Choose another folder…
            </button>
          </>
        ) : (
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => chooseFolder(true)}
            disabled={busy}
          >
            {busy ? 'Reading…' : source ? 'Choose another folder…' : 'Choose a folder…'}
          </button>
        )}
        {/* For browsers without a folder picker; chooseFolder clicks it. */}
        <input
          ref={inputRef}
          type="file"
          // @ts-expect-error -- React's types leave out webkitdirectory.
          webkitdirectory=""
          multiple
          hidden
          onChange={(e) => {
            const fileList = [...(e.target.files ?? [])];
            // Cleared so choosing the same folder again is still a change.
            e.target.value = '';
            if (fileList.length > 0) loadFolder(async () => readFileInput(fileList));
          }}
        />
        {source && (
          <>
            <span>
              Showing <strong>{source.label}</strong> ({files(source.paths.length)})
            </span>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => show(null)}
            >
              Clear
            </button>
          </>
        )}
      </div>

      <details className={styles.nestedDisclosure}>
        <summary>Or paste a list of files</summary>
        <span className={styles.hint} style={{ marginTop: '0.4rem' }}>
          One path per line. In a repository, <code>git ls-files</code> prints exactly the files a
          run can see.
        </span>
        <textarea
          className={styles.input}
          style={{ resize: 'vertical', minHeight: '6rem', fontFamily: 'var(--ifm-font-family-monospace)', fontSize: '0.82rem' }}
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder={'src/app.js\nsrc/lib/util.js\nREADME.md'}
          aria-label="A list of file paths, one per line"
        />
        <div className={styles.previewActions}>
          <button type="button" className={styles.secondaryBtn} onClick={loadPastedList}>
            Use this list
          </button>
        </div>
      </details>

      {error && <span className={clsx(styles.hint, styles.checkWarn)}>{error}</span>}
      {loadError && <span className={styles.hint}>The pattern lists couldn&apos;t be loaded.</span>}
      {source && !result && !loadError && <span className={styles.hint}>Working it out…</span>}
      {source && result && (
        <Results source={source} result={result} options={options} cfg={cfg} onChange={onChange} />
      )}
      {/* With no files showing, the tick stays within reach. */}
      {!(source && result) && cfg.stackTemplates && (
        <PinStack value={cfg.stackTemplates} entries={[]} onChange={onChange} />
      )}
    </div>
  );
}
