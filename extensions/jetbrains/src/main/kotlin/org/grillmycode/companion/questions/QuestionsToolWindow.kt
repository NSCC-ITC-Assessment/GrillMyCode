package org.grillmycode.companion.questions

import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.DumbAwareAction
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.ui.content.ContentFactory

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
