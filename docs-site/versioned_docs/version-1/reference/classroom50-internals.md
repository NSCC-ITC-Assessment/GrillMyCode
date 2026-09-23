---
sidebar_position: 8
---

# Classroom 50 internals

This page records how Classroom 50's own tooling interacts with student repositories, and why none of it affects an assessment. For setting up GrillMyCode with Classroom 50, see [Using GrillMyCode with Classroom 50](../guides/classroom50.md). For how template code is excluded, see [What code is assessed](code-selection.md#how-this-excludes-classroom-50-template-code).

## Classroom 50's own commits

Every commit Classroom 50's tooling makes is prefixed with `[Classroom 50]` (the `CommitPrefix` constant in the Classroom 50 CLI's shared contract). Most of them are written to the classroom's *config* repository and never reach a student repo. These are the ones that can appear in a student assignment repo:

| Commit subject | Authored by | Carries `[skip ci]` | Files touched |
| --- | --- | --- | --- |
| `Initialize .classroom50.yaml and autograde workflow (gh student accept)` | the student's own token | No | `.classroom50.yaml`, `.github/workflows/autograde.yaml`, and on a README-seeded repo the removal of that seeded `README.md` |
| `Open Feedback PR (gh student accept)` | whichever side opens the PR first — the student's token, the instructor's token, or `github-actions[bot]` in the autograde runner | Yes | None: an empty commit fast-forwarding the default branch so a zero-diff Feedback PR has a commit to exist on |
| `Submit <assignment>` | **the student** — this is their work | No | The student's full working tree, plus a refresh of the instructor's `.gitignore` and `.github` from the template |
| `Update autograder trigger to <mode> (submission-mode)` | the instructor's token, retrofitted into every existing student repo | Yes | `.github/workflows/autograde.yaml` |
| `Update assignment slug to <slug> (gh teacher assignment rename)` | the instructor's token | Yes | `.classroom50.yaml` |

None of these contaminate an assessment. Every file they touch is already excluded (`.classroom50.yaml`, `.gitignore`, and everything under `.github/workflows/**`), the Feedback-PR commit is empty, and the two instructor-side commits carry `[skip ci]`, so they never trigger a GrillMyCode run in the first place.

The last two rows are worth knowing about for a different reason: an instructor who changes an assignment's submission mode or renames it after students have accepted will see `[Classroom 50]` commits appear in student repos under their **own** name, days after accept. That is expected, and GrillMyCode ignores them.

:::caution Never filter Classroom 50 commits by their message prefix
It is tempting to treat `[Classroom 50]` as a marker for "not the student's work". It is not. `gh student submit` prefixes the student's own submission — the very code you want assessed — with `[Classroom 50] Submit <assignment>`. Filtering on the prefix would silently discard the work of every student who submits through the CLI rather than a plain `git push`. GrillMyCode deliberately filters by **file pattern** and by GitHub-verified committer identity, never by commit message.
:::
