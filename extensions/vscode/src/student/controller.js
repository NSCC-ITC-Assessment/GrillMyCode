/**
 * Questions controller
 *
 * Ties the views together: finds the open folder's repository, signs in,
 * loads the questions issue, and keeps the list, the selected question and the
 * moved-code warning in step with the folder.
 *
 * It also looks for the repository's answer key (instructor/answer-key.js). An
 * account that can read it gets the instructor view, which lists the key's
 * questions with their answers, and a switch between the two views. An account
 * that cannot gets the student view alone, built from the issue as before,
 * with nothing to show that another view exists.
 *
 * While the window has the focus it asks GitHub now and then whether a set of
 * questions has arrived since the last load (#check). The first set is loaded
 * at once, since the list is empty. A set that replaces the one showing is
 * announced and left on GitHub until the reader asks for it, so the list never
 * changes under someone who is reading it.
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
 *
 * Two more keys follow the answer key: `grillmycode.answerKey` is true while
 * one is readable, and `grillmycode.view` is `student` or `instructor`.
 * `grillmycode.hasIssue` is true while the questions showing have an issue.
 */

import * as vscode from 'vscode';
import {
  GITHUB_SCOPES,
  NEW_QUESTIONS_CHECK_MS,
  NEW_QUESTIONS_FOCUS_GAP_MS,
} from '../shared/constants.js';
import { GitHubError, listLabelledIssues } from '../shared/github.js';
import { chooseIssue, describeGroup, findQuestionIssues, whatArrived } from '../shared/issues.js';
import {
  adjacentQuestion,
  describeDrift,
  openableSnippets,
  questionFiles,
} from '../shared/questions.js';
import { parseReport } from '../shared/report.js';
import { findAnswerKey, matchesReport } from '../instructor/answer-key.js';
import { instructorQuestionToHtml } from '../instructor/html.js';
import { questionToHtml } from '../shared/html.js';
import { changedFiles, findGitHubRepository, getGitApi } from './git.js';
import { Highlighter } from './highlighter.js';
import { QuestionView } from './question-view.js';
import { QuestionsTree } from './questions-tree.js';

/** @import { AnswerKey } from '../instructor/answer-key.js' */
/** @import { GitHubIssue } from '../shared/github.js' */
/** @import { QuestionIssue } from '../shared/issues.js' */
/** @import { NewerReport, Report } from '../shared/report.js' */
/** @import { GitApi, Target } from './git.js' */
/** @import { TreeNode } from './questions-tree.js' */

/**
 * A questions issue that reads as a report, with the report.
 *
 * @typedef {QuestionIssue & { report: Report | NewerReport }} LoadedIssue
 */

/** @typedef {'student' | 'instructor'} View */

/** How long the folder must be quiet before the warning is worked out again. */
const SETTLE_MS = 300;

/**
 * The states in which a set of questions can arrive: the repository has been
 * read with the account signed in, and may since have been given other issues.
 */
const WATCHED_STATES = new Set(['noIssue', 'needsUpdate', 'ready']);

/** Shown on the GrillMyCode icon while there are questions the reader has not seen. */
const NEW_QUESTIONS_BADGE = { value: 1, tooltip: 'New questions' };

/**
 * Keeps the questions issues among a repository's issues, as the GitHub REST
 * API lists them, each with its report.
 *
 * @param {GitHubIssue[]} issues
 * @returns {LoadedIssue[]}
 */
function readReports(issues) {
  return findQuestionIssues(issues)
    .map((issue) => ({ ...issue, report: parseReport(issue.body) }))
    .filter(/** @returns {issue is LoadedIssue} */ (issue) => Boolean(issue.report));
}

export class QuestionsController {
  /** The state shown, as listed above. Read by test-host/. */
  state = 'loading';
  /**
   * The view showing, `student` or `instructor`. Read by test-host/.
   *
   * @type {View}
   */
  view = 'student';

  #context;
  #log = vscode.window.createOutputChannel('GrillMyCode', { log: true });
  #tree = new QuestionsTree();
  #treeView = vscode.window.createTreeView('grillmycode.questions', {
    treeDataProvider: this.#tree,
    showCollapseAll: true,
  });
  #questionView = new QuestionView();
  #highlighter = new Highlighter();
  /** @type {vscode.Disposable[]} */
  #disposables = [this.#log, this.#treeView, this.#highlighter];

  /** @type {GitApi | undefined} */
  #api;
  /**
   * `{ repository, owner, repo }` for the folder the questions belong to.
   *
   * @type {Target | undefined}
   */
  #target;
  /** @type {vscode.Disposable | undefined} */
  #targetListener;
  /**
   * Listeners on repositories that have shown no GitHub remote so far.
   *
   * @type {vscode.Disposable[]}
   */
  #waiting = [];
  /**
   * The branch the folder was on when the questions were loaded.
   *
   * @type {string | undefined}
   */
  #branch;
  /**
   * Every questions issue that reads as a report, each with its `report`.
   *
   * @type {LoadedIssue[]}
   */
  #issues = [];
  /**
   * The one showing, or behind the answer key that is.
   *
   * @type {LoadedIssue | undefined}
   */
  #issue;
  /**
   * The answer key for those questions, as findAnswerKey returns it, when the
   * signed-in account can read it.
   *
   * @type {AnswerKey | undefined}
   */
  #key;
  /**
   * A set of questions GitHub has in place of the one showing: found by a
   * check, and left there until the reader asks for it.
   *
   * @type {LoadedIssue | undefined}
   */
  #arrived;
  /** Counts loads, so a slow one that has been overtaken can tell and stop. */
  #load = 0;
  /** True while a check for new questions is waiting on GitHub. */
  #checking = false;
  /** When the last check started, as Date.now() gives it. */
  #checked = 0;
  /**
   * The pending load, and the pending look at what changed in the folder.
   *
   * @type {ReturnType<typeof setTimeout> | undefined}
   */
  #reload;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #settle;

  /** @param {vscode.ExtensionContext} context */
  constructor(context) {
    this.#context = context;
  }

  start() {
    /**
     * @param {string} name
     * @param {(...args: any[]) => unknown} run
     */
    const command = (name, run) => vscode.commands.registerCommand(`grillmycode.${name}`, run);
    this.#disposables.push(
      vscode.window.registerWebviewViewProvider('grillmycode.question', this.#questionView),
      command('refresh', () => this.load()),
      command('signIn', () => this.load({ signIn: true })),
      command('selectIssue', () => this.#selectIssue()),
      command('openIssue', () => this.#openIssue()),
      command('openQuestion', (node) => this.#openQuestion(node)),
      command('nextQuestion', () => this.#stepQuestion(1)),
      command('previousQuestion', () => this.#stepQuestion(-1)),
      command('showInstructorView', () => this.#switchView('instructor')),
      command('showStudentView', () => this.#switchView('student')),
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
      // Someone coming back from watching the run on GitHub should not wait
      // for the timer.
      vscode.window.onDidChangeWindowState(({ focused }) => {
        if (focused && Date.now() - this.#checked >= NEW_QUESTIONS_FOCUS_GAP_MS) this.#check();
      }),
      // Questions loaded on their own count as seen once the list is looked at.
      this.#treeView.onDidChangeVisibility(({ visible }) => {
        if (visible && !this.#arrived) this.#treeView.badge = undefined;
      }),
    );
    const timer = setInterval(() => this.#check(), NEW_QUESTIONS_CHECK_MS);
    this.#disposables.push({ dispose: () => clearInterval(timer) });
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
    this.#issues = [];
    this.#key = undefined;
    this.#setArrived(undefined);
    this.#setView('student');
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
    this.#readIssues(issues);

    // The key is looked for before anything is shown, so an instructor's list
    // does not open on the student's questions and then change.
    const found = await findAnswerKey({
      owner,
      repo,
      login: session.account.label,
      group: this.#chooseIssue()?.group,
      token: session.accessToken,
      fetch: globalThis.fetch,
    });
    if (overtaken()) return;
    // At debug level: for a student there is never one, and that is no fault.
    if (found.reason) this.#log.debug(`No answer key for ${owner}/${repo}: ${found.reason}`);
    this.#key = found.reason === undefined ? found : undefined;
    this.#show();
  }

  /**
   * Shows the questions from a repository's issues, as the GitHub REST API
   * lists them, and from its answer key, as findAnswerKey returns it, for an
   * account that can read one. Split from load() so test-host/ can supply both
   * without a GitHub sign-in.
   *
   * @param {GitHubIssue[]} issues
   * @param {AnswerKey} [key]
   */
  showIssues(issues, key) {
    if (!this.#target) return this.#setState('noRepository');
    this.#setArrived(undefined);
    this.#readIssues(issues);
    this.#key = key;
    this.#show();
  }

  /**
   * Asks GitHub whether a set of questions has arrived since the last load.
   * Nothing is asked while the window is in the background, or in a state
   * where the repository could not be read in the first place.
   *
   * A check that fails says nothing: the next one asks again, and Refresh
   * Questions is there to report a fault.
   */
  async #check() {
    const target = this.#target;
    if (this.#checking || !target || !WATCHED_STATES.has(this.state)) return;
    if (!vscode.window.state.focused) return;
    this.#checking = true;
    this.#checked = Date.now();
    const load = this.#load;
    const { owner, repo } = target;
    try {
      const session = await vscode.authentication.getSession('github', GITHUB_SCOPES, {
        silent: true,
      });
      if (!session) return;
      const issues = await listLabelledIssues({
        owner,
        repo,
        token: session.accessToken,
        fetch: globalThis.fetch,
      });
      // A load that started meanwhile has read the same issues, or newer ones.
      if (load === this.#load) await this.noticeIssues(issues);
    } catch (err) {
      this.#log.debug(`Could not check ${owner}/${repo} for new questions: ${err.message}`);
    } finally {
      this.#checking = false;
    }
  }

  /**
   * Compares a repository's issues, as the GitHub REST API lists them now,
   * with the ones loaded, and acts on a set of questions that has arrived
   * since. With no questions in the list it loads them and says they are
   * there. With some, it leaves the list as it is and says a newer set can be
   * shown. Returns what whatArrived found. Split from #check() so test-host/
   * can supply the issues.
   *
   * @param {GitHubIssue[]} issues
   */
  async noticeIssues(issues) {
    const options = {
      branch: this.#branch,
      preferredTitle: this.#context.workspaceState.get(this.#preferenceKey()),
    };
    const latest = chooseIssue(readReports(issues), options);
    const arrival = whatArrived(this.#chooseIssue(), latest);
    if (!latest || !arrival) return arrival;

    if (this.state !== 'ready') {
      await this.load();
      // Still nothing to show when, say, the set is in a layout this version cannot read.
      if (this.state !== 'ready') return arrival;
      if (!this.#treeView.visible) this.#treeView.badge = NEW_QUESTIONS_BADGE;
      this.#announce('GrillMyCode questions have arrived for this repository.', 'Show Questions');
      return arrival;
    }

    // Said once for each set, however many checks find it.
    if (!whatArrived(this.#arrived, latest)) return arrival;
    this.#setArrived(latest);
    this.#announce(
      'A newer set of GrillMyCode questions has arrived for this repository.',
      'Show New Questions',
      () => this.load(),
    );
    return arrival;
  }

  /**
   * Says, in a notification, that questions have arrived. Its button shows the
   * Questions view, after `before` when that is given. Nothing waits on the
   * notification, which may be left open or closed unanswered.
   *
   * @param {string} message
   * @param {string} button
   * @param {() => unknown} [before]
   */
  #announce(message, button, before) {
    vscode.window.showInformationMessage(message, button).then(async (chosen) => {
      if (chosen !== button) return;
      await before?.();
      vscode.commands.executeCommand('grillmycode.questions.focus');
    });
  }

  /**
   * Records the newer set a check found, or with undefined that there is none
   * any more, and shows or clears the signs of it: the badge on the icon and
   * the note above the list.
   *
   * @param {LoadedIssue | undefined} issue
   */
  #setArrived(issue) {
    this.#arrived = issue;
    this.#treeView.badge = issue ? NEW_QUESTIONS_BADGE : undefined;
    this.#updateWarning();
  }

  /**
   * Keeps the questions issues among a repository's issues, each with its report.
   *
   * @param {GitHubIssue[]} issues
   */
  #readIssues(issues) {
    this.#issues = readReports(issues);
    vscode.commands.executeCommand(
      'setContext',
      'grillmycode.severalIssues',
      this.#issues.length > 1,
    );
    this.#branch = this.#target?.repository.state.HEAD?.name;
  }

  #chooseIssue() {
    return chooseIssue(this.#issues, {
      branch: this.#branch,
      preferredTitle: this.#context.workspaceState.get(this.#preferenceKey()),
    });
  }

  /**
   * Shows what was loaded, in the view this account gets. With no answer key
   * that is the student view. With one it is the view last chosen by hand for
   * this repository, or else the student view in the account's own repository
   * and the instructor view in anyone else's.
   */
  #show() {
    const issue = this.#chooseIssue();
    const key = this.#key;
    const chosen = this.#context.workspaceState.get(this.#viewKey());
    this.#setView(key ? (chosen ?? (key.own ? 'student' : 'instructor')) : 'student');
    const instructor = this.view === 'instructor';
    // Only an account with both views is told which one it is looking at.
    const viewName = key && (instructor ? 'Instructor view' : 'Student view');
    this.#questionView.toHtml = instructor ? instructorQuestionToHtml : questionToHtml;

    // The student view is the issue's questions and nothing else, read by the
    // code every student's copy runs. The instructor view is the key's, and
    // needs no issue.
    if (!instructor && (!issue || issue.report.needsUpdate)) {
      this.#setState(issue ? 'needsUpdate' : 'noIssue');
      this.#treeView.description = viewName || undefined;
      return;
    }

    this.#issue = issue;
    const report = this.#report();
    this.#tree.show(this.#target?.repository.rootUri, this.#questions());
    this.#treeView.description = [viewName, issue && describeGroup(issue.group), report?.headSha]
      .filter(Boolean)
      .join(' · ');
    this.#questionView.show(undefined);
    this.#highlighter.clear();
    vscode.commands.executeCommand('setContext', 'grillmycode.hasIssue', Boolean(issue));
    this.#setState('ready');
    this.#updateWarning();
  }

  /**
   * The report of the issue showing, when this extension can read its layout.
   *
   * @returns {Report | undefined}
   */
  #report() {
    const report = this.#issue?.report;
    return report?.needsUpdate ? undefined : report;
  }

  /** The questions listed: the answer key's in the instructor view, otherwise the issue's. */
  #questions() {
    return (this.view === 'instructor' ? this.#key?.questions : this.#report()?.questions) ?? [];
  }

  dispose() {
    clearTimeout(this.#reload);
    clearTimeout(this.#settle);
    this.#targetListener?.dispose();
    for (const listener of this.#waiting) listener.dispose();
    for (const disposable of this.#disposables) disposable.dispose();
  }

  /**
   * Says which view is showing, and whether there is another to switch to.
   *
   * @param {View} view
   */
  #setView(view) {
    this.view = view;
    vscode.commands.executeCommand('setContext', 'grillmycode.view', view);
    vscode.commands.executeCommand('setContext', 'grillmycode.answerKey', Boolean(this.#key));
  }

  /** @param {string} state */
  #setState(state) {
    this.state = state;
    vscode.commands.executeCommand('setContext', 'grillmycode.state', state);
    if (state !== 'ready') {
      this.#issue = undefined;
      vscode.commands.executeCommand('setContext', 'grillmycode.hasIssue', false);
      this.#tree.clear();
      this.#treeView.description = undefined;
      // A message hides the welcome text that explains the state.
      this.#treeView.message = undefined;
      this.#questionView.show(undefined);
      this.#highlighter.clear();
    }
  }

  /**
   * Follows the repository the questions belong to, for commits, checkouts and edits.
   *
   * @param {Target | undefined} target
   */
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
    clearTimeout(this.#reload);
    this.#reload = setTimeout(() => this.load(), SETTLE_MS);
  }

  /**
   * Something about the folder changed. Waits for it to settle, then catches
   * up. It has a timer of its own: sharing one with #loadSoon let an edit made
   * while a load was pending cancel the load.
   */
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
    if (this.state !== 'ready' || !this.#target) return;
    const report = this.#report();
    const { repository } = this.#target;
    const instructor = this.view === 'instructor';
    const questions = this.#questions();
    // The answer key does not say which commit it was written about. The issue
    // does, and stands in for it while the two hold the same questions.
    const sameRun = report && (!instructor || matchesReport(report.questions, questions));
    const notes = [
      this.#arrived
        ? 'A newer set of questions has arrived. Select Refresh Questions, at the top of this list, to show it.'
        : '',
      instructor && report && !sameRun
        ? "The answer key and the questions issue showing are from different runs of GrillMyCode. These are the answer key's questions, and their lines may not be the ones in this folder."
        : '',
      sameRun
        ? describeDrift({
            headSha: report.headCommit ?? report.headSha,
            folderCommit: repository.state.HEAD?.commit,
            changedFiles: changedFiles(repository),
            files: questionFiles(questions),
          })
        : '',
      !instructor && report?.truncated
        ? 'This report was too long to show in full, so its last questions are missing here. The PDF linked from the issue has them all.'
        : '',
    ];
    this.#treeView.message = notes.filter(Boolean).join(' ') || undefined;
  }

  /** @param {TreeNode | undefined} node */
  async #openQuestion(node) {
    if (!node?.question || !this.#target) return;
    this.#questionView.show(node.question);
    // Every file the question shows is opened. A snippet's own row leaves that
    // snippet in front, and the question's row its first.
    const snippets = openableSnippets(node.question);
    const target = node.snippet && snippets.includes(node.snippet) ? node.snippet : snippets[0];
    if (target) await this.#highlighter.show(this.#target.repository.rootUri, snippets, target);
  }

  /**
   * Opens the question after or before the one showing under the list, as
   * selecting it in the list would.
   *
   * @param {1 | -1} step
   */
  async #stepQuestion(step) {
    if (this.state !== 'ready') return;
    const current = this.#questionView.question?.number;
    const question = adjacentQuestion(this.#questions(), current, step);
    if (!question) return;
    const node = { question };
    // Selects the row, which shows the view if it is closed. The list is not
    // given the keyboard: that goes to the editor the question opens.
    await this.#treeView.reveal(node, { select: true, focus: false });
    await this.#openQuestion(node);
  }

  /** Workspace-state key for the questions chosen by hand for this repository. */
  #preferenceKey() {
    return `issueTitle:${this.#target?.owner}/${this.#target?.repo}`;
  }

  /** Workspace-state key for the view chosen by hand for this repository. */
  #viewKey() {
    return `view:${this.#target?.owner}/${this.#target?.repo}`;
  }

  /**
   * Changes the view, for an account that has both, and remembers it for this repository.
   *
   * @param {View} view
   */
  async #switchView(view) {
    if (!this.#key) return;
    await this.#context.workspaceState.update(this.#viewKey(), view);
    this.#show();
  }

  async #selectIssue() {
    if (this.#issues.length === 0) return;
    /** @type {vscode.QuickPickItem & { issue?: LoadedIssue }} */
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
