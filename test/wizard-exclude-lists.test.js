import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import {
  OUT_PATH,
  buildExcludeLists,
  parseLinguistNames,
} from '../scripts/build-wizard-exclude-lists.js';

const committed = JSON.parse(readFileSync(OUT_PATH, 'utf-8'));
const allTemplates = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'gitignore-templates.json'),
    'utf-8',
  ),
);

describe("the Workflow Wizard's exclude lists", () => {
  // Rebuilt with the language names the committed file already lists, so the
  // check needs no network. A language Linguist adds later is picked up the
  // next time the script runs.
  it('match src/ — run node scripts/build-wizard-exclude-lists.js if not', () => {
    const languageNames = committed.languages.flatMap((l) => l.languages);
    expect(buildExcludeLists(languageNames, allTemplates)).toEqual(committed);
  });
});

describe('parseLinguistNames', () => {
  it("reads languages.yml's top-level keys, quoted or not", () => {
    const yaml = [
      '# comment',
      '---',
      '"1C Enterprise":',
      '  type: programming',
      'C++:',
      '  aliases:',
      '  - cpp',
      'Visual Basic .NET:',
      '  type: programming',
    ].join('\n');
    expect(parseLinguistNames(yaml)).toEqual(['1C Enterprise', 'C++', 'Visual Basic .NET']);
  });
});
