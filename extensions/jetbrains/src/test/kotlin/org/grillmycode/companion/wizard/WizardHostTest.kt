package org.grillmycode.companion.wizard

import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.testFramework.fixtures.BasePlatformTestCase
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.grillmycode.companion.shared.CANCELLED
import org.grillmycode.companion.shared.WIZARD_MAX_FILE_BYTES
import org.grillmycode.companion.shared.WORKFLOW_FILE
import java.io.File

// The Wizard's host in a light IDE: what the page may ask for, and what it is
// given. The page itself needs JCEF, which a test IDE has not got.

/** Answers the prompts as a test says, and counts them. */
private class Answers(
    var folder: VirtualFile? = null,
    var replace: Boolean = true,
) : WizardPrompts {
    var replaceAsked = 0

    override fun chooseFolder(project: Project) = folder

    var replacePath: String? = null

    override fun confirmReplace(
        project: Project,
        folderName: String,
        path: String,
    ): Boolean {
        replaceAsked++
        replacePath = path
        return replace
    }
}

class WizardHostTest : BasePlatformTestCase() {
    private lateinit var root: VirtualFile
    private val answers = Answers()
    private lateinit var host: WizardHost

    override fun setUp() {
        super.setUp()
        myFixture.addFileToProject("app/src/cart.js", "export const cart = [];\n")
        myFixture.addFileToProject("app/package.json", "{ \"name\": \"cart\" }")
        root = myFixture.findFileInTempDir("app")
        host = WizardHost(project, answers) { root }
    }

    private fun ask(request: String) = host.answer(Json.parseToJsonElement(request).jsonObject)

    private fun names(listing: Any) =
        (listing as JsonArray).map {
            it.jsonObject["name"]!!.jsonPrimitive.content to
                it.jsonObject["kind"]!!.jsonPrimitive.content
        }

    private fun refused(request: String): WizardError =
        try {
            ask(request)
            throw AssertionError("$request was answered")
        } catch (err: WizardError) {
            err
        }

    fun testReadsTheProjectsFolderUnlessAskedToChoose() {
        val picked = ask("""{"type":"pickFolder","id":1}""") as JsonObject
        assertEquals("app", picked["name"]!!.jsonPrimitive.content)
        assertEquals("false", picked["ignoredLeftOut"]!!.jsonPrimitive.content)
        assertEquals("app", host.openFolderName())
        assertEquals(0, answers.replaceAsked)
    }

    fun testIsCancelledWhenNoFolderIsChosen() {
        answers.folder = null
        assertEquals(CANCELLED, refused("""{"type":"pickFolder","id":1,"choose":true}""").name)
    }

    fun testListsWhatAListingHasNamedAndNothingElse() {
        refused("""{"type":"list","id":1,"path":""}""")
        ask("""{"type":"pickFolder","id":1}""")
        assertEquals(
            listOf("package.json" to "file", "src" to "directory"),
            names(ask("""{"type":"list","id":2,"path":""}""")).sortedBy {
                it.first
            },
        )
        assertEquals(listOf("cart.js" to "file"), names(ask("""{"type":"list","id":3,"path":"src"}""")))
        refused("""{"type":"list","id":4,"path":"../app"}""")
    }

    fun testReadsAFileOnlyOnceAListingHasNamedIt() {
        ask("""{"type":"pickFolder","id":1}""")
        refused("""{"type":"read","id":2,"path":"package.json"}""")
        ask("""{"type":"list","id":3,"path":""}""")
        assertEquals("{ \"name\": \"cart\" }", ask("""{"type":"read","id":4,"path":"package.json"}""").jsonPrimitive.content)
        assertEquals("{ \"name\"", ask("""{"type":"read","id":5,"path":"package.json","bytes":8}""").jsonPrimitive.content)
    }

    fun testRefusesAFileTooLargeToGiveWhole() {
        myFixture.addFileToProject("app/big.txt", "x".repeat(WIZARD_MAX_FILE_BYTES + 1))
        ask("""{"type":"pickFolder","id":1}""")
        ask("""{"type":"list","id":2,"path":""}""")
        refused("""{"type":"read","id":3,"path":"big.txt"}""")
        assertEquals(8, ask("""{"type":"read","id":4,"path":"big.txt","bytes":8}""").jsonPrimitive.content.length)
    }

    fun testWritesTheWorkflowFile() {
        assertEquals(
            "true",
            ask("""{"type":"saveWorkflow","id":1,"yaml":"on: push\n","fileName":"grill-my-code.yml"}""").jsonPrimitive.content,
        )
        assertEquals("on: push\n", String(root.findFileByRelativePath(WORKFLOW_FILE)!!.contentsToByteArray()))
        assertEquals(0, answers.replaceAsked)
    }

    fun testAsksBeforeReplacingOne() {
        ask("""{"type":"saveWorkflow","id":1,"yaml":"on: push\n","fileName":"grill-my-code.yml"}""")
        answers.replace = false
        assertEquals(
            "false",
            ask("""{"type":"saveWorkflow","id":2,"yaml":"on: workflow_dispatch\n","fileName":"grill-my-code.yml"}""").jsonPrimitive.content,
        )
        answers.replace = true
        assertEquals(
            "true",
            ask("""{"type":"saveWorkflow","id":3,"yaml":"on: workflow_dispatch\n","fileName":"grill-my-code.yml"}""").jsonPrimitive.content,
        )
        assertEquals(2, answers.replaceAsked)
        assertEquals(WORKFLOW_FILE, answers.replacePath)
        val file = root.findFileByRelativePath(WORKFLOW_FILE)!!
        assertEquals(
            "on: workflow_dispatch\n",
            com.intellij.openapi.fileEditor.FileDocumentManager
                .getInstance()
                .getDocument(file)!!
                .text,
        )
    }

    // A question set's workflow is a file of its own, beside the first.
    fun testWritesAQuestionSetsWorkflowUnderItsOwnName() {
        ask("""{"type":"saveWorkflow","id":1,"yaml":"on: push\n","fileName":"grill-my-code.yml"}""")
        val saved = ask("""{"type":"saveWorkflow","id":2,"yaml":"on: workflow_dispatch\n","fileName":"grill-my-code-lab-3.yml"}""")
        assertEquals("true", saved.jsonPrimitive.content)
        assertEquals(
            "on: workflow_dispatch\n",
            String(root.findFileByRelativePath(".github/workflows/grill-my-code-lab-3.yml")!!.contentsToByteArray()),
        )
        assertEquals("on: push\n", String(root.findFileByRelativePath(WORKFLOW_FILE)!!.contentsToByteArray()))
        assertEquals(0, answers.replaceAsked)
    }

    fun testRefusesWhatIsNotAWorkflow() {
        refused("""{"type":"saveWorkflow","id":1,"yaml":"  ","fileName":"grill-my-code.yml"}""")
        refused("""{"type":"saveWorkflow","id":2,"yaml":1,"fileName":"grill-my-code.yml"}""")
        for (name in listOf("", "ci.yml", "../grill-my-code.yml", "grill-my-code-Lab.yml")) {
            refused("""{"type":"saveWorkflow","id":3,"yaml":"on: push\n","fileName":"$name"}""")
        }
        refused("""{"type":"saveWorkflow","id":4,"yaml":"on: push\n"}""")
    }

    // Each colour the stylesheet reads from VS Code is one the page sets here.
    fun testGivesThePageEveryColourItsStylesheetReads() {
        val stylesheet = File(System.getProperty("gmc.repository"), "extensions/vscode/src/webview/wizard.css").readText()
        val read = Regex("""var\(--vscode-([a-zA-Z0-9-]+)""").findAll(stylesheet).map { it.groupValues[1] }.toSet()
        assertTrue(read.size > 10)
        assertEmpty(read - wizardThemeVariables().keys)
        assertTrue(wizardThemeCss().startsWith(":root { --vscode-foreground: #"))
    }
}
