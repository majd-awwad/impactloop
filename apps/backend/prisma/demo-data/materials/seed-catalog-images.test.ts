import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';

import {
  communityDemoMaterialImageDiskPath,
  communityDemoMaterialImageUrl,
} from '../../../src/constants/community-demo-materials.js';
import { isAllowedSeedImageUrl } from '../../../src/utils/allowed-seed-image-url.js';
import { SEED_CATALOG_REAL_IMAGE_PATHS } from './seed-catalog-images.data.js';

describe('seed catalog real material images', () => {
  it('maps seed keys to existing repository demo assets with allowed URLs', () => {
    const entries = Object.entries(SEED_CATALOG_REAL_IMAGE_PATHS);
    assert.ok(entries.length >= 70, 'expected curated seed-catalog mappings');

    for (const [seedKey, relativePaths] of entries) {
      assert.match(seedKey, /^(majd|israa)-[a-z0-9-]+$/);
      assert.ok(relativePaths.length >= 1);

      relativePaths.forEach((relativePath, index) => {
        assert.ok(
          relativePath.startsWith('seed-catalog/'),
          `${seedKey}[${index}] must live under seed-catalog/`,
        );
        assert.doesNotMatch(
          relativePath,
          /cmsl3z|material_\d|C:\\\\data\\\\uploads|uploads\/materials/i,
          `${seedKey}[${index}] must not reference runtime upload paths`,
        );

        const diskPath = communityDemoMaterialImageDiskPath(relativePath);
        assert.equal(
          fs.existsSync(diskPath),
          true,
          `missing demo asset for ${seedKey}: ${diskPath}`,
        );

        const publicUrl = communityDemoMaterialImageUrl(relativePath);
        assert.equal(isAllowedSeedImageUrl(publicUrl), true);
        assert.equal(
          publicUrl,
          `/demo-assets/community-materials/${relativePath}`,
        );
      });
    }
  });

  it('covers representative recovered materials', () => {
    assert.deepEqual(SEED_CATALOG_REAL_IMAGE_PATHS['majd-arduino-uno-r3'], [
      'seed-catalog/majd-arduino-uno-r3-01.jpg',
      'seed-catalog/majd-arduino-uno-r3-02.jpg',
    ]);
    assert.deepEqual(SEED_CATALOG_REAL_IMAGE_PATHS['israa-button-assortment'], [
      'seed-catalog/israa-button-assortment-01.jpg',
    ]);
  });
});
