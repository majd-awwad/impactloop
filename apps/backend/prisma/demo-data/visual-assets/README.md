# Demo visual assets

Curated local images for demo-ready profiles, supplier covers, and core seed
material supplements.

```text
visual-assets/
  manifests/
    core-material-supplement.data.ts   # 76 core materials not in seed-catalog
    demo-people-images.data.ts         # Core account profile/avatar/cover URLs
    resolve-core-material-images.ts    # Resolver + disk assertions
    validate-demo-visual-assets.ts     # Audit script
  people/
    avatars/                           # Core + community profile portraits
    supplier-avatars/                  # Core supplier logos
    supplier-covers/                   # Core + community organization covers
```

## Public URLs

Served by the backend at `/demo-assets/visual-assets/...`

Core material photos continue to use the existing community materials pipeline at
`/demo-assets/community-materials/...` via `seed-catalog/` and `materials/MAT-*`
paths. Community demo material photos under `materials/source-images/materials/`
are unchanged.

## Generate people assets

```bash
cd apps/backend
npm run demo:assets:people
```

## Validate manifests (and seeded DB if available)

```bash
cd apps/backend
npm run demo:validate:visual-assets
```
