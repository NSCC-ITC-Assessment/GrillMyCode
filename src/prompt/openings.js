/**
 * Question Openings
 *
 * The sentence starters a question may and may not begin with, and the two
 * prompt lines that render them. Part of the prompt template: see
 * PROMPT_TEMPLATE_HASH in prompt.js.
 */
import { listWith } from './text.js';

/**
 * QUESTION OPENINGS — every sentence starter the prompt names, in one place.
 * The two prompt lines that render them, the OPENING item of the question
 * checklist and the question-word rule of MIXING RULES, are built below
 * (buildOpeningCheck, buildQuestionWordRule); nothing else in the prompt names
 * an opening.
 *
 * base holds the lists every run starts from:
 *   allowed — the openings a question may begin with. They keep every question
 *     closed, with one answer. They are only the distinct openings: a phrase
 *     that starts with one ("What happens when", "Which branch") is already
 *     allowed, and listing such phrases made the list mostly "What", which
 *     steered the model towards it. Bare "How" is the exception: "How does
 *     this work?" has no single answer, so only its closed forms are allowed,
 *     each listed in full.
 *   leadIns — clauses that set up a scenario before an allowed opening.
 *   banned — openings never allowed. The list matters most where an entry
 *     starts with an allowed word ("What do you think…"): the allowed list
 *     alone would let those through.
 *
 * Each question_emphasis mode then has:
 *   suggest — the words the question-word rule tells the model to draw on,
 *     besides What. Every one must be in base.allowed: a mode never allows a
 *     new opening. research and tracing each have their own, since the
 *     balanced list names openings (Why, Under what condition) no tracing type
 *     can use.
 *   what (optional) — replaces bare What in base.allowed with these forms, as
 *     base.allowed does for bare How.
 *   banned (optional) — added to base.banned.
 *
 * Under research, bare What let the model ask what a call or parameter does in
 * general ("What does the second argument of `number_format()` do"), which is
 * recall, or what a variable holds, which is read off the snippet; every form
 * left carries a change or input the code does not show. A bracket names what
 * goes in its place. "The exact effect of" and "the direct impact" are the
 * general question again when they name only a call or flag, and "direct" is
 * open to argument unless the question names the value or output to observe.
 * The lead-ins still allow a plain "what": their If or Given clause supplies
 * the condition.
 *
 * A research run showed what the lists leave open. The model wrote "What value
 * does … hold" past the banned "What does … hold", and "What text is
 * displayed" and "What is the final value of" past a banned list that names no
 * "What" followed by a noun; the research banned list now names those shapes.
 * A lead-in does not lift a ban (see buildOpeningCheck). Bare Which stays
 * allowed, since "Which value of `status`…" and "Which exit code…" are good
 * questions, so only its "hold" form is banned. No opening list can finish the
 * job: a stated input checked against a condition the snippet shows fits every
 * allowed form ("What does the ternary return when…"), so REASONING STEP, not
 * the opening, is what rules out those questions.
 */
export const QUESTION_OPENINGS = {
  base: {
    allowed: [
      'What',
      'Which',
      'Where',
      'When',
      'Why',
      'How many',
      'How often',
      'How much',
      'How long',
      'How would … change if',
      'How does … change when',
      'How does … respond when',
      'How does … order',
      'In what order',
      'In which order',
      'At what point',
      'At which point',
      'Under what condition',
      'Under which condition',
    ],
    leadIns: [
      'Given…, what…',
      'Given…, which…',
      'Given…, why…',
      'Given…, when…',
      'If…, what…',
      'If…, which…',
      'If…, why…',
      'If…, when…',
      'If…, how many…',
      'Given…, how many…',
      'If…, how often…',
      'Given…, how would … change…',
    ],
    banned: [
      'Explain',
      'Describe',
      'Discuss',
      'Elaborate on',
      'Summarize',
      'Talk about',
      'Tell me about',
      'Tell us about',
      'What do you think',
      'What are your thoughts',
      'What are your views',
      'What is your understanding of',
      'What is your interpretation of',
      'What is your assessment of',
      'What is your reasoning for',
      'What do you know about',
      'What can you say about',
      'What can you tell me about',
      'What can you explain about',
      'Why do you think',
      'Why might you think',
      'In your opinion',
      'In your view',
      'What are some ways to',
      'What are the ways to',
      'What are the advantages of',
      'What are the disadvantages of',
      'What are the benefits of',
      'What are the drawbacks of',
      'What are the pros of',
      'What are the cons of',
      'What are the strengths of',
      'What are the weaknesses of',
      'What are some reasons for',
      'What are the possible reasons for',
      'How would you',
      'How could you',
      'How might you',
      'How should you',
      'How does … work',
      'How is',
      'How are',
      'Can you',
      'Could you',
      'Would you',
    ],
  },
  balanced: {
    suggest: [
      'Which',
      'Where',
      'When',
      'Why',
      'How many',
      'How often',
      'How much',
      'In what order',
      'At what point',
      'Under what condition',
    ],
  },
  research: {
    suggest: [
      'Why',
      'How would … change if',
      'How does … change when',
      'How does … respond when',
      'Under what condition',
      'When',
      'At what point',
      'In what order',
    ],
    what: [
      'What happens when',
      'What happens if',
      'What would … if',
      'What does … return when',
      'What is the exact effect of [a change or input] on',
      'What is the direct impact on [a named value or output] of [a change or input]',
    ],
    banned: [
      'What does … do',
      'What does … hold',
      'What is … for',
      'What is stored in',
      'What is the purpose of',
      'What function does',
      'What is the exact effect of [a call, flag, or argument on its own]',
      'What is the direct impact of',
      'What [value, text, or any other noun]',
      'What is the value of',
      'What is the … value of',
      'Which … does … hold',
    ],
  },
  tracing: {
    suggest: ['Which', 'Where', 'How many', 'How often', 'How much', 'In what order'],
  },
};

/**
 * The opening lists for a question_emphasis mode: base with the mode's What
 * forms swapped in for bare What and its banned openings added. An unknown
 * mode gets the balanced lists.
 */
export function openingsFor(questionEmphasis) {
  const { base } = QUESTION_OPENINGS;
  const mode = QUESTION_OPENINGS[questionEmphasis] ?? QUESTION_OPENINGS.balanced;
  return {
    allowed: mode.what
      ? base.allowed.flatMap((opening) => (opening === 'What' ? mode.what : [opening]))
      : base.allowed,
    leadIns: base.leadIns,
    banned: [...base.banned, ...(mode.banned ?? [])],
    suggest: mode.suggest,
    narrowsWhat: Boolean(mode.what),
  };
}

/** The question-word rule of MIXING RULES, without its leading "- ". */
export function buildQuestionWordRule(openings, numQuestions) {
  const what = openings.narrowsWhat
    ? 'What in the forms the OPENING check allows in this run'
    : 'What';
  return `Vary the question word. No single question word may open more than ${Math.ceil(numQuestions / 2)} of the ${numQuestions} questions; a lead-in counts as the question word that follows it, so "If…, what…" counts as What. Every "How" form (How many, How often, How does … change when, and so on) counts as How. Draw on ${listWith(openings.suggest)} as well as ${what}.`;
}

/** The OPENING item of the question checklist, without its "7. OPENING — ". */
export function buildOpeningCheck(openings) {
  const brackets = openings.allowed.some((opening) => opening.includes('['))
    ? ' Square brackets describe what goes in their place.'
    : '';
  return `Begin with one of these, and no other opening: ${openings.allowed.join(', ')}. Or begin with a lead-in clause that sets up the scenario, followed by one of those: ${openings.leadIns.map((c) => `"${c}"`).join(', ')}. Never begin with any of these, even when it starts with an allowed word: ${openings.banned.join(', ')}. A lead-in does not lift a ban: the words after it are checked against this list too, so "If…, what do you think…" is as banned as "What do you think…". A "How" question must be tied to a concrete input, change, or condition and answered by a value, count, order, or single effect — never by an explanation of how something works.${brackets}`;
}
