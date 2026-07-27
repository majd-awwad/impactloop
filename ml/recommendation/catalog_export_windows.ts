/**
 * Slice 1A: Windows-only, read-only, privacy-safe public catalog exporter.
 *
 * Invoke directly with the repository's existing Windows tsx runtime. This
 * file is offline tooling and is not imported by the backend application.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const ORIGIN = "IMPACTLOOP_CATALOG_READ_ONLY_SNAPSHOT";
const SCHEMA_VERSION = "impactloop-catalog-snapshot-v2";
const EXPORTER_VERSION = "slice-2-controlled-label-exporter-v2";
const OUTPUT_DIR = resolve("ml/recommendation/generated/catalog-snapshot");

export const ALLOWED_TABLES = new Set([
  "materials", "categories", "material_types", "material_concepts",
  "taxonomy_concepts", "learning_projects", "learning_project_concepts",
  "project_required_components", "project_component_concepts",
]);

export const PROHIBITED_TABLES = new Set([
  "users", "learner_profiles", "supplier_profiles", "user_roles",
  "material_likes", "material_views", "reservations", "project_builds",
  "recommendation_impressions", "recommendation_actions", "notifications",
  "auth_tokens",
]);

const MATERIAL_QUERY = `
  SELECT m.id, m.category_id, c.name_en AS category_label,
         mt.normalized_name AS material_type, mt.name_en AS material_type_label,
         m.condition::text AS condition, m.is_free,
         CASE WHEN m.is_free THEN 'FREE'
              WHEN m.price IS NULL THEN 'UNKNOWN'
              WHEN m.price < 25 THEN 'LOW'
              WHEN m.price < 100 THEN 'MEDIUM' ELSE 'HIGH' END AS price_bucket,
         m.pickup_allowed, m.delivery_allowed, m.status::text AS state,
         m.created_at AS published_at,
         COALESCE(array_agg(DISTINCT tc.canonical_key)
           FILTER (WHERE tc.canonical_key IS NOT NULL AND tc.status::text = 'ACTIVE'),
           ARRAY[]::text[]) AS concept_keys,
         COALESCE(array_agg(DISTINCT tc.label_en)
           FILTER (WHERE tc.canonical_key IS NOT NULL AND tc.status::text = 'ACTIVE'),
           ARRAY[]::text[]) AS concept_labels
  FROM materials m
  JOIN categories c ON c.id = m.category_id
  LEFT JOIN material_types mt ON mt.id = m.material_type_id AND mt.is_active = true
  LEFT JOIN material_concepts mc ON mc.material_id = m.id
  LEFT JOIN taxonomy_concepts tc ON tc.id = mc.concept_id
  GROUP BY m.id, m.category_id, c.name_en, mt.normalized_name, mt.name_en
  ORDER BY m.id
`;

const PROJECT_QUERY = `
  SELECT p.id, p.category_id, c.name_en AS category_label,
         p.difficulty::text AS difficulty,
         p.status::text AS state, p.created_at AS published_at,
         COALESCE(array_agg(DISTINCT pc.canonical_key)
           FILTER (WHERE pc.canonical_key IS NOT NULL AND pc.status::text = 'ACTIVE'),
           ARRAY[]::text[]) AS concept_keys,
         COALESCE(array_agg(DISTINCT pc.label_en)
           FILTER (WHERE pc.canonical_key IS NOT NULL AND pc.status::text = 'ACTIVE'),
           ARRAY[]::text[]) AS concept_labels,
         COALESCE(array_agg(DISTINCT cc.canonical_key)
           FILTER (WHERE cc.canonical_key IS NOT NULL AND cc.status::text = 'ACTIVE'),
           ARRAY[]::text[]) AS component_concept_keys,
         COALESCE(array_agg(DISTINCT cc.label_en)
           FILTER (WHERE cc.canonical_key IS NOT NULL AND cc.status::text = 'ACTIVE'),
           ARRAY[]::text[]) AS component_concept_labels
  FROM learning_projects p
  JOIN categories c ON c.id = p.category_id
  LEFT JOIN learning_project_concepts lpc ON lpc.project_id = p.id
  LEFT JOIN taxonomy_concepts pc ON pc.id = lpc.concept_id
  LEFT JOIN project_required_components prc
    ON prc.project_id = p.id AND prc.is_required = true
  LEFT JOIN project_component_concepts pcc ON pcc.component_id = prc.id
  LEFT JOIN taxonomy_concepts cc ON cc.id = pcc.concept_id
  GROUP BY p.id, p.category_id, c.name_en
  ORDER BY p.id
`;

const COUNT_QUERY = `
  SELECT
    (SELECT count(*)::int FROM materials) AS material_total,
    (SELECT count(*)::int FROM materials WHERE status::text = 'AVAILABLE') AS material_public,
    (SELECT count(*)::int FROM learning_projects) AS project_total,
    (SELECT count(*)::int FROM learning_projects WHERE status::text = 'PUBLISHED') AS project_public
`;

export function assertAllowedTables(sql: string): void {
  if (!/^\s*SELECT\b/i.test(sql)) throw new Error("Only SELECT statements are allowed");
  const identifiers = [...sql.matchAll(/\b(?:FROM|JOIN)\s+([a-z_]+)/gi)].map(m => m[1]);
  for (const table of identifiers) {
    if (!ALLOWED_TABLES.has(table) || PROHIBITED_TABLES.has(table)) {
      throw new Error(`Catalog query rejected table: ${table}`);
    }
  }
}

export function stableKey(namespace: "material" | "project" | "category", id: string): string {
  return createHash("sha256").update(`impactloop-${namespace}:${id}`).digest("hex");
}

function logicalHash(rows: unknown[]): string {
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

function loadDatabaseUrl(text: string): string {
  const line = text.split(/\r?\n/).find(value => /^DATABASE_URL=/.test(value));
  if (!line) throw new Error("DATABASE_URL is missing");
  const raw = line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
  const url = new URL(raw);
  url.searchParams.delete("schema");
  return url.toString();
}

export function redactError(value: unknown): string {
  return String(value).replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[REDACTED_DATABASE_URI]");
}

function metadata(exportedAt: string, materialCount: number, projectCount: number, hash: string) {
  return {
    origin: ORIGIN, schema_version: SCHEMA_VERSION, exported_at_utc: exportedAt,
    exporter_version: EXPORTER_VERSION, material_count: materialCount,
    project_count: projectCount, content_hash: hash,
  };
}

async function main(): Promise<void> {
  [MATERIAL_QUERY, PROJECT_QUERY, COUNT_QUERY].forEach(assertAllowedTables);
  const databaseUrl = loadDatabaseUrl(await readFile(resolve("apps/backend/.env"), "utf8"));
  const client = new pg.Client({ connectionString: databaseUrl });
  const started = performance.now();
  await client.connect();
  let writes = 0;
  try {
    await client.query("SET default_transaction_read_only = on");
    const readOnly = await client.query("SHOW default_transaction_read_only");
    if (readOnly.rows[0]?.default_transaction_read_only !== "on") {
      throw new Error("Read-only session could not be enforced");
    }
    await client.query("BEGIN READ ONLY");
    const counts = (await client.query(COUNT_QUERY)).rows[0];
    const materialRaw = (await client.query(MATERIAL_QUERY)).rows;
    const projectRaw = (await client.query(PROJECT_QUERY)).rows;
    await client.query("ROLLBACK");

    const materials = materialRaw.filter(r => r.state === "AVAILABLE").map(r => ({
      material_key: stableKey("material", r.id),
      category_key: stableKey("category", r.category_id),
      category_label: r.category_label,
      material_type: r.material_type ?? "unknown",
      material_type_label: r.material_type_label ?? "Unknown",
      concept_keys: [...r.concept_keys].sort(),
      concept_labels: [...r.concept_labels].sort(),
      condition: r.condition, is_free: r.is_free, price_bucket: r.price_bucket,
      pickup_allowed: r.pickup_allowed, delivery_allowed: r.delivery_allowed,
      public_state: r.state, publication_timestamp: new Date(r.published_at).toISOString(),
    })).sort((a, b) => a.material_key.localeCompare(b.material_key));

    const projects = projectRaw.filter(r => r.state === "PUBLISHED").map(r => ({
      project_key: stableKey("project", r.id),
      category_key: stableKey("category", r.category_id),
      category_label: r.category_label,
      concept_keys: [...r.concept_keys].sort(),
      concept_labels: [...r.concept_labels].sort(),
      difficulty: r.difficulty,
      component_concept_keys: [...r.component_concept_keys].sort(),
      component_concept_labels: [...r.component_concept_labels].sort(),
      public_state: r.state, publication_timestamp: new Date(r.published_at).toISOString(),
    })).sort((a, b) => a.project_key.localeCompare(b.project_key));

    const combinedHash = logicalHash([materials, projects]);
    const exportedAt = new Date().toISOString();
    const meta = metadata(exportedAt, materials.length, projects.length, combinedHash);
    const summary = {
      ...meta,
      selected_rows: {
        materials: Number(counts.material_total), learning_projects: Number(counts.project_total),
      },
      excluded_non_public: {
        materials: Number(counts.material_total) - materials.length,
        projects: Number(counts.project_total) - projects.length,
      },
      session_read_only: true, explicit_read_only_transaction: true,
      database_write_count: writes,
      queried_tables: [...ALLOWED_TABLES].sort(),
      connection_export_ms: Math.round(performance.now() - started),
    };
    await mkdir(OUTPUT_DIR, { recursive: true });
    await writeFile(resolve(OUTPUT_DIR, "materials.json"), JSON.stringify({ metadata: meta, rows: materials }, null, 2));
    await writeFile(resolve(OUTPUT_DIR, "projects.json"), JSON.stringify({ metadata: meta, rows: projects }, null, 2));
    await writeFile(resolve(OUTPUT_DIR, "catalog-summary.json"), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify({
      status: "PASS", material_count: materials.length, project_count: projects.length,
      content_hash: combinedHash, session_read_only: true,
      explicit_read_only_transaction: true, database_write_count: writes,
    }));
  } finally {
    await client.end();
  }
}

if (process.argv.includes("--self-test")) {
  assertAllowedTables("SELECT count(*) FROM materials");
  let rejected = false;
  try { assertAllowedTables("SELECT count(*) FROM users"); } catch { rejected = true; }
  if (!rejected || redactError("postgresql://secret@example/db") !== "[REDACTED_DATABASE_URI]") {
    throw new Error("exporter self-test failed");
  }
  console.log(JSON.stringify({ status: "PASS", allowed_select: true, prohibited_rejected: true, credential_redaction: true }));
} else {
  main().catch(error => {
    console.error(JSON.stringify({ status: "FAIL", error: redactError(error?.message ?? error) }));
    process.exitCode = 1;
  });
}
