---
sidebar_position: 8
sidebar_label: Repository marker
---

# Repository marker

**Use this when** you want to see, straight from your organization's repository list, which student repositories have questions. It needs the [private answer key](1-instructor-repo.md) token.

```yaml title=".github/workflows/grill-my-code.yml"
name: GrillMyCode

on:
  push:
    branches: ["main", "master"]
  workflow_dispatch:

# A new push cancels any run still in progress for the same branch,
# so only the latest commit is ever assessed.
# Do not modify this setting unless you have a compelling reason to.
concurrency:
  group: grillmycode-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  generate-questions:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: write # gmc-assessments release + PDF asset
      issues: write # assessment issue
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0 # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          api_key: ${{ secrets.OPENROUTER_API_KEY }}
          num_questions: "20"

          # The token the marker needs. Also stores the private answer key.
          instructor_repo_token: ${{ secrets.INSTRUCTOR_REPO_TOKEN }}

          # Mark the repository once questions exist.
          repo_marker: "both"
```

## Change these

- **`repo_marker`:** one of these values.

| Value | Writes |
|---|---|
| `off` | Nothing (the default) |
| `topic` | The `grillmycode` topic. Filterable with `org:<your-org> topic:grillmycode` |
| `description` | `· 🔥 GrillMyCode: N questions` at the end of the description. The only mark that shows the count |
| `both` | Both |

Before and after, in the organization's repository list:

```
cs-principles-lab-3-jsmith
Week 3 lab
```

```
cs-principles-lab-3-jsmith
Week 3 lab · 🔥 GrillMyCode: 20 questions
grillmycode
```

## Good to know

- Your own topics are kept, and the description note replaces itself rather than piling up.
- A daily workflow in the instructor repository removes marks whose assessment issue has been closed.
- GitHub shows topics in some list views and not others; check it appears where you look.
- No setup needed at all: `org:<your-org> is:issue is:open label:assessment` lists repositories with live questions.

## Related

[Tracking assessed repositories](../guides/tracking-repositories.md) · [Repository marker internals](../reference/repository-marker.md)
