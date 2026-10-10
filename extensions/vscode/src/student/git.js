/**
 * Git state
 *
 * Reads the open folder's repository through VS Code's built-in Git
 * extension, so the extension never runs git itself.
 */

import * as vscode from 'vscode';
import { pickGitHubRemote } from '../shared/remote.js';

/** @import { GitRemote } from '../shared/remote.js' */

/**
 * The parts of the built-in Git extension's API this extension reads. VS Code
 * publishes no types for it.
 *
 * @typedef {object} GitApi
 * @property {GitRepository[]} repositories
 * @property {vscode.Event<GitRepository>} onDidOpenRepository
 * @property {vscode.Event<GitRepository>} onDidCloseRepository
 * @property {(uri: vscode.Uri) => GitRepository | null} getRepository
 */

/**
 * @typedef {object} GitRepository
 * @property {vscode.Uri} rootUri
 * @property {GitRepositoryState} state
 * @property {(paths: string[]) => Promise<Set<string>>} checkIgnore
 */

/**
 * @typedef {object} GitRepositoryState
 * @property {GitRemote[]} remotes
 * @property {{ name?: string, commit?: string }} [HEAD]
 * @property {{ uri: vscode.Uri }[]} workingTreeChanges
 * @property {{ uri: vscode.Uri }[]} indexChanges
 * @property {{ uri: vscode.Uri }[]} mergeChanges
 * @property {vscode.Event<void>} onDidChange
 */

/**
 * The repository the questions belong to, with the GitHub repository it is a
 * clone of.
 *
 * @typedef {{ repository: GitRepository, owner: string, repo: string }} Target
 */

/**
 * The built-in Git extension's API, or undefined when Git is unavailable or
 * switched off. VS Code switches it off in Restricted Mode, which is why Git is
 * not listed in package.json as an extension this one depends on: VS Code would
 * switch this extension off with it, and the view could not say why.
 *
 * @returns {Promise<GitApi | undefined>}
 */
export async function getGitApi() {
  const extension = vscode.extensions.getExtension('vscode.git');
  if (!extension) return undefined;
  try {
    const git = extension.isActive ? extension.exports : await extension.activate();
    return git.getAPI(1);
  } catch {
    return undefined; // getAPI throws when the user has disabled Git
  }
}

/**
 * The first open repository that has a GitHub remote, with that remote:
 * `{ repository, owner, repo }`, or undefined when there is none. A window
 * with several folders shows the questions for the first one that qualifies.
 *
 * @param {GitApi} api
 * @returns {Target | undefined}
 */
export function findGitHubRepository(api) {
  for (const repository of api.repositories) {
    const remote = pickGitHubRemote(repository.state.remotes);
    if (remote) return { repository, owner: remote.owner, repo: remote.repo };
  }
  return undefined;
}

/**
 * A URI's path relative to the repository root, with forward slashes, or undefined if outside it.
 *
 * @param {vscode.Uri} root
 * @param {vscode.Uri} uri
 */
function relativePath(root, uri) {
  const prefix = root.path.endsWith('/') ? root.path : `${root.path}/`;
  return uri.scheme === root.scheme && uri.path.startsWith(prefix)
    ? uri.path.slice(prefix.length)
    : undefined;
}

/**
 * Repository-relative paths of every file that differs from the commit the
 * folder is at: changes Git reports, staged or not, and editors with unsaved
 * edits.
 *
 * @param {GitRepository} repository
 */
export function changedFiles(repository) {
  const { workingTreeChanges, indexChanges, mergeChanges } = repository.state;
  const uris = [
    ...[...workingTreeChanges, ...indexChanges, ...mergeChanges].map((change) => change.uri),
    ...vscode.workspace.textDocuments.filter((doc) => doc.isDirty).map((doc) => doc.uri),
  ];
  return [
    ...new Set(
      uris
        .map((uri) => relativePath(repository.rootUri, uri))
        .filter(/** @returns {path is string} */ (path) => Boolean(path)),
    ),
  ];
}
