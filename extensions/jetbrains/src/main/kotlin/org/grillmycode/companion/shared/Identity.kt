package org.grillmycode.companion.shared

// Submission identity
//
// Works out which assignment a student repository belongs to and whose it is,
// by the rules the action files an answer key under (src/submission-identity.js
// and tagGroupSlug in src/context.js). A port of
// extensions/vscode/src/shared/identity.js, whose tests check it against the
// action's.
//
// Classroom 50 names every student repository `<classroom>-<assignment>-<owner>`,
// where <owner> is the student's login, or `group-<n>` for a team.

/** What [matchSubmissionIdentity] works out from a repository's name. */
sealed interface IdentityMatch

/** Which assignment a repository belongs to and whose it is. [studentLogin] is empty for a team's. */
data class SubmissionIdentity(
    val assignment: String,
    val submitter: String,
    val studentLogin: String,
) : IdentityMatch

/** Why a repository's assignment and student could not be told. */
data class IdentityError(
    val error: String,
) : IdentityMatch

/** `<assignment>-group-<n>`: Classroom 50's name for a team's repository. */
private val TEAM_REPO_NAME = Regex("""^(.+)-(group-\d+)$""", RegexOption.IGNORE_CASE)

/**
 * The assignment and the student, from a repository's name and the logins of
 * its direct collaborators, or an [IdentityError] saying why they could not be
 * told.
 *
 * The student is the one direct collaborator whose login ends the name after a
 * hyphen. A name that ends in `-group-<n>` with no such collaborator is a
 * team's: the submitter is `group-<n>` and `studentLogin` is empty.
 */
fun matchSubmissionIdentity(
    repoName: String,
    collaboratorLogins: List<String>,
): IdentityMatch {
    val lowerRepo = repoName.lowercase()
    val matches =
        collaboratorLogins.filter { login ->
            val suffix = "-${login.lowercase()}"
            lowerRepo.length > suffix.length && lowerRepo.endsWith(suffix)
        }

    if (matches.size == 1) {
        val login = matches.single()
        return SubmissionIdentity(repoName.dropLast(login.length + 1), login, login)
    }
    if (matches.size > 1) {
        return IdentityError(
            "more than one direct collaborator's login ends the repository name " +
                "(${matches.joinToString(", ")}), so the student is ambiguous",
        )
    }

    TEAM_REPO_NAME.find(repoName)?.let { team ->
        return SubmissionIdentity(team.groupValues[1], team.groupValues[2].lowercase(), "")
    }

    return IdentityError(
        "no direct collaborator's login ends the repository name, so it does not follow " +
            "Classroom 50's <classroom>-<assignment>-<username> naming",
    )
}

/**
 * The identity of a repository that is the signed-in account's own, which is
 * one whose name ends with that account's login, or null when the name ends
 * some other way. It needs no request, so an ordinary student's collaborators
 * are never listed.
 */
fun ownSubmissionIdentity(
    repoName: String,
    login: String?,
): SubmissionIdentity? {
    if (login.isNullOrEmpty()) return null
    val identity = matchSubmissionIdentity(repoName, listOf(login)) as? SubmissionIdentity
    return identity?.takeIf { it.studentLogin.isNotEmpty() }
}

// The folder a submission tag pattern's answer key is filed under: `submit/*`
// gives `submit`. (A line comment: in KDoc, the pattern would open a nested
// block comment.)
fun tagGroupSlug(pattern: String?): String {
    val slug =
        (pattern ?: "")
            .replace(Regex("[^a-zA-Z0-9_-]"), "-")
            .replace(Regex("-{2,}"), "-")
            .replace(Regex("^-|-$"), "")
    return slug.ifEmpty { TAG_GROUP_FALLBACK }
}
