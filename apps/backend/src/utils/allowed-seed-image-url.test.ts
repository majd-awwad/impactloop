import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isAllowedSeedImageUrl } from "./allowed-seed-image-url.js";

describe("isAllowedSeedImageUrl", () => {
  it("allows https remote URLs", () => {
    assert.equal(
      isAllowedSeedImageUrl(
        "https://images.unsplash.com/photo-1553406830-ef2513450d76?auto=format&fit=crop&w=1200&q=80",
      ),
      true,
    );
  });

  it("allows repository demo material and project asset paths", () => {
    assert.equal(
      isAllowedSeedImageUrl(
        "/demo-assets/community-materials/materials/MAT-003_01.jpg",
      ),
      true,
    );
    assert.equal(
      isAllowedSeedImageUrl(
        "/demo-assets/community-projects/covers/legacy/simple-led-circuit.jpg",
      ),
      true,
    );
    assert.equal(
      isAllowedSeedImageUrl(
        "/demo-assets/community-projects/covers/najah-packsort-cover.png",
      ),
      true,
    );
  });

  it("rejects empty, relative junk, and non-demo local paths", () => {
    assert.equal(isAllowedSeedImageUrl(""), false);
    assert.equal(isAllowedSeedImageUrl("  "), false);
    assert.equal(isAllowedSeedImageUrl("http://example.com/x.jpg"), false);
    assert.equal(isAllowedSeedImageUrl("/uploads/materials/x.jpg"), false);
    assert.equal(isAllowedSeedImageUrl("/demo-assets/other/x.jpg"), false);
    assert.equal(isAllowedSeedImageUrl("covers/legacy/x.jpg"), false);
  });
});
