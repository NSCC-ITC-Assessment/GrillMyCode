package org.grillmycode.companion.shared

// What the plugin shares with the action, as extensions/vscode/src/shared/constants.js
// has it. Each names the constant in the action's src/constants.js it must match.

/** The label the action puts on a questions issue (ISSUE_LABEL). */
const val ISSUE_LABEL = "assessment"

/** The start of a questions issue's title (ISSUE_TITLE). */
const val ISSUE_TITLE = "GrillMyCode Questions"

/**
 * The newest issue layout the plugin reads (ISSUE_LAYOUT_VERSION). An issue with
 * a higher one is not read: the plugin asks to be updated. Raise this only once
 * the reader in Report.kt reads that layout and every one before it.
 */
const val ISSUE_LAYOUT_VERSION = 1

/** GitHub.com's REST API. GitHub Enterprise Server is not supported. */
const val GITHUB_API_URL = "https://api.github.com"

/** GitHub REST API version sent with every request, as src/constants.js does. */
const val GITHUB_API_VERSION = "2026-03-10"

/** Length of the commit SHAs a report prints, as GIT_SHA_SHORT_LENGTH in src/constants.js. */
const val SHORT_SHA_LENGTH = 7

/**
 * Issues requested per page. One page is read: a repository would need more
 * than this many open issues labelled `assessment` to lose one, and the action
 * reads a single page of the same size when it looks for its own issue.
 */
const val ISSUES_PER_PAGE = 100

// The plugin's own, with no counterpart in the action: the same values as
// extensions/vscode/src/shared/constants.js.

/**
 * How often the plugin asks GitHub whether new questions have arrived since the
 * last load, while the IDE has the focus. A run of the action takes a few
 * minutes, so a minute's wait at the end of one is not noticed, and sixty
 * requests an hour is a small part of what GitHub allows an account.
 */
const val NEW_QUESTIONS_CHECK_MS = 60_000L

/**
 * An IDE that regains the focus asks at once, unless it last asked less than
 * this long ago: someone switching between two windows should not send a
 * request each time.
 */
const val NEW_QUESTIONS_FOCUS_GAP_MS = 15_000L
