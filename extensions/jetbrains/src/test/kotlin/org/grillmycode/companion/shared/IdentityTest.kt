package org.grillmycode.companion.shared

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

// A port of extensions/vscode/test/identity.test.js.

class IdentityTest {
    @Test
    fun `matchSubmissionIdentity names the student whose login ends the repository name`() {
        assertEquals(
            SubmissionIdentity("cs-principles-lab-3", "jsmith", "jsmith"),
            matchSubmissionIdentity("cs-principles-lab-3-jsmith", listOf("jsmith")),
        )
    }

    @Test
    fun `matchSubmissionIdentity reads a team repository when no collaborator matches`() {
        assertEquals(
            SubmissionIdentity("cs-principles-lab-3", "group-2", ""),
            matchSubmissionIdentity("cs-principles-lab-3-group-2", listOf("jsmith")),
        )
    }

    @Test
    fun `matchSubmissionIdentity gives a reason when the name follows no rule, or two collaborators fit`() {
        assertTrue(matchSubmissionIdentity("scratch", listOf("jsmith")) is IdentityError)
        assertTrue(matchSubmissionIdentity("lab-3-a-jsmith", listOf("jsmith", "a-jsmith")) is IdentityError)
    }

    @Test
    fun `ownSubmissionIdentity is the identity of a repository named for the account's login`() {
        assertEquals(
            SubmissionIdentity("cs-principles-lab-3", "JSmith", "JSmith"),
            ownSubmissionIdentity("cs-principles-lab-3-jsmith", "JSmith"),
        )
    }

    @Test
    fun `ownSubmissionIdentity is null for anyone else's repository`() {
        assertNull(ownSubmissionIdentity("cs-principles-lab-3-jsmith", "instructor"))
        // The login has to follow a hyphen, and cannot be the whole name.
        assertNull(ownSubmissionIdentity("cs-principles-lab-3-jsmith", "smith"))
        assertNull(ownSubmissionIdentity("jsmith", "jsmith"))
    }

    @Test
    fun `ownSubmissionIdentity is null for a team repository, which is no one account's`() {
        assertNull(ownSubmissionIdentity("cs-principles-lab-3-group-2", "jsmith"))
    }

    @Test
    fun `ownSubmissionIdentity is null with no login`() {
        assertNull(ownSubmissionIdentity("cs-principles-lab-3-jsmith", ""))
        assertNull(ownSubmissionIdentity("cs-principles-lab-3-jsmith", null))
    }

    @Test
    fun `tagGroupSlug turns a tag pattern into a folder name`() {
        assertEquals("submit", tagGroupSlug("submit/*"))
        assertEquals("milestone-1-v", tagGroupSlug("milestone-1/v*"))
    }

    @Test
    fun `tagGroupSlug falls back when nothing of the pattern can be kept`() {
        assertEquals("tag", tagGroupSlug("*"))
    }
}
