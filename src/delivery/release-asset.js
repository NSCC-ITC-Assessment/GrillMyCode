/**
 * Delivery: PDF Release Asset
 *
 * Manages a rolling GitHub Release tagged `gmc-assessments` and uploads the
 * assessment PDF as a named asset. Each run replaces the existing asset for
 * the same filename so the download URL remains stable.
 *
 * Handles concurrent runs (GitHub Classroom can trigger multiple simultaneous
 * workflows in one repo) with get-after-create and delete-before-upload guards.
 */

import * as core from '@actions/core';

const RELEASE_TAG = 'gmc-assessments';
const RELEASE_NAME = 'GrillMyCode Assessments';
const RELEASE_BODY = 'Auto-managed by GrillMyCode.';

/**
 * Uploads a PDF Buffer as a release asset on the rolling `gmc-assessments`
 * release. Creates the release if it does not exist.
 *
 * Returns the stable `browser_download_url` for the uploaded asset.
 */
export async function uploadPdfAsset({ octokit, owner, repo, pdfBuffer, filename }) {
  const release = await getOrCreateRelease({ octokit, owner, repo });

  await deleteExistingAsset({ octokit, owner, repo, releaseId: release.id, filename });

  return uploadAsset({ octokit, uploadUrl: release.upload_url, pdfBuffer, filename });
}

async function getOrCreateRelease({ octokit, owner, repo }) {
  try {
    const { data } = await octokit.rest.repos.getReleaseByTag({
      owner,
      repo,
      tag: RELEASE_TAG,
    });
    return data;
  } catch (err) {
    if (err.status !== 404) throw err;
  }

  try {
    const { data } = await octokit.rest.repos.createRelease({
      owner,
      repo,
      tag_name: RELEASE_TAG,
      name: RELEASE_NAME,
      body: RELEASE_BODY,
      prerelease: true,
      make_latest: 'false',
    });
    core.info(`Created rolling release: ${RELEASE_TAG}`);
    return data;
  } catch (err) {
    if (err.status === 422) {
      // Concurrent run created it first — re-fetch.
      const { data } = await octokit.rest.repos.getReleaseByTag({
        owner,
        repo,
        tag: RELEASE_TAG,
      });
      return data;
    }
    throw err;
  }
}

async function deleteExistingAsset({ octokit, owner, repo, releaseId, filename }) {
  const { data: assets } = await octokit.rest.repos.listReleaseAssets({
    owner,
    repo,
    release_id: releaseId,
    per_page: 100,
  });
  const existing = assets.find((a) => a.name === filename);
  if (!existing) return;

  try {
    await octokit.rest.repos.deleteReleaseAsset({
      owner,
      repo,
      asset_id: existing.id,
    });
  } catch (err) {
    if (err.status !== 404) throw err;
    // 404 = concurrent run already deleted it — proceed.
  }
}

async function uploadAsset({ octokit, uploadUrl, pdfBuffer, filename }) {
  // Use the upload_url from the release directly — more reliable than constructing
  // from release_id, as Octokit's uploadReleaseAsset has known issues with
  // content-length when the URL is built indirectly.
  const { data } = await octokit.request(`POST ${uploadUrl}`, {
    name: filename,
    data: pdfBuffer,
    headers: {
      'content-type': 'application/pdf',
      'content-length': pdfBuffer.length,
    },
  });
  return data.browser_download_url;
}
