package org.grillmycode.companion.questions

import com.intellij.icons.AllIcons
import com.intellij.ide.BrowserUtil
import com.intellij.openapi.Disposable
import com.intellij.openapi.editor.EditorFactory
import com.intellij.openapi.editor.event.DocumentEvent
import com.intellij.openapi.editor.event.DocumentListener
import com.intellij.openapi.fileTypes.FileTypeManager
import com.intellij.openapi.options.ShowSettingsUtil
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.SimpleToolWindowPanel
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.vcs.changes.ChangeListListener
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.ui.ColoredTreeCellRenderer
import com.intellij.ui.DoubleClickListener
import com.intellij.ui.JBColor
import com.intellij.ui.OnePixelSplitter
import com.intellij.ui.ScrollPaneFactory
import com.intellij.ui.SimpleTextAttributes
import com.intellij.ui.TreeUIHelper
import com.intellij.ui.components.ActionLink
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBTextArea
import com.intellij.ui.render.RenderingUtil
import com.intellij.ui.treeStructure.Tree
import com.intellij.util.ui.JBUI
import com.intellij.util.ui.UIUtil
import com.intellij.util.ui.tree.TreeUtil
import git4idea.repo.GitRepository
import git4idea.repo.GitRepositoryChangeListener
import org.grillmycode.companion.auth.GITHUB_APP_SETTINGS_URL
import org.grillmycode.companion.auth.signIn
import org.grillmycode.companion.instructor.instructorQuestionToHtml
import org.grillmycode.companion.instructor.matchesReport
import org.grillmycode.companion.shared.Question
import org.grillmycode.companion.shared.QuestionGroup
import org.grillmycode.companion.shared.Snippet
import org.grillmycode.companion.shared.adjacentQuestion
import org.grillmycode.companion.shared.describeDrift
import org.grillmycode.companion.shared.describeGroup
import org.grillmycode.companion.shared.describeLines
import org.grillmycode.companion.shared.groupQuestions
import org.grillmycode.companion.shared.openableSnippets
import org.grillmycode.companion.shared.questionFiles
import org.grillmycode.companion.shared.questionToHtml
import java.awt.BorderLayout
import java.awt.Component
import java.awt.Dimension
import java.awt.event.ComponentAdapter
import java.awt.event.ComponentEvent
import java.awt.event.KeyAdapter
import java.awt.event.KeyEvent
import java.awt.event.MouseEvent
import javax.swing.BoxLayout
import javax.swing.JComponent
import javax.swing.JPanel
import javax.swing.JTree
import javax.swing.JViewport
import javax.swing.SwingConstants
import javax.swing.Timer
import javax.swing.plaf.basic.BasicTreeUI
import javax.swing.tree.DefaultMutableTreeNode
import javax.swing.tree.DefaultTreeModel
import javax.swing.tree.TreeCellRenderer
import javax.swing.tree.TreePath

/** How long the project must be quiet before the note above the tree is worked out again. */
private const val SETTLE_MS = 300

/** The narrowest a question's text is wrapped to, however narrow the tool window. */
private const val MIN_WRAP_WIDTH = 80

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
 * Each question's text wraps to the tree's width, which VS Code's tree cannot
 * do. Selecting a question shows it in full in the panel below the tree.
 * Double-click or Enter opens the files it shows with their lines highlighted,
 * its first snippet's in front; on a snippet row, that snippet's.
 *
 * A note above the tree says when the highlighted lines may not be the ones
 * asked about, worked out again once the project has been quiet for a moment,
 * and when a newer set of questions has arrived.
 *
 * In the instructor view the tree lists the answer key's questions, and the
 * panel below shows each one's answer. Only an account with both views is told,
 * beside the tool window's name, which one it is looking at.
 */
class QuestionsPanel(
    private val project: Project,
    parent: Disposable,
) : SimpleToolWindowPanel(true, true) {
    private val service = project.getService(QuestionsService::class.java)
    private val highlighter = project.getService(Highlighter::class.java)
    private val tree = Tree(DefaultTreeModel(DefaultMutableTreeNode()))
    private val renderer = Renderer()
    private val details = QuestionDetails()
    private val splitter =
        OnePixelSplitter(true, "GrillMyCode.QuestionsPanel.splitter", 0.6f).apply {
            firstComponent = ScrollPaneFactory.createScrollPane(tree, true)
            secondComponent = ScrollPaneFactory.createScrollPane(details, true)
        }
    private val notesText =
        JBTextArea().apply {
            isEditable = false
            isFocusable = false
            lineWrap = true
            wrapStyleWord = true
            isOpaque = false
            font = UIUtil.getLabelFont()
        }
    private val notes =
        JPanel(BorderLayout(JBUI.scale(6), 0)).apply {
            border = JBUI.Borders.compound(JBUI.Borders.customLineBottom(JBColor.border()), JBUI.Borders.empty(6, 8))
            add(JBLabel(AllIcons.General.Warning).apply { verticalAlignment = SwingConstants.TOP }, BorderLayout.WEST)
            add(notesText, BorderLayout.CENTER)
            isVisible = false
        }
    private val questionsView =
        JPanel(BorderLayout()).apply {
            add(notes, BorderLayout.NORTH)
            add(splitter, BorderLayout.CENTER)
        }

    /** Waits for edits, saves and Git to settle before the note is worked out again, as VS Code's SETTLE_MS does. */
    private val settle = Timer(SETTLE_MS) { updateNotes() }.apply { isRepeats = false }

    private var ready: QuestionsState.Ready? = null
    private val root get() = ready?.root

    /** The questions the tree was built from, and in which view, to tell new ones from the same ones loaded again. */
    private var shown: Pair<View, List<Question>>? = null

    init {
        tree.isRootVisible = false
        tree.showsRootHandles = true
        tree.cellRenderer = renderer
        // Each row as tall as its renderer asks, so a question can take several lines.
        tree.rowHeight = 0
        (tree.parent as? JViewport)?.addComponentListener(
            object : ComponentAdapter() {
                override fun componentResized(event: ComponentEvent) = rewrap()
            },
        )
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
        project.messageBus.connect(parent).apply {
            subscribe(QuestionsListener.TOPIC, QuestionsListener(::show))
            // Git's list of changes, which a save also updates.
            subscribe(
                ChangeListListener.TOPIC,
                object : ChangeListListener {
                    override fun changeListUpdateDone() = settle.restart()
                },
            )
            subscribe(GitRepository.GIT_REPO_CHANGE, GitRepositoryChangeListener { settle.restart() })
        }
        EditorFactory.getInstance().eventMulticaster.addDocumentListener(
            object : DocumentListener {
                override fun documentChanged(event: DocumentEvent) = settle.restart()
            },
            parent,
        )
        Disposer.register(parent) { settle.stop() }
        show(service.state)
    }

    private fun show(state: QuestionsState) {
        val view = service.view
        val questions = (state as? QuestionsState.Ready)?.let { view to it.questions }
        if (questions != shown) {
            // Other questions, or none: the highlights were for the ones before.
            highlighter.clear()
            shown = questions
            if (state is QuestionsState.Ready) {
                details.toHtml = if (view == View.INSTRUCTOR) ::instructorQuestionToHtml else ::questionToHtml
                tree.model = DefaultTreeModel(buildTree(state.questions))
                TreeUtil.expandAll(tree)
                rewrap()
                details.show(null)
            }
        }
        ready = state as? QuestionsState.Ready
        // Only an account with both views is told which one it is looking at.
        val viewName =
            when {
                service.key == null -> null
                view == View.INSTRUCTOR -> "Instructor view"
                else -> "Student view"
            }
        // Beside the tool window's name: which questions these are, as VS Code's view description says.
        ToolWindowManager
            .getInstance(project)
            .getToolWindow(TOOL_WINDOW_ID)
            ?.contentManager
            ?.getContent(this)
            ?.displayName =
            listOfNotNull(viewName, ready?.issue?.let { describeGroup(it.group, it.set) }, ready?.report?.headSha)
                .joinToString(" · ")
                .ifEmpty { null }
        if (state is QuestionsState.Ready) {
            setContent(questionsView)
            updateNotes()
        } else {
            setContent(message(state))
        }
    }

    /** Says, above the tree, when the highlighted lines may not be the ones asked about. */
    private fun updateNotes() {
        val ready = ready ?: return
        val report = ready.report
        val instructor = service.view == View.INSTRUCTOR
        // The answer key does not say which commit it was written about. The issue
        // does, and stands in for it while the two hold the same questions.
        val sameRun = report != null && (!instructor || matchesReport(report.questions, ready.questions))
        val text =
            listOf(
                if (service.arrived != null) {
                    "A newer set of questions has arrived. Select Refresh Questions, at the top of this tool window, to show it."
                } else {
                    ""
                },
                if (instructor && report != null && !sameRun) {
                    "The answer key and the questions issue showing are from different runs of GrillMyCode. " +
                        "These are the answer key's questions, and their lines may not be the ones in this project."
                } else {
                    ""
                },
                if (report != null && sameRun) {
                    describeDrift(
                        headSha = report.headCommit ?: report.headSha,
                        folderCommit = currentCommit(project, ready.root),
                        changedFiles = changedFiles(project, ready.root),
                        files = questionFiles(ready.questions),
                    )
                } else {
                    ""
                },
                if (!instructor && report?.truncated == true) {
                    "This report was too long to show in full, so its last questions are missing here. " +
                        "The PDF linked from the issue has them all."
                } else {
                    ""
                },
            ).filter { it.isNotEmpty() }.joinToString(" ")
        notesText.text = text
        notes.isVisible = text.isNotEmpty()
    }

    /**
     * Opens the question after ([step] 1) or before (-1) the one selected, in
     * the order the tree lists them, as double-clicking it would. The tree is
     * not given the keyboard: that goes to the editor the question opens.
     */
    fun step(step: Int) {
        val ready = ready ?: return
        val question = adjacentQuestion(ready.questions, selectedQuestion()?.number, step) ?: return
        val node =
            TreeUtil.findNode(tree.model.root as DefaultMutableTreeNode) {
                (it.userObject as? Row.QuestionRow)?.question == question
            } ?: return
        // Selecting the row shows the question below; a broader question has no code to open.
        TreeUtil.selectNode(tree, node)
        openSelected()
    }

    /**
     * Wraps the questions' text to the tree's width again: telling the model
     * each question's row has changed has the tree measure it afresh. Where a
     * question's row starts is measured first, since the renderer cannot ask
     * while it lays the row out.
     */
    private fun rewrap() {
        val model = tree.model as DefaultTreeModel
        val questions =
            (model.root as DefaultMutableTreeNode)
                .depthFirstEnumeration()
                .toList()
                .filterIsInstance<DefaultMutableTreeNode>()
                .filter { it.userObject is Row.QuestionRow }
        questions.firstOrNull()?.let { tree.getPathBounds(TreePath(it.path)) }?.let { renderer.questionX = it.x }
        questions.forEach(model::nodeChanged)
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
                QuestionsState.Untrusted ->
                    (
                        "This project is open in safe mode, which switches off the Git support GrillMyCode needs. " +
                            "Trust the project to see your questions."
                    ) to emptyList()
                QuestionsState.NoRepository ->
                    "Open a project that is a clone of a GitHub repository to see its GrillMyCode questions." to listOf(refresh)
                QuestionsState.SignedOut ->
                    "Sign in to GitHub to load the questions for this repository." to listOf("Sign in to GitHub" to { signIn(project) })
                QuestionsState.NoAccess ->
                    (
                        "GitHub could not find this repository for the account that is signed in. " +
                            "Check that you are signed in with the account that owns the assignment."
                    ) to listOf("Try again" to { service.refresh() })
                is QuestionsState.NotApproved ->
                    (
                        "The ${state.owner} organization on GitHub has not approved GrillMyCode Companion, so it cannot " +
                            "read this repository. Ask your instructor to approve it. You can also ask the organization " +
                            "from GitHub yourself."
                    ) to
                        listOf(
                            "Ask on GitHub" to { BrowserUtil.browse(GITHUB_APP_SETTINGS_URL) },
                            "Try again" to { service.refresh() },
                        )
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

    /**
     * Draws a question's row as text that wraps to the tree's width, and every
     * other row as the IDE draws a tree row.
     */
    private class Renderer : TreeCellRenderer {
        /** Where a question's row starts, as the panel last measured it. Until then, worked out from the indents. */
        var questionX: Int? = null

        private val rowRenderer = RowRenderer()
        private val questionText =
            JBTextArea().apply {
                isEditable = false
                lineWrap = true
                wrapStyleWord = true
                isOpaque = false
                border = JBUI.Borders.empty(2, 0)
            }

        override fun getTreeCellRendererComponent(
            tree: JTree,
            value: Any?,
            selected: Boolean,
            expanded: Boolean,
            leaf: Boolean,
            row: Int,
            hasFocus: Boolean,
        ): Component {
            val node = value as? DefaultMutableTreeNode
            val item =
                node?.userObject as? Row.QuestionRow
                    ?: return rowRenderer.getTreeCellRendererComponent(tree, value, selected, expanded, leaf, row, hasFocus)
            return questionText.apply {
                // Plain text, so the backticks would only be noise.
                text = "${item.question.number}. ${item.question.question.replace("`", "")}"
                font = tree.font
                foreground = RenderingUtil.getForeground(tree, selected)
                val width = wrapWidth(tree, node)
                preferredSize = null
                setSize(width, Short.MAX_VALUE.toInt())
                preferredSize = Dimension(width, preferredSize.height)
            }
        }

        /** The width left for a question's text: from where its row starts to the right edge of what shows of the tree. */
        private fun wrapWidth(
            tree: JTree,
            node: DefaultMutableTreeNode,
        ): Int {
            val shown = (tree.parent as? JViewport)?.width ?: tree.width
            val x =
                questionX ?: (tree.ui as? BasicTreeUI)?.let { (it.leftChildIndent + it.rightChildIndent) * node.level } ?: 0
            return (shown - x - tree.insets.right).coerceAtLeast(JBUI.scale(MIN_WRAP_WIDTH))
        }
    }

    private class RowRenderer : ColoredTreeCellRenderer() {
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
                is Row.SnippetRow -> {
                    icon = AllIcons.Actions.Forward
                    append(item.snippet.file)
                    append("  " + describeLines(item.snippet), SimpleTextAttributes.GRAYED_ATTRIBUTES)
                }
            }
        }
    }
}
