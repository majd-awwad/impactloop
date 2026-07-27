import type {
  TaxonomyConceptRelationType,
  TaxonomyConceptType,
} from '../../generated/prisma/client.js';

export type TaxonomyCompatibilityRelationSeed = {
  relationType: TaxonomyConceptRelationType;
  sourceCanonicalKey: string;
  sourceConceptType: TaxonomyConceptType;
  targetCanonicalKey: string;
  targetConceptType: TaxonomyConceptType;
};

const interestRelation = (
  sourceCanonicalKey: string,
  targetCanonicalKey: string,
  targetConceptType: 'MATERIAL_FAMILY' | 'MATERIAL_FORM',
): TaxonomyCompatibilityRelationSeed => ({
  relationType: 'INTEREST_RELEVANT_TO',
  sourceCanonicalKey,
  sourceConceptType: 'INTEREST',
  targetCanonicalKey,
  targetConceptType,
});

const satisfiedByRelation = (
  sourceCanonicalKey: string,
  targetCanonicalKey: string,
): TaxonomyCompatibilityRelationSeed => ({
  relationType: 'SATISFIED_BY',
  sourceCanonicalKey,
  sourceConceptType: 'COMPONENT',
  targetCanonicalKey,
  targetConceptType: 'MATERIAL_FORM',
});

export const TAXONOMY_COMPATIBILITY_RELATION_SEEDS: readonly TaxonomyCompatibilityRelationSeed[] = [
  interestRelation('interest:electronics', 'material-family:electronics', 'MATERIAL_FAMILY'),
  interestRelation('interest:arduino', 'material-form:arduino-uno', 'MATERIAL_FORM'),
  interestRelation('interest:robotics', 'material-family:electronics', 'MATERIAL_FAMILY'),
  interestRelation('interest:robotics', 'material-family:mechanical', 'MATERIAL_FAMILY'),
  interestRelation('interest:sensors', 'material-form:ultrasonic-sensor', 'MATERIAL_FORM'),
  interestRelation('interest:circuits', 'material-family:electronics', 'MATERIAL_FAMILY'),
  interestRelation('interest:wires-connectors', 'material-form:jumper-wires', 'MATERIAL_FORM'),
  interestRelation('interest:woodworking', 'material-family:wood', 'MATERIAL_FAMILY'),
  interestRelation('interest:fabric-textiles', 'material-family:fabric', 'MATERIAL_FAMILY'),
  interestRelation('interest:art-crafts', 'material-family:craft', 'MATERIAL_FAMILY'),
  interestRelation('interest:recycling', 'material-family:reusable', 'MATERIAL_FAMILY'),
  interestRelation('interest:home-diy', 'material-family:tools', 'MATERIAL_FAMILY'),

  satisfiedByRelation('component:arduino-board', 'material-form:arduino-uno'),
  satisfiedByRelation('component:ultrasonic-distance-sensor', 'material-form:ultrasonic-sensor'),
  satisfiedByRelation('component:dc-gear-motors', 'material-form:dc-motor'),
  satisfiedByRelation('component:jumper-wires', 'material-form:jumper-wires'),
  satisfiedByRelation('component:rubber-wheels', 'material-form:rubber-wheels'),
  satisfiedByRelation('component:breadboard', 'material-form:breadboard'),
  satisfiedByRelation('component:led', 'material-form:led-pack'),
  satisfiedByRelation('component:resistor', 'material-form:resistor-pack'),
  satisfiedByRelation('component:battery-holder', 'material-form:battery-holder'),
  satisfiedByRelation('component:acrylic-sheets', 'material-form:acrylic-sheet'),
  satisfiedByRelation('component:pvc-pipes', 'material-form:pvc-pipes'),
  satisfiedByRelation('component:small-hinges', 'material-form:small-hinges'),
  satisfiedByRelation('component:screws-and-nuts', 'material-form:screws-and-nuts'),
  satisfiedByRelation('component:plywood-panel', 'material-form:plywood-sheet'),
  satisfiedByRelation('component:mdf-offcut', 'material-form:mdf-offcuts'),
  satisfiedByRelation('component:cardboard-sheets', 'material-form:cardboard-sheets'),
  satisfiedByRelation('component:fabric-scraps', 'material-form:fabric-scraps'),
  satisfiedByRelation('component:denim-offcuts', 'material-form:denim-offcuts'),
  satisfiedByRelation('component:wooden-dowel', 'material-form:wooden-dowels'),
  satisfiedByRelation('component:wood-glue', 'material-form:wood-glue'),
];
