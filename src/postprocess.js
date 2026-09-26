/**
 * AI Output Post-Processing
 *
 * The model replies with a JSON object (see prompt.js). This module turns that
 * reply into question objects, filters them, and renders the three Markdown
 * views of them: the instructor copy, the include_answers copy, and the
 * student copy.
 *
 * GrillMyCode writes every piece of Markdown structure itself — numbering,
 * filename headers, code fences, the answer container, the separators — so the
 * views cannot drift from the format generate-lms-quiz.yml parses, whatever
 * the model does. The student view is built from the question objects without
 * their answers, rather than by removing answers from text, so no formatting
 * slip can carry an answer into it.
 *
 * These live outside main.js so they can be tested directly. main.js is the
 * container entrypoint and runs an assessment on import, so nothing may import
 * it.
 */

import { LINE_MARKERS } from './constants.js';

/**
 * Parses the model's reply into question objects.
 *
 * Lenient about the wrapper, strict about the content. The schema is only a
 * routing preference (see buildResponseFormat), so a model without structured
 * outputs may fence the object or add a line before it: the first parse that
 * succeeds of the whole reply, its fenced body, or the span from the first `{`
 * to the last `}` is used. When none parses — most often a reply cut off at
 * the output token limit — every complete question object in the `questions`
 * array is recovered on its own, and `salvaged` is set.
 *
 * Each question is then normalised (see normaliseQuestion). One without
 * question text or an answer cannot be shown or assessed, so it is dropped and
 * its 1-based position among the reply's `entries` is listed in `malformed`,
 * so an instructor can find it in the raw output.
 *
 * Throws when no usable question remains, so callAI can retry. The message is
 * written to the Actions log, which the student can read, so it describes the
 * reply's shape and never quotes it — nor passes on JSON.parse's own message,
 * which does.
 *
 * Returns `{ questions, contextSummary, salvaged, entries, malformed }`.
 */
export function parseQuestionsReply(text) {
  let reply = parseJson(text);
  let salvaged = false;
  if (reply === undefined) {
    reply = { questions: salvageQuestions(text) };
    salvaged = true;
  }
  const rawQuestions = Array.isArray(reply) ? reply : reply?.questions;
  if (!Array.isArray(rawQuestions)) {
    throw new Error('the reply is not a JSON object with a "questions" array');
  }

  const questions = [];
  const malformed = [];
  rawQuestions.forEach((raw, i) => {
    const question = normaliseQuestion(raw);
    if (question) questions.push(question);
    else malformed.push(i + 1);
  });
  if (questions.length === 0) {
    throw new Error(
      salvaged
        ? 'the reply is not valid JSON and holds no complete question'
        : 'the reply holds no question with both question text and an answer',
    );
  }

  const contextSummary = oneLine(Array.isArray(reply) ? '' : reply?.context_summary);
  return { questions, contextSummary, salvaged, entries: rawQuestions.length, malformed };
}

/** The first of the reply's candidate JSON spans that parses, or undefined. */
function parseJson(text) {
  const candidates = [text];
  const fenced = text.match(/^\s*(`{3,}|~{3,})[^\n]*\n([\s\S]*?)\n[ \t]*\1\s*$/);
  if (fenced) candidates.push(fenced[2]);
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) candidates.push(text.slice(first, last + 1));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next candidate.
    }
  }
  return undefined;
}

/**
 * Recovers every complete object from the reply's `questions` array — or its
 * top-level array, when there is no such key — from text that does not parse
 * as a whole. A string-aware brace scan finds each top-level element, and each
 * is parsed on its own, so a reply cut off mid-question still yields the
 * questions before the cut.
 */
function salvageQuestions(text) {
  const key = text.search(/"questions"\s*:\s*\[/);
  const open = key === -1 ? text.indexOf('[') : text.indexOf('[', key);
  if (open === -1) return [];
  const found = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = open + 1; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0) {
        try {
          found.push(JSON.parse(text.slice(start, i + 1)));
        } catch {
          // An element that does not parse on its own is skipped.
        }
      }
    } else if (ch === ']' && depth === 0) {
      break;
    }
  }
  return found;
}

/**
 * Collapses a value to one line of text: every run of whitespace, line breaks
 * included, becomes a single space. Answers and options are rendered as list
 * items and the question as a numbered line, so a line break the model left in
 * one would end it early. Null bytes are dropped too — a submission containing
 * one is never assessed, so one here did not come from the student's code.
 */
function oneLine(value) {
  return typeof value === 'string' ? value.replace(/\0/g, '').replace(/\s+/g, ' ').trim() : '';
}

/**
 * Trims the spaces inside each inline code span, which the model sometimes
 * carries over from the code's indentation (`` ` $total` ``) and which would
 * otherwise show. A span that is only spaces, or that needs its padding to
 * hold a backtick, is left as it is.
 */
function trimCodeSpans(text) {
  return text.replace(/(`+)([^`]+?)\1(?!`)/g, (span, ticks, inner) => {
    const trimmed = inner.trim();
    return trimmed && !/^`|`$/.test(trimmed) ? `${ticks}${trimmed}${ticks}` : span;
  });
}

/**
 * Validates and normalises one question object from the reply, or returns
 * null when it lacks question text or an answer.
 *
 * Clears away what the model might carry over from the Markdown it was once
 * asked for: a number or "Question:" label on the question, a bullet or
 * "Answer:" label on an option, bold or backticks around a file name, a code
 * fence around a snippet, and spaces inside an inline code span. Snippets with no code are dropped. A missing
 * `distractors` is an empty list — the quiz workflow withholds a question
 * without options and says so.
 */
function normaliseQuestion(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const question = trimCodeSpans(
    oneLine(raw.question)
      .replace(/^(?:question\s*\d*\s*[:.)]\s*|\d+[.)]\s+)/i, '')
      .trim(),
  );
  const answer = cleanOption(raw.answer);
  if (!question || !answer) return null;

  const snippets = (Array.isArray(raw.snippets) ? raw.snippets : [])
    .map((s) => ({
      file: oneLine(s?.file).replace(/[`*]/g, '').trim(),
      language: /^[\w+#.-]+$/.test(oneLine(s?.language)) ? oneLine(s.language) : '',
      code: cleanCode(s?.code),
    }))
    .filter((s) => s.code);
  const distractors = (Array.isArray(raw.distractors) ? raw.distractors : [])
    .map(cleanOption)
    .filter(Boolean);

  return { snippets, question, answer, distractors, broader: raw.broader === true };
}

/** One answer option on one line, without a leading bullet or Answer: label. */
function cleanOption(value) {
  return trimCodeSpans(
    oneLine(value)
      .replace(/^[-*+]\s+/, '')
      .replace(/^\**answer:\**\s*/i, '')
      .trim(),
  );
}

/**
 * A snippet's code with Unix line endings, no wrapping fence, and no blank
 * lines or trailing whitespace at either end. Leading indentation of the first
 * line is kept.
 */
function cleanCode(value) {
  if (typeof value !== 'string') return '';
  let code = value.replace(/\0/g, '').replace(/\r\n?/g, '\n');
  const fenced = code.match(/^\s*(`{3,}|~{3,})[^\n]*\n([\s\S]*?)\n[ \t]*\1\s*$/);
  if (fenced) code = fenced[2];
  return code.replace(/^(?:[ \t]*\n)+/, '').replace(/\s+$/, '');
}

/**
 * Puts broader questions after the rest, as the report has always shown them,
 * and cuts the list to `maxQuestions`. Returns the kept questions and how many
 * were cut.
 */
export function arrangeQuestions(questions, maxQuestions) {
  const ordered = [...questions.filter((q) => !q.broader), ...questions.filter((q) => q.broader)];
  return {
    questions: ordered.slice(0, maxQuestions),
    surplus: Math.max(0, ordered.length - maxQuestions),
  };
}

/** Numbers the questions from 1, in order. */
export function numberQuestions(questions) {
  return questions.map((q, i) => ({ ...q, number: i + 1 }));
}

/**
 * Normalises a path, or a snippet's file name, for comparing one against the
 * other: forward slashes, no leading ./ or /, no trailing :line or :start-end
 * the model sometimes appends, and lower case, since the model does not
 * reliably preserve the capitalisation of a filename it copies.
 */
function normalisePathForMatch(p) {
  return p
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/:\d+(?:-\d+)?$/, '')
    .toLowerCase();
}

/**
 * A test for whether a snippet's file name is one of `paths`: that path or a
 * trailing part of it (`app.py` for `src/app.py`), compared as
 * normalisePathForMatch does.
 */
function pathMatcher(paths) {
  const normalised = paths.map(normalisePathForMatch);
  return (name) => {
    const n = normalisePathForMatch(name);
    return normalised.some((p) => p === n || p.endsWith(`/${n}`));
  };
}

/**
 * Removes the marker column the model copied into a snippet from a marked
 * file (see buildAssessedCodeContent in files.js).
 *
 * The prompt asks the model to drop the column, and it usually does. A
 * snippet from one of `markedFiles` still carries it when every non-blank
 * line begins with a marker and at least one with the added-line marker —
 * ordinary code, indented or not, virtually never does. Then the marker is
 * cut from each line, and removed lines, which are no longer in the file, go.
 *
 * Returns `{ questions, stripped }`, where `stripped` counts the snippets
 * changed.
 */
export function stripLineMarkers(questions, markedFiles) {
  if (markedFiles.length === 0) return { questions, stripped: 0 };
  const isMarked = pathMatcher(markedFiles);
  const { added, removed, unchanged } = LINE_MARKERS;
  const markers = new Set([added, removed, unchanged]);
  let stripped = 0;

  const result = questions.map((q) => {
    let changed = false;
    const snippets = q.snippets.map((s) => {
      if (!isMarked(s.file)) return s;
      const lines = s.code.split('\n');
      const content = lines.filter((line) => line.trim());
      if (!content.every((line) => markers.has(line[0]))) return s;
      if (!content.some((line) => line[0] === added)) return s;
      changed = true;
      stripped += 1;
      const code = lines
        .filter((line) => line[0] !== removed)
        .map((line) => line.slice(1))
        .join('\n');
      return { ...s, code: cleanCode(code) };
    });
    return changed ? { ...q, snippets } : q;
  });
  return { questions: result, stripped };
}

/**
 * Drops every question with a snippet from a file outside the assessed set.
 *
 * The model also sees material that is not being assessed — assignment
 * context, instructor context — and now and then writes a question about it,
 * or about a file name it invented. A snippet's file matches an assessed file
 * when it is that file's path or a trailing part of it (`app.py` for
 * `src/app.py`), compared case-insensitively. A question showing several files
 * goes if any one of them is unassessed. A question with no snippet is kept.
 *
 * `contextFiles` are the codebase context files: unchanged starter code and
 * earlier work. A question may show one of them beside the assessed code —
 * that is how it asks how the two fit together — so a context file is
 * allowed, but only in a question that also shows an assessed file. A question
 * showing context alone is about code that is not being assessed, and goes.
 *
 * Fails open: when every question would go, they are returned unchanged with
 * `failedOpen` set. That outcome says more about file names the matcher does
 * not recognise than about the questions, and an empty report helps no one.
 *
 * Returns `{ questions, dropped, unassessed, failedOpen }`, where `unassessed`
 * is the distinct file names that caused a drop.
 */
export function dropQuestionsOnUnassessedFiles(questions, assessedFiles, contextFiles = []) {
  const isAssessed = pathMatcher(assessedFiles);
  const isContext = pathMatcher(contextFiles);

  const kept = [];
  const unassessed = new Set();
  for (const q of questions) {
    const shown = q.snippets.map((s) => s.file).filter(Boolean);
    const assessedShown = shown.some(isAssessed);
    const offTarget = shown.filter((f) => !isAssessed(f) && !(assessedShown && isContext(f)));
    if (offTarget.length > 0) offTarget.forEach((f) => unassessed.add(f));
    else kept.push(q);
  }

  const dropped = questions.length - kept.length;
  if (dropped === 0) return { questions, dropped: 0, unassessed: [], failedOpen: false };
  if (kept.length === 0) {
    return { questions, dropped: 0, unassessed: [...unassessed], failedOpen: true };
  }
  return { questions: kept, dropped, unassessed: [...unassessed], failedOpen: false };
}

/** Normalises text to a lowercase alphanumeric word stream for fuzzy matching. */
function normaliseForMatch(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** True if a long contiguous run of the answer's words appears in the text. */
function answerLeaksInto(textNorm, answer) {
  const words = normaliseForMatch(answer).split(' ').filter(Boolean);
  // Short answers (e.g. `42`, `null`) overlap question text too often to test
  // reliably.
  if (words.length < 6) return false;
  const shingleSize = Math.min(8, words.length);
  for (let i = 0; i + shingleSize <= words.length; i++) {
    if (textNorm.includes(words.slice(i, i + shingleSize).join(' '))) return true;
  }
  return false;
}

/**
 * Returns the questions whose question text carries any question's correct
 * answer — the one place in the student view an answer could still appear,
 * typically because injected code talked the model into writing it there.
 *
 * Inline code spans are ignored: an answer that paraphrases the code shares a
 * run of identifiers with it, and the code is shown to the student on purpose.
 * Snippets are not checked for the same reason.
 */
export function findLeakedAnswers(questions) {
  return questions.filter((q) => carriesAnswer(q.question, questions));
}

/**
 * True when `text` carries any of the questions' correct answers, inline code
 * aside (see findLeakedAnswers). Also used on the context summary, which the
 * student's report shows as the Instructor Note.
 */
export function carriesAnswer(text, questions) {
  const textNorm = normaliseForMatch(text.replace(/`[^`]*`/g, ' '));
  return questions.some((q) => answerLeaksInto(textNorm, q.answer));
}

/**
 * Bolds a question's text around its inline code spans, so identifiers render
 * in code style only, and drops any bold the model added itself:
 *
 *   What does `x` return when `y` is null?
 *   → **What does** `x` **return when** `y` **is null?**
 */
function boldStem(text) {
  return text
    .split(/(`[^`]+`)/)
    .map((part) => {
      if (/^`[^`]+`$/.test(part)) return part;
      const plain = part.replace(/\*\*/g, '');
      const trimmed = plain.trim();
      if (!trimmed) return plain;
      const leading = plain.match(/^\s*/)[0];
      const trailing = plain.match(/\s*$/)[0];
      return `${leading}**${trimmed}**${trailing}`;
    })
    .join('');
}

/**
 * A code fence one backtick longer than any fence-like run at the start of a
 * line of the code, so a snippet of Markdown cannot close it early.
 */
function fenceFor(code) {
  const runs = code.match(/^[ \t]*`{3,}/gm) ?? [];
  const longest = Math.max(0, ...runs.map((run) => run.trim().length));
  return '`'.repeat(Math.max(3, longest + 1));
}

/**
 * Renders numbered questions (see numberQuestions) as Markdown, one block per
 * question, separated by `---`.
 *
 * `view` selects what each block carries below its question:
 *   - 'instructor' — the answer and distractors, inside the
 *     <!-- gmc:answer --> container generate-lms-quiz.yml reads positionally:
 *     first bullet the answer, the rest distractors. The headings are kept as
 *     its fallback, and for the instructor reading the file.
 *   - 'answers'    — the correct answer alone (include_answers).
 *   - 'student'    — nothing.
 *
 * Broader questions follow the rest under a `## Broader Questions` heading,
 * which sits inside the first broader question's block.
 */
export function renderQuestions(questions, { view }) {
  let broaderShown = false;
  const blocks = questions.map((q) => {
    const lines = [];
    if (q.broader && !broaderShown) {
      lines.push('## Broader Questions', '');
      broaderShown = true;
    }
    for (const { file, language, code } of q.snippets) {
      const fence = fenceFor(code);
      if (file) lines.push(`**\`${file}\`**`, '');
      lines.push(`${fence}${language}`, code, fence, '');
    }
    lines.push(`${q.number}. ${boldStem(q.question)}`);
    if (view === 'instructor') {
      lines.push('', '   <!-- gmc:answer -->', '   **Answer:**', `   - ${q.answer}`);
      if (q.distractors.length > 0) {
        lines.push(
          '',
          '   **Distractors for Multiple-Choice Quiz:**',
          ...q.distractors.map((d) => `   - ${d}`),
        );
      }
      lines.push('   <!-- /gmc:answer -->');
    } else if (view === 'answers') {
      lines.push('', '   **Answer:**', `   - ${q.answer}`);
    }
    return lines.join('\n');
  });
  return blocks.join('\n\n---\n\n');
}
