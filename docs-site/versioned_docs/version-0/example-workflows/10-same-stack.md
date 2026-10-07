---
sidebar_position: 4.6
sidebar_label: Same stack for every student
---

# Same stack for every student

**Use this when** every student's repository should have its files chosen by the same rules, whatever a student adds to it. It suits an assignment whose starter template fixes the language and the folder layout.

The workflow names the stack templates, so no run detects its own.

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

      - uses: NSCC-ITC-Assessment/GrillMyCode@v0
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          api_key: ${{ secrets.OPENROUTER_API_KEY }}
          # Every repository gets these stack templates. Remove this line to
          # have the stack detected in each repository instead.
          stack_templates: 'Node, Nextjs, Composer@api, Laravel@api'
```

## Change these

- **`stack_templates`:** the templates for your assignment. A name alone applies at the top of the repository; `Laravel@api` applies inside `api/`.

## Good to know

- The Wizard writes this line for you: on its **Files** step, preview your solution folder and tick **Use these templates for every student**.
- The summary of any run that detects its stack shows the value for that repository, in the **Stack templates** row of **Configuration used by this run**.
- A template you don't name is never applied. Leave the input out if students choose their own language or framework.
- A name the action doesn't know is ignored with a warning. The run doesn't fail.

## Related

[Choosing which files are assessed](../guides/choosing-files.md#trying-your-patterns-first) · [Using the same stack for every student](../reference/exclude-patterns.md#using-the-same-stack-for-every-student) · [Preview the files](9-preview-files.md)
