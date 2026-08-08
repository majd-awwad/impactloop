# AI Material Matching Flow (Planned — Not Implemented)

**Gap / stub flow.** Product “AI agent” for matching project components to materials is **not built**. This is distinct from:

- **ImpactLoop Assistant** — shipped at `/api/ai/v1` + Flutter `/ai/assistant` ([01-general-learning-chat.md](../ai/01-general-learning-chat.md))
- **Price-rule AI** — internal supplier listing review ([materials-listing.md](../features/materials-listing.md))

**Sources inspected:** `docs/features/ai-agent.md`, `apps/backend/src/modules/ai/`, `apps/backend/prisma/schema.prisma`, `apps/frontend/lib/features/ai/`, `apps/frontend/lib/features/learning_hub/`, `apps/backend/src/services/ai-price-suggestion.service.ts`

## Trigger (planned)

Authenticated learner views a learning project (or home AI helper) and requests AI to find materials for required components.

---

## Current reality

| Step | Status |
|------|--------|
| Material-matching API (`ai_requests`, credits, match cards) | **Not implemented** |
| `ai_material_matches`, `ai_credit_wallets` tables | **Not implemented** in schema |
| Learning hub LLM material matching panel | **Not implemented** — build checklist uses deterministic ranking/linking |
| Home AI material helper card | **Frontend-only** — coming soon placeholder |
| Price suggestion on price-rule create | **Partial** — not material matching |
| ImpactLoop Assistant (`/api/ai/v1`) | **Partial** — general learning + build-guide + authoring; **not** component match cards |

---

## Planned user path (requirements — not built)

1. Learner opens project detail with required components.
2. Submits AI match request (credit check).
3. System returns matches: EXACT / SIMILAR / ALTERNATIVE / MISSING per component.
4. Learner browses linked materials or discovery results.

### Frontend path (planned)

- Add a new AI matching UI/repository when this flow is intentionally implemented.
- Credit balance display — no UI today.

### Backend path (planned)

- New endpoints or mode under `ai` module: create `ai_request`, debit credits, call model, persist `ai_material_matches`.
- Query materials discovery data — integration TBD.

### Database changes (planned)

- Roadmap matching/credit tables not migrated; `ai_price_lookup_logs` exists for price lookups only; `ai_conversations` exists for assistant chat.

### Success state (planned)

Structured match list per component with links to `/materials` items.

### Error states (planned)

- Insufficient credits → 402/403 (product rule TBD)
- AI provider down → 503
- No matches → empty MISSING rows

### Files involved today (non-matching)

`features/ai/*` (assistant only), `project_build_actions_panel.dart` (non-AI planning handoff), `learner_home_page.dart` (placeholder), `ai-price-suggestion.service.ts` (price only)

---

## Not implemented

Do not document `/api/ai/requests` or `/api/ai/credits/me` as shipped — they are absent from [api-catalog](../backend/api-catalog.md).

**Distinct from:** `/api/ai/v1` ImpactLoop Assistant and price-rule AI in [materials-listing](../features/materials-listing.md).

---

## Open questions

- Credit wallet MVP rules?
- One-shot match vs conversational agent?
- Moderation of AI-suggested external purchases?
- See [09-open-questions.md](../09-open-questions.md) and [learning-hub-browse-flow](learning-hub-browse-flow.md).
