---
sidebar_position: 4
---

# Post to GitHub Discussions

Creates a GitHub Discussion for each assessment run. Useful for class-wide visibility or when instructors prefer a forum-style record of assessments.

If Discussions are not enabled on the repository when the action runs, they are **enabled automatically**. The named category (e.g. `GrillMyCode`) must already exist in the repository's Discussions settings before the first run, or the action will fail.

Each run supersedes the previous: existing open assessment discussions for the same branch are commented (noting the superseding run) and **locked** before a new one is created.

Copy this file to `.github/workflows/grill-my-code.yml` in the student repository.

```yaml
name: Grill My Code

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  generate-questions:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      discussions: write    # required to create the GitHub Discussion
      administration: write # required only if Discussions may not yet be enabled
      models: read          # required to call GitHub Models API
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0    # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          post_discussion: "true"
          discussion_category: "GrillMyCode"
          post_pr_comment: "false"
          num_questions: "20"
          additional_context: "Assignment 4 — Database design and SQL queries"
```

## Prerequisites

1. Create a Discussion category named `GrillMyCode` (or whatever you pass as `discussion_category`) in **Settings → Discussions** on the repository before the first run
2. Add `administration: write` to the permissions block the first time, so the action can enable Discussions if they are not already on. You can remove it once Discussions are confirmed enabled

:::note[GraphQL API]

The Discussions API uses GraphQL, not REST. The action handles this transparently — no additional configuration is needed.

:::
