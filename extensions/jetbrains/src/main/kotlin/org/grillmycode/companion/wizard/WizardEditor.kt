package org.grillmycode.companion.wizard

import com.intellij.ide.BrowserUtil
import com.intellij.ide.ui.LafManagerListener
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.colors.EditorColorsListener
import com.intellij.openapi.editor.colors.EditorColorsManager
import com.intellij.openapi.fileEditor.FileEditor
import com.intellij.openapi.fileEditor.FileEditorPolicy
import com.intellij.openapi.fileEditor.FileEditorProvider
import com.intellij.openapi.fileEditor.FileEditorState
import com.intellij.openapi.fileEditor.OpenFileDescriptor
import com.intellij.openapi.fileTypes.FileType
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.util.UserDataHolderBase
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.testFramework.LightVirtualFile
import com.intellij.ui.JBColor
import com.intellij.ui.jcef.JBCefApp
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.JBCefBrowserBase
import com.intellij.ui.jcef.JBCefJSQuery
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.grillmycode.companion.shared.ACTION_REF
import org.grillmycode.companion.shared.DOCS_URL
import org.grillmycode.companion.shared.FOLDERS_NOTICE
import org.grillmycode.companion.shared.isWizardRequest
import org.grillmycode.companion.shared.wizardPage
import java.beans.PropertyChangeListener
import java.security.SecureRandom
import java.util.Base64
import javax.swing.Icon
import javax.swing.JComponent

// The Workflow Wizard's tab
//
// The docs site's Workflow Wizard in an editor tab, in JCEF: the one page in
// the plugin that runs a script. The Wizard is the docs site's code, bundled
// by the VS Code extension's build (build.gradle.kts), so there is one Wizard
// to keep. The page asks WizardHost for what a page cannot do.
//
// Where the IDE has no JCEF, as in some remote setups, the action opens the
// Wizard on the docs site instead.

private const val TITLE = "Workflow Wizard"

/** Where the Wizard is on the docs site, for an IDE without JCEF. */
const val WIZARD_URL = "$DOCS_URL/workflow-wizard"

/** What marks the Wizard's tab, which holds no file. */
object WizardFileType : FileType {
    override fun getName() = "GrillMyCode Workflow Wizard"

    override fun getDescription() = "The GrillMyCode Workflow Wizard"

    override fun getDefaultExtension() = ""

    override fun getIcon(): Icon? = null

    override fun isBinary() = true

    override fun isReadOnly() = true
}

/** The Wizard's tab, one per project. */
class WizardFile : LightVirtualFile(TITLE, WizardFileType, "") {
    init {
        isWritable = false
    }
}

private fun resource(name: String) =
    WizardEditor::class.java.getResourceAsStream(name)?.use { it.readBytes().decodeToString() }
        ?: error("$name is missing from the plugin: build it with Gradle, which bundles the Wizard")

class WizardEditor(
    private val project: Project,
    private val file: WizardFile,
) : UserDataHolderBase(),
    FileEditor {
    private val browser = JBCefBrowser.createBuilder().build()
    private val query = JBCefJSQuery.create(browser as JBCefBrowserBase)
    private val host = WizardHost(project)

    @Volatile private var disposed = false

    init {
        Disposer.register(this, browser)
        Disposer.register(this, query)
        browser.setOpenLinksInExternalBrowser(true)
        query.addHandler { text ->
            receive(text)
            null
        }
        val connection = ApplicationManager.getApplication().messageBus.connect(this)
        connection.subscribe(LafManagerListener.TOPIC, LafManagerListener { followTheme() })
        connection.subscribe(EditorColorsManager.TOPIC, EditorColorsListener { followTheme() })
        val nonce = Base64.getEncoder().encodeToString(ByteArray(16).also { SecureRandom().nextBytes(it) })
        browser.loadHTML(
            wizardPage(
                nonce = nonce,
                script = resource("/wizard/wizard.js"),
                style = resource("/wizard/wizard.css"),
                bridge = resource("/wizard-bridge.js").replace("SEND_REQUEST", query.inject("request")),
                theme = wizardThemeCss(),
                light = JBColor.isBright(),
                actionRef = ACTION_REF,
                docsBase = DOCS_URL,
            ),
        )
    }

    /** Sends the page a message, as a `message` event. */
    private fun post(message: JsonElement) {
        // JSON is a JavaScript expression, so it is written into the call as it is.
        browser.cefBrowser.executeJavaScript("window.gmcReceive($message);", browser.cefBrowser.url.orEmpty(), 0)
    }

    /** Gives the page the IDE's colours again, after the theme changes. */
    private fun followTheme() {
        val css = Json.encodeToString(JsonElement.serializer(), JsonPrimitive(wizardThemeCss()))
        val theme = if (JBColor.isBright()) "vscode-light" else "vscode-dark"
        browser.cefBrowser.executeJavaScript(
            "document.getElementById('theme').textContent = $css; document.body.className = '$theme';",
            browser.cefBrowser.url.orEmpty(),
            0,
        )
    }

    private fun receive(text: String) {
        val message = runCatching { Json.parseToJsonElement(text) }.getOrNull()
        if (!isWizardRequest(message)) return
        message as JsonObject
        val type = (message["type"] as JsonPrimitive).content
        if (type == "ready") {
            post(
                buildJsonObject {
                    put("type", FOLDERS_NOTICE)
                    put("openFolder", host.openFolderName())
                },
            )
            return
        }
        val id = message["id"]!!
        ApplicationManager.getApplication().executeOnPooledThread {
            val reply =
                try {
                    buildJsonObject {
                        put("id", id)
                        put("ok", true)
                        put("value", host.answer(message))
                    }
                } catch (err: WizardError) {
                    failure(id, err.name, err.message)
                } catch (err: Exception) {
                    failure(id, "Error", err.message)
                }
            // The tab may have been closed while the answer was worked out.
            if (!disposed) post(reply)
        }
    }

    private fun failure(
        id: JsonElement,
        name: String,
        message: String?,
    ) = buildJsonObject {
        put("id", id)
        put("ok", false)
        put(
            "error",
            buildJsonObject {
                put("name", name)
                put("message", message.orEmpty())
            },
        )
    }

    override fun getComponent(): JComponent = browser.component

    override fun getPreferredFocusedComponent(): JComponent = browser.component

    override fun getName() = TITLE

    override fun setState(state: FileEditorState) = Unit

    override fun isModified() = false

    override fun isValid() = true

    override fun addPropertyChangeListener(listener: PropertyChangeListener) = Unit

    override fun removePropertyChangeListener(listener: PropertyChangeListener) = Unit

    override fun getFile(): VirtualFile = file

    override fun dispose() {
        disposed = true
    }
}

class WizardEditorProvider :
    FileEditorProvider,
    DumbAware {
    override fun accept(
        project: Project,
        file: VirtualFile,
    ) = file is WizardFile

    override fun createEditor(
        project: Project,
        file: VirtualFile,
    ): FileEditor = WizardEditor(project, file as WizardFile)

    override fun getEditorTypeId() = "grillmycode-workflow-wizard"

    override fun getPolicy() = FileEditorPolicy.HIDE_DEFAULT_EDITOR
}

/** The project's one Wizard tab: going back to it finds the answers given so far. */
@Service(Service.Level.PROJECT)
class WizardTabs(
    private val project: Project,
) {
    private val file = WizardFile()

    // Navigating, not FileEditorManager.openFile, which later IDEs deprecate
    // for a call 2025.1 does not have.
    fun open() = OpenFileDescriptor(project, file).navigate(true)
}

class OpenWorkflowWizardAction :
    AnAction(),
    DumbAware {
    override fun getActionUpdateThread() = ActionUpdateThread.BGT

    override fun update(event: AnActionEvent) {
        event.presentation.isEnabledAndVisible = event.project != null
    }

    override fun actionPerformed(event: AnActionEvent) {
        val project = event.project ?: return
        if (JBCefApp.isSupported()) project.service<WizardTabs>().open() else BrowserUtil.browse(WIZARD_URL)
    }
}
