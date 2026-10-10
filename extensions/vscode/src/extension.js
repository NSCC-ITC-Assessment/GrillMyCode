/**
 * GrillMyCode for VS Code
 *
 * Entry point. VS Code calls activate() the first time the GrillMyCode view
 * is opened, or a YAML file is, which is what a workflow file is.
 *
 * Layout:
 *   shared/   reading the report, choosing the issue and checking a workflow
 *             file. No VS Code imports, so the repository's own tests run it
 *             with no editor present.
 *   student/  what a student sees: the questions panel, the jump to code and
 *             the moved-code warning. Its controller runs both views.
 *   instructor/  what an account that can read the answer key gets as well:
 *             finding and reading the key, and the answers under a question.
 *   workflow/  for whoever writes the workflow file: checks, completion and
 *             hover text for the GrillMyCode step, and the Workflow Wizard's
 *             tab.
 *   webview/  the page in that tab. A bundle of its own (see esbuild.js),
 *             which runs in a page: nothing here imports it.
 */

import { QuestionsController } from './student/controller.js';
import { WorkflowHelp } from './workflow/help.js';
import { WorkflowWizard } from './workflow/wizard.js';

export function activate(context) {
  const controller = new QuestionsController(context);
  const workflowHelp = new WorkflowHelp();
  const workflowWizard = new WorkflowWizard(context);
  context.subscriptions.push(controller, workflowHelp, workflowWizard);
  controller.start();
  workflowHelp.start();
  workflowWizard.start();
  // For test-host/ only: the tests drive the panel without a GitHub sign-in,
  // and the Wizard without its dialogs.
  return { controller, workflowWizard };
}

export function deactivate() {}
