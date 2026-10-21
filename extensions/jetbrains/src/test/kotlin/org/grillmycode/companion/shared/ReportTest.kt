package org.grillmycode.companion.shared

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.DynamicTest.dynamicTest
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource
import org.junit.jupiter.params.provider.ValueSource
import java.io.File

// A port of extensions/vscode/test/report.test.js. Both read extensions/fixtures/,
// which is what keeps the two readers in step.

/** One sample issue under extensions/fixtures/, current layout and kept ones alike. */
data class Fixture(
    val name: String,
    val issue: JsonObject,
    val body: String,
    val expected: JsonObject,
)

val fixtures: List<Fixture> by lazy {
    val root = File(System.getProperty("gmc.fixtures") ?: error("Run the tests through Gradle, which says where the fixtures are"))
    root
        .walkTopDown()
        .filter { it.isFile && it.name == "body.md" }
        .map { body ->
            val dir = body.parentFile

            fun json(name: String) = Json.parseToJsonElement(File(dir, name).readText()).jsonObject
            Fixture(dir.relativeTo(root).invariantSeparatorsPath, json("issue.json"), body.readText(), json("expected.json"))
        }.sortedBy { it.name }
        .toList()
}

fun fixture(name: String) = fixtures.single { it.name == name }

/** A report in the shape of expected.json's `report`, with its `questions` beside it. */
fun Report.toJson() =
    buildJsonObject {
        put("baseSha", baseSha)
        put("headSha", headSha)
        headCommit?.let { put("headCommit", it) }
        put("branch", branch)
        put("tag", tag)
        put("files", buildJsonArray { files.forEach { add(it) } })
        put("truncated", truncated)
        put(
            "questions",
            buildJsonArray {
                questions.forEach { q ->
                    add(
                        buildJsonObject {
                            put("number", q.number)
                            put("broader", q.broader)
                            put(
                                "snippets",
                                buildJsonArray {
                                    q.snippets.forEach { s ->
                                        add(
                                            buildJsonObject {
                                                put("file", s.file)
                                                put("start_line", s.startLine)
                                                put("end_line", s.endLine)
                                                put("language", s.language)
                                                put("code", s.code)
                                            },
                                        )
                                    }
                                },
                            )
                            put("question", q.question)
                            q.answer?.let { put("answer", it) }
                        },
                    )
                }
            },
        )
    }

fun IssueGroup.toJson() =
    when (this) {
        is IssueGroup.Branch ->
            buildJsonObject {
                put("kind", "branch")
                put("name", name)
            }
        is IssueGroup.Tag ->
            buildJsonObject {
                put("kind", "tag")
                put("name", pattern)
            }
        IssueGroup.Unnamed -> buildJsonObject { put("kind", "unnamed") }
    }

fun Fixture.expectedReport() = JsonObject(expected.getValue("report").jsonObject + ("questions" to expected.getValue("questions")))

fun read(body: String) = parseReport(body) as Report

class ReportTest {
    @Nested
    inner class ReadingTheFixtures {
        @Test
        fun `finds some`() {
            assertTrue(fixtures.isNotEmpty())
        }

        @TestFactory
        fun `recognizes the issue`(): List<DynamicTest> =
            fixtures.map { f ->
                dynamicTest(f.name) {
                    val issue = JsonObject(f.issue + mapOf("number" to JsonPrimitive(7), "body" to JsonPrimitive(f.body)))
                    assertEquals(f.expected["group"], findQuestionIssues(listOf(issue)).single().group.toJson())
                }
            }

        @TestFactory
        fun `reads the report`(): List<DynamicTest> =
            fixtures.map { f ->
                dynamicTest(f.name) { assertEquals(f.expectedReport(), read(f.body).toJson()) }
            }

        // GitHub stores an issue edited in the browser with CRLF line endings.
        @TestFactory
        fun `reads the report with CRLF line endings`(): List<DynamicTest> =
            fixtures.map { f ->
                dynamicTest(f.name) { assertEquals(f.expectedReport(), read(f.body.replace("\n", "\r\n")).toJson()) }
            }
    }

    private val body = fixture("current/default-branch").body
    private val feature = fixture("current/feature-branch").body

    @Nested
    inner class ParseReport {
        @ParameterizedTest
        @ValueSource(
            strings = [
                "",
                "## Bug\n\nThe cart total is wrong.\n\n---\n\nSteps to reproduce…",
                "## GrillMyCode\n\n---\n\n**Question 1:**\n\nWhy?\n",
            ],
        )
        fun `returns null for what is not a report`(text: String) {
            assertNull(parseReport(text))
        }

        @Test
        fun `returns null for no body`() {
            assertNull(parseReport(null))
        }

        @Test
        fun `keeps a rule and a fence inside a snippet as code`() {
            val first = read(feature).questions.first()
            assertEquals(1, first.snippets.size)
            assertTrue(first.snippets[0].code.contains("```bash"))
            assertTrue(first.snippets[0].code.contains("\n---\n"))
            assertEquals("What does `printHelp` write when it is called with no argument?", first.question)
        }

        @Test
        fun `restores the @ and # the action defused`() {
            assertEquals(
                "Which line would change if issue #12 asked for a rate tagged @deprecated to be skipped?",
                read(body).questions[3].question,
            )
        }

        @Test
        fun `marks a report with no footer as truncated`() {
            val report = read(body.substring(0, body.indexOf("_Generated by")))
            assertTrue(report.truncated)
            assertEquals(5, report.questions.size)
        }

        // The action cuts an over-long issue at a fixed length, then closes it with
        // a rule and a notice, so the cut can land anywhere in a question.
        private val notice = "\n\n---\n\n> [!WARNING]\n> The assessment was too long to display in full here."

        private fun numbers(text: String) = read(text).questions.map { it.number }

        @Test
        fun `drops the question a cut landed in the text of`() {
            val report = read(body.substring(0, body.indexOf("would change if issue")) + notice)
            assertTrue(report.truncated)
            assertEquals(listOf(1, 2, 3), report.questions.map { it.number })
        }

        @Test
        fun `drops the question a cut landed in a snippet of`() {
            val at = body.indexOf("const rate = RATES", body.indexOf("**Question 4:**"))
            assertEquals(listOf(1, 2, 3), numbers(body.substring(0, at) + notice))
        }

        @Test
        fun `keeps the earlier questions when a cut lands before any of the next`() {
            val at = body.indexOf("**Question 4:**") + "**Question 4:**".length
            assertEquals(listOf(1, 2, 3), numbers(body.substring(0, at) + notice))
        }

        @Test
        fun `reads nothing from text added after the footer`() {
            assertEquals(listOf(1, 2, 3, 4, 5), numbers("$body\n\n---\n\n**Question 99:**\n\n**Is this one real?**\n"))
        }

        @Test
        fun `reads a report posted before the hidden data existed, with no full commit`() {
            val before = fixture("v0.24/default-branch").body
            assertTrue("gmc:questions" !in before)
            val report = read(before)
            assertNull(report.headCommit)
            assertEquals(5, report.questions.size)
        }

        @Test
        fun `never takes a later line for the question`() {
            val edited = body.replace("**Question 2:**", "**Question 2:**\n\n**First text.**\n\n**Second text.**")
            assertEquals("First text.", read(edited).questions[1].question)
        }
    }

    @Nested
    inner class TheHiddenData {
        private val comment = Regex("""(?m)^<!-- gmc:questions (.*) -->$""")

        /** The body with its data comment's JSON replaced by what [change] makes of it. */
        private fun withDataText(change: (JsonObject) -> String): String =
            body.replace(comment) { match ->
                "<!-- gmc:questions ${change(Json.parseToJsonElement(match.groupValues[1]).jsonObject)} -->"
            }

        private fun withData(change: (JsonObject) -> JsonObject) = withDataText { change(it).toString() }

        @Test
        fun `gives the full commit the report reviewed`() {
            val report = read(body)
            assertEquals("9b8e7d6c5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c", report.headCommit)
            assertTrue(report.headCommit!!.startsWith(report.headSha))
        }

        @Test
        fun `is where a snippet's file and lines come from, not the caption`() {
            val edited = body.replace("**`src/cart.js`**, lines 1–9", "**`src/other.js`**, lines 40–50")
            assertNotEquals(body, edited)
            val snippet = read(edited).questions[0].snippets[0]
            assertEquals(Triple("src/cart.js", 1, 9), Triple(snippet.file, snippet.startLine, snippet.endLine))
        }

        @Test
        fun `reads a file name the caption cannot hold`() {
            val file = "src/odd `name`.js"
            val report = read(withData { withFirstSnippetField(it, "file", JsonPrimitive(file)) })
            assertEquals(file, report.questions[0].snippets[0].file)
        }

        @Test
        fun `leaves a question as the Markdown has it when the data lists it differently`() {
            val report =
                read(
                    withData { d ->
                        val questions = (d.getValue("questions") as JsonArray).toMutableList()
                        questions[0] = JsonObject(questions[0].jsonObject + ("snippets" to JsonArray(emptyList())))
                        questions[1] = JsonObject(questions[1].jsonObject + ("number" to JsonPrimitive(99)))
                        JsonObject(d + ("questions" to JsonArray(questions)))
                    },
                )
            assertEquals(listOf(1, 2, 3, 4, 5), report.questions.map { it.number })
            assertEquals("src/cart.js", report.questions[0].snippets[0].file)
            assertEquals(16, report.questions[1].snippets[0].startLine)
        }

        @Test
        fun `shows no more questions than the Markdown has`() {
            assertEquals(listOf(1, 2, 3), read(body.substring(0, body.indexOf("**Question 4:**"))).questions.map { it.number })
        }

        @ParameterizedTest(name = "{0}")
        @MethodSource("org.grillmycode.companion.shared.ReportTestKt#unsoundData")
        fun `falls back to the Markdown when the data`(
            @Suppress("UNUSED_PARAMETER") name: String,
            change: (JsonObject) -> String,
        ) {
            val report = read(withDataText(change))
            assertNull(report.headCommit)
            assertEquals(read(body).questions, report.questions)
        }

        @Test
        fun `asks for an update, and reads nothing, when the layout is newer`() {
            val newer =
                withData { d ->
                    buildJsonObject {
                        put("version", ISSUE_LAYOUT_VERSION + 1)
                        put("anything", d)
                    }
                }
            assertEquals(NeedsUpdate, parseReport(newer))
        }

        @Test
        fun `asks for an update even when the rest of a newer layout is unreadable`() {
            val comment = """<!-- gmc:questions {"version":${ISSUE_LAYOUT_VERSION + 1}} -->"""
            assertEquals(NeedsUpdate, parseReport("# A new heading\n\nNew text.\n\n$comment\n"))
        }

        @Test
        fun `takes the first comment, so one inside a snippet changes nothing`() {
            val edited = body.replace("existing.quantity += item.quantity;", """<!-- gmc:questions {"version":99} -->""")
            assertNotEquals(body, edited)
            assertTrue(parseReport(edited) is Report)
        }
    }
}

/** The data comment with its first question's first snippet's [key] set to [value]. */
fun withFirstSnippetField(
    data: JsonObject,
    key: String,
    value: JsonElement,
): JsonObject {
    val questions = data.getValue("questions") as JsonArray
    val first = questions[0].jsonObject
    val snippets = first.getValue("snippets") as JsonArray
    val snippet = JsonObject(snippets[0].jsonObject + (key to value))
    val question = JsonObject(first + ("snippets" to JsonArray(listOf(snippet) + snippets.drop(1))))
    return JsonObject(data + ("questions" to JsonArray(listOf(question) + questions.drop(1))))
}

/** Data comments that are not what the action writes, each as the JSON text made from the real one. */
@Suppress("unused") // Read by name, by @MethodSource.
fun unsoundData(): List<Arguments> {
    fun case(
        name: String,
        change: (JsonObject) -> JsonElement,
    ) = Arguments.of(name, { d: JsonObject -> change(d).toString() })
    return listOf(
        Arguments.of("is not JSON", { _: JsonObject -> "not json" }),
        case("has no version") { JsonObject(it - "version") },
        case("has a commit that is not a SHA") { JsonObject(it + ("headSha" to JsonPrimitive("../../etc"))) },
        case("has no questions") { JsonObject(it + ("questions" to JsonNull)) },
        case("has a line that is not a number") { withFirstSnippetField(it, "start_line", JsonPrimitive("1")) },
        case("has a file that is not text") { withFirstSnippetField(it, "file", buildJsonObject { put("toString", 1) }) },
    )
}
