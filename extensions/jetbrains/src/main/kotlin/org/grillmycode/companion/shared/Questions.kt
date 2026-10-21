package org.grillmycode.companion.shared

// Question model
//
// Arranges parsed questions for display and checks them against the project
// that is open. Pure functions over what parseReport returns. A port of
// extensions/vscode/src/shared/questions.js.

/** The questions whose first snippet is in [file], or, with [file] null, those that show no code. */
data class QuestionGroup(
    val file: String?,
    val questions: List<Question>,
)

/** A snippet's lines as the report captions them: `line 12` or `lines 28–37`. */
fun describeLines(snippet: Snippet): String =
    if (snippet.startLine == snippet.endLine) {
        "line ${snippet.startLine}"
    } else {
        "lines ${snippet.startLine}–${snippet.endLine}"
    }

private val ROOTED = Regex("""^[/\\]""")
private val DRIVE = Regex("^[A-Za-z]:")
private val SEPARATOR = Regex("""[/\\]""")

/**
 * True when a snippet's file name is a plain path inside the repository. The
 * name comes from the issue, which anyone with write access can edit, so one
 * that is absolute or climbs out with `..` is never opened.
 */
fun isSafeRelativePath(file: String?): Boolean {
    if (file.isNullOrEmpty() || file.contains('\u0000')) return false
    if (ROOTED.containsMatchIn(file) || DRIVE.containsMatchIn(file)) return false
    return ".." !in file.split(SEPARATOR)
}

/** The snippets of a question that can be opened: a safe path and a real line range. */
fun openableSnippets(question: Question): List<Snippet> =
    question.snippets.filter { snippet ->
        isSafeRelativePath(snippet.file) && snippet.startLine >= 1 && snippet.endLine >= snippet.startLine
    }

/**
 * Groups questions for the panel: one group per file, in the order the files
 * first appear, each holding the questions whose first snippet is in it; then
 * a last group for the questions that show no code, which the report lists as
 * broader questions.
 */
fun groupQuestions(questions: List<Question>): List<QuestionGroup> {
    val groups = LinkedHashMap<String, MutableList<Question>>()
    val withoutCode = mutableListOf<Question>()
    for (question in questions) {
        val first = openableSnippets(question).firstOrNull()
        if (first == null) {
            withoutCode += question
            continue
        }
        groups.getOrPut(first.file) { mutableListOf() } += question
    }
    val result = groups.map { (file, grouped) -> QuestionGroup(file, grouped) }
    return if (withoutCode.isEmpty()) result else result + QuestionGroup(null, withoutCode)
}

/**
 * The question a step from the current one lands on, in the order the panel
 * lists them: file by file, then the questions that show no code. That is not
 * always the order of their numbers.
 *
 * A step past either end goes round to the other. With no current question, or
 * one that is no longer listed, a step forward lands on the first question and
 * a step back on the last. Null when there are no questions.
 *
 * @param current the number of the question showing.
 * @param step 1 or -1.
 */
fun adjacentQuestion(
    questions: List<Question>,
    current: Int?,
    step: Int,
): Question? {
    val ordered = groupQuestions(questions).flatMap { it.questions }
    if (ordered.isEmpty()) return null
    val index = ordered.indexOfFirst { it.number == current }
    if (index == -1) return if (step == 1) ordered.first() else ordered.last()
    return ordered[(index + step + ordered.size) % ordered.size]
}

/** The distinct files the questions' snippets name, in order of first use. */
fun questionFiles(questions: List<Question>): List<String> = questions.flatMap { q -> openableSnippets(q).map { it.file } }.distinct()

/**
 * Says why a question's highlighted lines may no longer be the lines it asks
 * about, or returns "" when the project still matches the report.
 *
 * The report gives line numbers as they were at [headSha], the commit it
 * reviewed. They go stale when the project is at another commit, or when a
 * file the questions point into has changes that are not committed.
 *
 * @param headSha the SHA the report reviewed: the full one when the issue
 *   carries it, otherwise the short one it prints.
 * @param folderCommit the full SHA the project is at, if known.
 * @param changedFiles repository-relative paths with uncommitted or unsaved
 *   changes, with forward slashes.
 * @param files [questionFiles] of the report.
 */
fun describeDrift(
    headSha: String,
    folderCommit: String?,
    changedFiles: List<String>,
    files: List<String>,
): String {
    if (!folderCommit.isNullOrEmpty() && headSha.isNotEmpty() && !folderCommit.startsWith(headSha)) {
        return "These questions were written for commit ${headSha.take(SHORT_SHA_LENGTH)}, and this folder is at " +
            "${folderCommit.take(SHORT_SHA_LENGTH)}. The highlighted lines may have moved."
    }
    val edited = files.filter { it in changedFiles }
    if (edited.isEmpty()) return ""
    val names = if (edited.size <= 2) edited.joinToString(" and ") else "${edited.size} files"
    return "$names changed since these questions were written. The highlighted lines may have moved."
}
