import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { normalizeArabicVariants } from './ai-agent-filter-extractor.service.js';
import {
  extractComponentReferencePhrases,
  type BuildComponentReferenceCandidate,
} from './ai-agent-turn.service.js';

const normalizeReference = (value: string) =>
  normalizeArabicVariants(
    value
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );

const makeCandidate = (
  componentName: string,
  keywords: string[] = [],
): BuildComponentReferenceCandidate => ({
  buildItemId: `item-${componentName}`,
  requiredComponentId: `cmp-${componentName}`,
  componentName,
  status: 'MISSING',
  aliases: [normalizeReference(componentName), ...keywords.map(normalizeReference)].filter(
    (alias, index, all) => alias.length > 0 && all.indexOf(alias) === index,
  ),
});

const parsingCandidates: BuildComponentReferenceCandidate[] = [
  makeCandidate('مجموعة وصلات'),
  makeCandidate('قطعة واحدة'),
  makeCandidate('مادة ورقية'),
  makeCandidate('لوح ورق مقوى'),
  makeCandidate('لوح خشب'),
  makeCandidate('صمغ'),
  makeCandidate('LED', ['led']),
  makeCandidate('Resistor', ['resistor', 'مقاومة']),
  makeCandidate('Battery', ['battery', 'بطارية']),
];

describe('build-guide component reference splitting', () => {
  test('keeps مجموعة وصلات as one component reference', () => {
    assert.deepEqual(
      extractComponentReferencePhrases('عندي مجموعة وصلات', parsingCandidates),
      ['مجموعة وصلات'],
    );
  });

  test('does not split قطعة واحدة into separate words', () => {
    assert.deepEqual(
      extractComponentReferencePhrases('عندي قطعة واحدة', parsingCandidates),
      ['قطعة واحدة'],
    );
  });

  test('does not split مادة ورقية into separate words', () => {
    assert.deepEqual(
      extractComponentReferencePhrases('عندي مادة ورقية', parsingCandidates),
      ['مادة ورقية'],
    );
  });

  test('splits لوح خشب وصمغ only when both build components exist', () => {
    assert.deepEqual(
      extractComponentReferencePhrases('عندي لوح خشب وصمغ', parsingCandidates),
      ['لوح خشب', 'صمغ'],
    );
    assert.deepEqual(
      extractComponentReferencePhrases('عندي لوح ورق مقوى', parsingCandidates),
      ['لوح ورق مقوى'],
    );
  });

  test('splits LED ومقاومة into LED and Resistor references', () => {
    assert.deepEqual(
      extractComponentReferencePhrases('عندي LED ومقاومة', parsingCandidates),
      ['LED', 'مقاومة'],
    );
  });

  test('splits comma-separated Arabic component list into three references', () => {
    assert.deepEqual(
      extractComponentReferencePhrases('عندي LED، مقاومة، بطارية', parsingCandidates),
      ['LED', 'مقاومة', 'بطارية'],
    );
  });

  test('does not split internal و inside single Arabic words without candidates', () => {
    assert.deepEqual(extractComponentReferencePhrases('مقاومة'), ['مقاومة']);
    assert.deepEqual(extractComponentReferencePhrases('موجود'), ['موجود']);
    assert.deepEqual(extractComponentReferencePhrases('لوح'), ['لوح']);
    assert.deepEqual(extractComponentReferencePhrases('مكونات'), ['مكونات']);
  });
});
