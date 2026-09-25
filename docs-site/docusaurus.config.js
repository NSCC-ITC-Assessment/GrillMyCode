// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import { themes as prismThemes } from 'prism-react-renderer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import unescapeImageAlt from './src/remark/unescapeImageAlt.js';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

// ── Versioning (auto-derived from versions.json) ─────────────────────────────
// versions.json is the single source of truth (newest-first, e.g. ["2","1"]).
// Each released major vN is served at /docs/vN; the unreleased `current` docs
// live at /docs/next. The newest released version is the default (`lastVersion`)
// and unversioned /docs/* links redirect to it (see plugin-client-redirects).
// Cutting a new major (`docusaurus docs:version N`) only updates versions.json —
// this config and the redirects adapt automatically, and no version is ever
// pinned to the bare /docs root (which collides with the next major on release).
const docsSiteDir = path.dirname(fileURLToPath(import.meta.url));
const releasedVersions = JSON.parse(
  fs.readFileSync(path.join(docsSiteDir, 'versions.json'), 'utf8'),
);
const latestVersion = releasedVersions[0];
const latestVersionPath = `/docs/v${latestVersion}`;
// Retired version paths that may still be linked to. Each is redirected to the
// latest release, page for page.
const legacyVersionPaths = ['/docs/v1'];

// ── Redirects for removed doc pages ───────────────────────────────────────────
// The release workflow regenerates versioned_docs from docs/ on every tag, so a
// page removed from docs/ stays in the latest release snapshot until the next
// tag. Redirecting a path that still exists there would duplicate a `from` and
// fail the build, so each redirect is only claimed once the snapshot has
// dropped the page. Likewise, a redirect target is used for the latest release
// only once that snapshot contains it; until then `fallbackTo` (a page that
// does exist there) is used, or no redirect at all.
/** @param {string} docPath e.g. 'reference/pdf-asset-naming' (no extension, no #anchor) */
function existsInLatestVersion(docPath) {
  const base = path.join(docsSiteDir, 'versioned_docs', `version-${latestVersion}`, docPath);
  return ['.md', '.mdx'].some((ext) => fs.existsSync(base + ext));
}

const removedPages = [
  // Removed when GitHub discontinued GitHub Models.
  {
    path: 'ai-providers/github-models',
    to: 'reference/upgrade-notes#github-models-was-discontinued',
    fallbackTo:
      'faq#ive-used-github-models-with-grillmycode-in-the-past-and-now-they-no-longer-function-why',
  },
  // Merged into "The assessment issue and PDF" in the docs reorganization.
  { path: 'reference/pdf-asset-naming', to: 'reference/assessment-output#the-pdf' },
  // Renamed when repository markers became repository labels.
  { path: 'reference/repository-marker', to: 'reference/repository-labels' },
  { path: 'example-workflows/repo-marker', to: 'example-workflows/repo-labels' },
  // Folded into "Choosing a model": the recipe only changed ai_model.
  {
    path: 'example-workflows/openrouter-provider',
    to: 'guides/choosing-a-model#using-a-more-capable-model',
  },
  // Renamed to match its title, "How GrillMyCode works".
  { path: 'how-it-works', to: 'how-gmc-works' },
];

function removedPageRedirects() {
  const redirects = [];
  for (const { path: docPath, to, fallbackTo } of removedPages) {
    // /docs/next is always current, so it is safe to redirect unconditionally.
    redirects.push({ from: `/docs/next/${docPath}`, to: `/docs/next/${to}` });
    if (existsInLatestVersion(docPath)) continue;
    const target = existsInLatestVersion(to.split('#')[0]) ? to : fallbackTo;
    if (!target) continue;
    // The unversioned /docs/* alias is normally produced by createRedirects
    // below, but only for paths that exist in the latest release.
    const aliases = ['/docs', ...legacyVersionPaths].map((p) => `${p}/${docPath}`);
    for (const from of [`${latestVersionPath}/${docPath}`, ...aliases]) {
      redirects.push({ from, to: `${latestVersionPath}/${target}` });
    }
  }
  return redirects;
}

const docsVersions = {
  current: { label: 'Next (unreleased)', path: 'next', banner: 'unreleased' },
};
for (const v of releasedVersions) {
  docsVersions[v] = { label: v === latestVersion ? `v${v} (current)` : `v${v}`, path: `v${v}` };
}

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'GrillMyCode',
  tagline: 'AI-powered code comprehension assessments',
  favicon: 'img/favicon.ico',

  // Modern browsers prefer the crisp SVG logo; favicon.ico above stays as the
  // fallback for browsers without SVG favicon support.
  headTags: [
    {
      tagName: 'link',
      attributes: { rel: 'icon', type: 'image/svg+xml', href: '/img/grillmycode-logo.svg' },
    },
  ],

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://grillmycode.org',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  organizationName: 'NSCC-ITC-Assessment',
  projectName: 'GrillMyCode',
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  clientModules: [
    path.join(docsSiteDir, 'src/clientModules/hideCopyButtonOnWizard.js'),
  ],

  onBrokenLinks: 'throw',

  // Exposes the current version's docs path (e.g. /docs/v1) to React pages so
  // they can link to "the current docs" without hardcoding a version.
  customFields: {
    latestDocsPath: latestVersionPath,
    // Major of the latest released version (e.g. "1"). The Workflow Wizard's
    // "next" (unreleased) copy uses this to pin the action to the current
    // stable major; released copies derive their own major from their version.
    currentMajor: latestVersion,
  },

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/NSCC-ITC-Assessment/GrillMyCode/tree/main/docs-site/',
          lastVersion: latestVersion,
          versions: docsVersions,
          remarkPlugins: [unescapeImageAlt],
        },
        pages: {
          remarkPlugins: [unescapeImageAlt],
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  plugins: [
    'docusaurus-plugin-copy-page-button',
    [
      '@docusaurus/plugin-client-redirects',
      {
        // Preserve the wizard's former top-level URL (/workflow-wizard), which
        // is now a versioned doc page. Points at the current released major.
        redirects: [
          {
            from: '/workflow-wizard',
            to: `${latestVersionPath}/workflow-wizard`,
          },
          ...removedPageRedirects(),
        ],
        // Redirect bare /docs and every unversioned /docs/* path to the current
        // released version. Target is derived from latestVersion, so it follows
        // the latest major automatically when a new version is cut. Legacy
        // version paths (see legacyVersionPaths) are redirected the same way.
        /** @param {string} existingPath */
        createRedirects(existingPath) {
          if (
            existingPath === latestVersionPath ||
            existingPath.startsWith(`${latestVersionPath}/`)
          ) {
            return ['/docs', ...legacyVersionPaths].map((p) =>
              existingPath.replace(latestVersionPath, p),
            );
          }
          return undefined;
        },
      },
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: 'img/grillmycode-social-card.jpg',
      colorMode: {
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'GrillMyCode',
        logo: {
          alt: 'GrillMyCode logo',
          src: 'img/grillmycode-logo.svg',
        },
        items: [
          {
            // Version-aware: links to the wizard in whatever docs version the
            // reader is currently browsing (v1, an older major, or next),
            // mirroring how the docs sidebar/version dropdown behave.
            type: 'doc',
            docId: 'workflow-wizard',
            position: 'left',
            label: 'Workflow Wizard',
          },
          {
            // Version-aware (like Workflow Wizard above): links to the FAQ in
            // whatever docs version the reader is currently browsing.
            type: 'doc',
            docId: 'faq',
            position: 'left',
            label: 'FAQ',
          },
          {
            type: 'docsVersionDropdown',
            position: 'right',
            dropdownActiveClassDisabled: true,
            versions: [...releasedVersions, 'current'],
          },
          {
            href: 'https://github.com/NSCC-ITC-Assessment/GrillMyCode',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Get started',
                to: `${latestVersionPath}/getting-started`,
              },
              {
                label: 'AI provider',
                to: `${latestVersionPath}/ai-providers`,
              },
              {
                label: 'Inputs and outputs',
                to: `${latestVersionPath}/reference/inputs-outputs`,
              },
            ],
          },
          {
            title: 'Guides',
            items: [
              {
                label: 'Classroom 50',
                to: `${latestVersionPath}/guides/classroom50`,
              },
              {
                label: 'Workflow recipes',
                to: `${latestVersionPath}/category/example-workflows`,
              },
              {
                label: 'Architecture',
                to: `${latestVersionPath}/development/architecture`,
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'Slides',
                to: '/slides',
              },
              {
                label: 'GitHub',
                href: 'https://github.com/NSCC-ITC-Assessment/GrillMyCode',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} NSCC-ITC-Assessment. Built with Docusaurus.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }),
};

export default config;
