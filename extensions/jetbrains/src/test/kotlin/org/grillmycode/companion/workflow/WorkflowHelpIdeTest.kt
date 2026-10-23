package org.grillmycode.companion.workflow

import com.intellij.codeInsight.daemon.impl.HighlightInfo
import com.intellij.codeInsight.lookup.Lookup
import com.intellij.lang.annotation.HighlightSeverity
import com.intellij.lang.documentation.ide.IdeDocumentationTargetProvider
import com.intellij.lang.documentation.psi.PsiElementDocumentationTarget
import com.intellij.platform.backend.documentation.DocumentationTarget
import com.intellij.testFramework.fixtures.BasePlatformTestCase

// The workflow help in a light IDE: what shared/ decides, as the editor shows
// it. What it decides is tested in shared/, on the cases both editors share.

private const val KEY = "api_key: \${{ secrets.OPENROUTER_API_KEY }}"

class WorkflowHelpIdeTest : BasePlatformTestCase() {
    /** Opens a workflow file whose GrillMyCode step has [inputs], with the caret where `<caret>` is. */
    private fun open(
        vararg inputs: String,
        path: String = ".github/workflows/assess.yml",
    ) {
        val marked =
            listOf(
                "on: push",
                "jobs:",
                "  assess:",
                "    runs-on: ubuntu-latest",
                "    steps:",
                "      - uses: NSCC-ITC-Assessment/GrillMyCode@v0",
                "        with:",
                *inputs.map { "          $it" }.toTypedArray(),
                "",
            ).joinToString("\n")
        val caret = marked.indexOf("<caret>")
        val file = myFixture.addFileToProject(path, marked.replace("<caret>", ""))
        myFixture.configureFromExistingVirtualFile(file.virtualFile)
        if (caret >= 0) myFixture.editor.caretModel.moveToOffset(caret)
    }

    private fun ours(): List<HighlightInfo> = myFixture.doHighlighting().filter { it.inspectionToolId == WorkflowInspection.SHORT_NAME }

    override fun setUp() {
        super.setUp()
        myFixture.enableInspections(WorkflowInspection::class.java)
    }

    fun testMarksAValueTheActionChanges() {
        open(KEY, "num_questions: 70")
        val info = ours().single()
        assertEquals(HighlightSeverity.WARNING, info.severity)
        assertEquals(
            "70",
            myFixture.editor.document.text
                .substring(info.startOffset, info.endOffset),
        )
        assertTrue(info.description, info.description.contains("so 50 is used"))
    }

    fun testMarksAnErrorAsOne() {
        open("num_questions: 10")
        val info = ours().single()
        assertEquals(HighlightSeverity.ERROR, info.severity)
        assertEquals(
            "with",
            myFixture.editor.document.text
                .substring(info.startOffset, info.endOffset),
        )
    }

    fun testShowsTheActionsWordsAsText() {
        open(KEY, "submission_tags: phase1", "tag_diff_base: earliest")
        val tooltip = ours().single().toolTip.orEmpty()
        assertTrue(tooltip, tooltip.contains("&lt;tag name&gt;"))
    }

    fun testLeavesOtherYamlFilesAlone() {
        open("num_questions: 70", path = "config/assess.yml")
        assertEmpty(ours())
    }

    fun testOffersAnInputsValuesInOrder() {
        open(KEY, "starter_code: <caret>")
        myFixture.completeBasic()
        assertEquals(listOf("none", "ignore", "context", "ask"), myFixture.lookupElementStrings)
    }

    fun testOffersInputsInTheOrderTheActionDeclaresThem() {
        open(KEY, "<caret>")
        myFixture.completeBasic()
        val offered = myFixture.lookupElementStrings.orEmpty()
        assertFalse(offered.contains("api_key: "))
        assertTrue(offered.indexOf("ai_model: ") < offered.indexOf("num_questions: "))
    }

    fun testReplacesTheWholeNameOfAnInputThatHasAValue() {
        open(KEY, "num_<caret>question: 5")
        myFixture.completeBasic()
        val item = myFixture.lookupElements!!.single { it.lookupString == "num_questions" }
        myFixture.lookup.currentItem = item
        myFixture.finishLookup(Lookup.NORMAL_SELECT_CHAR)
        assertTrue(
            myFixture.editor.document.text
                .contains("          num_questions: 5\n"),
        )
    }

    // Through what the hover and the completion popup ask, to the element the
    // documentation provider answers for.
    private fun described(targets: List<DocumentationTarget>): String {
        val element =
            targets
                .filterIsInstance<PsiElementDocumentationTarget>()
                .map { it.targetElement }
                .filterIsInstance<InputElement>()
                .single()
        return WorkflowDocumentation().generateDoc(element, null).orEmpty()
    }

    fun testDescribesTheInputUnderTheCaret() {
        open(KEY, "num_que<caret>stions: 5")
        val provider = IdeDocumentationTargetProvider.getInstance(project)
        val doc = described(provider.documentationTargets(myFixture.editor, myFixture.file, myFixture.caretOffset))
        assertTrue(doc, doc.contains("maximum 50"))
        assertTrue(doc, doc.contains("<code>20</code>"))
    }

    fun testDescribesAnInputOfferedInCompletion() {
        open(KEY, "<caret>")
        myFixture.completeBasic()
        val item = myFixture.lookupElements!!.single { it.lookupString == "starter_code: " }
        val provider = IdeDocumentationTargetProvider.getInstance(project)
        val doc = described(provider.documentationTargets(myFixture.editor, myFixture.file, item))
        assertTrue(doc, doc.contains("<code>none</code>, <code>ignore</code>"))
    }

    fun testIsOffWhenItsInspectionIs() {
        myFixture.disableInspections(WorkflowInspection())
        open("starter_code: <caret>")
        myFixture.completeBasic()
        // The YAML plugin may still offer its own.
        assertFalse(myFixture.lookupElementStrings.orEmpty().contains("ignore"))
        assertEmpty(ours())
    }
}
