# Community / seed catalog material source images

## Community demo materials (206)

Original listing images for the community demo materials CSV.

Expected layout (from `Extracted Image Files` in `canonical-materials.csv`):

```text
source-images/
  manifest.csv
  materials/
    MAT-003_01.jpg
    MAT-005_01.jpg
    ...
  seed-catalog/
    majd-arduino-uno-r3-01.jpg
    israa-button-assortment-01.jpg
    ...
```

Do not replace these with Unsplash or other stock imagery.

## Core seed catalog (`prisma/seed.ts`)

`seed-catalog/` holds curated real photos for selected `MaterialSeed.key` entries
(Majd electronics + Israa crafts). Mapping lives in
`../seed-catalog-images.data.ts` and is applied by `prisma/seed.ts` on every
`migrate reset` / `npm run seed`.

Public URL prefix (served by the backend): `/demo-assets/community-materials/...`

`UPLOAD_ROOT_DIR` (runtime user uploads) is separate — do not copy demo assets
into runtime uploads folders.

`*.jpg` / `*.png` / `*.webp` under this folder are allow-listed in the root
`.gitignore` so they can be committed with the demo dataset.
