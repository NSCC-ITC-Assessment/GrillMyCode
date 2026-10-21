package org.grillmycode.companion.auth

import com.intellij.ide.BrowserUtil
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.ide.CopyPasteManager
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import com.intellij.util.io.HttpRequests
import org.grillmycode.companion.shared.GITHUB_API_URL
import org.grillmycode.companion.shared.GITHUB_API_VERSION
import java.awt.datatransfer.StringSelection
import java.io.IOException

/** The notification group plugin.xml declares. */
const val NOTIFICATION_GROUP = "GrillMyCode"

private val logger = Logger.getInstance("org.grillmycode.companion.auth")

/**
 * Signs the student in with GitHub's device flow: asks for a code, shows it,
 * copies it and opens GitHub, then waits for GitHub to answer, with a progress
 * dialog the student can cancel. Call on the event dispatch thread.
 */
fun signIn(project: Project?) {
    var code: DeviceCode? = null
    ProgressManager.getInstance().run(
        object : Task.Modal(project, "Connecting to GitHub", true) {
            override fun run(indicator: ProgressIndicator) {
                code = requestDeviceCode(::post)
            }

            override fun onSuccess() {
                code?.let { askToOpenGitHub(project, it) }
            }

            override fun onThrowable(error: Throwable) = failed(project, error)
        },
    )
}

private fun askToOpenGitHub(
    project: Project?,
    code: DeviceCode,
) {
    val answer =
        Messages.showOkCancelDialog(
            project,
            "Enter this code on GitHub to let GrillMyCode Companion read your repositories' questions:\n\n" +
                "${code.userCode}\n\nThe code is copied when GitHub opens.",
            "Sign In to GitHub",
            "Copy Code and Open GitHub",
            Messages.getCancelButton(),
            Messages.getInformationIcon(),
        )
    if (answer != Messages.OK) return
    CopyPasteManager.getInstance().setContents(StringSelection(code.userCode))
    BrowserUtil.browse(code.verificationUri)

    var account: Account? = null
    ProgressManager.getInstance().run(
        object : Task.Modal(project, "Waiting for GitHub", true) {
            override fun run(indicator: ProgressIndicator) {
                indicator.text = "Enter ${code.userCode} at ${code.verificationUri}"
                val token =
                    waitForToken(code, ::post, sleep = { millis ->
                        // In steps, so a cancel is seen within a moment.
                        val until = System.currentTimeMillis() + millis
                        while (System.currentTimeMillis() < until) {
                            indicator.checkCanceled()
                            Thread.sleep(minOf(200L, until - System.currentTimeMillis()).coerceAtLeast(0L))
                        }
                    })
                indicator.text = "Signing in"
                val login = parseLogin(get("$GITHUB_API_URL/user", token)) ?: throw SignInException("GitHub did not say who signed in.")
                Account(login, token).also {
                    GitHubAccount.save(it)
                    account = it
                }
            }

            override fun onSuccess() {
                account?.let { notify(project, "Signed in to GitHub as ${it.login}.", NotificationType.INFORMATION) }
            }

            override fun onThrowable(error: Throwable) = failed(project, error)
        },
    )
}

/** Forgets the stored account. GitHub keeps the app's authorization until the student revokes it there. */
fun signOut(project: Project?) {
    ProgressManager.getInstance().run(
        object : Task.Backgroundable(project, "Signing out of GitHub", false) {
            private var login: String? = null

            override fun run(indicator: ProgressIndicator) {
                login = GitHubAccount.load()?.login
                GitHubAccount.clear()
            }

            override fun onSuccess() {
                val text = login?.let { "Signed out of GitHub ($it)." } ?: "You were not signed in to GitHub."
                notify(project, text, NotificationType.INFORMATION)
            }
        },
    )
}

private fun failed(
    project: Project?,
    error: Throwable,
) {
    val text =
        when (error) {
            is SignInException -> error.message
            is IOException -> "Could not reach GitHub: ${error.message}"
            else -> {
                logger.warn("Sign-in failed", error)
                "Something went wrong: ${error.message}"
            }
        }
    notify(project, "Not signed in. $text", NotificationType.WARNING)
}

private fun notify(
    project: Project?,
    text: String,
    type: NotificationType,
) {
    NotificationGroupManager
        .getInstance()
        .getNotificationGroup(NOTIFICATION_GROUP)
        .createNotification(text, type)
        .notify(project)
}

/** POSTs a form to GitHub's sign-in endpoints, through the IDE's proxy settings. */
private fun post(
    url: String,
    form: String,
): String =
    HttpRequests
        .post(url, "application/x-www-form-urlencoded")
        .accept("application/json")
        .productNameAsUserAgent()
        .connect { request ->
            request.write(form)
            request.readString()
        }

/** GETs one REST API path with the token. */
private fun get(
    url: String,
    token: String,
): String =
    HttpRequests
        .request(url)
        .accept("application/vnd.github+json")
        .productNameAsUserAgent()
        .tuner { connection ->
            connection.setRequestProperty("Authorization", "Bearer $token")
            connection.setRequestProperty("X-GitHub-Api-Version", GITHUB_API_VERSION)
        }.readString()
