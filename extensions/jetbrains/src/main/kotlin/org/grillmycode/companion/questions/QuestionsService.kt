package org.grillmycode.companion.questions

import com.intellij.dvcs.repo.VcsRepositoryManager
import com.intellij.dvcs.repo.VcsRepositoryMappingListener
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.util.messages.Topic
import git4idea.repo.GitRepository
import git4idea.repo.GitRepositoryChangeListener
import git4idea.repo.GitRepositoryManager
import org.grillmycode.companion.auth.AccountListener
import org.grillmycode.companion.auth.GitHubAccount
import org.grillmycode.companion.httpGet
import org.grillmycode.companion.shared.GitHubException
import org.grillmycode.companion.shared.NeedsUpdate
import org.grillmycode.companion.shared.QuestionIssue
import org.grillmycode.companion.shared.Remote
import org.grillmycode.companion.shared.Report
import org.grillmycode.companion.shared.chooseIssue
import org.grillmycode.companion.shared.findQuestionIssues
import org.grillmycode.companion.shared.listLabelledIssues
import org.grillmycode.companion.shared.parseReport
import org.grillmycode.companion.shared.pickGitHubRemote
import java.io.IOException
import java.util.concurrent.atomic.AtomicInteger

/**
 * What the tool window shows, as the VS Code extension's controller names its
 * states (extensions/vscode/src/student/controller.js).
 */
sealed interface QuestionsState {
    data object Loading : QuestionsState

    /** No Git repository in the project has a GitHub remote. */
    data object NoRepository : QuestionsState

    /** No account is stored, or GitHub no longer accepts its token. */
    data object SignedOut : QuestionsState

    /** GitHub answered 404: no such repository for this account. */
    data object NoAccess : QuestionsState

    /** The repository has no questions issue that reads as a report. */
    data object NoIssue : QuestionsState

    /** The questions are in a layout newer than this plugin reads. */
    data object NeedsUpdate : QuestionsState

    /** Anything else; the IDE's log has the details. */
    data object Error : QuestionsState

    data class Ready(
        /** The repository root the snippets' paths are relative to. */
        val root: VirtualFile,
        val issue: QuestionIssue,
        val report: Report,
    ) : QuestionsState
}

/** Told on the event dispatch thread each time the state changes. */
fun interface QuestionsListener {
    fun stateChanged(state: QuestionsState)

    companion object {
        @Topic.ProjectLevel
        val TOPIC = Topic.create("GrillMyCode questions", QuestionsListener::class.java)
    }
}

/** The repository the questions belong to: its root, the GitHub repository it is a clone of, and its branch. */
private data class Target(
    val root: VirtualFile,
    val owner: String,
    val repo: String,
    val branch: String?,
)

/**
 * Finds the project's GitHub repository, loads its questions issue, and keeps
 * the state in step with sign-in and the repository's branch and remotes.
 * Created when the tool window first opens, so nothing is asked of GitHub
 * before that.
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

    /** Counts loads, so one that has been overtaken by a later one is dropped. */
    private val loads = AtomicInteger()

    /** The target the state was worked out for, to tell a change that matters from one that does not. */
    @Volatile private var loadedTarget: Target? = null

    init {
        val app = ApplicationManager.getApplication()
        app.messageBus.connect(this).subscribe(AccountListener.TOPIC, AccountListener { refresh() })
        project.messageBus.connect(this).apply {
            subscribe(VcsRepositoryManager.VCS_REPOSITORY_MAPPING_UPDATED, VcsRepositoryMappingListener { refreshIfMoved() })
            // Sent after every fetch, commit and checkout: a new load only
            // when the branch or the remote has changed.
            subscribe(GitRepository.GIT_REPO_CHANGE, GitRepositoryChangeListener { refreshIfMoved() })
        }
    }

    /** Works the state out again, off the event dispatch thread. */
    fun refresh() {
        val load = loads.incrementAndGet()
        val app = ApplicationManager.getApplication()
        app.executeOnPooledThread {
            val target = findTarget()
            val next =
                try {
                    load(target)
                } catch (error: Exception) {
                    log.warn("Could not load the questions", error)
                    QuestionsState.Error
                }
            app.invokeLater({
                if (load != loads.get()) return@invokeLater
                loadedTarget = target
                state = next
                project.messageBus.syncPublisher(QuestionsListener.TOPIC).stateChanged(next)
            }, project.disposed)
        }
    }

    private fun refreshIfMoved() {
        ApplicationManager.getApplication().executeOnPooledThread {
            if (findTarget() != loadedTarget) refresh()
        }
    }

    /**
     * The first repository with a GitHub remote, as VS Code's findGitHubRepository
     * picks it. A project with several shows the questions of that one.
     */
    private fun findTarget(): Target? =
        GitRepositoryManager.getInstance(project).repositories.firstNotNullOfOrNull { repository ->
            val remotes = repository.remotes.map { Remote(it.name, it.firstUrl, it.pushUrls.firstOrNull()) }
            pickGitHubRemote(remotes)?.let { Target(repository.root, it.owner, it.repo, repository.currentBranchName) }
        }

    private fun load(target: Target?): QuestionsState {
        if (target == null) return QuestionsState.NoRepository
        val account = GitHubAccount.load() ?: return QuestionsState.SignedOut
        val issues =
            try {
                listLabelledIssues(target.owner, target.repo, account.token, ::httpGet)
            } catch (error: GitHubException) {
                log.info("Could not read the issues of ${target.owner}/${target.repo}: ${error.message}")
                return when (error.status) {
                    401 -> QuestionsState.SignedOut
                    404 -> QuestionsState.NoAccess
                    else -> QuestionsState.Error
                }
            } catch (error: IOException) {
                log.info("Could not reach GitHub: ${error.message}")
                return QuestionsState.Error
            }
        val reports = findQuestionIssues(issues).mapNotNull { issue -> parseReport(issue.body)?.let { issue to it } }.toMap()
        val chosen = chooseIssue(reports.keys.toList(), target.branch) ?: return QuestionsState.NoIssue
        return when (val report = reports.getValue(chosen)) {
            is Report -> QuestionsState.Ready(target.root, chosen, report)
            NeedsUpdate -> QuestionsState.NeedsUpdate
        }
    }

    override fun dispose() = Unit
}
