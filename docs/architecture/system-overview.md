# ImpactLoop system overview

Code-derived architecture for the checked-out repository.

**Ship status:** [08-implementation-status.md](../08-implementation-status.md)  
**Recommendation serving (canonical):** [recommendation-system.md](recommendation-system.md)

---

## Repository layout

```
impactloop/
  AGENTS.md
  README.md
  package.json                 # npm workspace: apps/backend
  apps/
    backend/                   # Node.js API + Prisma
    frontend/                  # Flutter client
  docs/
  ml/recommendation/           # Python training + locks
```

There is **no** top-level application `database/` folder (schema docs live under `docs/database/`).

---

## Backend

- **Stack:** Node.js, Express 5, TypeScript, PostgreSQL + PostGIS, Prisma, JWT auth, Zod validation
- **Style:** Modular monolith under `apps/backend/src/modules/`
- **API catalog:** [backend/api-catalog.md](../backend/api-catalog.md)
- **Modules map:** [backend/modules-map.md](../backend/modules-map.md)

### Learner Home and recommendations

The `learner-home` module serves `GET /api/learner/home` and section endpoints. **Suggested materials and suggested projects** use **ML_PRIMARY** ranking when artifacts are READY (LightFM portable v2 via TypeScript runtime). Other home sections use deterministic or business rules.

Details: [recommendation-system.md](recommendation-system.md) — not duplicated here.

Configuration: `RECOMMENDATION_ML_RUNTIME_MODE`, artifact path env vars in `apps/backend/src/config/env.ts`.

---

## Frontend

- **Stack:** Flutter, Riverpod, GoRouter, Dio
- **Features:** 14 under `apps/frontend/lib/features/`
- **Routes:** [frontend/routes-map.md](../frontend/routes-map.md)

Home feed consumes learner-home API; clients do not implement ranking logic.

---

## Database

46 Prisma models. PostGIS on locations. Detail: [database/schema-overview.md](../database/schema-overview.md).

**Note:** [03-database.md](../03-database.md) is stale — use `docs/database/*`.

---

## AI subsystems (distinct)

| Subsystem | Purpose | Doc |
|-----------|---------|-----|
| Recommendation ML | Learner Home ranking (LightFM) | [recommendation-system.md](recommendation-system.md) |
| Conversational AI | Chat / assistant | [ai/01-general-learning-chat.md](../ai/01-general-learning-chat.md) |

Boundary: [ai-system.md](ai-system.md)

---

## Security and API conventions

- Role middleware, hashed secrets, Zod input validation
- Response envelope: [04-api-conventions.md](../04-api-conventions.md)

---

## Deployment

[deployment.md](../deployment.md) — uploads persistence, Docker, ML_PRIMARY production concept.
