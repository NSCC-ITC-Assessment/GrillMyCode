import { describe, expect, it } from 'vitest';
import { buildPrompt, buildResponseFormat } from '../src/prompt.js';

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

  it('is substantially shorter without the distractor rules', () => {
    expect(systemPrompt(false).length).toBeLessThan(systemPrompt(true).length * 0.6);
  });
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
