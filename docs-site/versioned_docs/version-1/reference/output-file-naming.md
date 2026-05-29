---
sidebar_position: 3
---

# Output File Naming

All assessment files are written under the `.assessment/` folder in the repository. Any directory component of the `output_file` setting is ignored — only the basename is used.

On the default branch (`main`/`master`) the file keeps the configured basename. On any other branch the sanitised branch name is appended before the extension, so each branch produces a distinct file without collisions.

## Examples

| Branch | `output_file` setting | Actual file written |
|---|---|---|
| `main` | `grill-my-code.md` | `.assessment/grill-my-code.md` |
| `feat/login-form` | `grill-my-code.md` | `.assessment/grill-my-code-feat-login-form.md` |
| `student/a1` | `assessment.md` | `.assessment/assessment-student-a1.md` |

## Why this matters

Each branch getting its own file means:

- Assessment history is preserved per-branch without overwriting
- Instructors can see assessments for all branches at a glance in the `.assessment/` folder
- Re-triggering on the same branch updates the same file rather than accumulating duplicates

## Skip writing the file

If you do not want the action to commit a file to the repository, omit `contents: write` from the permissions block. The action will still generate questions and post them via the configured delivery method (PR comment, issue, or discussion) but will skip the file commit with a warning.
