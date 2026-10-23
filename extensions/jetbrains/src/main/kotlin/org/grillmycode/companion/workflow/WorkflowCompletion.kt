package org.grillmycode.companion.workflow

import com.intellij.codeInsight.AutoPopupController
import com.intellij.codeInsight.completion.CompletionContributor
import com.intellij.codeInsight.completion.CompletionInitializationContext
import com.intellij.codeInsight.completion.CompletionParameters
import com.intellij.codeInsight.completion.CompletionResultSet
import com.intellij.codeInsight.completion.InsertionContext
import com.intellij.codeInsight.completion.PrioritizedLookupElement
import com.intellij.codeInsight.editorActions.TypedHandlerDelegate
import com.intellij.codeInsight.lookup.Lookup
import com.intellij.codeInsight.lookup.LookupElement
import com.intellij.codeInsight.lookup.LookupElementBuilder
import com.intellij.icons.AllIcons
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.project.Project
import com.intellij.psi.PsiFile
import org.grillmycode.companion.shared.CompletionItem
import org.grillmycode.companion.shared.CompletionKind
import org.grillmycode.companion.shared.completionsAt
import org.grillmycode.companion.shared.describeInput

/**
 * What a completion item stands for: its [item], and how much of the text
 * after the cursor it replaces. The documentation provider reads it too.
 */
data class OfferedInput(
    val item: CompletionItem,
    val tailLength: Int,
)

/** Offers a GrillMyCode step's inputs, and the values of an input with a fixed set. */
class WorkflowCompletion : CompletionContributor() {
    // The text an item replaces may go past the cursor: the rest of a value,
    // or of a name that already has one. Tab replaces up to here.
    override fun beforeCompletion(context: CompletionInitializationContext) {
        if (!workflowHelpOn(context.file)) return
        val offered = completionsAt(context.editor.document.text, context.startOffset) ?: return
        context.replacementOffset = offered.end
    }

    override fun fillCompletionVariants(
        parameters: CompletionParameters,
        result: CompletionResultSet,
    ) {
        if (!workflowHelpOn(parameters.originalFile)) return
        val text = parameters.editor.document.text
        val offset = parameters.offset
        val offered = completionsAt(text, offset) ?: return
        val matching = result.withPrefixMatcher(text.substring(offered.start, offset))
        val count = offered.items.size
        offered.items.forEachIndexed { index, item ->
            val element =
                LookupElementBuilder
                    .create(OfferedInput(item, offered.end - offset), item.insert)
                    .withPresentableText(item.label)
                    .withIcon(if (item.kind == CompletionKind.INPUT) AllIcons.Nodes.Property else AllIcons.Nodes.Enum)
                    .withTypeText(if (item.isDefault) "default" else null)
                    .withInsertHandler(::insert)
            // Kept in the order the action declares them, not sorted by name.
            matching.addElement(PrioritizedLookupElement.withPriority(element, (count - index).toDouble()))
        }
        // An input with a fixed set of values takes those and nothing else,
        // such as the YAML plugin's own true and false for a starter_code.
        if (offered.items.first().kind == CompletionKind.VALUE) result.stopHere()
    }

    private fun insert(
        context: InsertionContext,
        element: LookupElement,
    ) {
        val (item, tailLength) = element.`object` as OfferedInput
        // Tab has already replaced the rest; any other key leaves it after the item.
        if (context.completionChar != Lookup.REPLACE_SELECT_CHAR && tailLength > 0) {
            val end = minOf(context.tailOffset + tailLength, context.document.textLength)
            context.document.deleteString(context.tailOffset, end)
        }
        // An input with a fixed set of values goes straight on to offer them.
        val values = describeInput(item.label)?.values.orEmpty()
        if (item.kind == CompletionKind.INPUT && values.isNotEmpty() && item.insert != item.label) {
            AutoPopupController.getInstance(context.project).scheduleAutoPopup(context.editor)
        }
    }
}

/**
 * Opens completion where VS Code's suggestions open by themselves: after the
 * space that follows an input's name, and on a new input's first letter.
 */
class WorkflowTypedHandler : TypedHandlerDelegate() {
    override fun checkAutoPopup(
        charTyped: Char,
        project: Project,
        editor: Editor,
        file: PsiFile,
    ): Result {
        if (charTyped != ' ' && !charTyped.isLetter() && charTyped != '_') return Result.CONTINUE
        if (!workflowHelpOn(file)) return Result.CONTINUE
        // The character is not in the document yet: ask as if it were.
        val offset = editor.caretModel.offset
        val text = editor.document.text
        if (completionsAt(text.substring(0, offset) + charTyped + text.substring(offset), offset + 1) == null) return Result.CONTINUE
        AutoPopupController.getInstance(project).scheduleAutoPopup(editor)
        return Result.STOP
    }
}
