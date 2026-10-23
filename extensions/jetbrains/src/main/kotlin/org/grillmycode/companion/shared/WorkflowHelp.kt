package org.grillmycode.companion.shared

// Workflow help
//
// What to offer while a GrillMyCode step is being written: the inputs it can
// set, the values of an input that has a fixed set of them, and what an input
// is for. Positions are offsets into the text, so nothing here needs the IDE.
// A port of extensions/vscode/src/shared/workflow-help.js.

/** What is known about an input, as [describeInput] gives it. */
data class InputDescription(
    val name: String,
    val description: String,
    val default: String,
    val required: Boolean,
    val deprecated: Boolean,
    val values: List<String>,
)

/** Something to offer: an input's name, or one of an input's values. */
enum class CompletionKind { INPUT, VALUE }

/** One thing [completionsAt] offers. [insert] is the text it puts in. */
data class CompletionItem(
    val kind: CompletionKind,
    val label: String,
    val insert: String,
    val isDefault: Boolean,
)

/** What to offer, and the text from [start] to [end] that an item replaces. */
data class Completions(
    val start: Int,
    val end: Int,
    val items: List<CompletionItem>,
)

/** An input named in the text, from [start] to [end]. */
data class InputAt(
    val start: Int,
    val end: Int,
    val input: InputDescription,
)

/** An input's name being typed: the indent, then what there is of the name. */
private val NAME_BEFORE = Regex("""(\s*)([A-Za-z_][\w-]*)?""")

/** An input's value being typed: the indent, the name, then what there is of the value. */
private val VALUE_BEFORE = Regex("""(\s*)([A-Za-z_][\w-]*):[ \t]+["']?([\w:-]*)""")

/** The rest of a name or value, to the right of the cursor. */
private val REST_OF_WORD = Regex("""^[\w:-]*""")

private fun restOfWord(after: String) = REST_OF_WORD.find(after)?.value.orEmpty()

/** A line that is blank or holds only a comment, which ends no block. */
private val EMPTY_LINE = Regex("""\s*(#.*)?""")

private val COLON_NEXT = Regex("""^\s*:""")

/** What is known about an input, or null for a name the action does not declare. */
fun describeInput(name: String): InputDescription? {
    val key = name.lowercase()
    val input = ACTION_INPUTS[key] ?: return null
    return InputDescription(key, input.description, input.default, input.required, input.deprecated, inputValues(input))
}

/** The values an input can take, when it has a fixed set of them. */
private fun inputValues(input: ActionInput): List<String> =
    when (val rule = input.rule) {
        is InputRule.Bool -> listOf("true", "false")
        is InputRule.Enum -> rule.values + listOfNotNull(rule.prefix)
        else -> emptyList()
    }

/** Where each line of a text starts, and the line an offset is on. */
private class LineIndex(
    private val text: String,
) {
    val starts: List<Int> =
        buildList {
            add(0)
            var i = text.indexOf('\n')
            while (i != -1) {
                add(i + 1)
                i = text.indexOf('\n', i + 1)
            }
        }

    fun lineOf(offset: Int): Int {
        var line = starts.size - 1
        while (starts[line] > offset) line--
        return line
    }

    fun textOf(line: Int): String {
        val whole = text.substring(starts[line], starts.getOrNull(line + 1) ?: text.length)
        return if (whole.endsWith("\n")) whole.removeSuffix("\n").removeSuffix("\r") else whole
    }
}

/**
 * The GrillMyCode step whose `with` block holds a line, given the column that
 * line's own text starts at. The line is in the block when it comes after the
 * `with` key, is indented further than it, lines up with the inputs already
 * there, and nothing indented as little as `with` comes between.
 */
private fun enclosingStep(
    steps: List<WorkflowStep>,
    lines: LineIndex,
    line: Int,
    column: Int,
): WorkflowStep? =
    steps.find { step ->
        val with = step.with ?: return@find false
        val withLine = lines.lineOf(with.start)
        val withColumn = with.start - lines.starts[withLine]
        if (line <= withLine || column <= withColumn) return@find false
        val first = step.inputs.firstOrNull()
        if (first != null) {
            val firstLine = lines.lineOf(first.start)
            // Inputs written on the `with` line itself, in braces, are not a block.
            if (firstLine == withLine || first.start - lines.starts[firstLine] != column) return@find false
        }
        (withLine + 1 until line).none { between ->
            val text = lines.textOf(between)
            !EMPTY_LINE.matches(text) && text.indexOfFirst { !it.isWhitespace() } <= withColumn
        }
    }

/**
 * What to offer at an offset in a workflow file's text, or null where there is
 * nothing to offer.
 *
 * [names] false leaves out input names, for when something else in the IDE
 * already offers them.
 */
fun completionsAt(
    text: String,
    offset: Int,
    names: Boolean = true,
): Completions? {
    val lines = LineIndex(text)
    val line = lines.lineOf(offset)
    val lineStart = lines.starts[line]
    val lineText = lines.textOf(line)
    val before = lineText.substring(0, offset - lineStart)
    val after = lineText.substring(offset - lineStart)

    // The line being typed is often not YAML yet, so the rest of the file is
    // read without it. Blanks keep every other offset where it was.
    val blanked = text.substring(0, lineStart) + " ".repeat(lineText.length) + text.substring(lineStart + lineText.length)
    val steps = readWorkflow(blanked).steps
    if (steps.isEmpty()) return null

    val value = VALUE_BEFORE.matchEntire(before)
    if (value != null) {
        val (indent, name, typed) = value.destructured
        enclosingStep(steps, lines, line, indent.length) ?: return null
        val input = describeInput(name) ?: return null
        if (input.values.isEmpty()) return null
        return Completions(
            offset - typed.length,
            offset + restOfWord(after).length,
            input.values.map { CompletionItem(CompletionKind.VALUE, it, it, it == input.default) },
        )
    }

    if (!names) return null
    val name = NAME_BEFORE.matchEntire(before) ?: return null
    val indent = name.groupValues[1]
    val typed = name.groupValues[2]
    val rest = restOfWord(after)
    val tail = after.substring(rest.length)
    // Offered on a line with nothing else on it, or over the name of an input
    // that is already written out.
    val renaming = COLON_NEXT.containsMatchIn(rest + tail) || rest.contains(':')
    if (!renaming && tail.isNotBlank()) return null
    val step = enclosingStep(steps, lines, line, indent.length) ?: return null

    val taken = step.inputs.map { it.name.lowercase() }.toSet()
    return Completions(
        offset - typed.length,
        offset + if (renaming) rest.substringBefore(':').length else rest.length,
        ACTION_INPUTS
            .filter { (key, input) -> !input.hidden && !input.deprecated && key !in taken }
            .map { (key, _) -> CompletionItem(CompletionKind.INPUT, key, if (renaming) key else "$key: ", false) },
    )
}

/**
 * The input named at an offset in a workflow file's text, or null when the
 * offset is not on the name of an input the action declares.
 */
fun inputAt(
    text: String,
    offset: Int,
): InputAt? {
    for (step in readWorkflow(text).steps) {
        for (input in step.inputs) {
            if (offset < input.start || offset > input.end) continue
            return describeInput(input.name)?.let { InputAt(input.start, input.end, it) }
        }
    }
    return null
}
