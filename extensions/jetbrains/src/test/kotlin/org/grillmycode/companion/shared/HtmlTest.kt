package org.grillmycode.companion.shared

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

// A port of the HTML half of extensions/vscode/test/questions.test.js.

class HtmlTest {
    private fun snippet(
        file: String,
        startLine: Int,
        endLine: Int = startLine,
    ) = Snippet(file, startLine, endLine, "js", "code();")

    @Test
    fun `escapeHtml escapes every character that could open markup or close an attribute`() {
        assertEquals(
            "&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt; &amp; more",
            escapeHtml("""<img src="x" onerror='alert(1)'> & more"""),
        )
    }

    @Test
    fun `proseToHtml turns inline code into code elements and escapes the rest`() {
        assertEquals(
            "Is <code>a &lt; b</code> true when &lt;b&gt;bold&lt;/b&gt;?",
            proseToHtml("Is `a < b` true when <b>bold</b>?"),
        )
    }

    @Test
    fun `questionToHtml prompts when nothing is selected`() {
        assertTrue("Select a question" in questionToHtml(null))
    }

    @Test
    fun `questionToHtml shows the number, the text and each snippet with its caption`() {
        val html =
            questionToHtml(
                Question(3, false, listOf(snippet("src/a.js", 3, 9), snippet("src/b.js", 2)), "What does `x` do?"),
            )
        assertTrue("<h2>Question 3</h2>" in html)
        assertTrue("What does <code>x</code> do?" in html)
        assertTrue("<code>src/a.js</code>, lines 3–9" in html)
        assertTrue("<code>src/b.js</code>, line 2" in html)
        assertEquals(2, Regex("<pre>").findAll(html).count())
    }

    @Test
    fun `questionToHtml lets nothing from the issue through as markup`() {
        // The JavaScript test also puts markup in the number; here it is an Int.
        val hostile = "<script>alert(1)</script>"
        val html =
            questionToHtml(
                Question(1, false, listOf(Snippet(hostile, 1, 1, "", hostile)), "$hostile `$hostile`"),
            )
        assertFalse("<script" in html)
    }
}
