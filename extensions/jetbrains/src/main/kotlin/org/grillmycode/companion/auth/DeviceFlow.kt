package org.grillmycode.companion.auth

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.intOrNull
import java.net.URLEncoder

// GitHub sign-in
//
// GitHub's device flow, for the "GrillMyCode Companion" OAuth app: the plugin
// asks for a code, the student enters it at github.com/login/device, and the
// plugin asks GitHub every few seconds until it answers with a token. No
// client secret is involved, so the app's client ID is not one either.
// https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow
//
// VS Code signs in through the editor's own GitHub account, so this has no
// counterpart in extensions/vscode/. Nothing here needs a running IDE; the
// requests are passed in, so tests can answer them.

/** The OAuth app's client ID, from its settings page on GitHub. */
const val GITHUB_CLIENT_ID = "Ov23liUoE9chsGQrWYQR"

/**
 * The scope asked for, as GITHUB_SCOPES in extensions/vscode/src/shared/constants.js.
 * `repo` is the only scope that lets an OAuth token read issues in a private
 * repository.
 */
const val GITHUB_SCOPES = "repo"

const val GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code"
const val GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"

/** What GitHub calls the device flow's grant, in the token request. */
private const val DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code"

/** Seconds GitHub adds to the wait each time it answers `slow_down`. */
private const val SLOW_DOWN_SECONDS = 5

/** Sends a form to [url] and returns GitHub's JSON answer. */
typealias PostForm = (url: String, form: String) -> String

/** A sign-in that cannot go on, with a message to show the student. */
class SignInException(
    message: String,
) : Exception(message)

/** The code GitHub gave, and how to wait for the token. */
data class DeviceCode(
    val deviceCode: String,
    /** What the student types at [verificationUri], as `ABCD-1234`. */
    val userCode: String,
    val verificationUri: String,
    val expiresInSeconds: Int,
    val intervalSeconds: Int,
)

/** One answer to the token request. */
sealed interface TokenPoll {
    data class Granted(
        val token: String,
    ) : TokenPoll

    /** The student has not entered the code yet. */
    data object Pending : TokenPoll

    /** Asked too soon: wait this many seconds from now on. */
    data class SlowDown(
        val intervalSeconds: Int?,
    ) : TokenPoll

    data class Failed(
        val message: String,
    ) : TokenPoll
}

/** URL-encodes a form body. */
fun formBody(fields: Map<String, String>): String =
    fields.entries.joinToString("&") { (name, value) ->
        "${URLEncoder.encode(name, Charsets.UTF_8)}=${URLEncoder.encode(value, Charsets.UTF_8)}"
    }

private fun parseObject(json: String): JsonObject? = runCatching { Json.parseToJsonElement(json) as? JsonObject }.getOrNull()

private fun JsonObject.text(name: String): String? = (this[name] as? JsonPrimitive)?.takeIf { it.isString }?.content

private fun JsonObject.number(name: String): Int? = (this[name] as? JsonPrimitive)?.takeIf { !it.isString }?.intOrNull

/** What GitHub says went wrong, as it words it, ending in one full stop. */
private fun JsonObject.reason(): String = (text("error_description") ?: text("error") ?: "no reason given").trimEnd('.') + "."

/** Asks GitHub for a code to show the student. */
fun requestDeviceCode(post: PostForm): DeviceCode {
    val answer =
        parseObject(post(GITHUB_DEVICE_CODE_URL, formBody(mapOf("client_id" to GITHUB_CLIENT_ID, "scope" to GITHUB_SCOPES))))
            ?: throw SignInException("GitHub's answer could not be read.")
    return parseDeviceCode(answer)
        ?: throw SignInException("GitHub did not give a sign-in code: ${answer.reason()}")
}

private fun parseDeviceCode(answer: JsonObject): DeviceCode? =
    DeviceCode(
        deviceCode = answer.text("device_code") ?: return null,
        userCode = answer.text("user_code") ?: return null,
        verificationUri = answer.text("verification_uri") ?: return null,
        expiresInSeconds = answer.number("expires_in") ?: return null,
        intervalSeconds = answer.number("interval") ?: return null,
    )

/** Reads one answer to the token request. */
fun parseTokenPoll(json: String): TokenPoll {
    val answer = parseObject(json) ?: return TokenPoll.Failed("GitHub's answer could not be read.")
    answer.text("access_token")?.let { return TokenPoll.Granted(it) }
    return when (answer.text("error")) {
        "authorization_pending" -> TokenPoll.Pending
        "slow_down" -> TokenPoll.SlowDown(answer.number("interval"))
        "expired_token" -> TokenPoll.Failed("The code expired before it was entered. Sign in again.")
        "access_denied" -> TokenPoll.Failed("The sign-in was cancelled on GitHub.")
        else -> TokenPoll.Failed("GitHub refused the sign-in: ${answer.reason()}")
    }
}

/**
 * Asks GitHub for the token every [DeviceCode.intervalSeconds] until it gives
 * one, and returns it. Throws [SignInException] when GitHub refuses or the code
 * expires. [sleep] waits that many milliseconds; it is where the IDE stops the
 * wait when the student cancels.
 */
fun waitForToken(
    code: DeviceCode,
    post: PostForm,
    sleep: (Long) -> Unit,
    now: () -> Long = System::currentTimeMillis,
): String {
    val form =
        formBody(mapOf("client_id" to GITHUB_CLIENT_ID, "device_code" to code.deviceCode, "grant_type" to DEVICE_GRANT))
    val deadline = now() + code.expiresInSeconds * 1000L
    var interval = code.intervalSeconds
    while (true) {
        sleep(interval * 1000L)
        if (now() >= deadline) throw SignInException("The code expired before it was entered. Sign in again.")
        when (val poll = parseTokenPoll(post(GITHUB_TOKEN_URL, form))) {
            is TokenPoll.Granted -> return poll.token
            TokenPoll.Pending -> Unit
            is TokenPoll.SlowDown -> interval = poll.intervalSeconds ?: (interval + SLOW_DOWN_SECONDS)
            is TokenPoll.Failed -> throw SignInException(poll.message)
        }
    }
}

/** The login in a `GET /user` answer, or null if there is none. */
fun parseLogin(json: String): String? = parseObject(json)?.text("login")
