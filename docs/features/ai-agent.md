# AI Agent Feature (Gap Doc)

**Gap / stub — not an implementation guide.**

**Sources inspected:** `apps/backend/src/app.ts`, `apps/backend/prisma/schema.prisma`, `apps/backend/src/services/ai-price-suggestion.service.ts`, `apps/backend/src/services/ai-price-lookup.repository.ts`, `apps/backend/src/modules/price-rule-requests/*`, `apps/frontend/lib/features/learning_hub/presentation/widgets/disabled_ai_panel.dart`, `apps/frontend/lib/features/home/presentation/pages/learner_home_page.dart`, `docs/01-requirements.md` (§AI Agent), `docs/05-roadmap.md` (Phase 5), `AGENTS.md`, `docs/08-implementation-status.md`

## Intended purpose (requirements / roadmap — aspirational)

From [01-requirements.md](01-requirements.md) and [05-roadmap.md](05-roadmap.md) Phase 5:

- AI generates project steps and **finds materials** for required components.
- Credit wallets, usage logs, `ai_requests`, `ai_material_matches`.
- Match types: `EXACT`, `SIMILAR`, `ALTERNATIVE`, `MISSING`.

## Current code status

| Layer | Status | Evidence |
|-------|--------|----------|
| `ai-agent` backend module | **Not implemented** | Not in `app.ts` or `modules/` |
| `ai_requests`, `ai_material_matches`, `ai_credit_wallets`, `ai_usage_logs` tables | **Not implemented** | Absent from `schema.prisma` (roadmap names only) |
| AI **material matching** for learners/projects | **Not implemented** | No API or matching service |
| AI **price suggestion** (listing / price-rule review) | **Partial** | `ai-price-suggestion.service.ts`, `price-rule-requests.service.ts` |
| `ai_price_lookup_logs` | **Partial** | Table + `ai-price-lookup.repository.ts`; listing-internal only |
| Flutter AI helper on home | **Frontend-only** placeholder | `ComingSoonCard` — “AI material helper” |
| Flutter AI on learning hub | **Frontend-only** | `disabled_ai_panel.dart` — non-functional UI |

**Overall:** Material-matching **AI agent** is **not implemented**. Internal price AI is **Partial** and separate from product “AI agent” scope.

## Existing related files

### Backend (price suggestion only)

| Path | Role |
|------|------|
| `services/ai-price-suggestion.service.ts` | Gemini/mock price reference for reviews |
| `services/gemini-price-suggestion.provider.ts` | External provider |
| `services/mock-price-suggestion.provider.ts` | Fallback provider |
| `services/ai-price-lookup.repository.ts` | `AiPriceLookupLog` persistence |
| `modules/price-rule-requests/price-rule-requests.service.ts` | Invokes AI on create |
| `config/env.ts` | `isAiProviderOperational` gating |

### Frontend (placeholders)

| Path | Role |
|------|------|
| `learning_hub/.../disabled_ai_panel.dart` | Disabled copy only |
| `home/.../learner_home_page.dart` | Future tools — AI coming soon |

### Database

| Table | Status |
|-------|--------|
| `ai_price_lookup_logs` | **Partial** — price lookup audit |
| `price_rule_requests.ai_*` columns | **Partial** — stores suggestion JSON on requests |

## What is missing

- `ai-agent` module, routes, credit enforcement.
- Schema for requests, matches, wallets, usage logs per roadmap.
- Flutter feature to submit project/component context and display matches.
- Integration with material discovery search and reservations.
- Moderation/admin AI log viewers (see [admin](admin.md)).

## Risks

- Conflating **price-rule AI** with **material-matching agent** in planning.
- Credit/billing model undefined — roadmap tables not migrated.
- Env-dependent AI (`GEMINI` etc.) — operational only when configured.

## Questions before implementation

- Single module vs split `ai-price` vs `ai-matching`?
- Credit grants on registration vs admin allocation?
- See [09-open-questions.md](../09-open-questions.md) and [ai-material-matching-flow](../flows/ai-material-matching-flow.md).

## Related docs

- [Learning hub](learning-hub.md) — disabled AI panel context
- [Materials listing](materials-listing.md) — price-rule AI overlap
