package org.grillmycode.companion.workflow

import com.intellij.codeInspection.InspectionManager
import com.intellij.codeInspection.LocalInspectionTool
import com.intellij.codeInspection.ProblemDescriptor
import com.intellij.codeInspection.ProblemHighlightType
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.util.TextRange
import com.intellij.openapi.vfs.VfsUtilCore
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.psi.PsiFile
import org.grillmycode.companion.shared.OTHER_WORKFLOW_MAX_BYTES
import org.grillmycode.companion.shared.OtherWorkflow
import org.grillmycode.companion.shared.Severity
import org.grillmycode.companion.shared.checkWorkflow
import org.grillmycode.companion.shared.questionSets

/** Where a workflow file's path from its repository starts. */
private const val WORKFLOWS_FOLDER = ".github/workflows/"

/**
 * A workflow file's path from its repository, as github.workflow gives it for a
 * workflow with no name: `.github/workflows/grill-my-code.yml`.
 */
private fun repositoryPath(file: VirtualFile): String = file.path.substring(file.path.lastIndexOf("/$WORKFLOWS_FOLDER") + 1)

/**
 * The other workflow files in [file]'s folder, with the question sets each
 * files under. A file open in the IDE is read as it stands there, saved or not;
 * one that cannot be read, or is too large, is left out.
 */
private fun otherWorkflows(file: VirtualFile): List<OtherWorkflow> {
    val documents = FileDocumentManager.getInstance()
    return file.parent
        ?.children
        .orEmpty()
        .filter { it != file && !it.isDirectory && (it.name.endsWith(".yml") || it.name.endsWith(".yaml")) }
        .mapNotNull { other ->
            val text =
                documents.getCachedDocument(other)?.text
                    ?: if (other.length > OTHER_WORKFLOW_MAX_BYTES) {
                        null
                    } else {
                        runCatching { VfsUtilCore.loadText(other) }.getOrNull()
                    }
            text?.let { OtherWorkflow(repositoryPath(other), questionSets(it, repositoryPath(other))) }
        }
}

/**
 * Problems with the inputs of a workflow's GrillMyCode steps, as VS Code's
 * diagnostics show them. An error fails the run; a warning is a value the
 * action changes or ignores; a weak warning, an input with no effect. The
 * other workflow files beside it are read for their question sets.
 */
class WorkflowInspection : LocalInspectionTool() {
    override fun checkFile(
        file: PsiFile,
        manager: InspectionManager,
        isOnTheFly: Boolean,
    ): Array<ProblemDescriptor>? {
        if (!isWorkflowFile(file)) return null
        val text = file.text
        val virtualFile = file.originalFile.virtualFile
        return checkWorkflow(text, path = repositoryPath(virtualFile), otherWorkflows = otherWorkflows(virtualFile))
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
