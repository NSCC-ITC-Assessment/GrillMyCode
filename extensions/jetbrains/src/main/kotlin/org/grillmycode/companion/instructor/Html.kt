package org.grillmycode.companion.instructor

import org.grillmycode.companion.shared.Question
import org.grillmycode.companion.shared.proseToHtml
import org.grillmycode.companion.shared.questionToHtml

// Instructor question markup
//
// What the instructor view adds under a question in the details panel: its
// answer. The text is escaped the way the question's is (shared/Html.kt), and
// the pane still runs no script. A port of
// extensions/vscode/src/instructor/html.js.
//
// The answer key's distractors are not shown. They are wrong answers written
// for the multiple-choice quiz, and a spoken check has no use for them.

/** The answer of an answer key's question, or an empty string when it has none. */
fun answerToHtml(question: Question): String =
    if (question.answer.isNullOrEmpty()) "" else """<h3>Answer</h3><p class="answer">${proseToHtml(question.answer)}</p>"""

/** The body of the details panel in the instructor view. */
fun instructorQuestionToHtml(question: Question?): String = questionToHtml(question) + (question?.let(::answerToHtml) ?: "")
