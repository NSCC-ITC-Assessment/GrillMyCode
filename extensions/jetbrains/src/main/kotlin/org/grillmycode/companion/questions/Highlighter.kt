package org.grillmycode.companion.questions

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ReadAction
import com.intellij.openapi.components.Service
import com.intellij.openapi.editor.Document
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.editor.ScrollType
import com.intellij.openapi.editor.colors.EditorColors
import com.intellij.openapi.editor.colors.TextAttributesKey
import com.intellij.openapi.editor.event.DocumentEvent
import com.intellij.openapi.editor.event.DocumentListener
import com.intellij.openapi.editor.impl.DocumentMarkupModel
import com.intellij.openapi.editor.markup.HighlighterLayer
import com.intellij.openapi.editor.markup.HighlighterTargetArea
import com.intellij.openapi.editor.markup.RangeHighlighter
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.fileEditor.OpenFileDescriptor
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VfsUtilCore
import com.intellij.openapi.vfs.VirtualFile
import org.grillmycode.companion.auth.NOTIFICATION_GROUP
import org.grillmycode.companion.shared.Snippet

/**
 * The colour of a question's lines: the editor's colour for the identifier
 * under the caret, a quiet background with a mark beside the scroll bar.
 */
private val QUESTION_LINES =
    TextAttributesKey.createTextAttributesKey("GRILLMYCODE_QUESTION_LINES", EditorColors.IDENTIFIER_UNDER_CARET_ATTRIBUTES)

/**
 * Jump to code: opens the files a question's snippets name and highlights
 * their lines. A port of extensions/vscode/src/student/highlighter.js, except
 * that the tabs opened for one question stay open when another is shown:
 * JetBrains IDEs close old tabs themselves, past their tab limit.
 *
 * An edit to a highlighted file takes its highlight away, since the lines may
 * have moved out from under it.
 */
@Service(Service.Level.PROJECT)
class Highlighter(
    private val project: Project,
) : Disposable {
    private val highlighters = mutableMapOf<Document, List<RangeHighlighter>>()

    init {
        EditorFactory.getInstance().eventMulticaster.addDocumentListener(
            object : DocumentListener {
                override fun documentChanged(event: DocumentEvent) {
                    highlighters.remove(event.document)?.forEach(RangeHighlighter::dispose)
                }
            },
            this,
        )
    }

    /**
     * Opens the file of each snippet under [root] and highlights the snippets'
     * lines, leaving [target]'s file in front at that snippet. The caller has
     * checked each path (openableSnippets); it is still resolved only inside
     * [root]. A range that runs past the end of the file is cut to fit: the
     * file has changed since the report, which the moved-code warning says.
     *
     * The student is told of every file that cannot be opened.
     */
    fun show(
        root: VirtualFile,
        snippets: List<Snippet>,
        target: Snippet,
    ) {
        clear()
        val missing = mutableListOf<String>()
        // The target's file last, so it is the one left in front.
        val byFile = snippets.groupBy { it.file }.entries.sortedBy { (file, _) -> file == target.file }
        for ((path, fileSnippets) in byFile) {
            // The IDE wants a read action around any look at a file or a
            // document, even on the event dispatch thread. Opening the editor
            // stays outside it.
            val file = ReadAction.compute<VirtualFile?, RuntimeException> { resolve(root, path) }
            val document =
                file?.let {
                    ReadAction.compute<Document?, RuntimeException> {
                        FileDocumentManager.getInstance().getDocument(
                            it,
                        )
                    }
                }
            if (file == null || document == null) {
                missing += path
                continue
            }
            val front = path == target.file
            val first = if (front) target else fileSnippets.first()
            val editor =
                FileEditorManager.getInstance(project).openTextEditor(OpenFileDescriptor(project, file, first.startLine - 1, 0), front)
            highlighters[document] =
                ReadAction.compute<List<RangeHighlighter>, RuntimeException> { fileSnippets.mapNotNull { highlight(document, it) } }
            editor?.scrollingModel?.scrollToCaret(ScrollType.CENTER_UP)
        }
        if (missing.isNotEmpty()) {
            val names = missing.joinToString(" and ")
            val pronoun = if (missing.size == 1) "It" else "They"
            NotificationGroupManager
                .getInstance()
                .getNotificationGroup(NOTIFICATION_GROUP)
                .createNotification(
                    "$names could not be opened. $pronoun may have been moved, renamed or deleted since these questions were written.",
                    NotificationType.WARNING,
                ).notify(project)
        }
    }

    private fun resolve(
        root: VirtualFile,
        path: String,
    ): VirtualFile? =
        root
            .findFileByRelativePath(path.replace('\\', '/'))
            ?.takeIf { !it.isDirectory && VfsUtilCore.isAncestor(root, it, true) }

    private fun highlight(
        document: Document,
        snippet: Snippet,
    ): RangeHighlighter? {
        if (document.lineCount == 0) return null
        val last = document.lineCount - 1
        val start = (snippet.startLine - 1).coerceAtMost(last)
        val end = (snippet.endLine - 1).coerceIn(start, last)
        return DocumentMarkupModel.forDocument(document, project, true).addRangeHighlighter(
            QUESTION_LINES,
            document.getLineStartOffset(start),
            document.getLineEndOffset(end),
            HighlighterLayer.SELECTION - 1,
            HighlighterTargetArea.LINES_IN_RANGE,
        )
    }

    /** Takes the highlights away. */
    fun clear() {
        highlighters.values.flatten().forEach(RangeHighlighter::dispose)
        highlighters.clear()
    }

    override fun dispose() = clear()
}
