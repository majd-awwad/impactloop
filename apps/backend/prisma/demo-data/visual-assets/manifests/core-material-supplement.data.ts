/**
 * Local image paths for core seed materials not covered by seed-catalog-images.data.ts.
 *
 * Paths are relative to prisma/demo-data/materials/source-images/ and served via
 * /demo-assets/community-materials/... (existing community demo asset pipeline).
 *
 * Each mapping was chosen for semantic fit — not generic category placeholders.
 */
export const CORE_MATERIAL_SUPPLEMENT_IMAGE_PATHS: Readonly<
  Record<string, readonly string[]>
> = {
  // Israa craft listings — reuse curated seed-catalog photos where the item type matches.
  "israa-wax-molds": ["core-materials/material-israa-wax-molds.png"],
  "israa-fabric-scraps": ["core-materials/material-israa-fabric-scraps.png"],
  "israa-denim-offcuts": ["core-materials/material-israa-denim-offcuts.png"],
  "israa-cardboard-sheets": ["seed-catalog/israa-shipping-boxes-01.webp"],
  "israa-cardboard-tubes": ["seed-catalog/israa-egg-cartons-01.jpg"],
  "israa-bottle-caps": ["core-materials/material-israa-bottle-caps.png"],
  "israa-glass-jars": ["core-materials/material-israa-glass-jars.png"],
  "israa-acrylic-paint": ["seed-catalog/israa-paint-brushes-01.webp"],
  "israa-wooden-sticks": ["seed-catalog/israa-wooden-clothespins-01.webp"],
  "israa-foam-board": ["core-materials/material-israa-foam-board.png"],
  "israa-cotton-offcuts": ["core-materials/material-israa-cotton-offcuts.png"],
  "israa-canvas-offcuts": ["core-materials/material-israa-canvas-offcuts.png"],
  "israa-leather-offcuts": ["core-materials/material-israa-leather-offcuts.png"],
  "israa-zipper-bundles": ["seed-catalog/israa-ribbon-rolls-01.jpg"],
  "israa-velcro-strips": ["seed-catalog/israa-elastic-bands-01.jpg"],
  "israa-knitting-needles": ["seed-catalog/israa-crochet-hooks-01.webp"],
  "israa-foam-sheets": ["core-materials/material-israa-foam-sheets.png"],
  "israa-magazine-bundles": ["seed-catalog/israa-newspaper-bundles-01.webp"],
  "israa-plastic-bottles": ["core-materials/material-israa-plastic-bottles.png"],
  "israa-resin-molds": ["core-materials/material-israa-resin-molds.png"],

  // Majd electronics — graduation-project hardware photos from community materials.
  "majd-arduino-nano-boards": ["materials/MAT-024_01.png"],
  "majd-esp32-devkit-boards": ["materials/MAT-003_01.jpg"],
  "majd-raspberry-pi-3b-boards": ["materials/MAT-035_01.png"],
  "majd-flame-sensor-modules": ["materials/MAT-015_01.jpg"],
  "majd-l298n-motor-drivers": ["materials/MAT-121_01.png"],
  "majd-tb6612-motor-drivers": ["materials/MAT-106_01.png"],

  // Workflow / salvage variants inside CORE_MATERIALS (single-quoted keys).
  "majd-arduino-student-salvage": [
    "seed-catalog/majd-arduino-uno-r3-01.jpg",
  ],
  "majd-ultrasonic-lab-surplus": [
    "seed-catalog/majd-ultrasonic-hcsr04-01.png",
  ],
  "majd-ultrasonic-free-lab": [
    "seed-catalog/majd-ultrasonic-hcsr04-02.png",
  ],
  "majd-jumper-wires-free-pieces": [
    "seed-catalog/majd-jumper-wires-01.jpg",
  ],
  "majd-dc-motors-surplus": ["seed-catalog/majd-dc-gear-motors-01.webp"],

  // Nablus Build Surplus — wood, plastic, metal, and hardware from documented surplus photos.
  "supplier-plywood-panels": [
    "core-materials/material-supplier-plywood-panels.png",
  ],
  "supplier-mdf-offcuts": ["core-materials/material-supplier-mdf-offcuts.png"],
  "supplier-pine-strips": ["core-materials/material-supplier-pine-strips.png"],
  "supplier-acrylic-sheets": [
    "core-materials/material-supplier-acrylic-sheets.png",
  ],
  "supplier-pvc-pipes": ["core-materials/material-supplier-pvc-pipes.png"],
  "supplier-aluminum-angles": [
    "core-materials/material-supplier-aluminum-angles.png",
  ],
  "supplier-screws-nuts": ["core-materials/material-supplier-screws-nuts.png"],
  "supplier-hinges-set": ["core-materials/material-supplier-hinges-set.png"],
  "supplier-drill-bits": ["core-materials/material-supplier-drill-bits.png"],
  "supplier-rubber-wheels": ["materials/MAT-065_01.jpg"],
  "supplier-reclaimed-pallet-boards": [
    "core-materials/material-supplier-reclaimed-pallet-boards.png",
  ],
  "supplier-timber-beams": [
    "core-materials/material-supplier-timber-beams.png",
  ],
  "supplier-particleboard-offcuts": [
    "core-materials/material-supplier-particleboard-offcuts.png",
  ],
  "supplier-veneer-sheets": [
    "core-materials/material-supplier-veneer-sheets.png",
  ],
  "supplier-wooden-dowels": [
    "core-materials/material-supplier-wooden-dowels.png",
  ],
  "supplier-wood-blocks": ["core-materials/material-supplier-wood-blocks.png"],
  "supplier-sandpaper-sheets": [
    "core-materials/material-supplier-sandpaper-sheets.png",
  ],
  "supplier-wood-glue-bottles": [
    "core-materials/material-supplier-wood-glue-bottles.png",
  ],
  "supplier-colored-acrylic-sheets": [
    "core-materials/material-supplier-colored-acrylic-sheets.png",
  ],
  "supplier-polycarbonate-sheets": [
    "core-materials/material-supplier-polycarbonate-sheets.png",
  ],
  "supplier-hdpe-sheets": ["core-materials/material-supplier-hdpe-sheets.png"],
  "supplier-plastic-crates": [
    "core-materials/material-supplier-plastic-crates.png",
  ],
  "supplier-storage-baskets": [
    "core-materials/material-supplier-storage-baskets.png",
  ],
  "supplier-plastic-trays": [
    "core-materials/material-supplier-plastic-trays.png",
  ],
  "supplier-aluminum-sheets": [
    "core-materials/material-supplier-aluminum-sheets.png",
  ],
  "supplier-steel-plates": ["core-materials/material-supplier-steel-plates.png"],
  "supplier-metal-rods": ["core-materials/material-supplier-metal-rods.png"],
  "supplier-wire-mesh": ["core-materials/material-supplier-wire-mesh.png"],
  "supplier-bolts-washers": [
    "core-materials/material-supplier-bolts-washers.png",
  ],
  "supplier-angle-brackets": ["materials/MAT-073_01.png"],
  "supplier-drawer-slides": [
    "core-materials/material-supplier-drawer-slides.png",
  ],
  "supplier-caster-wheels": ["materials/MAT-076_01.jpg"],
  "supplier-springs-assortment": [
    "core-materials/material-supplier-springs-assortment.png",
  ],
  "supplier-bearings": ["core-materials/material-supplier-bearings.png"],
  "supplier-gears": ["materials/MAT-062_01.jpg"],
  "supplier-pulleys": ["core-materials/material-supplier-pulleys.png"],
  "supplier-chain-links": ["core-materials/material-supplier-chain-links.png"],
  "supplier-rubber-belts": [
    "core-materials/material-supplier-rubber-belts.png",
  ],
  "supplier-clamps": ["core-materials/supplier-clamps.png"],
  "supplier-screwdrivers": [
    "core-materials/material-supplier-screwdrivers.png",
  ],
  "supplier-hammers": ["core-materials/supplier-hammers.png"],
  "supplier-pliers": ["core-materials/supplier-pliers.png"],
  "supplier-measuring-tapes": [
    "core-materials/material-supplier-measuring-tapes.png",
  ],
  "supplier-spirit-levels": ["core-materials/supplier-spirit-levels.png"],
  "supplier-hand-saws": ["core-materials/material-supplier-hand-saws.png"],
  "supplier-paint-rollers": [
    "core-materials/material-supplier-paint-rollers.png",
  ],
  "supplier-ceramic-tiles": ["core-materials/supplier-ceramic-tiles.png"],
  "supplier-pvc-conduits": [
    "core-materials/material-supplier-pvc-conduits.png",
  ],
  "supplier-insulation-foam": [
    "core-materials/material-supplier-insulation-foam.png",
  ],
  "supplier-nylon-rope": ["core-materials/supplier-nylon-rope.png"],
} as const;
