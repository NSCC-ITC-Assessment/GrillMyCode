package org.grillmycode.companion.shared

// Input checks
//
// What is wrong with the inputs a workflow file gives the GrillMyCode action,
// as far as the file alone can say. Each check follows what the action does
// with the value (src/inputs.js), so nothing here is a rule of its own:
//
//   ERROR    the action fails the run, or cannot use the value
//   WARNING  the action carries on, but not with what was written
//   INFO     the input is fine and has no effect as the workflow stands
//
// A value GitHub works out at run time, such as `${{ inputs.num_questions }}`,
// is not checked: the file does not say what it will be. A port of
// extensions/vscode/src/shared/input-checks.js, with the same messages.

enum class Severity { ERROR, WARNING, INFO }

/**
 * What is wrong, how much it matters, and where in the text it is.
 * [deprecated] marks an input that is on its way out, which the editor strikes
 * through.
 */
data class Problem(
    val start: Int,
    val end: Int,
    val severity: Severity,
    val code: String,
    val message: String,
    val deprecated: Boolean = false,
)

/** A problem before it is given a place. */
private data class Finding(
    val severity: Severity,
    val code: String,
    val message: String,
    val deprecated: Boolean = false,
)

/** A secret read from a workflow input, which a run records as plain text. */
private val INPUT_EXPRESSION = Regex("""\$\{\{[^}]*\binputs\.""")

/** question_set set to the workflow's own name, as the Workflow Wizard writes it. */
private val WORKFLOW_NAME = Regex("""\$\{\{\s*github\.workflow\s*}}""")

/**
 * Another workflow file of the same repository: its path from the repository,
 * and the question sets its GrillMyCode steps file under ([questionSets]).
 */
data class OtherWorkflow(
    val path: String,
    val sets: List<String>,
)

private val WHOLE_NUMBER = Regex("""[+-]?\d+""")

private fun quote(value: Any?) = "\"$value\""

/** `"a", "b" or "c"`. */
private fun listValues(values: List<String>): String {
    val quoted = values.map(::quote)
    if (quoted.size < 2) return quoted.joinToString("")
    return "${quoted.dropLast(1).joinToString(", ")} or ${quoted.last()}"
}

/** How many single-letter edits turn [a] into [b]. */
private fun editDistance(
    a: String,
    b: String,
): Int {
    var previous = IntArray(b.length + 1) { it }
    for (i in 1..a.length) {
        val row = IntArray(b.length + 1)
        row[0] = i
        for (j in 1..b.length) {
            row[j] = minOf(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + if (a[i - 1] == b[j - 1]) 0 else 1)
        }
        previous = row
    }
    return previous[b.length]
}

/** The input a misspelled name most likely meant, if one is close enough. */
fun closestInput(name: String): String? {
    var best: Pair<String, Int>? = null
    for ((known, input) in ACTION_INPUTS) {
        if (input.hidden) continue
        val edits = editDistance(name.lowercase(), known)
        if (edits <= INPUT_NAME_MAX_EDITS && (best == null || edits < best.second)) best = known to edits
    }
    return best?.first
}

/**
 * What is wrong with a question set's name, as readQuestionSet in
 * src/inputs.js reads question_set: its white space made single spaces, at
 * most [QUESTION_SET_MAX_CHARS] long, with a letter, digit, - or _ to name a
 * folder. [what] begins the message.
 */
private fun questionSetProblem(
    what: String,
    value: String,
): Finding? {
    val name = value.replace(Regex("""\s+"""), " ").trim()
    if (name.length > QUESTION_SET_MAX_CHARS) {
        return Finding(
            Severity.ERROR,
            "invalid-value",
            "$what is ${name.length} characters long, and a question set's can be at most " +
                "$QUESTION_SET_MAX_CHARS. A run with this value fails.",
        )
    }
    if (questionSetSlug(name) == null) {
        return Finding(
            Severity.ERROR,
            "invalid-value",
            "$what, ${quote(name)}, has no letter, digit, - or _, so it cannot name the " +
                "question set's folder. A run with this value fails.",
        )
    }
    return null
}

/** What is wrong with one value, or null. */
private fun checkValue(
    name: String,
    rule: InputRule,
    raw: String,
): Finding? {
    // The action trims every input, and treats an empty one as not set.
    val value = raw.trim()
    if (value.isEmpty()) return null

    when (rule) {
        is InputRule.Enum -> {
            val given = if (rule.caseSensitive) value else value.lowercase()
            if (rule.prefix != null && given.startsWith(rule.prefix)) {
                val tag = value.substring(rule.prefix.length).trim()
                if (isSafeTagName(tag)) return null
                return Finding(
                    Severity.ERROR,
                    "invalid-value",
                    "$name: ${quote(value)} does not name a usable tag. Write it as " +
                        "${quote("${rule.prefix}phase1")}. The name may use letters, digits and . _ / - but " +
                        "no wildcards. A run with this value fails.",
                )
            }
            if (given in rule.values) return null
            val allowed =
                if (rule.prefix != null) {
                    "${rule.values.joinToString(", ") { quote(it) }} or ${quote("${rule.prefix}<tag name>")}"
                } else {
                    listValues(rule.values)
                }
            val oneOf = if (rule.values.size > 1 || rule.prefix != null) "one of " else ""
            return Finding(
                Severity.ERROR,
                "invalid-value",
                "$name must be $oneOf$allowed; got ${quote(value)}. A run with this value fails.",
            )
        }

        is InputRule.Bool -> {
            if (rule.strict) {
                if (value.lowercase() == "true" || value.lowercase() == "false") return null
                return Finding(
                    Severity.ERROR,
                    "invalid-value",
                    "$name must be \"true\" or \"false\"; got ${quote(value)}. A run with this value fails.",
                )
            }
            if (value == "true" || value == "false") return null
            return Finding(
                Severity.WARNING,
                "invalid-value",
                "$name is on only when it is exactly \"true\". ${quote(value)} is read as \"false\".",
            )
        }

        is InputRule.Integer -> {
            val number = jsParseInt(value)
            val min = jsNumberText(rule.min)
            if (number.isNaN()) {
                return Finding(Severity.ERROR, "invalid-value", "$name must be a whole number; got ${quote(value)}.")
            }
            if (number < rule.min) {
                return Finding(Severity.WARNING, "out-of-range", "$name is below the smallest value, $min, so $min is used.")
            }
            if (rule.max != null && number > rule.max) {
                val max = jsNumberText(rule.max)
                return Finding(Severity.WARNING, "out-of-range", "$name is above the largest value, $max, so $max is used.")
            }
            if (!WHOLE_NUMBER.matches(value)) {
                return Finding(
                    Severity.WARNING,
                    "invalid-value",
                    "$name must be a whole number. ${quote(value)} is read as ${jsNumberText(number)}.",
                )
            }
            return null
        }

        is InputRule.Number -> {
            val number = jsNumber(value)
            if (number.isFinite() && number >= rule.min && number <= rule.max) return null
            return Finding(
                Severity.WARNING,
                "out-of-range",
                "$name must be a number from ${jsNumberText(rule.min)} to ${jsNumberText(rule.max)}; got ${quote(value)}. " +
                    "The action ignores it.",
            )
        }

        is InputRule.Tags -> {
            val unsafe = splitTagList(value).filterNot(::isSafeTagPattern)
            if (unsafe.isEmpty()) return null
            return Finding(
                Severity.ERROR,
                "invalid-value",
                "$name has ${if (unsafe.size > 1) "patterns" else "a pattern"} the action does not " +
                    "support: ${unsafe.joinToString(", ") { quote(it) }}. A pattern may use letters, digits and " +
                    ". _ / - plus the wildcards * ** ? + and [ ] character classes; ! negation is not " +
                    "supported. A run with this value fails.",
            )
        }

        InputRule.QuestionSet -> return questionSetProblem(name, value)

        InputRule.Free -> return null
    }
}

/**
 * The question set a step files under, as the action works it out: its folder
 * name, empty for none, or null where the file does not say. question_set set
 * to github.workflow is the workflow's name, or for a workflow with none, its
 * file's path, which is what GitHub gives it then.
 */
private fun stepQuestionSet(
    step: WorkflowStep,
    workflowName: String?,
    path: String?,
): String? {
    // The last of a repeated name is the one GitHub keeps.
    val input = step.inputs.lastOrNull { it.name.lowercase() == "question_set" } ?: return ""
    val value = input.value?.trim() ?: return null
    if (WORKFLOW_NAME.matches(value)) return questionSetSlug(workflowName ?: path ?: return null)
    if (input.expression) return null
    return questionSetSlug(value)
}

/**
 * The question sets a workflow file's GrillMyCode steps file under, each once,
 * as [stepQuestionSet] works them out. [path] is the file's, from the
 * repository. A step whose set the file does not say is left out.
 */
fun questionSets(
    text: String,
    path: String? = null,
): List<String> {
    val workflow = readWorkflow(text)
    return workflow.steps.mapNotNull { stepQuestionSet(it, workflow.name?.value, path) }.distinct()
}

/** The problems with one step. */
private fun checkStep(
    step: WorkflowStep,
    tagFilters: List<String>?,
    unknownInputs: Boolean,
    workflowName: WorkflowName?,
    path: String?,
    otherWorkflows: List<OtherWorkflow>,
): List<Problem> {
    val problems = mutableListOf<Problem>()

    fun at(
        start: Int,
        end: Int,
        finding: Finding,
    ) {
        problems += Problem(start, end, finding.severity, finding.code, finding.message, finding.deprecated)
    }

    fun at(
        where: Span,
        finding: Finding,
    ) = at(where.start, where.end, finding)

    fun atName(
        input: StepInput,
        finding: Finding,
    ) = at(input.start, input.end, finding)

    fun atValue(
        input: StepInput,
        finding: Finding,
    ) = at(input.valueStart, input.valueEnd, finding)

    // GitHub ignores letter case in an input's name. The last of a repeated
    // name is the one it keeps.
    val set = step.inputs.associateBy { it.name.lowercase() }

    /** The text of an input that is set to something the file spells out. */
    fun literal(name: String): String? = set[name]?.takeIf { it.value != null && !it.expression }?.value?.trim()

    /** True when an input is absent or empty, so the action uses its default. */
    fun unset(name: String) = name !in set || literal(name) == ""

    val starterCode = literal("starter_code")?.lowercase()
    val previousWork = literal("previous_work")

    for (input in step.inputs) {
        val name = input.name.lowercase()
        val known = ACTION_INPUTS[name]
        if (known == null) {
            if (!unknownInputs) continue
            val meant = closestInput(input.name)
            atName(
                input,
                Finding(
                    Severity.WARNING,
                    "unknown-input",
                    if (meant != null) {
                        "GrillMyCode has no input ${quote(input.name)}, so GitHub ignores it. Did you mean ${quote(meant)}?"
                    } else {
                        "${quote(input.name)} is not an input this version of GrillMyCode Companion knows. " +
                            "GitHub ignores an input the action does not declare. If the input is new, " +
                            "update the plugin."
                    },
                ),
            )
            continue
        }

        if (known.deprecated) {
            val ignored =
                if (name == "include_initial_commit") {
                    !starterCode.isNullOrEmpty()
                } else {
                    !starterCode.isNullOrEmpty() && !previousWork.isNullOrEmpty()
                }
            atName(
                input,
                Finding(
                    Severity.WARNING,
                    "deprecated-input",
                    "$name is deprecated and will be removed in the next major version. " +
                        "Use ${known.replacement} instead." +
                        if (ignored) " It is ignored here, because its replacement is set." else "",
                    deprecated = true,
                ),
            )
            continue
        }

        val value = input.value ?: continue

        if (known.secret && value.trim().isNotEmpty()) {
            if (!input.expression) {
                atValue(
                    input,
                    Finding(
                        Severity.WARNING,
                        "secret-in-workflow",
                        "$name looks like it is written into the workflow file, where everyone " +
                            "who can read the repository can read it. Store it as a secret and refer to it " +
                            "as \${{ secrets.NAME }}.",
                    ),
                )
            } else if (INPUT_EXPRESSION.containsMatchIn(value)) {
                atValue(
                    input,
                    Finding(
                        Severity.WARNING,
                        "secret-in-workflow",
                        "$name is read from a workflow input, which GitHub records with the run " +
                            "as plain text. Store it as a secret and refer to it as \${{ secrets.NAME }}.",
                    ),
                )
            }
        }

        if (input.expression) continue
        checkValue(name, known.rule, value)?.let { atValue(input, it) }
    }

    // ── Inputs that depend on one another ─────────────────────────────────────

    // Where a problem with something that is missing is shown.
    val stepItself = step.with ?: step.uses

    fun place(name: String) = set[name]?.let { Span(it.start, it.end) } ?: stepItself

    // A preview stops before the AI is called, so it alone needs no key.
    val preview = set["preview_only"]?.expression == true || literal("preview_only")?.lowercase() == "true"
    if (unset("api_key") && !preview) {
        at(
            place("api_key"),
            Finding(
                Severity.ERROR,
                "missing-api-key",
                "api_key is not set. GrillMyCode writes its questions through OpenRouter, which " +
                    "needs its own API key, so the run fails. Only a preview_only run works without one.",
            ),
        )
    }

    if (literal("label_repos")?.lowercase() == "true" && unset("instructor_repo_token")) {
        at(
            place("label_repos"),
            Finding(
                Severity.WARNING,
                "needs-other-input",
                "label_repos needs instructor_repo_token, which is not set. The run writes no " +
                    "labels and warns about it.",
            ),
        )
    }

    val shareSet = "starter_questions_one_in" in set && !unset("starter_questions_one_in")
    if (shareSet && (unset("starter_code") || (!starterCode.isNullOrEmpty() && starterCode != "ask"))) {
        at(
            place("starter_questions_one_in"),
            Finding(Severity.INFO, "no-effect", "starter_questions_one_in has no effect unless starter_code is \"ask\"."),
        )
    }

    // Earlier work exists only when the assessed range starts after the first
    // commit: a tag run diffed from an earlier tag, or a base_sha.
    val diffBase = literal("tag_diff_base")?.lowercase()
    val fromEarlierTag = "tag_diff_base" in set && diffBase != "" && diffBase != "cumulative"
    if ("previous_work" in set && !unset("previous_work") && !fromEarlierTag && unset("base_sha")) {
        at(
            place("previous_work"),
            Finding(
                Severity.INFO,
                "no-effect",
                "previous_work has no effect here. A run has earlier work only when tag_diff_base " +
                    "is \"previous-tag\" or \"tag:<tag name>\", or base_sha is set.",
            ),
        )
    }

    // ── Submission tags ───────────────────────────────────────────────────────

    if (unset("submission_tags")) {
        if (tagFilters != null) {
            at(
                place("submission_tags"),
                Finding(
                    Severity.ERROR,
                    "missing-submission-tags",
                    "This workflow runs when a tag is pushed (on.push.tags), but submission_tags is not " +
                        "set, so every run started by a tag fails. List the same tag patterns in " +
                        "submission_tags.",
                ),
            )
        } else if (!diffBase.isNullOrEmpty() && diffBase != "cumulative") {
            at(
                place("tag_diff_base"),
                Finding(
                    Severity.INFO,
                    "no-effect",
                    "tag_diff_base applies only to a run started by a submission tag, and " +
                        "submission_tags is not set.",
                ),
            )
        }
    } else if (tagFilters != null && literal("submission_tags") != null) {
        // The two are copies of one list. GitHub's own `!` entries have no
        // counterpart in submission_tags, so they are left out of the comparison.
        val tags = set.getValue("submission_tags")
        val listed = splitTagList(literal("submission_tags"))
        val filters = tagFilters.filterNot { it.startsWith("!") }
        val notListed = filters.filterNot { it in listed }
        val notFiltered = listed.filterNot { it in filters }
        if (notListed.isNotEmpty()) {
            atValue(
                tags,
                Finding(
                    Severity.WARNING,
                    "tag-lists-differ",
                    "submission_tags does not list ${listValues(notListed)}, which the workflow's " +
                        "on.push.tags does. A run started by a tag that matches no submission_tags " +
                        "entry fails. Keep the two lists the same.",
                ),
            )
        }
        if (notFiltered.isNotEmpty()) {
            atValue(
                tags,
                Finding(
                    Severity.WARNING,
                    "tag-lists-differ",
                    "submission_tags lists ${listValues(notFiltered)}, which the workflow's " +
                        "on.push.tags does not, so pushing a tag only that entry matches starts no run. " +
                        "Keep the two lists the same.",
                ),
            )
        }
    }

    // ── Question set ──────────────────────────────────────────────────────────

    val questionSet = set["question_set"]
    val byName = questionSet?.value?.trim()?.let { WORKFLOW_NAME.matches(it) } == true
    if (byName && workflowName != null) {
        questionSetProblem("The workflow's name", workflowName.value)?.let { at(workflowName.start, workflowName.end, it) }
    } else if (byName && questionSet != null) {
        atValue(
            questionSet,
            Finding(
                Severity.INFO,
                "unnamed-workflow",
                "The workflow has no name, so github.workflow is the path of its file" +
                    (if (path != null) ", $path," else "") +
                    " and its question set is named after that. Give the workflow a name.",
            ),
        )
    }

    // Another file of the repository that files under the same set replaces
    // this one's questions, and this one its.
    val ownSet = stepQuestionSet(step, workflowName?.value, path)
    val sharing = otherWorkflows.filter { ownSet != null && it.path != path && ownSet in it.sets }
    if (sharing.isNotEmpty()) {
        val files = sharing.map { quote(it.path) }
        val named = if (files.size > 1) "${files.dropLast(1).joinToString(", ")} and ${files.last()}" else files[0]
        at(
            questionSet?.let { Span(it.start, it.end) } ?: step.uses,
            Finding(
                Severity.WARNING,
                "shared-question-set",
                "$named ${if (files.size > 1) "file their" else "files its"} questions under " +
                    "the same question set as this workflow${if (!ownSet.isNullOrEmpty()) ", ${quote(ownSet)}" else ""}, so " +
                    "each run replaces the other's issue, PDF and answer key. Give each workflow a " +
                    "name of its own" +
                    if (byName) "." else ", and set question_set: \${{ github.workflow }}.",
            ),
        )
    }

    return problems
}

/**
 * Every problem found in a workflow file's text, in the order written. A file
 * with no GrillMyCode step has none.
 *
 * [unknownInputs] false leaves out inputs the action does not declare, for when
 * something else in the IDE already reports them. [path] is the file's, from
 * the repository, and [otherWorkflows] the repository's other workflow files,
 * whose question sets this one's must not share.
 */
fun checkWorkflow(
    text: String,
    unknownInputs: Boolean = true,
    path: String? = null,
    otherWorkflows: List<OtherWorkflow> = emptyList(),
): List<Problem> {
    val (steps, tagFilters, name) = readWorkflow(text)
    return steps.flatMap { checkStep(it, tagFilters, unknownInputs, name, path, otherWorkflows) }.sortedBy { it.start }
}
