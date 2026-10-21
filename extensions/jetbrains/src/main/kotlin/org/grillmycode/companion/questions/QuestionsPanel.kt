package org.grillmycode.companion.questions

import com.intellij.icons.AllIcons
import com.intellij.openapi.Disposable
import com.intellij.openapi.fileTypes.FileTypeManager
import com.intellij.openapi.options.ShowSettingsUtil
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.SimpleToolWindowPanel
import com.intellij.openapi.util.text.StringUtil
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.ui.ColoredTreeCellRenderer
import com.intellij.ui.DoubleClickListener
import com.intellij.ui.OnePixelSplitter
import com.intellij.ui.ScrollPaneFactory
import com.intellij.ui.SimpleTextAttributes
import com.intellij.ui.TreeUIHelper
import com.intellij.ui.components.ActionLink
import com.intellij.ui.components.JBTextArea
import com.intellij.ui.treeStructure.Tree
import com.intellij.util.ui.JBUI
import com.intellij.util.ui.UIUtil
import com.intellij.util.ui.tree.TreeUtil
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
 * Selecting a question shows it in full in the panel below the tree.
 * Double-click or Enter opens the files it shows with their lines highlighted,
 * its first snippet's in front; on a snippet row, that snippet's.
 */
class QuestionsPanel(
    private val project: Project,
    parent: Disposable,
) : SimpleToolWindowPanel(true, true) {
    private val service = project.getService(QuestionsService::class.java)
    private val highlighter = project.getService(Highlighter::class.java)
    private val tree = Tree(DefaultTreeModel(DefaultMutableTreeNode()))
    private val details = QuestionDetails()
    private val splitter =
        OnePixelSplitter(true, "GrillMyCode.QuestionsPanel.splitter", 0.6f).apply {
            firstComponent = ScrollPaneFactory.createScrollPane(tree, true)
            secondComponent = ScrollPaneFactory.createScrollPane(details, true)
        }
    private var root: VirtualFile? = null

    /** The issue body the tree was built from, to tell new questions from the same ones loaded again. */
    private var shownBody: String? = null

    init {
        tree.isRootVisible = false
        tree.showsRootHandles = true
        tree.cellRenderer = Renderer()
        ToolTipManager.sharedInstance().registerComponent(tree)
        tree.addTreeSelectionListener { details.show(selectedQuestion()) }
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
        val body = (state as? QuestionsState.Ready)?.issue?.body
        if (body != shownBody) {
            // Other questions, or none: the highlights were for the ones before.
            highlighter.clear()
            shownBody = body
            if (state is QuestionsState.Ready) {
                tree.model = DefaultTreeModel(buildTree(state.report.questions))
                TreeUtil.expandAll(tree)
                details.show(null)
            }
        }
        if (state is QuestionsState.Ready) {
            root = state.root
            setContent(splitter)
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

    private fun selectedRow() = (tree.lastSelectedPathComponent as? DefaultMutableTreeNode)?.userObject

    private fun selectedQuestion(): Question? =
        when (val row = selectedRow()) {
            is Row.QuestionRow -> row.question
            is Row.SnippetRow -> row.question
            else -> null
        }

    /** Opens the files of the selected row's question, with their lines highlighted. False when it shows no code. */
    private fun openSelected(): Boolean {
        val root = root ?: return false
        val question = selectedQuestion() ?: return false
        val snippets = openableSnippets(question)
        val target = (selectedRow() as? Row.SnippetRow)?.snippet ?: snippets.firstOrNull() ?: return false
        highlighter.show(root, snippets, target)
        return true
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
