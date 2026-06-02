/**
 * Delivery: GitHub Issue
 *
 * Updates any existing open assessment issue for the same branch with the
 * latest report. If none exists, creates a new one.
 */

import * as core from '@actions/core';
import { GIT_SHA_SHORT_LENGTH, ISSUES_PER_PAGE } from '../constants.js';

// Zero-width space — rendered invisibly but breaks GitHub's auto-linking.
const ZWSP = '​';

/**
 * Breaks GitHub auto-links in a prose segment by inserting a zero-width space:
 *   - `@name` / `@org/team` notification mentions
 *   - `#123` issue / pull-request references
 *
 * The leading capture group (start-of-string or a non-word, non-backtick char)
 * ensures we only touch tokens that GitHub would actually link — e.g. it leaves
 * the `@` in an email address (`user@host`) alone — and never the inside of a
 * word. Operates on prose only; callers exclude code spans/blocks.
 */
function breakAutoLinks(segment) {
  return segment
    .replace(/(^|[^\w`])@(?=[A-Za-z0-9])/g, `$1@${ZWSP}`)
    .replace(/(^|[^\w`])#(?=\d)/g, `$1#${ZWSP}`);
}

/**
 * Neutralises @mentions and #references in AI-generated Markdown destined for a
 * GitHub Issue, so student-influenced output cannot ping arbitrary users/teams
 * or back-reference unrelated issues (notification spam / misleading links).
 *
 * Code is never auto-linked by GitHub, so fenced code blocks and inline code
 * spans are left untouched — preserving the assessment's code snippets exactly.
 */
export function neutraliseIssueAutoLinks(markdown) {
  // Split on fenced code blocks (odd indices); leave them verbatim.
  return markdown
    .split(/(```[\s\S]*?```)/g)
    .map((block, blockIdx) => {
      if (blockIdx % 2 === 1) return block;
      // Within prose, split out inline code spans (odd indices) and leave them.
      return block
        .split(/(`[^`]*`)/g)
        .map((seg, segIdx) => (segIdx % 2 === 1 ? seg : breakAutoLinks(seg)))
        .join('');
    })
    .join('');
}

export async function postIssue({ octokit, ctx, report, branchName, headSha, studentLogin }) {
  // Defang any @mentions / #refs the AI emitted before it reaches the issue.
  report = neutraliseIssueAutoLinks(report);

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
