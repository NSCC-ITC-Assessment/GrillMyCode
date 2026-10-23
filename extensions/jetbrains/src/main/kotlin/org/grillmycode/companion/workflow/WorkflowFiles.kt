package org.grillmycode.companion.workflow

import com.intellij.codeInsight.daemon.HighlightDisplayKey
import com.intellij.profile.codeInspection.InspectionProjectProfileManager
import com.intellij.psi.PsiFile

// Workflow help
//
// Help with the GrillMyCode step of a workflow file: problems with its inputs
// marked as they are typed, the inputs and the values of an input with a fixed
// set offered, and what each input is for. A port of
// extensions/vscode/src/workflow/help.js.
//
// What is wrong and what to offer is decided in shared/, from the text alone.
// This package puts the answers into the IDE.
//
// The VS Code extension leaves names, descriptions and unknown inputs to the
// GitHub Actions extension where that is installed. JetBrains' GitHub Actions
// support reads the inputs of local actions only, so here all of it is shown.
//
// One switch turns it all off, as VS Code's setting does: the inspection, under
// Settings | Editor | Inspections | GrillMyCode. Completion and the
// descriptions follow it.

/** Workflow files, whatever else the project holds: `.github/workflows/**/*.yml` and `.yaml`. */
fun isWorkflowFile(file: PsiFile?): Boolean {
    val path = file?.originalFile?.virtualFile?.path ?: return false
    return path.contains("/.github/workflows/") && (path.endsWith(".yml") || path.endsWith(".yaml"))
}

/** True when [file] is a workflow file and the help is on for it. */
fun workflowHelpOn(file: PsiFile?): Boolean {
    if (file == null || !isWorkflowFile(file)) return false
    val key = HighlightDisplayKey.find(WorkflowInspection.SHORT_NAME) ?: return false
    return InspectionProjectProfileManager.getInstance(file.project).currentProfile.isToolEnabled(key, file)
}
