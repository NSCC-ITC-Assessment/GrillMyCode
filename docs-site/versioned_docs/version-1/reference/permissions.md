---
sidebar_position: 2
---

# Permissions

The action only requests the permissions it needs for the chosen delivery method.

| Permission | When required |
|---|---|
| `contents: read` | Always — needed to check out the repo and read the git history |
| `contents: write` | When writing the output file back to the repository |
| `models: read` | When using the `github-models` provider (the default) |
| `pull-requests: write` | When `post_pr_comment: 'true'` |
| `issues: write` | When `post_issue: 'true'` |

## Minimal permissions example (PR comment only)

```yaml
permissions:
  contents: read
  pull-requests: write
  models: read
```

## Writing output file to the repository

When using a `push` trigger (or any other event where no PR exists), you need `contents: write` to commit the assessment file back:

```yaml
permissions:
  contents: write
  models: read
```

## All delivery methods enabled

```yaml
permissions:
  contents: write
  pull-requests: write
  issues: write
  models: read
```
