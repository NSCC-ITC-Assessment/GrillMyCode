/**
 * Delivery: PDF Generation
 *
 * Converts a Markdown string to a PDF Buffer using md-to-pdf (Puppeteer-based).
 * Requires the system Chromium binary set via PUPPETEER_EXECUTABLE_PATH.
 */

import { mdToPdf } from 'md-to-pdf';

export async function generatePdf(markdownContent) {
  const result = await mdToPdf(
    { content: markdownContent },
    {
      launch_options: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
      highlight_style: 'github',
    },
  );
  return result.content; // Buffer
}
