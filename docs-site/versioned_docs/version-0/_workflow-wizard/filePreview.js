// The Files step's preview: which files of a folder the instructor picked, or
// of a list they pasted, a run would assess, and the rule responsible for each
// one left out. The rules are the action's own (fileSelection.js); what is here
// prepares their input and sorts their answers for display. No React and no
// browser APIs, so the repository's test suite can run it.

import {
  PROTECTED_EXCLUDE_PATTERNS,
  buildFileRules,
  createFileFilter,
  detectStack,
  fileLanguage,
  findProjectFolders,
  instructorPatterns,
  patternProblem,
  pinnedStack,
  splitPatternList,
  splitStackTemplates,
  stackTemplateEntries,
} from './fileSelection';

/**
 * Most files the preview takes from a folder or a pasted list. Each one is
 * matched against several hundred patterns every time a pattern changes,
 * which takes about a second at this size.
 */
export const PREVIEW_MAX_FILES = 5000;

/**
 * How much of each file the folder reader reads to tell whether it is binary.
 * A run checks the whole file; the start is enough for images, documents and
 * other binary formats, and keeps a folder of large files quick. It is the
 * amount git itself reads.
 */
export const PREVIEW_BINARY_CHECK_BYTES = 8000;

/**
 * Folders the folder reader does not open: the dependency folders among the
 * protected patterns (node_modules, vendor and so on). They hold thousands of
 * files nobody wants listed, and the preview reports each one as a whole (see
 * `unopened` in previewFiles).
 */
export const DEPENDENCY_FOLDERS = PROTECTED_EXCLUDE_PATTERNS.flatMap((pattern) => {
  const folder = /^\*\*\/([^/*?[\]{}]+)\/\*\*$/.exec(pattern);
  return folder ? [folder[1]] : [];
});

/** Whether a folder name is one the reader does not open. Case is ignored, as it is for the patterns. */
export function isDependencyFolder(name) {
  return DEPENDENCY_FOLDERS.includes(name.toLowerCase());
}

/**
 * The file paths in a pasted list, one per line, such as the output of
 * `git ls-files`. A leading `./` or `/` is dropped, backslashes become
 * slashes, and folders (lines ending in a slash) and repeats are left out.
 */
export function parseFileList(text) {
  const paths = new Set();
  for (const line of text.split(/[\r\n]+/)) {
    const path = line
      .trim()
      .replace(/^"(.*)"$/, '$1')
      .replace(/\\/g, '/')
      .replace(/^(\.\/)+/, '')
      .replace(/^\/+/, '');
    if (path && !path.endsWith('/')) paths.add(path);
  }
  return [...paths];
}

/**
 * The languages a list of files appears to hold, by name:
 *
 *   [{ name, sure, via }]
 *
 * `sure` is true when at least one file can only be that language, and false
 * when every sign of it is an extension it shares with others (`.h` alone
 * could be C, C++ or Objective-C). `via` lists the extensions and file names
 * that point to it: the unshared ones if there are any, else the shared ones.
 *
 * This stands in for the GitHub Languages API, which the action asks. It is
 * an approximation: GitHub reads the files, and skips the ones it takes for
 * documentation, generated or copied in.
 */
export function guessLanguages(paths, languageFiles) {
  const found = new Map();
  const note = (name, sure, via) => {
    if (!found.has(name)) found.set(name, { own: new Set(), shared: new Set() });
    found.get(name)[sure ? 'own' : 'shared'].add(via);
  };
  for (const path of paths) {
    const hit = fileLanguage(path, languageFiles);
    if (!hit) continue;
    if (typeof hit.language === 'string') note(hit.language, true, hit.via);
    else hit.language.forEach((name) => note(name, false, hit.via));
  }
  return [...found]
    .map(([name, { own, shared }]) => ({
      name,
      sure: own.size > 0,
      via: [...(own.size > 0 ? own : shared)].sort(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The templates a language turns on, asked of the action's own rules. */
export function languageTemplates(language, allTemplates) {
  const { detected } = detectStack({
    languages: [language],
    paths: [],
    readText: () => null,
    allTemplates,
  });
  return [...(detected.get('')?.keys ?? [])];
}

/**
 * The languages the preview offers for a list of files: those guessLanguages
 * finds that turn on a template, since no other language changes which files
 * are assessed. Each is { name, sure, via, templates, on }. `on` says whether
 * it counts: the instructor's choice in `choices` (name → true or false) if
 * they made one, otherwise whether the guess is sure.
 */
export function languageOptions(paths, languageFiles, allTemplates, choices = {}) {
  return guessLanguages(paths, languageFiles)
    .map((guess) => ({ ...guess, templates: languageTemplates(guess.name, allTemplates) }))
    .filter((guess) => guess.templates.length > 0)
    .map((guess) => ({
      ...guess,
      on: Object.hasOwn(choices, guess.name) ? Boolean(choices[guess.name]) : guess.sure,
    }));
}

/**
 * The dependency manifests the rules would read for a list of files — the
 * package.json, composer.json and so on of each project folder — found by
 * asking the rules and noting what they ask for.
 */
export function manifestPaths(paths) {
  const asked = [];
  detectStack({
    languages: [],
    paths,
    readText: (path) => {
      asked.push(path);
      return null;
    },
    allTemplates: {},
  });
  return asked;
}

/**
 * A template's pattern as an override that brings back exactly the files it
 * leaves out, or null when writing it in the overrides box would change its
 * meaning: an override with no slash matches at any depth, and one with a
 * comma is read as two.
 */
export function asOverride(pattern) {
  const [written, ...rest] = splitPatternList(pattern);
  if (written !== pattern || rest.length > 0) return null;
  const forms = instructorPatterns(pattern);
  return forms.length === 1 && forms[0] === pattern ? pattern : null;
}

// A stand-in for the files of a dependency folder the reader did not open.
// Any name will do: a rule that covers such a folder does so by the folder's
// name.
const insideFolder = (folder) => `${folder}/x`;

// Left-out groups are listed with the instructor's own patterns first, then
// the detected ones — where a template can take a source file by surprise —
// and the lists that never change last.
const KIND_ORDER = ['yours', 'template', 'project', 'fallback', 'always'];

/**
 * What each additional exclude pattern does to the files:
 *
 *   { written, problem, matched, leftOut, already, overridden, unopened }
 *
 * `matched` files match it; of those, `leftOut` are left out because of it,
 * `already` were left out by a rule ahead of it, and `overridden` are brought
 * back by an override. `unopened` lists the dependency folders it covers that
 * the reader did not open, whose files are in none of those counts. `problem`
 * is patternProblem's answer.
 */
function checkExcludes(additional, paths, unopened, verdicts) {
  return additional.map((written) => {
    const forms = instructorPatterns(written);
    const matches = createFileFilter({ excludePatterns: forms, caseInsensitivePatterns: forms });
    const check = {
      written,
      problem: patternProblem(written),
      matched: 0,
      leftOut: 0,
      already: 0,
      overridden: 0,
      unopened: unopened.filter((folder) => !matches(insideFolder(folder)).assessed),
    };
    for (const path of paths) {
      if (matches(path).assessed) continue;
      check.matched++;
      const verdict = verdicts.get(path);
      if (verdict.assessed) check.overridden++;
      else if (forms.includes(verdict.pattern)) check.leftOut++;
      else check.already++;
    }
    return check;
  });
}

/**
 * What each exclude pattern override does to the files:
 *
 *   { written, problem, matched, broughtBack, notLeftOut, binary, blocked,
 *     unopened }
 *
 * `matched` files match it; of those, `broughtBack` are assessed that a rule
 * would have left out, `notLeftOut` were never left out, `binary` are binary,
 * which no override brings back, and `blocked` lists the protected files it
 * matches without naming, which stay out. `unopened` lists the dependency
 * folders it names that the reader did not open.
 */
function checkOverrides(overrides, paths, unopened, verdicts, binaryPaths) {
  return overrides.map((written) => {
    // With everything excluded, the verdict depends on this override alone.
    const alone = createFileFilter({ excludePatterns: ['**'], overridePatterns: [written] });
    const check = {
      written,
      problem: patternProblem(written),
      matched: 0,
      broughtBack: 0,
      notLeftOut: 0,
      binary: 0,
      blocked: [],
      unopened: unopened.filter((folder) => alone(insideFolder(folder)).assessed),
    };
    for (const path of paths) {
      const own = alone(path);
      if (!own.assessed && !own.guard) continue;
      check.matched++;
      const verdict = verdicts.get(path);
      if (!verdict.assessed) check.blocked.push(path);
      else if (binaryPaths.has(path)) check.binary++;
      else if (!verdict.pattern) check.notLeftOut++;
      // A protected file this override matches without naming is assessed
      // only because another override names it, so it is not counted here.
      else if (!own.guard) check.broughtBack++;
    }
    return check;
  });
}

/**
 * The preview: what a run would do with these files.
 *
 *   paths                      — every file path, relative to the repository root
 *   texts                      — path → text, for the dependency manifests
 *                                that could be read (see manifestPaths)
 *   languages                  — the language names to treat as detected
 *   lists                      — excludeLists.json
 *   languageFiles              — languageFiles.json
 *   additionalExcludePatterns,
 *   excludePatternOverrides    — the two boxes, as typed
 *   stackTemplates             — the workflow's stack_templates value. With
 *                                one, the stack is the one it names, as in a
 *                                run, and `languages` and `texts` go unused
 *   unopened                   — dependency folders the reader did not open
 *   binary                     — the paths found to be binary (see
 *                                readBinaryFiles); none for a pasted list,
 *                                which has no contents to check
 *
 * Returns
 *
 *   total                      — files looked at
 *   assessed                   — [{ path, pattern }]; `pattern` is the exclude
 *                                pattern an override beat, or null
 *   binary                     — binary files no pattern left out. A run
 *                                leaves them out all the same, and no
 *                                override brings them back
 *   leftOut                    — [{ pattern, origin, files, codeFiles,
 *                                override }], one per exclude pattern that
 *                                left a file out. `origin` is where the
 *                                pattern comes from (see detectStack and
 *                                buildFileRules), `codeFiles` are the files
 *                                that may be a student's own work (see
 *                                buildFileRules), and `override` the text that
 *                                brings the group back (see asOverride)
 *   leftOutCount               — files left out, by a pattern or as binary
 *   stack                      — [{ folder, templates, patterns }] detected,
 *                                or named by `stackTemplates`
 *   pinned                     — `stackTemplates` set the stack
 *   pin                        — the stack as stack_templates entries, and
 *                                the project folders they can't name:
 *                                { entries, unnamed } (see
 *                                stackTemplateEntries)
 *   usedFallback               — the stack is empty, so the fallback list applies
 *   foldersFound, foldersScanned — project folders in the list, and how many
 *                                were scanned (fewer, above the action's cap)
 *   unopened                   — [{ folder, pattern, assessed }]: whether
 *                                the folder's files would be assessed, and
 *                                the rule that leaves it out, if one does —
 *                                assessed with a pattern means an override
 *                                brought it back
 *   excludeChecks, overrideChecks — see checkExcludes and checkOverrides
 */
export function previewFiles({
  paths,
  texts = {},
  languages = [],
  lists,
  languageFiles,
  additionalExcludePatterns = '',
  excludePatternOverrides = '',
  stackTemplates = '',
  unopened = [],
  binary = [],
}) {
  const additional = splitPatternList(additionalExcludePatterns);
  const overrides = splitPatternList(excludePatternOverrides);
  const pinnedEntries = splitStackTemplates(stackTemplates);
  const pinned = pinnedEntries.length > 0;
  const stack = pinned
    ? pinnedStack({ entries: pinnedEntries, allTemplates: lists.templates })
    : detectStack({
        languages,
        paths,
        readText: (path) => (Object.hasOwn(texts, path) ? texts[path] : null),
        allTemplates: lists.templates,
      });
  const { verdictOn, origins, mayBeOwnWork } = buildFileRules({
    detectedPatterns: stack.patterns,
    detectedOrigins: stack.origins,
    additionalExcludePatterns: additional,
    excludePatternOverrides: overrides,
  });

  const verdicts = new Map();
  const assessed = [];
  const noText = [];
  const binaryPaths = new Set(binary);
  const groups = new Map();
  for (const path of [...paths].sort()) {
    const verdict = verdictOn(path);
    verdicts.set(path, verdict);
    if (verdict.assessed) {
      // As in a run, the patterns are asked first: a binary file one of them
      // leaves out is listed under that pattern.
      if (binaryPaths.has(path)) noText.push(path);
      else assessed.push({ path, pattern: verdict.pattern ?? null });
      continue;
    }
    if (!groups.has(verdict.pattern)) {
      groups.set(verdict.pattern, {
        pattern: verdict.pattern,
        origin: origins.get(verdict.pattern) ?? { kind: 'always', label: '' },
        files: [],
        codeFiles: [],
        override: null,
      });
    }
    const group = groups.get(verdict.pattern);
    group.files.push(path);
    if (mayBeOwnWork(path, verdict, languageFiles)) group.codeFiles.push(path);
  }

  const leftOut = [...groups.values()]
    .map((group) => ({
      ...group,
      override: group.codeFiles.length > 0 ? asOverride(group.pattern) : null,
    }))
    .sort(
      (a, b) =>
        KIND_ORDER.indexOf(a.origin.kind) - KIND_ORDER.indexOf(b.origin.kind) ||
        b.codeFiles.length - a.codeFiles.length ||
        b.files.length - a.files.length ||
        (a.pattern < b.pattern ? -1 : 1),
    );

  return {
    total: paths.length,
    assessed,
    binary: noText,
    leftOut,
    leftOutCount: paths.length - assessed.length,
    stack: [...stack.detected].map(([folder, { keys, extraPatterns }]) => ({
      folder,
      templates: [...keys],
      patterns: [...extraPatterns],
    })),
    pinned,
    pin: stackTemplateEntries(stack.detected),
    usedFallback: stack.detected.size === 0,
    foldersFound: stack.foldersFound,
    foldersScanned: findProjectFolders(paths).folders.size,
    unopened: unopened.map((folder) => {
      const verdict = verdictOn(insideFolder(folder));
      return { folder, pattern: verdict.pattern ?? null, assessed: verdict.assessed };
    }),
    excludeChecks: checkExcludes(additional, paths, unopened, verdicts),
    overrideChecks: checkOverrides(overrides, paths, unopened, verdicts, binaryPaths),
  };
}

/**
 * The pattern checks that need no files: each pattern in a box with what
 * patternProblem says of it. Shown before a folder is chosen.
 */
export function patternProblems(text) {
  return splitPatternList(text)
    .map((written) => ({ written, problem: patternProblem(written) }))
    .filter((check) => check.problem);
}
