package org.grillmycode.companion.questions

import com.intellij.icons.AllIcons
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.Disposable
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.fileEditor.OpenFileDescriptor
import com.intellij.openapi.fileTypes.FileTypeManager
import com.intellij.openapi.options.ShowSettingsUtil
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.SimpleToolWindowPanel
import com.intellij.openapi.util.text.StringUtil
import com.intellij.openapi.vfs.VfsUtilCore
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.ui.ColoredTreeCellRenderer
import com.intellij.ui.DoubleClickListener
import com.intellij.ui.ScrollPaneFactory
import com.intellij.ui.SimpleTextAttributes
import com.intellij.ui.TreeUIHelper
import com.intellij.ui.components.ActionLink
import com.intellij.ui.components.JBTextArea
import com.intellij.ui.treeStructure.Tree
import com.intellij.util.ui.JBUI
import com.intellij.util.ui.UIUtil
import com.intellij.util.ui.tree.TreeUtil
import org.grillmycode.companion.auth.NOTIFICATION_GROUP
import org.grillmycode.companion.auth.signIn
import org.grillmycode.companion.shared.Question
import org.grillmycode.companion.shared.QuestionGroup
import org.grillmycode.companion.shared.Snippet
import org.grillmycode.companion.shared.describeLines
import org.grillmycode.companion.shared.groupQuestions
import org.grillmycode.companion.shared.openableSnippets
import java.awt.event.KeyAdapter
import java.awt.event.KeyEvent
import java.awt.event.MouseEvent
import javax.swing.BoxLayout
import javax.swing.JComponent
import javax.swing.JPanel
import javax.swing.JTree
import javax.swing.ToolTipManager
import javax.swing.tree.DefaultMutableTreeNode
import javax.swing.tree.DefaultTreeModel

/** A row of the questions tree: a file, or the broader questions; a question; or one of a question's snippets. */
private sealed interface Row {
    data class Group(
        val group: QuestionGroup,
    ) : Row

    data class QuestionRow(
        val question: Question,
    ) : Row

    data class SnippetRow(
        val question: Question,
        val snippet: Snippet,
    ) : Row
}

/**
 * The tool window's content: the questions tree, as the VS Code extension's
 * Questions view lays it out (extensions/vscode/src/student/questions-tree.js),
 * or, with no questions to show, a message saying why in the same words.
 *
 * Double-click or Enter on a question opens its first snippet; on a snippet
 * row, that snippet.
 */
class QuestionsPanel(
    private val project: Project,
    parent: Disposable,
) : SimpleToolWindowPanel(true, true) {
    private val service = project.getService(QuestionsService::class.java)
    private val tree = Tree(DefaultTreeModel(DefaultMutableTreeNode()))
    private var root: VirtualFile? = null

    init {
        tree.isRootVisible = false
        tree.showsRootHandles = true
        tree.cellRenderer = Renderer()
        ToolTipManager.sharedInstance().registerComponent(tree)
        TreeUIHelper.getInstance().installTreeSpeedSearch(tree)
        object : DoubleClickListener() {
            override fun onDoubleClick(event: MouseEvent): Boolean = openSelected()
        }.installOn(tree)
        tree.addKeyListener(
            object : KeyAdapter() {
                override fun keyPressed(event: KeyEvent) {
                    if (event.keyCode == KeyEvent.VK_ENTER && openSelected()) event.consume()
                }
            },
        )
        project.messageBus.connect(parent).subscribe(QuestionsListener.TOPIC, QuestionsListener(::show))
        show(service.state)
    }

    private fun show(state: QuestionsState) {
        if (state is QuestionsState.Ready) {
            root = state.root
            tree.model = DefaultTreeModel(buildTree(state.report.questions))
            TreeUtil.expandAll(tree)
            setContent(ScrollPaneFactory.createScrollPane(tree, true))
        } else {
            root = null
            setContent(message(state))
        }
    }

    private fun buildTree(questions: List<Question>): DefaultMutableTreeNode {
        val top = DefaultMutableTreeNode()
        for (group in groupQuestions(questions)) {
            val groupNode = DefaultMutableTreeNode(Row.Group(group))
            for (question in group.questions) {
                val questionNode = DefaultMutableTreeNode(Row.QuestionRow(question))
                val snippets = openableSnippets(question)
                if (snippets.size > 1) snippets.forEach { questionNode.add(DefaultMutableTreeNode(Row.SnippetRow(question, it))) }
                groupNode.add(questionNode)
            }
            top.add(groupNode)
        }
        return top
    }

    /** The message for a state with no questions, and the links that help. */
    private fun message(state: QuestionsState): JComponent {
        val refresh = "Refresh" to { service.refresh() }
        val (text, links) =
            when (state) {
                QuestionsState.Loading -> "Loading questions…" to emptyList()
                QuestionsState.NoRepository ->
                    "Open a project that is a clone of a GitHub repository to see its GrillMyCode questions." to listOf(refresh)
                QuestionsState.SignedOut ->
                    "Sign in to GitHub to load the questions for this repository." to listOf("Sign in to GitHub" to { signIn(project) })
                QuestionsState.NoAccess ->
                    (
                        "GitHub could not find this repository for the account that is signed in. " +
                            "Check that you are signed in with the account that owns the assignment."
                    ) to listOf("Try again" to { service.refresh() })
                QuestionsState.NoIssue ->
                    (
                        "No GrillMyCode questions were found for this repository. They appear here once you have " +
                            "pushed and the GrillMyCode workflow has finished."
                    ) to listOf(refresh)
                QuestionsState.NeedsUpdate ->
                    (
                        "These questions were written by a newer version of GrillMyCode than this plugin can read. " +
                            "Update GrillMyCode Companion to see them here. Until then, they are in the issue on GitHub."
                    ) to
                        listOf(
                            "Show plugins" to { ShowSettingsUtil.getInstance().showSettingsDialog(project, "Plugins") },
                            refresh,
                        )
                QuestionsState.Error ->
                    "The questions could not be loaded. The IDE's log (Help > Show Log) has the details." to
                        listOf("Try again" to { service.refresh() })
                is QuestionsState.Ready -> error("Ready shows the tree")
            }
        return JPanel().apply {
            layout = BoxLayout(this, BoxLayout.Y_AXIS)
            border = JBUI.Borders.empty(12)
            add(
                JBTextArea(text).apply {
                    isEditable = false
                    isFocusable = false
                    lineWrap = true
                    wrapStyleWord = true
                    isOpaque = false
                    font = UIUtil.getLabelFont()
                    alignmentX = LEFT_ALIGNMENT
                },
            )
            for ((label, action) in links) {
                add(JBUI.Panels.simplePanel().apply { border = JBUI.Borders.emptyTop(8) })
                add(ActionLink(label) { action() }.apply { alignmentX = LEFT_ALIGNMENT })
            }
        }
    }

    /** Opens what the selected row points at. False when it points at nothing. */
    private fun openSelected(): Boolean {
        val row = (tree.lastSelectedPathComponent as? DefaultMutableTreeNode)?.userObject
        val snippet =
            when (row) {
                is Row.QuestionRow -> openableSnippets(row.question).firstOrNull()
                is Row.SnippetRow -> row.snippet
                else -> null
            } ?: return false
        openSnippet(snippet)
        return true
    }

    /**
     * Opens a snippet's file with its lines selected. The path is the issue's,
     * which openableSnippets has checked; it is still resolved only inside the
     * repository.
     */
    private fun openSnippet(snippet: Snippet) {
        val root = root ?: return
        val file =
            root.findFileByRelativePath(snippet.file.replace('\\', '/'))?.takeIf { VfsUtilCore.isAncestor(root, it, true) }
        if (file == null || file.isDirectory) {
            NotificationGroupManager
                .getInstance()
                .getNotificationGroup(NOTIFICATION_GROUP)
                .createNotification("${snippet.file} is not in this project.", NotificationType.WARNING)
                .notify(project)
            return
        }
        val editor =
            FileEditorManager
                .getInstance(
                    project,
                ).openTextEditor(OpenFileDescriptor(project, file, snippet.startLine - 1, 0), true)
        val document = editor?.document ?: return
        if (document.lineCount == 0) return
        val first = (snippet.startLine - 1).coerceIn(0, document.lineCount - 1)
        val last = (snippet.endLine - 1).coerceIn(first, document.lineCount - 1)
        editor.selectionModel.setSelection(document.getLineStartOffset(first), document.getLineEndOffset(last))
    }

    private class Renderer : ColoredTreeCellRenderer() {
        override fun customizeCellRenderer(
            tree: JTree,
            value: Any?,
            selected: Boolean,
            expanded: Boolean,
            leaf: Boolean,
            row: Int,
            hasFocus: Boolean,
        ) {
            when (val item = (value as? DefaultMutableTreeNode)?.userObject) {
                is Row.Group -> {
                    val file = item.group.file
                    if (file == null) {
                        icon = AllIcons.General.Balloon
                        append("Broader questions")
                    } else {
                        val name = file.substringAfterLast('/')
                        icon = FileTypeManager.getInstance().getFileTypeByFileName(name).icon
                        append(name)
                        append("  " + file.substringBeforeLast('/', ""), SimpleTextAttributes.GRAYED_ATTRIBUTES)
                    }
                }
                is Row.QuestionRow -> {
                    // A tree row is plain text, so the backticks would only be noise.
                    append("${item.question.number}. ${item.question.question.replace("`", "")}")
                    // Swing reads a tooltip as HTML, and the text is the issue's, so it is escaped.
                    toolTipText =
                        "<html><b>Question ${item.question.number}</b><br>${StringUtil.escapeXmlEntities(item.question.question)}</html>"
                }
                is Row.SnippetRow -> {
                    icon = AllIcons.Actions.Forward
                    append(item.snippet.file)
                    append("  " + describeLines(item.snippet), SimpleTextAttributes.GRAYED_ATTRIBUTES)
                }
            }
        }
    }
}
