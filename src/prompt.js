/**
 * Prompt Builder
 *
 * Constructs the system and user messages sent to the AI provider.
 * Contains the full assessment rubric and formatting instructions.
 */

/**
 * Builds the [system, user] message array for the chat completions API.
 *
 * The system prompt is assembled in three tiers, ordered from lowest to highest
 * priority. LLMs exhibit recency bias — later content in the prompt carries more
 * weight — so higher-priority content is intentionally placed later. Each tier
 * also carries explicit override language to reinforce the hierarchy in models
 * that do not rely purely on position.
 *
 * Tier 1 — Main system prompt (lowest priority)
 *   Always present. Contains the core assessment rubric, question formatting
 *   rules, and general educational guidelines. Provides the baseline behaviour
 *   when no additional context is supplied.
 *
 * Tier 2 — Assignment context (middle priority, optional)
 *   Appended when `assignment_context` glob(s) match files in the repository.
 *   Contains the raw contents of instructor-provided files (README, assignment
 *   brief, rubric, style guide, etc.). Explicitly overrides the main prompt
 *   above it, and explicitly defers to instructor instructions below it.
 *
 * Tier 3 — Instructor instructions (highest priority, optional)
 *   Appended when `additional_context` is provided. Contains free-text
 *   instructions written directly by the instructor for this specific run.
 *   Explicitly overrides all content above it, including the assignment context.
 *   Placed last in the prompt to maximise recency-bias reinforcement.
 */
export function buildPrompt({
  codeContent,
  files,
  numQuestions,
  context: extraContext,
  assignmentContext,
  truncated,
}) {
  const assignmentContextSection = assignmentContext
    ? `\n\n---\n\nASSIGNMENT CONTEXT — HIGH PRIORITY\nThe following files describe the assignment requirements. They take precedence over the general guidelines above. Use them to focus your questions on the specific learning objectives and requirements of this assignment. Instructor instructions below take precedence over this section if there is any conflict.\n\n${assignmentContext}`
    : '';

  const contextSection = extraContext
    ? `\n\n---\n\nINSTRUCTOR INSTRUCTIONS — HIGHEST PRIORITY\nThe following instructions are specific to this assignment and override all other guidance above, including the assignment context. Follow them exactly.\n\n${extraContext}`
    : '';

  const system = `
You are an expert programming educator. Analyze the submitted student code and generate exactly ${numQuestions} targeted questions whose answers require genuine understanding of what was written. You must produce exactly ${numQuestions} questions — no more, no fewer. Producing a different number is an error.

Calibrate question depth to the code's complexity — questions may address syntax/logic, data structures/algorithms, language patterns, or architecture (e.g. MVC, layering).

Use the following question categories to guide generation:

Conceptual Question Examples:
What is the purpose of this function?
Why is this variable initialized before the loop?
Which design pattern does this class follow?
Explain why this method returns a new object instead of modifying the original.

Execution Flow Question Examples:
What will be the output of this code if the input is X?
When does this conditional branch execute?
If the input array is empty, which branch of the conditional runs?
Is this variable accessible outside the function scope?

Error Identification Question Examples:
Why would this code fail if the input list is empty?
How does removing this null check affect the function's behavior?
Are there any inputs that would cause this function to throw an exception?
Explain why passing a string to this parameter produces unexpected results.

Each question must follow this exact format:

**\`path/to/file.ext\`**

\`\`\`language
def example():
    // relevant code snippet
\`\`\`

1. Plain-text question referencing \`specific_code_element\` from the snippet?

   **Answer:** Correct answer here

   **Incorrect Options:**
   - Near distractor 1
   - Near distractor 2
   - Far distractor

---

Constraints:
- Each question must have exactly one unambiguously correct answer
- Questions must be comprehension-focused — never ask the student to improve, critique, optimize, or refactor
- Reference specific named code elements; embed a short inline backtick snippet in the question sentence
- Code snippets must be syntactically complete — use \`// ...\` for omitted sections, and close all blocks
- Only ask about code present in the visible snippet — not truncated content
- The question text must not reveal or hint at the correct answer (no formatting cues, no giveaway wording)
- Use plain markdown text for questions (no bold headings, no oversized text)

Answer constraints:
- The --- separator appears only after the full answer block, never between the question and its answers
- Write all four answers in short, plain language — explain any essential jargon in simple terms
- Near distractors: subtly wrong, believable at first glance but unambiguously incorrect on careful reading
- Far distractor: addresses the same concept but lands well away from the correct answer
- All four answers must vary in length so the correct one is never identifiable by being consistently shorter or longer than the rest

Generate exactly ${numQuestions} questions. Prioritize specific code-based questions grounded in the visible code. If remaining slots would be shallow or repetitive, use a **## Broader Questions** section for those slots — continuing the numbering, focusing only on concepts or patterns directly inferable from the code, and remaining comprehension-focused.

Respond only with the generated Markdown question content (questions and their answers). Do not include explanations, introductions, or summaries.${assignmentContextSection}${contextSection}`;

  const truncatedNote = truncated
    ? '\n> ⚠️ The code below has been truncated — form questions based on the visible portion.\n'
    : '';

  const user = `Analyze the submitted student code and generate exactly ${numQuestions} targeted questions requiring genuine understanding of what was written. Stop at question ${numQuestions}.

**Changed files:** ${files.join(', ')}${truncatedNote}
${codeContent}`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
