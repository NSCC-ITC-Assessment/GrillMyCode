package org.grillmycode.companion.shared

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull

// Workflow Wizard, the parts that need no IDE
//
// The Wizard runs in a page of its own, which asks the plugin for what a page
// cannot do: reading a folder and writing the workflow file. This holds what
// the two sides agree on, the page's HTML, and the record of what the page has
// been shown, which is all it may ask for. A port of
// extensions/vscode/src/shared/wizard.js: the page's half is the VS Code
// extension's own, so the requests and answers are the same.
//
//   ready                          the Wizard is on screen
//   pickFolder   { choose }        → { name, ignoredLeftOut }: the folder to
//                                  read, and whether its listings leave out
//                                  what Git ignores
//   list         { path }          → [{ name, kind }]: what a folder holds
//   read         { path, bytes }   → the file's text, or its first `bytes` bytes
//   saveWorkflow { yaml }          → true once written, false if cancelled
//
// Every request but `ready` carries an `id`, and is answered with
// `{ id, ok: true, value }` or `{ id, ok: false, error: { name, message } }`.

val WIZARD_REQUESTS = listOf("ready", "pickFolder", "list", "read", "saveWorkflow")

/** What the plugin sends the page unasked: `{ type: 'folders', openFolder }`. */
const val FOLDERS_NOTICE = "folders"

/** The name of the error a request is refused with when the instructor cancels. */
const val CANCELLED = "AbortError"

/** The largest whole number JavaScript's Number.isSafeInteger allows. */
private const val MAX_SAFE_INTEGER = 9_007_199_254_740_991.0

/** True for a message shaped like a request from the page. Only `type` and `id` are checked. */
fun isWizardRequest(message: Any?): Boolean {
    if (message !is JsonObject) return false
    val type = (message["type"] as? JsonPrimitive)?.takeIf { it.isString }?.content ?: return false
    if (type !in WIZARD_REQUESTS) return false
    if (type == "ready") return true
    val id = (message["id"] as? JsonPrimitive)?.takeIf { !it.isString }?.doubleOrNull ?: return false
    return id == Math.floor(id) && Math.abs(id) <= MAX_SAFE_INTEGER
}

/** A path inside a folder, as the page names it: `src/app.js`. */
fun joinPath(
    folder: String,
    name: String,
) = if (folder.isEmpty()) name else "$folder/$name"

/** One thing a folder holds, as the IDE's file system describes it. */
data class FolderEntry(
    val name: String,
    val isFile: Boolean,
    val isFolder: Boolean,
    val isLink: Boolean,
)

/** One thing a folder holds, as the page is told it: `kind` is `file` or `directory`. */
data class ListedEntry(
    val name: String,
    val kind: String,
)

/**
 * What the page has been shown of the folder it is reading. The page may list
 * a folder, or read a file, only if an earlier listing named it, so no path it
 * sends is ever trusted: it is looked up here, never parsed.
 *
 * A link is listed as a file, which is what it is to Git, and is never read
 * or followed: what it points to may be outside the folder.
 */
class FolderRecord {
    private val folders = mutableSetOf("")
    private val files = mutableSetOf<String>()

    /**
     * Records what [folder] holds and returns it as the page is told it. An
     * entry that is neither a file, a folder nor a link, such as a socket, is
     * left out.
     */
    @Synchronized
    fun add(
        folder: String,
        entries: List<FolderEntry>,
    ): List<ListedEntry> =
        entries.mapNotNull { (name, isFile, isFolder, isLink) ->
            val path = joinPath(folder, name)
            when {
                isLink -> ListedEntry(name, "file")
                isFolder -> ListedEntry(name, "directory").also { folders += path }
                isFile -> ListedEntry(name, "file").also { files += path }
                else -> null
            }
        }

    /** True for the folder itself (""), and for a folder a listing named. */
    @Synchronized
    fun hasFolder(path: Any?) = path is String && path in folders

    /** True for a file a listing named, other than a link. */
    @Synchronized
    fun hasFile(path: Any?) = path is String && path in files
}

/** Text as an HTML attribute's value. */
private fun attribute(text: String) = text.replace("&", "&amp;").replace("\"", "&quot;").replace("<", "&lt;")

/** Code written into an element, which must not end it early. */
private fun inElement(
    code: String,
    tag: String,
) = code.replace(Regex("</($tag)", RegexOption.IGNORE_CASE), "<\\\\/$1")

/**
 * The page the Wizard runs in. Its content security policy lets it run the two
 * scripts written into it, by their nonce, apply the one stylesheet, show
 * images that are part of the script, and reach OpenRouter for the list of
 * models. Nothing else: no other script, frame or address.
 *
 * VS Code's page loads its script and stylesheet from the extension. Here they
 * are written into the page, which JCEF loads from a string. [bridge] runs
 * first: it gives the Wizard's own line to the editor (host.js) the one call it
 * makes of VS Code, acquireVsCodeApi, so that the page's half is the same.
 * [theme] is the IDE's colours, as the variables wizard.css reads.
 */
fun wizardPage(
    nonce: String,
    script: String,
    style: String,
    bridge: String,
    theme: String,
    light: Boolean,
    actionRef: String,
    docsBase: String,
): String {
    val policy =
        listOf(
            "default-src 'none'",
            "script-src 'nonce-$nonce'",
            "style-src 'nonce-$nonce'",
            "img-src data:",
            "connect-src $OPENROUTER_ORIGIN",
        ).joinToString("; ")
    val n = attribute(nonce)
    return """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${attribute(policy)}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style nonce="$n" id="theme">${inElement(theme, "style")}</style>
<style nonce="$n">${inElement(style, "style")}</style>
<title>Workflow Wizard</title>
</head>
<body class="${if (light) "vscode-light" else "vscode-dark"}">
<div id="root" data-action-ref="${attribute(actionRef)}" data-docs-base="${attribute(docsBase)}"></div>
<script nonce="$n">${inElement(bridge, "script")}</script>
<script nonce="$n">${inElement(script, "script")}</script>
</body>
</html>"""
}
