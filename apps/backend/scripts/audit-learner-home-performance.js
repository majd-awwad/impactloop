import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { env } from '../src/config/env.js';
import { RECOMMENDATION_SCORER_VERSION } from '../src/config/recommendation-scoring-version.js';
import { attributeProjectOnlyMaterialConceptSql, canonicalizeEvaluationTimeUtc, classifyAuditStatus, classifyLearnerHomeQueryEvent, evaluateBroaderNPlusOne, evaluateCacheStateSamples, evaluateCanonicalHydrationRequirement, evaluateWarmCandidateSqlSamples, medianSample, measureWithQueryAudit, parseAuditProfile, percentileNearestRank, readMlRuntimeFlagSnapshot, summarizeLearnerHomeQueryEvents, withCanonicalIsolatedMlFlags, withFrozenEvaluationTime, } from '../src/modules/learner-home/learner-home.query-audit.js';
import { BROWSE_MATERIAL_POOL_CAP, HOME_MATERIAL_POOL_CAP, MATERIAL_CONCEPT_HYDRATION_CHUNK_SIZE, loadDefaultSavedLocation, loadLearnerInterests, loadMaterialCandidatesForLearner, loadProjectPool, } from '../src/modules/learner-home/learner-home.repository.js';
import { getLearnerHomeSectionForAudit, getLearnerHomeWithCacheStateForAudit, invalidateLearnerHomeCache, LEARNER_HOME_CACHE_TTL_MS, resolveMaterialCandidatePoolCap, runLearnerHomeUncachedAudit, } from '../src/modules/learner-home/learner-home.service.js';
import { prisma } from '../src/database/prisma.js';
/**
 * Evidence-bound required callers. VERIFIED_POSITIVE only when both an exact
 * test file and a scoped validation command are listed (not a free-form claim).
 */
export const REQUIRED_INVALIDATION_EVIDENCE = [
    {
        mutation: 'profile.updateLearnerProfileForUser (interests)',
        classification: 'VERIFIED_POSITIVE',
        scope: 'per-user',
        maxStaleWindowMs: null,
        evidenceTestFile: 'src/modules/profile/profile.test.ts',
        validationCommand: 'node --import tsx --test src/modules/profile/profile.test.ts',
        required: true,
    },
    {
        mutation: 'locations saved location create/update/delete',
        classification: 'VERIFIED_POSITIVE',
        scope: 'per-user',
        maxStaleWindowMs: null,
        evidenceTestFile: 'src/modules/locations/locations.test.ts',
        validationCommand: 'node --import tsx --test src/modules/locations/locations.test.ts',
        required: true,
    },
    {
        mutation: 'materials.likeMaterialById / unlikeMaterialById',
        classification: 'VERIFIED_POSITIVE',
        scope: 'per-user',
        maxStaleWindowMs: null,
        evidenceTestFile: 'src/modules/materials/materials.discovery.test.ts',
        validationCommand: 'node --import tsx --test src/modules/materials/materials.discovery.test.ts',
        required: true,
    },
    {
        mutation: 'materials authenticated view (getMaterialById records view)',
        classification: 'VERIFIED_POSITIVE',
        scope: 'per-user',
        maxStaleWindowMs: null,
        evidenceTestFile: 'src/modules/learner-home/learner-home.performance-cache-audit.test.ts',
        validationCommand: 'node --import tsx --test src/modules/learner-home/learner-home.performance-cache-audit.test.ts',
        required: true,
    },
    {
        mutation: 'reservations create / cancel / availability transitions',
        classification: 'VERIFIED_POSITIVE',
        scope: 'global',
        maxStaleWindowMs: null,
        evidenceTestFile: 'src/modules/reservations/reservations.create.test.ts',
        validationCommand: 'node --import tsx --test src/modules/reservations/reservations.create.test.ts src/modules/materials/materials.discovery.test.ts',
        required: true,
    },
    {
        mutation: 'learning-projects save/follow/like ±',
        classification: 'VERIFIED_POSITIVE',
        scope: 'per-user',
        maxStaleWindowMs: null,
        evidenceTestFile: 'src/modules/learning-projects/learning-projects.mine.test.ts',
        validationCommand: 'node --import tsx --test src/modules/learning-projects/learning-projects.mine.test.ts',
        required: true,
    },
    {
        mutation: 'learning-projects builds / material linking',
        classification: 'VERIFIED_POSITIVE',
        scope: 'per-user',
        maxStaleWindowMs: null,
        evidenceTestFile: 'src/modules/learning-projects/learning-projects.mine.test.ts',
        validationCommand: 'node --import tsx --test src/modules/learning-projects/learning-projects.mine.test.ts src/modules/learning-projects/learning-projects.material-linking.test.ts',
        required: true,
    },
];
export const TTL_ONLY_GAP_ROWS = [
    {
        mutation: 'supplier material create/update/status/delete',
        classification: 'TTL_ONLY_GAP',
        scope: 'all-learners (Full Home response cache)',
        maxStaleWindowMs: LEARNER_HOME_CACHE_TTL_MS,
        evidenceTestFile: 'apps/backend/src/modules/supplier/supplier.service.ts',
        validationCommand: 'report-only',
        required: false,
    },
    {
        mutation: 'material concept refresh on supplier persist',
        classification: 'TTL_ONLY_GAP',
        scope: 'all-learners (Canonical scorers)',
        maxStaleWindowMs: LEARNER_HOME_CACHE_TTL_MS,
        evidenceTestFile: 'apps/backend/src/modules/supplier/supplier.service.ts',
        validationCommand: 'report-only',
        required: false,
    },
    {
        mutation: 'admin / project catalog publish-moderation',
        classification: 'TTL_ONLY_GAP',
        scope: 'all-learners',
        maxStaleWindowMs: LEARNER_HOME_CACHE_TTL_MS,
        evidenceTestFile: 'apps/backend/src/modules/admin-learning-projects/admin-learning-projects.service.ts',
        validationCommand: 'report-only',
        required: false,
    },
];
export const buildCallerMatrix = () => [
    ...REQUIRED_INVALIDATION_EVIDENCE,
    ...TTL_ONLY_GAP_ROWS,
];
const parsePositiveInt = (raw, flag) => {
    if (!/^\d+$/.test(raw)) {
        throw new Error(`${flag} must be a positive integer`);
    }
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1) {
        throw new Error(`${flag} must be a positive integer`);
    }
    return value;
};
export const parseAuditCliArgs = (argv) => {
    let profile;
    let email = '';
    let evaluationTimeUtc = '';
    let reportDir = '';
    let coldSamples = 5;
    let warmSamples = 10;
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        const next = argv[index + 1];
        if (arg === '--profile' && next) {
            profile = parseAuditProfile(next);
            index += 1;
        }
        else if (arg === '--email' && next) {
            email = next;
            index += 1;
        }
        else if (arg === '--evaluation-time' && next) {
            evaluationTimeUtc = next;
            index += 1;
        }
        else if (arg === '--report-dir' && next) {
            reportDir = next;
            index += 1;
        }
        else if (arg === '--cold-samples' && next) {
            coldSamples = parsePositiveInt(next, '--cold-samples');
            index += 1;
        }
        else if (arg === '--warm-samples' && next) {
            warmSamples = parsePositiveInt(next, '--warm-samples');
            index += 1;
        }
    }
    if (!profile || !email || !evaluationTimeUtc || !reportDir) {
        throw new Error('Usage: audit-learner-home-performance.ts --profile <configured-runtime|canonical-isolated> --email <email> --evaluation-time <ISO-Z> --report-dir <dir>');
    }
    return {
        profile,
        email,
        evaluationTimeUtc: canonicalizeEvaluationTimeUtc(evaluationTimeUtc),
        reportDir,
        coldSamples,
        warmSamples,
    };
};
const resolveLearnerId = async (email) => {
    const user = await prisma.user.findFirst({
        where: { email },
        select: { id: true, email: true },
    });
    if (!user) {
        throw new Error(`LEARNER_NOT_FOUND: ${email}`);
    }
    return user;
};
const timeCall = async (run) => {
    const startedAt = performance.now();
    const result = await run();
    return { result, durationMs: performance.now() - startedAt };
};
const invariant = (name, pass, expected, observed, evidence) => ({
    name,
    status: pass ? 'PASS' : 'FAIL',
    expected,
    observed,
    evidence,
});
const knownTableMisclassifiedAsOther = (events) => events.some((event) => {
    const cls = classifyLearnerHomeQueryEvent(event);
    if (cls !== 'Other') {
        return false;
    }
    return /material_concepts|materials|learning_projects|material_likes|material_views|reservations|project_saves|project_likes|project_follows|project_builds|project_required_components|project_tags|material_tags|categories|locations|user_saved_locations|learner_profiles|learner_interest_concepts|taxonomy_concepts|taxonomy_aliases|project_user_reviews/i.test(event.query);
});
const runMeasuredAuditBody = async (options) => {
    const queryEventsEnabled = process.env.PRISMA_QUERY_EVENTS === '1';
    const learner = await resolveLearnerId(options.email);
    const evaluationTimeUtc = options.evaluationTimeUtc;
    const callerMatrix = buildCallerMatrix();
    const invariants = [];
    const mlFlagsAtMeasurement = readMlRuntimeFlagSnapshot(env);
    const profile = options.profile;
    invariants.push(invariant('query_events_enabled', queryEventsEnabled, true, queryEventsEnabled, 'PRISMA_QUERY_EVENTS must be 1 for SQL measurement'));
    const unverifiedRequired = callerMatrix.filter((row) => row.required && row.classification === 'UNVERIFIED_CALLER');
    invariants.push(invariant('required_invalidation_callers_verified', unverifiedRequired.length === 0, 0, unverifiedRequired.length, unverifiedRequired.map((row) => row.mutation).join('; ') ||
        'all required callers evidence-bound'));
    const coldSamples = [];
    invalidateLearnerHomeCache(learner.id);
    await withFrozenEvaluationTime(evaluationTimeUtc, async () => {
        await getLearnerHomeWithCacheStateForAudit(learner.id);
    });
    for (let index = 0; index < options.coldSamples; index += 1) {
        invalidateLearnerHomeCache(learner.id);
        const sample = await withFrozenEvaluationTime(evaluationTimeUtc, async () => {
            if (!queryEventsEnabled) {
                const timed = await timeCall(() => getLearnerHomeWithCacheStateForAudit(learner.id));
                return {
                    durationMs: timed.durationMs,
                    cacheState: timed.result.cacheState,
                    querySummary: summarizeLearnerHomeQueryEvents([]),
                    candidateCount: timed.result.candidateCount,
                    events: [],
                    requestedMaterialScoringMode: timed.result.modeDecision.requestedMaterialScoringMode,
                    effectiveMaterialScoringMode: timed.result.modeDecision.effectiveMaterialScoringMode,
                };
            }
            const measured = await measureWithQueryAudit(async () => timeCall(() => getLearnerHomeWithCacheStateForAudit(learner.id)));
            return {
                durationMs: measured.result.durationMs,
                cacheState: measured.result.result.cacheState,
                querySummary: summarizeLearnerHomeQueryEvents(measured.events),
                candidateCount: measured.result.result.candidateCount,
                events: measured.events,
                requestedMaterialScoringMode: measured.result.result.modeDecision.requestedMaterialScoringMode,
                effectiveMaterialScoringMode: measured.result.result.modeDecision.effectiveMaterialScoringMode,
            };
        });
        coldSamples.push(sample);
    }
    const coldMissCheck = evaluateCacheStateSamples(coldSamples, 'MISS');
    invariants.push(invariant('full_home_cold_is_miss', coldMissCheck.pass, 'MISS', coldMissCheck.pass
        ? 'MISS'
        : coldSamples.map((sample) => sample.cacheState).join(','), coldMissCheck.failingIndexes.length > 0
        ? `failing sample indexes: ${coldMissCheck.failingIndexes.join(',')}`
        : 'every cold sample is MISS'));
    invariants.push(invariant('full_home_cap_120', resolveMaterialCandidatePoolCap({ kind: 'FULL_HOME' }) ===
        HOME_MATERIAL_POOL_CAP && HOME_MATERIAL_POOL_CAP === 120, 120, resolveMaterialCandidatePoolCap({ kind: 'FULL_HOME' }), 'resolveMaterialCandidatePoolCap FULL_HOME'));
    const lastCold = coldSamples[coldSamples.length - 1];
    if (queryEventsEnabled) {
        invariants.push(invariant('cold_known_tables_not_other', !knownTableMisclassifiedAsOther(lastCold.events), 0, lastCold.events.filter((event) => classifyLearnerHomeQueryEvent(event) === 'Other').length, 'mapped-table SQL classifier on Full Home miss'));
    }
    await withFrozenEvaluationTime(evaluationTimeUtc, async () => {
        await getLearnerHomeWithCacheStateForAudit(learner.id);
    });
    const warmSamples = [];
    for (let index = 0; index < options.warmSamples; index += 1) {
        const sample = await withFrozenEvaluationTime(evaluationTimeUtc, async () => {
            if (!queryEventsEnabled) {
                const timed = await timeCall(() => getLearnerHomeWithCacheStateForAudit(learner.id));
                return {
                    durationMs: timed.durationMs,
                    cacheState: timed.result.cacheState,
                    querySummary: summarizeLearnerHomeQueryEvents([]),
                };
            }
            const measured = await measureWithQueryAudit(async () => timeCall(() => getLearnerHomeWithCacheStateForAudit(learner.id)));
            return {
                durationMs: measured.result.durationMs,
                cacheState: measured.result.result.cacheState,
                querySummary: summarizeLearnerHomeQueryEvents(measured.events),
            };
        });
        warmSamples.push(sample);
    }
    const warmHitCheck = evaluateCacheStateSamples(warmSamples, 'HIT');
    invariants.push(invariant('full_home_warm_is_hit', warmHitCheck.pass, 'HIT', warmHitCheck.pass
        ? 'HIT'
        : warmSamples.map((sample) => sample.cacheState).join(','), warmHitCheck.failingIndexes.length > 0
        ? `failing sample indexes: ${warmHitCheck.failingIndexes.join(',')}`
        : 'every warm sample is HIT'));
    const warmSqlCheck = evaluateWarmCandidateSqlSamples(warmSamples);
    invariants.push(invariant('warm_hit_no_candidate_loading_sql', warmSqlCheck.pass, 0, warmSqlCheck.failingIndexes.length, warmSqlCheck.evidence));
    let suggestedMaterials = null;
    let freeMaterialsNearYou = null;
    let suggestedProjects = null;
    const measureSection = async (sectionKey) => withFrozenEvaluationTime(evaluationTimeUtc, async () => {
        const measured = await measureWithQueryAudit(async () => timeCall(() => getLearnerHomeSectionForAudit(learner.id, sectionKey, 4, 0)));
        const audited = measured.result.result;
        const summary = summarizeLearnerHomeQueryEvents(measured.events);
        return {
            durationMs: measured.result.durationMs,
            querySummary: summary,
            returnedItemCount: audited.returnedItemCount,
            candidateCounts: audited.candidateCounts,
            appliedPoolCap: audited.appliedPoolCap,
            requestedMaterialScoringMode: audited.requestedMaterialScoringMode,
            effectiveMaterialScoringMode: audited.effectiveMaterialScoringMode,
            fallbackCode: audited.fallbackCode,
            loadCanonicalMaterialConceptsMs: typeof audited.timingsMs?.loadCanonicalMaterialConcepts === 'number'
                ? audited.timingsMs.loadCanonicalMaterialConcepts
                : null,
            materialConceptSql: summary.materialConcept ?? 0,
        };
    });
    if (queryEventsEnabled) {
        suggestedMaterials = await measureSection('suggested_materials');
        freeMaterialsNearYou = await measureSection('free_materials_near_you');
        const projectsSection = await measureSection('suggested_projects');
        const materialConceptAttribution = attributeProjectOnlyMaterialConceptSql({
            materialConceptSqlCount: projectsSection.materialConceptSql,
            loadCanonicalMaterialConceptsMs: projectsSection.loadCanonicalMaterialConceptsMs,
            mlShadowEnabled: mlFlagsAtMeasurement.recommendationMlShadowEnabled,
        });
        suggestedProjects = {
            ...projectsSection,
            materialOverfetch: projectsSection.querySummary.material ?? 0,
            materialConceptAttribution,
        };
        invariants.push(invariant('browse_cap_400', suggestedMaterials.appliedPoolCap === BROWSE_MATERIAL_POOL_CAP &&
            BROWSE_MATERIAL_POOL_CAP === 400, 400, suggestedMaterials.appliedPoolCap, 'resolveMaterialCandidatePoolCap suggested_materials'));
        invariants.push(invariant('non_browse_material_cap_120', freeMaterialsNearYou.appliedPoolCap === HOME_MATERIAL_POOL_CAP, 120, freeMaterialsNearYou.appliedPoolCap, 'resolveMaterialCandidatePoolCap free_materials_near_you'));
    }
    invalidateLearnerHomeCache(learner.id);
    const hydrationAudit = await withFrozenEvaluationTime(evaluationTimeUtc, async () => runLearnerHomeUncachedAudit(learner.id));
    const loadCanonicalMaterialConceptsMs = typeof hydrationAudit.timingsMs.loadCanonicalMaterialConcepts === 'number'
        ? hydrationAudit.timingsMs.loadCanonicalMaterialConcepts
        : null;
    const requiredTimingKeys = [
        'loadLearnerHomeContext',
        'preScoreMaterials',
    ];
    for (const key of requiredTimingKeys) {
        invariants.push(invariant(`timing_present_${key}`, typeof hydrationAudit.timingsMs[key] === 'number', true, typeof hydrationAudit.timingsMs[key] === 'number', 'runLearnerHomeUncachedAudit profiler.getTimings()'));
    }
    // MaterialConcept SQL for hydration path (cold last sample when Canonical).
    const hydrationMaterialConceptSql = lastCold.querySummary.materialConcept ?? 0;
    invariants.push(...evaluateCanonicalHydrationRequirement({
        profile,
        processScorerVersion: RECOMMENDATION_SCORER_VERSION,
        requestedMaterialScoringMode: hydrationAudit.requestedMaterialScoringMode,
        effectiveMaterialScoringMode: hydrationAudit.effectiveMaterialScoringMode,
        fallbackCode: hydrationAudit.fallbackCode,
        cacheable: hydrationAudit.cacheable,
        loadCanonicalMaterialConceptsMs,
        materialCandidateCount: hydrationAudit.candidateCounts.materials,
        materialConceptSqlCount: hydrationMaterialConceptSql,
    }));
    // Project-only Canonical zero-hydration invariant (both profiles).
    if (suggestedProjects) {
        const attribution = suggestedProjects.materialConceptAttribution;
        const canonicalZero = attribution.findings.find((row) => row.code === 'CANONICAL_PROJECT_ONLY_ZERO_HYDRATION');
        invariants.push(invariant('CANONICAL_PROJECT_ONLY_ZERO_HYDRATION', canonicalZero.status === 'PASS', 0, attribution.canonicalMaterialConceptSql, canonicalZero.evidence));
        if (profile === 'canonical-isolated') {
            invariants.push(invariant('canonical_isolated_project_only_zero_material_concept_sql', attribution.totalMaterialConceptSql === 0, 0, attribution.totalMaterialConceptSql, 'ML flags disabled for canonical-isolated; project-only must have zero MaterialConcept SQL'));
        }
    }
    // material_concept_chunk_bound (deterministic live SQL) — not overall no-N+1 proof.
    let chunkBoundStatus = 'N_PLUS_ONE_UNVERIFIED';
    let chunkBoundEvidence = 'query events disabled';
    if (queryEventsEnabled) {
        const { loadMaterialConceptsForScoring } = await import('../src/modules/learner-home/learner-home.repository.js');
        const ids50 = Array.from({ length: 50 }, (_, index) => `rp035-n1-50-${index}`);
        const ids250 = Array.from({ length: 250 }, (_, index) => `rp035-n1-250-${index}`);
        const measured50 = await measureWithQueryAudit(async () => loadMaterialConceptsForScoring(ids50));
        const measured250 = await measureWithQueryAudit(async () => loadMaterialConceptsForScoring(ids250));
        const concepts50 = summarizeLearnerHomeQueryEvents(measured50.events)
            .materialConcept;
        const concepts250 = summarizeLearnerHomeQueryEvents(measured250.events)
            .materialConcept;
        chunkBoundEvidence = `50ids→${concepts50} MaterialConcept SQL; 250ids→${concepts250}`;
        if (concepts50 === 1 && concepts250 === 2) {
            chunkBoundStatus = 'PASS';
        }
        else if (concepts50 === 0 && concepts250 === 0) {
            chunkBoundStatus = 'N_PLUS_ONE_UNVERIFIED';
        }
        else {
            chunkBoundStatus = 'FAIL';
        }
    }
    invariants.push(invariant('material_concept_chunk_bound', chunkBoundStatus === 'PASS', 'PASS', chunkBoundStatus, chunkBoundEvidence));
    // Broader N+1: compare two deterministic repository candidate sizes.
    // Fixtures intentionally omit behavior fanout so material/project pool growth
    // is attributable to candidate-loading SQL, not fixed per-user behavior queries.
    const measureCandidateFixture = async (label, materialPoolCap, projectTake) => {
        const measured = await measureWithQueryAudit(async () => {
            const interests = await loadLearnerInterests(learner.id);
            const savedLocation = await loadDefaultSavedLocation(learner.id);
            const emptyBehavior = {
                likedMaterials: [],
                viewedMaterials: [],
                reservedMaterials: [],
                savedProjects: [],
                likedProjects: [],
                followedProjects: [],
                inProgressBuildProjects: [],
            };
            const materials = await loadMaterialCandidatesForLearner({
                interests,
                savedComponents: [],
                behavior: emptyBehavior,
                savedLocation,
                poolCap: materialPoolCap,
            });
            const projects = await loadProjectPool(projectTake);
            return {
                materialCandidateCount: materials.length,
                projectCandidateCount: projects.length,
                requiredComponentCount: projects.reduce((sum, project) => sum + project.requiredComponents.length, 0),
            };
        });
        return {
            label,
            events: measured.events,
            materialCandidateCount: measured.result.materialCandidateCount,
            projectCandidateCount: measured.result.projectCandidateCount,
            requiredComponentCount: measured.result.requiredComponentCount,
        };
    };
    let broaderNPlusOne = {
        status: 'N_PLUS_ONE_UNVERIFIED',
        evidence: 'query events disabled',
        shapeComparisons: [],
        violations: [],
    };
    if (queryEventsEnabled) {
        const smallCtx = await measureCandidateFixture('repo-fixture-small', 20, 8);
        const largeCtx = await measureCandidateFixture('repo-fixture-large', HOME_MATERIAL_POOL_CAP, 40);
        broaderNPlusOne = evaluateBroaderNPlusOne({
            small: smallCtx,
            large: largeCtx,
            materialConceptChunkSize: MATERIAL_CONCEPT_HYDRATION_CHUNK_SIZE,
            mlShadowEnabled: false,
        });
        // Full Home cold: absolute bounds / once-per-entity / unclassified only.
        // Do not compare growth against pool-only fixtures (behavior adds loaders).
        if (broaderNPlusOne.status === 'PASS' && lastCold.events.length > 0) {
            const coldCheck = evaluateBroaderNPlusOne({
                small: smallCtx,
                large: {
                    label: 'full-home-cold',
                    events: lastCold.events,
                    materialCandidateCount: hydrationAudit.candidateCounts.materials,
                    projectCandidateCount: hydrationAudit.candidateCounts.projects,
                    requiredComponentCount: hydrationAudit.candidateCounts.requiredComponents ??
                        largeCtx.requiredComponentCount,
                },
                materialConceptChunkSize: MATERIAL_CONCEPT_HYDRATION_CHUNK_SIZE,
                mlShadowEnabled: mlFlagsAtMeasurement.recommendationMlShadowEnabled,
                compareGrowth: false,
            });
            if (coldCheck.status !== 'PASS') {
                broaderNPlusOne = coldCheck;
            }
            else {
                broaderNPlusOne = {
                    ...broaderNPlusOne,
                    evidence: `${broaderNPlusOne.evidence}; full-home-cold also PASS`,
                    shapeComparisons: [
                        ...broaderNPlusOne.shapeComparisons,
                        ...coldCheck.shapeComparisons,
                    ],
                };
            }
        }
    }
    invariants.push(invariant('broader_n_plus_one', broaderNPlusOne.status === 'PASS', 'PASS', broaderNPlusOne.status, broaderNPlusOne.evidence));
    const findings = [
        ...(suggestedProjects?.materialConceptAttribution.findings ?? []),
        {
            code: 'material_concept_chunk_bound',
            status: chunkBoundStatus,
            evidence: chunkBoundEvidence,
        },
        {
            code: 'broader_n_plus_one',
            status: broaderNPlusOne.status,
            evidence: broaderNPlusOne.evidence,
            violations: broaderNPlusOne.violations,
            shapeComparisons: broaderNPlusOne.shapeComparisons,
        },
    ];
    const status = classifyAuditStatus({
        invariants,
        ttlGapCount: TTL_ONLY_GAP_ROWS.length,
        unverifiedRequiredCallerCount: unverifiedRequired.length,
    });
    const coldDurations = coldSamples.map((sample) => sample.durationMs);
    const warmDurations = warmSamples.map((sample) => sample.durationMs);
    const sectionReport = (section) => section
        ? {
            durationMs: section.durationMs,
            returnedItemCount: section.returnedItemCount,
            candidateCounts: section.candidateCounts,
            appliedPoolCap: section.appliedPoolCap,
            queryTotal: section.querySummary.total,
            queryExcludingTransaction: section.querySummary.excludingTransaction,
            byClass: section.querySummary.byClass,
            materialConceptSql: section.materialConceptSql,
            requestedMaterialScoringMode: section.requestedMaterialScoringMode,
            effectiveMaterialScoringMode: section.effectiveMaterialScoringMode,
            fallbackCode: section.fallbackCode,
            loadCanonicalMaterialConceptsMs: section.loadCanonicalMaterialConceptsMs,
            mlFlags: mlFlagsAtMeasurement,
            profile,
        }
        : null;
    const report = {
        schemaVersion: 'learner-home-performance-cache-audit-v3',
        status,
        profile,
        profileLabel: profile === 'canonical-isolated'
            ? 'canonical-isolated (ML shadow/serving temporarily disabled; not configured-production behavior)'
            : 'configured-runtime (no ML flag mutation; measures application as configured)',
        evaluationTimeUtc,
        learnerEmail: learner.email,
        learnerId: learner.id,
        cacheTtlMs: LEARNER_HOME_CACHE_TTL_MS,
        queryEventsEnabled,
        processScorerVersion: RECOMMENDATION_SCORER_VERSION,
        mlFlagsAtMeasurement,
        invariants,
        findings,
        measurements: {
            fullHomeCold: {
                appliedPoolCap: HOME_MATERIAL_POOL_CAP,
                samples: coldSamples.map((sample) => ({
                    durationMs: Math.round(sample.durationMs),
                    cacheState: sample.cacheState,
                    candidateCount: sample.candidateCount,
                    queryTotal: sample.querySummary.total,
                    queryExcludingTransaction: sample.querySummary.excludingTransaction,
                    byClass: sample.querySummary.byClass,
                    repeatedShapes: sample.querySummary.repeatedShapes.slice(0, 20),
                    requestedMaterialScoringMode: sample.requestedMaterialScoringMode,
                    effectiveMaterialScoringMode: sample.effectiveMaterialScoringMode,
                })),
                latencyMs: {
                    median: medianSample(coldDurations),
                    p75: percentileNearestRank(coldDurations, 75),
                    p95: percentileNearestRank(coldDurations, 95),
                    min: Math.min(...coldDurations),
                    max: Math.max(...coldDurations),
                },
            },
            fullHomeWarm: {
                samples: warmSamples.map((sample) => ({
                    durationMs: Math.round(sample.durationMs),
                    cacheState: sample.cacheState,
                    queryTotal: sample.querySummary.total,
                    queryExcludingTransaction: sample.querySummary.excludingTransaction,
                    byClass: sample.querySummary.byClass,
                    material: sample.querySummary.material ?? 0,
                    learningProject: sample.querySummary.learningProject ?? 0,
                    materialConcept: sample.querySummary.materialConcept ?? 0,
                })),
                latencyMs: {
                    median: medianSample(warmDurations),
                    p75: percentileNearestRank(warmDurations, 75),
                    p95: percentileNearestRank(warmDurations, 95),
                    min: Math.min(...warmDurations),
                    max: Math.max(...warmDurations),
                },
            },
            suggestedMaterialsBrowse: sectionReport(suggestedMaterials),
            freeMaterialsNearYou: sectionReport(freeMaterialsNearYou),
            suggestedProjects: suggestedProjects
                ? {
                    ...sectionReport(suggestedProjects),
                    materialOverfetch: suggestedProjects.materialOverfetch,
                    materialConceptAttribution: suggestedProjects.materialConceptAttribution,
                }
                : null,
            canonicalHydration: {
                timingsMs: hydrationAudit.timingsMs,
                loadCanonicalMaterialConceptsMs,
                loadLearnerHomeContextMs: hydrationAudit.timingsMs.loadLearnerHomeContext ?? null,
                preScoreMaterialsMs: hydrationAudit.timingsMs.preScoreMaterials ?? null,
                candidateCounts: hydrationAudit.candidateCounts,
                appliedPoolCap: hydrationAudit.appliedPoolCap,
                requestedMaterialScoringMode: hydrationAudit.requestedMaterialScoringMode,
                effectiveMaterialScoringMode: hydrationAudit.effectiveMaterialScoringMode,
                fallbackCode: hydrationAudit.fallbackCode,
                cacheable: hydrationAudit.cacheable,
            },
            nPlusOne: {
                material_concept_chunk_bound: {
                    status: chunkBoundStatus,
                    materialConceptHydrationChunkSize: MATERIAL_CONCEPT_HYDRATION_CHUNK_SIZE,
                    evidence: chunkBoundEvidence,
                },
                broader: broaderNPlusOne,
                coldMaterialConceptCount: lastCold.querySummary.materialConcept ?? 0,
                coldCandidateCount: lastCold.candidateCount,
                hydrationMaterialCandidateCount: hydrationAudit.candidateCounts.materials,
                hydrationProjectCandidateCount: hydrationAudit.candidateCounts.projects,
                hydrationRequiredComponentCount: hydrationAudit.candidateCounts.requiredComponents ?? null,
            },
        },
        callerMatrix,
        notes: [
            'Absolute latency is report-only and must not fail CI.',
            'TTL_ONLY_GAP rows allow PASS_WITH_TTL_GAPS when all invariants pass.',
            'Warm HIT is proven via cacheState, not latency.',
            'configured-runtime never mutates ML flags; ML_SHADOW_MATERIAL_CONCEPT_LOAD is reported, not hidden.',
            'canonical-isolated temporarily disables ML shadow/serving and restores them in finally.',
            'material_concept_chunk_bound alone is not proof of overall no N+1.',
        ],
    };
    mkdirSync(options.reportDir, { recursive: true });
    const reportPath = resolve(options.reportDir, `learner-home-performance-audit-${profile}-${Date.now()}.json`);
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return { report, reportPath, status };
};
export const runLearnerHomePerformanceAudit = async (options) => {
    if (options.profile === 'canonical-isolated') {
        return withCanonicalIsolatedMlFlags(env, () => runMeasuredAuditBody(options));
    }
    // configured-runtime: never mutate ML flags.
    return runMeasuredAuditBody(options);
};
// Re-export for unit tests.
export { classifyAuditStatus, canonicalizeEvaluationTimeUtc, withFrozenEvaluationTime, withCanonicalIsolatedMlFlags, attributeProjectOnlyMaterialConceptSql, evaluateBroaderNPlusOne, evaluateCacheStateSamples, evaluateWarmCandidateSqlSamples, evaluateCanonicalHydrationRequirement, parseAuditProfile, };
const isMain = process.argv[1] &&
    (process.argv[1].endsWith('audit-learner-home-performance.ts') ||
        process.argv[1].endsWith('audit-learner-home-performance.js'));
if (isMain) {
    const options = parseAuditCliArgs(process.argv.slice(2));
    runLearnerHomePerformanceAudit(options)
        .then(({ report, reportPath, status }) => {
        console.log(JSON.stringify({ status, profile: options.profile, reportPath }, null, 2));
        console.log(`profile=${options.profile} Cold median=${report.measurements.fullHomeCold.latencyMs.median}ms ` +
            `Warm median=${report.measurements.fullHomeWarm.latencyMs.median}ms`);
        process.exitCode = status === 'FAILED_INVARIANT' ? 1 : 0;
    })
        .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
        .finally(async () => {
        await prisma.$disconnect().catch(() => undefined);
    });
}
