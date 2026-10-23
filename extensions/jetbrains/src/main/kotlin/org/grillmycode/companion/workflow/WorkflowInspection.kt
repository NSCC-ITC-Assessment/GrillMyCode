package org.grillmycode.companion.workflow

import com.intellij.codeInspection.InspectionManager
import com.intellij.codeInspection.LocalInspectionTool
import com.intellij.codeInspection.ProblemDescriptor
import com.intellij.codeInspection.ProblemHighlightType
import com.intellij.openapi.util.TextRange
import com.intellij.psi.PsiFile
import org.grillmycode.companion.shared.Severity
import org.grillmycode.companion.shared.checkWorkflow

/**
 * Problems with the inputs of a workflow's GrillMyCode steps, as VS Code's
 * diagnostics show them. An error fails the run; a warning is a value the
 * action changes or ignores; a weak warning, an input with no effect.
 */
class WorkflowInspection : LocalInspectionTool() {
    override fun checkFile(
        file: PsiFile,
        manager: InspectionManager,
        isOnTheFly: Boolean,
    ): Array<ProblemDescriptor>? {
        if (!isWorkflowFile(file)) return null
        val text = file.text
        return checkWorkflow(text)
            .map { problem ->
                // A problem is never empty, but an empty range is one the IDE
                // cannot show, so it is given a character where there is one.
                val end = if (problem.end > problem.start) problem.end else minOf(problem.start + 1, text.length)
                val type =
                    when {
                        problem.deprecated -> ProblemHighlightType.LIKE_DEPRECATED
                        problem.severity == Severity.ERROR -> ProblemHighlightType.GENERIC_ERROR
                        problem.severity == Severity.WARNING -> ProblemHighlightType.WARNING
                        else -> ProblemHighlightType.WEAK_WARNING
                    }
                manager.createProblemDescriptor(file, TextRange(problem.start, end), problem.message, type, isOnTheFly)
            }.toTypedArray()
    }

    companion object {
        /** The inspection's name in plugin.xml, which the rest of the help asks whether it is on. */
        const val SHORT_NAME = "GrillMyCodeWorkflow"
    }
}
