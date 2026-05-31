---
sidebar_position: 2
---

# Push to Branch

Generates assessment questions on every push to a non-default branch. Useful when students work directly on a feature or personal branch without opening a pull request. The output file is written back to the repository.

Copy this file to `.github/workflows/grill-my-code.yml` in the student repository.

```yaml
name: GrillMyCode

on:
  push:
    branches-ignore: [main, master]

jobs:
  generate-questions:
    runs-on: ubuntu-latest
    permissions:
      contents: write       # required to commit the output file back to the repo
      models: read          # required to call GitHub Models API
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0    # full history required for diff resolution

      - uses: NSCC-ITC-Assessment/GrillMyCode@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          post_pr_comment: "false"
          output_file: "grill-my-code.md"
```

## Notes

- `post_pr_comment: "false"` disables the PR comment since there may be no open PR for this branch
- `contents: write` is required to commit the `.assessment/` file back to the repository
- The output file includes the branch name to avoid collisions — e.g. `.assessment/grill-my-code-feat-login-form.md`
