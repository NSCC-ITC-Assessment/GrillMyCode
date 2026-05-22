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

Match question depth to code complexity: for simple scripts, ask about syntax, variable usage, and basic control flow; for code with classes, modules, or multiple functions, ask about design patterns, data flow between components, and architectural decisions.

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
- If answering the question requires knowing the value of a parameter, variable, or data structure defined elsewhere in the code, include that definition in the snippet. Use a second fenced code block if needed (e.g. show where the array is defined, then show the function that uses it). Never ask a question whose answer depends on a value not visible in the snippet.
- The question text must not reveal the answer — do not use leading phrasing ("Doesn't this..."), do not bold/italicize the key term from the answer, and do not frame the question so only one option grammatically fits
- Use plain markdown text for questions (no bold headings, no oversized text)

Answer constraints:
- The --- separator appears only after the full answer block, never between the question and its answers
- Use plain language a non-technical person could follow; if a technical term is unavoidable, define it inline in simple words
- Near distractors: change one key detail from the correct answer — wrong variable name, inverted condition, off-by-one in a count, or correct concept applied to the wrong element. Must sound plausible but be unambiguously wrong on careful reading
- Far distractor: describes a different purpose, a different function's behavior, or a fundamentally different mechanism than what the question asks about
- CRITICAL length rule: For at least half of the questions, one or more incorrect options MUST be longer than the correct answer. Add an extra qualifying clause, a parenthetical aside, or a "because..." reason to incorrect options to make them longer. The correct answer should frequently be among the shorter options — never consistently the longest. A student who picks the longest answer should be wrong more often than right.

Generate exactly ${numQuestions} questions. Prioritize specific code-based questions grounded in the visible code. If filling all ${numQuestions} slots with code-specific questions would require asking about the same function twice or asking trivial naming questions, use a **## Broader Questions** section for the remaining slots — continuing the numbering, focusing only on concepts or patterns directly inferable from the code, and remaining comprehension-focused.

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
