package org.grillmycode.companion.shared

// Git remotes
//
// Reads the GitHub owner and repository out of a Git remote URL. A port of
// extensions/vscode/src/shared/remote.js.

/** A remote, as the Git plugin reports it. */
data class Remote(
    val name: String,
    val fetchUrl: String? = null,
    val pushUrl: String? = null,
)

/** A GitHub repository, as `owner/repo`. */
data class GitHubRepo(
    val owner: String,
    val repo: String,
)

/** A remote that points at GitHub, with the repository it names. */
data class GitHubRemote(
    val name: String,
    val owner: String,
    val repo: String,
)

private val GITHUB_REMOTE =
    Regex(
        """^(?:(?:https?|ssh|git)://(?:[^@/\s]+@)?github\.com(?::\d+)?/|(?:[^@/\s]+@)?github\.com:)([^/\s]+)/([^/\s]+?)(?:\.git)?/?$""",
        RegexOption.IGNORE_CASE,
    )

/**
 * The repository a GitHub.com remote URL names, or null for any other host or
 * shape. Accepts the forms Git and GitHub hand out:
 *
 *   https://github.com/my-school/cs-principles-lab-3-jsmith.git
 *   https://jsmith@github.com/my-school/cs-principles-lab-3-jsmith
 *   git@github.com:my-school/cs-principles-lab-3-jsmith.git
 *   ssh://git@github.com/my-school/cs-principles-lab-3-jsmith.git
 */
fun parseGitHubRemote(url: String?): GitHubRepo? {
    val match = GITHUB_REMOTE.find(url?.trim() ?: return null) ?: return null
    return GitHubRepo(match.groupValues[1], match.groupValues[2])
}

/**
 * The repository to read questions for, from a clone's remotes: `origin` when
 * it points at GitHub, otherwise the first remote that does.
 */
fun pickGitHubRemote(remotes: List<Remote>): GitHubRemote? {
    val parsed =
        remotes.mapNotNull { remote ->
            parseGitHubRemote(remote.fetchUrl ?: remote.pushUrl)?.let { GitHubRemote(remote.name, it.owner, it.repo) }
        }
    return parsed.find { it.name == "origin" } ?: parsed.firstOrNull()
}
