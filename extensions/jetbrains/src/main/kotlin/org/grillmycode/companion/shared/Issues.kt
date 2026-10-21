package org.grillmycode.companion.shared

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray

// Questions issues
//
// Picks the GrillMyCode questions issues out of a repository's open issues,
// chooses which one to show, and tells when a later look finds another. A port
// of extensions/vscode/src/shared/issues.js.
//
// The action keeps one open issue per branch and one per submission tag
// pattern, told apart by title:
//
//   GrillMyCode Questions (main)
//   GrillMyCode Questions (tag: submit/*)
//
// (Line comments here: in Kotlin, the "/" and "*" of a tag pattern would open
// a nested block comment.)

/** What a questions issue is for, as [parseIssueTitle] reads it from the title. */
sealed interface IssueGroup {
    data class Branch(
        val name: String,
    ) : IssueGroup

    data class Tag(
        val pattern: String,
    ) : IssueGroup

    /** A run that had no branch. */
    data object Unnamed : IssueGroup
}

/** A questions issue, as [findQuestionIssues] lists it. */
data class QuestionIssue(
    val number: Int,
    val title: String,
    val url: String,
    val updatedAt: String,
    val body: String,
    val group: IssueGroup,
)

/**
 * What a questions issue's title says it is for, or null for any other title.
 *
 * A colon cannot appear in a branch name, so `(tag: …)` is never a branch.
 */
fun parseIssueTitle(title: String?): IssueGroup? {
    if (title == null) return null
    if (title == ISSUE_TITLE) return IssueGroup.Unnamed
    if (!title.startsWith("$ISSUE_TITLE (") || !title.endsWith(")")) return null
    val group = title.substring(ISSUE_TITLE.length + 2, title.length - 1)
    if (group.isEmpty()) return null
    return if (group.startsWith("tag: ")) IssueGroup.Tag(group.removePrefix("tag: ")) else IssueGroup.Branch(group)
}

/** How an issue's group reads in a list: `main`, or `tag submit-*` for a tag pattern. */
fun describeGroup(group: IssueGroup): String =
    when (group) {
        is IssueGroup.Branch -> group.name
        is IssueGroup.Tag -> "tag ${group.pattern}"
        IssueGroup.Unnamed -> "no branch"
    }

private fun JsonElement?.text(): String? = (this as? JsonPrimitive)?.takeIf { it.isString }?.content

/**
 * The questions issues among a repository's issues, as the GitHub REST API
 * returns them: labelled, titled as the action titles them, and not a pull
 * request (which the issues endpoint also lists). Newest update first. An
 * entry that is not shaped like an issue is left out.
 */
fun findQuestionIssues(issues: List<JsonElement>): List<QuestionIssue> =
    issues
        .mapNotNull { element ->
            val issue = element as? JsonObject ?: return@mapNotNull null
            if (issue["pull_request"].let { it != null && it != JsonNull }) return@mapNotNull null
            val labelled =
                runCatching { issue["labels"]?.jsonArray }.getOrNull().orEmpty().any { label ->
                    (label.text() ?: (label as? JsonObject)?.get("name").text()) == ISSUE_LABEL
                }
            if (!labelled) return@mapNotNull null
            val title = issue["title"].text()
            QuestionIssue(
                number = (issue["number"] as? JsonPrimitive)?.content?.toIntOrNull() ?: return@mapNotNull null,
                title = title ?: return@mapNotNull null,
                url = issue["html_url"].text() ?: "",
                updatedAt = issue["updated_at"].text() ?: "",
                body = issue["body"].text() ?: "",
                group = parseIssueTitle(title) ?: return@mapNotNull null,
            )
        }.sortedByDescending { it.updatedAt }

/**
 * Which questions issue to show, from [findQuestionIssues]' list:
 *
 *  1. the one the reader last chose by hand ([preferredTitle]), if it is still
 *     open: the title, not the number, since the action may replace an issue
 *     but always titles its successor the same;
 *  2. the one for the branch that is checked out;
 *  3. the most recently updated.
 */
fun chooseIssue(
    issues: List<QuestionIssue>,
    branch: String? = null,
    preferredTitle: String? = null,
): QuestionIssue? =
    issues.firstOrNull { preferredTitle != null && it.title == preferredTitle }
        ?: issues.firstOrNull { branch != null && it.group == IssueGroup.Branch(branch) }
        ?: issues.firstOrNull()

/** What a later look at a repository found, against what was loaded. */
enum class Arrival {
    /** Nothing was loaded, and there are questions now. */
    FIRST,

    /** The questions loaded have been replaced, by another run or by hand. */
    NEWER,
}

/**
 * Whether loading again would show other questions. Both arguments are what
 * [chooseIssue] picked, from the issues as they were then and as they are now.
 * Null when nothing has changed, or the issue is gone.
 */
fun whatArrived(
    loaded: QuestionIssue?,
    latest: QuestionIssue?,
): Arrival? =
    when {
        latest == null -> null
        loaded == null -> Arrival.FIRST
        loaded.number == latest.number && loaded.body == latest.body -> null
        else -> Arrival.NEWER
    }
