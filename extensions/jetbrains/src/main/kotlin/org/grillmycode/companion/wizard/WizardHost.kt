package org.grillmycode.companion.wizard

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.application.ModalityState
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.fileChooser.FileChooser
import com.intellij.openapi.fileChooser.FileChooserDescriptorFactory
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.fileEditor.OpenFileDescriptor
import com.intellij.openapi.project.Project
import com.intellij.openapi.project.guessProjectDir
import com.intellij.openapi.ui.MessageDialogBuilder
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.vcs.changes.ChangeListManager
import com.intellij.openapi.vfs.VFileProperty
import com.intellij.openapi.vfs.VfsUtil
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.testFramework.LightVirtualFile
import git4idea.repo.GitRepositoryManager
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.put
import org.grillmycode.companion.questions.read
import org.grillmycode.companion.shared.CANCELLED
import org.grillmycode.companion.shared.FolderEntry
import org.grillmycode.companion.shared.FolderRecord
import org.grillmycode.companion.shared.WIZARD_MAX_FILE_BYTES
import org.grillmycode.companion.shared.WIZARD_MAX_WORKFLOW_CHARS
import org.grillmycode.companion.shared.WORKFLOW_FILE

// The Workflow Wizard's host
//
// What the Wizard's page asks of the IDE, answered: the folder its file
// preview reads, what that folder holds, and the workflow file it writes. A
// port of the request handling in extensions/vscode/src/workflow/wizard.js,
// with the same rules. The page itself is WizardEditor's.
//
// The page runs a script, which the questions panel never may. It can, because
// it shows nothing from an issue: only the Wizard, and the names of the
// instructor's own files. What it may ask for is still kept narrow. It is
// given files only from a folder the instructor chose, and only those a
// listing has named (FolderRecord).
//
// What Git ignores in that folder is left out of its listings: build output,
// downloaded tools and the like are never committed, so no run sees them.

/** A request refused, with the name the page's error is given. */
class WizardError(
    val name: String,
    message: String,
) : Exception(message)

/** Refuses a request because the instructor closed a prompt without choosing. */
private fun cancelled() = WizardError(CANCELLED, "cancelled")

/**
 * The questions put to the instructor, each answered on the event dispatch
 * thread. An interface, so the tests can answer them: a test cannot press a
 * button in a dialog.
 */
interface WizardPrompts {
    /** A folder from anywhere on the computer, or null. */
    fun chooseFolder(project: Project): VirtualFile?

    /** Whether to replace the workflow file the project already has. */
    fun confirmReplace(
        project: Project,
        folderName: String,
    ): Boolean
}

object IdeWizardPrompts : WizardPrompts {
    override fun chooseFolder(project: Project): VirtualFile? {
        val descriptor =
            FileChooserDescriptorFactory
                .singleDir()
                .withTitle("Choose a Folder of the Kind of Work Your Students Will Submit")
        return FileChooser.chooseFile(descriptor, project, null)
    }

    override fun confirmReplace(
        project: Project,
        folderName: String,
    ): Boolean =
        MessageDialogBuilder
            .yesNo(
                "Replace the Workflow File",
                "$folderName already has $WORKFLOW_FILE. Replace what is in it?\n\nYou can undo the change in the file once it is open.",
            ).yesText("Replace")
            .noText(Messages.getCancelButton())
            .icon(Messages.getWarningIcon())
            .ask(project)
}

/**
 * Answers the Wizard's page. [projectFolder] is the folder the project is in,
 * where the workflow file goes, and the folder the preview reads unless the
 * instructor chooses another.
 */
class WizardHost(
    private val project: Project,
    private val prompts: WizardPrompts = IdeWizardPrompts,
    private val projectFolder: () -> VirtualFile? = { project.guessProjectDir() },
) {
    /** The folder the page is reading, what it has been shown, and whether its listings leave out what Git ignores. */
    private data class Reading(
        val root: VirtualFile,
        val record: FolderRecord,
        val gitIgnores: Boolean,
    )

    @Volatile private var reading: Reading? = null

    /** The name of the folder the project is in, or "" when it has none, for the page's notice. */
    fun openFolderName(): String = projectFolder()?.name.orEmpty()

    /** The answer to a request isWizardRequest has passed, other than `ready`. Called off the event dispatch thread. */
    fun answer(request: JsonObject): JsonElement {
        fun field(name: String) = request[name] as? JsonPrimitive
        return when (val type = field("type")?.content) {
            "pickFolder" -> pickFolder(field("choose")?.booleanOrNull == true)
            "list" -> list(field("path")?.takeIf { it.isString }?.content)
            "read" ->
                JsonPrimitive(
                    read(field("path")?.takeIf { it.isString }?.content, field("bytes")?.takeIf { !it.isString }?.doubleOrNull),
                )
            "saveWorkflow" -> JsonPrimitive(saveWorkflow(field("yaml")?.takeIf { it.isString }?.content))
            else -> throw WizardError("Error", "Unknown request: $type")
        }
    }

    /** Runs [ask] on the event dispatch thread and waits for its answer. */
    private fun <T> onEdt(ask: () -> T): T {
        var answer: Result<T>? = null
        ApplicationManager.getApplication().invokeAndWait({ answer = runCatching(ask) }, ModalityState.any())
        return answer!!.getOrThrow()
    }

    /**
     * Settles which folder the page reads, and returns its name: the
     * project's, or with [choose], or with none, one the instructor picks.
     * From then on `list` and `read` answer for that folder alone.
     */
    fun pickFolder(choose: Boolean): JsonObject {
        val root = (if (choose) null else projectFolder()) ?: onEdt { prompts.chooseFolder(project) } ?: throw cancelled()
        val gitIgnores = GitRepositoryManager.getInstance(project).getRepositoryForFileQuick(root) != null
        reading = Reading(root, FolderRecord(), gitIgnores)
        return buildJsonObject {
            put("name", root.name.ifEmpty { "/" })
            put("ignoredLeftOut", gitIgnores)
        }
    }

    /** What a folder holds, as `[{ name, kind }]`, without what Git ignores. [path] is "" for the folder picked. */
    fun list(path: String?): JsonElement {
        val current = reading
        if (current == null || !current.record.hasFolder(path)) throw WizardError("Error", "Not a folder the Wizard was shown.")
        val folder = if (path.isNullOrEmpty()) current.root else current.root.findFileByRelativePath(path)
        folder ?: throw WizardError("Error", "The folder is gone.")
        // As it is on disk now, as VS Code reads it, not as the IDE last saw it.
        VfsUtil.markDirtyAndRefresh(false, false, true, folder)
        val changes = ChangeListManager.getInstance(project)
        val entries =
            read {
                folder.children
                    .filter { !current.gitIgnores || !changes.isIgnoredFile(it) }
                    .map { child ->
                        val link = child.`is`(VFileProperty.SYMLINK)
                        val special = child.`is`(VFileProperty.SPECIAL)
                        FolderEntry(child.name, !link && !special && !child.isDirectory, !link && child.isDirectory, link)
                    }
            }
        return buildJsonArray {
            for ((name, kind) in current.record.add(path.orEmpty(), entries)) {
                add(
                    buildJsonObject {
                        put("name", name)
                        put("kind", kind)
                    },
                )
            }
        }
    }

    /**
     * A file's text, or with [bytes] the text of that many of its first bytes.
     * A file too large to give in full is refused, which the Wizard takes as a
     * file it could not read.
     */
    fun read(
        path: String?,
        bytes: Double?,
    ): String {
        val current = reading
        if (current == null || path == null || !current.record.hasFile(path)) throw WizardError("Error", "Not a file the Wizard was shown.")
        val file = current.root.findFileByRelativePath(path) ?: throw WizardError("Error", "The file is gone.")
        val whole = bytes == null || bytes != Math.floor(bytes) || bytes <= 0
        val limit = if (whole) WIZARD_MAX_FILE_BYTES + 1 else minOf(bytes, WIZARD_MAX_FILE_BYTES.toDouble()).toInt()
        val content = file.inputStream.use { it.readNBytes(limit) }
        if (whole && content.size > WIZARD_MAX_FILE_BYTES) throw WizardError("Error", "The file is too large.")
        // As the page's TextDecoder would: a byte order mark is dropped, and
        // bytes that are not UTF-8 become U+FFFD.
        return content.decodeToString().removePrefix("")
    }

    /**
     * Writes the workflow to WORKFLOW_FILE in the project's folder and opens
     * it. Returns false if the instructor backs out. With no folder there is
     * nowhere to write it, so it opens as a file that is not saved.
     */
    fun saveWorkflow(yaml: String?): Boolean {
        if (yaml.isNullOrBlank() || yaml.length > WIZARD_MAX_WORKFLOW_CHARS) throw WizardError("Error", "Not a workflow.")
        val folder = projectFolder()
        if (folder == null) {
            onEdt { OpenFileDescriptor(project, LightVirtualFile(WORKFLOW_FILE.substringAfterLast('/'), yaml)).navigate(true) }
            return true
        }
        val existing = read { folder.findFileByRelativePath(WORKFLOW_FILE) }
        return onEdt {
            if (existing != null && !prompts.confirmReplace(project, folder.name)) return@onEdt false
            val file =
                WriteCommandAction.writeCommandAction(project).withName("Create the Workflow File").compute<VirtualFile, Exception> {
                    if (existing != null) {
                        // Replaced as an edit, so it can be undone, and so a copy
                        // of the file that is open with changes of its own is
                        // replaced too.
                        val document =
                            FileDocumentManager.getInstance().getDocument(existing)
                                ?: throw WizardError("Error", "The file cannot be edited.")
                        document.setText(yaml)
                        FileDocumentManager.getInstance().saveDocument(document)
                        existing
                    } else {
                        val dir = VfsUtil.createDirectoryIfMissing(folder, WORKFLOW_FILE.substringBeforeLast('/'))
                        dir.createChildData(this, WORKFLOW_FILE.substringAfterLast('/')).also { it.setBinaryContent(yaml.toByteArray()) }
                    }
                }
            OpenFileDescriptor(project, file).navigate(true)
            true
        }
    }
}
