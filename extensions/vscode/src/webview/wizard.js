/**
 * The Workflow Wizard's page
 *
 * What runs in the Wizard's editor tab: the docs site's Wizard, as it is, with
 * the editor as its host. esbuild.js bundles this file and everything it
 * imports into dist/wizard.js and dist/wizard.css.
 *
 * Nothing under webview/ is loaded by the extension itself, and none of it
 * may import `vscode`: it runs in a page, not in the editor.
 */

import { createElement, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import WorkflowWizard from '../../../../docs-site/docs/_workflow-wizard/index.js';
import { ready, wizardHost } from './host.js';
import './wizard.css';

/**
 * The Wizard's styles tell a dark page by `data-theme` on the root element,
 * as the docs site sets it. The editor marks its theme with a class on the
 * body, and changes it when the theme does.
 */
function followTheme() {
  const light = ['vscode-light', 'vscode-high-contrast-light'];
  const apply = () => {
    const isLight = light.some((name) => document.body.classList.contains(name));
    document.documentElement.dataset.theme = isLight ? 'light' : 'dark';
  };
  apply();
  new MutationObserver(apply).observe(document.body, {
    attributes: true,
    attributeFilter: ['class'],
  });
}

function App({ actionRef, docsBase }) {
  const [openFolder, setOpenFolder] = useState('');
  // After the first render, so the extension hears "ready" only once the
  // Wizard is on screen.
  useEffect(() => ready(setOpenFolder), []);
  const host = useMemo(() => wizardHost(openFolder), [openFolder]);
  return createElement(WorkflowWizard, { actionRef, docsBase, host });
}

followTheme();
const root = document.getElementById('root');
createRoot(root).render(
  createElement(App, { actionRef: root.dataset.actionRef, docsBase: root.dataset.docsBase }),
);
