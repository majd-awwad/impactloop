#!/usr/bin/env node
/**
 * RP-00.3 recommendation CI test discovery runner.
 *
 * Modes: pure | db
 * - Explicit compatibility manifest for current tests
 * - Recursive watch of recommendation module roots for unclassified *.test.ts
 * - Under scripts/, only future *.recommendation-pure.test.ts / *.recommendation-db.test.ts
 * - Fails on missing required files, empty suites, overlaps, or unclassified module tests
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const PURE = [
  'src/modules/learner-home/learner-home.affinity.test.ts',
  'src/modules/learner-home/learner-home.behavior.test.ts',
  'src/modules/learner-home/learner-home.deduplication.test.ts',
  'src/modules/learner-home/learner-home.normalized-scoring.test.ts',
  'src/modules/learner-home/learner-home.relevance.test.ts',
  'src/modules/learner-home/learner-home.scoring-debug.test.ts',
  'src/modules/learner-home/learner-home.scoring.test.ts',
  'src/modules/learner-home/learner-home.section.test.ts',
  'src/modules/learner-home/learner-home.service.test.ts',
  'src/modules/learner-home/learner-interest-taxonomy.test.ts',
  'src/modules/recommendations/canonical-shadow-user-features.test.ts',
  'src/modules/recommendations/project-rank-fusion.test.ts',
  'src/modules/recommendations/project-recent-intent-confidence.test.ts',
  'src/modules/recommendations/recommendation-feature-token-contract.test.ts',
  'src/modules/taxonomy/learner-interest-resolver.test.ts',
  'src/modules/taxonomy/material-concept-assignment-publish.test.ts',
  'src/modules/taxonomy/material-concept-assignment.test.ts',
  'src/modules/taxonomy/material-taxonomy-audit.test.ts',
  'src/modules/taxonomy/taxonomy-foundation.test.ts',
  'scripts/benchmark-learner-home.test.ts',
  'scripts/category-taxonomy-ownership.test.ts',
  'scripts/evaluate-interaction-readiness.test.ts',
  'scripts/evaluate-normalized-retrieval.test.ts',
  'scripts/evaluate-ranking-delta.test.ts',
];

const DB = [
  'src/modules/learner-home/learner-home.canonical-scoring.test.ts',
  'src/modules/recommendation-events/recommendation-events.action-attribution.test.ts',
  'src/modules/recommendation-events/recommendation-events.outbox.worker.test.ts',
  'src/modules/recommendation-events/recommendation-events.test.ts',
  'src/modules/taxonomy/learner-interest-resolver.integration.test.ts',
  'scripts/evaluate-ranking-delta.orchestration.test.ts',
  'scripts/material-taxonomy-audit.test.ts',
];

const EXCLUDED = [
  'src/modules/learner-home/learner-home.consolidation.test.ts',
  'src/modules/learner-home/learner-home.outbox-runtime.test.ts',
  'src/modules/learner-home/learner-home.performance-cache-audit.test.ts',
  'src/modules/recommendations/material-rank-fusion.test.ts',
  'src/modules/recommendations/ml-runtime-alignment.test.ts',
  'src/modules/recommendations/ml-shadow.e2e.test.ts',
  'src/modules/recommendations/ml-shadow.test.ts',
  'src/modules/recommendations/project-mapping-readiness.test.ts',
  'src/modules/recommendations/project-serving.test.ts',
  'src/modules/recommendations/recommendation-feature-readiness.test.ts',
  'scripts/evaluate-slice-4j-a-ephemeral-fixtures.integration.test.ts',
  'scripts/evaluate-slice-4j-a.test.ts',
  'scripts/recommendations-demo-preflight.test.ts',
];

const MODULE_WATCH_DIRS = [
  'src/modules/learner-home',
  'src/modules/recommendations',
  'src/modules/recommendation-events',
  'src/modules/taxonomy',
];

const fail = (message) => {
  console.error(`run-recommendation-ci-tests: ${message}`);
  process.exit(1);
};

const toPosix = (value) => value.replace(/\\/g, '/');

const walkTestFiles = (relativeDir, collected, fileFilter) => {
  const absoluteDir = path.join(backendRoot, relativeDir);
  if (!existsSync(absoluteDir)) {
    return;
  }
  for (const entry of readdirSync(absoluteDir)) {
    const absolutePath = path.join(absoluteDir, entry);
    const relativePath = toPosix(path.join(relativeDir, entry));
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      walkTestFiles(relativePath, collected, fileFilter);
      continue;
    }
    if (stats.isFile() && fileFilter(entry, relativePath)) {
      collected.add(relativePath);
    }
  }
};

const classifyByFutureConvention = (relativePath) => {
  if (relativePath.endsWith('.recommendation-pure.test.ts')) {
    return 'pure';
  }
  if (relativePath.endsWith('.recommendation-db.test.ts')) {
    return 'db';
  }
  return null;
};

const assertDisjoint = (pure, db, excluded) => {
  const overlaps = [];
  for (const relativePath of pure) {
    if (db.has(relativePath) || excluded.has(relativePath)) {
      overlaps.push(relativePath);
    }
  }
  for (const relativePath of db) {
    if (excluded.has(relativePath)) {
      overlaps.push(relativePath);
    }
  }
  if (overlaps.length > 0) {
    fail(
      `Membership overlap detected (paths must belong to exactly one of pure/db/excluded): ${[...new Set(overlaps)].sort().join(', ')}`,
    );
  }
};

const buildMembership = () => {
  const pure = new Set(PURE);
  const db = new Set(DB);
  const excluded = new Set(EXCLUDED);

  assertDisjoint(pure, db, excluded);

  const moduleDiscovered = new Set();
  for (const watchDir of MODULE_WATCH_DIRS) {
    walkTestFiles(watchDir, moduleDiscovered, (entry) => entry.endsWith('.test.ts'));
  }

  for (const relativePath of [...moduleDiscovered].sort()) {
    const convention = classifyByFutureConvention(relativePath);
    if (convention === 'pure') {
      pure.add(relativePath);
      excluded.delete(relativePath);
      db.delete(relativePath);
      continue;
    }
    if (convention === 'db') {
      db.add(relativePath);
      excluded.delete(relativePath);
      pure.delete(relativePath);
      continue;
    }

    if (pure.has(relativePath) || db.has(relativePath) || excluded.has(relativePath)) {
      continue;
    }

    fail(
      `Unclassified recommendation test file: ${relativePath}. Add it to the pure/db/excluded manifest or name it *.recommendation-pure.test.ts / *.recommendation-db.test.ts.`,
    );
  }

  const scriptConventionDiscovered = new Set();
  walkTestFiles(
    'scripts',
    scriptConventionDiscovered,
    (entry) =>
      entry.endsWith('.recommendation-pure.test.ts') ||
      entry.endsWith('.recommendation-db.test.ts'),
  );

  for (const relativePath of [...scriptConventionDiscovered].sort()) {
    const convention = classifyByFutureConvention(relativePath);
    if (convention === 'pure') {
      pure.add(relativePath);
      excluded.delete(relativePath);
      db.delete(relativePath);
      continue;
    }
    if (convention === 'db') {
      db.add(relativePath);
      excluded.delete(relativePath);
      pure.delete(relativePath);
    }
  }

  assertDisjoint(pure, db, excluded);

  // Explicitly classified script tests must still exist (manifest integrity).
  assertFilesExist(
    [...PURE, ...DB, ...EXCLUDED].filter((relativePath) => relativePath.startsWith('scripts/')),
    'manifest-scripts',
  );

  return { pure, db, excluded };
};

const assertFilesExist = (paths, suiteName) => {
  for (const relativePath of paths) {
    const absolutePath = path.join(backendRoot, relativePath);
    if (!existsSync(absolutePath)) {
      fail(`Required ${suiteName} test file is missing: ${relativePath}`);
    }
  }
};

const runSuite = (suiteName, paths) => {
  const sorted = [...paths].sort((left, right) => left.localeCompare(right));
  if (sorted.length === 0) {
    fail(`Selected ${suiteName} suite is empty.`);
  }
  assertFilesExist(sorted, suiteName);

  console.log(
    JSON.stringify(
      {
        suite: suiteName,
        count: sorted.length,
        files: sorted,
      },
      null,
      2,
    ),
  );

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', '--test', '--test-concurrency=1', ...sorted],
    {
      cwd: backendRoot,
      stdio: 'inherit',
      env: process.env,
    },
  );

  if (result.error) {
    fail(`Failed to launch node test runner: ${result.error.message}`);
  }
  process.exit(result.status ?? 1);
};

const mode = process.argv[2];
if (mode !== 'pure' && mode !== 'db') {
  fail('Usage: run-recommendation-ci-tests.mjs <pure|db>');
}

const membership = buildMembership();
if (mode === 'pure') {
  runSuite('pure', membership.pure);
} else {
  runSuite('db', membership.db);
}
