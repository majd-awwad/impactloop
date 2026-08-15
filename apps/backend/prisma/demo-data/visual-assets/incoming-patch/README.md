# Incoming visual patch drop zone

Extract `ImpactLoop_demo_visual_patch.zip` here:

```text
incoming-patch/
  docs/manifest.csv
  materials/
    supplier-ceramic-tiles.png
    supplier-nylon-rope.png
    supplier-clamps.png
    supplier-spirit-levels.png
    supplier-hammers.png
    supplier-pliers.png
  profiles/
    israa-core-profile.png
```

Then run:

```bash
cd apps/backend
npm run demo:integrate:visual-patch
npm run prisma:seed
```
