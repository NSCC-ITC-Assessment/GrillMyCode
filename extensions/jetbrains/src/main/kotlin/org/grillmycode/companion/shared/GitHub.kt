package org.grillmycode.companion.shared

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import java.net.URLEncoder

// GitHub reads
//
// The request the student side makes: a repository's open issues that carry
// the questions label. A port of the student half of
// extensions/vscode/src/shared/github.js; the instructor's two requests come
// with J3.
//
// The request itself is passed in, so tests can answer it.

/** A response: the HTTP status, and the body when the status is 200. */
data class HttpResponse(
    val status: Int,
    val body: String,
)

/** Sends a GET to [url] with [headers]. */
typealias HttpGet = (url: String, headers: Map<String, String>) -> HttpResponse

/** A failed GitHub request, with the HTTP status that explains it. */
class GitHubException(
    val status: Int,
    message: String,
) : Exception(message)

/**
 * Sends one GET to the REST API and returns the body. [what] names the thing
 * asked for, for the error.
 *
 * Throws [GitHubException] on any response but 200. GitHub answers 404 for a
 * private repository the token cannot see, not 403, so 404 means "missing, or
 * no access" and callers word it that way.
 */
private fun get(
    path: String,
    what: String,
    token: String,
    http: HttpGet,
): String {
    val response =
        http(
            "$GITHUB_API_URL$path",
            mapOf(
                "Accept" to "application/vnd.github+json",
                "Authorization" to "Bearer $token",
                "X-GitHub-Api-Version" to GITHUB_API_VERSION,
            ),
        )
    if (response.status != 200) throw GitHubException(response.status, "GitHub answered ${response.status} for $what")
    return response.body
}

private fun encode(part: String) = URLEncoder.encode(part, Charsets.UTF_8).replace("+", "%20")

private fun repoPath(
    owner: String,
    repo: String,
) = "/repos/${encode(owner)}/${encode(repo)}"

/**
 * Lists the repository's open issues labelled for GrillMyCode, as the REST API
 * returns them. A reply that is not a list reads as no issues.
 */
fun listLabelledIssues(
    owner: String,
    repo: String,
    token: String,
    http: HttpGet,
): List<JsonElement> {
    val query = "state=open&labels=${encode(ISSUE_LABEL)}&per_page=$ISSUES_PER_PAGE"
    val body = get("${repoPath(owner, repo)}/issues?$query", "$owner/$repo", token, http)
    return runCatching { Json.parseToJsonElement(body) as? JsonArray }.getOrNull() ?: emptyList()
}
