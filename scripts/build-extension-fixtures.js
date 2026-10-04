// Writes the sample questions issues in extensions/fixtures/current/, which
// every editor extension tests its report reader against.
//
// Each case runs the action's own code from a model reply to the issue it
// would post — parseQuestionsReply, resolveSnippets, renderQuestions,
// formatReport and postIssue — against a stand-in for GitHub, and files:
//
//   issue.json      the title and labels the issue was created with
//   body.md         the issue's body, byte for byte
//   expected.json   what an extension should read back from the two
//   questions.json  the answer key the same run files in the instructor
//                   repository (buildQuestionsJson), byte for byte
//
// expected.json is written from the questions that went in, not by reading
// body.md, so an extension that reads body.md and gets expected.json has made
// the whole round trip.
//
// Run after changing how the report or the issue is written:
//   node scripts/build-extension-fixtures.js
//
// test/extension-fixtures.test.js fails until you do. Before running it for a
// change that alters the layout, see extensions/fixtures/README.md: the old
// layout has to be kept as well.

import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { buildQuestionsJson } from '../src/delivery/instructor-repo.js';
import { postIssue } from '../src/delivery/issue.js';
import {
  arrangeQuestions,
  numberQuestions,
  parseQuestionsReply,
  renderQuestions,
  resolveSnippets,
} from '../src/postprocess.js';
import { formatReport } from '../src/report.js';

export const FIXTURES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'extensions',
  'fixtures',
  'current',
);

/** formatReport stamps the time of the run; the fixtures carry this one instead. */
const GENERATED = '2026-01-15 14:30:00 UTC';

/** The release the report's footer names, as a workflow pinned to `@v0` would. */
const ACTION_REF = 'v0';

const BASE_SHA = '4f1c9a2b7d3e5f60718293a4b5c6d7e8f9012345';
const HEAD_SHA = '9b8e7d6c5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c';

// ── The student's files, as the action sends them to the model ──────────────

const CART_JS = `export function addItem(cart, item) {
  const existing = cart.items.find((entry) => entry.sku === item.sku);
  if (existing) {
    existing.quantity += item.quantity;
  } else {
    cart.items.push({ ...item });
  }
  return cart;
}

export function subtotal(cart) {
  let total = 0;
  for (const entry of cart.items) {
    total += entry.price * entry.quantity;
  }
  return Math.round(total * 100) / 100;
}

export function removeItem(cart, sku) {
  cart.items = cart.items.filter((entry) => entry.sku !== sku);
  return cart;
}`;

const TAX_JS = `const RATES = { NS: 0.14, ON: 0.13, AB: 0.05 };

export function taxFor(amount, province) {
  const rate = RATES[province] ?? 0;
  return Number((amount * rate).toFixed(2));
}`;

// A template literal holding Markdown: its fence and its rule sit at the start
// of a line, where a reader that splits on them would break the snippet.
const HELP_JS = `export const HELP = \`
# Checkout

\`\`\`bash
npm run checkout -- --province NS
\`\`\`

---
Prices include tax.
\`;

export function printHelp(log = console.log) {
  log(HELP.trim());
}`;

const FORMAT_JS = `export function money(amount) {
  return \`$\${amount.toFixed(2)}\`;
}`;

/** A file the model was sent in full, every line the student's own. */
const source = (filepath, text) => ({ filepath, lines: text.split('\n'), studentLines: 'all' });

/** A file sent as codebase context: shown to the model, never assessed. */
const context = (filepath, text) => ({
  filepath,
  lines: text.split('\n'),
  studentLines: new Set(),
});

const question = (text, answer, snippets, broader = false) => ({
  question: text,
  answer,
  distractors: ['A wrong answer', 'Another wrong answer', 'A third wrong answer'],
  snippets: snippets.map(([file, start_line, end_line]) => ({ file, start_line, end_line })),
  broader,
});

// ── The cases ───────────────────────────────────────────────────────────────

const CASES = [
  {
    // A push to the default branch: the plainest report there is.
    name: 'default-branch',
    sources: [source('src/cart.js', CART_JS), source('src/pricing/tax.js', TAX_JS)],
    reply: [
      question(
        'What does `addItem` do to `cart.items` when the SKU is already in the cart?',
        'It adds the new quantity to the existing entry and pushes nothing.',
        [['src/cart.js', 1, 9]],
      ),
      question(
        'Why is the total rounded with `Math.round(total * 100) / 100` before it is returned?',
        'Floating-point addition can leave a long fraction, and this keeps two decimal places.',
        [['src/cart.js', 16, 16]],
      ),
      question(
        'What does `taxFor` return for a province that is not in `RATES`, and how would `subtotal` be affected?',
        'It returns 0, because the rate falls back to 0, and `subtotal` is unaffected.',
        [
          ['src/pricing/tax.js', 3, 6],
          ['src/cart.js', 11, 17],
        ],
      ),
      question(
        'Which line would change if issue #12 asked for a rate tagged @deprecated to be skipped?',
        'The line that looks the rate up in `RATES`.',
        [['src/pricing/tax.js', 4, 4]],
      ),
      question(
        'How would you test `removeItem` without depending on `addItem`?',
        'Build the cart object by hand, call `removeItem`, and check `cart.items`.',
        [],
        true,
      ),
    ],
    report: { branchName: 'main' },
    issue: { branchName: 'main' },
  },
  {
    // A feature branch, with every optional header line the student can see,
    // and a snippet whose code holds a Markdown fence and a rule.
    name: 'feature-branch',
    sources: [
      source('scripts/help.js', HELP_JS),
      source('src/pricing/tax.js', TAX_JS),
      context('src/format.js', FORMAT_JS),
    ],
    reply: [
      question(
        'What does `printHelp` write when it is called with no argument?',
        'The help text with the blank lines at either end removed.',
        [['scripts/help.js', 1, 14]],
      ),
      question('What would `money(taxFor(10, "NS"))` return?', 'The string `$1.40`.', [
        ['src/pricing/tax.js', 3, 6],
        ['src/format.js', 1, 3],
      ]),
    ],
    contextSummary: 'These questions focus on the checkout help text and the tax calculation.',
    report: {
      branchName: 'feature/checkout',
      assignmentContextFiles: ['docs/assignment.md'],
      codebaseContextFiles: ['src/format.js'],
      pdfUrl:
        'https://github.com/my-school/cs-principles-lab-3-jsmith/releases/download/gmc-assessments/grill-my-code-cs-principles-lab-3-jsmith.pdf',
    },
    issue: { branchName: 'feature/checkout' },
  },
  {
    // A run started by a submission tag: titled by the tag pattern.
    name: 'submission-tag',
    sources: [source('src/cart.js', CART_JS)],
    reply: [
      question(
        'What is `cart.items` after `removeItem` is called with a SKU that is not in the cart?',
        'The same entries as before, in a new array.',
        [['src/cart.js', 19, 22]],
      ),
    ],
    report: { branchName: '', tagName: 'submit/2026-01-15', previousTagName: 'submit/2026-01-08' },
    issue: { branchName: '', tagPattern: 'submit/*' },
  },
  {
    // include_answers: each question is followed by its answer.
    name: 'with-answers',
    view: 'answers',
    sources: [source('src/pricing/tax.js', TAX_JS)],
    reply: [
      question(
        'What does `toFixed(2)` return, and why is the result passed to `Number`?',
        'It returns a string, and `Number` turns it back into a number.',
        [['src/pricing/tax.js', 5, 5]],
      ),
      question(
        'What would change if `RATES` were declared with `let`?',
        'Nothing in this file, since `RATES` is never reassigned.',
        [],
        true,
      ),
    ],
    report: { branchName: 'main' },
    issue: { branchName: 'main' },
  },
];

/** A stand-in for GitHub with no open issues, which keeps the one that is created. */
function recordingOctokit() {
  const created = {};
  return {
    created,
    graphql: async () => ({ pinIssue: { issue: { title: '' } } }),
    rest: {
      issues: {
        listForRepo: async () => ({ data: [] }),
        create: async ({ title, body, labels }) => {
          Object.assign(created, { title, body, labels });
          return { data: { number: 1, html_url: '', node_id: 'I_1' } };
        },
      },
    },
  };
}

/** What an extension should read from a case's issue. */
function expectedFor({ title, questions, report, view }) {
  const group = title.match(/\((tag: )?(.+)\)$/);
  return {
    group: group ? { kind: group[1] ? 'tag' : 'branch', name: group[2] } : { kind: 'unnamed' },
    report: {
      baseSha: BASE_SHA.slice(0, 7),
      headSha: HEAD_SHA.slice(0, 7),
      // From the hidden data. A layout kept from before it has no such field.
      headCommit: HEAD_SHA,
      // The report names a branch only when it is not the default one.
      branch: ['', 'main', 'master'].includes(report.branchName) ? null : report.branchName,
      tag: report.tagName ?? null,
      files: report.files,
      truncated: false,
    },
    questions: questions.map((q) => ({
      number: q.number,
      broader: q.broader,
      snippets: q.snippets.map(({ file, start, end, language, code }) => ({
        file,
        start_line: start,
        end_line: end,
        language,
        code,
      })),
      question: q.question,
      ...(view === 'answers' ? { answer: q.answer } : {}),
    })),
  };
}

async function buildCase({
  name,
  sources,
  reply,
  contextSummary,
  report,
  issue,
  view = 'student',
}) {
  const parsed = parseQuestionsReply(
    JSON.stringify({ questions: reply, context_summary: contextSummary ?? '' }),
  );
  const resolved = resolveSnippets(parsed.questions, sources);
  const dropped = resolved.unresolved.length + resolved.notStudentWork.length;
  if (dropped > 0) throw new Error(`${name}: ${dropped} question(s) did not resolve`);
  const questions = numberQuestions(arrangeQuestions(resolved.questions, reply.length).questions);

  const files = sources.filter((s) => s.studentLines === 'all').map((s) => s.filepath);
  const body = formatReport({
    questions: renderQuestions(questions, { view }),
    files,
    baseSha: BASE_SHA,
    headSha: HEAD_SHA,
    provider: 'openrouter',
    model: 'google/gemini-3.5-flash-lite',
    contextSummary: parsed.contextSummary,
    studentLogin: 'jsmith',
    sourceRepo: 'my-school/cs-principles-lab-3-jsmith',
    issueQuestions: questions,
    ...report,
  }).replace(/^> \*\*Generated:\*\* .*$/m, `> **Generated:** ${GENERATED}`);

  const octokit = recordingOctokit();
  await postIssue({
    octokit,
    ctx: { repo: { owner: 'my-school', repo: 'cs-principles-lab-3-jsmith' } },
    report: body,
    headSha: HEAD_SHA,
    studentLogin: 'jsmith',
    ...issue,
  });
  const { title, labels } = octokit.created;

  const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
  return {
    [`${name}/issue.json`]: json({ title, labels }),
    [`${name}/body.md`]: octokit.created.body,
    [`${name}/expected.json`]: json(
      expectedFor({ title, questions, report: { ...report, files }, view }),
    ),
    [`${name}/questions.json`]: buildQuestionsJson(questions),
  };
}

/**
 * Builds every fixture, as `{ 'case/file': content }`. The footer names the
 * action release from GITHUB_ACTION_REF, so that is pinned for the build and
 * put back afterwards.
 */
export async function buildFixtures() {
  const savedRef = process.env.GITHUB_ACTION_REF;
  process.env.GITHUB_ACTION_REF = ACTION_REF;
  try {
    const files = {};
    for (const fixture of CASES) Object.assign(files, await buildCase(fixture));
    return files;
  } finally {
    if (savedRef === undefined) delete process.env.GITHUB_ACTION_REF;
    else process.env.GITHUB_ACTION_REF = savedRef;
  }
}

async function main() {
  const files = await buildFixtures();
  rmSync(FIXTURES_DIR, { recursive: true, force: true });
  for (const [path, content] of Object.entries(files)) {
    const target = join(FIXTURES_DIR, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, 'utf-8');
  }
  console.log(`Wrote ${Object.keys(files).length} files to ${FIXTURES_DIR}.`);
}

// Only write when the script is run directly; the test suite imports it.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
