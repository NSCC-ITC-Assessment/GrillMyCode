/**
 * Questions controller
 *
 * Ties the student side together: finds the open folder's repository, signs
 * in, loads the questions issue, and keeps the list, the selected question and
 * the moved-code warning in step with the folder.
 *
 * What the Questions view shows when it has no questions is chosen by the
 * `grillmycode.state` context key (see viewsWelcome in package.json):
 *
 *   loading       working
 *   untrusted     the folder is in Restricted Mode, where VS Code switches Git off
 *   noRepository  no open folder is a clone of a GitHub repository
 *   signedOut     no GitHub session, or one GitHub no longer accepts
 *   noAccess      GitHub answered 404: no such repository for this account
 *   noIssue       the repository has no questions issue that reads as a report
 *   needsUpdate   the questions are in a layout newer than this extension reads
 *   error         anything else; the output channel has the details
 *   ready         questions are showing
 */

import * as vscode from 'vscode';
import { GITHUB_SCOPES } from '../shared/constants.js';
import { GitHubError, listLabelledIssues } from '../shared/github.js';
import { chooseIssue, describeGroup, findQuestionIssues } from '../shared/issues.js';
import { describeDrift, openableSnippets, questionFiles } from '../shared/questions.js';
import { parseReport } from '../shared/report.js';
import { changedFiles, findGitHubRepository, getGitApi } from './git.js';
import { Highlighter } from './highlighter.js';
import { QuestionView } from './question-view.js';
import { QuestionsTree } from './questions-tree.js';

/** How long the folder must be quiet before the warning is worked out again. */
const SETTLE_MS = 300;

export class QuestionsController {
  /** The state shown, as listed above. Read by test-host/. */
  state = 'loading';

  #context;
  #log = vscode.window.createOutputChannel('GrillMyCode', { log: true });
  #tree = new QuestionsTree();
  #treeView = vscode.window.createTreeView('grillmycode.questions', {
    treeDataProvider: this.#tree,
    showCollapseAll: true,
  });
  #questionView = new QuestionView();
  #highlighter = new Highlighter();
  #disposables = [this.#log, this.#treeView, this.#highlighter];

  #api;
  /** `{ repository, owner, repo }` for the folder the questions belong to. */
  #target;
  #targetListener;
  /** Listeners on repositories that have shown no GitHub remote so far. */
  #waiting = [];
  /** The branch the folder was on when the questions were loaded. */
  #branch;
  /** Every questions issue that reads as a report, each with its `report`. */
  #issues = [];
  /** The one showing. */
  #issue;
  /** Counts loads, so a slow one that has been overtaken can tell and stop. */
  #load = 0;
  #settle;

  constructor(context) {
    this.#context = context;
  }

  start() {
    const command = (name, run) => vscode.commands.registerCommand(`grillmycode.${name}`, run);
    this.#disposables.push(
      vscode.window.registerWebviewViewProvider('grillmycode.question', this.#questionView),
      command('refresh', () => this.load()),
      command('signIn', () => this.load({ signIn: true })),
      command('selectIssue', () => this.#selectIssue()),
      command('openIssue', () => this.#openIssue()),
      command('openQuestion', (node) => this.#openQuestion(node)),
      // Covers moving through the list with the keyboard, which runs no command.
      this.#treeView.onDidChangeSelection(({ selection: [node] }) => {
        if (node?.question) this.#questionView.show(node.question);
      }),
      vscode.authentication.onDidChangeSessions(({ provider }) => {
        if (provider.id === 'github') this.load();
      }),
      vscode.workspace.onDidChangeTextDocument(() => this.#folderChanged()),
      vscode.workspace.onDidSaveTextDocument(() => this.#folderChanged()),
      // Trusting the folder switches Git back on, a moment after the trust is granted.
      vscode.workspace.onDidGrantWorkspaceTrust(() => this.#loadSoon()),
      vscode.extensions.onDidChange(() => {
        if (!this.#api) this.#loadSoon();
      }),
    );
    return this.load();
  }

  /**
   * Loads the questions for the open folder. `signIn` asks the reader to sign
   * in when no session exists; without it the check is silent, so opening the
   * view never interrupts anyone.
   */
  async load({ signIn = false } = {}) {
    const load = ++this.#load;
    const overtaken = () => load !== this.#load;
    for (const listener of this.#waiting.splice(0)) listener.dispose();
    this.#setState('loading');

    if (!this.#api) {
      this.#api = await getGitApi();
      if (overtaken()) return;
      if (this.#api) {
        // Git finds repositories after the window opens, so look again as it does.
        this.#disposables.push(
          this.#api.onDidOpenRepository(() => this.#loadSoon()),
          this.#api.onDidCloseRepository(() => this.#loadSoon()),
        );
      }
    }
    if (!this.#api && !vscode.workspace.isTrusted) return this.#setState('untrusted');
    this.#watch(this.#api && findGitHubRepository(this.#api));
    if (!this.#target) {
      // Git lists a repository before it has read its remotes, so one with no
      // GitHub remote now may have one in a moment.
      this.#waiting = (this.#api?.repositories ?? []).map((repository) =>
        repository.state.onDidChange(() => this.#loadSoon()),
      );
      return this.#setState('noRepository');
    }

    let session;
    try {
      session = await vscode.authentication.getSession(
        'github',
        GITHUB_SCOPES,
        signIn ? { createIfNone: true } : { silent: true },
      );
    } catch (err) {
      this.#log.info(`Sign-in was not completed: ${err.message}`);
    }
    if (overtaken()) return;
    if (!session) return this.#setState('signedOut');

    const { owner, repo } = this.#target;
    let issues;
    try {
      issues = await listLabelledIssues({
        owner,
        repo,
        token: session.accessToken,
        fetch: globalThis.fetch,
      });
    } catch (err) {
      if (overtaken()) return;
      this.#log.error(`Could not read the issues of ${owner}/${repo}: ${err.message}`);
      const status = err instanceof GitHubError ? err.status : 0;
      return this.#setState(status === 401 ? 'signedOut' : status === 404 ? 'noAccess' : 'error');
    }
    if (overtaken()) return;
    this.showIssues(issues);
  }

  /**
   * Shows the questions from a repository's issues, as the GitHub REST API
   * lists them. Split from load() so test-host/ can supply issues without a
   * GitHub sign-in.
   */
  showIssues(issues) {
    if (!this.#target) return this.#setState('noRepository');
    this.#issues = findQuestionIssues(issues)
      .map((issue) => ({ ...issue, report: parseReport(issue.body) }))
      .filter((issue) => issue.report);
    vscode.commands.executeCommand(
      'setContext',
      'grillmycode.severalIssues',
      this.#issues.length > 1,
    );

    this.#branch = this.#target?.repository.state.HEAD?.name;
    this.#issue = chooseIssue(this.#issues, {
      branch: this.#branch,
      preferredTitle: this.#context.workspaceState.get(this.#preferenceKey()),
    });
    if (!this.#issue) return this.#setState('noIssue');
    if (this.#issue.report.needsUpdate) return this.#setState('needsUpdate');

    const { report, group } = this.#issue;
    this.#tree.show(this.#target.repository.rootUri, report.questions);
    this.#treeView.description = `${describeGroup(group)} · ${report.headSha}`;
    this.#questionView.show(undefined);
    this.#highlighter.clear();
    this.#setState('ready');
    this.#updateWarning();
  }

  dispose() {
    clearTimeout(this.#settle);
    this.#targetListener?.dispose();
    for (const listener of this.#waiting) listener.dispose();
    for (const disposable of this.#disposables) disposable.dispose();
  }

  #setState(state) {
    this.state = state;
    vscode.commands.executeCommand('setContext', 'grillmycode.state', state);
    if (state !== 'ready') {
      this.#issue = undefined;
      this.#tree.clear();
      this.#treeView.description = undefined;
      // A message hides the welcome text that explains the state.
      this.#treeView.message = undefined;
      this.#questionView.show(undefined);
      this.#highlighter.clear();
    }
  }

  /** Follows the repository the questions belong to, for commits, checkouts and edits. */
  #watch(target) {
    if (target?.repository === this.#target?.repository) {
      this.#target = target;
      return;
    }
    this.#targetListener?.dispose();
    this.#target = target;
    this.#targetListener = target?.repository.state.onDidChange(() => this.#folderChanged());
  }

  /** Loads again once the repositories have stopped changing. */
  #loadSoon() {
    clearTimeout(this.#settle);
    this.#settle = setTimeout(() => this.load(), SETTLE_MS);
  }

  /** Something about the folder changed. Waits for it to settle, then catches up. */
  #folderChanged() {
    clearTimeout(this.#settle);
    this.#settle = setTimeout(() => {
      if (!this.#target) return;
      // Another branch has questions of its own, so a checkout loads again.
      if (this.#target.repository.state.HEAD?.name !== this.#branch) this.load();
      else this.#updateWarning();
    }, SETTLE_MS);
  }

  /** Says, above the list, when the highlighted lines may not be the ones asked about. */
  #updateWarning() {
    if (this.state !== 'ready') return;
    const { report } = this.#issue;
    const { repository } = this.#target;
    const notes = [
      describeDrift({
        headSha: report.headCommit ?? report.headSha,
        folderCommit: repository.state.HEAD?.commit,
        changedFiles: changedFiles(repository),
        files: questionFiles(report.questions),
      }),
      report.truncated
        ? 'This report was too long to show in full, so its last questions are missing here. The PDF linked from the issue has them all.'
        : '',
    ];
    this.#treeView.message = notes.filter(Boolean).join(' ') || undefined;
  }

  async #openQuestion(node) {
    if (!node?.question || !this.#target) return;
    this.#questionView.show(node.question);
    const snippet = node.snippet ?? openableSnippets(node.question)[0];
    if (snippet) await this.#highlighter.show(this.#target.repository.rootUri, snippet);
  }

  /** Workspace-state key for the questions chosen by hand for this repository. */
  #preferenceKey() {
    return `issueTitle:${this.#target?.owner}/${this.#target?.repo}`;
  }

  async #selectIssue() {
    if (this.#issues.length === 0) return;
    const follow = {
      label: '$(git-branch) Follow the checked-out branch',
      detail: 'Show the questions for whichever branch this folder is on.',
    };
    const picked = await vscode.window.showQuickPick(
      [
        follow,
        ...this.#issues.map((issue) => ({
          label: describeGroup(issue.group),
          description: `#${issue.number}${issue === this.#issue ? ' · showing' : ''}`,
          detail: issue.report.needsUpdate
            ? 'Needs a newer version of GrillMyCode Companion'
            : `${issue.report.questions.length} questions · commit ${issue.report.headSha}`,
          issue,
        })),
      ],
      { title: 'GrillMyCode', placeHolder: 'Choose which questions to show' },
    );
    if (!picked) return;
    await this.#context.workspaceState.update(this.#preferenceKey(), picked.issue?.title);
    this.load();
  }

  #openIssue() {
    // The address comes from GitHub's API, but is checked all the same.
    const url = this.#issue?.url ?? '';
    if (url.startsWith('https://github.com/')) vscode.env.openExternal(vscode.Uri.parse(url));
  }
}
