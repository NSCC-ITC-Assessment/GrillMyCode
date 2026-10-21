package org.grillmycode.companion.shared

// Question detail markup
//
// Builds the HTML shown in the selected question's panel. Every piece of text
// from the issue is escaped before it reaches the pane, and a Swing HTML pane
// runs no script, so nothing an edited issue contains can act. A port of
// extensions/vscode/src/shared/html.js.

/** Escapes text for use in HTML content or a double-quoted attribute. */
fun escapeHtml(text: Any?): String =
    text
        .toString()
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&#39;")

private val INLINE_CODE = Regex("(`[^`]+`)")

/** A line of prose as HTML, with its `inline code` spans as <code> elements. */
fun proseToHtml(text: String): String {
    // JavaScript's split with a capturing group: the text between matches, and each match.
    val parts = mutableListOf<String>()
    var at = 0
    for (match in INLINE_CODE.findAll(text)) {
        parts += text.substring(at, match.range.first)
        parts += match.value
        at = match.range.last + 1
    }
    parts += text.substring(at)
    return parts
        .mapIndexed { i, part -> if (i % 2 == 1) "<code>${escapeHtml(part.substring(1, part.length - 1))}</code>" else escapeHtml(part) }
        .joinToString("")
}

/** The body of the selected question's panel for one question, or a prompt when none is selected. */
fun questionToHtml(question: Question?): String {
    if (question == null) return """<p class="hint">Select a question to read it here.</p>"""
    val snippets =
        question.snippets.joinToString("") { snippet ->
            (
                if (snippet.file.isNotEmpty()) {
                    """<p class="caption"><code>${escapeHtml(snippet.file)}</code>, ${escapeHtml(describeLines(snippet))}</p>"""
                } else {
                    ""
                }
            ) + "<pre><code>${escapeHtml(snippet.code)}</code></pre>"
        }
    return "<h2>Question ${escapeHtml(question.number)}</h2>" +
        """<p class="question">${proseToHtml(question.question)}</p>""" +
        snippets
}
