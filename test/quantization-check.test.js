import { describe, expect, it } from 'vitest';
import {
  compareQuantizations,
  extractQuantizations,
  fingerprint,
  formatReport,
} from '../scripts/check-openrouter-quantizations.js';
import { AI_ALLOWED_QUANTIZATIONS, AI_EXCLUDED_QUANTIZATIONS } from '../src/constants.js';

const lists = { allowed: ['fp8', 'bf16', 'unknown'], excluded: ['fp4', 'int4'] };

describe('quantization lists', () => {
  it('never both allows and excludes a level', () => {
    const both = AI_ALLOWED_QUANTIZATIONS.filter((v) => AI_EXCLUDED_QUANTIZATIONS.includes(v));
    expect(both).toEqual([]);
  });
});

describe('extractQuantizations', () => {
  it("reads the Quantization enum from OpenRouter's spec", () => {
    const spec = { components: { schemas: { Quantization: { enum: ['fp8', 'fp4'] } } } };
    expect(extractQuantizations(spec)).toEqual(['fp8', 'fp4']);
  });

  it('throws when the spec has moved it', () => {
    expect(() => extractQuantizations({ components: { schemas: {} } })).toThrow(/Quantization/);
    expect(() => extractQuantizations(null)).toThrow(/Quantization/);
  });
});

describe('compareQuantizations', () => {
  it('needs no attention when every listed level is decided on', () => {
    const findings = compareQuantizations(['fp8', 'bf16', 'unknown', 'fp4', 'int4'], lists);
    expect(findings).toEqual({ added: [], removed: [], retired: [], attention: false });
  });

  it('flags a level that is in neither list', () => {
    const findings = compareQuantizations(
      ['fp8', 'bf16', 'unknown', 'fp4', 'int4', 'mxfp6'],
      lists,
    );
    expect(findings.added).toEqual(['mxfp6']);
    expect(findings.attention).toBe(true);
  });

  it('flags an allowed level OpenRouter no longer lists', () => {
    const findings = compareQuantizations(['fp8', 'unknown', 'fp4', 'int4'], lists);
    expect(findings.removed).toEqual(['bf16']);
    expect(findings.attention).toBe(true);
  });

  it('notes, but needs no attention for, a dropped excluded level', () => {
    const findings = compareQuantizations(['fp8', 'bf16', 'unknown', 'fp4'], lists);
    expect(findings.retired).toEqual(['int4']);
    expect(findings.attention).toBe(false);
  });
});

describe('formatReport', () => {
  const findings = { added: ['mxfp6'], removed: ['bf16'], retired: [], attention: true };

  it('leads with the fingerprint, so a repeat can be recognized', () => {
    expect(formatReport(findings)).toMatch(
      new RegExp(`^<!-- quantization-check: ${fingerprint(findings)} -->`),
    );
  });

  it('covers both an urgent removal and a new level', () => {
    const report = formatReport(findings);
    expect(report).toMatch(/Urgent[\s\S]*`bf16`[\s\S]*every run fails/);
    expect(report).toMatch(/needs a decision[\s\S]*`mxfp6`/);
  });

  it('gives the same fingerprint for the same findings only', () => {
    expect(fingerprint(findings)).toBe(fingerprint({ ...findings, retired: ['int4'] }));
    expect(fingerprint(findings)).not.toBe(fingerprint({ ...findings, added: ['mxint8'] }));
  });
});
