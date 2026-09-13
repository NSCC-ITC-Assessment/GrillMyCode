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
  let inFence = false;
  let inAnswer = false;
  let n = 0;
  return text
    .split('\n')
    .map((line) => {
      if (/^\s*(?:```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      if (/<!--\s*gmc:answer\s*-->/i.test(line)) {
        inAnswer = true;
        return line;
      }
      if (/<!--\s*\/\s*gmc:answer\s*-->/i.test(line)) {
        inAnswer = false;
        return line;
      }
      if (inAnswer || !/^\s*\d+\.\s/.test(line)) return line;
      n += 1;
      return line.replace(/^(\s*)\d+\./, `$1${n}.`);
    })
    .join('\n');
}

/**
 * Bolds the question sentence on every numbered question line. Applied in
 * post-processing so the result is deterministic regardless of whether the
 * model followed the formatting instruction. Skips lines already wrapped in
 * bold, and skips the <!-- gmc:answer --> interior so answer headings and
 * bullets are never touched.
 *
 *   1. What does `x` return?   →   1. **What does `x` return?**
 */
export function boldQuestionLines(text) {
  return text.replace(/^(\s*\d+\. )(?!\*\*)(.+)$/gm, '$1**$2**');
}

/**
 * Splits bold markers around inline code spans on question-sentence lines so
 * that backtick-wrapped identifiers render in code style only, not bold.
 *
 * Input:  1. **What does `x` return when `y` is null?**
 * Output: 1. **What does** `x` **return when** `y` **is null?**
 *
 * Only lines beginning with a question number are touched; filename headers
 * (**`file.ext`**) and answer headings (**Answer:**) are left unchanged.
 */
export function splitBoldAroundCode(text) {
  return text.replace(/^(\s*\d+\. )(\*\*.+\*\*)$/gm, (_, prefix, boldText) => {
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
 *   1. Block fallback: strips **Answer:** heading + everything up to **Incorrect
 *      Options for Quiz:** for any answer the model emitted without the markers.
 *   2. Positional fallback: strips any plain-text content sitting between a question
 *      line and **Distractors for Multiple-Choice Quiz:** when the **Answer:** label was absent.
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
    // Protect --- separators first: the model sometimes places them inside the
    // container (before the closing marker), and ANSWER_REGION_RE would consume
    // them along with the answer block. Placeholder round-trips them safely.
    // Null-byte sentinel for the same reason as the fence placeholder above.
    const SEP = '\0GMC_SEP\0';
    result = result.replace(/^-{3,}$/gm, SEP);
    // Re-emit every separator the container swallowed. ANSWER_REGION_RE is lazy
    // but still spans everything between the markers, so a --- the model placed
    // inside the container goes with it — swapping it for a placeholder first
    // does not save it, which is why this substitution sat here doing nothing.
    //
    // Losing one matters well beyond the missing rule: redactStudentQuestions
    // aligns the student view against the answer-bearing original by splitting
    // both on ---, and when the counts disagree it silently disables its
    // structural guard for the entire assessment, not just the affected
    // question. That guard is the only thing that catches an answer emitted
    // inside a fenced block, because the leak guard strips fenced code before
    // it looks.
    result = result.replace(ANSWER_REGION_RE, (region) => {
      const swallowed = region.match(/\0GMC_SEP\0/g)?.length ?? 0;
      return '\n' + `${SEP}\n`.repeat(swallowed);
    });
    result = result.replace(/\0GMC_SEP\0/g, '---');
    // Pass 1: block-based — strip **Answer:** heading and everything below it
    // through to **Distractors for Multiple-Choice Quiz:**, covering all answer formats.
    result = result.replace(
      / {0,4}\*\*Answer:\*\*[\s\S]*?(?=\n {0,4}\*\*Distractors for Multiple-Choice Quiz:\*\*)/g,
      '',
    );
    // Pass 2: positional fallback — if **Answer:** label was absent entirely,
    // strip any plain-text line between the question line and **Incorrect Options**.
    result = result.replace(
      /(\n {0,4}\d+\.[^\n]+\n)\n(?! {0,4}\*\*)[^\n]+\n(?=\n {0,4}\*\*Distractors for Multiple-Choice Quiz:\*\*)/g,
      '$1\n',
    );
  }
  result = result.replace(ANSWER_MARKER_LINE_RE, '');
  if (keepAnswers) {
    // include_answers: keep the correct-answer bullet; drop only the quiz-only
    // distractor block — its heading plus the bullets that immediately follow.
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

/** True if the block looks like a generated question (has a numbered stem). */
function isQuestionBlock(block) {
  return /^\s*\d+\.\s/m.test(block);
}

/**
 * True if the block carries a recognisable answer structure that stripAnswers can
 * reliably remove. Two forms qualify:
 *   - the **Answer:** heading, which the block/positional strip passes key on; or
 *   - a complete <!-- gmc:answer --> … <!-- /gmc:answer --> container, which the
 *     primary container-removal pass strips as a unit even when the heading inside
 *     is malformed or absent.
 * Both markers of the container must be present — a lone opening marker would not
 * be stripped by the container pass and could leave the answer in the student view,
 * so it does not count as proof. A block with neither form means the strip never
 * engaged and the leak check has no answer to verify, so the structural guard drops it.
 */
function hasAnswerStructure(block) {
  return (
    /\*\*Answer:\*\*/.test(block) ||
    /<!--\s*gmc:answer\s*-->[\s\S]*?<!--\s*\/gmc:answer\s*-->/i.test(block)
  );
}

/**
 * Fail-closed student-facing filter. Operates per question block (aligned by the
 * `---` separators between the answer-bearing original and the stripped output)
 * and withholds a question when either guard trips:
 *
 *   1. Structural: the original question carried no recognisable answer block, so
 *      we cannot trust the stripped view to be answer-free (covers answers the
 *      model was injected into emitting inline with no **Answer:** heading).
 *   2. Leak: the correct-answer text still appears in the stripped block (covers
 *      answers echoed outside their container alongside a normal answer block).
 *
 * If the two views don't split into the same number of blocks, the structural
 * guard is skipped (we never mis-drop on misaligned boundaries) and only the
 * leak guard runs. Returns the surviving questions plus a per-guard breakdown
 * (`structural`, `leak`) and the total `dropped`, so callers can report which
 * guard fired.
 */
export function redactStudentQuestions(originalText, studentText, correctAnswers) {
  const origBlocks = originalText.split(/\n-{3,}\n/);
  const studentBlocks = studentText.split(/\n-{3,}\n/);
  const aligned = origBlocks.length === studentBlocks.length;
  let structural = 0;
  let leak = 0;

  const kept = studentBlocks.filter((studentBlock, i) => {
    const origBlock = aligned ? origBlocks[i] : '';
    if (aligned && isQuestionBlock(origBlock) && !hasAnswerStructure(origBlock)) {
      structural++;
      return false;
    }
    const blockNorm = normaliseForMatch(stripCodeForLeakCheck(studentBlock));
    if (correctAnswers.some((answer) => answerLeaksInto(blockNorm, answer))) {
      leak++;
      return false;
    }
    return true;
  });

  return { text: kept.join('\n\n---\n\n'), structural, leak, dropped: structural + leak };
}

/**
 * Truncates AI output to at most `maxQuestions` numbered questions.
 *
 * If the model over-generates (e.g. produces more questions than were
 * requested because it hit the token limit), this finds the start of question
 * maxQuestions+1 and removes everything from that point onward.
 */
export function truncateToMaxQuestions(text, maxQuestions) {
  // Questions are numbered: "1.", "2.", … at the start of a line (possibly
  // preceded by whitespace). Look for the start of question maxQuestions+1.
  const overflowPattern = new RegExp(`(?:^|\\n)(?=\\s*${maxQuestions + 1}\\.\\s)`);
  const match = overflowPattern.exec(text);
  if (match) {
    core.warning(
      `AI generated more than ${maxQuestions} questions — truncating to the requested count.`,
    );
    return text.substring(0, match.index).trimEnd();
  }
  return text;
}
