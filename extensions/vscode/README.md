# GrillMyCode Companion

The companion to [GrillMyCode](https://grillmycode.org) in VS Code. See the questions GrillMyCode wrote about your code, right beside the code they ask about.

GrillMyCode is a GitHub Action your instructor adds to an assignment. Each time you push, it reads what you changed and posts a set of comprehension questions as an issue in your repository. GrillMyCode Companion brings those questions into the editor.

![VS Code with the GrillMyCode view open. The questions list is grouped by file, with question 1 selected. The editor shows cart.js with lines 1 to 9 highlighted, and the whole question is shown under the list with its code.](https://grillmycode.org/img/screenshots/vscode-extension-questions.png)

## What it does

- **Lists your questions** in the GrillMyCode view, grouped by file.
- **Jumps to the code.** Select a question to open the file and highlight the lines it asks about. A question about several files opens each one in a tab of its own.
- **Steps through your questions.** **Next Question** and **Previous Question**, at the top of the list, open each one in turn.
- **Shows the whole question** under the list, with the code as it was when the question was written.
- **Warns you when the code has moved.** If you have changed a file since the questions were written, the highlighted lines may no longer be the right ones, and the view says so.

## Getting started

1. Open the folder of an assignment that uses GrillMyCode.
2. Select the GrillMyCode icon in the Activity Bar.
3. Choose **Sign in to GitHub** and approve the request.

Your questions appear once you have pushed and the GrillMyCode workflow has finished. Use **Refresh Questions** after a later push.

VS Code opens a walkthrough of these steps when the extension is installed. To see it again, run **Welcome: Open Walkthrough...** from the Command Palette and choose **Get Started with GrillMyCode Companion**.

If the repository has questions for more than one branch or submission, use **Choose Which Questions to Show**.

## For instructors

If your assignment keeps a private answer key, open a student's repository and sign in. GrillMyCode Companion shows each question with its answer, beside the student's code.

GitHub decides who sees this: the extension shows answers only to an account that can read the assignment's instructor repository. In your own test repository it starts in the view students get, and **Show Instructor View** switches. **Show Student View** switches back, which is worth doing before you share your screen.

When you edit a workflow that uses GrillMyCode, the extension checks the action's inputs as you type. It underlines a value GrillMyCode would reject or ignore, an API key written into the file, and inputs that do not fit together, and it offers the values of an input that has a fixed set. To switch this off, clear **Workflow Help: Enabled** in the extension's settings.

To write that workflow in the first place, run **GrillMyCode: Open Workflow Wizard** from the Command Palette. It opens GrillMyCode's [Workflow Wizard](https://grillmycode.org/docs/workflow-wizard) in an editor tab, which asks about your assignment one step at a time. In the editor it can try your choice of files on the folder you have open, and it creates the workflow file there. Its model step reads OpenRouter's public list of models. Nothing about your folder is sent anywhere.

## What it needs

The extension reads the questions issue in your repository through your GitHub account. GitHub offers one permission for reading a private repository this way, which is full access to your repositories, so that is what the sign-in asks for. The extension uses it to read the questions issue, and to check whether the account can read the assignment's answer key. It changes nothing on GitHub and sends nothing anywhere else.

## Not yet

GrillMyCode Companion does not generate questions, and it does not show answers to students. The questions come from the GrillMyCode action your instructor set up.
