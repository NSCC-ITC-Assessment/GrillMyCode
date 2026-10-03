// Bundles the extension into dist/extension.cjs, the one file VS Code loads.
//
//   node esbuild.js               development build, with a source map
//   node esbuild.js --production  minified, as packaged
//   node esbuild.js --watch       rebuild on every change
//
// The source is ES modules, like the rest of the repository. VS Code loads an
// extension with require(), so the bundle is CommonJS.

import { copyFileSync } from 'fs';
import { context } from 'esbuild';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const build = await context({
  entryPoints: ['src/extension.js'],
  outfile: 'dist/extension.cjs',
  bundle: true,
  format: 'cjs',
  platform: 'node',
  // The oldest Node any supported VS Code runs extensions on (engines.vscode).
  target: 'node20',
  // Provided by VS Code at run time, never bundled.
  external: ['vscode'],
  minify: production,
  sourcemap: !production,
  sourcesContent: false,
  logLevel: 'info',
});

if (watch) {
  await build.watch();
} else {
  await build.rebuild();
  await build.dispose();
}

// The packaged extension carries the repository's licence. Copied in at
// packaging time, so there is one copy to maintain.
if (production) copyFileSync('../../LICENSE', 'LICENSE');
