---
sidebar_position: 2
---

# Push to Branch

Generates assessment questions on every push to a non-default branch. Useful when students work directly on a feature or personal branch without opening a pull request. The assessment is always delivered as a GitHub Issue with a PDF download link.

Copy this file to `.github/workflows/grill-my-code.yml` in the student repository.

```yaml
name: GrillMyCode

on:
  push:
    branches-ignore: [main, master]

jobs:
  generate-questions:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: write        # gmc-assessments release + PDF asset
      issues: write          # assessment issue
      pull-requests: write   # PR link comment (not used for push, but harmless)
      models: read           # GitHub Models API
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0    # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

## Notes

- The assessment issue title and PDF filename both include the branch name to keep runs distinct — e.g. issue `GrillMyCode Questions (feat-login-form)` and PDF `grill-my-code-feat-login-form.pdf`
- No PR link comment is posted for push events (there is no PR to comment on)
