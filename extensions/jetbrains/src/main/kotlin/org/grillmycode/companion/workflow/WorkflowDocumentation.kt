package org.grillmycode.companion.workflow

import com.intellij.lang.documentation.AbstractDocumentationProvider
import com.intellij.lang.documentation.DocumentationMarkup
import com.intellij.openapi.editor.Editor
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.intellij.psi.PsiManager
import com.intellij.psi.impl.FakePsiElement
import org.grillmycode.companion.shared.CompletionKind
import org.grillmycode.companion.shared.InputDescription
import org.grillmycode.companion.shared.describeInput
import org.grillmycode.companion.shared.escapeHtml
import org.grillmycode.companion.shared.inputAt

/** An input of the action, named in a workflow file, as the IDE's documentation looks it up. */
class InputElement(
    private val file: PsiFile,
    val input: InputDescription,
) : FakePsiElement() {
    override fun getParent(): PsiElement = file

    override fun getName(): String = input.name

    override fun getPresentableText(): String = input.name

    override fun isValid(): Boolean = file.isValid

    override fun equals(other: Any?) = other is InputElement && other.file == file && other.input == input

    override fun hashCode() = 31 * file.hashCode() + input.hashCode()
}

/**
 * An input's description, values and default, as VS Code's hover shows them:
 * over an input's name in a GrillMyCode step, and beside an input offered in
 * completion.
 */
class WorkflowDocumentation : AbstractDocumentationProvider() {
    override fun getCustomDocumentationElement(
        editor: Editor,
        file: PsiFile,
        contextElement: PsiElement?,
        targetOffset: Int,
    ): PsiElement? {
        if (!workflowHelpOn(file)) return null
        val found = inputAt(editor.document.text, targetOffset) ?: return null
        return InputElement(file, found.input)
    }

    override fun getDocumentationElementForLookupItem(
        psiManager: PsiManager,
        `object`: Any?,
        element: PsiElement?,
    ): PsiElement? {
        val offered = `object` as? OfferedInput ?: return null
        if (offered.item.kind != CompletionKind.INPUT) return null
        val file = element?.containingFile ?: return null
        return describeInput(offered.item.label)?.let { InputElement(file, it) }
    }

    override fun generateDoc(
        element: PsiElement?,
        originalElement: PsiElement?,
    ): String? = (element as? InputElement)?.input?.let(::documentation)

    override fun generateHoverDoc(
        element: PsiElement,
        originalElement: PsiElement?,
    ): String? = generateDoc(element, originalElement)
}

/** The description is the action's own, from action.yml, so it is escaped. */
internal fun documentation(input: InputDescription): String =
    buildString {
        append(DocumentationMarkup.DEFINITION_START).append(escapeHtml(input.name)).append(DocumentationMarkup.DEFINITION_END)
        append(DocumentationMarkup.CONTENT_START)
        input.description.split("\n\n").forEach { append("<p>").append(escapeHtml(it)).append("</p>") }
        append(DocumentationMarkup.CONTENT_END)
        val sections = mutableListOf<Pair<String, String>>()
        if (input.values.isNotEmpty()) sections += "Values:" to input.values.joinToString(", ") { "<code>${escapeHtml(it)}</code>" }
        if (input.default.isNotEmpty()) sections += "Default:" to "<code>${escapeHtml(input.default)}</code>"
        if (sections.isNotEmpty()) {
            append(DocumentationMarkup.SECTIONS_START)
            for ((header, content) in sections) {
                append(DocumentationMarkup.SECTION_HEADER_START).append(header)
                append(DocumentationMarkup.SECTION_SEPARATOR).append(content).append(DocumentationMarkup.SECTION_END)
            }
            append(DocumentationMarkup.SECTIONS_END)
        }
    }
