## Phase 0 — Learner Home Performance

### Slice 1: Material relevance candidate query

Status: ADOPT_WITH_CONDITIONS

Implemented:
- Consolidated repeated material title/type, tag, category, and location predicates.
- Added deterministic ID tie-breaking.
- Preserved candidate set, eligibility, ranking, hydration, and response behavior.

Measured results:
- Material candidate load median: 1,374ms → 219ms.
- Learner Home miss median: 1,795ms → 402ms.
- Relevance SQL event: approximately 1.3–2.2s → 67–100ms.
- Representative shared-buffer hits: 8,665 → 41.
- Query events per miss: 76–77 → 76.

Validation:
- Candidate IDs remained identical for the frozen benchmark learner.
- 97 Learner Home tests passed.
- Build remains blocked by a pre-existing unrelated admin-people TypeScript error.

Remaining:
- Broad material/project hydration.
- Repeated project and behavior reads.
- Cold-miss concurrency degradation.
- Login performance investigation.