package org.grillmycode.companion.instructor

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import org.grillmycode.companion.shared.ANSWER_KEY_FILE
import org.grillmycode.companion.shared.HttpGet
import org.grillmycode.companion.shared.INSTRUCTOR_REPO_SUFFIX
import org.grillmycode.companion.shared.IdentityError
import org.grillmycode.companion.shared.IssueGroup
import org.grillmycode.companion.shared.Question
import org.grillmycode.companion.shared.Snippet
import org.grillmycode.companion.shared.SubmissionIdentity
import org.grillmycode.companion.shared.asBoolean
import org.grillmycode.companion.shared.asText
import org.grillmycode.companion.shared.asWholeNumber
import org.grillmycode.companion.shared.listDirectCollaborators
import org.grillmycode.companion.shared.matchSubmissionIdentity
import org.grillmycode.companion.shared.ownSubmissionIdentity
import org.grillmycode.companion.shared.readFile
import org.grillmycode.companion.shared.tagGroupSlug

// Answer key
//
// Finds and reads the answer key for the repository that is open: the
// questions.json the action files in the assignment's instructor repository
// (buildQuestionsJson in src/delivery/instructor-repo.js). GitHub decides who
// may read that repository, so a successful read is what tells an instructor
// from a student. A port of extensions/vscode/src/instructor/answer-key.js.
// Nothing here imports the IDE, so its tests run without one.
//
// For `cs-principles-lab-3-jsmith` in `my-school` the key is at
//
//   my-school/cs-principles-lab-3-grillmycode-instructor/jsmith/data/questions.json
//
// and a run started by a submission tag files its own one folder down, in
// `jsmith/<tag group>/data/`.

/** What [findAnswerKey] found. */
sealed interface AnswerKeyResult

/**
 * An answer key the signed-in account can read. [own] says the student
 * repository is that account's; [repo] and [path] are where the key is.
 */
data class AnswerKey(
    val questions: List<Question>,
    val own: Boolean,
    val repo: String,
    val path: String,
) : AnswerKeyResult

/** No answer key to show, and why. For a student there is never one, and that is no fault. */
data class NoAnswerKey(
    val reason: String,
) : AnswerKeyResult

/** Where an answer key is, in the student repository's organization. */
data class AnswerKeyLocation(
    val repo: String,
    val path: String,
)

/**
 * Where an identity's answer key is. [group] is the questions issue's, from
 * parseIssueTitle, and names the tag pattern for a submission tag's questions.
 */
fun answerKeyLocation(
    assignment: String,
    submitter: String,
    group: IssueGroup?,
): AnswerKeyLocation {
    val folder = if (group is IssueGroup.Tag) "$submitter/${tagGroupSlug(group.pattern)}" else submitter
    return AnswerKeyLocation("$assignment$INSTRUCTOR_REPO_SUFFIX", "$folder/$ANSWER_KEY_FILE")
}

/** A whole JSON number that fits an Int, as JavaScript's Number.isInteger allows. */
private fun JsonElement?.asInt(): Int? = asWholeNumber()?.takeIf { it >= Int.MIN_VALUE && it <= Int.MAX_VALUE }?.toInt()

private fun readSnippet(snippet: JsonElement): Snippet? {
    val entry = snippet as? JsonObject ?: return null
    return Snippet(
        file = entry["file"].asText() ?: return null,
        startLine = entry["start_line"].asInt() ?: return null,
        endLine = entry["end_line"].asInt() ?: return null,
        language = entry["language"].asText() ?: "",
        code = entry["code"].asText() ?: "",
    )
}

private fun readQuestion(entry: JsonElement): Question? {
    val q = entry as? JsonObject ?: return null
    // A dropped question was never asked: it has no number and is in no report.
    if (q["dropped"].asBoolean() == true) return null
    return Question(
        number = q["number"].asInt() ?: return null,
        broader = q["broader"].asBoolean() == true,
        snippets = (q["snippets"] as? JsonArray)?.mapNotNull(::readSnippet) ?: emptyList(),
        question = q["question"].asText() ?: return null,
        answer = q["answer"].asText() ?: "",
        distractors = (q["distractors"] as? JsonArray)?.mapNotNull { it.asText() } ?: emptyList(),
    )
}

/**
 * The questions in an answer key's text, in the shape parseReport gives them
 * with the answer and distractors filled in. The view shows the answer alone,
 * and the distractors are kept for whatever reads the key next. Null when the
 * text is not an answer key or holds no question.
 *
 * The file is the action's, but it is read as carefully as the issue: an entry
 * that does not fit is left out, and nothing in it is evaluated.
 */
fun parseAnswerKey(text: String): List<Question>? {
    val record = runCatching { Json.parseToJsonElement(text) }.getOrNull() as? JsonObject ?: return null
    val entries = record["questions"] as? JsonArray ?: return null
    return entries.mapNotNull(::readQuestion).ifEmpty { null }
}

private fun lines(question: Question) = question.snippets.joinToString("\n") { "${it.file}:${it.startLine}-${it.endLine}" }

/**
 * True when a report's questions are the answer key's: each has a question of
 * the same number in the key, about the same lines. The report may hold fewer,
 * since a long one is cut short.
 *
 * They differ when the key was written by another run. An instructor
 * repository keeps one key per student, or per submission tag, while a student
 * repository keeps an issue per branch.
 */
fun matchesReport(
    reportQuestions: List<Question>,
    keyQuestions: List<Question>,
): Boolean {
    val byNumber = keyQuestions.associateBy { it.number }
    return reportQuestions.all { question ->
        val keyed = byNumber[question.number]
        keyed != null && keyed.broader == question.broader && lines(keyed) == lines(question)
    }
}

/**
 * Looks for the answer key of [owner]/[repo] with the signed-in account's
 * token. Returns an [AnswerKey] when the account can read it, or [NoAnswerKey]
 * when there is none to show. It never throws.
 *
 * In the account's own repository this is one request, which GitHub refuses an
 * ordinary student. In anyone else's the student is found first, from the
 * repository's direct collaborators, as the action finds them.
 */
fun findAnswerKey(
    owner: String,
    repo: String,
    login: String?,
    group: IssueGroup?,
    token: String,
    http: HttpGet,
): AnswerKeyResult =
    try {
        val own = ownSubmissionIdentity(repo, login)
        when (val identity = own ?: matchSubmissionIdentity(repo, listDirectCollaborators(owner, repo, token, http))) {
            is IdentityError -> NoAnswerKey(identity.error)
            is SubmissionIdentity -> {
                val location = answerKeyLocation(identity.assignment, identity.submitter, group)
                val questions = parseAnswerKey(readFile(owner, location.repo, location.path, token, http))
                if (questions == null) {
                    NoAnswerKey("$owner/${location.repo}/${location.path} is not an answer key")
                } else {
                    AnswerKey(questions, own != null, location.repo, location.path)
                }
            }
        }
    } catch (error: Exception) {
        NoAnswerKey(error.message ?: error.toString())
    }
