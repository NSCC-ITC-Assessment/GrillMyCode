// Bundles the extension into dist/. Two bundles:
//
//   dist/extension.cjs           the extension, the one file VS Code loads
//   dist/wizard.js, wizard.css   the Workflow Wizard's page, which the
//                                extension shows in a tab
//
//   node esbuild.js               development build, with a source map
//   node esbuild.js --production  minified, as packaged
//   node esbuild.js --watch       rebuild on every change
//
// The source is ES modules, like the rest of the repository. VS Code loads an
// extension with require(), so that bundle is CommonJS.

import { copyFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { context } from 'esbuild';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const shared = {
  bundle: true,
  minify: production,
  sourcemap: !production,
  sourcesContent: false,
  logLevel: 'info',
};

const extension = await context({
  ...shared,
  entryPoints: ['src/extension.js'],
  outfile: 'dist/extension.cjs',
  format: 'cjs',
  platform: 'node',
  // The oldest Node any supported VS Code runs extensions on (engines.vscode).
  target: 'node20',
  // Provided by VS Code at run time, never bundled.
  external: ['vscode'],
});

// The Wizard is the docs site's, bundled from docs-site/docs/_workflow-wizard/
// where it stands (src/webview/wizard.js imports it). It is written for the
// docs site, so three things are settled here.
const here = (path) => fileURLToPath(new URL(path, import.meta.url));
/** The folder of one of this project's own packages. */
const ours = (name) => here(`node_modules/${name}`);

const wizard = await context({
  ...shared,
  entryPoints: ['src/webview/wizard.js'],
  outfile: 'dist/wizard.js',
  format: 'iife',
  platform: 'browser',
  // Every supported VS Code shows a page with a newer Chromium than this.
  target: 'chrome120',
  alias: {
    // 1. Its packages come from this project. Left to itself esbuild looks for
    //    them beside the Wizard's files, in docs-site/node_modules: not there
    //    on a runner that builds the extension alone, and where it is there,
    //    a second copy of React, which the first cannot work with.
    react: ours('react'),
    'react-dom': ours('react-dom'),
    clsx: ours('clsx'),
    minimatch: ours('minimatch'),
    // 2. What it asks of the docs site is answered without one.
    '@docusaurus/useBaseUrl': here('src/webview/use-base-url.js'),
  },
  // 3. Its components are JSX in .js files, which the docs site's own build
  //    takes as they are.
  loader: { '.js': 'jsx', '.svg': 'dataurl' },
  define: { 'process.env.NODE_ENV': production ? '"production"' : '"development"' },
});

const builds = [extension, wizard];
if (watch) {
  await Promise.all(builds.map((build) => build.watch()));
} else {
  await Promise.all(builds.map((build) => build.rebuild()));
  await Promise.all(builds.map((build) => build.dispose()));
}

// The packaged extension carries the repository's licence. Copied in at
// packaging time, so there is one copy to maintain.
if (production) copyFileSync('../../LICENSE', 'LICENSE');
