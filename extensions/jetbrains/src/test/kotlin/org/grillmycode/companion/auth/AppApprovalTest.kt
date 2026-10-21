package org.grillmycode.companion.auth

import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class AppApprovalTest {
    /** GitHub's refusal when an organization has not approved the app. */
    private val restricted =
        """{"message":"Although you appear to have the correct authorization credentials, the `my-school` organization """ +
            """has enabled OAuth App access restrictions, meaning that data access to third-parties is limited. For more """ +
            """information on these restrictions, including how to enable this app, visit """ +
            """https://docs.github.com/articles/restricting-access-to-your-organization-s-data/","documentation_url":""" +
            """"https://docs.github.com/rest/issues/issues#list-repository-issues","status":"403"}"""

    @Test
    fun `reads the restriction from a 403`() {
        assertTrue(isRestrictedByOrganization(403, restricted))
    }

    @Test
    fun `leaves other refusals alone`() {
        assertFalse(isRestrictedByOrganization(403, """{"message":"Resource not accessible by integration"}"""))
        assertFalse(isRestrictedByOrganization(404, """{"message":"Not Found"}"""))
        assertFalse(isRestrictedByOrganization(403, ""))
    }

    @Test
    fun `needs the 403 as well as the words`() {
        assertFalse(isRestrictedByOrganization(404, restricted))
    }

    @Test
    fun `points at this app's settings page`() {
        assertTrue(GITHUB_APP_SETTINGS_URL.endsWith("/$GITHUB_CLIENT_ID"))
    }
}
