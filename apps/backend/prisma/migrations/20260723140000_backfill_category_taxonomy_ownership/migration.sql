-- RP-01.2A2: deterministic one-time ownership backfill for the reviewed legacy categories.
-- Category names are selectors only for this migration. Persisted concept foreign keys are
-- authoritative after commit.

BEGIN;

SET LOCAL lock_timeout = '10s';

-- Fixed lock order: taxonomy concepts first, categories second.
-- SHARE prevents concurrent taxonomy writes while allowing ordinary reads.
LOCK TABLE "taxonomy_concepts" IN SHARE MODE;
-- SHARE ROW EXCLUSIVE prevents concurrent category writes while allowing ordinary reads.
LOCK TABLE "categories" IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE "category_ownership_backfill_mapping" (
  "category_name" TEXT NOT NULL,
  "expected_category_type" "CategoryType" NOT NULL,
  "expected_concept_key" TEXT NOT NULL,
  "expected_concept_type" "TaxonomyConceptType" NOT NULL,
  "ownership_role" TEXT NOT NULL,
  "category_id" TEXT,
  "concept_id" TEXT
) ON COMMIT DROP;

-- These are the exact AUTHORITATIVE frozen nameEn mappings from TAXONOMY_CONCEPT_SEEDS.
-- This is the only insert into the mapping relation; no permanent table receives inserts.
INSERT INTO "category_ownership_backfill_mapping" (
  "category_name",
  "expected_category_type",
  "expected_concept_key",
  "expected_concept_type",
  "ownership_role"
)
VALUES
  ('Art & Craft Supplies', 'MATERIAL'::"CategoryType", 'material-family:craft', 'MATERIAL_FAMILY'::"TaxonomyConceptType", 'material_family'),
  ('Electronics & Components', 'MATERIAL'::"CategoryType", 'material-family:electronics', 'MATERIAL_FAMILY'::"TaxonomyConceptType", 'material_family'),
  ('Fabric & Textiles', 'MATERIAL'::"CategoryType", 'material-family:fabric', 'MATERIAL_FAMILY'::"TaxonomyConceptType", 'material_family'),
  ('Lab & Education Supplies', 'MATERIAL'::"CategoryType", 'material-family:lab', 'MATERIAL_FAMILY'::"TaxonomyConceptType", 'material_family'),
  ('Metal & Fasteners', 'MATERIAL'::"CategoryType", 'material-family:metal', 'MATERIAL_FAMILY'::"TaxonomyConceptType", 'material_family'),
  ('Motors & Mechanical Parts', 'MATERIAL'::"CategoryType", 'material-family:mechanical', 'MATERIAL_FAMILY'::"TaxonomyConceptType", 'material_family'),
  ('Other Reusable Materials', 'MATERIAL'::"CategoryType", 'material-family:reusable', 'MATERIAL_FAMILY'::"TaxonomyConceptType", 'material_family'),
  ('Packaging & Containers', 'MATERIAL'::"CategoryType", 'material-family:packaging', 'MATERIAL_FAMILY'::"TaxonomyConceptType", 'material_family'),
  ('Paper & Cardboard', 'MATERIAL'::"CategoryType", 'material-family:paper', 'MATERIAL_FAMILY'::"TaxonomyConceptType", 'material_family'),
  ('Plastics & Acrylic', 'MATERIAL'::"CategoryType", 'material-family:plastic', 'MATERIAL_FAMILY'::"TaxonomyConceptType", 'material_family'),
  ('Power & Batteries', 'MATERIAL'::"CategoryType", 'material-family:power', 'MATERIAL_FAMILY'::"TaxonomyConceptType", 'material_family'),
  ('Tools & Hardware', 'MATERIAL'::"CategoryType", 'material-family:tools', 'MATERIAL_FAMILY'::"TaxonomyConceptType", 'material_family'),
  ('Wood & Boards', 'MATERIAL'::"CategoryType", 'material-family:wood', 'MATERIAL_FAMILY'::"TaxonomyConceptType", 'material_family'),
  ('Electronics', 'PROJECT'::"CategoryType", 'project-topic:electronics', 'PROJECT_TOPIC'::"TaxonomyConceptType", 'project_topic'),
  ('Home Experiments', 'PROJECT'::"CategoryType", 'project-topic:home-experiments', 'PROJECT_TOPIC'::"TaxonomyConceptType", 'project_topic'),
  ('Recycling Crafts', 'PROJECT'::"CategoryType", 'project-topic:recycling-crafts', 'PROJECT_TOPIC'::"TaxonomyConceptType", 'project_topic'),
  ('Robotics', 'PROJECT'::"CategoryType", 'project-topic:robotics', 'PROJECT_TOPIC'::"TaxonomyConceptType", 'project_topic'),
  ('Textile Crafts', 'PROJECT'::"CategoryType", 'project-topic:textile-crafts', 'PROJECT_TOPIC'::"TaxonomyConceptType", 'project_topic'),
  ('Woodworking', 'PROJECT'::"CategoryType", 'project-topic:woodworking', 'PROJECT_TOPIC'::"TaxonomyConceptType", 'project_topic');

DO $mapping_validation$
DECLARE
  "total_count" INTEGER;
  "material_count" INTEGER;
  "project_count" INTEGER;
  "failure" RECORD;
BEGIN
  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (
      WHERE "expected_category_type" = 'MATERIAL'::"CategoryType"
        AND "expected_concept_type" = 'MATERIAL_FAMILY'::"TaxonomyConceptType"
        AND "ownership_role" = 'material_family'
    )::INTEGER,
    COUNT(*) FILTER (
      WHERE "expected_category_type" = 'PROJECT'::"CategoryType"
        AND "expected_concept_type" = 'PROJECT_TOPIC'::"TaxonomyConceptType"
        AND "ownership_role" = 'project_topic'
    )::INTEGER
  INTO "total_count", "material_count", "project_count"
  FROM "category_ownership_backfill_mapping";

  IF "total_count" <> 19 OR "material_count" <> 13 OR "project_count" <> 6 THEN
    RAISE EXCEPTION
      'CATEGORY_OWNERSHIP_BACKFILL_INVALID_MAPPING_SET: total_count=%, material_count=%, project_count=%',
      "total_count",
      "material_count",
      "project_count";
  END IF;

  SELECT
    "category_name",
    "expected_category_type",
    COUNT(*)::INTEGER AS "actual_count"
  INTO "failure"
  FROM "category_ownership_backfill_mapping"
  GROUP BY "category_name", "expected_category_type"
  HAVING COUNT(*) <> 1
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'CATEGORY_OWNERSHIP_BACKFILL_INVALID_MAPPING_SET: duplicate selector category_name=%, expected_category_type=%, actual_count=%',
      "failure"."category_name",
      "failure"."expected_category_type",
      "failure"."actual_count";
  END IF;

  SELECT
    "category_name",
    "expected_category_type",
    "expected_concept_key",
    "expected_concept_type",
    "ownership_role"
  INTO "failure"
  FROM "category_ownership_backfill_mapping"
  WHERE NOT (
    (
      "expected_category_type" = 'MATERIAL'::"CategoryType"
      AND "expected_concept_type" = 'MATERIAL_FAMILY'::"TaxonomyConceptType"
      AND "ownership_role" = 'material_family'
    )
    OR
    (
      "expected_category_type" = 'PROJECT'::"CategoryType"
      AND "expected_concept_type" = 'PROJECT_TOPIC'::"TaxonomyConceptType"
      AND "ownership_role" = 'project_topic'
    )
  )
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'CATEGORY_OWNERSHIP_BACKFILL_INVALID_MAPPING_SET: category_name=%, expected_category_type=%, expected_canonical_key=%, expected_concept_type=%, ownership_role=%',
      "failure"."category_name",
      "failure"."expected_category_type",
      "failure"."expected_concept_key",
      "failure"."expected_concept_type",
      "failure"."ownership_role";
  END IF;
END
$mapping_validation$;

DO $category_validation$
DECLARE
  "failure" RECORD;
BEGIN
  SELECT
    "mapping"."category_name",
    "mapping"."expected_category_type",
    COUNT("category"."id")::INTEGER AS "actual_count"
  INTO "failure"
  FROM "category_ownership_backfill_mapping" AS "mapping"
  LEFT JOIN "categories" AS "category"
    ON "category"."name_en" = "mapping"."category_name"
    AND "category"."category_type" = "mapping"."expected_category_type"
  GROUP BY "mapping"."category_name", "mapping"."expected_category_type"
  HAVING COUNT("category"."id") = 0
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'CATEGORY_OWNERSHIP_BACKFILL_MISSING_CATEGORY: category_name=%, expected_category_type=%, actual_count=%',
      "failure"."category_name",
      "failure"."expected_category_type",
      "failure"."actual_count";
  END IF;

  SELECT
    "mapping"."category_name",
    "mapping"."expected_category_type",
    COUNT("category"."id")::INTEGER AS "actual_count"
  INTO "failure"
  FROM "category_ownership_backfill_mapping" AS "mapping"
  JOIN "categories" AS "category"
    ON "category"."name_en" = "mapping"."category_name"
    AND "category"."category_type" = "mapping"."expected_category_type"
  GROUP BY "mapping"."category_name", "mapping"."expected_category_type"
  HAVING COUNT("category"."id") > 1
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'CATEGORY_OWNERSHIP_BACKFILL_DUPLICATE_CATEGORY: category_name=%, expected_category_type=%, actual_count=%',
      "failure"."category_name",
      "failure"."expected_category_type",
      "failure"."actual_count";
  END IF;

  SELECT
    "mapping"."category_name",
    "mapping"."expected_category_type",
    "category"."id" AS "category_id",
    "category"."is_active",
    "category"."parent_id"
  INTO "failure"
  FROM "category_ownership_backfill_mapping" AS "mapping"
  JOIN "categories" AS "category"
    ON "category"."name_en" = "mapping"."category_name"
    AND "category"."category_type" = "mapping"."expected_category_type"
  WHERE NOT "category"."is_active" OR "category"."parent_id" IS NOT NULL
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'CATEGORY_OWNERSHIP_BACKFILL_INVALID_MAPPING_SET: reviewed category is not an active root category_name=%, expected_category_type=%, category_id=%, is_active=%, parent_id=%',
      "failure"."category_name",
      "failure"."expected_category_type",
      "failure"."category_id",
      "failure"."is_active",
      COALESCE("failure"."parent_id", '<null>');
  END IF;
END
$category_validation$;

DO $concept_validation$
DECLARE
  "failure" RECORD;
BEGIN
  SELECT
    "mapping"."category_name",
    "mapping"."expected_category_type",
    "mapping"."expected_concept_key",
    "mapping"."expected_concept_type",
    COUNT("concept"."id")::INTEGER AS "actual_count"
  INTO "failure"
  FROM "category_ownership_backfill_mapping" AS "mapping"
  LEFT JOIN "taxonomy_concepts" AS "concept"
    ON "concept"."canonical_key" = "mapping"."expected_concept_key"
  GROUP BY
    "mapping"."category_name",
    "mapping"."expected_category_type",
    "mapping"."expected_concept_key",
    "mapping"."expected_concept_type"
  HAVING COUNT("concept"."id") = 0
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'CATEGORY_OWNERSHIP_BACKFILL_MISSING_CONCEPT: category_name=%, expected_category_type=%, expected_canonical_key=%, expected_concept_type=%, actual_count=%',
      "failure"."category_name",
      "failure"."expected_category_type",
      "failure"."expected_concept_key",
      "failure"."expected_concept_type",
      "failure"."actual_count";
  END IF;

  SELECT
    "mapping"."category_name",
    "mapping"."expected_category_type",
    "mapping"."expected_concept_key",
    "mapping"."expected_concept_type",
    COUNT("concept"."id")::INTEGER AS "actual_count"
  INTO "failure"
  FROM "category_ownership_backfill_mapping" AS "mapping"
  JOIN "taxonomy_concepts" AS "concept"
    ON "concept"."canonical_key" = "mapping"."expected_concept_key"
  GROUP BY
    "mapping"."category_name",
    "mapping"."expected_category_type",
    "mapping"."expected_concept_key",
    "mapping"."expected_concept_type"
  HAVING COUNT("concept"."id") > 1
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'CATEGORY_OWNERSHIP_BACKFILL_INVALID_MAPPING_SET: duplicate taxonomy concept category_name=%, expected_category_type=%, expected_canonical_key=%, expected_concept_type=%, actual_count=%',
      "failure"."category_name",
      "failure"."expected_category_type",
      "failure"."expected_concept_key",
      "failure"."expected_concept_type",
      "failure"."actual_count";
  END IF;

  SELECT
    "mapping"."category_name",
    "mapping"."expected_category_type",
    "mapping"."expected_concept_key",
    "mapping"."expected_concept_type",
    "concept"."concept_type" AS "actual_concept_type"
  INTO "failure"
  FROM "category_ownership_backfill_mapping" AS "mapping"
  JOIN "taxonomy_concepts" AS "concept"
    ON "concept"."canonical_key" = "mapping"."expected_concept_key"
  WHERE "concept"."concept_type" <> "mapping"."expected_concept_type"
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'CATEGORY_OWNERSHIP_BACKFILL_WRONG_CONCEPT_TYPE: category_name=%, expected_category_type=%, expected_canonical_key=%, expected_concept_type=%, actual_concept_type=%',
      "failure"."category_name",
      "failure"."expected_category_type",
      "failure"."expected_concept_key",
      "failure"."expected_concept_type",
      "failure"."actual_concept_type";
  END IF;

  SELECT
    "mapping"."category_name",
    "mapping"."expected_category_type",
    "mapping"."expected_concept_key",
    "mapping"."expected_concept_type",
    "concept"."status" AS "actual_status"
  INTO "failure"
  FROM "category_ownership_backfill_mapping" AS "mapping"
  JOIN "taxonomy_concepts" AS "concept"
    ON "concept"."canonical_key" = "mapping"."expected_concept_key"
  WHERE "concept"."status" <> 'ACTIVE'::"TaxonomyConceptStatus"
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'CATEGORY_OWNERSHIP_BACKFILL_INACTIVE_CONCEPT: category_name=%, expected_category_type=%, expected_canonical_key=%, expected_concept_type=%, actual_status=%',
      "failure"."category_name",
      "failure"."expected_category_type",
      "failure"."expected_concept_key",
      "failure"."expected_concept_type",
      "failure"."actual_status";
  END IF;
END
$concept_validation$;

UPDATE "category_ownership_backfill_mapping" AS "mapping"
SET
  "category_id" = "category"."id",
  "concept_id" = "concept"."id"
FROM "categories" AS "category", "taxonomy_concepts" AS "concept"
WHERE "category"."name_en" = "mapping"."category_name"
  AND "category"."category_type" = "mapping"."expected_category_type"
  AND "concept"."canonical_key" = "mapping"."expected_concept_key";

DO $ownership_validation$
DECLARE
  "failure" RECORD;
BEGIN
  SELECT
    "category_name",
    "expected_category_type",
    "expected_concept_key",
    "expected_concept_type",
    "category_id",
    "concept_id"
  INTO "failure"
  FROM "category_ownership_backfill_mapping"
  WHERE "category_id" IS NULL OR "concept_id" IS NULL
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'CATEGORY_OWNERSHIP_BACKFILL_INVALID_MAPPING_SET: unresolved mapping category_name=%, expected_category_type=%, expected_canonical_key=%, expected_concept_type=%, category_id=%, concept_id=%',
      "failure"."category_name",
      "failure"."expected_category_type",
      "failure"."expected_concept_key",
      "failure"."expected_concept_type",
      COALESCE("failure"."category_id", '<null>'),
      COALESCE("failure"."concept_id", '<null>');
  END IF;

  SELECT
    "mapping"."category_name",
    "mapping"."expected_category_type",
    "mapping"."expected_concept_key",
    "mapping"."expected_concept_type",
    CASE
      WHEN "mapping"."ownership_role" = 'material_family'
        THEN "category"."project_topic_concept_id"
      ELSE "category"."material_family_concept_id"
    END AS "existing_concept_id",
    "existing_concept"."canonical_key" AS "existing_canonical_key"
  INTO "failure"
  FROM "category_ownership_backfill_mapping" AS "mapping"
  JOIN "categories" AS "category"
    ON "category"."id" = "mapping"."category_id"
  LEFT JOIN "taxonomy_concepts" AS "existing_concept"
    ON "existing_concept"."id" = CASE
      WHEN "mapping"."ownership_role" = 'material_family'
        THEN "category"."project_topic_concept_id"
      ELSE "category"."material_family_concept_id"
    END
  WHERE
    (
      "mapping"."ownership_role" = 'material_family'
      AND "category"."project_topic_concept_id" IS NOT NULL
    )
    OR
    (
      "mapping"."ownership_role" = 'project_topic'
      AND "category"."material_family_concept_id" IS NOT NULL
    )
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'CATEGORY_OWNERSHIP_BACKFILL_FORBIDDEN_SLOT: category_name=%, expected_category_type=%, expected_canonical_key=%, expected_concept_type=%, existing_concept_id=%, existing_canonical_key=%',
      "failure"."category_name",
      "failure"."expected_category_type",
      "failure"."expected_concept_key",
      "failure"."expected_concept_type",
      "failure"."existing_concept_id",
      COALESCE("failure"."existing_canonical_key", '<unresolved>');
  END IF;

  SELECT
    "mapping"."category_name",
    "mapping"."expected_category_type",
    "mapping"."expected_concept_key",
    "mapping"."expected_concept_type",
    CASE
      WHEN "mapping"."ownership_role" = 'material_family'
        THEN "category"."material_family_concept_id"
      ELSE "category"."project_topic_concept_id"
    END AS "existing_concept_id",
    "existing_concept"."canonical_key" AS "existing_canonical_key"
  INTO "failure"
  FROM "category_ownership_backfill_mapping" AS "mapping"
  JOIN "categories" AS "category"
    ON "category"."id" = "mapping"."category_id"
  LEFT JOIN "taxonomy_concepts" AS "existing_concept"
    ON "existing_concept"."id" = CASE
      WHEN "mapping"."ownership_role" = 'material_family'
        THEN "category"."material_family_concept_id"
      ELSE "category"."project_topic_concept_id"
    END
  WHERE
    (
      "mapping"."ownership_role" = 'material_family'
      AND "category"."material_family_concept_id" IS NOT NULL
      AND "category"."material_family_concept_id" <> "mapping"."concept_id"
    )
    OR
    (
      "mapping"."ownership_role" = 'project_topic'
      AND "category"."project_topic_concept_id" IS NOT NULL
      AND "category"."project_topic_concept_id" <> "mapping"."concept_id"
    )
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'CATEGORY_OWNERSHIP_BACKFILL_CONFLICT: category_name=%, expected_category_type=%, expected_canonical_key=%, expected_concept_type=%, existing_concept_id=%, existing_canonical_key=%',
      "failure"."category_name",
      "failure"."expected_category_type",
      "failure"."expected_concept_key",
      "failure"."expected_concept_type",
      "failure"."existing_concept_id",
      COALESCE("failure"."existing_canonical_key", '<unresolved>');
  END IF;
END
$ownership_validation$;

CREATE TEMP TABLE "category_ownership_backfill_updated" (
  "category_id" TEXT NOT NULL
) ON COMMIT DROP;

WITH "updated" AS (
  UPDATE "categories" AS "category"
  SET
    "material_family_concept_id" = CASE
      WHEN "mapping"."ownership_role" = 'material_family'
        THEN "mapping"."concept_id"
      ELSE "category"."material_family_concept_id"
    END,
    "project_topic_concept_id" = CASE
      WHEN "mapping"."ownership_role" = 'project_topic'
        THEN "mapping"."concept_id"
      ELSE "category"."project_topic_concept_id"
    END
  FROM "category_ownership_backfill_mapping" AS "mapping"
  WHERE "category"."id" = "mapping"."category_id"
    AND (
      (
        "mapping"."ownership_role" = 'material_family'
        AND "category"."material_family_concept_id" IS NULL
      )
      OR
      (
        "mapping"."ownership_role" = 'project_topic'
        AND "category"."project_topic_concept_id" IS NULL
      )
    )
  RETURNING "category"."id"
)
INSERT INTO "category_ownership_backfill_updated" ("category_id")
SELECT "id"
FROM "updated";

DO $postcondition_validation$
DECLARE
  "failure" RECORD;
  "actual_total" INTEGER;
  "actual_material" INTEGER;
  "actual_project" INTEGER;
BEGIN
  SELECT
    "mapping"."category_name",
    "mapping"."expected_category_type",
    "mapping"."expected_concept_key",
    "mapping"."expected_concept_type",
    "category"."material_family_concept_id",
    "category"."project_topic_concept_id"
  INTO "failure"
  FROM "category_ownership_backfill_mapping" AS "mapping"
  JOIN "categories" AS "category"
    ON "category"."id" = "mapping"."category_id"
  WHERE NOT (
    (
      "mapping"."ownership_role" = 'material_family'
      AND "category"."material_family_concept_id" = "mapping"."concept_id"
      AND "category"."project_topic_concept_id" IS NULL
    )
    OR
    (
      "mapping"."ownership_role" = 'project_topic'
      AND "category"."project_topic_concept_id" = "mapping"."concept_id"
      AND "category"."material_family_concept_id" IS NULL
    )
  )
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'CATEGORY_OWNERSHIP_BACKFILL_POSTCONDITION_FAILED: category_name=%, expected_category_type=%, expected_canonical_key=%, expected_concept_type=%, material_family_concept_id=%, project_topic_concept_id=%',
      "failure"."category_name",
      "failure"."expected_category_type",
      "failure"."expected_concept_key",
      "failure"."expected_concept_type",
      COALESCE("failure"."material_family_concept_id", '<null>'),
      COALESCE("failure"."project_topic_concept_id", '<null>');
  END IF;

  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (
      WHERE "mapping"."ownership_role" = 'material_family'
        AND "category"."material_family_concept_id" = "mapping"."concept_id"
        AND "category"."project_topic_concept_id" IS NULL
    )::INTEGER,
    COUNT(*) FILTER (
      WHERE "mapping"."ownership_role" = 'project_topic'
        AND "category"."project_topic_concept_id" = "mapping"."concept_id"
        AND "category"."material_family_concept_id" IS NULL
    )::INTEGER
  INTO "actual_total", "actual_material", "actual_project"
  FROM "category_ownership_backfill_mapping" AS "mapping"
  JOIN "categories" AS "category"
    ON "category"."id" = "mapping"."category_id";

  IF "actual_total" <> 19 OR "actual_material" <> 13 OR "actual_project" <> 6 THEN
    RAISE EXCEPTION
      'CATEGORY_OWNERSHIP_BACKFILL_POSTCONDITION_FAILED: actual_total=%, actual_material=%, actual_project=%',
      "actual_total",
      "actual_material",
      "actual_project";
  END IF;

  SELECT "updated"."category_id"
  INTO "failure"
  FROM "category_ownership_backfill_updated" AS "updated"
  LEFT JOIN "category_ownership_backfill_mapping" AS "mapping"
    ON "mapping"."category_id" = "updated"."category_id"
  WHERE "mapping"."category_id" IS NULL
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'CATEGORY_OWNERSHIP_BACKFILL_POSTCONDITION_FAILED: unrelated category updated category_id=%',
      "failure"."category_id";
  END IF;

  SELECT
    "category_name",
    "expected_category_type",
    "expected_concept_key",
    "expected_concept_type",
    "category_id",
    "concept_id"
  INTO "failure"
  FROM "category_ownership_backfill_mapping"
  WHERE "category_id" IS NULL OR "concept_id" IS NULL
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'CATEGORY_OWNERSHIP_BACKFILL_POSTCONDITION_FAILED: unresolved mapping category_name=%, expected_category_type=%, expected_canonical_key=%, expected_concept_type=%, category_id=%, concept_id=%',
      "failure"."category_name",
      "failure"."expected_category_type",
      "failure"."expected_concept_key",
      "failure"."expected_concept_type",
      COALESCE("failure"."category_id", '<null>'),
      COALESCE("failure"."concept_id", '<null>');
  END IF;
END
$postcondition_validation$;

COMMIT;
