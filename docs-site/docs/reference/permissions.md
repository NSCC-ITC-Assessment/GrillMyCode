---
sidebar_position: 9
sidebar_label: Tokens, secrets and permissions
---

# Tokens, secrets and permissions

A GrillMyCode workflow uses up to three credentials:

| Input | Usual secret | Required | Used for |
|---|---|---|---|
| `github_token` | The built-in `GITHUB_TOKEN` | Yes (it's the default) | The assessment issue, the PDF release, and reading repository metadata |
| `api_key` | `OPENROUTER_API_KEY` | Yes | Generating questions through OpenRouter |
| `instructor_repo_token` | `INSTRUCTOR_REPO_TOKEN` | No | The instructor repository and repository markers |

All three are registered as secrets with the Actions runner before use, so they are masked in logs. Never expose any of them as a [manual-run form field](triggers.md#settings-to-keep-out-of-the-form).

## `github_token` and the `permissions` block

The workflow's built-in token needs two permissions, the same for every configuration, because the issue and the PDF are always delivered:

| Permission | Why |
|---|---|
| `contents: write` | Create and update the `gmc-assessments` release and its PDF asset |
| `issues: write` | Create and update the assessment issue |

Add this block to the `generate-questions` job. The Workflow Wizard and every recipe include it.

```yaml
permissions:
  contents: write  # gmc-assessments release + PDF asset
  issues: write    # assessment issue
```

Earlier versions also needed `models: read`. It is no longer used and can be removed; see [Upgrade notes](upgrade-notes.md#github-models-was-discontinued).

`github_token` is not used to generate questions, and OpenRouter can't be reached with it.

## `api_key`

Your OpenRouter API key. The action fails immediately with a setup message if it is empty. Create one at [openrouter.ai/keys](https://openrouter.ai/keys) and store it as an **organization** secret, so every student repository can use it; see [Get started](../getting-started/openrouter-key.md). Every repository shares the key, so rate limits and spending are pooled across the class.

## `instructor_repo_token`

Optional. A personal access token (PAT) used only for the [instructor repository](instructor-repository.md) and the [repository marker](repository-marker.md). It is never passed to the student-facing steps, and the workflow's `GITHUB_TOKEN` is never given access to the instructor repository. That separation is what keeps the answer key out of reach of anyone who can read the student's repository or its logs.

The token must belong to an account that can create repositories in the organization: an organization owner, or a member if the organization allows members to create repositories. Store it as the organization secret `INSTRUCTOR_REPO_TOKEN`. If the secret is limited to selected repositories, include the instructor repositories as well, because the [marker reconciliation sweep](repository-marker.md#keeping-markers-true-the-reconciliation-sweep) runs there.

When it is empty or not set, instructor delivery is skipped, and the model is asked for correct answers only, without multiple-choice distractors.

### Classic PAT (recommended — simplest option)

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)**.
2. Click **Generate new token (classic)**.
3. Give it a descriptive name, e.g. `GrillMyCode instructor delivery`.
4. Set an expiry that suits your retention policy (e.g. 1 year).
5. Select the **`repo`** scope (the full checkbox — this covers creating private org repos and reading/writing file contents) and the **`workflow`** scope (required to commit GitHub Actions workflow files into the instructor repository, and to keep them up to date afterwards).
6. Click **Generate token** and copy the value immediately.

### Fine-grained PAT (more restrictive)

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**.
2. Click **Generate new token**.
3. Set **Resource owner** to your organization.
4. Under **Organization permissions**, grant **Administration: Read and Write** (required to create new repositories).
5. Under **Repository permissions**, grant **Contents: Read and Write** (required to write assessment files) and **Workflows: Read and Write** (required to commit GitHub Actions workflow files into the instructor repository, and to keep them up to date afterwards).
6. Click **Generate token** and copy the value.

:::note
Fine-grained tokens require the organization to allow them. Check **Org → Settings → Personal access tokens → Allow access via fine-grained personal access tokens**.
:::

A token created before the `workflow` scope was required needs updating; see [Upgrade notes](upgrade-notes.md#already-have-an-instructor-pat).
