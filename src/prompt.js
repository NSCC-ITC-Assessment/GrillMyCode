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

Each question must:
- Begin exactly with a number followed by a period and a space (e.g. \`1. \`, \`2. \`, \`3. \`). This is mandatory and must not be omitted.
- Be separated from the next with a markdown separator (e.g. ---)
- Prevent the question text from being too big or bold; use plain markdown text for questions
- Reference specific named code elements (functions, variables, control structures, data structures, patterns)
- Have a clear, definitive answer — each question should be suitable for use in a multiple-choice scenario where exactly one option is unambiguously correct. Questions may begin with what, when, where, why, how, which, if, is/are, does/do, or "explain why" as long as this constraint is met.
- For formatting reasons, make sure that questions are followed by a blank line before adding the separator (i.e. do not place the separator immediately after the question text)
- Embed a short inline backtick snippet within the question sentence itself — not on a separate line before it
- Use an appropriately language-tagged fenced code block whenever the language can be identified.
- Code snippets must always be syntactically complete — never leave a block, function, or structure unclosed. If surrounding code is omitted for brevity, use \`// ...\` (or the language's comment equivalent) as a placeholder to indicate hidden/irrelevant code, and ensure all braces, brackets, or indentation blocks are properly closed.
- Be prefixed with: (1) the relative file path as bold inline-code (e.g. **\`src/utils/cart.js\`**), then (2) the exact relevant line or snippet as a fenced code block with the appropriate language tag, then (3) the question itself
- Ensure that any code mentioned in the question is present in the visible code snippet — do not ask about code that may have been truncated
- The examples below illustrate possible educational question categories generally, but the generated output must remain comprehension-focused and must not ask the student to improve, critique, optimize, or refactor the code.
- Not reveal or imply the answer

Sample question format:



**\`sample-file.py\`**

\`\`\`python
def hello_world():
    print("This will be colorized as Python code!")
\`\`\`

1. What is the purpose of the \`hello_world\` function in sample-file.py?

---



Generate exactly ${numQuestions} questions in total across all sections combined — this is a hard limit. Stop after question ${numQuestions}. Do not generate question ${numQuestions + 1} or beyond.
First generate specific code-based questions grounded directly in the visible code.
If you cannot reach ${numQuestions} specific code-based questions without becoming shallow or repetitive, fill the remaining slots with a **## Broader Questions** section.

Broader Questions must:
- Continue the numbering sequence
- Focus only on concepts, patterns, or technologies directly inferable from the visible code
- Never assume unseen implementation details, unless specified in the extra context section
- Remain comprehension-focused rather than improvement-focused

If ${numQuestions} specific code-based questions can be generated without becoming shallow, repetitive, or forced, omit the **## Broader Questions** section entirely.



After each question, add the answer indented with three spaces (to align with the body text of the numbered list item) in this exact format:

   **Answer:** [Your answer here]

Do NOT place a --- separator between the question and its answer. The --- separator must only appear after the answer, to separate one question-answer pair from the next.

Write the answer in plain, everyday language that a non-technical person could understand. Avoid jargon — if a technical term is essential, explain it in simple words. Keep the answer as short and direct as possible.

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
