---
sidebar_position: 5
---

# PDF Asset Naming

GrillMyCode generates a PDF for every assessment and attaches it to a rolling GitHub Release tagged `gmc-assessments` in the student's repository. The asset filename follows the same branch-aware naming convention as the assessment issue title.

On the default branch (`main`/`master`) the file is named `grill-my-code.pdf`. On any other branch the sanitised branch name is appended before the extension, so each branch produces a distinct file without collisions.

## Examples

| Branch | PDF asset filename |
|---|---|
| `main` | `grill-my-code.pdf` |
| `feat/login-form` | `grill-my-code-feat-login-form.pdf` |
| `student/a1` | `grill-my-code-student-a1.pdf` |

## How the download URL works

The `browser_download_url` for a release asset follows the pattern:

```
https://github.com/{owner}/{repo}/releases/download/gmc-assessments/{filename}
```

Because the tag (`gmc-assessments`) and filename are stable across re-runs, the URL is the same every time. Re-running the action replaces the asset in the release — the URL stays the same, and the link in the issue body always points to the latest version.

## Accessing the PDF

The PDF download link is included in the body of every assessment issue. On a **private** repository the link requires the user to be signed into GitHub with access to the repository — this is expected behaviour for release assets on private repos.
