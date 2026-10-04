---
sidebar_position: 11
---

# Upgrade notes

Notes for anyone upgrading a workflow, or an instructor repository, from an earlier GrillMyCode release. Newest changes first.

## The issue carries hidden data, and only GrillMyCode's own issues are replaced

Nothing to change in a workflow. Each assessment issue now holds its questions' numbers, files and lines as [hidden data](assessment-output.md#hidden-data), which the VS Code extension reads.

- **Issues posted by an earlier release** are still recognized, and the next run updates them as before.
- **An issue a person wrote** with the same title and the `assessment` label used to be overwritten, or deleted as a duplicate. It is now left alone. See [When the questions are regenerated](assessment-output.md#when-the-questions-are-regenerated).
- **GrillMyCode Companion 0.2.0 and earlier** read the new issues as they did the old ones.

## Quizzes are built from `data/questions.json`

Each run now writes a [`questions.json`](instructor-repository.md#questionsjson) in a `data/` subfolder of the student's folder, and the quiz workflow builds the quiz from it alone. `raw-ai-output.md` moved into `data/` too.

- **Folders assessed by an earlier release** have no `data/questions.json`, so the quiz workflow skips them. Their existing quiz files are left as they are. To rebuild a student's quiz, run GrillMyCode for that student again. The old `raw-ai-output.md` at the top of the folder isn't removed; delete it if you like.
- **To correct a question in the quiz**, edit it in `data/questions.json`. Editing `questions.md` doesn't change the quiz.

## The first run after an upgrade regenerates every student's quiz

Expected, once. The quiz workflow decides what to rebuild by comparing a content hash stored inside
each `.imscc` and `.csv`. A repository that has just received an updated workflow has no current hashes on
file, so a single run rebuilds the package for **every** student, serialized by the workflow's
concurrency group. For a class of thirty that is a long run, not a broken one — subsequent pushes
go back to rebuilding only the student who pushed.
