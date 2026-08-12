# Local ML runbook

Train, validate, and serve LightFM recommendations locally with **ML_PRIMARY** runtime mode.

**Not experimental-only:** local training produces artifacts consumed by the same ML_PRIMARY architecture used in production-capable configuration. Local vs production differs in **where** artifacts live and how they are deployed — not in the ranking architecture.

Prerequisites and general setup: [local-development.md](local-development.md).  
Architecture: [architecture/recommendation-system.md](../architecture/recommendation-system.md).

---

## Prerequisites (ML-specific)

| Requirement | Authority |
|-------------|-----------|
| Linux Python 3.11 + LightFM | `ml/recommendation/requirements-linux-lock.txt`, `pyproject.toml`, [linux-lightfm-viability.md](../../ml/recommendation/linux-lightfm-viability.md) |
| WSL on Windows | Training only; Node smoke/validate/backend on Windows |
| Gitignored output | `ml/recommendation/generated/` |

Do **not** use Windows-native LightFM for accepted training.

---

## Artifact and runtime truth

| Item | Value |
|------|-------|
| Portable schema | `impactloop-lightfm-portable-v2` |
| Local model lineage | `lm-06-local-lightfm-v1` |
| Feature contract | `recommendation-feature-token-contract-v3` (v3.0.0) |
| Aggregation | `weighted-sum` |

Do not copy machine-specific artifact set IDs into shared docs as permanent protocol identifiers.

**Integrity:** Never manually edit semantic hashes or taxonomy fingerprints in generated JSON. On drift: re-export snapshot → retrain → validate.

---

## When to retrain

| Situation | Retrain? |
|-----------|----------|
| Fresh clone (no `generated/local-lightfm/`) | Yes |
| Validate/preload NOT_READY or integrity mismatch | Yes |
| Valid artifacts + READY preload | No |
| Taxonomy or feature contract changed | Yes |

Demo seed alone does **not** refresh artifacts — see [demo-data.md](../demo-data.md).

---

## Lifecycle (ordered)

Use one consistent `--evaluation-time` (ISO-8601 UTC ending in `Z`) across snapshot and train.

### 1. Snapshot export

```bash
npm run recommendations:ml:snapshot:local -w apps/backend -- --evaluation-time <ISO-UTC-Z>
```

Output under `ml/recommendation/generated/local-ml-training-snapshots/`.

### 2. Train (Linux/WSL Python)

```bash
npm run recommendations:ml:train:local -w apps/backend -- \
  --evaluation-time <ISO-UTC-Z> \
  --python wsl:<Distro>:/absolute/path/to/python3.11
```

Or set `IMPACTLOOP_ML_PYTHON`. Publishes `ml/recommendation/generated/local-lightfm/current.json` and `sets/<setId>/*-lightfm-v2.json`.

### 3. Validate (both domains from `.env` paths)

Set in `apps/backend/.env`:

```bash
RECOMMENDATION_ML_MATERIAL_ARTIFACT_PATH=<path/to/material-lightfm-v2.json>
RECOMMENDATION_ML_PROJECT_ARTIFACT_PATH=<path/to/project-lightfm-v2.json>
```

Then:

```bash
npm run recommendations:ml:validate:local -w apps/backend
```

This validates **both** artifacts using env paths (no per-file `--artifact` required).

Low-level single-artifact validate (optional):

```bash
npx tsx scripts/train-local-lightfm.ts validate-artifact \
  --artifact <path> --expected-domain material
```

### 4. Configure runtime

```bash
RECOMMENDATION_ML_RUNTIME_MODE=ML_PRIMARY   # default when unset
RECOMMENDATION_ML_MATERIAL_ARTIFACT_PATH=...
RECOMMENDATION_ML_PROJECT_ARTIFACT_PATH=...
```

Legacy `RECOMMENDATION_ML_*_SERVING_ENABLED` flags must not be set (removed).

Startup preloads artifacts; missing/incompatible → domain NOT_READY → deterministic fallback (process still starts).

---

## Runtime modes (summary)

| Mode | Visible ordering |
|------|------------------|
| `ML_PRIMARY` | ML when READY + safely rankable; else deterministic fallback |
| `DETERMINISTIC` | Deterministic only (rollback/debug) |
| `SHADOW` | Deterministic served; ML comparison logged only |

---

## Verification

```bash
npm run recommendations:ml:smoke:local -w apps/backend
npm run recommendations:demo:preflight -w apps/backend
```

Preflight defaults to `--mode=both` when omitted. Explicit mode:

```bash
npm run recommendations:demo:preflight -w apps/backend -- --mode=both
```

Under ML_PRIMARY, smoke requires `ML_RANKED` + ML-owned order when domain READY — HTTP 200 with silent fallback alone is **not** a pass.

### Recommendation CI (reference)

```bash
npm run typecheck:recommendations:ci -w apps/backend
npm run test:recommendations:ci:pure -w apps/backend
```

Pure recommendation CI is the regression gate for ranking behavior (exact pass count may change as tests are added).

---

## Serving health vs app readiness

`/health/ready` = application/infrastructure readiness.  
Recommendation ML degradation does not necessarily fail readiness.  
See [recommendation-observability.md](../operations/recommendation-observability.md).

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `--evaluation-time` required | Pass ISO UTC timestamp to snapshot/train |
| Python lightfm missing | Linux env from `requirements-linux-lock.txt` + WSL `--python` |
| Windows native crash | Train on WSL; consume JSON on Node |
| NOT_READY / ARTIFACT_PATH_MISSING | Train + set env paths |
| TAXONOMY_FINGERPRINT_MISMATCH etc. | Retrain; do not edit hashes manually |
| npm preflight without mode | Uses default `both` since Slice C fix |

---

## Manual Learner Home check

1. Start backend + Flutter.
2. Log in as seeded learner.
3. Open `/home` — suggested materials/projects load.
4. With ML_PRIMARY + READY artifacts: startup log shows domains READY; suggested sections reflect ML ranking when ML_SERVED.

Flutter does **not** display algorithm diagnostics to users.
