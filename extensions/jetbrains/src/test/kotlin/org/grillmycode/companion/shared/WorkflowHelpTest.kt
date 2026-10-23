package org.grillmycode.companion.shared

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.DynamicTest.dynamicTest
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory
import java.io.File

// Ports of extensions/vscode/test/workflow.test.js, input-checks.test.js and
// workflow-help.test.js. Their cases are in extensions/fixtures/workflow-help/,
// which both editors' tests run.

private val cases = File(System.getProperty("gmc.fixtures") ?: error("Run the tests through Gradle"), "workflow-help")

private fun readCases(name: String) = Json.parseToJsonElement(File(cases, name).readText()).jsonObject

private val sample = readCases("sample.json")

private fun JsonObject.string(name: String) = (this[name] as? JsonPrimitive)?.takeIf { it.isString }?.content

private fun JsonObject.strings(name: String) = (this[name] as? JsonArray)?.map { it.jsonPrimitive.content }

private fun JsonObject.flag(name: String) = (this[name] as? JsonPrimitive)?.takeIf { !it.isString }?.boolean

/** A workflow with one GrillMyCode step, whose `with` block is [inputs]. */
fun workflow(
    inputs: List<String>,
    on: String = sample.string("defaultOn")!!,
): String {
    val indent = sample.string("inputIndent")!!
    return sample
        .strings("lines")!!
        .flatMap {
            when (it) {
                "{on}" -> listOf(on)
                "{inputs}" -> inputs.map { input -> indent + input }
                else -> listOf(it)
            }
        }.joinToString("\n")
}

/** A case's text: its own, or the sample filled in with its inputs. */
private fun caseText(case: JsonObject) =
    case.string("text") ?: case.string("on")?.let { workflow(case.strings("inputs")!!, it) } ?: workflow(case.strings("inputs")!!)

private fun cases(
    name: String,
    test: (JsonObject) -> Unit,
): List<DynamicTest> =
    readCases(name).getValue("cases").jsonArray.map { element ->
        val case = element.jsonObject
        dynamicTest(case.string("name")!!) { test(case) }
    }

class WorkflowTest {
    @Test
    fun `accepts the action at any version, in any letter case`() {
        assertTrue(isGrillMyCodeAction("NSCC-ITC-Assessment/GrillMyCode@v0"))
        assertTrue(isGrillMyCodeAction("nscc-itc-assessment/grillmycode@v0.29.0"))
        assertTrue(isGrillMyCodeAction(" NSCC-ITC-Assessment/GrillMyCode@4f2c1ab "))
    }

    @Test
    fun `rejects anything else`() {
        assertFalse(isGrillMyCodeAction("actions/checkout@v6"))
        assertFalse(isGrillMyCodeAction("my-school/GrillMyCode@v0"))
        assertFalse(isGrillMyCodeAction("NSCC-ITC-Assessment/GrillMyCode-fork@v0"))
        assertFalse(isGrillMyCodeAction(null))
    }

    // A field a case leaves out is not checked; `with` and `value` set to
    // null mean there is none.
    @TestFactory
    fun readWorkflow() =
        cases("read.json") { case ->
            val text = caseText(case)
            val (steps, tagFilters, name) = readWorkflow(text)
            if ("tagFilters" in case) assertEquals(case.strings("tagFilters"), tagFilters)
            if ("workflowName" in case) {
                val want = case["workflowName"] as? JsonObject
                assertEquals(want?.string("value"), name?.value)
                assertEquals(want?.string("text"), name?.let { text.substring(it.start, it.end) })
            }
            if ("questionSets" in case) assertEquals(case.strings("questionSets"), questionSets(text, case.string("path")))
            val expectedSteps = case["steps"] as? JsonArray ?: return@cases
            assertEquals(expectedSteps.size, steps.size, "steps")
            expectedSteps.forEachIndexed { index, element ->
                val expected = element.jsonObject
                val step = steps[index]
                expected.string("uses")?.let { assertEquals(it, text.substring(step.uses.start, step.uses.end)) }
                if ("with" in expected) {
                    assertEquals(expected.string("with"), step.with?.let { text.substring(it.start, it.end) })
                }
                val inputs = expected["inputs"] as? JsonArray ?: return@forEachIndexed
                assertEquals(inputs.size, step.inputs.size, "inputs")
                inputs.forEachIndexed { i, wanted ->
                    val want = wanted.jsonObject
                    val input = step.inputs[i]
                    want.string("name")?.let { assertEquals(it, input.name) }
                    want.string("text")?.let { assertEquals(it, text.substring(input.start, input.end)) }
                    if ("value" in want) assertEquals(want.string("value"), input.value)
                    want.string("valueText")?.let { assertEquals(it, text.substring(input.valueStart, input.valueEnd)) }
                    want.flag("expression")?.let { assertEquals(it, input.expression) }
                }
            }
        }

    @Test
    fun `counts offsets as the editor does, past characters outside the BMP`() {
        val text = workflow(listOf("instructor_context: \"😀 loops\"", "starter_code: ask"))
        val input = readWorkflow(text).steps.single().inputs[1]
        assertEquals("starter_code", text.substring(input.start, input.end))
        assertEquals("ask", text.substring(input.valueStart, input.valueEnd))
    }

    // While a line is being typed the file is not YAML, and the step's other
    // problems should not vanish until it is. Neither editor reads such a file
    // exactly as it will be: VS Code's parser folds the half-typed line into
    // the next key, and this one leaves out the line SnakeYAML stops at.
    @Test
    fun `keeps the step while a line is not YAML yet`() {
        val text = workflow(listOf("api_key: x", "num_q", "starter_code: ask"))
        val step = readWorkflow(text).steps.single()
        assertEquals("api_key", step.inputs.first().name)
    }
}

class InputChecksTest {
    // Each case lists every problem the text has, in order, with what each must say.
    @TestFactory
    fun checkWorkflow() =
        cases("checks.json") { case ->
            val text = caseText(case)
            val others =
                (case["otherWorkflows"] as? JsonArray)?.map {
                    OtherWorkflow(it.jsonObject.string("path")!!, it.jsonObject.strings("sets")!!)
                }
            val found = checkWorkflow(text, case.flag("unknownInputs") ?: true, case.string("path"), others.orEmpty())
            val expected = case.getValue("problems").jsonArray
            assertEquals(expected.size, found.size, "problems: $found")
            expected.forEachIndexed { index, element ->
                val want = element.jsonObject
                val problem = found[index]
                want.string("severity")?.let { assertEquals(it, problem.severity.name.lowercase()) }
                want.string("code")?.let { assertEquals(it, problem.code) }
                want.string("text")?.let { assertEquals(it, text.substring(problem.start, problem.end)) }
                want.flag("deprecated")?.let { assertEquals(it, problem.deprecated) }
                want
                    .strings(
                        "messageContains",
                    )?.forEach { assertTrue(problem.message.contains(it), "\"${problem.message}\" lacks \"$it\"") }
                want.strings("messageLacks")?.forEach { assertFalse(problem.message.contains(it), "\"${problem.message}\" has \"$it\"") }
            }
        }

    @Test
    fun `never offers the hidden input`() {
        assertNull(closestInput("log_prompts"))
        assertEquals("api_key", closestInput("api_keys"))
    }

    // Every workflow the documentation shows is one the checks must have
    // nothing to say about, as test/extension-action-inputs.test.js checks for VS
    // Code. Read again here, as SnakeYAML is not the `yaml` package.
    @Nested
    inner class TheWorkflowsInTheDocumentation {
        private val root = File(System.getProperty("gmc.repository") ?: error("Run the tests through Gradle"))
        private val fence = Regex("""```ya?ml[^\n]*\n([\s\S]*?)```""")
        private val pages =
            File(root, "docs-site/docs").walkTopDown().filter { it.isFile && it.extension in setOf("md", "mdx") } +
                File(root, "README.md")
        private val workflows =
            pages
                .sortedBy { it.path }
                .flatMap { page ->
                    fence.findAll(page.readText()).mapIndexed { index, match ->
                        "${page.relativeTo(root).invariantSeparatorsPath} #${index + 1}" to match.groupValues[1]
                    }
                }.filter { (_, yaml) -> Regex("(?m)^on:").containsMatchIn(yaml) && readWorkflow(yaml).steps.isNotEmpty() }
                .toList()

        @Test
        fun `are found`() = assertTrue(workflows.size > 10, "found ${workflows.size}")

        @TestFactory
        fun `have no problems`() =
            workflows.map { (name, yaml) ->
                dynamicTest(name) { assertEquals(emptyList<Problem>(), checkWorkflow(yaml)) }
            }
    }
}

class WorkflowHelpTest {
    /** Where a case's cursor is, and its text without the mark: the first `|`, the start of `cursorAt`, or the end. */
    private fun cursor(case: JsonObject): Pair<String, Int> {
        val marked = caseText(case) + case.string("suffix").orEmpty()
        case.string("cursorAt")?.let { return marked to marked.indexOf(it) }
        if (case.flag("cursorAtEnd") == true) return marked to marked.length
        return marked.replaceFirst("|", "") to marked.indexOf('|')
    }

    @TestFactory
    fun completionsAt() =
        cases("completions.json") { case ->
            val (text, offset) = cursor(case)
            val found = completionsAt(text, offset, case.flag("names") ?: true)
            if (case.flag("offered") == false) {
                assertNull(found)
                return@cases
            }
            assertNotNull(found)
            found!!
            val inserts = found.items.map { it.insert }
            case.string("replaces")?.let { assertEquals(it, text.substring(found.start, found.end)) }
            case.strings("inserts")?.let { assertEquals(it, inserts) }
            case.strings("insertsInclude")?.forEach { assertTrue(it in inserts, "$inserts lacks $it") }
            case.strings("insertsAllInputsExcept")?.let { except ->
                assertEquals(ACTION_INPUTS.keys.filterNot { it in except }.map { "$it: " }, inserts)
            }
            case.strings("defaults")?.let { assertEquals(it, found.items.filter { item -> item.isDefault }.map { item -> item.label }) }
        }

    @Test
    fun `gives the description and default from action-yml`() {
        val input = describeInput("num_questions")!!
        assertEquals(InputDescription("num_questions", input.description, "20", false, false, emptyList()), input)
        assertTrue(input.description.contains("maximum 50"))
    }

    @Test
    fun `gives the default the action uses where action-yml's own is empty`() {
        assertEquals("ignore", describeInput("starter_code")!!.default)
        assertEquals("context", describeInput("previous_work")!!.default)
    }

    @Test
    fun `knows nothing of a name the action does not declare`() {
        assertNull(describeInput("rubric_file"))
        assertNull(describeInput("constructor"))
    }

    @Test
    fun `finds the input under an offset, on its name only`() {
        val text = workflow(listOf("api_key: x", "starter_code: ask"))
        val at = text.indexOf("starter_code")
        val found = inputAt(text, at + 3)!!
        assertEquals(listOf(at, at + 12, "starter_code"), listOf(found.start, found.end, found.input.name))
        assertNull(inputAt(text, text.indexOf("ask") + 1))
        assertNull(inputAt(text, text.indexOf("fetch-depth") + 1))
    }
}

class JavaScriptTest {
    @Test
    fun `writes numbers as JavaScript does`() {
        val written = listOf(1.0, 0.5, 5.5, -3.0, 1e21, 1.5e-7, 0.000001, 123456789012.0, 1e300, Double.NaN, -0.0).map(::jsNumberText)
        assertEquals(listOf("1", "0.5", "5.5", "-3", "1e+21", "1.5e-7", "0.000001", "123456789012", "1e+300", "NaN", "0"), written)
    }

    @Test
    fun `reads numbers as JavaScript does`() {
        assertEquals(listOf(5.0, 16.0, 0.5, 1000.0, 0.0), listOf("5.", "0x10", ".5", "1e3", "").map(::jsNumber))
        assertTrue(jsNumber("warm").isNaN() && jsNumber("-0x10").isNaN())
        assertEquals(listOf(5.0, -3.0, 12.0), listOf("5.5", "-3", "12abc").map(::jsParseInt))
        assertTrue(jsParseInt("twenty").isNaN())
    }
}
