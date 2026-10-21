package org.grillmycode.companion.auth

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class DeviceFlowTest {
    private val code =
        DeviceCode(
            deviceCode = "dev-123",
            userCode = "ABCD-1234",
            verificationUri = "https://github.com/login/device",
            expiresInSeconds = 900,
            intervalSeconds = 5,
        )

    /** Answers each request with the next of [answers], and records what was sent. */
    private class FakeGitHub(
        vararg answers: String,
    ) {
        private val queue = ArrayDeque(answers.toList())
        val sent = mutableListOf<Pair<String, String>>()

        fun post(
            url: String,
            form: String,
        ): String {
            sent += url to form
            return queue.removeFirst()
        }
    }

    /** A clock that moves only when the flow sleeps. */
    private class FakeClock {
        var millis = 0L
        val sleeps = mutableListOf<Long>()

        fun sleep(duration: Long) {
            sleeps += duration
            millis += duration
        }
    }

    private fun wait(
        github: FakeGitHub,
        clock: FakeClock = FakeClock(),
        deviceCode: DeviceCode = code,
    ) = waitForToken(deviceCode, github::post, clock::sleep, clock::millis)

    @Test
    fun `asks for a code with the app's client ID and the repo scope`() {
        val github =
            FakeGitHub(
                """{"device_code":"dev-123","user_code":"ABCD-1234","verification_uri":"https://github.com/login/device","expires_in":900,"interval":5}""",
            )
        assertEquals(code, requestDeviceCode(github::post))
        assertEquals(GITHUB_DEVICE_CODE_URL to "client_id=$GITHUB_CLIENT_ID&scope=repo", github.sent.single())
    }

    @Test
    fun `a refused code request says why`() {
        val github =
            FakeGitHub("""{"error":"device_flow_disabled","error_description":"Device Flow must be explicitly enabled for this App"}""")
        val error = assertThrows<SignInException> { requestDeviceCode(github::post) }
        assertEquals("GitHub did not give a sign-in code: Device Flow must be explicitly enabled for this App.", error.message)
    }

    @Test
    fun `an unreadable code request fails`() {
        assertThrows<SignInException> { requestDeviceCode(FakeGitHub("<html>")::post) }
    }

    @Test
    fun `waits the interval, then returns the token once it is granted`() {
        val github =
            FakeGitHub(
                """{"error":"authorization_pending"}""",
                """{"access_token":"gho_abc","token_type":"bearer","scope":"repo"}""",
            )
        val clock = FakeClock()
        assertEquals("gho_abc", wait(github, clock))
        assertEquals(listOf(5000L, 5000L), clock.sleeps)
        assertEquals(
            GITHUB_TOKEN_URL to
                "client_id=$GITHUB_CLIENT_ID&device_code=dev-123&grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code",
            github.sent.first(),
        )
    }

    @Test
    fun `slow_down uses the interval GitHub gives`() {
        val github = FakeGitHub("""{"error":"slow_down","interval":10}""", """{"access_token":"gho_abc"}""")
        val clock = FakeClock()
        wait(github, clock)
        assertEquals(listOf(5000L, 10000L), clock.sleeps)
    }

    @Test
    fun `slow_down without an interval adds five seconds`() {
        val github = FakeGitHub("""{"error":"slow_down"}""", """{"error":"slow_down"}""", """{"access_token":"gho_abc"}""")
        val clock = FakeClock()
        wait(github, clock)
        assertEquals(listOf(5000L, 10000L, 15000L), clock.sleeps)
    }

    @Test
    fun `a cancelled sign-in on GitHub fails`() {
        val error = assertThrows<SignInException> { wait(FakeGitHub("""{"error":"access_denied"}""")) }
        assertEquals("The sign-in was cancelled on GitHub.", error.message)
    }

    @Test
    fun `GitHub's expired_token fails`() {
        val error = assertThrows<SignInException> { wait(FakeGitHub("""{"error":"expired_token"}""")) }
        assertTrue(error.message!!.startsWith("The code expired"))
    }

    @Test
    fun `stops asking once the code has expired`() {
        val github = FakeGitHub("""{"error":"authorization_pending"}""", """{"error":"authorization_pending"}""")
        val error = assertThrows<SignInException> { wait(github, deviceCode = code.copy(expiresInSeconds = 12)) }
        assertTrue(error.message!!.startsWith("The code expired"))
        assertEquals(2, github.sent.size)
    }

    @Test
    fun `any other error is passed on in GitHub's words`() {
        val error =
            assertThrows<SignInException> {
                wait(FakeGitHub("""{"error":"incorrect_client_credentials","error_description":"The client_id is not valid."}"""))
            }
        assertEquals("GitHub refused the sign-in: The client_id is not valid.", error.message)
    }

    @Test
    fun `reads the login from GET user`() {
        assertEquals("jsmith", parseLogin("""{"login":"jsmith","id":1}"""))
        assertNull(parseLogin("""{"message":"Bad credentials"}"""))
        assertNull(parseLogin("not json"))
    }
}
