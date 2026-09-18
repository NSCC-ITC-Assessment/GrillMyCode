/**
 * AI Output Post-Processing
 *
 * Pure text transforms applied to the model's Markdown between the AI call and
 * delivery: separator and numbering normalisation, answer stripping, and the
 * fail-closed guards that decide what reaches the student.
 *
 * These live outside main.js so they can be tested directly. main.js is the
 * container entrypoint and runs an assessment on import, so nothing may import
 * it — which is why guarding its run() call was the wrong way round.
 */

import * as core from '@actions/core';

// The one-sentence summary the model appends after the final question (see
// prompt.js), which becomes the Instructor Note on the report. The closing
// marker is matched loosely — anything shaped like a closing SUMMARY comment —
// because gemini-3.5-flash-lite has been seen closing it as
// `<!-- /CONSAR_SUMMARY -->`. An exact matcher failed twice over on that one
// typo: the note vanished from the report, and the region went unstripped, so
// it rode along into the delivered Markdown where the sentence between the two
// comments renders as stray body text in the student's issue. Neither failure
// raised anything.
//
// With no closing marker at all the region ends at the blank line after the
// summary rather than at end of input. The summary is a single sentence, so
// that costs nothing when the marker is merely missing — while an opening
// marker that drifted into the middle of the response would otherwise swallow
// every question below it. Leaving one stray line is far better than silently
// deleting questions.
const CONTEXT_SUMMARY_RE =
  /<!--\s*CONTEXT_SUMMARY\s*-->[ \t]*\n?([\s\S]*?)(?:\n?[ \t]*<!--\s*\/\s*[A-Z_ ]*SUMMARY[A-Z_ ]*\s*-->|(?=\n[ \t]*\n)|$)\n*/i;
// Built from the same source so extraction and removal can never disagree about
// where the summary ended. Only the first match is extracted, but a model that
// emitted the markers more than once must not leave the extras behind.
const CONTEXT_SUMMARY_RE_G = new RegExp(CONTEXT_SUMMARY_RE.source, 'gi');
const CONTEXT_SUMMARY_CLOSE_RE = /<!--\s*\/CONTEXT_SUMMARY\s*-->/i;

/**
 * Splits the context summary out of the raw model response, returning the
 * summary text (empty when there is none) and the response with the whole
 * marked region removed. Drift in the closing marker is recovered from and
 * warned about, since a recovered summary looks identical to one that never
 * drifted and the run log is the only place the difference shows.
 */
export function extractContextSummary(text) {
  const match = text.match(CONTEXT_SUMMARY_RE);
  if (!match) return { summary: '', rest: text };
  if (!CONTEXT_SUMMARY_CLOSE_RE.test(text)) {
    core.warning(
      'The context summary did not close with <!-- /CONTEXT_SUMMARY --> — recovered it from ' +
        'the opening marker instead. Check the Instructor Note on the report.',
    );
  }
  return { summary: match[1].trim(), rest: text.replace(CONTEXT_SUMMARY_RE_G, '') };
}

/**
 * Ensures a --- thematic-break separator appears between every question block.
 * A block is identified by its bold filename header (**filename.ext** or **`filename.ext`**). Separators can
 * be missing either because the model drifted and omitted them, or because they
 * were consumed during answer stripping (see stripAnswers for the root-cause fix
 * that handles the container case; this is the safety net for model drift).
 * The first block header is never preceded by a separator.
 */
export function normaliseSeparators(text) {
  const lines = text.split('\n');
  const out = [];
  for (const line of lines) {
    if (/^\*\*`?[^\s`*]+\.[^\s`*]+`?\*\*$/.test(line) && out.length > 0) {
      let j = out.length - 1;
      while (j >= 0 && out[j].trim() === '') j--;
      if (j >= 0 && !/^-{3,}$/.test(out[j])) {
        while (out.length > 0 && out[out.length - 1].trim() === '') out.pop();
        out.push('', '---', '');
      }
    }
    out.push(line);
  }
  return out.join('\n');
}

// Markers the model wraps each answer block in (see prompt.js). They give the
// student-facing redaction an explicit region to remove rather than inferring
// answer boundaries from headings, and let the instructor copy drop just the
// markers while keeping the content. Both are tolerant of whitespace drift.
const ANSWER_REGION_RE =
  /[ \t]*<!--\s*gmc:answer\s*-->[\s\S]*?<!--\s*\/gmc:answer\s*-->[ \t]*\n?/gi;
export const ANSWER_MARKER_LINE_RE = /^[ \t]*<!--\s*\/?\s*gmc:answer\s*-->[ \t]*\n?/gim;

// A fence opens on a run of 3+ backticks or tildes (a backtick info string may
// not itself contain a backtick, or the line is inline code, not a fence). It
// closes only on a run of the same character at least as long, with nothing
// after it — so ~~~ inside a ``` block, or ``` inside a ```` block, is content.
const CODE_BLOCK_OPEN_RE = /^[ \t]*(`{3,}(?=[^`]*$)|~{3,})/;
const CODE_BLOCK_CLOSE_RE = /^[ \t]*(`{3,}|~{3,})\s*$/;
// The opening marker must start its line, so a marker quoted mid-sentence in
// question prose does not swallow every question after it. The closing marker
// may trail the final bullet, so it is matched anywhere on the line.
const ANSWER_OPEN_RE = /^[ \t]*<!--\s*gmc:answer\s*-->/i;
const ANSWER_CLOSE_RE = /<!--\s*\/\s*gmc:answer\s*-->/i;
// The same container with its interior captured, so the include_answers path
// can trim it from the inside rather than remove it whole.
const ANSWER_CONTAINER_RE = /(<!--\s*gmc:answer\s*-->)([\s\S]*?)(<!--\s*\/\s*gmc:answer\s*-->)/gi;
const OPTION_BULLET_RE = /^\s*[-*+]\s/;
const BARE_HEADING_RE = /^\s*\*\*[^*]+\*\*:?\s*$/;
const SEPARATOR_LINE_RE = /^\s*-{3,}\s*$/;

/**
 * Cuts an answer container's interior down to the correct answer alone, for the
 * include_answers view. Read positionally — the first answer is correct and
 * everything after it is a distractor — which is the rule generate-lms-quiz.yml
 * parses the same container by. Matching the distractor heading literally
 * instead let every option through whenever the model drifted on it (observed:
 * the heading emitted as `<!-- Distractors for Multiple-Choice Quiz: -->`), so
 * a student shown the answers was shown the distractors beside it too.
 *
 * The answer ends at whichever comes first: a second bullet, a line naming the
 * distractors in any form, a --- separator, or the first blank line after the
 * answer content. The blank line is what stops an inline or fenced answer —
 * neither is a bullet — from keeping the first distractor as though it were the
 * answer. A bare bold heading such as **Answer:** is not answer content. Every
 * stop errs towards dropping text: a truncated answer costs the student a line,
 * a leaked distractor misleads them.
 *
 * A --- the model placed inside the container is re-emitted rather than dropped
 * with the distractors, as pass 0 of stripAnswers does, so the rule between two
 * questions survives the trim.
 */
function keepOnlyAnswer(inner) {
  const lines = inner.split('\n');
  let answered = false;
  let bullets = 0;
  let end = lines.length;
  for (const [i, line] of lines.entries()) {
    const blank = line.trim() === '';
    const stop = OPTION_BULLET_RE.test(line)
      ? ++bullets > 1
      : /distractor/i.test(line) || SEPARATOR_LINE_RE.test(line) || (blank && answered);
    if (stop) {
      end = i;
      break;
    }
    if (!blank && !BARE_HEADING_RE.test(line)) answered = true;
  }
  // Blank line first, so a --- under a plain-text answer is not read as a
  // setext heading underline.
  const separators = lines
    .slice(end)
    .filter((line) => SEPARATOR_LINE_RE.test(line))
    .flatMap(() => ['', '---']);
  return [...lines.slice(0, end), ...separators].join('\n');
}

/**
 * Applies `transform` to each top-level line — one outside every fenced code
 * block and every <!-- gmc:answer --> region — and returns all other lines
 * untouched. The single notion of "top level" shared by every pass that
 * rewrites question stems, so none of them can reach into student code or
 * answer content.
 *
 * An unclosed fence or answer region runs to the end of the text: its lines are
 * left alone rather than guessed at.
 */
function mapTopLevelLines(text, transform) {
  const lines = text.split('\n');
  const topLevel = topLevelFlags(lines);
  return lines.map((line, i) => (topLevel[i] ? transform(line) : line)).join('\n');
}

/**
 * Marks each line true when it is top-level, as defined by mapTopLevelLines.
 * With `answers: false` only fenced code counts as nested, and every line of an
 * answer region is top-level.
 */
function topLevelFlags(lines, { answers = true } = {}) {
  let fence = null;
  let inAnswer = false;
  return lines.map((line) => {
    if (fence) {
      const close = line.match(CODE_BLOCK_CLOSE_RE);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = null;
      return false;
    }
    const open = line.match(CODE_BLOCK_OPEN_RE);
    if (open) {
      fence = open[1];
      return false;
    }
    if (answers && ANSWER_OPEN_RE.test(line)) {
      inAnswer = !ANSWER_CLOSE_RE.test(line);
      return false;
    }
    if (inAnswer) {
      if (ANSWER_CLOSE_RE.test(line)) inAnswer = false;
      return false;
    }
    return true;
  });
}

// A numbered stem, capturing its number. `$` as well as `\s` so a bare "2." at
// the end of a line still counts, as it did when this was a multiline regex.
const QUESTION_STEM_RE = /^\s*(\d+)\.(?:\s|$)/;

/** Counts top-level numbered question stems, ignoring code blocks and answers. */
export function countQuestions(text) {
  const lines = text.split('\n');
  const topLevel = topLevelFlags(lines);
  return lines.filter((line, i) => topLevel[i] && QUESTION_STEM_RE.test(line)).length;
}

/**
 * Renumbers the question stems sequentially from 1.
 *
 * Some models emit every stem as `1.` because the anatomy template in the prompt shows a
 * single question numbered `1.`. Markdown then renders three questions all
 * labelled "1.". Numbering is purely presentational, so it is fixed
 * deterministically here rather than trusted to the model. Runs before
 * truncateToMaxQuestions, which needs real numbers to spot over-generation.
 *
 * Only top-level stems are touched: lines inside fenced code blocks and inside
 * <!-- gmc:answer --> regions keep whatever numbering they carry.
 */
export function renumberQuestions(text) {
  let n = 0;
  return mapTopLevelLines(text, (line) => {
    if (!/^\s*\d+\.\s/.test(line)) return line;
    n += 1;
    return line.replace(/^(\s*)\d+\./, `$1${n}.`);
  });
}

/**
 * Bolds the question sentence on every numbered question line. Applied in
 * post-processing so the result is deterministic regardless of whether the
 * model followed the formatting instruction. Skips lines already wrapped in
 * bold, fenced code blocks (student code is shown verbatim), and the
 * <!-- gmc:answer --> interior so answer headings and bullets are never touched.
 *
 *   1. What does `x` return?   →   1. **What does `x` return?**
 */
export function boldQuestionLines(text) {
  return mapTopLevelLines(text, (line) => line.replace(/^(\s*\d+\. )(?!\*\*)(.+)$/m, '$1**$2**'));
}

/**
 * Splits bold markers around inline code spans on question-sentence lines so
 * that backtick-wrapped identifiers render in code style only, not bold.
 *
 * Input:  1. **What does `x` return when `y` is null?**
 * Output: 1. **What does** `x` **return when** `y` **is null?**
 *
 * Only top-level lines beginning with a question number are touched; filename
 * headers (**`file.ext`**), answer headings (**Answer:**), and anything inside
 * a fenced code block or answer region are left unchanged.
 */
export function splitBoldAroundCode(text) {
  return mapTopLevelLines(text, splitBoldLine);
}

function splitBoldLine(line) {
  return line.replace(/^(\s*\d+\. )(\*\*.+\*\*)$/m, (_, prefix, boldText) => {
    if (!boldText.includes('`')) return prefix + boldText;
    const inner = boldText.slice(2, -2);
    const rebuilt = inner
      .split(/(`[^`]+`)/)
      .map((part) => {
        if (part.startsWith('`')) return part;
        const trimmed = part.trim();
        if (!trimmed) return part;
        const leading = part.match(/^\s*/)[0];
        const trailing = part.match(/\s*$/)[0];
        return `${leading}**${trimmed}**${trailing}`;
      })
      .join('');
    return prefix + rebuilt;
  });
}

/**
 * Strips distractor content from AI-generated Q+A output.
 *
 * Incorrect options for quiz (header + bullets) are always removed — they are
 * generated solely to enable quiz-style delivery and should not appear in
 * any rendered report.
 *
 * The correct answer is removed only when keepAnswers is false
 * (i.e. when producing student-facing output without include_answers).
 * Removal is layered for resilience against model formatting drift:
 *   0. Container removal: strips each explicitly marked <!-- gmc:answer --> …
 *      <!-- /gmc:answer --> region as a unit — the reliable, primary path.
 *   1. Block fallback: strips **Answer:** heading + everything up to
 *      **Distractors for Multiple-Choice Quiz:** for any answer the model
 *      emitted without the markers.
 * An answer with neither form is not stripped at all: redactStudentQuestions
 * withholds its question instead, which is why the student view goes through
 * that and not through this function directly. It runs this one question block
 * at a time, so a --- the model placed inside a container never reaches here —
 * run over a whole report, pass 0 would remove such a --- with its container.
 *
 * With keepAnswers, each marked container is instead trimmed to its correct
 * answer by position (see keepOnlyAnswer), with a literal distractor-heading
 * match as the fallback for answers emitted without the container.
 *
 * Stray markers are always removed (so they never surface, including on the
 * keepAnswers path). Collapses any resulting triple+ blank lines to a double.
 */
export function stripAnswers(text, { keepAnswers = false } = {}) {
  let result = text;

  // Protect fenced code blocks so that marker strings embedded in student-
  // submitted code (e.g. const MARKER = '<!-- gmc:answer -->') are never
  // matched by the answer-region regexes and do not corrupt question output.
  //
  // The sentinels are load-bearing, and they are null bytes for a specific
  // reason: collectRawFiles drops any file containing one, so a student cannot
  // get the sentinel into their submission at all. The Private Use Area
  // codepoints used previously had no such barrier — a student who pasted
  // U+E001 into their source could have the model echo it back in question
  // prose and hijack the restore pass below.
  const fences = [];
  result = result.replace(/^(`{3,})[^\n]*\n[\s\S]*?\n\1[ \t]*$/gm, (match) => {
    fences.push(match);
    return `\0FENCE${fences.length - 1}\0`;
  });

  if (!keepAnswers) {
    // Pass 0: container-based — remove each marked answer region as a unit.
    result = result.replace(ANSWER_REGION_RE, '\n');
    // Pass 1: block-based — strip **Answer:** heading and everything below it
    // through to **Distractors for Multiple-Choice Quiz:**, covering all answer formats.
    //
    // The lookahead is anchored on the block separator and end-of-input as well
    // as the distractor heading. Without those alternatives the lazy quantifier
    // could not stop at the end of its own block: a block whose distractor
    // heading the model re-worded has no match inside itself, so the region ran
    // forward to the next block that did have one, deleting every question in
    // between. Pass 0 normally removes the answer before this pass ever sees it,
    // which is why the bleed stayed latent — it needs the container markers to be
    // absent and the heading to have drifted, and it deletes neighbouring
    // questions outright when both hold. Stopping at the separator also preserves
    // the stray-`---`-inside-the-answer case instead of swallowing the rule.
    result = result.replace(
      / {0,4}\*\*Answer:\*\*[\s\S]*?(?=\n {0,4}\*\*Distractors for Multiple-Choice Quiz:\*\*|\n-{3,}\n|$)/g,
      '',
    );
  } else {
    // include_answers: trim each marked container to its correct answer. The
    // closing marker is put back on a line of its own so the marker sweep
    // below removes it, whatever the trim left in front of it.
    result = result.replace(
      ANSWER_CONTAINER_RE,
      (_, open, inner, close) => `${open}${keepOnlyAnswer(inner)}\n${close}`,
    );
  }
  result = result.replace(ANSWER_MARKER_LINE_RE, '');
  if (keepAnswers) {
    // Fallback for answers the model emitted without the container: drop the
    // distractor heading plus the bullets that immediately follow it. Matched
    // literally, so it depends on the heading being right — the container
    // trim above does not.
    result = result.replace(
      /^ {0,4}\*\*Distractors for Multiple-Choice Quiz:\*\*[^\n]*(?:\n {0,4}-[^\n]*)*\n?/gm,
      '',
    );
  } else {
    // Student view: remove the distractor heading and every remaining bullet so
    // no answer-like content can survive.
    result = result
      .replace(/^ {0,4}\*\*Distractors for Multiple-Choice Quiz:\*\*[^\n]*/gm, '')
      .replace(/^ {0,4}- [^\n]*/gm, '');
  }
  // Restore fenced code blocks now that all marker processing is complete.
  // An index outside the table cannot arise from the substitution above, so
  // leave such a match as it stands rather than writing `undefined` into a
  // student's question.
  result = result.replace(/\0FENCE(\d+)\0/g, (match, i) => fences[Number(i)] ?? match);
  // Nothing this function introduced still carries a sentinel by now, and a
  // null byte from anywhere else has no business in a Markdown report.
  return result.replace(/\0/g, '').replace(/\n{3,}/g, '\n\n');
}

/** Normalises text to a lowercase alphanumeric word stream for fuzzy matching. */
function normaliseForMatch(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Extracts the correct-answer text of each question from output that still
 * contains answers (i.e. the un-stripped copy). Captures either an inline
 * answer on the **Answer:** line or the first bullet beneath it. Used as the
 * oracle for the answer-leak backstop below.
 */
export function extractCorrectAnswers(text) {
  const answers = [];
  const re = /\*\*Answer:\*\*[ \t]*\n?(?: {0,4}-[ \t]*)?([^\n]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const answer = m[1].trim();
    if (answer) answers.push(answer);
  }
  return answers;
}

/**
 * Removes code from a block before the leak check runs against it.
 *
 * The code snippet is intentionally shown to the student, so it must never be
 * treated as leaked answer text. Because `normaliseForMatch` discards all
 * punctuation, a correct answer that paraphrases the code (common for
 * output-trace and execution-flow questions) produces a run of shared
 * identifiers/keywords that collides with the visible code — a false leak.
 * Stripping fenced blocks and inline spans leaves only prose, which is the only
 * place a genuinely leaked answer could survive.
 */
function stripCodeForLeakCheck(block) {
  return block.replace(/^(`{3,})[^\n]*\n[\s\S]*?\n\1[ \t]*$/gm, ' ').replace(/`[^`]*`/g, ' ');
}

/** True if a long contiguous run of the answer's words appears in the block. */
function answerLeaksInto(blockNorm, answer) {
  const words = normaliseForMatch(answer).split(' ').filter(Boolean);
  // Short answers (e.g. `42`, `null`) overlap question text too often to test
  // reliably; the structural strip already covers their bullets.
  if (words.length < 6) return false;
  const shingleSize = Math.min(8, words.length);
  for (let i = 0; i + shingleSize <= words.length; i++) {
    if (blockNorm.includes(words.slice(i, i + shingleSize).join(' '))) return true;
  }
  return false;
}

/**
 * Splits a report into question blocks at every --- line outside fenced code,
 * so a YAML or Markdown snippet carrying its own --- stays whole. A --- inside
 * an answer container does split: that keeps the question after it in a block
 * of its own even when the model drops a closing marker, and the torn halves
 * are still stripped by pass 1 and the bullet sweep.
 */
function splitQuestionBlocks(text) {
  const lines = text.split('\n');
  const outsideFence = topLevelFlags(lines, { answers: false });
  const blocks = [[]];
  lines.forEach((line, i) => {
    if (outsideFence[i] && /^-{3,}$/.test(line)) blocks.push([]);
    else blocks.at(-1).push(line);
  });
  return blocks.map((block) => block.join('\n'));
}

/**
 * Counts the answer structures in a block that stripAnswers can reliably
 * remove, taking whichever of the two forms is more numerous:
 *   - the **Answer:** heading, which pass 1 keys on; or
 *   - a complete <!-- gmc:answer --> … <!-- /gmc:answer --> container, which
 *     pass 0 strips as a unit even when the heading inside is malformed or
 *     absent — matched by the very regex pass 0 uses, so the two cannot
 *     disagree. A lone opening marker is not stripped by pass 0, so it does
 *     not count.
 */
function countAnswerStructures(block) {
  const headings = block.match(/\*\*Answer:\*\*/g)?.length ?? 0;
  const containers = block.match(ANSWER_REGION_RE)?.length ?? 0;
  return Math.max(headings, containers);
}

/**
 * Fail-closed student-facing view of the answer-bearing report. Each question
 * block is stripped on its own, and withheld when either guard trips:
 *
 *   1. Structural: the block has more question stems than answer structures,
 *      so at least one question's answer is in a form stripAnswers does not
 *      remove (covers answers the model was injected into emitting inline, or
 *      in a fenced block, with no **Answer:** heading). Counted rather than
 *      merely present, so a drifted question cannot ride through on a
 *      well-formed neighbour when a missing separator or an unclosed fence
 *      puts both in one block.
 *   2. Leak: any question's correct-answer text still appears in the stripped
 *      block (covers answers echoed outside their container alongside a normal
 *      answer block).
 *
 * Returns the surviving questions plus a per-guard breakdown (`structural`,
 * `leak`) and the total `dropped`, so callers can report which guard fired.
 * Each counts questions withheld, not blocks — a withheld block takes every
 * question in it.
 */
export function redactStudentQuestions(originalText) {
  const correctAnswers = extractCorrectAnswers(originalText);
  let structural = 0;
  let leak = 0;
  const kept = [];

  for (const block of splitQuestionBlocks(originalText)) {
    const stems = countQuestions(block);
    if (stems > countAnswerStructures(block)) {
      structural += stems;
      continue;
    }
    const stripped = stripAnswers(block);
    const blockNorm = normaliseForMatch(stripCodeForLeakCheck(stripped));
    if (correctAnswers.some((answer) => answerLeaksInto(blockNorm, answer))) {
      leak += stems || 1;
      continue;
    }
    kept.push(stripped.replace(/^\n+|\n+$/g, ''));
  }

  return { text: kept.join('\n\n---\n\n'), structural, leak, dropped: structural + leak };
}

/**
 * Truncates AI output to at most `maxQuestions` numbered questions.
 *
 * If the model over-generates (e.g. produces more questions than were
 * requested because it hit the token limit), this finds the start of question
 * maxQuestions+1 and removes everything from that point onward. Only top-level
 * stems count: a numbered line inside student code or an answer region is not a
 * question, and must not cut the report off mid-question.
 */
export function truncateToMaxQuestions(text, maxQuestions) {
  const lines = text.split('\n');
  const topLevel = topLevelFlags(lines);
  const overflow = lines.findIndex(
    (line, i) => topLevel[i] && line.match(QUESTION_STEM_RE)?.[1] === String(maxQuestions + 1),
  );
  if (overflow !== -1) {
    core.warning(
      `AI generated more than ${maxQuestions} questions — truncating to the requested count.`,
    );
    return lines.slice(0, overflow).join('\n').trimEnd();
  }
  return text;
}
