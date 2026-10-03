# GrillMyCode for VS Code

See the questions [GrillMyCode](https://grillmycode.org) wrote about your code, right beside the code they ask about.

GrillMyCode is a GitHub Action your instructor adds to an assignment. Each time you push, it reads what you changed and posts a set of comprehension questions as an issue in your repository. This extension brings those questions into the editor.

## What it does

- **Lists your questions** in the GrillMyCode view, grouped by file.
- **Jumps to the code.** Select a question to open the file and highlight the lines it asks about.
- **Shows the whole question** under the list, with the code as it was when the question was written.
- **Warns you when the code has moved.** If you have changed a file since the questions were written, the highlighted lines may no longer be the right ones, and the view says so.

## Getting started

1. Open the folder of an assignment that uses GrillMyCode.
2. Select the GrillMyCode icon in the Activity Bar.
3. Choose **Sign in to GitHub** and approve the request.

Your questions appear once you have pushed and the GrillMyCode workflow has finished. Use **Refresh Questions** after a later push.

If the repository has questions for more than one branch or submission, use **Choose Which Questions to Show**.

## What it needs

The extension reads the questions issue in your repository through your GitHub account. GitHub offers one permission for reading a private repository this way, which is full access to your repositories, so that is what the sign-in asks for. The extension uses it only to read the questions issue. It changes nothing on GitHub and sends nothing anywhere else.

## Not yet

The extension does not generate questions and does not show answers.
