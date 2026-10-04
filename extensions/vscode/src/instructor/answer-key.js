/**
 * Answer key
 *
 * Finds and reads the answer key for the repository that is open: the
 * questions.json the action files in the assignment's instructor repository
 * (buildQuestionsJson in src/delivery/instructor-repo.js). GitHub decides who
 * may read that repository, so a successful read is what tells an instructor
 * from a student. Nothing here imports the VS Code API.
 *
 * For `cs-principles-lab-3-jsmith` in `my-school` the key is at
 *
 *   my-school/cs-principles-lab-3-grillmycode-instructor/jsmith/data/questions.json
 *
 * and a run started by a submission tag files its own one folder down, in
 * `jsmith/<tag group>/data/`.
 */

import { ANSWER_KEY_FILE, INSTRUCTOR_REPO_SUFFIX } from '../shared/constants.js';
import { listDirectCollaborators, readFile } from '../shared/github.js';
import {
  matchSubmissionIdentity,
  ownSubmissionIdentity,
  tagGroupSlug,
} from '../shared/identity.js';

/**
 * Where an identity's answer key is: `{ repo, path }` in the student
 * repository's organization. `group` is the questions issue's, from
 * parseIssueTitle, and names the tag pattern for a submission tag's questions.
 */
export function answerKeyLocation({ assignment, submitter }, group) {
  const folder = group?.kind === 'tag' ? `${submitter}/${tagGroupSlug(group.name)}` : submitter;
  return { repo: `${assignment}${INSTRUCTOR_REPO_SUFFIX}`, path: `${folder}/${ANSWER_KEY_FILE}` };
}

const isText = (value) => typeof value === 'string';

function readSnippet(snippet) {
  if (!isText(snippet?.file)) return undefined;
  if (!Number.isInteger(snippet.start_line) || !Number.isInteger(snippet.end_line)) {
    return undefined;
  }
  return {
    file: snippet.file,
    start_line: snippet.start_line,
    end_line: snippet.end_line,
    language: isText(snippet.language) ? snippet.language : '',
    code: isText(snippet.code) ? snippet.code : '',
  };
}

function readQuestion(entry) {
  // A dropped question was never asked: it has no number and is in no report.
  if (!entry || entry.dropped === true) return undefined;
  if (!Number.isInteger(entry.number) || !isText(entry.question)) return undefined;
  return {
    number: entry.number,
    broader: entry.broader === true,
    snippets: (Array.isArray(entry.snippets) ? entry.snippets : [])
      .map(readSnippet)
      .filter(Boolean),
    question: entry.question,
    answer: isText(entry.answer) ? entry.answer : '',
    distractors: (Array.isArray(entry.distractors) ? entry.distractors : []).filter(isText),
  };
}

/**
 * The questions in an answer key's text, in the shape parseReport returns with
 * `answer` and `distractors` added. Undefined when the text is not an answer
 * key or holds no question.
 *
 * The file is the action's, but it is read as carefully as the issue: an entry
 * that does not fit is left out, and nothing in it is evaluated.
 */
export function parseAnswerKey(text) {
  let record;
  try {
    record = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!Array.isArray(record?.questions)) return undefined;
  const questions = record.questions.map(readQuestion).filter(Boolean);
  return questions.length > 0 ? questions : undefined;
}

const lines = (question) =>
  question.snippets.map((s) => `${s.file}:${s.start_line}-${s.end_line}`).join('\n');

/**
 * True when a report's questions are the answer key's: each has a question of
 * the same number in the key, about the same lines. The report may hold fewer,
 * since a long one is cut short.
 *
 * They differ when the key was written by another run. An instructor
 * repository keeps one key per student, or per submission tag, while a student
 * repository keeps an issue per branch.
 */
export function matchesReport(reportQuestions, keyQuestions) {
  const byNumber = new Map(keyQuestions.map((question) => [question.number, question]));
  return reportQuestions.every((question) => {
    const keyed = byNumber.get(question.number);
    return keyed && keyed.broader === question.broader && lines(keyed) === lines(question);
  });
}

/**
 * Looks for the answer key of `owner/repo` with the signed-in account's token.
 *
 * Returns `{ questions, own, repo, path }` when the account can read it, where
 * `own` says the repository is that account's, or `{ reason }` when there is
 * none to show. It never throws.
 *
 * In the account's own repository this is one request, which GitHub refuses an
 * ordinary student. In anyone else's the student is found first, from the
 * repository's direct collaborators, as the action finds them.
 */
export async function findAnswerKey({ owner, repo, login, group, token, fetch }) {
  try {
    const own = ownSubmissionIdentity(repo, login);
    const identity =
      own ??
      matchSubmissionIdentity(repo, await listDirectCollaborators({ owner, repo, token, fetch }));
    if (identity.error) return { reason: identity.error };

    const location = answerKeyLocation(identity, group);
    const questions = parseAnswerKey(await readFile({ owner, ...location, token, fetch }));
    if (!questions) {
      return { reason: `${owner}/${location.repo}/${location.path} is not an answer key` };
    }
    return { questions, own: Boolean(own), ...location };
  } catch (err) {
    return { reason: err.message };
  }
}
