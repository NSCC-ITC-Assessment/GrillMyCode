---
sidebar_position: 2
---

# Exclude Patterns

The `exclude_patterns` input controls which files are excluded from the assessed diff.

## Default behaviour

When no `exclude_patterns` value is provided, a built-in list of common non-code files is used automatically. This list covers:

- Package lock files (`**/*.lock`, `**/pnpm-lock.yaml`, etc.)
- Dependency directories (`node_modules/**`)
- Build outputs and minified assets (`dist/**`, `build/**`, `**/*.min.js`)
- Images and binary files (`**/*.png`, `**/*.jpg`, `**/*.pdf`, etc.)
- Markdown files (`**/*.md`) — excluded from the assessed diff by default, since they typically describe the assignment rather than the student's solution. They can still be passed to the AI via [`assignment_context`](../reference/inputs-outputs.md)

### Default patterns

| JavaScript / Frontend | Python | Java · Ruby · PHP · .NET · C/C++ | Text assets & Misc |
|---|---|---|---|
| `node_modules/**`<br/>`**/*.lock`<br/>`package-lock.json`<br/>`yarn.lock`<br/>`pnpm-lock.yaml`<br/>`**/*.min.js`<br/>`**/*.min.css`<br/>`dist/**`<br/>`build/**`<br/>`out/**`<br/>`coverage/**`<br/>`.nyc_output/**`<br/>`.next/**`<br/>`.svelte-kit/**`<br/>`.astro/**`<br/>`.expo/**`<br/>`.parcel-cache/**`<br/>`.turbo/**` | `__pycache__/**`<br/>`**/*.pyc`<br/>`.venv/**`<br/>`venv/**`<br/>`.pytest_cache/**`<br/>`**/*.egg-info/**`<br/>`.tox/**` | **Java**<br/>`target/**`<br/>`.gradle/**`<br/><br/>**Ruby**<br/>`.bundle/**`<br/><br/>**PHP / Go**<br/>`vendor/**`<br/><br/>**.NET**<br/>`obj/**`<br/><br/>**C / C++**<br/>`CMakeFiles/**`<br/>`cmake-build-*/**`<br/>`CMakeCache.txt` | `.git/**`<br/>`.gitignore`<br/>`**/*.svg`<br/>`**/*.md`<br/>`**/*.map`<br/>`**/*.log`<br/>`.assessment/**` |

## Custom patterns

The default list is **always applied**. Any patterns supplied via `exclude_patterns` are merged with the defaults — they extend it, not replace it. Use this to exclude additional files specific to your assignment:

```yaml
- uses: NSCC-ITC-Assessment/GrillMyCode@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    # These are added on top of the built-in defaults
    exclude_patterns: 'tests/**,docs/**,data/**'
```

## Override exclude patterns

If a file is excluded by default but you want it included in the assessed diff, use `exclude_pattern_overrides`. Each entry can be:

- An **exact pattern from the default list** — re-includes everything matched by that pattern:
  ```yaml
  exclude_pattern_overrides: '**/*.md'   # re-includes all Markdown files
  ```
- A **specific file path** — only that one file passes through while the default pattern still excludes everything else:
  ```yaml
  exclude_pattern_overrides: 'README.md' # only README.md; other .md files stay excluded
  ```

Both forms can be combined:

```yaml
exclude_pattern_overrides: 'README.md, docs/brief.md'
```

## Workflow files

GitHub Actions workflow files (`.github/workflows/**`) are excluded by default via the `exclude_workflow_files` input (which defaults to `true`). Set it to `"false"` to include them:

```yaml
exclude_workflow_files: 'false'
```
