/**
 * Shared constants
 *
 * The values that tie the extension to what the GrillMyCode action writes and
 * to GitHub. Nothing in shared/ imports the VS Code API, so these modules run
 * under the repository's own tests with no editor present.
 */

/**
 * The label the action puts on every questions issue (postIssue in
 * src/delivery/issue.js). test/extension-fixtures.test.js fails if the action
 * stops using it.
 */
export const ISSUE_LABEL = 'assessment';

/**
 * How every questions issue's title starts. The action follows it with the
 * branch, as ` (main)`, or the submission tag pattern, as ` (tag: submit/*)`.
 */
export const ISSUE_TITLE = 'GrillMyCode Questions';

/**
 * The newest issue layout this extension reads. The action writes its own
 * number into each issue's hidden `gmc:questions` comment
 * (ISSUE_LAYOUT_VERSION in src/constants.js), and an issue with a higher one
 * is not read: the extension asks to be updated. Raise this only once the
 * reader in report.js reads that layout and every one before it.
 */
export const ISSUE_LAYOUT_VERSION = 1;

/** Length of the commit SHAs a report prints, as GIT_SHA_SHORT_LENGTH in src/constants.js. */
export const SHORT_SHA_LENGTH = 7;

/** GitHub.com's REST API. GitHub Enterprise Server is not supported. */
export const GITHUB_API_URL = 'https://api.github.com';

/** GitHub REST API version sent with every request, as src/constants.js does. */
export const GITHUB_API_VERSION = '2026-03-10';

/**
 * Issues requested per page. One page is read: a repository would need more
 * than this many open issues labelled `assessment` to lose one, and the action
 * reads a single page of the same size when it looks for its own issue.
 */
export const ISSUES_PER_PAGE = 100;

/**
 * The scope asked of VS Code's GitHub sign-in. `repo` is the only scope that
 * lets an OAuth token read issues in a private repository.
 */
export const GITHUB_SCOPES = ['repo'];

/**
 * What the action adds to an assignment's name to name its instructor
 * repository, as INSTRUCTOR_REPO_SUFFIX in src/constants.js:
 * `cs-principles-lab-3` gives `cs-principles-lab-3-grillmycode-instructor`.
 */
export const INSTRUCTOR_REPO_SUFFIX = '-grillmycode-instructor';

/**
 * Where the action files a student's answer key, inside that student's folder
 * of the instructor repository (deliverToInstructorRepo in
 * src/delivery/instructor-repo.js).
 */
export const ANSWER_KEY_FILE = 'data/questions.json';

/**
 * The folder a submission tag's answer key is filed under when the tag pattern
 * has no character a folder name can keep, as SUBMISSION_TAG_GROUP_FALLBACK in
 * src/constants.js.
 */
export const TAG_GROUP_FALLBACK = 'tag';

/**
 * Collaborators requested per page. One page is read: a Classroom 50
 * repository has one direct collaborator per student.
 */
export const COLLABORATORS_PER_PAGE = 100;
