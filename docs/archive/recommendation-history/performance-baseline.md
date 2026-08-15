# Recommendation Performance Baseline

## Environment

- Date: 2026-07-17
- Environment: local development
- PostgreSQL: local
- Users: 300
- Materials: 150
- Learning projects: 30
- Backend mode: development
- Cache state: documented per request

## Current Observations

| Endpoint | Cache | Duration |
|---|---|---:|
| POST /api/auth/login | warm/cold unknown | 1719 ms |
| GET /api/auth/me | n/a | 29 ms |
| GET /api/learner/home | miss | 3922 ms |

## Learner Home Breakdown

| Step | Duration |
|---|---:|
| loadLearnerHomeContext | 3534 ms |
| loadMaterialCandidates | 2489 ms |
| loadProjectCandidates | 1008 ms |
| loadLearnerBehaviorContext | 1000 ms |
| rankMaterialSections | 264 ms |