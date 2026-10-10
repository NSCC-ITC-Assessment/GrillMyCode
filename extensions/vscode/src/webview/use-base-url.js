/**
 * Stands in for the docs site's `@docusaurus/useBaseUrl` where the Wizard is
 * bundled for the editor (esbuild.js points that import here). On the docs
 * site it turns a path under static/ into an address. Here there is no site,
 * so each file the Wizard asks for is built into the bundle.
 */

import wizardIcon from '../../../../docs-site/static/img/grillmycode-wizard.svg';

const FILES = { '/img/grillmycode-wizard.svg': wizardIcon };

export default function useBaseUrl(path) {
  // A file the Wizard has started to use and this list lacks. Thrown, so the
  // Wizard does not open and the test in test-host/ says why.
  if (!(path in FILES)) throw new Error(`The Wizard asks for ${path}, which is not bundled.`);
  return FILES[path];
}
