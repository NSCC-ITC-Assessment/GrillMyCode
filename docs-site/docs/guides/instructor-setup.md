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
5. Select the **`repo`** scope (the full checkbox — this covers creating private org repos and reading/writing file contents) and the **`workflow`** scope (required to commit GitHub Actions workflow files into the instructor repository).
6. Click **Generate token** and copy the value immediately.

#### Fine-grained PAT (more restrictive)

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**.
2. Click **Generate new token**.
3. Set **Resource owner** to your organisation.
4. Under **Organisation permissions**, grant **Administration: Read and Write** (required to create new repositories).
5. Under **Repository permissions**, grant **Contents: Read and Write** (required to write assessment files) and **Workflows: Read and Write** (required to commit GitHub Actions workflow files into the instructor repository).
6. Click **Generate token** and copy the value.

:::note
Fine-grained tokens require the organisation to allow them. Check **Org → Settings → Personal access tokens → Allow access via fine-grained personal access tokens**.
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

Do this once each time you create a new Classroom assignment. It takes about one minute.

### Step 3 — Add the workflow to the assignment's starter repo

Open the **starter/template repository** for the assignment (the repo you set as the starter code in GitHub Classroom). Add the following file:

**`.github/workflows/grill-my-code.yml`**

```yaml
name: Code Assessment

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  generate-questions:
    runs-on: ubuntu-latest
    permissions:
      contents: write       # required to commit the output file back to the repo
      pull-requests: write  # required to post the PR comment
      models: read          # required to call GitHub Models API
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0    # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          num_questions: "5"
          additional_context: "Replace this with a short description of the assignment"
          instructor_repo_token: ${{ secrets.INSTRUCTOR_REPO_TOKEN }}
```

That's it. When GitHub Classroom distributes the assignment, every student repository receives this workflow file. The org-level secret (`INSTRUCTOR_REPO_TOKEN`) is available to all of them automatically.

---

## What happens on the first submission

When the first student opens a pull request:

1. The action runs in the student's repository using `GITHUB_TOKEN` (the student's built-in token) for all student-facing operations.
2. It uses `INSTRUCTOR_REPO_TOKEN` to check whether the instructor repository (`{assignment-name}-grillmycode`) exists in your org.
3. If it does not exist yet, the action **creates it automatically as a private repository**.
4. It creates a `{student-login}/` folder in the instructor repo and writes the full Q+A assessment to `{student-login}/questions.md`.

For subsequent students the repo already exists — the action just adds or updates their individual file.

---

## Accessing the instructor repository

After the first student submission, find the instructor repository at:

```
https://github.com/{your-org}/{assignment-name}-grillmycode
```

Each student's assessment is stored in a dedicated folder:

```
{student-login}/questions.md
```

For example, if your org is `my-school`, your assignment is `lab-3`, and a student's login is `jsmith`:

- Instructor repo: `https://github.com/my-school/lab-3-grillmycode`
- Student file: `https://github.com/my-school/lab-3-grillmycode/blob/main/jsmith/questions.md`

Re-running the action (e.g. when a student pushes more commits) overwrites the existing file — there is always exactly one up-to-date assessment per student.

---

## Assignments without a starter repo

If your Classroom assignment has no starter code repository, GitHub does not set `template_repository` on student repos. The action falls back to stripping the student login suffix from the repo name to infer the assignment name. For example, a student repo named `lab-3-jsmith` with student login `jsmith` produces an instructor repo named `lab-3-grillmycode`.

A workflow warning is emitted on each run to confirm the inferred name — check it after the first submission to verify the instructor repo was created with the expected name.

For assignments without a starter repo, add the workflow file directly to each student repo (or use a Classroom-level default workflow if your org has one configured).

---

## Setup summary

| What | When | Where |
|---|---|---|
| Create instructor PAT | Once per org | GitHub → Settings → Developer settings |
| Add `INSTRUCTOR_REPO_TOKEN` org secret | Once per org | Org → Settings → Secrets and variables → Actions |
| Add workflow file with `instructor_repo_token` | Once per assignment | Assignment's starter/template repo |
| Instructor repo created | Automatically on first student submission | `{org}/{assignment-name}-grillmycode` |
