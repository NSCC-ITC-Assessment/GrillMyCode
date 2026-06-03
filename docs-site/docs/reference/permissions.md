---
sidebar_position: 4
---

# Permissions

GrillMyCode always creates a GitHub Issue and generates a PDF — these are the fixed delivery surfaces. The required permissions are therefore the same for every configuration.

| Permission | Why |
|---|---|
| `contents: write` | Create and update the `gmc-assessments` release and its PDF asset |
| `issues: write` | Create and update the assessment issue |
| `models: read` | Call the GitHub Models API (when using the `github-models` provider) |

## Required permissions block

```yaml
permissions:
  contents: write  # gmc-assessments release + PDF asset
  issues: write    # assessment issue
  models: read     # GitHub Models API (remove if using openrouter)
```

Add this block to the `generate-questions` job in your workflow. The Workflow Wizard generates it automatically.
