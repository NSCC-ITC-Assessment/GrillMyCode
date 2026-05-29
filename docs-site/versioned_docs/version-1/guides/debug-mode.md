---
sidebar_position: 4
---

# Debug Mode

GrillMyCode supports GitHub Actions' built-in debug logging mechanism. When enabled, the action emits two additional log entries that show exactly what was resolved and what was sent to the AI provider — useful for troubleshooting unexpected assessment results or verifying that context inputs are being picked up correctly.

## What gets logged

| Debug entry | Contents |
|---|---|
| **Resolved inputs** | Every parsed input value after defaults and clamping have been applied. Sensitive fields (`github_token`, `api_key`) are shown as `[REDACTED]`. |
| **Code after comment stripping** | The full code content after comments have been removed. Omitted when `keep_comments: true` — a message is logged instead confirming no comments were removed. |
| **Prompt messages** | The full `[system, user]` message array passed to the AI provider, including all injected code content, file lists, assignment context, and instructor instructions. |

## How to enable it

Set the `ACTIONS_STEP_DEBUG` secret (or variable) to `true` in your repository or organisation settings.

1. Go to **Settings → Secrets and variables → Actions**
2. Under **Secrets**, add a new secret:
   - **Name:** `ACTIONS_STEP_DEBUG`
   - **Value:** `true`

Debug output will appear in the workflow run logs under the step that runs this action. Lines are prefixed with `##[debug]`.

:::tip
Setting `ACTIONS_STEP_DEBUG` as a **secret** rather than a variable prevents the value from being visible in workflow run summaries. GitHub recommends this for debug flags that you enable temporarily during troubleshooting.
:::

## Re-running with debug enabled

You can also enable debug output for a single re-run without adding a permanent secret:

1. Open the failed (or any past) workflow run
2. Click **Re-run jobs → Re-run all jobs**
3. Check **Enable debug logging** in the dialog

This enables `ACTIONS_STEP_DEBUG` only for that run, with no permanent repository changes required.

## What it does not log

- The raw AI response (only the structured questions output is retained)
- Git diff content (already visible in `core.info` output under normal logging)
- Code content before comment stripping
