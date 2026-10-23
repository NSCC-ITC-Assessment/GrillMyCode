---
sidebar_position: 14
sidebar_label: "For students: questions in JetBrains IDEs"
---

# Your questions in JetBrains IDEs

This page is for students. Your instructor uses GrillMyCode, which posts questions about your code as an issue in your assignment's repository. The **GrillMyCode Companion** plugin shows those questions in IntelliJ IDEA, PyCharm, WebStorm and the other JetBrains IDEs, beside the code they ask about.

You don't have to use it. The same questions are always in your repository's **Issues** tab on GitHub.

## Install it

You need a JetBrains IDE from version 2025.1 or later.

1. Open **Settings**, and select **Plugins**.
2. Select the **Marketplace** tab, search for `GrillMyCode Companion`, and select **Install**.

The first time you install a plugin that JetBrains didn't make, the IDE asks you to accept a privacy note about third-party plugins. Accept it to carry on. If the IDE asks to restart, let it.

## See your questions

1. Open your assignment's folder in the IDE. It has to be the repository you cloned from GitHub.
2. Open the **GrillMyCode** tool window from the strip of icons at the right of the window. You can also find it under **View | Tool Windows**.
3. Select **Sign in to GitHub**. The IDE shows a code: select **Copy Code and Open GitHub**, paste the code on the GitHub page that opens, and authorize **GrillMyCode Companion**.

You sign in once. The IDE remembers it for every project.

Your questions appear once you have pushed your work and GrillMyCode has finished, which takes a few minutes. They show up in the list on their own, and the IDE tells you when they arrive.

![IntelliJ IDEA with the GrillMyCode tool window open on the right. The questions list is grouped by file, with question 11 selected and shown in full below the list, with its code. The editor shows story.php with line 50 highlighted.](/img/screenshots/jetbrains-plugin-questions.png)

- **Select a question** to read it in full below the list, with the code as it was when the question was written.
- **Double-click a question**, or press **Enter**, to open its file with the lines it asks about highlighted. A question about several files opens each one in a tab of its own, and has a row under it for each piece of code.
- **To go through your questions one at a time**, select **Next Question** or **Previous Question**, the two arrows at the top of the tool window.
- **Broader questions**, at the end of the list, are about your work as a whole and don't point at particular lines.
- **After you push again**, the IDE tells you when the new set has arrived. The list stays as it is until you select **Show New Questions** in that message, or **Refresh Questions** at the top of the tool window.
- **If you have more than one set of questions**, for example one for each submission, select **Choose Which Questions to Show** at the top of the tool window.

## When the highlighted lines look wrong

The questions were written about your code as it was when you pushed. If you have edited a file since then, the lines may have moved, and a note above the list says so. The code shown under the question is always the code the question is about.

## What the sign-in asks for

The plugin reads your questions through your GitHub account. GitHub offers one permission for reading a private repository this way, which is access to your repositories, so that is what the sign-in asks for. The plugin uses it to read your questions, and to check whether the account is an instructor's. It changes nothing on GitHub and sends nothing anywhere else. To sign out, select **Tools | GrillMyCode | Sign Out of GitHub**.

## If your questions don't appear

The GrillMyCode tool window says what it is waiting for:

- **"This project is open in safe mode…"** The IDE holds back some features in a project you haven't said you trust. Use the bar at the top of the editor to trust the project.
- **"Open a project that is a clone of a GitHub repository…"** Open the assignment's folder itself, not a folder above it or a copy you downloaded as a ZIP file.
- **"GitHub could not find this repository for the account that is signed in."** You signed in with a different GitHub account from the one that owns the assignment. Sign out from **Tools | GrillMyCode**, and sign in with the right one.
- **"The … organization on GitHub has not approved GrillMyCode Companion…"** Your school's GitHub organization has to allow the plugin first. Tell your instructor. You can also select **Ask on GitHub** and request approval there.
- **"These questions were written by a newer version of GrillMyCode than this plugin can read."** Your copy of the plugin is out of date. Select **Show plugins**, update it there, then select **Refresh**. Until then, your questions are in the repository's **Issues** tab on GitHub.
- **"No GrillMyCode questions were found for this repository."** Check that you have pushed, and wait a few minutes. Select **Refresh** to look straight away. If there is no **GrillMyCode Questions** issue in the repository's **Issues** tab on GitHub either, ask your instructor.
