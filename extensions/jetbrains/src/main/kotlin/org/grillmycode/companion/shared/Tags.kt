package org.grillmycode.companion.shared

// Submission tags
//
// What the action accepts as a submission tag pattern and as a tag name. A port
// of extensions/vscode/src/shared/tags.js, itself a copy of the action's rules
// in src/tags.js.

/** Characters a submission_tags pattern may contain. */
private val TAG_PATTERN_CHARSET = Regex("""[A-Za-z0-9._/*?+\[\]-]+""")

/** A quantifier with nothing to repeat, or a `+` straight after another one. */
private val STACKED_QUANTIFIER = Regex("""^[?+]|[*?+]\+""")

/** A single tag name: the pattern characters without the wildcards. */
private val TAG_NAME = Regex("""[A-Za-z0-9._][A-Za-z0-9._/-]*""")

private val TAG_LIST_SEPARATOR = Regex("""[,\r\n]+""")

/** True when [name] is a plain tag name usable in tag_diff_base's `tag:` form. */
fun isSafeTagName(name: String): Boolean = TAG_NAME.matches(name) && !name.contains("..") && !name.endsWith("/")

/**
 * Why the action rejects [value] as a tag_range: "format", "same" when it starts
 * and ends at one tag, or "" when it accepts it.
 */
fun tagRangeProblem(value: String): String {
    val parts = value.split("..").map { it.trim() }
    val from = parts.getOrElse(0) { "" }
    val to = parts.getOrElse(1) { "" }
    if (parts.size != 2 || value.contains("...") || !isSafeTagName(from) || (to != "" && !isSafeTagName(to))) {
        return "format"
    }
    return if (from == to) "same" else ""
}

/** True when the action accepts [pattern] as a submission_tags entry. */
fun isSafeTagPattern(pattern: String): Boolean = TAG_PATTERN_CHARSET.matches(pattern) && !STACKED_QUANTIFIER.containsMatchIn(pattern)

/** A tag list as the action splits it: on commas and line breaks, without blanks. */
fun splitTagList(value: String?): List<String> =
    value
        .orEmpty()
        .split(TAG_LIST_SEPARATOR)
        .map { it.trim() }
        .filter { it.isNotEmpty() }
