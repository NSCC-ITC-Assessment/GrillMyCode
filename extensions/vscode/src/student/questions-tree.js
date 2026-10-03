/**
 * Questions list
 *
 * The tree in the Questions view: a group for each file, the questions that
 * start in it, and under a question that shows several snippets, one row for
 * each.
 *
 * A node is `{ group }`, `{ question }` or `{ question, snippet }`.
 */

import * as vscode from 'vscode';
import { describeLines, groupQuestions, openableSnippets } from '../shared/questions.js';

export class QuestionsTree {
  #changed = new vscode.EventEmitter();
  onDidChangeTreeData = this.#changed.event;

  #root;
  #groups = [];

  /** Shows a report's questions, with `root` the repository their paths are relative to. */
  show(root, questions) {
    this.#root = root;
    this.#groups = groupQuestions(questions);
    this.#changed.fire();
  }

  clear() {
    this.show(undefined, []);
  }

  getChildren(node) {
    if (!node) return this.#groups.map((group) => ({ group }));
    if (node.group) return node.group.questions.map((question) => ({ question }));
    if (node.snippet) return [];
    const snippets = openableSnippets(node.question);
    return snippets.length > 1 ? snippets.map((snippet) => ({ ...node, snippet })) : [];
  }

  getParent(node) {
    if (node.group) return undefined;
    if (node.snippet) return { question: node.question };
    const group = this.#groups.find((g) => g.questions.includes(node.question));
    return group && { group };
  }

  getTreeItem(node) {
    if (node.group) return this.#groupItem(node.group);
    return node.snippet ? this.#snippetItem(node) : this.#questionItem(node);
  }

  #groupItem({ file }) {
    const { Expanded } = vscode.TreeItemCollapsibleState;
    if (file === null) {
      const item = new vscode.TreeItem('Broader questions', Expanded);
      item.id = 'broader';
      item.iconPath = new vscode.ThemeIcon('comment-discussion');
      return item;
    }
    // Built from the URI, so the row takes the file's name and its icon.
    const item = new vscode.TreeItem(vscode.Uri.joinPath(this.#root, file), Expanded);
    item.id = `file:${file}`;
    item.iconPath = vscode.ThemeIcon.File;
    const folder = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '';
    item.description = folder;
    return item;
  }

  #questionItem(node) {
    const { question } = node;
    const several = openableSnippets(question).length > 1;
    const item = new vscode.TreeItem(
      // A tree row is plain text, so the backticks would only be noise.
      `${question.number}. ${question.question.replace(/`/g, '')}`,
      vscode.TreeItemCollapsibleState[several ? 'Collapsed' : 'None'],
    );
    item.id = `question:${question.number}`;
    // appendText escapes the text, which is the issue's and so untrusted.
    item.tooltip = new vscode.MarkdownString()
      .appendMarkdown(`**Question ${Number(question.number)}**\n\n`)
      .appendText(question.question);
    item.command = {
      command: 'grillmycode.openQuestion',
      title: 'Open Question',
      arguments: [node],
    };
    return item;
  }

  #snippetItem(node) {
    const item = new vscode.TreeItem(node.snippet.file, vscode.TreeItemCollapsibleState.None);
    item.description = describeLines(node.snippet);
    item.iconPath = new vscode.ThemeIcon('go-to-file');
    item.command = {
      command: 'grillmycode.openQuestion',
      title: 'Open Snippet',
      arguments: [node],
    };
    return item;
  }
}
