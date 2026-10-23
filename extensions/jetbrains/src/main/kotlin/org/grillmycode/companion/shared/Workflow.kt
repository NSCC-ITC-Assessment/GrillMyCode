package org.grillmycode.companion.shared

import org.snakeyaml.engine.v2.api.LoadSettings
import org.snakeyaml.engine.v2.api.lowlevel.Compose
import org.snakeyaml.engine.v2.common.ScalarStyle
import org.snakeyaml.engine.v2.exceptions.MarkedYamlEngineException
import org.snakeyaml.engine.v2.exceptions.YamlEngineException
import org.snakeyaml.engine.v2.nodes.MappingNode
import org.snakeyaml.engine.v2.nodes.Node
import org.snakeyaml.engine.v2.nodes.ScalarNode
import org.snakeyaml.engine.v2.nodes.SequenceNode

// Workflow files
//
// Finds the steps of a workflow file that run the GrillMyCode action, and the
// inputs each one sets, with where each is in the text. Positions are offsets
// into the text, so nothing here needs the IDE. A port of
// extensions/vscode/src/shared/workflow.js, which reads YAML with the `yaml`
// package; here SnakeYAML Engine reads it, and its scalars are given the text
// the `yaml` package's core schema would.

/** Where something is in the text: the offsets it starts and ends at. */
data class Span(
    val start: Int,
    val end: Int,
)

/**
 * An input a step sets: where its name is, and its [value] when that is one an
 * input can have, with where the value is and whether GitHub works it out at
 * run time.
 */
data class StepInput(
    val name: String,
    val start: Int,
    val end: Int,
    val value: String? = null,
    val valueStart: Int = end,
    val valueEnd: Int = end,
    val expression: Boolean = false,
)

/** A step that runs the action: where its `uses` value is, where its `with` key is when it has one, and its inputs. */
data class WorkflowStep(
    val uses: Span,
    val with: Span?,
    val inputs: List<StepInput>,
)

/**
 * The workflow's `name`, written as text, and where it is. GitHub shows it in
 * the Actions tab, and it is github.workflow, which question_set may be set to.
 */
data class WorkflowName(
    val value: String,
    val start: Int,
    val end: Int,
)

/**
 * What [readWorkflow] found: every step that runs the action, the patterns of
 * `on.push.tags`, when there are any, and the workflow's [name], when it has one.
 */
data class Workflow(
    val steps: List<WorkflowStep>,
    val tagFilters: List<String>?,
    val name: WorkflowName? = null,
)

/** What marks a value GitHub works out when the workflow runs. */
private const val EXPRESSION = "\${{"

/**
 * How many lines a reading may leave out before giving up. Each mistake costs
 * one: a file being typed has one or two.
 */
private const val MAX_LINES_LEFT_OUT = 20

/** True when a step's `uses` names the GrillMyCode action, at any version. */
fun isGrillMyCodeAction(uses: String?): Boolean =
    uses
        .orEmpty()
        .trim()
        .substringBefore('@')
        .equals(ACTION_REPOSITORY, ignoreCase = true)

// The `yaml` package's core schema, which decides what a plain scalar is.
private val NULL = Regex("""~|[Nn]ull|NULL|""")
private val BOOL = Regex("""[Tt]rue|TRUE|[Ff]alse|FALSE""")
private val INT_OCT = Regex("""0o([0-7]+)""")
private val INT = Regex("""[-+]?[0-9]+""")
private val INT_HEX = Regex("""0x([0-9a-fA-F]+)""")
private val FLOAT_NAN = Regex("""[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN""")
private val FLOAT_EXP = Regex("""[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+""")
private val FLOAT = Regex("""[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)""")

/**
 * A plain scalar as the action receives it. GitHub hands every input over as
 * text: `true` and `True` both arrive as "true", `20` as "20", `1.0` as "1",
 * and an empty value as nothing. Null when the scalar is a string, which
 * arrives as written.
 */
private fun plainText(raw: String): String? {
    val signed = { digits: String -> if (raw.startsWith("-")) -digitsToDouble(digits, 10) else digitsToDouble(digits, 10) }
    return when {
        NULL.matches(raw) -> ""
        BOOL.matches(raw) -> if (raw[0] == 't' || raw[0] == 'T') "true" else "false"
        INT_OCT.matches(raw) -> jsNumberText(digitsToDouble(raw.substring(2), 8))
        INT.matches(raw) -> jsNumberText(signed(raw.trimStart('-', '+')))
        INT_HEX.matches(raw) -> jsNumberText(digitsToDouble(raw.substring(2), 16))
        FLOAT_NAN.matches(raw) ->
            when {
                raw.endsWith("nan", ignoreCase = true) -> "NaN"
                raw.startsWith("-") -> "-Infinity"
                else -> "Infinity"
            }
        FLOAT_EXP.matches(raw) || FLOAT.matches(raw) -> jsNumberText(raw.toDouble())
        else -> null
    }
}

/** A scalar as the action receives it. */
private fun scalarText(node: ScalarNode): String =
    if (node.scalarStyle == ScalarStyle.PLAIN) plainText(node.value) ?: node.value else node.value

/** Offsets into the text. SnakeYAML counts code points; Kotlin, like JavaScript, counts UTF-16 units. */
private class Offsets(
    private val text: String,
) {
    private val plain = text.length == text.codePointCount(0, text.length)

    fun of(codePoints: Int): Int = if (plain) codePoints else text.offsetByCodePoints(0, codePoints)

    fun span(node: Node): Span? {
        val start = node.startMark.orElse(null) ?: return null
        val end = node.endMark.orElse(null) ?: return null
        return Span(of(start.index), of(end.index))
    }
}

private class Reader(
    private val offsets: Offsets,
) {
    val steps = mutableListOf<WorkflowStep>()

    /** The value of the pair whose key is the scalar [name], and the key. */
    private fun MappingNode.pair(name: String) =
        value.find { (it.keyNode as? ScalarNode)?.value == name }?.let { it.keyNode as ScalarNode to it.valueNode }

    /** The inputs a step's `with` mapping sets, in the order they are written. */
    private fun readInputs(withNode: Node?): List<StepInput> {
        if (withNode !is MappingNode) return emptyList()
        return withNode.value.mapNotNull { tuple ->
            val key = tuple.keyNode as? ScalarNode ?: return@mapNotNull null
            val name = offsets.span(key) ?: return@mapNotNull null
            val input = StepInput(scalarText(key), name.start, name.end)
            val value = tuple.valueNode
            val at = (value as? ScalarNode)?.let { offsets.span(it) }
            // Anything but a scalar is not a value an input can have, and
            // GitHub's own checks say so. An alias names a value written
            // elsewhere, which the `yaml` package does not read as one.
            if (value !is ScalarNode || at == null || at.start < name.end) return@mapNotNull input
            val text = scalarText(value)
            input.copy(value = text, valueStart = at.start, valueEnd = at.end, expression = text.contains(EXPRESSION))
        }
    }

    /** Looks for steps in [node] and everything under it, in the order written. */
    fun visit(node: Node?) {
        when (node) {
            is MappingNode -> {
                readStep(node)
                for (tuple in node.value) {
                    visit(tuple.keyNode)
                    visit(tuple.valueNode)
                }
            }
            is SequenceNode -> node.value.forEach(::visit)
            else -> Unit
        }
    }

    private fun readStep(map: MappingNode) {
        val uses = map.pair("uses")?.second as? ScalarNode ?: return
        val usesAt = offsets.span(uses) ?: return
        if (!isGrillMyCodeAction(scalarText(uses))) return
        val with = map.pair("with")
        steps += WorkflowStep(usesAt, with?.first?.let { offsets.span(it) }, readInputs(with?.second))
    }

    /** The tag patterns of `on.push.tags`, or null when the workflow has none. */
    fun tagFilters(root: Node?): List<String>? {
        var node: Node? = root
        for (name in listOf("on", "push", "tags")) node = (node as? MappingNode)?.pair(name)?.second
        val nodes = if (node is SequenceNode) node.value else listOf(node)
        val filters = nodes.filterIsInstance<ScalarNode>().map(::scalarText).filter { it.isNotEmpty() }
        return filters.ifEmpty { null }
    }

    /** The workflow's `name`, or null when it has none written as text. */
    fun name(root: Node?): WorkflowName? {
        val node = (root as? MappingNode)?.pair("name")?.second as? ScalarNode ?: return null
        val at = offsets.span(node) ?: return null
        val value = scalarText(node)
        return if (value.isBlank()) null else WorkflowName(value, at.start, at.end)
    }
}

/** [text] with the line holding [offset] replaced by spaces, so every other offset stays where it was. */
private fun blankLineAt(
    text: String,
    offset: Int,
): String {
    val start = text.lastIndexOf('\n', offset - 1) + 1
    val end = text.indexOf('\n', offset).let { if (it < 0) text.length else it }
    return text.substring(0, start) + text.substring(start, end).replace(Regex("""[^\r]"""), " ") + text.substring(end)
}

/**
 * Reads a workflow file's text: every step that runs the action, and the
 * patterns of `on.push.tags`, when there are any. Only the first document is
 * read, as the `yaml` package does.
 *
 * The `yaml` package reads past a mistake, and SnakeYAML stops at one. So a
 * file that cannot be read as YAML is read again without the line the mistake
 * is on, until what is left can be. A file being typed thus keeps its other
 * steps' problems; one that is not YAML at all gives nothing.
 */
fun readWorkflow(text: String): Workflow {
    // Blanking keeps each UTF-16 unit where it was, so an offset into what is
    // read is an offset into the text.
    var source = text
    repeat(MAX_LINES_LEFT_OUT) {
        val offsets = Offsets(source)
        try {
            val root =
                Compose(LoadSettings.builder().build())
                    .composeAllFromString(source)
                    .firstOrNull()
            val reader = Reader(offsets)
            reader.visit(root)
            return Workflow(reader.steps, reader.tagFilters(root), reader.name(root))
        } catch (mistake: YamlEngineException) {
            val marked = mistake as? MarkedYamlEngineException ?: return Workflow(emptyList(), null)
            // Where the mistake was found, or, when that line is already blank
            // (the end of the file, say), where what it interrupts began.
            source =
                listOf(marked.problemMark, marked.contextMark)
                    .mapNotNull { it.orElse(null) }
                    .map { blankLineAt(source, offsets.of(it.index).coerceIn(0, source.length)) }
                    .firstOrNull { it != source }
                    ?: return Workflow(emptyList(), null)
        }
    }
    return Workflow(emptyList(), null)
}
