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
export async function uploadPdfAsset({ octokit, owner, repo, pdfBuffer, filename, token }) {
  const release = await getOrCreateRelease({ octokit, owner, repo });

  await deleteExistingAsset({ octokit, owner, repo, releaseId: release.id, filename });

  return uploadAsset({ uploadUrl: release.upload_url, pdfBuffer, filename, token });
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

async function uploadAsset({ uploadUrl, pdfBuffer, filename, token }) {
  // Octokit serialises Buffer bodies as JSON, corrupting binary data.
  // Use global fetch (Node 18+) so the Buffer is sent as raw bytes.
  const url = uploadUrl.replace('{?name,label}', `?name=${encodeURIComponent(filename)}`);
  core.debug(`PDF upload: filename=${filename}, bytes=${pdfBuffer.length}, url=${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/pdf',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: pdfBuffer,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.browser_download_url;
}
