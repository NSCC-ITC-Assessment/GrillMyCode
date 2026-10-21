package org.grillmycode.companion.questions

import com.intellij.openapi.application.ReadAction
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.io.FileUtil
import com.intellij.openapi.vcs.changes.ChangeListManager
import com.intellij.openapi.vfs.VfsUtilCore
import com.intellij.openapi.vfs.VirtualFile
import git4idea.repo.GitRepositoryManager

// The repository's state, as the moved-code warning reads it: a port of
// changedFiles in extensions/vscode/src/student/git.js.

/**
 * The full SHA the repository at [root] is at, or null when Git has not said
 * yet. The quick lookup, which is safe on the event dispatch thread.
 */
fun currentCommit(
    project: Project,
    root: VirtualFile,
): String? = GitRepositoryManager.getInstance(project).getRepositoryForRootQuick(root)?.currentRevision

/**
 * Repository-relative paths of every file that differs from the commit the
 * repository is at: the changes Git reports, staged or not, and files with
 * unsaved edits. With forward slashes, as the report writes them.
 */
fun changedFiles(
    project: Project,
    root: VirtualFile,
): List<String> =
    ReadAction.compute<List<String>, RuntimeException> {
        val changed =
            ChangeListManager.getInstance(project).allChanges.mapNotNull { change ->
                val path = (change.afterRevision ?: change.beforeRevision)?.file?.path ?: return@mapNotNull null
                FileUtil.getRelativePath(root.path, path, '/')?.takeIf { !it.startsWith("..") }
            }
        val documents = FileDocumentManager.getInstance()
        val unsaved =
            documents.unsavedDocuments.mapNotNull { document ->
                documents.getFile(document)?.let { VfsUtilCore.getRelativePath(it, root, '/') }
            }
        (changed + unsaved).distinct()
    }
