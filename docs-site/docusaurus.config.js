// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import { themes as prismThemes } from 'prism-react-renderer';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'GrillMyCode',
  tagline: 'AI-powered code comprehension assessments',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://nscc-itc-assessment.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/GrillMyCode/',

  // GitHub pages deployment config.
  organizationName: 'NSCC-ITC-Assessment',
  projectName: 'GrillMyCode',
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'throw',

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
          versions: {
            current: {
              label: 'Next (unreleased)',
              path: 'next',
              banner: 'unreleased',
            },
            '1': {
              label: 'v1',
              path: '',
              banner: 'none',
            },
          },
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  plugins: ['docusaurus-plugin-copy-page-button'],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: 'img/docusaurus-social-card.jpg',
      colorMode: {
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'GrillMyCode',
        logo: {
          alt: 'My Site Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Docs',
          },
          {
            to: '/workflow-wizard',
            position: 'left',
            label: 'Workflow Wizard',
          },
          {
            type: 'docsVersionDropdown',
            position: 'right',
            dropdownActiveClassDisabled: true,
            versions: ['1', 'current'],
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
                label: 'Getting Started',
                to: '/docs/getting-started',
              },
              {
                label: 'AI Providers',
                to: '/docs/ai-providers',
              },
              {
                label: 'Inputs & Outputs',
                to: '/docs/reference/inputs-outputs',
              },
            ],
          },
          {
            title: 'Guides',
            items: [
              {
                label: 'GitHub Classroom',
                to: '/docs/guides/github-classroom',
              },
              {
                label: 'Example Workflows',
                to: '/docs/example-workflows/pull-request',
              },
              {
                label: 'Architecture',
                to: '/docs/development/architecture',
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
