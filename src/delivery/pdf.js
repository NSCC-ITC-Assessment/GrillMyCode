/**
 * Delivery: PDF Generation
 *
 * Converts a Markdown string to a PDF Buffer using md-to-pdf (Puppeteer-based).
 * Requires the system Chromium binary set via PUPPETEER_EXECUTABLE_PATH.
 */

import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as core from '@actions/core';
import { mdToPdf } from 'md-to-pdf';
import { LOGO_PDF_HEADER_HEIGHT_PX } from '../constants.js';

/**
 * The page header carries the logo, since the sanitiser below strips the one
 * beside the report heading. Chromium does not fetch resources for header
 * templates, so the SVG is inlined as a data URI. The Dockerfile copies the
 * file to the same relative path inside the image. If it cannot be read, the
 * PDF is still produced, just without a logo.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = join(__dirname, '../../docs-site/static/img/grillmycode-logo.svg');

function buildHeaderTemplate() {
  let logo = '';
  try {
    const svg = readFileSync(LOGO_PATH).toString('base64');
    logo =
      `<img src="data:image/svg+xml;base64,${svg}" alt="" ` +
      `style="height:${LOGO_PDF_HEADER_HEIGHT_PX}px;width:${LOGO_PDF_HEADER_HEIGHT_PX}px;margin-right:4px">`;
  } catch (err) {
    core.debug(`PDF: logo not found at ${LOGO_PATH} (${err.message}); header has no logo`);
  }
  return (
    '<div style="font-size:9px;width:100%;margin:0 1cm;display:flex;align-items:center;' +
    `color:#aaa;font-family:sans-serif">${logo}<span>GrillMyCode</span></div>`
  );
}

/**
 * marked renderer overrides that neutralise the prompt-injection → HTML render
 * path before any markup reaches Chromium.
 *
 * The markdown handed to md-to-pdf includes AI-generated questions, which are
 * influenceable by student-submitted code. md-to-pdf renders that markdown in a
 * headless Chromium and waits for `networkidle0`, so any raw HTML reaching the
 * DOM is live: `<img>`, `<iframe>`, `<script>`, `<link>`, and `<object>` fire
 * outbound requests (SSRF / exfiltration beacons) and `file://` sources read
 * local files into the PDF.
 *
 * The report is authored entirely in markdown (no raw HTML), so we drop every
 * raw HTML chunk and every image outright. These overrides merge with (not
 * replace) md-to-pdf's default renderer, so fenced code blocks and syntax
 * highlighting are untouched. Returning a string (not `false`) overrides the
 * default renderer in marked v4.
 *   - `html`  — drop all raw HTML so no markup ever reaches the page.
 *   - `image` — drop all images so no remote/`file://` `src` is ever loaded.
 */
const sanitisingMarkedExtension = {
  renderer: {
    html() {
      return '';
    },
    image() {
      return '';
    },
  },
};

export async function generatePdf(markdownContent) {
  core.debug(
    `PDF: launching Chromium (PUPPETEER_EXECUTABLE_PATH=${process.env.PUPPETEER_EXECUTABLE_PATH ?? 'unset'})`,
  );

  const result = await mdToPdf(
    { content: markdownContent },
    {
      launch_options: {
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      },
      marked_extensions: [sanitisingMarkedExtension],
      highlight_style: 'github',
      pdf_options: {
        margin: { top: '1.5cm', right: '1cm', bottom: '2cm', left: '1cm' },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: buildHeaderTemplate(),
        footerTemplate:
          '<div style="font-size:9px;width:100%;text-align:center;color:#aaa;font-family:sans-serif">' +
          '<span class="pageNumber"></span> / <span class="totalPages"></span>' +
          '</div>',
      },
    },
  );

  core.debug(
    `PDF: md-to-pdf returned — content type: ${typeof result?.content}, length: ${result?.content?.length ?? 'null/undefined'}, isBuffer: ${Buffer.isBuffer(result?.content)}`,
  );

  if (!result?.content?.length) {
    throw new Error('md-to-pdf returned empty content — Chromium may have failed to launch');
  }
  return Buffer.isBuffer(result.content) ? result.content : Buffer.from(result.content);
}
