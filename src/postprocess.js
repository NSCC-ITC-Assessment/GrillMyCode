/**
 * AI Output Post-Processing
 *
 * The model replies with a JSON object (see prompt.js). This module turns that
 * reply into question objects, filters them, and renders the three Markdown
 * views of them: the instructor copy, the include_answers copy, and the
 * student copy.
 *
 * GrillMyCode writes every piece of Markdown structure itself — numbering,
 * filename headers, code fences, the separators — so the layout is the same
 * whatever the model does. The student view is built from the question objects without
 * their answers, rather than by removing answers from text, so no formatting
 * slip can carry an answer into it.
 *
 * These live outside main.js so they can be tested directly. main.js is the
 * container entrypoint and runs an assessment on import, so nothing may import
 * it.
 */

import { SNIPPET_MAX_LINES } from './constants.js';

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
 * Each question is then normalised (see normaliseQuestion) and given its
 * 1-based position among the reply's `entries` as `entry`, so a warning about
 * it can say where to find it in the raw output. One without question text or
 * an answer cannot be shown or assessed, so it is dropped and its position is
 * listed in `malformed`.
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
    if (question) questions.push({ ...question, entry: i + 1 });
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
 * Every text field is collapsed to one line with its inline code spans
 * trimmed. A snippet is only a reference here — `{ file, start, end }`, the
 * file and the first and last line to show — which resolveSnippets turns into
 * code. A line number that is not a whole number is kept as NaN, so the
 * question fails there. A missing `distractors` is an empty list — the quiz
 * workflow withholds a question without options and says so.
 */
function normaliseQuestion(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const question = cleanText(raw.question);
  const answer = cleanText(raw.answer);
  if (!question || !answer) return null;

  const snippets = (Array.isArray(raw.snippets) ? raw.snippets : []).map((s) => ({
    file: oneLine(s?.file),
    start: lineNumber(s?.start_line),
    end: lineNumber(s?.end_line),
  }));
  const distractors = (Array.isArray(raw.distractors) ? raw.distractors : [])
    .map(cleanText)
    .filter(Boolean);

  return { snippets, question, answer, distractors, broader: raw.broader === true };
}

/** One line of text with its inline code spans trimmed. */
function cleanText(value) {
  return trimCodeSpans(oneLine(value));
}

/** A line number from the reply — a whole number, or one written as a string — or NaN. */
function lineNumber(value) {
  const n = typeof value === 'string' && /^\s*\d+\s*$/.test(value) ? Number(value) : value;
  return Number.isInteger(n) ? n : NaN;
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
 * other: forward slashes, no leading ./ or /, no backticks or asterisks, no
 * trailing :line or :start-end the model sometimes appends, and lower case,
 * since the model does not reliably preserve the capitalisation of a filename
 * it copies.
 */
function normalisePathForMatch(p) {
  return p
    .replace(/[`*]/g, '')
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/:\d+(?:-\d+)?$/, '')
    .toLowerCase();
}

/**
 * The source a snippet's file name refers to: the one whose path it is, or
 * else the only one whose path ends with it (`app.py` for `src/app.py`),
 * compared as normalisePathForMatch does. A name that matches several files,
 * or none, refers to nothing.
 */
function findSource(name, sources) {
  const n = normalisePathForMatch(name);
  if (!n) return undefined;
  const exact = sources.filter((s) => normalisePathForMatch(s.filepath) === n);
  if (exact.length === 1) return exact[0];
  const suffix = sources.filter((s) => normalisePathForMatch(s.filepath).endsWith(`/${n}`));
  return exact.length === 0 && suffix.length === 1 ? suffix[0] : undefined;
}

/**
 * Turns each question's snippet references into code, read from the files the
 * model was sent, and drops the questions that cannot be shown or are not
 * about the student's work.
 *
 * The model names a snippet by file and line numbers instead of copying it, so
 * what the report shows is always the submitted code itself — never a line the
 * model misremembered, cut short or made up. `sources` are the files it was
 * sent, from buildAssessedCodeContent and selectCodebaseContext in files.js.
 *
 * A question is dropped as `unresolved` when any of its snippets names a file
 * it was not sent, a line outside that file, a range that runs backwards, one
 * longer than SNIPPET_MAX_LINES, or only blank lines. An end past the last line
 * is read as the last line. Blank lines at either end of a range are left out.
 *
 * A question is dropped as `notStudentWork` when none of its snippets shows a
 * line the student wrote in this submission: any line of a new file, or an
 * added line of a marked one. Codebase context counts for nothing, so a
 * question showing only context, or only the unchanged lines of a starter
 * file, goes. A question with no snippet — a broader question — is kept.
 *
 * Each kept snippet is `{ file, language, code, start, end }`, with the file's
 * path as sent and its extension as the language.
 *
 * Returns `{ questions, unresolved, notStudentWork }`. Each dropped question is
 * kept whole, with `named` added: the snippets as the model named them — for
 * `unresolved`, only the one that failed — so a warning can point at it (see
 * describeDropped). A `notStudentWork` question's snippets are read like a kept
 * one's; an `unresolved` question's are the ranges it named, with no code, as
 * there may be none to read.
 */
export function resolveSnippets(questions, sources) {
  const kept = [];
  const unresolved = [];
  const notStudentWork = [];

  for (const q of questions) {
    const snippets = [];
    let studentWork = false;
    let failed;
    for (const ref of q.snippets) {
      failed = ref;
      const source = findSource(ref.file, sources);
      if (!source) break;
      let { start } = ref;
      let end = Math.min(ref.end, source.lines.length);
      if (!(start >= 1 && start <= end && end - start < SNIPPET_MAX_LINES)) break;
      while (start <= end && !source.lines[start - 1].trim()) start += 1;
      while (end >= start && !source.lines[end - 1].trim()) end -= 1;
      if (start > end) break;
      snippets.push({
        file: source.filepath,
        language: languageOf(source.filepath),
        code: source.lines
          .slice(start - 1, end)
          .join('\n')
          .replace(/\s+$/, ''),
        start,
        end,
      });
      const { studentLines } = source;
      for (let n = start; n <= end && !studentWork; n++) {
        studentWork = studentLines === 'all' || studentLines.has(n);
      }
    }
    if (snippets.length < q.snippets.length) {
      const named = q.snippets.map(({ file, start, end }) => ({
        file,
        language: '',
        code: '',
        start,
        end,
      }));
      unresolved.push({ ...q, snippets: named, named: [failed] });
    } else if (snippets.length > 0 && !studentWork) {
      notStudentWork.push({ ...q, snippets, named: q.snippets });
    } else kept.push({ ...q, snippets });
  }

  return { questions: kept, unresolved, notStudentWork };
}

/**
 * A snippet's lines as the student's file numbers them: `line 12` or
 * `lines 28–37`. The numbers are the file's own (see stripCommentsFromFiles in
 * files.js), so the student can find the code in their editor.
 */
export function describeLines(start, end) {
  return start === end ? `line ${start}` : `lines ${start}–${end}`;
}

/**
 * Where to find questions resolveSnippets dropped, for a warning: each one's
 * position among the reply's `entries` and the snippets it `named`, as in
 * `entry 7 of 12: game.js lines 40–46`. A line number that was not a whole
 * number shows as `?`.
 */
export function describeDropped(dropped, entries) {
  const n = (v) => (Number.isInteger(v) ? v : '?');
  return dropped
    .map(({ entry, named }) => {
      const refs = named.map(
        ({ file, start, end }) => `${file || '(no file)'} ${describeLines(n(start), n(end))}`,
      );
      return `entry ${entry} of ${entries}: ${refs.join(', ')}`;
    })
    .join('; ');
}

/**
 * The code fence language for a file: its extension, which GitHub, the PDF's
 * highlighter and the quiz's highlighter all take, or '' when it has none a
 * fence can carry.
 */
function languageOf(filepath) {
  const ext = filepath.split('/').pop().split('.').slice(1).pop() ?? '';
  return /^[\w+#-]+$/.test(ext) ? ext.toLowerCase() : '';
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
 * Returns the questions that name a line number — "line 28", "lines 14–16" —
 * in their question, answer or distractors. The prompt forbids it: the report
 * gives each snippet's range in its caption but no number on each line, so
 * the student would have to count down the snippet, or open the file, to
 * follow the question.
 */
export function findLineReferences(questions) {
  const namesLine = (text) => /\blines?\s+\d/i.test(text);
  return questions.filter((q) => [q.question, q.answer, ...q.distractors].some(namesLine));
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
 * question, separated by `---`. Each block opens with its `**Question N:**`
 * label, then the snippets, then the question text.
 *
 * `view` selects what each block carries below its question:
 *   - 'instructor' — the answer and distractors.
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
    lines.push(`**Question ${q.number}:**`, '');
    for (const { file, language, code, start, end } of q.snippets) {
      const fence = fenceFor(code);
      if (file) lines.push(`**\`${file}\`**, ${describeLines(start, end)}`, '');
      lines.push(`${fence}${language}`, code, fence, '');
    }
    lines.push(boldStem(q.question));
    if (view === 'instructor') {
      lines.push('', '**Answer:**', `- ${q.answer}`);
      if (q.distractors.length > 0) {
        lines.push(
          '',
          '**Distractors for Multiple-Choice Quiz:**',
          ...q.distractors.map((d) => `- ${d}`),
        );
      }
    } else if (view === 'answers') {
      lines.push('', '**Answer:**', `- ${q.answer}`);
    }
    return lines.join('\n');
  });
  return blocks.join('\n\n---\n\n');
}
