---
sidebar_position: 5
---

# Instructor Setup

This page walks through everything an instructor needs to do to enable private instructor repository delivery — the feature that automatically stores a full question-and-answer assessment copy for every student in a private repository that only instructors can access.

Setup is split into two phases: a **one-time org setup** that you do once for your whole classroom organisation, and a **per-assignment setup** that you do once for each new assignment.

---

## Phase 1 — One-time org setup

Do this once. Every assignment you create afterwards picks it up automatically.

### Step 1 — Create an instructor PAT

Create a Personal Access Token that the action will use to create and write to the private instructor repository. The token must belong to an account that has permission to create repositories in the organisation (an org owner, or a member if the org allows member repo creation).

#### Classic PAT (recommended — simplest option)

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**.
2. Click **Generate new token (classic)**.
3. Give it a descriptive name, e.g. `GrillMyCode instructor delivery`.
4. Set an expiry that suits your retention policy (e.g. 1 year).
5. Select the **`repo`** scope (the full checkbox — this covers creating private org repos and reading/writing file contents) and the **`workflow`** scope (required to commit GitHub Actions workflow files into the instructor repository, and to keep them up to date afterwards).
6. Click **Generate token** and copy the value immediately.

#### Fine-grained PAT (more restrictive)

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**.
2. Click **Generate new token**.
3. Set **Resource owner** to your organisation.
4. Under **Organisation permissions**, grant **Administration: Read and Write** (required to create new repositories).
5. Under **Repository permissions**, grant **Contents: Read and Write** (required to write assessment files) and **Workflows: Read and Write** (required to commit GitHub Actions workflow files into the instructor repository, and to keep them up to date afterwards).
6. Click **Generate token** and copy the value.

:::note
Fine-grained tokens require the organisation to allow them. Check **Org → Settings → Personal access tokens → Allow access via fine-grained personal access tokens**.
:::

:::caution Already have an instructor PAT?
Tokens created before the `workflow` scope became a requirement need updating. Every delivery now
rewrites `.github/workflows/generate-lms-quiz.yml` when the action ships a newer copy, and GitHub
refuses any write under `.github/workflows/` from a token without that scope — so a `repo`-only
token produces a `Could not update .github/workflows/generate-lms-quiz.yml …` warning on **every
student push**, and the instructor repository stays on its original quiz-generation code.

Assessments are still delivered — the sync warns rather than fails — but the fixes never arrive.
To fix it, edit the existing classic token (**Settings → Developer settings → Tokens (classic) →
your token → Regenerate/Edit**) and tick **`workflow`** alongside **`repo`**, or add
**Workflows: Read and Write** to a fine-grained token. Update the `INSTRUCTOR_REPO_TOKEN` org
secret if regenerating produced a new value.
:::

---

### Step 2 — Add the token as an org-level Actions secret

Adding the secret at the organisation level means every student repository inherits it automatically — you never need to add it manually to individual repos.

1. Go to your **organisation → Settings → Secrets and variables → Actions**.
2. Click **New organisation secret**.
3. Name: **`INSTRUCTOR_REPO_TOKEN`**
4. Value: paste the PAT you created in Step 1.
5. Repository access: choose **All repositories** (or **Private repositories** if you prefer narrower scope).
6. Click **Add secret**.

---

## Phase 2 — Per-assignment setup

Do this once each time you create a new Classroom 50 assignment. It takes about one minute.

### Step 3 — Add the workflow to the assignment's starter repo

Open the **starter/template repository** for the assignment (the repo registered with `gh teacher assignment add --template <owner>/<repo>`). Add the following file:

**`.github/workflows/grill-my-code.yml`**

```yaml
name: GrillMyCode

on:
  push:
    branches: ["main", "master"]
  workflow_dispatch:

# A new push cancels any run still in progress for the same branch,
# so only the latest commit is ever assessed (see FAQ).
# Do not modify this setting unless you have a compelling reason to.
concurrency:
  group: grillmycode-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  generate-questions:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: write  # gmc-assessments release + PDF asset
      issues: write    # assessment issue
      models: read     # GitHub Models API
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0    # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          num_questions: "20"
          instructor_context: |
            Assignment 1 — Python functions. Prioritize conceptual
            questions about parameter design and return values, and at
            least one error identification question about what happens
            when an invalid argument is passed.
          instructor_repo_token: ${{ secrets.INSTRUCTOR_REPO_TOKEN }}
```

That's it. Every student repo created by `gh student accept` from this template receives this workflow file, since it's a copy of the template at accept time. The org-level secret (`INSTRUCTOR_REPO_TOKEN`) is available to all of them automatically.

---

## What happens on the first submission

When the first student pushes to the default branch:

1. The action runs in the student's repository using `GITHUB_TOKEN` (the student's built-in token) for all student-facing operations.
2. It uses `INSTRUCTOR_REPO_TOKEN` to check whether the instructor repository (`{assignment-name}-grillmycode-instructor`) exists in your org.
3. If it does not exist yet, the action **creates it automatically as a private repository**, commits a `generate-lms-quiz.yml` GitHub Actions workflow into it, and writes a descriptive `README.md` explaining the repository structure and contents. On every later run it refreshes both files whenever they differ from the copies shipped with the action, so existing instructor repositories receive quiz-generation fixes without any manual step. Both are action-owned — edit them in the repository and the next run puts them back.
4. It creates a `{student-login}/` folder in the instructor repo and writes the full Q+A assessment to `{student-login}/questions.md`.
5. That write automatically triggers the **Generate LMS Quiz** workflow in the instructor repository, which produces an IMS Common Cartridge / QTI quiz package (`{student-login}/{assignment-name}_{student-login}_quiz.imscc`) for that student, ready to import directly into Brightspace or any other Common Cartridge / QTI-compatible LMS. Every run checks all students but skips any whose `questions.md` is unchanged since their quiz was last built, so normally only the student who just pushed gets a new file; a change to the quiz package format rebuilds every student's quiz in a single run. The workflow can also be run manually from the Actions tab to regenerate every student's quiz at once.

For subsequent students the repo already exists — the action just adds or updates their individual file.

---

## Accessing the instructor repository

After the first student submission, find the instructor repository at:

```
https://github.com/{your-org}/{assignment-name}-grillmycode-instructor
```

Each student's assessment is stored in a dedicated folder:

```
README.md
{student-login}/
  questions.md
  {assignment-name}_{student-login}_quiz.imscc
```

For example, if your org is `my-school`, your assignment is `lab-3`, and a student's login is `jsmith`:

- Instructor repo: `https://github.com/my-school/lab-3-grillmycode-instructor`
- Student file: `https://github.com/my-school/lab-3-grillmycode-instructor/blob/main/jsmith/questions.md`
- Quiz package: `https://github.com/my-school/lab-3-grillmycode-instructor/blob/main/jsmith/lab-3_jsmith_quiz.imscc`

Re-running the action (e.g. when a student pushes more commits) overwrites the existing file — there is always exactly one up-to-date assessment per student.

---

## Assignments without a starter repo

If your Classroom 50 assignment is **template-less** (registered with `gh teacher assignment add` and no `--template`), GitHub does not set `template_repository` on the student's repo. The action falls back to stripping the student login suffix from the repo name to infer the assignment name.

Classroom 50 names student repos `<classroom>-<assignment>-<username>` (lowercased). The login-suffix strip only removes the trailing `-<username>`, so the inferred assignment name keeps the classroom slug attached. For example, a student repo `cs-principles-lab-3-jsmith` (classroom `cs-principles`, assignment `lab-3`, student `jsmith`) produces an instructor repo named `cs-principles-lab-3-grillmycode-instructor`, not `lab-3-grillmycode-instructor`. This is expected and stays consistent across the whole classroom — it just isn't the bare assignment slug.

Each run logs the name it inferred, so you can confirm it from the Actions log after the first submission — look for `Instructor repo: inferred assignment name "…"`. If the student's login is not found at the end of the repo name the strip cannot run, and the action falls back to the full repository name and raises a **workflow warning** instead; that case is worth checking, because the resulting instructor repo name may not be the one you expect.

For assignments without a starter repo, add the workflow file directly to each student repo (there is no template to ship it from).

## Assignment name vs. template repo name

For a **templated** assignment, the resolved assignment name is the **template repository's name** (`template_repository.name`), not necessarily the assignment slug students pass to `gh student accept`. Classroom 50 explicitly allows these to differ — a teacher can register a template repo called `cs50-hello-starter` under the assignment slug `hello`. In that case the instructor repo is named after the template (`cs50-hello-starter-grillmycode-instructor`), not the slug (`hello-grillmycode-instructor`). If you want the instructor repo name to match the slug students actually type, name your template repository the same as the slug.

---

## Setup summary

| What | When | Where |
|---|---|---|
| Create instructor PAT | Once per org | GitHub → Settings → Developer settings |
| Add `INSTRUCTOR_REPO_TOKEN` org secret | Once per org | Org → Settings → Secrets and variables → Actions |
| Add workflow file with `instructor_repo_token` | Once per assignment | Assignment's starter/template repo |
| Instructor repo created | Automatically on first student submission | `{org}/{assignment-name}-grillmycode-instructor` |
