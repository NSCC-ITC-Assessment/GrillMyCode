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

/**
 * What the action adds to an assignment's name to name its instructor
 * repository (INSTRUCTOR_REPO_SUFFIX): `cs-principles-lab-3` gives
 * `cs-principles-lab-3-grillmycode-instructor`.
 */
const val INSTRUCTOR_REPO_SUFFIX = "-grillmycode-instructor"

/**
 * Where the action files a student's answer key, inside that student's folder
 * of the instructor repository (deliverToInstructorRepo in
 * src/delivery/instructor-repo.js).
 */
const val ANSWER_KEY_FILE = "data/questions.json"

/**
 * The folder a submission tag's answer key is filed under when the tag pattern
 * has no character a folder name can keep (SUBMISSION_TAG_GROUP_FALLBACK).
 */
const val TAG_GROUP_FALLBACK = "tag"

/**
 * How a question set's folder is marked in the student's folder of the
 * instructor repository (`jsmith/set.lab-3/`), as QUESTION_SET_MARK.
 */
const val QUESTION_SET_MARK = "set."

/**
 * The slug of the workflow name that is no question set at all, as
 * DEFAULT_QUESTION_SET_SLUG: a workflow named GrillMyCode files as one without
 * question_set.
 */
const val DEFAULT_QUESTION_SET_SLUG = "grillmycode"

/** The longest question_set the action accepts, as QUESTION_SET_MAX_CHARS. */
const val QUESTION_SET_MAX_CHARS = 100

/**
 * Collaborators requested per page. One page is read: a Classroom 50
 * repository has one direct collaborator per student.
 */
const val COLLABORATORS_PER_PAGE = 100

/**
 * The action as a workflow step's `uses` names it, before the `@` and the
 * version. GitHub ignores letter case in both halves.
 */
const val ACTION_REPOSITORY = "NSCC-ITC-Assessment/GrillMyCode"

/**
 * How far an input name may be from a known one, in single-letter edits, and
 * still be offered as what was meant: `num_question` for `num_questions`.
 */
const val INPUT_NAME_MAX_EDITS = 2

/**
 * The version of the action the Workflow Wizard writes after the `@`: its
 * current major, as the docs site's own Wizard writes. ConstantsTest fails
 * when it differs from the VS Code extension's.
 */
const val ACTION_REF = "v0"

/**
 * Where the Workflow Wizard's links to the docs lead: the docs of the latest
 * release of the action.
 */
const val DOCS_URL = "https://grillmycode.org/docs"

/**
 * The workflow file the Workflow Wizard writes, inside the project's folder.
 * The Wizard's Review step and the docs give the file this name.
 */
const val WORKFLOW_FILE = ".github/workflows/grill-my-code.yml"

/**
 * The longest workflow the Workflow Wizard's page may ask to have written, in
 * characters. The Wizard's own are a few thousand.
 */
const val WIZARD_MAX_WORKFLOW_CHARS = 200_000

/**
 * The largest file the Workflow Wizard's page is given in full, in bytes. It
 * reads only dependency manifests that way, such as package.json; a larger one
 * is left out, as one that cannot be read is.
 */
const val WIZARD_MAX_FILE_BYTES = 1_000_000

/**
 * The largest workflow file the workflow help reads to compare its question
 * sets with the one being edited, in bytes. A larger one is left out.
 */
const val OTHER_WORKFLOW_MAX_BYTES = 1_000_000

/** OpenRouter, which the Workflow Wizard's page asks for its list of models. */
const val OPENROUTER_ORIGIN = "https://openrouter.ai"
