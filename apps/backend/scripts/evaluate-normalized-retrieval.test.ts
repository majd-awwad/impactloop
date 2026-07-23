import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_RETRIEVAL_TERMS,
  buildReviewedInterestVocabulary,
  scoreMaterialWithReviewedAliases,
} from "./evaluate-normalized-retrieval.js";

test("reviewed vocabulary is restricted to learner-interest aliases", () => {
  const arduino = buildReviewedInterestVocabulary("arduino");

  assert.ok(arduino.englishAliases.includes("arduino board"));
  assert.equal(arduino.englishAliases.includes("HC-SR04"), false);
  assert.equal(
    arduino.englishAliases.includes("Ultrasonic distance sensor"),
    false,
  );
  assert.ok(arduino.arabicAliases.includes("أردوينو"));
});

test("reviewed terms are deduplicated and deterministically bounded", () => {
  const first = buildReviewedInterestVocabulary("art_crafts");
  const second = buildReviewedInterestVocabulary("art_crafts");

  assert.ok(first.boundedTerms.length <= MAX_RETRIEVAL_TERMS);
  assert.deepEqual(first, second);
  assert.equal(new Set(first.boundedTerms).size, first.boundedTerms.length);
  assert.equal(first.englishAliases.includes("and"), false);
});

test("alias-only scoring uses one bounded score regardless of synonym count", () => {
  const vocabulary = buildReviewedInterestVocabulary("arduino");
  const material = {
    id: "material",
    ownerId: "supplier",
    title: "Prototype board",
    description: "أردوينو أردوينو",
    materialType: "Prototype Board",
    categoryId: "electronics",
    categoryNameEn: "Electronics",
    categoryNameAr: "إلكترونيات",
    status: "AVAILABLE",
    isFree: true,
    deliveryAllowed: false,
    pickupAllowed: true,
    viewsCount: 0,
    likesCount: 0,
    city: "",
    area: null,
    tags: [],
    createdAt: new Date("2026-01-01T00:00:00Z"),
    availableQuantity: 1,
    mapped: {},
  };

  const score = scoreMaterialWithReviewedAliases(material, vocabulary, "B");
  assert.ok(score.score > 0);
  assert.equal(score.score, 12);
});
