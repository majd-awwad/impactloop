# AI Material Matching Flow (Planned — Not Implemented)

**Gap / stub flow.** Product “AI agent” for matching project components to materials is **not built**. Internal **price** AI is separate.

**Sources inspected:** `docs/01-requirements.md`, `docs/05-roadmap.md`, `docs/features/ai-agent.md`, `apps/backend/src/app.ts`, `apps/backend/prisma/schema.prisma`, `apps/frontend/lib/features/learning_hub/presentation/widgets/disabled_ai_panel.dart`, `apps/frontend/lib/features/home/presentation/pages/learner_home_page.dart`, `apps/backend/src/services/ai-price-suggestion.service.ts`

## Trigger (planned)

Authenticated learner views a learning project (or home AI helper) and requests AI to find materials for required components.

---

## Current reality

| Step | Status |
|------|--------|
| `ai-agent` module / matching API | **Not implemented** |
| `ai_requests`, `ai_material_matches`, credit tables | **Not implemented** in schema |
| Learning hub AI panel | **Frontend-only** — `DisabledAiPanel` (no API) |
| Home AI helper card | **Frontend-only** — coming soon |
| Price suggestion on price-rule create | **Partial** — not material matching |

---

## Planned user path (requirements — not built)

1. Learner opens project detail with required components.
2. Submits AI match request (credit check).
3. System returns matches: EXACT / SIMILAR / ALTERNATIVE / MISSING per component.
4. Learner browses linked materials or discovery results.

### Frontend path (planned)

- Replace `disabled_ai_panel.dart` with wired repository.
- Credit balance display — no UI today.

### Backend path (planned)

- New module: create `ai_request`, debit credits, call model, persist `ai_material_matches`.
- Query materials discovery data — integration TBD.

### Database changes (planned)

- Roadmap tables not migrated; only `ai_price_lookup_logs` exists today for price lookups.

### Success state (planned)

Structured match list per component with links to `/materials` items.

### Error states (planned)

- Insufficient credits → 402/403 (product rule TBD)
- AI provider down → 503
- No matches → empty MISSING rows

### Files involved today (non-matching)

`disabled_ai_panel.dart`, `learner_home_page.dart` (placeholder), `ai-price-suggestion.service.ts` (price only)

---

## Not implemented

Do not invent `/api/ai/*` paths, request bodies, or credit amounts.

**Distinct from:** price-rule AI in [materials-listing](../features/materials-listing.md).

---

## Open questions

- Credit wallet MVP rules?
- One-shot match vs conversational agent?
- Moderation of AI-suggested external purchases?
- See [09-open-questions.md](../09-open-questions.md) and [learning-hub-browse-flow](learning-hub-browse-flow.md).
