---
sidebar_position: 8
sidebar_label: Keeping a private answer key
---

# Keeping a private answer key

Students only ever see questions. With a little extra setup, GrillMyCode also keeps a copy of every student's questions **with the answers**, in a private repository that only instructors can see. It also builds a multiple-choice quiz for each student that you can import into your LMS.

This page shows how to set it up. It takes about 10 minutes once, and one extra line in each assignment's workflow.

![A cartoon split by a brick wall with an "Instructors only" sign and a padlock. The GrillMyCode flame sits on the wall and sends a paper plane to each side. On the student's side, the student looks at a pinned issue of questions with a PDF copy, and every answer is hidden. On your side as a Classroom 50 instructor, a locked folder with a tab for each student, such as jsmith, holds questions with answers, and a quiz card flies off to your LMS. Chips underneath compare the sides: the student gets questions but not answers; you get questions, answers and an LMS quiz.](/img/who-sees-what.svg)

## What you get

For each assignment, GrillMyCode creates a private repository in your classroom's organization, named after the assignment. For example, `cs-principles-lab-3-grillmycode-instructor`. Inside, each student has a folder containing:

- **`questions.md`**: their questions and answers. This is the file to read.
- **A quiz file** (`.imscc`), ready to import into Brightspace, Canvas, Moodle or most other LMSs. See [Importing quizzes into your LMS](lms-quizzes.md).
- **A Brightspace-only alternative** (`.csv`), which you can ignore on any other LMS.
- **`raw-ai-output.md`**: the AI's reply before GrillMyCode tidied it. You only need it when something looks wrong.

Every new run for a student replaces their files, so each folder always holds exactly one up-to-date assessment. Students can't see this repository.

![Top: the private instructor repository web101-lab-3-grillmycode-instructor, with a .github/workflows folder and one folder per student. Bottom: one student's folder, containing the Brightspace CSV quiz, the .imscc quiz, questions.md and raw-ai-output.md.](/img/screenshots/instructor-repository.png)

## One-time setup

### Create an access token

GrillMyCode needs permission to create repositories in your organization and write to them. You give it that with a **personal access token**: a password tied to your GitHub account, limited to specific permissions.

Use an account that can create repositories in the organization; an organization owner can.

1. On GitHub, go to **Settings → Developer settings → Personal access tokens → Tokens (classic)**. This is your own account's settings, not the organization's.
2. Select **Generate new token (classic)**.
3. Give it a name, such as `GrillMyCode answer key`, and an expiry date that suits you, such as one year.
4. Tick the **`repo`** scope *and* the **`workflow`** scope. Both are needed.
5. Select **Generate token** and copy it straight away. GitHub shows it only once.

:::tip[Want tighter permissions?]
A *fine-grained* token works too. See [Tokens, secrets and permissions](../reference/permissions.md) for the exact permissions it needs.
:::

### Save it as an organization secret

This is the same process as for [the OpenRouter key](../getting-started/openrouter-key.md#save-the-key-in-your-github-organization).

1. Open your classroom's organization and go to **Settings → Secrets and variables → Actions**.
2. Select **New organization secret**.
3. For **Name**, enter `INSTRUCTOR_REPO_TOKEN`.
4. For **Value**, paste the token.
5. Under **Repository access**, choose **All repositories**, or **Private repositories**.
6. Select **Add secret**.

When the token expires, generate a new one and replace the secret's value. Until you do, answer keys stop arriving; see [Troubleshooting](../troubleshooting.md#private-answer-key-instructor-repository).

## For each assignment

In the [Workflow Wizard](../workflow-wizard.mdx)'s **Instructor** step, answer **Yes** to the Classroom 50 question and leave **Write to a private instructor repository** and **Label assessed repositories in the organization list** ticked. All three are the defaults. Then commit the workflow to the template as usual.

If you already have a workflow file, add these lines under `with:` instead:

```yaml
          instructor_repo_token: ${{ secrets.INSTRUCTOR_REPO_TOKEN }}
          label_repos: "true"
```

That's all. The private repository is created automatically when the first student's questions are generated.

## Where to find it

After the first student's run, open:

```
https://github.com/{your-organization}/{assignment-name}-grillmycode-instructor
```

The repository is also listed with your organization's other repositories.

## Good to know

- **It's for Classroom 50 repositories only.** GrillMyCode works out the assignment and the student from the way Classroom 50 names repositories. In any other repository, it skips the answer key and adds a warning to the run.
- **It changes the questions slightly.** With the token in place, the AI also writes three wrong answers per question for the multiple-choice quiz. Students never see them, but each assessment costs a little more. Without the token, only the correct answers are generated.
- **Student repositories get labelled.** With labels ticked, once a student has questions, their repository shows a `grillmycode` topic and a question count in its description, so you can spot them in your organization's repository list. See [Tracking assessed repositories](tracking-repositories.md#repository-labels).
- **Check the run, not just the tick.** If the answer key can't be written, for example because the token has expired, the run still succeeds, because the student's questions were delivered fine. The problem shows as an error message on the run's summary page. See [Troubleshooting](../troubleshooting.md#the-run-is-green-but-nothing-arrived-in-the-instructor-repository).

---

**Go deeper:** [Instructor repository internals](../reference/instructor-repository.md): folder layout, file formats, how students are identified · [Tracking assessed repositories](tracking-repositories.md): resubmissions and repository labels · Recipe: [Private answer key](../example-workflows/1-instructor-repo.md)
