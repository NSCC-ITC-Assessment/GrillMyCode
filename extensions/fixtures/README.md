# Extension fixtures

Sample questions issues, exactly as the GrillMyCode action posts them, each
paired with what an extension should read from it. Every editor extension
tests its report reader against these files, whatever language it is written
in, so they are the contract between the action and the extensions.

Each case is a folder of three files:

| File            | What it holds                                                  |
| --------------- | -------------------------------------------------------------- |
| `issue.json`    | The title and labels the issue was created with                |
| `body.md`       | The issue's body, byte for byte                                |
| `expected.json` | The group, report details and questions a reader should return |

`expected.json` gives `headCommit`, the full SHA of the head commit, only where
the issue carries it as hidden data.

All names are fictional: the organization `my-school`, the repository
`cs-principles-lab-3-jsmith` and the student `jsmith`.

## Folders

- **`current/`** is generated. It is the layout the action writes today. Do
  not edit it by hand.
- **Any other folder** is a layout an earlier release wrote, kept so the
  extensions go on reading it. These are never regenerated.

| Folder     | Layout                                                                       |
| ---------- | ---------------------------------------------------------------------------- |
| `v0.24/`   | Markdown only, as posted up to v0.24                                         |
| `current/` | Layout version 1: the same Markdown, with the hidden `gmc:questions` comment |

The comment's `version` is `ISSUE_LAYOUT_VERSION` in `src/constants.js`. Raise
it with any change that needs a new folder here, so that an extension written
for the layout before asks to be updated instead of misreading the issue.

Prettier leaves both alone (`.prettierignore`): a reformatted fixture would no
longer be what the action posts.

## When the report or the issue changes

`test/extension-fixtures.test.js` fails when `current/` no longer matches what
the action writes. Before regenerating, decide which kind of change it is.

**The layout is the same and only the samples differ**, for example a new case
was added to the script:

```bash
node scripts/build-extension-fixtures.js
```

**The layout itself changed**, so an issue posted by the release before would
look different from one posted now:

1. Copy `current/` to a folder named for the last release that wrote the old
   layout, for example `v0.24/`.
2. Run `node scripts/build-extension-fixtures.js`.
3. Update each extension's reader until it reads both folders. Workflows float
   on a major tag, so issues in the old layout stay open in students'
   repositories long after the release.

`expected.json` is written from the questions that went into the action, not
by reading `body.md` back, so a reader that turns `body.md` into
`expected.json` has made the whole round trip.
