/**
 * Delivery: GitHub Issue
 *
 * Updates any existing open assessment issue for the same branch with the
 * latest report. If none exists, creates a new one.
 */

import * as core from '@actions/core';
import { GIT_SHA_SHORT_LENGTH, ISSUES_PER_PAGE } from '../constants.js';

export async function postIssue({ octokit, ctx, report, branchName, headSha, studentLogin }) {
  const shortHead = headSha.substring(0, GIT_SHA_SHORT_LENGTH);
  const branchPart = branchName ? ` (${branchName})` : '';
  const title = `GrillMyCode Questions${branchPart}`;
  const { owner, repo } = ctx.repo;

  // ── Find any existing open assessment issues for this branch ──────────────
  const searchStr = branchName ? `GrillMyCode Questions (${branchName})` : 'GrillMyCode';

  const existing = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    state: 'open',
    labels: 'assessment',
    per_page: ISSUES_PER_PAGE,
  });

  const predecessors = existing.data.filter((i) => i.title.startsWith(searchStr));

  // ── Update existing issue or create a new one ─────────────────────────────
  if (predecessors.length > 0) {
    const [target, ...extras] = predecessors;

    const { data: updated } = await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: target.number,
      title,
      body: report,
    });
    core.info(`Updated assessment Issue #${updated.number}: ${updated.html_url}`);

    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: updated.number,
      body: `> [!NOTE]\n> The assessment questions in this issue were regenerated at commit \`${shortHead}\` and the questions have been updated. Any previous questions have been replaced.`,
    });

    for (const extra of extras) {
      await octokit.graphql(
        `mutation($issueId: ID!) {
          deleteIssue(input: { issueId: $issueId }) {
            repository { id }
          }
        }`,
        { issueId: extra.node_id },
      );
      core.info(`Deleted duplicate assessment Issue #${extra.number}`);
    }

    return { number: updated.number, url: updated.html_url };
  } else {
    const { data: created } = await octokit.rest.issues.create({
      owner,
      repo,
      title,
      body: report,
      labels: ['assessment'],
      assignees: studentLogin ? [studentLogin] : [],
    });
    core.info(`Assessment created as Issue #${created.number}: ${created.html_url}`);

    try {
      await octokit.graphql(
        `mutation($issueId: ID!) {
          pinIssue(input: { issueId: $issueId }) {
            issue { title }
          }
        }`,
        { issueId: created.node_id },
      );
      core.info(`Pinned assessment Issue #${created.number}`);
    } catch (err) {
      core.warning(`Could not pin Issue #${created.number}: ${err.message}`);
    }

    return { number: created.number, url: created.html_url };
  }
}
