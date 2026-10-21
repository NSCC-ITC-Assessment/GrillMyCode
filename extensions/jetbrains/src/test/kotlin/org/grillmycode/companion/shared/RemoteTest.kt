package org.grillmycode.companion.shared

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.NullSource
import org.junit.jupiter.params.provider.ValueSource

// A port of the remote and request halves of extensions/vscode/test/issues.test.js.

class RemoteTest {
    @Nested
    inner class ParseGitHubRemote {
        @ParameterizedTest
        @ValueSource(
            strings = [
                "https://github.com/my-school/cs-principles-lab-3-jsmith.git",
                "https://github.com/my-school/cs-principles-lab-3-jsmith",
                "https://github.com/my-school/cs-principles-lab-3-jsmith/",
                "https://jsmith@github.com/my-school/cs-principles-lab-3-jsmith.git",
                "git@github.com:my-school/cs-principles-lab-3-jsmith.git",
                "ssh://git@github.com/my-school/cs-principles-lab-3-jsmith.git",
                "ssh://git@github.com:22/my-school/cs-principles-lab-3-jsmith.git",
                "HTTPS://GitHub.com/my-school/cs-principles-lab-3-jsmith.git",
            ],
        )
        fun reads(url: String) {
            assertEquals(GitHubRepo("my-school", "cs-principles-lab-3-jsmith"), parseGitHubRemote(url))
        }

        @ParameterizedTest
        @NullSource
        @ValueSource(
            strings = [
                "https://gitlab.com/my-school/lab.git",
                "https://github.com.example.org/my-school/lab.git",
                "https://example.org/github.com/my-school/lab.git",
                "https://github.com/my-school",
                "https://github.com/my-school/lab/extra",
                "",
            ],
        )
        fun rejects(url: String?) {
            assertNull(parseGitHubRemote(url))
        }

        @Test
        fun `keeps a dot that is part of the repository name`() {
            assertEquals("lab.v2", parseGitHubRemote("git@github.com:my-school/lab.v2.git")?.repo)
        }
    }

    @Nested
    inner class PickGitHubRemote {
        private fun remote(
            name: String,
            repo: String,
        ) = Remote(name, fetchUrl = "https://github.com/my-school/$repo.git")

        @Test
        fun `prefers origin`() {
            assertEquals("mine", pickGitHubRemote(listOf(remote("upstream", "template"), remote("origin", "mine")))?.repo)
        }

        @Test
        fun `falls back to the first GitHub remote`() {
            val remotes = listOf(Remote("origin", fetchUrl = "https://gitlab.com/a/b.git"), remote("gh", "x"))
            assertEquals("x", pickGitHubRemote(remotes)?.repo)
        }

        @Test
        fun `reads the push URL when there is no fetch URL`() {
            val remotes = listOf(Remote("origin", pushUrl = "git@github.com:my-school/mine.git"))
            assertEquals("mine", pickGitHubRemote(remotes)?.repo)
        }

        @Test
        fun `returns null when no remote is on GitHub`() {
            assertNull(pickGitHubRemote(listOf(Remote("origin", fetchUrl = "/srv/git/lab.git"))))
        }
    }

    @Nested
    inner class ListLabelledIssues {
        private val sent = mutableListOf<Pair<String, Map<String, String>>>()

        private fun answering(response: HttpResponse): HttpGet =
            { url, headers ->
                sent += url to headers
                response
            }

        @Test
        fun `asks for the open issues with the questions label`() {
            val issues =
                listLabelledIssues("my-school", "cs-principles-lab-3-jsmith", "token", answering(HttpResponse(200, """[{"number":1}]""")))
            assertEquals("""[{"number":1}]""", issues.toString())
            val (url, headers) = sent.single()
            assertEquals(
                "https://api.github.com/repos/my-school/cs-principles-lab-3-jsmith/issues?state=open&labels=assessment&per_page=100",
                url,
            )
            assertEquals("Bearer token", headers["Authorization"])
        }

        @Test
        fun `throws the status of a failed request`() {
            val error =
                assertThrows<GitHubException> {
                    listLabelledIssues("my-school", "lab", "token", answering(HttpResponse(404, "")))
                }
            assertEquals(404, error.status)
        }

        @Test
        fun `reads an unexpected reply as no issues`() {
            assertEquals(
                emptyList<Any>(),
                listLabelledIssues("my-school", "lab", "token", answering(HttpResponse(200, """{"message":"odd"}"""))),
            )
        }
    }
}
