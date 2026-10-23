package org.grillmycode.companion.instructor

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.grillmycode.companion.shared.GitHubException
import org.grillmycode.companion.shared.HttpGet
import org.grillmycode.companion.shared.HttpResponse
import org.grillmycode.companion.shared.IssueGroup
import org.grillmycode.companion.shared.Question
import org.grillmycode.companion.shared.Report
import org.grillmycode.companion.shared.listDirectCollaborators
import org.grillmycode.companion.shared.parseReport
import org.grillmycode.companion.shared.readFile
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory
import java.io.File
import java.io.IOException

// A port of extensions/vscode/test/answer-key.test.js. Both read the answer
// keys in extensions/fixtures/current/, which the action's own tests write.

/** A case in the current layout, with the answer key its run filed. */
private data class KeyCase(
    val name: String,
    val body: String,
    val key: String,
)

private val cases: List<KeyCase> by lazy {
    val root = File(System.getProperty("gmc.fixtures") ?: error("Run the tests through Gradle, which says where the fixtures are"))
    File(root, "current")
        .listFiles { file -> file.isDirectory }!!
        .sortedBy { it.name }
        .map { KeyCase(it.name, File(it, "body.md").readText(), File(it, "questions.json").readText()) }
}

private val keyText by lazy { cases.single { it.name == "default-branch" }.key }

private fun reportQuestions(body: String) = (parseReport(body) as Report).questions

private fun key(text: String) = parseAnswerKey(text)!!

/** The parts of a question the issue gives as well. */
private fun Question.asked() = copy(answer = null, distractors = emptyList())

class AnswerKeyTest {
    @Nested
    inner class Location {
        @Test
        fun `is the student's folder of the assignment's instructor repository`() {
            assertEquals(
                AnswerKeyLocation("cs-principles-lab-3-grillmycode-instructor", "jsmith/data/questions.json"),
                answerKeyLocation("cs-principles-lab-3", "jsmith", IssueGroup.Branch("main")),
            )
            assertEquals("jsmith/data/questions.json", answerKeyLocation("cs-principles-lab-3", "jsmith", null).path)
        }

        @Test
        fun `is one folder down for a submission tag`() {
            assertEquals(
                "jsmith/submit/data/questions.json",
                answerKeyLocation("cs-principles-lab-3", "jsmith", IssueGroup.Tag("submit/*")).path,
            )
        }
    }

    @Nested
    inner class Fixtures {
        @TestFactory
        fun `reads every question with its answer`() =
            cases.map { case ->
                DynamicTest.dynamicTest(case.name) {
                    val questions = key(case.key)
                    // The issue's questions, as a reader takes them from the issue, are the key's.
                    assertEquals(reportQuestions(case.body).map { it.asked() }, questions.map { it.asked() })
                    for (question in questions) {
                        assertFalse(question.answer.isNullOrEmpty())
                        assertEquals(3, question.distractors.size)
                    }
                }
            }

        @TestFactory
        fun `the key matches the issue of the same run`() =
            cases.map { case ->
                DynamicTest.dynamicTest(case.name) { assertTrue(matchesReport(reportQuestions(case.body), key(case.key))) }
            }

        @Test
        fun `tells a key from the issue of another run`() {
            val first = cases[0]
            val third = cases[2]
            assertFalse(matchesReport(reportQuestions(first.body), key(third.key)))
        }
    }

    @Nested
    inner class Parse {
        private val entry =
            buildJsonObject {
                put("number", 1)
                put("dropped", false)
                put("broader", false)
                put(
                    "snippets",
                    JsonArray(
                        listOf(
                            buildJsonObject {
                                put("file", "a.js")
                                put("start_line", 1)
                                put("end_line", 2)
                                put("language", "js")
                                put("code", "a();")
                            },
                        ),
                    ),
                )
                put("question", "Why?")
                put("answer", "Because.")
                put("distractors", JsonArray(listOf(JsonPrimitive("No."))))
            }

        private fun with(vararg changes: Pair<String, JsonElement?>): JsonObject {
            val fields = entry.toMutableMap()
            for ((name, value) in changes) if (value == null) fields.remove(name) else fields[name] = value
            return JsonObject(fields)
        }

        private fun parse(vararg questions: JsonElement) =
            parseAnswerKey(JsonObject(mapOf("questions" to JsonArray(questions.toList()))).toString())

        @Test
        fun `leaves out a question that was dropped, which the report never asked`() {
            assertEquals(1, parse(entry, with("number" to JsonNull, "dropped" to JsonPrimitive(true)))?.size)
        }

        @Test
        fun `leaves out what does not fit, and keeps the rest`() {
            val questions =
                parse(
                    with(
                        "snippets" to
                            JsonArray(
                                listOf(
                                    buildJsonObject { put("file", 7) },
                                    buildJsonObject {
                                        put("file", "a.js")
                                        put("start_line", "1")
                                        put("end_line", 2)
                                    },
                                ),
                            ),
                    ),
                    with("number" to JsonPrimitive("two")),
                    with("number" to JsonPrimitive(3), "question" to JsonNull),
                    JsonNull,
                )!!
            assertEquals(1, questions.single().number)
            assertEquals(emptyList<Any>(), questions.single().snippets)
        }

        @Test
        fun `reads a key written without distractors or an answer`() {
            val question = parse(with("answer" to null, "distractors" to null))!!.single()
            assertEquals("", question.answer)
            assertEquals(emptyList<String>(), question.distractors)
        }

        @Test
        fun `is null for anything that is not an answer key`() {
            assertNull(parseAnswerKey("not JSON"))
            assertNull(parseAnswerKey("""{"questions":"none"}"""))
            assertNull(parseAnswerKey("null"))
            assertNull(parse())
        }
    }

    @Nested
    inner class Matching {
        private val key by lazy { key(keyText) }

        @Test
        fun `accepts a report that was cut short`() {
            assertTrue(matchesReport(key.take(2), key))
        }

        @Test
        fun `refuses a question the key does not have, or has on other lines`() {
            assertFalse(matchesReport(listOf(key[0].copy(number = 99)), key))
            val moved = key[0].copy(snippets = listOf(key[0].snippets[0].copy(startLine = 2)))
            assertFalse(matchesReport(listOf(moved), key))
        }
    }

    @Nested
    inner class Find {
        private val owner = "my-school"
        private val repo = "cs-principles-lab-3-jsmith"
        private val keyUrl =
            "https://api.github.com/repos/my-school/cs-principles-lab-3-grillmycode-instructor" +
                "/contents/jsmith/data/questions.json"
        private val collaboratorsUrl =
            "https://api.github.com/repos/my-school/cs-principles-lab-3-jsmith/collaborators" +
                "?affiliation=direct&per_page=100"

        /** A stand-in for GitHub that answers each address with a status and a body, and keeps the addresses asked for. */
        private inner class GitHub(
            private val replies: Map<String, Pair<Int, String>>,
        ) : HttpGet {
            val urls = mutableListOf<String>()

            override fun invoke(
                url: String,
                headers: Map<String, String>,
            ): HttpResponse {
                urls += url
                val (status, body) = replies[url] ?: (404 to "")
                return HttpResponse(status, body)
            }
        }

        private fun find(
            login: String,
            github: HttpGet,
            group: IssueGroup? = null,
        ) = findAnswerKey(owner, repo, login, group, "token", github)

        @Test
        fun `finds nothing for a student, with one request`() {
            val github = GitHub(emptyMap())
            val found = find("jsmith", github)
            assertTrue((found as NoAnswerKey).reason.contains("404"))
            assertEquals(listOf(keyUrl), github.urls)
        }

        @Test
        fun `finds an instructor's own key without listing collaborators`() {
            val github = GitHub(mapOf(keyUrl to (200 to keyText)))
            val found = find("jsmith", github) as AnswerKey
            assertTrue(found.own)
            assertEquals(5, found.questions.size)
            assertEquals(1, github.urls.size)
        }

        @Test
        fun `finds the student of someone else's repository from its collaborators`() {
            val github = GitHub(mapOf(collaboratorsUrl to (200 to """[{"login":"jsmith"}]"""), keyUrl to (200 to keyText)))
            val found = find("instructor", github) as AnswerKey
            assertFalse(found.own)
            assertEquals("cs-principles-lab-3-grillmycode-instructor", found.repo)
            assertEquals("jsmith/data/questions.json", found.path)
            assertFalse(found.questions[0].answer.isNullOrEmpty())
        }

        @Test
        fun `reads the key of the submission tag whose questions are showing`() {
            val tagged = keyUrl.replace("jsmith/data", "jsmith/submit/data")
            val found = find("jsmith", GitHub(mapOf(tagged to (200 to keyText))), IssueGroup.Tag("submit/*")) as AnswerKey
            assertEquals("jsmith/submit/data/questions.json", found.path)
        }

        @Test
        fun `finds nothing when the collaborators cannot be listed`() {
            val github = GitHub(mapOf(collaboratorsUrl to (403 to ""), keyUrl to (200 to keyText)))
            val found = find("helper", github)
            assertTrue((found as NoAnswerKey).reason.contains("403"))
            assertEquals(1, github.urls.size)
        }

        @Test
        fun `finds nothing when no collaborator is the student`() {
            val found = find("instructor", GitHub(mapOf(collaboratorsUrl to (200 to """[{"login":"someone"}]"""))))
            assertTrue((found as NoAnswerKey).reason.contains("no direct collaborator"))
        }

        @Test
        fun `finds nothing in a file that is not an answer key`() {
            val found = find("jsmith", GitHub(mapOf(keyUrl to (200 to "# Not JSON"))))
            assertTrue((found as NoAnswerKey).reason.contains("is not an answer key"))
        }

        @Test
        fun `finds nothing, and does not throw, when the request itself fails`() {
            val found = find("jsmith", { _, _ -> throw IOException("connection refused") })
            assertEquals(NoAnswerKey("connection refused"), found)
        }
    }

    @Nested
    inner class Requests {
        @Test
        fun `lists the logins of the direct collaborators`() {
            var headers = emptyMap<String, String>()
            val logins =
                listDirectCollaborators("my-school", "cs-principles-lab-3-jsmith", "token") { _, sent ->
                    headers = sent
                    HttpResponse(200, """[{"login":"jsmith"},{"id":4},null]""")
                }
            assertEquals(listOf("jsmith"), logins)
            assertEquals("Bearer token", headers["Authorization"])
        }

        @Test
        fun `asks for a file as it is, with each part of its path escaped`() {
            var asked = ""
            var headers = emptyMap<String, String>()
            val text =
                readFile("my-school", "cs-principles-lab-3-jsmith", "j smith/data/questions.json", "token") { url, sent ->
                    asked = url
                    headers = sent
                    HttpResponse(200, "content")
                }
            assertEquals("content", text)
            assertEquals(
                "https://api.github.com/repos/my-school/cs-principles-lab-3-jsmith/contents/j%20smith/data/questions.json",
                asked,
            )
            assertEquals("application/vnd.github.raw+json", headers["Accept"])
        }

        @Test
        fun `throws the status of a file that cannot be read`() {
            val error =
                assertThrows(GitHubException::class.java) {
                    readFile("my-school", "cs-principles-lab-3-jsmith", "a.json", "token") { _, _ -> HttpResponse(404, "") }
                }
            assertEquals(404, error.status)
        }
    }

    @Nested
    inner class Markup {
        private val question =
            Question(
                number = 2,
                broader = false,
                snippets = emptyList(),
                question = "Why?",
                answer = "Use `<b>` & stop.",
                distractors = listOf("<script>alert(1)</script>", "A `second` one"),
            )

        @Test
        fun `adds the answer under the question`() {
            val html = instructorQuestionToHtml(question)
            assertTrue("<h2>Question 2</h2>" in html)
            assertTrue("<h3>Answer</h3>" in html)
        }

        // Distractors are for the quiz. A spoken check has no use for them.
        @Test
        fun `leaves the distractors out`() {
            val html = instructorQuestionToHtml(question)
            assertFalse("Distractors" in html)
            assertFalse("second" in html)
            assertFalse("alert" in html)
        }

        @Test
        fun `escapes the answer, which comes from a file on GitHub`() {
            val html = answerToHtml(question.copy(answer = "Use `<b>` & <script>stop</script>."))
            assertTrue("Use <code>&lt;b&gt;</code> &amp; &lt;script&gt;stop" in html)
            assertFalse("<script>" in html)
        }

        @Test
        fun `leaves out the heading when there is no answer`() {
            assertEquals("", answerToHtml(question.copy(answer = "")))
            assertEquals("""<h3>Answer</h3><p class="answer">Yes.</p>""", answerToHtml(question.copy(answer = "Yes.")))
        }

        @Test
        fun `shows the prompt alone when no question is selected`() {
            assertFalse("<h3>" in instructorQuestionToHtml(null))
        }
    }
}
