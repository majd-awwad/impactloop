# AI Material Matching Agent (Gap Doc)

**Gap / stub — not an implementation guide.**

Distinguish three AI surfaces in the codebase:

| Surface | Status | Doc |
|---------|--------|-----|
| **ImpactLoop Assistant** (`/api/ai/v1`, Flutter `/ai/assistant`) | **Partial** | [01-general-learning-chat.md](../ai/01-general-learning-chat.md) |
| **Price suggestion** (supplier price-rule review) | **Partial** | [materials-listing.md](materials-listing.md) |
| **Material-matching agent** (credits, `ai_material_matches`, project component matching) | **Not implemented** | This doc |

**Sources inspected:** `apps/backend/src/app.ts`, `apps/backend/src/modules/ai/`, `apps/backend/prisma/schema.prisma`, `apps/backend/src/services/ai-price-suggestion.service.ts`, `apps/frontend/lib/features/ai/`, `apps/frontend/lib/features/home/`, `docs/08-implementation-status.md`

## Intended purpose (requirements / roadmap — aspirational)

From [01-requirements.md](01-requirements.md) and [05-roadmap.md](05-roadmap.md) Phase 5:

- AI generates project steps and **finds materials** for required components.
- Credit wallets, usage logs, `ai_requests`, `ai_material_matches`.
- Match types: `EXACT`, `SIMILAR`, `ALTERNATIVE`, `MISSING`.

This is **not** the same as the shipped ImpactLoop Assistant (general learning chat, build-guide tools, project authoring).

## Current code status — material matching agent

| Layer | Status | Evidence |
|-------|--------|----------|
| `ai-agent` backend module (roadmap name) | **Not implemented** | No separate `ai-agent` folder; matching APIs/credits absent |
| `ai_requests`, `ai_material_matches`, `ai_credit_wallets`, `ai_usage_logs` tables | **Not implemented** | Absent from `schema.prisma` (roadmap names only) |
| AI **material matching** for learners/projects | **Not implemented** | No matching service, credit enforcement, or match cards |
| AI **price suggestion** (listing / price-rule review) | **Partial** | `ai-price-suggestion.service.ts`, `price-rule-requests.service.ts` |
| `ai_price_lookup_logs` | **Partial** | Table + `ai-price-lookup.repository.ts`; listing-internal only |
| Flutter home “AI material helper” placeholder | **Frontend-only** | `ComingSoonCard` — not wired to matching API |
| Flutter learning hub material matching | **Not implemented** | Build checklist uses deterministic ranking/linking, not LLM matching |

**Overall:** Material-matching **AI agent** is **not implemented**. ImpactLoop Assistant and internal price AI are separate, partially shipped surfaces.

## What *is* shipped (do not conflate)

The `ai` module at `/api/ai/v1` provides:

- General learning chat (`GENERAL_LEARNING`) with conversation persistence and scope guard.
- Build-guide agent tools for trusted `BUILD_GUIDE` conversations linked to `projectBuildId`.
- Project authoring clarification, proposal preview/review/apply waves.

See [01-general-learning-chat.md](../ai/01-general-learning-chat.md) and [08-implementation-status.md](../08-implementation-status.md).

## Product intent from role planning

The learner-facing **material matching** direction (still planned):

- Project to materials: show available, missing, and alternative materials for a selected project.
- Material to projects: suggest projects a learner can build with a selected material.
- Build checklist support: available, missing, alternative, already owned, and reserved states.
- "I already have this" should remove owned materials from missing-material recommendations.

These are planned/future capabilities and should not be documented as shipped until matching APIs, schema, and Flutter flows exist.

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

### Backend (ImpactLoop Assistant — not material matching)

| Path | Role |
|------|------|
| `modules/ai/*` | `/api/ai/v1` conversations, messages, authoring, build-guide tools |

### Frontend

| Path | Role |
|------|------|
| `features/ai/*` | ImpactLoop Assistant UI (`/ai/assistant`) |
| `learning_hub/.../project_build_actions_panel.dart` | Non-AI project planning and material browsing handoff |
| `home/.../learner_home_page.dart` | Future tools — AI material helper coming soon |

### Database

| Table | Status |
|-------|--------|
| `ai_price_lookup_logs` | **Partial** — price lookup audit |
| `price_rule_requests.ai_*` columns | **Partial** — stores suggestion JSON on requests |
| `ai_conversations`, `ai_messages`, etc. | **Partial** — assistant persistence (not matching) |

## What is missing (material matching scope)

- Credit enforcement and roadmap wallet/usage tables.
- Material match persistence (`ai_material_matches` or equivalent).
- Flutter feature to submit project/component context and display EXACT/SIMILAR/ALTERNATIVE/MISSING cards.
- Integration with reservations for auto-booking without learner action.
- Moderation/admin AI log viewers for matching (see [admin](admin.md)).

## Risks

- Conflating **price-rule AI**, **ImpactLoop Assistant**, and **material-matching agent** in planning.
- Credit/billing model undefined — roadmap tables not migrated.
- Env-dependent AI (`GEMINI` etc.) — operational only when configured.

## Questions before implementation

- Single module vs split `ai-price` vs `ai-matching`?
- Credit grants on registration vs admin allocation?
- See [09-open-questions.md](../09-open-questions.md) and [ai-material-matching-flow](../flows/ai-material-matching-flow.md).

## Related docs

- [General learning chat](../ai/01-general-learning-chat.md) — shipped assistant (partial)
- [Historical AI architecture plan](../ai/00-ai-system-architecture-plan.md) — Phase 0 planning doc
- [Learning hub](learning-hub.md) — current non-AI project planning context
- [Materials listing](materials-listing.md) — price-rule AI overlap
