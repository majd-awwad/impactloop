import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { Prisma } from '../../generated/prisma/client.js';

import {
  deriveMaterialComponentMatchReasonCodes,
  scoreMaterialComponentRelevance,
  type BuildCandidateComponentInput,
  type BuildCandidateMaterialInput,
} from './learning-projects.build-candidate-ranking.js';
import { scoreMaterialAgainstComponent } from './learning-projects.material-component-matching.js';
import { evaluateProjectMaterialTaxonomyEvidence } from './project-material-concept-matching.js';

const qty = (value: number) => new Prisma.Decimal(value);

const baseMaterial = (
  overrides: Partial<BuildCandidateMaterialInput>,
): BuildCandidateMaterialInput => ({
  id: 'mat-1',
  title: 'Listing',
  description: '',
  materialType: 'General',
  condition: 'GOOD',
  isFree: true,
  price: null,
  pickupAllowed: true,
  deliveryAllowed: false,
  createdAt: new Date(0),
  categoryId: 'cat-a',
  city: 'Nablus',
  area: null,
  tags: [],
  supplierVerified: false,
  ownerCompletedHandovers: 0,
  ...overrides,
});

const baseComponent = (
  overrides: Partial<BuildCandidateComponentInput>,
): BuildCandidateComponentInput => ({
  categoryId: 'cat-a',
  componentName: 'Component',
  materialType: 'General',
  searchKeywords: [],
  alternativeKeywords: [],
  searchTerms: [],
  ...overrides,
});

describe('TAX-02 project↔material concept matching matrix', () => {
  test('A/B ultrasonic concept compatibility outranks weak lexical', () => {
    const component = baseComponent({
      componentName: 'Ultrasonic Sensor',
      materialType: 'Ultrasonic Sensor',
      conceptCanonicalKeys: ['component:ultrasonic-distance-sensor'],
      satisfiedByFormKeys: ['material-form:ultrasonic-sensor'],
    });
    const hcSr04 = baseMaterial({
      title: 'حساس مسافة HC-SR04',
      materialType: 'Ultrasonic Sensor',
      conceptCanonicalKeys: ['material-form:ultrasonic-sensor'],
    });
    const arabicReq = baseComponent({
      ...component,
      componentName: 'حساس Ultrasonic',
      materialType: 'Ultrasonic Sensor',
    });

    const score = scoreMaterialComponentRelevance(hcSr04, component);
    const codes = deriveMaterialComponentMatchReasonCodes({
      material: hcSr04,
      component,
      relevance: score,
    });
    assert.ok(score >= 480);
    assert.equal(codes[0], 'CONCEPT_COMPATIBLE');

    const arabicScore = scoreMaterialComponentRelevance(hcSr04, arabicReq);
    assert.ok(arabicScore >= 320);
  });

  test('C/D servo MG996R and SG90 are compatible; E NEMA17 is not', () => {
    const servoReq = baseComponent({
      componentName: 'Servo Motor',
      materialType: 'Servo Motor',
      conceptCanonicalKeys: ['component:servo-motor'],
      satisfiedByFormKeys: ['material-form:servo-motor'],
    });
    const mg = baseMaterial({
      title: 'MG996R Metal Gear Servo',
      materialType: 'Servo Motor',
      conceptCanonicalKeys: ['material-form:servo-motor'],
    });
    const sg = baseMaterial({
      title: 'SG90 Micro Servo',
      materialType: 'Servo Motor',
      conceptCanonicalKeys: ['material-form:servo-motor'],
    });
    const nema = baseMaterial({
      title: 'NEMA17 Stepper Motor',
      materialType: 'Stepper Motor',
      conceptCanonicalKeys: ['material-form:stepper-motor'],
    });

    assert.ok(scoreMaterialComponentRelevance(mg, servoReq) >= 480);
    assert.ok(scoreMaterialComponentRelevance(sg, servoReq) >= 480);

    const nemaScore = scoreMaterialComponentRelevance(nema, servoReq);
    const nemaCodes = deriveMaterialComponentMatchReasonCodes({
      material: nema,
      component: servoReq,
      relevance: nemaScore,
    });
    assert.ok(!nemaCodes.includes('CONCEPT_COMPATIBLE'));
    assert.ok(!nemaCodes.includes('TYPE_EXACT'));
    assert.ok(nemaScore < scoreMaterialComponentRelevance(mg, servoReq));
  });

  test('F/G stepper matches NEMA17 and rejects DC Gear Motor', () => {
    const stepperReq = baseComponent({
      componentName: 'Stepper Motor',
      materialType: 'Stepper Motor',
      conceptCanonicalKeys: ['component:stepper-motor'],
      satisfiedByFormKeys: ['material-form:stepper-motor'],
    });
    const nema = baseMaterial({
      title: 'NEMA17',
      materialType: 'Stepper Motor',
      conceptCanonicalKeys: ['material-form:stepper-motor'],
    });
    const dc = baseMaterial({
      title: 'DC Gear Motor',
      materialType: 'DC Motor',
      conceptCanonicalKeys: ['material-form:dc-motor'],
    });

    assert.ok(scoreMaterialComponentRelevance(nema, stepperReq) >= 480);
    const dcScored = scoreMaterialAgainstComponent({
      material: {
        id: dc.id,
        title: dc.title,
        description: dc.description,
        materialType: dc.materialType,
        categoryId: dc.categoryId,
        tags: [],
        conceptCanonicalKeys: dc.conceptCanonicalKeys,
      },
      component: {
        id: 'c1',
        projectId: 'p1',
        categoryId: stepperReq.categoryId,
        componentName: stepperReq.componentName,
        materialType: stepperReq.materialType,
        searchKeywords: null,
        alternativeKeywords: null,
        componentRole: 'REQUIRED_MATERIAL',
        quantity: qty(1),
        unit: 'piece',
        canBeSubstituted: false,
        isRequired: true,
        componentPosition: 0,
        conceptCanonicalKeys: stepperReq.conceptCanonicalKeys,
        satisfiedByFormKeys: stepperReq.satisfiedByFormKeys,
      },
    });
    assert.equal(dcScored, null);
  });

  test('H/I Arduino Uno matches R3, not Mega without relation', () => {
    const unoReq = baseComponent({
      componentName: 'Arduino Uno',
      materialType: 'Arduino Uno',
      conceptCanonicalKeys: ['component:arduino-board'],
      satisfiedByFormKeys: ['material-form:arduino-uno'],
    });
    const r3 = baseMaterial({
      title: 'Arduino UNO R3',
      materialType: 'Arduino Uno',
      conceptCanonicalKeys: ['material-form:arduino-uno'],
    });
    const mega = baseMaterial({
      title: 'Arduino Mega 2560',
      materialType: 'Arduino Mega 2560',
      conceptCanonicalKeys: ['material-form:arduino-mega'],
    });

    assert.ok(scoreMaterialComponentRelevance(r3, unoReq) >= 480);
    const megaScored = scoreMaterialAgainstComponent({
      material: {
        id: mega.id,
        title: mega.title,
        description: '',
        materialType: mega.materialType,
        categoryId: mega.categoryId,
        tags: [],
        conceptCanonicalKeys: mega.conceptCanonicalKeys,
      },
      component: {
        id: 'c1',
        projectId: 'p1',
        categoryId: unoReq.categoryId,
        componentName: unoReq.componentName,
        materialType: unoReq.materialType,
        searchKeywords: null,
        alternativeKeywords: null,
        componentRole: 'REQUIRED_MATERIAL',
        quantity: qty(1),
        unit: 'piece',
        canBeSubstituted: false,
        isRequired: true,
        componentPosition: 0,
        conceptCanonicalKeys: unoReq.conceptCanonicalKeys,
        satisfiedByFormKeys: unoReq.satisfiedByFormKeys,
      },
    });
    assert.equal(megaScored, null);
  });

  test('J Raspberry Pi Kit can satisfy Raspberry Pi via type alias', () => {
    const evidence = evaluateProjectMaterialTaxonomyEvidence({
      componentConceptKeys: ['component:raspberry-pi'],
      materialConceptKeys: ['material-form:raspberry-pi-kit'],
      satisfiedByFormKeys: ['material-form:raspberry-pi'],
      componentMaterialType: 'Raspberry Pi',
      materialMaterialType: 'Raspberry Pi Kit',
    });
    assert.equal(evidence?.kind, 'TYPE_ALIAS');
  });

  test('K Pi Kit does not satisfy Heatsink requirement', () => {
    const scored = scoreMaterialAgainstComponent({
      material: {
        id: 'kit',
        title: 'Raspberry Pi Kit (Heatsink, Flash, SD Card, Cable)',
        description: '',
        materialType: 'Raspberry Pi Kit',
        categoryId: 'cat-a',
        tags: [],
        conceptCanonicalKeys: ['material-form:raspberry-pi-kit'],
      },
      component: {
        id: 'c1',
        projectId: 'p1',
        categoryId: 'cat-a',
        componentName: 'Heatsink',
        materialType: 'Heatsink',
        searchKeywords: null,
        alternativeKeywords: null,
        componentRole: 'REQUIRED_MATERIAL',
        quantity: qty(1),
        unit: 'piece',
        canBeSubstituted: false,
        isRequired: true,
        componentPosition: 0,
      },
    });
    assert.equal(scored, null);
  });

  test('L legacy component without concepts still uses lexical fallback', () => {
    const material = baseMaterial({
      title: 'Ultrasonic Sensor Module',
      materialType: 'Ultrasonic Sensor',
    });
    const component = baseComponent({
      componentName: 'Ultrasonic Sensor',
      materialType: 'Ultrasonic Sensor',
    });
    const score = scoreMaterialComponentRelevance(material, component);
    const codes = deriveMaterialComponentMatchReasonCodes({
      material,
      component,
      relevance: score,
    });
    assert.ok(score > 0);
    assert.ok(codes.includes('TYPE_EXACT') || codes.includes('EXACT_NAME') || codes.includes('LEXICAL_FALLBACK') || codes.includes('MATERIAL_TYPE_MATCH'));
  });

  test('M custom unresolved material remains eligible via controlled lexical fallback', () => {
    const material = baseMaterial({
      title: 'Custom HC-SR04 distance board',
      materialType: 'custom surplus board',
      conceptCanonicalKeys: [],
    });
    const component = baseComponent({
      componentName: 'Ultrasonic Sensor',
      materialType: 'Ultrasonic Sensor',
      searchKeywords: ['HC-SR04'],
      searchTerms: ['HC-SR04', 'Ultrasonic Sensor'],
    });
    const score = scoreMaterialComponentRelevance(material, component);
    assert.ok(score > 0);
    assert.ok(
      score <
        scoreMaterialComponentRelevance(
          baseMaterial({
            title: 'HC-SR04',
            materialType: 'Ultrasonic Sensor',
            conceptCanonicalKeys: ['material-form:ultrasonic-sensor'],
          }),
          {
            ...component,
            conceptCanonicalKeys: ['component:ultrasonic-distance-sensor'],
            satisfiedByFormKeys: ['material-form:ultrasonic-sensor'],
          },
        ),
    );
  });

  test('concept-compatible NEMA ranks above lexical stepper-style DC motor', () => {
    const stepperReq = baseComponent({
      componentName: 'Stepper Motor',
      materialType: 'Stepper Motor',
      conceptCanonicalKeys: ['component:stepper-motor'],
      satisfiedByFormKeys: ['material-form:stepper-motor'],
    });
    const nema = baseMaterial({
      title: 'NEMA17 Stepper Motor',
      materialType: 'Stepper Motor',
      conceptCanonicalKeys: ['material-form:stepper-motor'],
    });
    const lexicalTrap = baseMaterial({
      title: 'DC Motor with stepper-style mounting bracket',
      materialType: 'DC Motor',
      conceptCanonicalKeys: ['material-form:dc-motor'],
    });

    assert.ok(
      scoreMaterialComponentRelevance(nema, stepperReq) >
        scoreMaterialComponentRelevance(lexicalTrap, stepperReq),
    );
  });
});
