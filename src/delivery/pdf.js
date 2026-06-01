/**
 * Delivery: PDF Generation
 *
 * Converts a Markdown string to a PDF Buffer using md-to-pdf (Puppeteer-based).
 * Requires the system Chromium binary set via PUPPETEER_EXECUTABLE_PATH.
 */

import { Buffer } from 'node:buffer';
import { mdToPdf } from 'md-to-pdf';

export async function generatePdf(markdownContent) {
  const result = await mdToPdf(
    { content: markdownContent },
    {
      launch_options: {
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage', // required in Docker — /dev/shm is only 64 MB by default
          '--disable-gpu',
        ],
      },
      highlight_style: 'github',
    },
  );
  if (!result?.content?.length) {
    throw new Error('md-to-pdf returned empty content — Chromium may have failed to launch');
  }
  return Buffer.isBuffer(result.content) ? result.content : Buffer.from(result.content);
}
