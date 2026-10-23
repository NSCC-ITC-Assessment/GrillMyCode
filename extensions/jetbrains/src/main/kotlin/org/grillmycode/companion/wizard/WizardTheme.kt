package org.grillmycode.companion.wizard

import com.intellij.openapi.editor.colors.EditorColorsManager
import com.intellij.ui.JBColor
import com.intellij.util.ui.JBUI
import com.intellij.util.ui.UIUtil
import java.awt.Color
import java.util.Locale

// The Workflow Wizard's colours
//
// The Wizard's stylesheet is the VS Code extension's
// (extensions/vscode/src/webview/wizard.css). It gives the docs site's theme
// variables VS Code's colours, which VS Code sets on its pages as
// `--vscode-*` variables. Here the page sets those variables itself, from the
// IDE's theme, so the same stylesheet follows whatever theme is in use.
//
// A variable wizard.css starts to use and this list lacks falls back to
// nothing. WizardHostTest fails when one is missing.

private fun css(color: Color) =
    if (color.alpha == 255) {
        "#%02x%02x%02x".format(color.red, color.green, color.blue)
    } else {
        // In every locale with a point, not a comma, as CSS reads it.
        "rgba(${color.red}, ${color.green}, ${color.blue}, ${"%.3f".format(Locale.ROOT, color.alpha / 255.0)})"
    }

/** A font's family as a CSS value, with what could end the value taken out. */
private fun family(
    name: String,
    fallback: String,
) = "\"${name.replace(Regex("""["\\;{}<>]"""), "")}\", $fallback"

/** The `--vscode-*` variables wizard.css reads, with the IDE's values. */
fun wizardThemeVariables(): Map<String, String> {
    val scheme = EditorColorsManager.getInstance().globalScheme
    val link = JBUI.CurrentTheme.Link.Foreground.ENABLED
    return linkedMapOf(
        "foreground" to css(UIUtil.getLabelForeground()),
        "descriptionForeground" to css(UIUtil.getContextHelpForeground()),
        "editor-background" to css(scheme.defaultBackground),
        "editorWidget-background" to css(UIUtil.getPanelBackground()),
        "input-background" to css(UIUtil.getTextFieldBackground()),
        "textCodeBlock-background" to css(scheme.defaultBackground),
        "textLink-foreground" to css(link),
        "button-background" to css(JBUI.CurrentTheme.Button.defaultButtonColorStart()),
        "button-hoverBackground" to css(JBUI.CurrentTheme.Button.defaultButtonColorEnd()),
        "button-foreground" to css(JBColor.namedColor("Button.default.foreground", JBColor.WHITE)),
        "errorForeground" to css(UIUtil.getErrorForeground()),
        "editorWarning-foreground" to css(JBColor.namedColor("Component.warningFocusColor", JBColor(0xE2A53A, 0xE2A53A))),
        "editorInfo-foreground" to css(link),
        "testing-iconPassed" to css(JBColor.namedColor("Label.successForeground", JBColor(0x2EA043, 0x5FB865))),
        "font-family" to family(UIUtil.getLabelFont().family, "system-ui, sans-serif"),
        "editor-font-family" to family(scheme.editorFontName, "monospace"),
    )
}

/** The variables as a stylesheet, for the page's theme element. */
fun wizardThemeCss(): String =
    wizardThemeVariables().entries.joinToString(" ", ":root { ", " }") { (name, value) -> "--vscode-$name: $value;" }
