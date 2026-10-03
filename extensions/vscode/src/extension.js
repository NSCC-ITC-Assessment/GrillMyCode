/**
 * GrillMyCode for VS Code
 *
 * Entry point. VS Code calls activate() the first time the GrillMyCode view
 * is opened.
 *
 * Layout:
 *   shared/   reading the report and choosing the issue. No VS Code imports,
 *             so the repository's own tests run it with no editor present.
 *   student/  what a student sees: the questions panel, the jump to code and
 *             the moved-code warning.
 */

import { QuestionsController } from './student/controller.js';

export function activate(context) {
  const controller = new QuestionsController(context);
  context.subscriptions.push(controller);
  controller.start();
  // For test-host/ only: the tests drive the panel without a GitHub sign-in.
  return { controller };
}

export function deactivate() {}
