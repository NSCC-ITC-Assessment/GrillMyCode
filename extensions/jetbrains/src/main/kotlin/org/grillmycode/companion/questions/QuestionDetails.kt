package org.grillmycode.companion.questions

import com.intellij.openapi.editor.colors.EditorColorsManager
import com.intellij.ui.ColorUtil
import com.intellij.util.ui.HTMLEditorKitBuilder
import com.intellij.util.ui.JBUI
import com.intellij.util.ui.UIUtil
import org.grillmycode.companion.shared.Question
import org.grillmycode.companion.shared.questionToHtml
import javax.swing.JEditorPane
import javax.swing.text.html.StyleSheet

/**
 * The selected question in full, below the tree: a tree row holds one line,
 * and a question and its code need more. A port of
 * extensions/vscode/src/student/question-view.js.
 *
 * A Swing HTML pane, not a browser: it runs no script and, given only the
 * markup questionToHtml builds, where everything from the issue is escaped,
 * loads nothing. The instructor view swaps in instructorQuestionToHtml, which
 * escapes the answer key's answer the same way.
 */
class QuestionDetails : JEditorPane() {
    /** Builds the markup for a question; set before the next [show]. */
    var toHtml: (Question?) -> String = ::questionToHtml

    init {
        isEditable = false
        border = JBUI.Borders.empty(0, 12, 12, 12)
        show(null)
    }

    /** Shows a question, or the prompt to select one when given null. */
    fun show(question: Question?) {
        // Built each time, so the colours follow a change of theme.
        editorKit = HTMLEditorKitBuilder().withWordWrapViewFactory().withStyleSheet(styleSheet()).build()
        text = "<html><body>${toHtml(question)}</body></html>"
        caretPosition = 0
    }

    private fun styleSheet(): StyleSheet {
        val scheme = EditorColorsManager.getInstance().globalScheme
        val hint = ColorUtil.toHtmlColor(UIUtil.getContextHelpForeground())
        val codeBackground = ColorUtil.toHtmlColor(scheme.defaultBackground)
        val code = "font-family: '${scheme.editorFontName}';"
        return StyleSheet().apply {
            addRule("h2 { font-size: 1em; font-weight: bold; margin: 12px 0 4px 0; }")
            addRule("h3 { font-size: 1em; font-weight: bold; margin: 12px 0 4px 0; }")
            addRule("p { margin: 0 0 10px 0; }")
            addRule(".hint, .caption { color: $hint; }")
            addRule(".caption { margin: 12px 0 4px 0; }")
            addRule("code { $code }")
            addRule("pre { $code background-color: $codeBackground; margin: 0 0 10px 0; padding: 8px 10px; }")
        }
    }
}
