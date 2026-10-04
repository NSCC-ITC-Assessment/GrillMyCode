/**
 * Instructor question markup
 *
 * What the instructor view adds under a question in the Question view: its
 * answer, and the wrong answers written for the quiz. The text is escaped the
 * way the question's is (shared/html.js), and the page still runs no script.
 */

import { proseToHtml, questionToHtml } from '../shared/html.js';

/** The answer and distractors of an answer key's question. */
export function answerToHtml(question) {
  const answer = question.answer
    ? `<h3>Answer</h3><p class="answer">${proseToHtml(question.answer)}</p>`
    : '';
  const wrong = question.distractors ?? [];
  const distractors =
    wrong.length > 0
      ? `<h3>Distractors</h3><ul>${wrong.map((text) => `<li>${proseToHtml(text)}</li>`).join('')}</ul>`
      : '';
  return answer + distractors;
}

/** The body of the Question view in the instructor view. */
export function instructorQuestionToHtml(question) {
  return questionToHtml(question) + (question ? answerToHtml(question) : '');
}
