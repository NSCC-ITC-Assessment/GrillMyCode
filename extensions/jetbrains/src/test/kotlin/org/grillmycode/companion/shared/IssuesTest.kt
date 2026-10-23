package org.grillmycode.companion.shared

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource

// A port of the issue half of extensions/vscode/test/issues.test.js.

/** An issue as the REST API lists it. */
private fun apiIssue(
    number: Int,
    title: String,
    vararg overrides: Pair<String, JsonElement>,
): JsonObject =
    JsonObject(
        mapOf(
            "number" to JsonPrimitive(number),
            "title" to JsonPrimitive(title),
            "html_url" to JsonPrimitive("https://github.com/my-school/lab/issues/$number"),
            "updated_at" to JsonPrimitive("2026-01-${number.toString().padStart(2, '0')}T12:00:00Z"),
            "body" to JsonPrimitive("body"),
            "labels" to JsonArray(listOf(buildJsonObject { put("name", "assessment") })),
        ) + overrides,
    )

class IssuesTest {
    @Nested
    inner class ParseIssueTitle {
        @Test
        fun `reads each kind of title`() {
            assertEquals(IssueGroup.Branch("main"), parseIssueTitle("GrillMyCode Questions (main)"))
            assertEquals(IssueGroup.Branch("feature/checkout"), parseIssueTitle("GrillMyCode Questions (feature/checkout)"))
            assertEquals(IssueGroup.Branch("fix-(a)"), parseIssueTitle("GrillMyCode Questions (fix-(a))"))
            assertEquals(IssueGroup.Tag("submit/*"), parseIssueTitle("GrillMyCode Questions (tag: submit/*)"))
            assertEquals(IssueGroup.Unnamed, parseIssueTitle("GrillMyCode Questions"))
        }

        @Test
        fun `reads a question set's title`() {
            fun read(title: String) = parseIssueTitle(title) to parseIssueSet(title)
            assertEquals(IssueGroup.Branch("main") to "Lab 3", read("GrillMyCode Questions: Lab 3 (main)"))
            assertEquals(IssueGroup.Tag("submit/*") to "Lab 3", read("GrillMyCode Questions: Lab 3 (tag: submit/*)"))
            assertEquals(IssueGroup.Branch("fix-(a)") to "Lab 3: part (A)", read("GrillMyCode Questions: Lab 3: part (A) (fix-(a))"))
            assertEquals(IssueGroup.Unnamed to "Lab 3", read("GrillMyCode Questions: Lab 3"))
            assertEquals(IssueGroup.Branch("main") to null, read("GrillMyCode Questions (main)"))
        }

        @ParameterizedTest
        @ValueSource(
            strings = [
                "GrillMyCode Questions ()",
                "GrillMyCode Questions (main) and more",
                "GrillMyCode Questions for lab 3",
                "Re: GrillMyCode Questions (main)",
                "grillmycode questions (main)",
                "GrillMyCode Questions:  (main)",
                "GrillMyCode Questions: Lab 3 ()",
                "GrillMyCode Questions:Lab 3 (main)",
            ],
        )
        fun `rejects other titles`(title: String) {
            assertNull(parseIssueTitle(title))
        }

        @Test
        fun `rejects no title`() {
            assertNull(parseIssueTitle(null))
        }
    }

    @Test
    fun `describeGroup names a branch, a tag pattern and a run with neither`() {
        assertEquals("main", describeGroup(IssueGroup.Branch("main")))
        assertEquals("tag submit/*", describeGroup(IssueGroup.Tag("submit/*")))
        assertEquals("no branch", describeGroup(IssueGroup.Unnamed))
        assertEquals("Lab 3 · main", describeGroup(IssueGroup.Branch("main"), "Lab 3"))
        assertEquals("Lab 3 · tag phase1", describeGroup(IssueGroup.Tag("phase1"), "Lab 3"))
    }

    @Nested
    inner class FindQuestionIssues {
        @Test
        fun `keeps questions issues, newest update first`() {
            val found =
                findQuestionIssues(
                    listOf(
                        apiIssue(1, "GrillMyCode Questions (main)"),
                        apiIssue(3, "GrillMyCode Questions (tag: submit/*)"),
                        apiIssue(2, "GrillMyCode Questions (feature)"),
                    ),
                )
            assertEquals(listOf(3, 2, 1), found.map { it.number })
            assertEquals("https://github.com/my-school/lab/issues/3", found[0].url)
            assertEquals(IssueGroup.Tag("submit/*"), found[0].group)
        }

        @Test
        fun `leaves out pull requests, other titles and other labels`() {
            val found =
                findQuestionIssues(
                    listOf(
                        apiIssue(1, "GrillMyCode Questions (main)", "pull_request" to JsonObject(emptyMap())),
                        apiIssue(2, "Assessment feedback"),
                        apiIssue(3, "GrillMyCode Questions (main)", "labels" to JsonArray(listOf(buildJsonObject { put("name", "bug") }))),
                        apiIssue(4, "GrillMyCode Questions (main)", "labels" to JsonArray(listOf(JsonPrimitive("assessment")))),
                    ),
                )
            assertEquals(listOf(4), found.map { it.number })
        }

        @Test
        fun `reads a missing body as empty`() {
            val found = findQuestionIssues(listOf(apiIssue(1, "GrillMyCode Questions (main)", "body" to JsonNull))).single()
            assertEquals("", found.body)
        }

        @Test
        fun `leaves out what is not shaped like an issue`() {
            val found = findQuestionIssues(listOf(JsonPrimitive("odd"), JsonNull, apiIssue(1, "GrillMyCode Questions (main)")))
            assertEquals(listOf(1), found.map { it.number })
        }
    }

    @Nested
    inner class ChooseIssue {
        private val issues =
            findQuestionIssues(
                listOf(
                    apiIssue(1, "GrillMyCode Questions (main)"),
                    apiIssue(2, "GrillMyCode Questions (feature)"),
                    apiIssue(3, "GrillMyCode Questions (tag: submit/*)"),
                ),
            )

        @Test
        fun `takes the one for the checked-out branch`() {
            assertEquals(2, chooseIssue(issues, branch = "feature")?.number)
        }

        @Test
        fun `takes the one chosen by hand over the branch`() {
            assertEquals(3, chooseIssue(issues, branch = "feature", preferredTitle = "GrillMyCode Questions (tag: submit/*)")?.number)
        }

        @Test
        fun `goes back to the branch when the chosen one is gone`() {
            assertEquals(1, chooseIssue(issues, branch = "main", preferredTitle = "GrillMyCode Questions (old)")?.number)
        }

        @Test
        fun `takes the most recently updated when no branch matches`() {
            assertEquals(3, chooseIssue(issues, branch = "other")?.number)
            assertEquals(3, chooseIssue(issues)?.number)
        }

        // A tag pattern is not a branch, even when the names are the same.
        @Test
        fun `does not match a branch to a tag pattern of the same name`() {
            val tagged =
                findQuestionIssues(
                    listOf(apiIssue(1, "GrillMyCode Questions (tag: main)"), apiIssue(2, "GrillMyCode Questions (main)")),
                )
            assertEquals(2, chooseIssue(tagged.reversed(), branch = "main")?.number)
        }

        @Test
        fun `returns null when there are none`() {
            assertNull(chooseIssue(emptyList(), branch = "main"))
        }

        @Test
        fun `takes the branch's issue with no question set first, then the newest set`() {
            val sets =
                findQuestionIssues(
                    listOf(
                        apiIssue(1, "GrillMyCode Questions (main)"),
                        apiIssue(2, "GrillMyCode Questions: Lab 3 (main)"),
                        apiIssue(3, "GrillMyCode Questions: Lab 4 (main)"),
                        apiIssue(4, "GrillMyCode Questions: Lab 4 (feature)"),
                    ),
                )
            assertEquals(1, chooseIssue(sets, branch = "main")?.number)
            assertEquals(4, chooseIssue(sets, branch = "feature")?.number)
            assertEquals(3, chooseIssue(sets.filter { it.number != 1 }, branch = "main")?.number)
            assertEquals(2, chooseIssue(sets, branch = "main", preferredTitle = "GrillMyCode Questions: Lab 3 (main)")?.number)
            assertEquals("Lab 3", sets.single { it.number == 2 }.set)
        }
    }

    @Nested
    inner class WhatArrived {
        private fun issue(
            number: Int,
            body: String,
        ) = QuestionIssue(number, "GrillMyCode Questions (main)", "", "", body, IssueGroup.Branch("main"))

        private val loaded = issue(1, "The report of one run.")

        @Test
        fun `finds nothing new in the issue that was loaded`() {
            assertNull(whatArrived(loaded, loaded.copy()))
        }

        @Test
        fun `finds a first set where nothing was loaded`() {
            assertEquals(Arrival.FIRST, whatArrived(null, loaded))
        }

        // The action writes each run's report over the same issue.
        @Test
        fun `finds a newer set in the same issue with another body`() {
            assertEquals(Arrival.NEWER, whatArrived(loaded, issue(1, "The report of the next run.")))
        }

        @Test
        fun `finds a newer set in another issue`() {
            assertEquals(Arrival.NEWER, whatArrived(loaded, loaded.copy(number = 2)))
        }

        // Closing the issue is not news, and the questions loaded stay in the list.
        @Test
        fun `finds nothing when the issue is gone`() {
            assertNull(whatArrived(loaded, null))
            assertNull(whatArrived(null, null))
        }
    }
}
