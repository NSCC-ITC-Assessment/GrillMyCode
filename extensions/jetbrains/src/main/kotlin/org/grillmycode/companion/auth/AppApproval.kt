package org.grillmycode.companion.auth

// Organization approval
//
// An organization can restrict which OAuth apps may read its repositories, and
// GitHub turns that on for every new one. Until an owner approves the
// "GrillMyCode Companion" app, a token from this plugin cannot read a
// repository the organization owns, even one the account itself can open.
// Like DeviceFlow.kt, this imports nothing from the IDE.

/**
 * This app's page in the signed-in account's GitHub settings, where the
 * account can ask an organization's owners to approve it.
 */
const val GITHUB_APP_SETTINGS_URL = "https://github.com/settings/connections/applications/$GITHUB_CLIENT_ID"

/** Words in GitHub's refusal that name the restriction. */
private const val RESTRICTION_WORDS = "OAuth App access restrictions"

/**
 * Whether GitHub refused a request, answering [status] with [body], because
 * the organization that owns the repository has not approved this app.
 */
fun isRestrictedByOrganization(
    status: Int,
    body: String,
): Boolean = status == 403 && body.contains(RESTRICTION_WORDS, ignoreCase = true)
