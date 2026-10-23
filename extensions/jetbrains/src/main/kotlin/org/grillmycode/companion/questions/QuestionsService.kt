package org.grillmycode.companion.questions

import com.intellij.dvcs.repo.VcsRepositoryManager
import com.intellij.dvcs.repo.VcsRepositoryMappingListener
import com.intellij.ide.trustedProjects.TrustedProjects
import com.intellij.ide.util.PropertiesComponent
import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationActivationListener
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.IconLoader
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.wm.IdeFrame
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.openapi.wm.ex.ToolWindowManagerListener
import com.intellij.ui.BadgeIconSupplier
import com.intellij.util.concurrency.AppExecutorUtil
import com.intellij.util.messages.Topic
import git4idea.repo.GitRepository
import git4idea.repo.GitRepositoryChangeListener
import git4idea.repo.GitRepositoryManager
import kotlinx.serialization.json.JsonElement
import org.grillmycode.companion.auth.AccountListener
import org.grillmycode.companion.auth.GitHubAccount
import org.grillmycode.companion.auth.NOTIFICATION_GROUP
import org.grillmycode.companion.auth.isRestrictedByOrganization
import org.grillmycode.companion.httpGet
import org.grillmycode.companion.instructor.AnswerKey
import org.grillmycode.companion.instructor.NoAnswerKey
import org.grillmycode.companion.instructor.findAnswerKey
import org.grillmycode.companion.shared.GitHubException
import org.grillmycode.companion.shared.NEW_QUESTIONS_CHECK_MS
import org.grillmycode.companion.shared.NEW_QUESTIONS_FOCUS_GAP_MS
import org.grillmycode.companion.shared.NeedsUpdate
import org.grillmycode.companion.shared.ParsedReport
import org.grillmycode.companion.shared.Question
import org.grillmycode.companion.shared.QuestionIssue
import org.grillmycode.companion.shared.Remote
import org.grillmycode.companion.shared.Report
import org.grillmycode.companion.shared.chooseIssue
import org.grillmycode.companion.shared.findQuestionIssues
import org.grillmycode.companion.shared.listLabelledIssues
import org.grillmycode.companion.shared.parseReport
import org.grillmycode.companion.shared.pickGitHubRemote
import org.grillmycode.companion.shared.whatArrived
import java.io.IOException
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * What the tool window shows, as the VS Code extension's controller names its
 * states (extensions/vscode/src/student/controller.js).
 */
sealed interface QuestionsState {
    data object Loading : QuestionsState

    /** The project is open in safe mode, where the IDE switches Git off. */
    data object Untrusted : QuestionsState

    /** No Git repository in the project has a GitHub remote. */
    data object NoRepository : QuestionsState

    /** No account is stored, or GitHub no longer accepts its token. */
    data object SignedOut : QuestionsState

    /** GitHub answered 404: no such repository for this account. */
    data object NoAccess : QuestionsState

    /** The organization that owns the repository, [owner], has not approved this app. */
    data class NotApproved(
        val owner: String,
    ) : QuestionsState

    /** The repository has no questions issue that reads as a report. */
    data object NoIssue : QuestionsState

    /** The questions are in a layout newer than this plugin reads. */
    data object NeedsUpdate : QuestionsState

    /** Anything else; the IDE's log has the details. */
    data object Error : QuestionsState

    /**
     * Questions are showing. In the student view they are [report]'s. In the
     * instructor view they are the answer key's, and [issue] and [report] are
     * the questions issue's when there is one, and the plugin can read it.
     */
    data class Ready(
        /** The repository root the snippets' paths are relative to. */
        val root: VirtualFile,
        val issue: QuestionIssue?,
        val report: Report?,
        val questions: List<Question>,
    ) : QuestionsState
}

/** Which questions the tool window lists: the issue's, or the answer key's with their answers. */
enum class View { STUDENT, INSTRUCTOR }

/** Told on the event dispatch thread each time the state, or what has arrived since, changes. */
fun interface QuestionsListener {
    fun stateChanged(state: QuestionsState)

    companion object {
        @Topic.ProjectLevel
        val TOPIC = Topic.create("GrillMyCode questions", QuestionsListener::class.java)
    }
}

/** A questions issue that reads as a report, with what it reads as. */
data class LoadedIssue(
    val issue: QuestionIssue,
    val report: ParsedReport,
)

/** The repository the questions belong to: its root, the GitHub repository it is a clone of, and its branch. */
private data class Target(
    val root: VirtualFile,
    val owner: String,
    val repo: String,
    val branch: String?,
)

/** What a load found: the state to show, every questions issue, the one chosen, and the answer key, with the view. */
private data class Loaded(
    val state: QuestionsState,
    val issues: List<LoadedIssue> = emptyList(),
    val chosen: QuestionIssue? = null,
    val key: AnswerKey? = null,
    val view: View = View.STUDENT,
)

/** The tool window's icon, as plugin.xml names it, to put a badge on. */
private val badgeIcons = BadgeIconSupplier(IconLoader.getIcon("/icons/toolWindow.svg", QuestionsService::class.java))

/**
 * Keeps the questions issues among a repository's issues, as the GitHub REST
 * API lists them, each with its report.
 */
private fun readReports(issues: List<JsonElement>): List<LoadedIssue> =
    findQuestionIssues(issues).mapNotNull { issue -> parseReport(issue.body)?.let { LoadedIssue(issue, it) } }

/**
 * Finds the project's GitHub repository, loads its questions issue, and keeps
 * the state in step with sign-in and the repository's branch and remotes.
 * Created when the tool window first opens, so nothing is asked of GitHub
 * before that.
 *
 * It also looks for the repository's answer key (instructor/AnswerKey.kt). An
 * account that can read it gets the instructor view, which lists the key's
 * questions with their answers, and a switch between the two views. An account
 * that cannot gets the student view alone, built from the issue, with nothing
 * to show that another view exists.
 *
 * While the IDE has the focus it asks GitHub now and then whether a set of
 * questions has arrived since the last load ([check]). The first set is loaded
 * at once, since the list is empty. A set that replaces the one showing is
 * announced and left on GitHub until the student asks for it, so the list
 * never changes under someone who is reading it.
 */
@Service(Service.Level.PROJECT)
class QuestionsService(
    private val project: Project,
) : Disposable {
    private val log = Logger.getInstance(QuestionsService::class.java)

    /** The state showing. Written on the event dispatch thread; actions read it from any. */
    @Volatile
    var state: QuestionsState = QuestionsState.Loading
        private set

    /** Every questions issue that reads as a report, for choosing among them. */
    @Volatile
    var issues: List<LoadedIssue> = emptyList()
        private set

    /** The issue [chooseIssue] picked at the last load, shown or not. */
    @Volatile
    var chosen: QuestionIssue? = null
        private set

    /** The answer key the signed-in account read at the last load, if it could read one. */
    @Volatile
    var key: AnswerKey? = null
        private set

    /** The view showing. Always the student view without an answer key. */
    @Volatile
    var view: View = View.STUDENT
        private set

    /** A set of questions GitHub has in place of the one showing: found by a check, and left there until asked for. */
    @Volatile
    var arrived: QuestionIssue? = null
        private set

    /** True while questions loaded by a check have not been seen in the tool window. */
    private var unseen = false

    /** Counts loads, so one that has been overtaken by a later one is dropped. */
    private val loads = AtomicInteger()

    /** The target the state was worked out for, to tell a change that matters from one that does not. */
    @Volatile private var loadedTarget: Target? = null

    /** True while a check for new questions is waiting on GitHub. */
    private val checking = AtomicBoolean()

    /** When the last check started, as System.currentTimeMillis() gives it. */
    @Volatile private var checked = 0L

    init {
        val app = ApplicationManager.getApplication()
        app.messageBus.connect(this).apply {
            subscribe(AccountListener.TOPIC, AccountListener { refresh() })
            // Someone coming back from watching the run on GitHub should not wait for the timer.
            subscribe(
                ApplicationActivationListener.TOPIC,
                object : ApplicationActivationListener {
                    override fun applicationActivated(ideFrame: IdeFrame) {
                        if (System.currentTimeMillis() - checked >= NEW_QUESTIONS_FOCUS_GAP_MS) check()
                    }
                },
            )
        }
        project.messageBus.connect(this).apply {
            // Trusting a project in safe mode switches Git on, which maps its repositories.
            subscribe(VcsRepositoryManager.VCS_REPOSITORY_MAPPING_UPDATED, VcsRepositoryMappingListener { refreshIfMoved() })
            // Sent after every fetch, commit and checkout: a new load only
            // when the branch or the remote has changed.
            subscribe(GitRepository.GIT_REPO_CHANGE, GitRepositoryChangeListener { refreshIfMoved() })
            // Questions loaded by a check count as seen once the tool window is looked at.
            subscribe(
                ToolWindowManagerListener.TOPIC,
                object : ToolWindowManagerListener {
                    override fun stateChanged(toolWindowManager: ToolWindowManager) {
                        if (unseen && toolWindowManager.getToolWindow(TOOL_WINDOW_ID)?.isVisible == true) {
                            unseen = false
                            updateBadge()
                        }
                    }
                },
            )
        }
    }

    /** The check every minute, stopped in [dispose]. */
    private val timer =
        AppExecutorUtil
            .getAppScheduledExecutorService()
            .scheduleWithFixedDelay(::check, NEW_QUESTIONS_CHECK_MS, NEW_QUESTIONS_CHECK_MS, TimeUnit.MILLISECONDS)

    /**
     * Works the state out again, off the event dispatch thread. [after] is
     * told the new state on the event dispatch thread, unless a later load
     * has overtaken this one.
     */
    fun refresh(after: (QuestionsState) -> Unit = {}) {
        val load = loads.incrementAndGet()
        val app = ApplicationManager.getApplication()
        app.executeOnPooledThread {
            val target = findTarget()
            val next =
                try {
                    load(target)
                } catch (error: Exception) {
                    log.warn("Could not load the questions", error)
                    Loaded(QuestionsState.Error)
                }
            app.invokeLater({
                if (load != loads.get()) return@invokeLater
                loadedTarget = target
                state = next.state
                issues = next.issues
                chosen = next.chosen
                key = next.key
                view = next.view
                arrived = null
                updateBadge()
                publish()
                after(next.state)
            }, project.disposed)
        }
    }

    private fun refreshIfMoved() {
        ApplicationManager.getApplication().executeOnPooledThread {
            if (findTarget() != loadedTarget) refresh()
        }
    }

    private fun publish() = project.messageBus.syncPublisher(QuestionsListener.TOPIC).stateChanged(state)

    /**
     * The first repository with a GitHub remote, as VS Code's findGitHubRepository
     * picks it. A project with several shows the questions of that one.
     */
    private fun findTarget(): Target? =
        GitRepositoryManager.getInstance(project).repositories.firstNotNullOfOrNull { repository ->
            val remotes = repository.remotes.map { Remote(it.name, it.firstUrl, it.pushUrls.firstOrNull()) }
            pickGitHubRemote(remotes)?.let { Target(repository.root, it.owner, it.repo, repository.currentBranchName) }
        }

    private fun load(target: Target?): Loaded {
        if (target == null) {
            // Safe mode switches Git off, so no repository would ever be found.
            return Loaded(if (TrustedProjects.isProjectTrusted(project)) QuestionsState.NoRepository else QuestionsState.Untrusted)
        }
        val account = GitHubAccount.load() ?: return Loaded(QuestionsState.SignedOut)
        val issues =
            try {
                readReports(listLabelledIssues(target.owner, target.repo, account.token, ::httpGet))
            } catch (error: GitHubException) {
                log.info("Could not read the issues of ${target.owner}/${target.repo}: ${error.message}")
                val restricted = isRestrictedByOrganization(error.status, error.body)
                return Loaded(if (restricted) QuestionsState.NotApproved(target.owner) else stateFor(error.status))
            } catch (error: IOException) {
                log.info("Could not reach GitHub: ${error.message}")
                return Loaded(QuestionsState.Error)
            }
        val chosen = chooseIssue(issues.map { it.issue }, target.branch, preferredTitle(target))
        // The key is looked for before anything is shown, so an instructor's list
        // does not open on the student's questions and then change.
        val key =
            when (
                val found =
                    findAnswerKey(
                        target.owner,
                        target.repo,
                        account.login,
                        chosen?.group,
                        account.token,
                        ::httpGet,
                        titleSet = chosen?.set,
                        set = (issues.firstOrNull { it.issue == chosen }?.report as? Report)?.set,
                    )
            ) {
                is AnswerKey -> found
                is NoAnswerKey -> {
                    // At debug level: for a student there is never one, and that is no fault.
                    log.debug("No answer key for ${target.owner}/${target.repo}: ${found.reason}")
                    null
                }
            }
        val view = if (key == null) View.STUDENT else chosenView(target) ?: if (key.own) View.STUDENT else View.INSTRUCTOR
        return Loaded(present(target, issues, chosen, key, view), issues, chosen, key, view)
    }

    /**
     * The state for what a load found, in [view]. The student view is the
     * issue's questions and nothing else, read by the code every student's copy
     * runs. The instructor view is the key's, and needs no issue.
     */
    private fun present(
        target: Target,
        issues: List<LoadedIssue>,
        chosen: QuestionIssue?,
        key: AnswerKey?,
        view: View,
    ): QuestionsState {
        val report = issues.firstOrNull { it.issue == chosen }?.report
        if (view == View.INSTRUCTOR && key != null) return QuestionsState.Ready(target.root, chosen, report as? Report, key.questions)
        return when (report) {
            null -> QuestionsState.NoIssue
            NeedsUpdate -> QuestionsState.NeedsUpdate
            is Report -> QuestionsState.Ready(target.root, chosen, report, report.questions)
        }
    }

    /**
     * Changes the view, for an account that has both, and remembers it for
     * this repository. Nothing is asked of GitHub: both views were loaded.
     * Called on the event dispatch thread.
     */
    fun switchView(next: View) {
        val target = loadedTarget ?: return
        val key = key ?: return
        PropertiesComponent.getInstance(project).setValue(viewKey(target), next.name)
        view = next
        state = present(target, issues, chosen, key, next)
        publish()
    }

    /** The view chosen by hand for this repository, if any. */
    private fun chosenView(target: Target): View? =
        PropertiesComponent.getInstance(project).getValue(viewKey(target))?.let { name -> View.entries.firstOrNull { it.name == name } }

    private fun viewKey(target: Target) = "GrillMyCode.view:${target.owner}/${target.repo}"

    /** The state for a refusal from GitHub with [status], other than an organization's restriction. */
    private fun stateFor(status: Int): QuestionsState =
        when (status) {
            401 -> QuestionsState.SignedOut
            404 -> QuestionsState.NoAccess
            else -> QuestionsState.Error
        }

    /**
     * Shows the questions of the issue with [title] from now on, or with null
     * those of the branch that is checked out, and remembers the choice for
     * this repository.
     */
    fun choose(title: String?) {
        val target = loadedTarget ?: return
        PropertiesComponent.getInstance(project).setValue(preferenceKey(target), title)
        refresh()
    }

    /** The title of the questions chosen by hand for this repository, if any. */
    private fun preferredTitle(target: Target): String? = PropertiesComponent.getInstance(project).getValue(preferenceKey(target))

    private fun preferenceKey(target: Target) = "GrillMyCode.issueTitle:${target.owner}/${target.repo}"

    /**
     * Asks GitHub whether a set of questions has arrived since the last load.
     * Nothing is asked while the IDE is in the background, or in a state where
     * the repository could not be read in the first place.
     *
     * A check that fails says nothing: the next one asks again, and Refresh
     * Questions is there to report a fault.
     */
    private fun check() {
        val target = loadedTarget ?: return
        val watched =
            when (state) {
                is QuestionsState.Ready, QuestionsState.NoIssue, QuestionsState.NeedsUpdate -> true
                else -> false
            }
        val app = ApplicationManager.getApplication()
        if (!watched || !app.isActive || !checking.compareAndSet(false, true)) return
        checked = System.currentTimeMillis()
        val load = loads.get()
        app.executeOnPooledThread {
            try {
                val account = GitHubAccount.load() ?: return@executeOnPooledThread
                val latest = readReports(listLabelledIssues(target.owner, target.repo, account.token, ::httpGet))
                val preferred = preferredTitle(target)
                app.invokeLater({
                    // A load that started meanwhile has read the same issues, or newer ones.
                    if (load == loads.get()) notice(chooseIssue(latest.map { it.issue }, target.branch, preferred))
                }, project.disposed)
            } catch (error: Exception) {
                log.debug("Could not check ${target.owner}/${target.repo} for new questions: ${error.message}")
            } finally {
                checking.set(false)
            }
        }
    }

    /**
     * Acts on the issue a check would choose now, [latest], against the one
     * loaded. With no questions showing it loads them and says they are there.
     * With some, it leaves the list as it is and says a newer set can be shown.
     */
    private fun notice(latest: QuestionIssue?) {
        if (latest == null || whatArrived(chosen, latest) == null) return
        if (state !is QuestionsState.Ready) {
            refresh { next ->
                // Still nothing to show when, say, the set is in a layout this version cannot read.
                if (next !is QuestionsState.Ready) return@refresh
                if (toolWindow()?.isVisible != true) {
                    unseen = true
                    updateBadge()
                }
                announce("GrillMyCode questions have arrived for this repository.", "Show Questions")
            }
            return
        }
        // Said once for each set, however many checks find it.
        if (whatArrived(arrived, latest) == null) return
        arrived = latest
        updateBadge()
        publish()
        announce("A newer set of GrillMyCode questions has arrived for this repository.", "Show New Questions") { refresh() }
    }

    /**
     * Says, in a notification, that questions have arrived. Its button shows
     * the tool window, after [before] when that is given.
     */
    private fun announce(
        message: String,
        button: String,
        before: () -> Unit = {},
    ) {
        NotificationGroupManager
            .getInstance()
            .getNotificationGroup(NOTIFICATION_GROUP)
            .createNotification(message, NotificationType.INFORMATION)
            .addAction(
                NotificationAction.createSimpleExpiring(button) {
                    before()
                    toolWindow()?.show()
                },
            ).notify(project)
    }

    private fun toolWindow() = ToolWindowManager.getInstance(project).getToolWindow(TOOL_WINDOW_ID)

    /** A dot on the tool window's icon while there are questions the student has not seen. */
    private fun updateBadge() {
        toolWindow()?.setIcon(if (unseen || arrived != null) badgeIcons.getInfoIcon(true) else badgeIcons.originalIcon)
    }

    override fun dispose() {
        timer.cancel(false)
    }
}
