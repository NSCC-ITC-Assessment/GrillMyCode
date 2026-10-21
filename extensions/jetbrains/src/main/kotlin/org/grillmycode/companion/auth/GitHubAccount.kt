package org.grillmycode.companion.auth

import com.intellij.credentialStore.CredentialAttributes
import com.intellij.credentialStore.Credentials
import com.intellij.credentialStore.generateServiceName
import com.intellij.ide.passwordSafe.PasswordSafe
import com.intellij.openapi.application.ApplicationManager
import com.intellij.util.messages.Topic

/** A signed-in GitHub account: the login, to show, and the token, to send. */
data class Account(
    val login: String,
    val token: String,
)

/**
 * The account the student signed in with, kept in the IDE's password safe (the
 * system keychain where there is one). One account for every project.
 *
 * The password safe may ask the keychain, which can be slow or ask the student
 * to unlock it, so call these off the event dispatch thread.
 */
object GitHubAccount {
    private val attributes = CredentialAttributes(generateServiceName("GrillMyCode", "GitHub"))

    fun load(): Account? {
        val credentials = PasswordSafe.instance.get(attributes) ?: return null
        val login = credentials.userName ?: return null
        val token = credentials.getPasswordAsString() ?: return null
        return Account(login, token)
    }

    fun save(account: Account) {
        PasswordSafe.instance.set(attributes, Credentials(account.login, account.token))
        changed()
    }

    fun clear() {
        PasswordSafe.instance.set(attributes, null)
        changed()
    }

    private fun changed() =
        ApplicationManager
            .getApplication()
            .messageBus
            .syncPublisher(AccountListener.TOPIC)
            .accountChanged()
}

/** Told when the student signs in or out, on the thread that did it. */
fun interface AccountListener {
    fun accountChanged()

    companion object {
        @Topic.AppLevel
        val TOPIC = Topic.create("GrillMyCode account", AccountListener::class.java)
    }
}
