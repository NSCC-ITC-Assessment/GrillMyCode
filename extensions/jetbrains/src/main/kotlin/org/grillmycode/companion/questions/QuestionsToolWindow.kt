package org.grillmycode.companion.questions

import com.intellij.icons.AllIcons
import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.DumbAwareAction
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.popup.JBPopupFactory
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.ui.ColoredListCellRenderer
import com.intellij.ui.SimpleTextAttributes
import com.intellij.ui.content.ContentFactory
import org.grillmycode.companion.shared.NeedsUpdate
import org.grillmycode.companion.shared.Report
import org.grillmycode.companion.shared.describeGroup
import javax.swing.JList

/** The tool window's ID in plugin.xml. */
const val TOOL_WINDOW_ID = "GrillMyCode"

/** The GrillMyCode tool window. Its first opening is what starts the first load. */
class QuestionsToolWindowFactory :
    ToolWindowFactory,
    DumbAware {
    override fun createToolWindowContent(
        project: Project,
        toolWindow: ToolWindow,
    ) {
        val panel = QuestionsPanel(project, toolWindow.disposable)
        toolWindow.contentManager.addContent(ContentFactory.getInstance().createContent(panel, null, false))
        val actions = ActionManager.getInstance()
        toolWindow.setTitleActions(
            listOfNotNull(
                actions.getAction("GrillMyCode.PreviousQuestion"),
                actions.getAction("GrillMyCode.NextQuestion"),
                actions.getAction("GrillMyCode.ChooseIssue"),
                actions.getAction("GrillMyCode.Refresh"),
            ),
        )
        project.getService(QuestionsService::class.java).refresh()
    }
}

class RefreshAction : DumbAwareAction() {
    override fun getActionUpdateThread() = ActionUpdateThread.BGT

    override fun update(event: AnActionEvent) {
        event.presentation.isEnabled = event.project != null
    }

    override fun actionPerformed(event: AnActionEvent) {
        event.project?.getService(QuestionsService::class.java)?.refresh()
    }
}

/** Opens the question after or before the one selected, showing the tool window first if it is hidden. */
abstract class StepAction(
    private val step: Int,
) : DumbAwareAction() {
    override fun getActionUpdateThread() = ActionUpdateThread.BGT

    override fun update(event: AnActionEvent) {
        val project = event.project
        event.presentation.isEnabled =
            // Not created here: until the tool window opens, there are no questions to step through.
            project?.getServiceIfCreated(QuestionsService::class.java)?.state is QuestionsState.Ready
    }

    override fun actionPerformed(event: AnActionEvent) {
        val project = event.project ?: return
        val toolWindow = ToolWindowManager.getInstance(project).getToolWindow(TOOL_WINDOW_ID) ?: return
        toolWindow.show {
            (
                toolWindow.contentManager.contents
                    .firstOrNull()
                    ?.component as? QuestionsPanel
            )?.step(step)
        }
    }
}

class NextQuestionAction : StepAction(1)

class PreviousQuestionAction : StepAction(-1)

/**
 * Chooses among a repository's questions issues, one per branch or submission
 * tag pattern, or goes back to following the checked-out branch. Shown only
 * when there is more than one.
 */
class ChooseIssueAction : DumbAwareAction() {
    /** An entry in the list: an issue, or null to follow the branch. */
    private data class Choice(
        val loaded: LoadedIssue?,
    )

    override fun getActionUpdateThread() = ActionUpdateThread.BGT

    override fun update(event: AnActionEvent) {
        val service = event.project?.getServiceIfCreated(QuestionsService::class.java)
        event.presentation.isEnabledAndVisible = (service?.issues?.size ?: 0) > 1
    }

    override fun actionPerformed(event: AnActionEvent) {
        val service = event.project?.getServiceIfCreated(QuestionsService::class.java) ?: return
        val choices = listOf(Choice(null)) + service.issues.map { Choice(it) }
        val showing = service.chosen
        JBPopupFactory
            .getInstance()
            .createPopupChooserBuilder(choices)
            .setTitle("Choose Which Questions to Show")
            .setRenderer(
                object : ColoredListCellRenderer<Choice>() {
                    override fun customizeCellRenderer(
                        list: JList<out Choice>,
                        value: Choice,
                        index: Int,
                        selected: Boolean,
                        hasFocus: Boolean,
                    ) {
                        val loaded = value.loaded
                        if (loaded == null) {
                            icon = AllIcons.Vcs.Branch
                            append("Follow the checked-out branch")
                            append("  Show the questions for whichever branch this project is on", SimpleTextAttributes.GRAYED_ATTRIBUTES)
                            return
                        }
                        val issue = loaded.issue
                        append(describeGroup(issue.group))
                        val detail =
                            when (val report = loaded.report) {
                                is Report -> "${report.questions.size} questions · commit ${report.headSha}"
                                NeedsUpdate -> "Needs a newer version of GrillMyCode Companion"
                            }
                        val number = "#${issue.number}" + if (issue == showing) " · showing" else ""
                        append("  $number · $detail", SimpleTextAttributes.GRAYED_ATTRIBUTES)
                    }
                },
            ).setItemChosenCallback { service.choose(it.loaded?.issue?.title) }
            .createPopup()
            .showInBestPositionFor(event.dataContext)
    }
}
