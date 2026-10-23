package org.grillmycode.companion.shared

import kotlinx.serialization.json.Json
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource
import java.io.File

// A port of extensions/vscode/test/wizard.test.js, for the parts the two
// editors share, and the JetBrains page's own.

class WizardTest {
    private fun json(text: String) = Json.parseToJsonElement(text)

    @Nested
    inner class IsWizardRequest {
        @Test
        fun `takes each request the page makes, with a number to answer it by`() {
            for (type in WIZARD_REQUESTS) assertTrue(isWizardRequest(json("""{"type":"$type","id":1}""")), type)
        }

        @Test
        fun `takes ready without one, as nothing answers it`() = assertTrue(isWizardRequest(json("""{"type":"ready"}""")))

        @ParameterizedTest
        @ValueSource(
            strings = [
                "null",
                "\"list\"",
                """{"type":"delete","id":1}""",
                """{"type":"list"}""",
                """{"type":"list","id":"1"}""",
                """{"type":"list","id":1.5}""",
                """{"type":"list","id":9007199254740993}""",
            ],
        )
        fun `refuses anything else`(message: String) = assertFalse(isWizardRequest(json(message)))
    }

    @Test
    fun `names a path as the page does`() {
        assertEquals("app.js", joinPath("", "app.js"))
        assertEquals("src/lib/app.js", joinPath("src/lib", "app.js"))
    }

    @Nested
    inner class TheFolderRecord {
        private fun file(name: String) = FolderEntry(name, isFile = true, isFolder = false, isLink = false)

        private fun folder(name: String) = FolderEntry(name, isFile = false, isFolder = true, isLink = false)

        @Test
        fun `knows the folder itself before anything is listed, and nothing else`() {
            val record = FolderRecord()
            assertTrue(record.hasFolder(""))
            assertFalse(record.hasFolder("src"))
            assertFalse(record.hasFile("app.js"))
        }

        @Test
        fun `tells the page what a folder holds, as a folder picker would`() {
            assertEquals(
                listOf(ListedEntry("app.js", "file"), ListedEntry("src", "directory")),
                FolderRecord().add("", listOf(file("app.js"), folder("src"))),
            )
        }

        @Test
        fun `knows what a listing named, under the folder it was in`() {
            val record = FolderRecord()
            record.add("", listOf(file("app.js"), folder("src")))
            record.add("src", listOf(file("cart.js"), folder("lib")))
            assertTrue(record.hasFile("app.js") && record.hasFile("src/cart.js"))
            assertTrue(record.hasFolder("src") && record.hasFolder("src/lib"))
            assertFalse(record.hasFile("cart.js") || record.hasFolder("lib"))
        }

        @Test
        fun `keeps files and folders apart`() {
            val record = FolderRecord()
            record.add("", listOf(file("app.js"), folder("src")))
            assertFalse(record.hasFolder("app.js") || record.hasFile("src"))
        }

        // No path the page sends is parsed, so one that climbs out matches nothing.
        @ParameterizedTest
        @ValueSource(strings = ["..", "../secret", "src/../../secret", "/etc/passwd", "src/", "./app.js"])
        fun `does not know a path no listing named`(path: String) {
            val record = FolderRecord()
            record.add("", listOf(file("app.js"), folder("src")))
            assertFalse(record.hasFile(path) || record.hasFolder(path))
        }

        @Test
        fun `lists a link as a file, and lets it be neither read nor opened`() {
            val record = FolderRecord()
            val listed =
                record.add(
                    "",
                    listOf(
                        FolderEntry("to-file", isFile = true, isFolder = false, isLink = true),
                        FolderEntry("to-folder", isFile = false, isFolder = true, isLink = true),
                        FolderEntry("broken", isFile = false, isFolder = false, isLink = true),
                    ),
                )
            assertEquals(listOf("file", "file", "file"), listed.map { it.kind })
            for (name in listOf("to-file", "to-folder", "broken")) assertFalse(record.hasFile(name) || record.hasFolder(name))
        }

        @Test
        fun `leaves out what is neither a file, a folder nor a link`() =
            assertEquals(emptyList<ListedEntry>(), FolderRecord().add("", listOf(FolderEntry("socket", false, false, false))))
    }

    @Nested
    inner class ThePage {
        private fun page(
            docsBase: String = "https://grillmycode.org/docs",
            script: String = "start();",
        ) = wizardPage("abc123", script, "body{}", "bridge();", ":root{}", true, "v0", docsBase)

        private fun policy(html: String) =
            Regex("""http-equiv="Content-Security-Policy" content="([^"]*)"""")
                .find(html)!!
                .groupValues[1]
                .split("; ")
                .associate { rule -> rule.substringBefore(' ') to rule.split(' ').drop(1) }

        @Test
        fun `allows nothing it does not name`() {
            assertEquals(listOf("'none'"), policy(page())["default-src"])
            assertEquals(setOf("connect-src", "default-src", "img-src", "script-src", "style-src"), policy(page()).keys)
        }

        // A script the page did not come with does not run.
        @Test
        fun `runs its two scripts, the bridge first, by their nonce`() {
            assertEquals(listOf("'nonce-abc123'"), policy(page())["script-src"])
            val scripts = Regex("<script[^>]*>").findAll(page()).map { it.value }.toList()
            assertEquals(listOf("<script nonce=\"abc123\">", "<script nonce=\"abc123\">"), scripts)
            assertTrue(page().indexOf("bridge();") < page().indexOf("start();"))
        }

        @Test
        fun `applies its own styles alone`() {
            assertEquals(listOf("'nonce-abc123'"), policy(page())["style-src"])
            assertEquals(2, Regex("<style nonce=\"abc123\"").findAll(page()).count())
        }

        @Test
        fun `reaches OpenRouter and nowhere else, and shows only images in the bundle`() {
            assertEquals(listOf(OPENROUTER_ORIGIN), policy(page())["connect-src"])
            assertEquals(listOf("data:"), policy(page())["img-src"])
        }

        @Test
        fun `gives the Wizard its action version, where the docs are, and the theme`() {
            assertTrue(page().contains("data-action-ref=\"v0\""))
            assertTrue(page().contains("data-docs-base=\"https://grillmycode.org/docs\""))
            assertTrue(page().contains("<body class=\"vscode-light\">"))
        }

        @Test
        fun `writes a value into an attribute as text`() {
            val html = page(docsBase = "\"><script>alert(1)</script>")
            assertTrue(html.contains("data-docs-base=\"&quot;>&lt;script>alert(1)&lt;/script>\""))
            assertEquals(2, Regex("<script").findAll(html).count())
        }

        @Test
        fun `keeps a script from ending its element early`() {
            val html = page(script = "const end = '</script><script>alert(1)</SCRIPT>';")
            assertTrue(html.contains("""'<\/script><script>alert(1)<\/SCRIPT>'"""))
            // The page's own two, and no more.
            assertEquals(2, Regex("</script>").findAll(html).count())
        }
    }

    @Test
    fun `gives a cancelled prompt the name the browser gives a closed folder picker`() = assertEquals("AbortError", CANCELLED)
}

/** The constants both editors share hold the same values in each. */
class ConstantsTest {
    private val javaScript =
        File(System.getProperty("gmc.repository") ?: error("Run the tests through Gradle"), "extensions/vscode/src/shared/constants.js")
            .readText()

    private fun javaScript(name: String): String {
        val match = Regex("""export const $name = ([^;]+);""").find(javaScript) ?: error("constants.js has no $name")
        return match.groupValues[1]
            .trim()
            .removeSurrounding("'")
            .replace("_", "")
    }

    @Test
    fun `match the VS Code extension's`() {
        val shared =
            mapOf(
                "ISSUE_LABEL" to ISSUE_LABEL,
                "ISSUE_TITLE" to ISSUE_TITLE,
                "ISSUE_LAYOUT_VERSION" to ISSUE_LAYOUT_VERSION,
                "INSTRUCTOR_REPO_SUFFIX" to INSTRUCTOR_REPO_SUFFIX,
                "ANSWER_KEY_FILE" to ANSWER_KEY_FILE,
                "ACTION_REPOSITORY" to ACTION_REPOSITORY,
                "INPUT_NAME_MAX_EDITS" to INPUT_NAME_MAX_EDITS,
                "ACTION_REF" to ACTION_REF,
                "DOCS_URL" to DOCS_URL,
                "WORKFLOW_FILE" to WORKFLOW_FILE,
                "WIZARD_MAX_WORKFLOW_CHARS" to WIZARD_MAX_WORKFLOW_CHARS,
                "WIZARD_MAX_FILE_BYTES" to WIZARD_MAX_FILE_BYTES,
                "OPENROUTER_ORIGIN" to OPENROUTER_ORIGIN,
            )
        for ((name, value) in shared) assertEquals(javaScript(name), value.toString(), name)
    }
}
