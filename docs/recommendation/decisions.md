# Recommendation decision ledger

**Authority for current architecture:** [architecture/recommendation-system.md](../architecture/recommendation-system.md)

Historical phase evidence lives in [history/recommendation/README.md](../history/recommendation/README.md). Dated slice reports do not independently change production behavior.

---

## Active decisions

| ID | Date | Decision | Status |
|---|---|---|---|
| REC-009 | 2026-08-12 | **ML-primary recommendation serving** with deterministic fallback: `ML_PRIMARY` is the default runtime mode; ML owns visible ordering on `suggested_materials` and `suggested_projects` when a domain is READY and safely rankable. | **ACTIVE** |
| REC-002 | 2026-07-23 | Retain normalized scorer and typed taxonomy as foundations; activation details superseded by REC-009 for serving mode. | ACTIVE_WITH_CONDITIONS |
| REC-005 | 2026-07-23 | Material ML serving path precedes project ML promotion work. | ACTIVE (material path accepted; project path operational) |
| REC-007 | 2026-07-23 | Deterministic ranking remains comparison baseline, explicit rollback (`DETERMINISTIC`), and per-request fallback. | ACTIVE |
| REC-008 | 2026-07-23 | Recommendation outbox materialization remains opt-in until operational evidence accepts broader rollout. | ACTIVE_WITH_CONDITIONS |

## Superseded decisions

| ID | Date | Original decision | Status |
|---|---|---|---|
| REC-001 | 2026-07-23 | Keep deterministic hybrid (`legacy-v1`) as adopted active/default champion. | **SUPERSEDED** by REC-009 |
| REC-003 | 2026-07-23 | Classify LightFM path as experimental only. | **SUPERSEDED** by REC-009 (local ML_PRIMARY serving accepted) |
| REC-004 | 2026-07-23 | Block user-visible ML promotion until gates accepted. | **SUPERSEDED** by REC-009 for local/controlled acceptance; production rollout gates remain operational |
| REC-006 | 2026-07-23 | Require shadow → canary → serving promotion ladder. | **SUPERSEDED** for local default; SHADOW remains evaluation-only mode |

---

## REC-009 — ML-primary serving with deterministic fallback

### Decision

Adopt **ML_PRIMARY** as the intended serving architecture for `suggested_materials` and `suggested_projects`:

1. **Deterministic eligibility preserved** — availability, quantity, publication, access, and explicit surface rules remain authoritative.
2. **Bounded candidate retrieval** — materials retrieved with `HOME_MATERIAL_POOL_CAP = 120`; ML recall is broad within that set, not an unbounded full-catalog scan.
3. **Material recall no longer gated by deterministic `score > 0` or top-48 preselection** under ML_PRIMARY. Neutral stable recall order (material id) precedes ML ranking.
4. **Deterministic scoring retained** for explanations, diagnostics, `DETERMINISTIC` mode, fallback display, and evaluation tooling.
5. **Project path unchanged in eligibility**; ML ranks safely mappable candidates; unmapped tail uses containment semantics.
6. **SHADOW** remains comparison-only (no served reordering).
7. **Recent intent / rank fusion** remain evaluation-only, not active serving owners.

### Reason

End-to-end acceptance demonstrated READY artifacts, ML_RANKED / ML_SERVED coverage on controlled personas, ML-owned final order, stable project behavior, and green recommendation CI after candidate-recall refinement.

### Rollback

Set `RECOMMENDATION_ML_RUNTIME_MODE=DETERMINISTIC` (or remove/disable artifact paths to force deterministic fallback per domain). No schema or client change required.

### Observability expectations

- Per-request `servingTruth` and structured logs distinguish ML_SERVED vs fallback.
- `READY` at startup does not prove ML served a request.
- Smoke and demo preflight require ML_RANKED + ML-owned order when ML_PRIMARY and domain READY.

---

## REC-001 (superseded) — deterministic champion

Originally recorded deterministic hybrid (`legacy-v1`) as the adopted default champion (2026-07-23). Superseded by REC-009 after ML_PRIMARY serving, artifact validation, smoke, and candidate-recall refinement. Deterministic logic remains for eligibility and fallback; it is no longer the primary ranking owner under default runtime mode.

---

## Decision outcomes (experiments)

Experimental work still ends with: `ADOPT`, `ADOPT_WITH_CONDITIONS`, `CONTINUE_EXPERIMENT`, `DEFER`, or `REJECT`. Implementation completion alone is insufficient for adoption.
