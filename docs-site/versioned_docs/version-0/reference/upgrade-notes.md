---
sidebar_position: 11
---

# Upgrade notes

Notes for anyone upgrading a workflow, or an instructor repository, from an earlier GrillMyCode release. Newest changes first.

## GitHub Models was discontinued

GitHub **permanently discontinued GitHub Models**, so the endpoint GrillMyCode called no longer exists. This affects every version of GrillMyCode that offered `ai_provider: 'github-models'` — there is no configuration or token that will bring it back.

Current versions of GrillMyCode fail immediately with a message pointing here if a workflow still sets `ai_provider: 'github-models'`.

**To migrate**, update your workflow as follows:

1. **Create an OpenRouter API key** — sign up at [openrouter.ai](https://openrouter.ai/), add a small prepaid balance, and generate a key at [openrouter.ai/keys](https://openrouter.ai/keys).
2. **Store it as a secret** — add it as an organization-level Actions secret named `OPENROUTER_API_KEY` so all student repositories inherit it.
3. **Update the workflow** — remove `ai_provider: 'github-models'` (or set it to `'openrouter'`, which is now the default), replace the `ai_model` value with an OpenRouter `provider/model-name` identifier, and add `api_key`.

```diff
 permissions:
   contents: write
   issues: write

 steps:
   - uses: NSCC-ITC-Assessment/GrillMyCode@v0
     with:
       github_token: ${{ secrets.GITHUB_TOKEN }}
-      ai_provider: 'github-models'
-      ai_model: 'gpt-4.1'
+      ai_model: 'google/gemini-3.5-flash-lite'
+      api_key: ${{ secrets.OPENROUTER_API_KEY }}
```

The main practical difference is cost: GitHub Models was free within your GitHub quota, whereas OpenRouter bills per token. The [recommended models](../ai-providers/openrouter.md#recommended-models) are typically well under one cent per assessment, so a small prepaid balance covers a full class for a semester.

Workflows no longer need the `models: read` permission either. It is not used by anything, and can be removed from the `permissions:` block.

## Already have an instructor PAT?

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

## Instructor repository naming (upgrading from 0.2.8 or earlier)

Earlier releases named the instructor repository after the assignment's template repository when GitHub reported one, and could file an assessment under whoever pushed or started the run. Assessments now go to `<classroom>-<assignment>-grillmycode-instructor`. Any instructor repositories named after a template, or after a whole student repository (`…-jsmith-grillmycode-instructor`), are no longer written to and can be deleted once you have kept what you need from them.

## The first run after an upgrade regenerates every student's quiz

Expected, once. The quiz workflow decides what to rebuild by comparing a content hash stored inside
each `.imscc` and `.csv`. A repository that has just received an updated workflow has no current hashes on
file, so a single run rebuilds the package for **every** student, serialized by the workflow's
concurrency group. For a class of thirty that is a long run, not a broken one — subsequent pushes
go back to rebuilding only the student who pushed.

## An older instructor repository has two quiz workflows

Repositories created before the workflow was renamed still contain
`.github/workflows/generate-brightspace-quizzes.yml` alongside the `generate-lms-quiz.yml` the sync
now adds. The sync never deletes files, so the old one stays.

It is harmless where it sits — it has no `push:` trigger, so it never runs on its own (which is why
those repositories generated nothing on a student push before the sync existed). Dispatching it by
hand from the Actions tab, though, runs the old generator without any of the current fixes. Delete
it from the repository if you would rather not have it there; nothing in the action re-creates it.
