package org.grillmycode.companion.shared

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertSame
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.NullSource
import org.junit.jupiter.params.provider.ValueSource

// A port of the question-model half of extensions/vscode/test/questions.test.js.
// The HTML half comes with the selected question's panel.

private fun snippet(
    file: String,
    startLine: Int,
    endLine: Int = startLine,
) = Snippet(file, startLine, endLine, "js", "code();")

private fun question(
    number: Int,
    snippets: List<Snippet>,
    broader: Boolean = false,
) = Question(number, broader, snippets, "Question text $number?")

private fun List<QuestionGroup>.summary() = map { it.file to it.questions.map(Question::number) }

class QuestionsTest {
    @Test
    fun `describeLines names one line or a range, as the report does`() {
        assertEquals("line 12", describeLines(snippet("a.js", 12)))
        assertEquals("lines 28–37", describeLines(snippet("a.js", 28, 37)))
    }

    @Nested
    inner class IsSafeRelativePath {
        @ParameterizedTest
        @ValueSource(strings = ["src/cart.js", "cart.js", "src/a b/c.js", "src/..hidden/c.js", ".github/x.yml"])
        fun accepts(file: String) {
            assertTrue(isSafeRelativePath(file))
        }

        @ParameterizedTest
        @NullSource
        @ValueSource(
            strings = [
                "/etc/passwd",
                "\\\\server\\share\\x",
                "C:\\Users\\jsmith\\x.js",
                "c:/Users/jsmith/x.js",
                "../outside.js",
                "src/../../outside.js",
                "src\\..\\..\\outside.js",
                "src/\u0000x.js",
                "",
            ],
        )
        fun rejects(file: String?) {
            assertFalse(isSafeRelativePath(file))
        }
    }

    @Test
    fun `openableSnippets leaves out an unsafe path and an impossible range`() {
        val q =
            question(
                1,
                listOf(snippet("src/a.js", 3, 9), snippet("../b.js", 1), snippet("src/c.js", 0), snippet("src/d.js", 9, 3), snippet("", 1)),
            )
        assertEquals(listOf("src/a.js"), openableSnippets(q).map { it.file })
    }

    @Nested
    inner class GroupQuestions {
        @Test
        fun `groups by the file of the first snippet, in order of first use`() {
            val groups =
                groupQuestions(
                    listOf(
                        question(1, listOf(snippet("src/b.js", 1))),
                        question(2, listOf(snippet("src/a.js", 1), snippet("src/b.js", 4))),
                        question(3, listOf(snippet("src/b.js", 9))),
                    ),
                )
            assertEquals(listOf("src/b.js" to listOf(1, 3), "src/a.js" to listOf(2)), groups.summary())
        }

        @Test
        fun `puts questions that show no code last`() {
            val groups =
                groupQuestions(
                    listOf(
                        question(1, emptyList(), broader = true),
                        question(2, listOf(snippet("src/a.js", 1))),
                        question(3, listOf(snippet("../x.js", 1))),
                    ),
                )
            assertEquals(listOf("src/a.js" to listOf(2), null to listOf(1, 3)), groups.summary())
        }

        @Test
        fun `returns no groups for no questions`() {
            assertEquals(emptyList<QuestionGroup>(), groupQuestions(emptyList()))
        }
    }

    @Nested
    inner class AdjacentQuestion {
        // Listed as src/b.js (1 and 3), src/a.js (2), then the broader question (4).
        private val questions =
            listOf(
                question(1, listOf(snippet("src/b.js", 1))),
                question(2, listOf(snippet("src/a.js", 1))),
                question(3, listOf(snippet("src/b.js", 9))),
                question(4, emptyList(), broader = true),
            )

        private fun steps(
            start: Int,
            step: Int,
            count: Int,
        ): List<Int?> {
            var current: Int? = start
            return List(count) {
                current = adjacentQuestion(questions, current, step)?.number
                current
            }
        }

        @Test
        fun `follows the order of the list, not of the numbers`() {
            assertEquals(listOf(3, 2, 4), steps(1, 1, 3))
            assertEquals(listOf(2, 3, 1), steps(4, -1, 3))
        }

        @Test
        fun `goes round from either end to the other`() {
            assertEquals(1, adjacentQuestion(questions, 4, 1)?.number)
            assertEquals(4, adjacentQuestion(questions, 1, -1)?.number)
        }

        @Test
        fun `starts at the first question going forward, and at the last going back`() {
            assertEquals(1, adjacentQuestion(questions, null, 1)?.number)
            assertEquals(4, adjacentQuestion(questions, null, -1)?.number)
        }

        @Test
        fun `starts again when the question showing is no longer listed`() {
            assertEquals(1, adjacentQuestion(questions, 9, 1)?.number)
            assertEquals(4, adjacentQuestion(questions, 9, -1)?.number)
        }

        @Test
        fun `stays on the only question there is`() {
            val only = questions.first()
            assertSame(only, adjacentQuestion(listOf(only), 1, 1))
            assertSame(only, adjacentQuestion(listOf(only), 1, -1))
        }

        @Test
        fun `returns nothing for no questions`() {
            assertNull(adjacentQuestion(emptyList(), null, 1))
            assertNull(adjacentQuestion(emptyList(), 1, -1))
        }
    }

    @Test
    fun `questionFiles lists each file once`() {
        val files =
            questionFiles(
                listOf(
                    question(1, listOf(snippet("src/b.js", 1), snippet("src/a.js", 1))),
                    question(2, listOf(snippet("src/b.js", 5))),
                    question(3, emptyList()),
                ),
            )
        assertEquals(listOf("src/b.js", "src/a.js"), files)
    }

    @Nested
    inner class DescribeDrift {
        private val headSha = "9b8e7d6"
        private val folderCommit = "9b8e7d6c5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c"
        private val files = listOf("src/a.js", "src/b.js", "src/c.js")

        private fun drift(
            headSha: String = this.headSha,
            folderCommit: String? = this.folderCommit,
            changedFiles: List<String> = emptyList(),
        ) = describeDrift(headSha, folderCommit, changedFiles, files)

        @Test
        fun `says nothing when the folder matches the report`() {
            assertEquals("", drift())
            assertEquals("", drift(changedFiles = listOf("README.md")))
        }

        @Test
        fun `says nothing about the commit when the folder has none yet`() {
            assertEquals("", drift(folderCommit = null))
        }

        @Test
        fun `names both commits when the folder has moved on`() {
            val message = drift(folderCommit = "1234567890abcdef")
            assertTrue("commit 9b8e7d6" in message)
            assertTrue("this folder is at 1234567." in message)
        }

        @Test
        fun `compares the whole commit when the report gives it, and still names it short`() {
            assertEquals("", drift(headSha = folderCommit))
            val message = drift(headSha = folderCommit, folderCommit = "1234567890abcdef")
            assertTrue("commit 9b8e7d6," in message)
            assertTrue("this folder is at 1234567." in message)
            // The same first seven characters, and a different commit.
            val lookalike = headSha + "f".repeat(33)
            assertNotEquals("", drift(headSha = folderCommit, folderCommit = lookalike))
        }

        @Test
        fun `names up to two changed files, and counts more`() {
            assertTrue(drift(changedFiles = listOf("src/a.js")).startsWith("src/a.js changed"))
            assertTrue(drift(changedFiles = listOf("src/b.js", "src/a.js")).startsWith("src/a.js and src/b.js changed"))
            assertTrue(drift(changedFiles = files).startsWith("3 files changed"))
        }
    }
}
