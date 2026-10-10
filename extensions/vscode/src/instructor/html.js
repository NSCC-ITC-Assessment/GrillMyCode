/**
 * Instructor question markup
 *
 * What the instructor view adds under a question in the Question view: its
 * answer. The text is escaped the way the question's is (shared/html.js), and
 * the page still runs no script.
 *
 * The answer key's distractors are not shown. They are wrong answers written
 * for the multiple-choice quiz, and a spoken check has no use for them.
 */

import { proseToHtml, questionToHtml } from '../shared/html.js';

/** @import { Question } from '../shared/report.js' */

/**
 * The answer of an answer key's question, or '' when it has none.
 *
 * @param {Question} question
 */
export function answerToHtml(question) {
  return question.answer
    ? `<h3>Answer</h3><p class="answer">${proseToHtml(question.answer)}</p>`
    : '';
}

/**
 * The body of the Question view in the instructor view.
 *
 * @param {Question | undefined} question
 */
export function instructorQuestionToHtml(question) {
  return questionToHtml(question) + (question ? answerToHtml(question) : '');
}
