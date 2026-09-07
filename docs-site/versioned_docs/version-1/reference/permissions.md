---
sidebar_position: 4
---

# Permissions

GrillMyCode always creates a GitHub Issue and generates a PDF — these are the fixed delivery surfaces. The required permissions are therefore the same for every configuration.

| Permission | Why |
|---|---|
| `contents: write` | Create and update the `gmc-assessments` release and its PDF asset |
| `issues: write` | Create and update the assessment issue |

## Required permissions block

```yaml
permissions:
  contents: write  # gmc-assessments release + PDF asset
  issues: write    # assessment issue
```

:::note
Earlier versions also required a `models: read` scope. It is no longer used by anything and can be removed from existing workflows — see the [FAQ](../faq.md#ive-used-github-models-with-grillmycode-in-the-past-and-now-they-no-longer-function-why) if an older workflow of yours has stopped generating questions.
:::

Add this block to the `generate-questions` job in your workflow. The Workflow Wizard generates it automatically.
