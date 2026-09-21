---
sidebar_position: 5
---

# PDF Asset Naming

GrillMyCode generates a PDF for every assessment and attaches it to a rolling GitHub Release tagged `gmc-assessments` in the student's repository. The asset is named after the repository — `grill-my-code-{repository}.pdf` — with any character other than a letter, digit, `-` or `_` replaced by `-`.

## Examples

| Repository | PDF asset filename |
|---|---|
| `cs-principles-lab-3-jsmith` | `grill-my-code-cs-principles-lab-3-jsmith.pdf` |
| `my.project` | `grill-my-code-my-project.pdf` |

A repository has one PDF asset for its push and manual runs, so it always holds the most recent assessment, whichever branch produced it.

## Submission tag runs

A run started by a [submission tag](../example-workflows/tag-submission.md) adds the tag's group — its `submission_tags` entry, reduced to the same filename-safe characters — so each milestone keeps its own PDF:

| Repository | `submission_tags` entry | PDF asset filename |
|---|---|---|
| `cs-principles-lab-3-jsmith` | `phase1` | `grill-my-code-cs-principles-lab-3-jsmith-phase1.pdf` |
| `cs-principles-lab-3-jsmith` | `phase*` (wildcard) | `grill-my-code-cs-principles-lab-3-jsmith-phase.pdf` |

Re-pushing a tag replaces that group's PDF, and every tag matching one wildcard entry shares a single asset.

## How the download URL works

The `browser_download_url` for a release asset follows the pattern:

```
https://github.com/{owner}/{repo}/releases/download/gmc-assessments/{filename}
```

Because the tag (`gmc-assessments`) and filename are stable across re-runs, the URL is the same every time. Re-running the action replaces the asset in the release — the URL stays the same, and the link in the issue body always points to the latest version.

## Accessing the PDF

The PDF download link is included in the body of every assessment issue. On a **private** repository the link requires the user to be signed into GitHub with access to the repository — this is expected behaviour for release assets on private repos.
