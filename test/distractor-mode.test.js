import { describe, expect, it } from 'vitest';
import { buildPrompt, buildResponseFormat } from '../src/prompt/prompt.js';

const BASE = {
  codeContent: '**app.js**\n\n```js\nconst total = items.length;\n```',
  files: ['app.js'],
  numQuestions: 6,
  instructorContext: '',
  assignmentContext: '',
};

/** The system prompt for one mode. */
function systemPrompt(includeDistractors) {
  return buildPrompt({ ...BASE, includeDistractors })[0].content;
}

/** The user message for one mode. */
function userPrompt(includeDistractors) {
  return buildPrompt({ ...BASE, includeDistractors })[1].content;
}

describe('buildPrompt distractor mode', () => {
  it('asks for distractors by default', () => {
    expect(buildPrompt(BASE)[0].content).toContain('"distractors": [');
  });

  it('asks for distractors when the flag is set', () => {
    const prompt = systemPrompt(true);
    expect(prompt).toContain('"distractors": [');
    expect(prompt).toContain('UNIQUENESS RULE');
    expect(prompt).toContain('VISUAL BALANCE');
  });

  // The rules exist only to make three wrong options sit convincingly beside
  // the right one. A stray mention in the answers-only prompt would have the
  // model emit options no parser downstream is expecting.
  it('says nothing about distractors when the flag is clear', () => {
    expect(systemPrompt(false)).not.toMatch(/distractor|incorrect option/i);
    expect(userPrompt(false)).not.toMatch(/distractor|incorrect option/i);
  });

  // Stated once beside the question-count rule and again in the rejection list
  // and the user message: an omitted distractor block is a silent failure
  // downstream, so it is the one requirement worth repeating.
  it('states up front that a question without distractors is a failed response', () => {
    const prompt = systemPrompt(true);
    expect(prompt).toContain('DISTRACTORS ARE NOT OPTIONAL');
    expect(prompt).toContain('There are NO exemptions.');
    expect(prompt).toMatch(/A "distractors" array holding anything other than exactly three/);
    expect(userPrompt(true)).toContain('mandatory for every question without exception');
  });

  // The counts are derived, so a non-default question count has to carry
  // through or the model is handed a self-check it cannot satisfy.
  it('scales the distractor counts to the question count', () => {
    const prompt = buildPrompt({ ...BASE, numQuestions: 4, includeDistractors: true })[0].content;
    expect(prompt).toContain('4 questions means 4 distractor arrays and 12 distractors');
    expect(prompt).toContain('and 12 distractors. If any of those three counts is short');
  });

  it('drops the length machinery that only balances options against each other', () => {
    const prompt = systemPrompt(false);
    expect(prompt).not.toContain('VISUAL BALANCE');
    expect(prompt).not.toContain('JUSTIFICATION SYMMETRY');
    expect(prompt).not.toContain('STRUCTURAL MATCHING');
  });

  // The shape parseQuestionsReply reads has to be asked for in both modes, or
  // the answers-only reply parses as a malformed one and every question in it
  // is dropped.
  it.each([true, false])('asks for the JSON shape that is parsed (distractors: %s)', (mode) => {
    const prompt = systemPrompt(mode);
    expect(prompt).toContain('OUTPUT FORMAT — ONE JSON OBJECT, NOTHING ELSE');
    for (const field of [
      '"questions"',
      '"snippets"',
      '"file"',
      '"start_line"',
      '"end_line"',
      '"question"',
      '"answer"',
      '"broader"',
    ]) {
      expect(prompt).toContain(field);
    }
    expect(prompt).not.toContain('gmc:answer');
    expect(prompt).not.toContain('"code"');
  });

  // The model names lines instead of copying code, so it has to be told what
  // the numbers in front of each line are.
  it('explains the line numbers it names snippets by', () => {
    expect(systemPrompt(true)).toContain('CODE LINE NUMBERS');
  });

  // The numbers count the code after comments are stripped, so a question that
  // cites one can send the student to the wrong line of their own file.
  it.each([true, false])('forbids line numbers in the question text (%s)', (mode) => {
    const prompt = systemPrompt(mode);
    const fields = mode ? 'a question, answer or distractor' : 'a question or answer';
    expect(prompt).toContain(`Never write a line number in ${fields}:`);
    expect(prompt).toContain(`- A line number anywhere in ${fields}\n`);
  });

  it.each([true, false])('keeps the answer rules the student is graded on (%s)', (mode) => {
    const prompt = systemPrompt(mode);
    expect(prompt).toContain('SHORT-ANSWER QUESTIONS (exactly one in every three)');
    expect(prompt).toContain('at least 8 words');
    expect(prompt).toContain('CORRECT ANSWER LENGTH CAP');
    expect(prompt).toContain('ANTI-TRUNCATION RULE');
  });

  // Measured as the gap rather than a ratio: the distractor rules are a fixed
  // block, so text both modes share (the opening lists, say) should not move
  // the result. The rules run to about 14,000 characters.
  it('is substantially shorter without the distractor rules', () => {
    expect(systemPrompt(true).length - systemPrompt(false).length).toBeGreaterThan(10000);
  });
});

describe('buildPrompt question rules', () => {
  /** The one line of the system prompt that starts with `prefix`. */
  function lineStarting(prompt, prefix) {
    return prompt.split('\n').find((line) => line.startsWith(prefix)) ?? '';
  }

  it.each([true, false])('holds every question to the checklist (distractors: %s)', (mode) => {
    const prompt = systemPrompt(mode);
    for (const item of [
      'QUESTION DEPTH',
      'QUESTION CHECKLIST',
      '1. REASONING STEP',
      '3. ONE PROVABLE ANSWER',
      '5. BEHAVIOUR, NOT OPINION',
      '6. ONE THING',
      '9. FINAL TEST',
    ]) {
      expect(prompt).toContain(item);
    }
  });

  // The banned list matters most where an entry starts with an allowed word:
  // "What" alone would let "What do you think…" through.
  it('lists the allowed and banned openings', () => {
    const opening = lineStarting(systemPrompt(true), '7. OPENING');
    const [allowed, banned] = opening.split('Never begin with any of these');
    expect(allowed).toContain('What, Which, Where, When, Why, How many');
    expect(allowed).toContain('"If…, what…"');
    expect(banned).toContain('Explain');
    expect(banned).toContain('What do you think');
    expect(banned).toContain('How does … work');
    expect(allowed).not.toContain('Explain');
  });

  // Students answer with the whole repository open, starter code included, so
  // code an answer depends on may be named rather than shown, but it has to be
  // code the model was sent, and never the code that answers the question.
  it('lets an answer depend on code the question names but does not show', () => {
    const prompt = systemPrompt(true);
    expect(lineStarting(prompt, 'Every question must require')).toContain(
      'review all of the code in their repository — their own and any starter code',
    );
    const selfContained = lineStarting(prompt, '4. SELF-CONTAINED');
    expect(selfContained).toContain('Students answer with their whole repository open');
    expect(selfContained).toContain('that code must be in the user message');
    expect(selfContained).toContain('You may also show that code in a snippet');
    expect(selfContained).toContain('Never add a snippet that shows the answer itself');
    expect(prompt).toContain('code you can see in full in the user message');
  });

  // Asked without options, more than one change could meet the goal, so a
  // correct-modification question has no single answer in answers-only mode.
  it('uses correct-modification questions only with distractors', () => {
    const withOptions = systemPrompt(true);
    expect(withOptions).toContain('6. Correct modification — ask which of several described');
    expect(withOptions).toContain('For correct-modification questions, exactly one');
    expect(withOptions).toContain('also draw on types 5, 6, and 9');

    const without = systemPrompt(false);
    expect(without).toContain('6. Correct modification — not used in this run');
    expect(without).not.toContain('For correct-modification questions');
    expect(without).toContain('also draw on types 5 and 9');
    expect(without).not.toContain('types 5, 6, and 9');
  });

  it.each([
    [true, 'Every question will be delivered as a multiple-choice item'],
    [false, 'written so that it could be delivered as a multiple-choice item'],
  ])('asks for closed questions (distractors: %s)', (mode, intro) => {
    expect(systemPrompt(mode)).toContain(intro);
    expect(userPrompt(mode)).toContain(
      'Every question must be a closed, multiple-choice-ready question',
    );
  });

  // The quotas are derived, so a non-default question count has to carry
  // through or the model is handed quotas it cannot meet.
  it.each([
    [2, 2, 1, 1],
    [6, 4, 2, 3],
    [20, 4, 7, 10],
  ])(
    'scales the mixing quotas to %i questions',
    (numQuestions, minTypes, maxPerType, maxPerWord) => {
      const prompt = buildPrompt({ ...BASE, numQuestions, includeDistractors: true })[0].content;
      expect(prompt).toContain(
        `at least ${minTypes} distinct question types across the set, and no single type more than ${maxPerType} times`,
      );
      expect(prompt).toContain(
        `No single question word may open more than ${maxPerWord} of the ${numQuestions} questions`,
      );
    },
  );
});

describe('buildResponseFormat', () => {
  const schema = (opts) => buildResponseFormat(opts).json_schema.schema;
  const questionSchema = (opts) => schema(opts).properties.questions.items;

  it('asks for distractors only when they are wanted', () => {
    expect(questionSchema({ includeDistractors: true }).required).toContain('distractors');
    expect(questionSchema({ includeDistractors: false }).properties).not.toHaveProperty(
      'distractors',
    );
  });

  it('asks for each snippet as a file and a range of line numbers', () => {
    expect(questionSchema({}).properties.snippets.items.properties).toEqual({
      file: expect.objectContaining({ type: 'string' }),
      start_line: expect.objectContaining({ type: 'integer' }),
      end_line: expect.objectContaining({ type: 'integer' }),
    });
  });

  it('asks for the context summary only with instructor context', () => {
    expect(schema({ includeContextSummary: true }).required).toEqual([
      'questions',
      'context_summary',
    ]);
    expect(schema({ includeContextSummary: false }).required).toEqual(['questions']);
  });

  // Strict mode requires every property to be listed as required, and closed
  // objects throughout.
  it.each([true, false])('is valid for strict mode (distractors: %s)', (includeDistractors) => {
    const check = (node) => {
      if (node.type === 'object') {
        expect(node.additionalProperties).toBe(false);
        expect(node.required).toEqual(Object.keys(node.properties));
        Object.values(node.properties).forEach(check);
      }
      if (node.type === 'array') check(node.items);
    };
    check(schema({ includeDistractors, includeContextSummary: true }));
    expect(buildResponseFormat({ includeDistractors }).json_schema.strict).toBe(true);
  });
});

describe('buildPrompt instructor instructions', () => {
  // They override the rest of the prompt, so the limit on that override has
  // to sit beside it: an instruction about layout must not pull the reply out
  // of the JSON GrillMyCode parses.
  it('cannot change the output format or the security rules', () => {
    const prompt = buildPrompt({
      ...BASE,
      instructorContext: 'Put each question under a heading.',
    })[0].content;
    const section = prompt.slice(prompt.indexOf('INSTRUCTOR INSTRUCTIONS'));
    expect(section).toContain(
      'cannot change the JSON output format or the security rules; apply them to the content of the questions instead.',
    );
    expect(section.indexOf('cannot change')).toBeLessThan(
      section.indexOf('Put each question under a heading.'),
    );
  });
});
