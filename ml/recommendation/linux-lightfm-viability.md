# Slice 0C — Linux/WSL LightFM Viability

Date: 2026-07-19

## Decision

**PASSED.** The existing Slice 0B synthetic viability implementation runs cleanly on Ubuntu 22.04 under WSL2 with the pinned LightFM stack. This slice did not access PostgreSQL or the ImpactLoop catalog and did not start Slice 1.

## Environment

- Platform: Linux 6.6.87.2-microsoft-standard-WSL2, x86_64, glibc 2.35
- Python: 3.11.15 (conda-forge)
- Primary environment: `/tmp/impactloop-lightfm-linux-primary` on ext4
- Clean reproduction environment: `/tmp/impactloop-lightfm-linux-repro` on ext4
- Explicit Linux lock: `ml/recommendation/requirements-linux-lock.txt` (67 exact packages)
- Direct package pins: LightFM 1.17, NumPy 1.26.4, SciPy 1.13.1, pandas 2.2.3, scikit-learn 1.5.2, PyYAML 6.0.2, pytest 8.3.5
- Acceptance settings: fixed seed 1 and `num_threads=1` for fit, predict, and evaluation

## Acceptance evidence

Both the primary environment and the clean lock-recreated environment ran the complete existing suite:

- 18/18 isolated child processes exited 0.
- 0 native access violations and 0 timeouts.
- 18/18 model pickle serialization/reload checks had exact prediction parity.
- Default material matrix `300 x 160`, 5,000 positives: 5/5 stable passes.
- Default project matrix `300 x 29`, 2,500 positives: 5/5 stable passes.
- Small/default/upper identity configurations passed for both material and project domains.
- Invalid all-positive, NaN, and negative-weight matrices were rejected by preflight.
- Pytest: 6/6 passed in each environment.
- Smoke reproducibility: predictions, precision@1, and RNG probe were identical across repeated runs.

The exact feature matrices were also verified:

| Domain / mode | User feature shape | Item feature shape | Identity columns |
|---|---:|---:|---|
| Material warm | 300 x 330 | 160 x 212 | enabled |
| Material metadata-only | 300 x 30 | 160 x 52 | disabled |
| Project warm | 300 x 330 | 29 x 72 | enabled |
| Project metadata-only | 300 x 30 | 29 x 43 | disabled |

## Implementation note

The existing viability runner had a report-only `NameError` after native work completed: `run_child` referenced a local `dataset` name that had not been assigned. It now binds the already-built `dataset_info["dataset"]`; no matrix, feature construction, seed, LightFM setting, or acceptance configuration changed.

## Scope and artifacts

- No PostgreSQL connection or catalog read was made; all inputs remained synthetic.
- No Node, Flutter, Prisma, schema, migration, seed, API, or production recommendation files were modified for Slice 0C.
- Environments, package cache, installer, and runtime model bytes remained under `/tmp`.
- Repository-side generated ML environments, caches, bytecode, and generated artifacts are covered by the existing `.gitignore` rules.
- No commit was created.
