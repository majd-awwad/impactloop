# ImpactLoop Learner AI System — Architecture Plan (Phase 0)

> **Historical — planning document (2026-07-14).** Several sections below describe a pre-implementation snapshot and are **no longer accurate** as a whole-system description.
>
> **Current state:** see [08-implementation-status.md](../08-implementation-status.md), [01-general-learning-chat.md](01-general-learning-chat.md), and [features/ai-agent.md](../features/ai-agent.md) (material matching gap).
>
> **Shipped since this plan:** `apps/backend/src/modules/ai/` mounted at `/api/ai/v1`; Flutter `features/ai/` (`/ai/assistant`); general learning, build-guide tools, and project authoring waves. **Not shipped:** material-matching agent, credit wallets, `ai_material_matches` schema.

**Status:** Historical planning doc — superseded for status by code-derived inventories above.  
**Date:** 2026-07-14  
**Sources inspected:** `apps/backend/src/`, `apps/backend/prisma/schema.prisma`, `apps/frontend/lib/`, `docs/08-implementation-status.md`, `docs/features/ai-agent.md`, `docs/features/learning-hub.md`, `docs/features/home-learner.md`, `docs/features/material-discovery.md`, `docs/features/reservations.md`, `AGENTS.md`

**Evidence labels used throughout:**

| Label | Meaning |
|-------|---------|
| **VERIFIED CURRENT STATE** | Confirmed in production code or current Prisma schema |
| **RECOMMENDED CHANGE** | Proposed for future phases; not implemented |
| **OPEN QUESTION** | Requires product/team decision before implementation |
| **DEFERRED** | Explicitly out of scope for early phases |

---

## 1. Executive decision summary

ImpactLoop today has a **partial learner-facing AI system** at `/api/ai/v1` (ImpactLoop Assistant) plus **internal price-rule review** AI (`suggestPriceReferenceForReview` in `apps/backend/src/services/ai-price-suggestion.service.ts`). Material **matching** with credits, `ai_material_matches`, and auto-reservation remains **not implemented** — see [features/ai-agent.md](../features/ai-agent.md) and [01-general-learning-chat.md](01-general-learning-chat.md).

**RECOMMENDED CHANGE — core architectural decisions:**

1. **Single AI module, three modes.** Add `apps/backend/src/modules/ai/` with a shared provider abstraction, orchestrator, conversation service, tool registry/executor, scope guard, pending-action service, and mode-specific policies. Modes: `GENERAL_LEARNING`, `LEARNER_AGENT`, `PROJECT_AUTHORING`.
2. **LLM is not source of truth.** All availability, pricing, quantities, readiness, permissions, and reservation eligibility must come from existing domain services (`materials`, `learning-projects`, `reservations`, `profile`, `learner-home`). Tools call bounded services only; no Prisma in tool handlers exposed to the model.
3. **Extract deterministic matching first.** Create a shared `project-matching` domain layer (new module or `services/project-matching/`) by consolidating logic from `learning-projects.build-candidate-ranking.ts`, `learning-projects.build-material-linking.ts`, and `learner-home.scoring.ts` / `learner-interest-taxonomy.ts`. AI explains and ranks; matching math stays deterministic.
4. **Structured API envelope.** Flutter must render cards and confirmation UI from typed `contentBlocks` and `actions` — never by parsing assistant natural language.
5. **Confirmation is backend-controlled.** Sensitive mutations use `AiPendingAction` records (or signed tokens referencing them) with expiration, idempotency, revalidation at execute time, and audit — not model-only “Are you sure?” text.
6. **Reuse existing patterns.** Provider swap (`gemini` / `mock` / `disabled`), Zod validation (`validate.middleware.ts`), `{ success, message, data }` responses (`api-response.ts`), `runIdempotentOperation` (`idempotency.service.ts`), `authMiddleware` + `requireRoles`, and Node test runner (`node --import tsx --test`).
7. **Phased delivery.** Phase 1 = foundation + `GENERAL_LEARNING` only. Phase 2 = read-only `LEARNER_AGENT` tools + matching. Phase 3 = pending actions. Phase 4 = `PROJECT_AUTHORING`. Phase 5 = external search + credits/metering.

---

## 2. Verified current-state architecture

### 2.1 Backend platform

**VERIFIED CURRENT STATE — Express app** (`apps/backend/src/app.ts`, export `app`):

- Global middleware order: `requestContextMiddleware` → `helmet` → `cors` (allows `Idempotency-Key`, `Authorization`) → static uploads → `express.json()`.
- Routes mounted under `/health`, `/api/auth`, `/api/profile`, `/api/categories`, `/api/material-types`, `/api/price-rule-requests`, `/api/invitations`, `/api/learning-projects`, `/api/materials`, `/api/reservations`, `/api/payments`, `/api/deliveries`, `/api/driver`, `/api/uploads`, `/api/locations`, `/api/learner/*`, `/api/ai/v1`, `/api/notifications`, `/api/supplier`, `/api/admin`.
- Terminal: `notFoundMiddleware`, `errorMiddleware`.
- **`/api/ai/v1` router exists** (ImpactLoop Assistant). See [01-general-learning-chat.md](01-general-learning-chat.md). **No global auth or rate limit** on all routes (AI has module-local limits).

**VERIFIED CURRENT STATE — Auth & roles:**

| Symbol | File | Behavior |
|--------|------|----------|
| `authMiddleware` | `middlewares/auth.middleware.ts` | JWT via `verifyAccessToken`; sets `req.auth`; blocks `SUSPENDED`/`DISABLED` |
| `optionalAuthMiddleware` | same | Anonymous if missing/invalid token |
| `requireRoles(...)` | `middlewares/role.middleware.ts` | 403 `FORBIDDEN` if role missing |
| Public registration | `auth.validation.ts` | LEARNER + SUPPLIER only; DRIVER/MODERATOR/ADMIN invitation-only (`AGENTS.md`) |

**VERIFIED CURRENT STATE — Validation & errors:**

- `validate(schema, source)` in `middlewares/validate.middleware.ts` — Zod body/query/params.
- `successResponse` / `errorResponse` in `utils/api-response.ts` — `{ success, message, data }` / `{ success, message, error: { code, requestId, details? } }`.
- `AppError` in `utils/app-error.ts`; `errorMiddleware` maps `ZodError` → `VALIDATION_ERROR`, Prisma errors, etc.

**VERIFIED CURRENT STATE — Idempotency:**

- `runIdempotentOperation` in `services/idempotency.service.ts`; scopes `SUPPLIER_CREATE_MATERIAL`, `LEARNING_PROJECT_SUBMIT`; persisted in `IdempotencyRecord` (`schema.prisma`).
- **Reservations do not use idempotency** (`reservations.service.ts` — `createReservation`).

**VERIFIED CURRENT STATE — Rate limiting:**

- `createRateLimitMiddleware` in `middlewares/rate-limit.middleware.ts` — in-memory; used on auth password reset routes only.
- **No AI or general API rate limits.**

**VERIFIED CURRENT STATE — Audit:**

- `logAdminActivity` in `modules/admin/admin-activity-log.ts` → `AdminActivityLog` table; admin-only read via `/api/admin/audit-logs`.
- `createAiPriceLookupLog` in `services/ai-price-lookup.repository.ts` → `AiPriceLookupLog` (price AI only).
- **No learner/AI conversation audit.**

**VERIFIED CURRENT STATE — Existing AI (price only):**

| File | Symbols | Role |
|------|---------|------|
| `services/ai-price-suggestion.service.ts` | `suggestPriceReferenceForReview`, `aiResponseSchema` | Orchestrates price suggestion; Zod-validates model JSON |
| `services/gemini-price-suggestion.provider.ts` | `callGeminiForPriceSuggestion` | `@google/genai` |
| `services/mock-price-suggestion.provider.ts` | `generateMockPriceSuggestion` | Deterministic mock |
| `config/env.ts` | `AiProviderName`, `isAiProviderOperational()` | Provider gating |

**VERIFIED CURRENT STATE — Observability:**

- `observability/logger.ts` — pino structured logging; `request-context.middleware.ts` — `X-Request-Id`.

### 2.2 Domain modules relevant to AI

**Materials** (`modules/materials/`):

- **VERIFIED CURRENT STATE:** `GET /api/materials` — `listMaterials` with `materialsQuerySchema` (`q`, `categoryId`, `condition`, `status`, `priceType`, `deliveryAvailable`, `city`, `area`, `pickupAllowed`, `sort`, geo + `savedLocationId`, pagination).
- **VERIFIED CURRENT STATE:** `GET /api/materials/:id` — `getMaterialById`; `POST/DELETE /api/materials/:id/like` (LEARNER).
- **VERIFIED CURRENT STATE:** `materials.repository.ts` — `findMaterials`, PostGIS `nearest` sort, `recordMaterialView`.
- **Missing:** No semantic/vector search; no AI routes.

**Learning projects** (`modules/learning-projects/`):

- **VERIFIED CURRENT STATE:** Public `GET /`, `GET /:id` (PUBLISHED); learner engagement (like/save/follow/review); `POST /submit` with **required `Idempotency-Key`**; `/mine` CRUD + resubmit.
- **VERIFIED CURRENT STATE:** Build checklist — `POST /:id/builds/start`, `PATCH .../items/:itemId`, `GET .../material-candidates`, `POST .../link-material`, `DELETE .../link-material`, `POST .../link-reservation`.
- **VERIFIED CURRENT STATE:** Deterministic candidate ranking — `scoreBuildMaterialCandidate`, `rankBuildMaterialCandidates` in `learning-projects.build-candidate-ranking.ts`; linking in `learning-projects.build-material-linking.ts` (`getBuildItemMaterialCandidates`, `linkBuildItemMaterial`, `resolveBuildItemReadiness`).
- **VERIFIED CURRENT STATE:** Submit components — `submitComponentSchema` with `componentRole`, `searchKeywords`, `canBeSubstituted` (`learning-projects.validation.ts`).
- **Missing:** No aggregate `calculateProjectReadiness`; no project↔material API outside build context; no AI authoring endpoints.

**Reservations** (`modules/reservations/`):

- **VERIFIED CURRENT STATE:** `POST /api/reservations` — `createReservation` (LEARNER); serializable transaction; outcomes include `UNAVAILABLE`, `OPEN_RESERVATION_EXISTS`, `BUILD_ITEM_*`, etc.
- **VERIFIED CURRENT STATE:** `PATCH /:id/learner-confirmation` — `resolveLearnerConfirmation` (`ACCEPT_PROPOSED_PICKUP`, `SUBMIT_DELIVERY_WINDOW`, `CANCEL`).
- **Missing:** No AI prepare/confirm flow; no idempotency on create.

**Learner home** (`modules/learner-home/`):

- **VERIFIED CURRENT STATE:** `GET /api/learner/home`, `GET /api/learner/home/sections/:sectionKey` — rule-based scoring (`learner-home.scoring.ts`, `learner-home.affinity.ts`, `learner-interest-taxonomy.ts`); not LLM.
- **VERIFIED CURRENT STATE:** `loadLearnerBehaviorContext` in `learner-home.repository.ts` — likes, views, reservations, saves, builds.

**Profile** (`modules/profile/`):

- **VERIFIED CURRENT STATE:** Learner `interests: String[]` on `LearnerProfile` (`schema.prisma`); normalized via `learnerInterestsFieldSchema` / `learner-interest-taxonomy.ts`; `GET /api/profile/learner/interests/options`.

### 2.3 Database (Prisma)

**VERIFIED CURRENT STATE — Key models** (`apps/backend/prisma/schema.prisma`):

| Model | AI-relevant fields |
|-------|-------------------|
| `Material` | `status`, `quantity`, `isFree`, `price`, `locationId`, `pickupAllowed`, `deliveryAllowed`, tags via `MaterialTag` |
| `LearningProject` | `status`, `stepsGeneratedByAi`, `aiStepsGeneratedAt` |
| `ProjectRequiredComponent` | `componentRole`, `isRequired`, `canBeSubstituted`, `searchKeywords`, `alternativeKeywords`, `generatedOrSuggestedByAi` |
| `ProjectStep` | `stepNumber`, `generatedByAi`, `reviewStatus` |
| `ProjectBuild` / `ProjectBuildItem` | Checklist; `status` (`MISSING`, `ALREADY_OWNED`, `AVAILABLE`, `RESERVED`, `ALTERNATIVE`); `linkedMaterialId`, `linkedReservationId` |
| `Reservation` | Full lifecycle + pricing snapshot fields |
| `LearnerProfile` | `interests String[]` |
| `AiPriceLookupLog` | Price AI audit only |
| `IdempotencyRecord` | `(userId, scope, key)` unique |

**VERIFIED CURRENT STATE — Absent tables** (confirmed not in schema): `ai_requests`, `ai_material_matches`, `ai_credit_wallets`, `ai_usage_logs`, `ai_conversations`, `ai_messages`, `ai_pending_actions`, `learner_owned_materials`.

**Doc conflict — VERIFIED CURRENT STATE:** `docs/database/tables-catalog.md` understates `ProjectBuildItem.linkedReservationId` as future-only; code implements `linkBuildItemReservation` in `learning-projects.routes.ts`. Treat schema + code as truth.

### 2.4 Flutter

**VERIFIED CURRENT STATE — Structure:** Feature-first under `apps/frontend/lib/features/`; routing via `app_router.dart` (`appRouterProvider`, `_RouteAccessLevel.learner`).

**VERIFIED CURRENT STATE — API pattern:** `apiClientProvider` (Dio) → `*Api` → `unwrapApiResponse` → Riverpod providers. Widgets do not call APIs directly.

**VERIFIED CURRENT STATE — Relevant UI:**

| Area | File | Notes |
|------|------|-------|
| Material cards | `shared/widgets/materials/app_material_card.dart` | `AppMaterialCard`, grid variant |
| Discovery | `material_discovery/` | Search, filters, reserve dialog (`AppDialogShell`) |
| Learning hub | `learning_hub/` | Detail, build checklist (`LearningProjectBuildPage`), add-draft, submissions |
| Build candidates | `project_build_material_linking.dart` | `ProjectBuildMaterialCandidatesSheet` — "Possible options" |
| Home AI placeholder | `learner_home_page.dart` | `ComingSoonCard` — "AI material helper"; snackbar only |
| Reservation confirm | `learner_awaiting_confirmation_panel.dart`, `reservation_confirmation_controller.dart` | Backend-driven actions, not chat |
| Localization | `app.dart` | `en`/`ar` locales; `LocalizedText`; RTL via Material delegates |

**VERIFIED CURRENT STATE — Missing for AI:** No `features/ai/`; no chat UI; no AI API client; orphaned constants `learningDisabledAiTitle` in `learning_hub_mock_data.dart` (unused).

---

## 3. Reuse and gap matrix

| Capability | Existing implementation | Evidence | Reuse | Extension needed | Missing |
|------------|-------------------------|----------|-------|------------------|---------|
| Material search/filter | **Implemented** | `materials.routes.ts` → `getMaterials`; `materialsQuerySchema`; `materials.repository.ts` `findMaterials` | **As-is** for tool adapter | Budget filter in query (price max) — **RECOMMENDED CHANGE** | Semantic search |
| Project search | **Partial** | `learning-projects.routes.ts` `listLearningProjects`; query schema | **As-is** for list/filter tools | Keyword/component-aware search — **RECOMMENDED CHANGE** | Dedicated search service |
| Required component lookup | **Implemented** | `ProjectRequiredComponent`; loaded in project detail/build services | **As-is** | Component weights for readiness — **RECOMMENDED CHANGE** | Structured alternative FK graph |
| Build checklist lookup | **Implemented** | `getMyProjectBuild`, `updateProjectBuildItem`; `ProjectBuildItem` | **As-is** | Aggregate readiness summary — **RECOMMENDED CHANGE** | — |
| Learner interests | **Implemented** | `LearnerProfile.interests`; `learner-interest-taxonomy.ts` | **As-is** | — | Persisted AI preference history — **DEFERRED** |
| Learner behavior | **Implemented** | `learner-home.repository.ts` `loadLearnerBehaviorContext` | **Reuse in context builder** | Expose as bounded read tool | — |
| Project saves/builds | **Implemented** | `ProjectSave`, `ProjectBuild`; learning-projects routes | **As-is** | — | — |
| Location filtering | **Partial** | Materials `city`/`area`/`nearest`; `UserSavedLocation` | **Extend** matching layer | Saved location in AI context — **RECOMMENDED CHANGE** | — |
| Budget filtering | **Partial** | Material `price`, `isFree`; reservation pricing snapshot | **Extend** ranking | Max budget param in matching service — **RECOMMENDED CHANGE** | — |
| Project readiness | **Partial** | `resolveBuildItemReadiness` per item only | **Extend** | `calculateProjectReadiness` aggregate — **RECOMMENDED CHANGE** | Project-level API |
| Component alternatives | **Partial** | `alternativeKeywords` Json; `canBeSubstituted`; `ALTERNATIVE` role/status | **Partial reuse** | Approved alternatives table — **RECOMMENDED CHANGE** | Admin-curated alias registry |
| Learner-owned materials | **Partial** | `ProjectBuildItemStatus.ALREADY_OWNED` manual flag | **Partial** | Optional inventory table — **OPEN QUESTION** | Dedicated owned-inventory |
| Project authoring drafts | **Partial** | Learner submit → `PENDING_REVIEW`; `/mine` edit | **Partial** | AI draft layer separate from submitted project — **RECOMMENDED CHANGE** | AI draft persistence |
| Step-level revisions | **Partial** | `ProjectStep` rows; admin enrichment PATCH | **Partial** | Revision history table — **RECOMMENDED CHANGE** | Diff/undo for AI edits |
| Reservation prepare/execute | **Partial** | `createReservation`; learner confirmation PATCH | **Reuse services** | AI pending-action wrapper — **RECOMMENDED CHANGE** | AI-specific prepare endpoint |
| Missing material request | **Not implemented** (learner) | No table; closest: `PriceRuleRequest` (supplier) | **No** | New request type — **RECOMMENDED CHANGE** | Learner missing-material API |
| Conversation storage | **Missing** | — | — | — | **Required** |
| Audit logging | **Partial** | Admin + price AI logs | **Pattern reuse** | AI tool/conversation audit — **RECOMMENDED CHANGE** | Unified AI audit |
| Rate limiting | **Partial** | Auth password only | **Pattern reuse** | Per-user AI quotas — **RECOMMENDED CHANGE** | AI rate limits |
| External search | **Missing** | — | — | — | **DEFERRED** Phase 5 |
| AI provider abstraction | **Partial** | Price suggestion only | **Generalize** | Shared `AiProvider` interface — **RECOMMENDED CHANGE** | Chat/completion providers |
| Material↔project matching | **Partial** | Build candidates + learner-home scoring | **Consolidate** | Shared `project-matching` module — **RECOMMENDED CHANGE** | Unified matching API |

---

## 4. Final recommended AI architecture

### 4.1 Module boundaries

**RECOMMENDED CHANGE — `apps/backend/src/modules/ai/`**

| Component | Responsibility | Dependencies | Must NOT | Shared? |
|-----------|----------------|--------------|----------|---------|
| `ai-provider/` (or `services/ai-provider/`) | Chat/completion abstraction; `mock`, `gemini`, `disabled` | `config/env.ts` | Call Prisma or domain logic | Yes |
| `ai-orchestrator.service.ts` | Turn pipeline: scope → context → model → validate → persist | policies, context builder, provider, validator | Execute mutations directly | Yes (mode branches) |
| `ai-mode-policy.ts` | Per-mode system instructions, tool allowlist, context limits | tool registry | Bypass authorization | Per mode |
| `ai-scope-guard.service.ts` | Classify/routing before model/tools | rule lists, optional lightweight classifier | Trust model for security | Yes |
| `ai-tool-registry.ts` | Tool definitions, JSON schemas, mode permissions | — | Execute tools | Yes |
| `ai-tool-executor.service.ts` | Validate args, auth check, call domain adapter, audit | domain services only | Import Prisma | Yes |
| `ai-conversation.service.ts` | CRUD conversations/messages; retention | Prisma (ai tables) | Business logic | Yes |
| `ai-context-builder.service.ts` | Assemble bounded context per mode | profile, behavior, optional page context | Send full DB rows | Yes |
| `ai-response-validator.ts` | Zod/JSON schema for assistant output blocks | mode schemas | — | Yes |
| `ai-pending-action.service.ts` | Create/confirm/cancel/expired actions | idempotency patterns | Execute without revalidation | Yes |
| `ai-external-search.gateway.ts` | Orchestrator-controlled search (not model-direct) | HTTP client, allowlist | Return listings as ImpactLoop materials | Yes (GENERAL_LEARNING only initially) |
| `ai-audit.service.ts` | Tool calls, scope decisions, provider metadata | DB | — | Yes |
| `tools/*.tool.ts` | Thin adapters → existing module services | materials, learning-projects, etc. | Duplicate matching logic | Per tool |

**RECOMMENDED CHANGE — `apps/backend/src/modules/project-matching/`** (or `services/project-matching/`)

| Component | Responsibility |
|-----------|----------------|
| `match-materials-for-project.service.ts` | Project → materials (wraps/extends build candidate ranking) |
| `match-projects-for-material.service.ts` | Material → projects |
| `match-projects-for-owned-materials.service.ts` | Owned checklist items → projects |
| `calculate-project-readiness.service.ts` | Aggregate readiness from build items + live reservation/material state |
| `find-component-alternatives.service.ts` | Keyword + taxonomy + future approved aliases |
| `matching.types.ts` | Structured match results with evidence fields (never raw LLM percentages) |

**Must NOT:** Put Prisma in tool handlers exposed to the model. Put availability/pricing logic in prompts. Let the model call `confirmReservation` without a pending record.

### 4.2 Request flow (all modes)

```
Client → POST /api/ai/conversations/:id/messages
  → authMiddleware + requireRoles('LEARNER')
  → validate body (mode, content, clientContext?)
  → ai-scope-guard (pre-model)
  → ai-orchestrator
      → ai-context-builder (bounded)
      → [optional] ai-tool-executor loop (mode allowlist)
      → ai-provider.complete/stream
      → ai-response-validator
      → ai-conversation.service persist
  → structured envelope response
```

Sensitive action path:

```
Tool prepareReservation → ai-pending-action.service.create
  → response includes actionBlock { pendingActionId, summary, expiresAt }
Client → POST /api/ai/pending-actions/:id/confirm
  → revalidate material/reservation rules
  → reservations.createReservation (existing service)
  → mark action CONFIRMED + audit
```

---

## 5. AI mode and tool permission matrix

Legend: ✅ allowed | ⚠️ prepare-only (returns pending action) | ❌ blocked | 🔒 orchestrator-only (not in model tool list)

| Tool | GENERAL_LEARNING | LEARNER_AGENT | PROJECT_AUTHORING | Type | Confirmation |
|------|------------------|---------------|-------------------|------|--------------|
| `searchMaterials` | ❌ | ✅ read | ❌ | Read | No |
| `getMaterialDetails` | ❌ | ✅ read | ❌ | Read | No |
| `searchLearningProjects` | ❌ | ✅ read | ❌ | Read | No |
| `getLearningProjectDetails` | ❌ | ✅ read | ✅ read | Read | No |
| `getProjectRequiredComponents` | ❌ | ✅ read | ✅ read | Read | No |
| `getLearnerProfile` | ❌ | ✅ read (self) | ✅ read (self) | Read | No |
| `getLearnerInterests` | ❌ | ✅ read | ✅ read | Read | No |
| `getSavedProjects` | ❌ | ✅ read | ❌ | Read | No |
| `getLikedMaterials` | ❌ | ✅ read | ❌ | Read | No |
| `getCurrentBuilds` | ❌ | ✅ read | ❌ | Read | No |
| `getBuildChecklist` | ❌ | ✅ read | ❌ | Read | No |
| `matchMaterialsForProject` | ❌ | ✅ read | ❌ | Read (deterministic) | No |
| `matchProjectsForMaterial` | ❌ | ✅ read | ❌ | Read | No |
| `calculateProjectReadiness` | ❌ | ✅ read | ❌ | Read | No |
| `matchProjectsForOwnedMaterials` | ❌ | ✅ read | ❌ | Read | No |
| `findComponentAlternatives` | ❌ | ✅ read | ❌ | Read | No |
| `generateProjectDraft` | ❌ | ❌ | ✅ draft | Draft mutation | No (draft only) |
| `reviseProjectOverview` | ❌ | ❌ | ✅ draft | Draft mutation | No |
| `reviseProjectStep` | ❌ | ❌ | ✅ draft | Draft mutation | No |
| `addProjectStep` | ❌ | ❌ | ✅ draft | Draft mutation | No |
| `deleteProjectStep` | ❌ | ❌ | ✅ draft | Draft mutation | No |
| `moveProjectStep` | ❌ | ❌ | ✅ draft | Draft mutation | No |
| `reviewProjectConsistency` | ❌ | ❌ | ✅ read/draft | Deterministic + optional LLM summary | No |
| `reviewProjectSafety` | ❌ | ❌ | ✅ read/draft | Deterministic rules + LLM | No |
| `searchExternalDomainKnowledge` | 🔒 fallback | 🔒 fallback | ❌ | External read | No |
| `prepareReservation` | ❌ | ⚠️ | ❌ | Sensitive prepare | Returns pending action |
| `confirmReservation` | ❌ | ❌ | ❌ | **Never expose to model** | Server-only on confirm endpoint |
| `createMissingMaterialRequest` | ❌ | ⚠️ | ❌ | Sensitive prepare | Pending action |
| `saveProject` | ❌ | ⚠️ | ❌ | Sensitive prepare | Pending action |
| `startProjectBuild` | ❌ | ⚠️ | ❌ | Sensitive prepare | Pending action |

**Critique / merges:**

- **RECOMMENDED CHANGE:** Merge `getLearnerProfile` + `getLearnerInterests` into one `getLearnerContext` tool to reduce context-fetch turns (optional split for testing).
- **RECOMMENDED CHANGE:** Rename `matchMaterialsForProject` → uses shared `project-matching` service; same for inverse.
- **RECOMMENDED CHANGE:** Reject `confirmReservation` as a model tool — only HTTP confirm handler calls `createReservation`.
- **RECOMMENDED CHANGE:** `linkMaterialToBuildItem` should be prepare-only, not direct model tool — wraps existing `linkBuildItemMaterial` with ownership checks.

---

## 6. Scope guard design

### 6.1 Classifications

**RECOMMENDED CHANGE:**

| Class | Meaning | Example |
|-------|---------|---------|
| `IN_PLATFORM` | Needs ImpactLoop data/tools | "Find materials for my robot project" |
| `DOMAIN_KNOWLEDGE` | Educational, no platform data required | "How does a breadboard work?" |
| `OUT_OF_SCOPE` | Unrelated | "Weather in Ramallah" |
| `SENSITIVE_ACTION` | Mutation intent | "Reserve this for me" |
| `UNSAFE_OR_HIGH_RISK` | Dangerous instructions | "Bypass mains wiring" |
| `UNCLEAR` | Ambiguous | "Help me with my project" (needs clarification) |

### 6.2 Implementation approach

**RECOMMENDED CHANGE — hybrid:**

1. **Rule-based first** (fast, auditable): keyword/intent lists for `OUT_OF_SCOPE`, unsafe patterns, injection markers; locale-aware lists for EN/AR.
2. **Model-assisted second** (optional, bounded): classifier call with strict JSON schema output `{ classification, confidence, reasons[] }` — only when rules return `UNCLEAR`.
3. **Hard backend gates** always: mode tool allowlist, auth on every tool, no tool args from raw user text without schema validation.

**Before any model/tool call:**

- Authenticate learner.
- Validate mode matches conversation type.
- Run scope guard on user message.
- If `OUT_OF_SCOPE` → refuse with structured `textBlock` (no tools).
- If `SENSITIVE_ACTION` → route to prepare flow or instruct client to use confirmation UI (not free-text confirm).
- If `UNSAFE_OR_HIGH_RISK` → refuse + safety resources; log audit.

**Mixed questions:** Split handling — answer in-scope portion; refuse out-of-scope portion in separate `textBlock`s.

**Prompt injection:** Never pass tool results or external snippets as system instructions; sanitize and label as untrusted `externalCitationBlock`; scope guard tests include "ignore previous instructions" dataset.

**Bypass prevention:** Even if model requests a blocked tool, `ai-tool-executor` checks mode policy + user ownership independently.

**RECOMMENDED CHANGE:** Persist scope classification on each user message (`AiMessage.scopeClassification`) for audit — **required for Phase 2+**.

---

## 7. Structured API contracts

**RECOMMENDED CHANGE — API version prefix:** `/api/ai/v1/...`

### 7.1 Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/ai/v1/conversations` | Start conversation `{ mode, title?, clientContext? }` |
| GET | `/api/ai/v1/conversations/:id` | Metadata + last message preview |
| GET | `/api/ai/v1/conversations/:id/messages` | Paginated history |
| POST | `/api/ai/v1/conversations/:id/messages` | Send user message; returns assistant turn |
| POST | `/api/ai/v1/pending-actions/:id/confirm` | Confirm pending action `{ idempotencyKey }` |
| POST | `/api/ai/v1/pending-actions/:id/cancel` | Cancel |
| GET | `/api/ai/v1/authoring/drafts/:id` | Get AI project draft |
| PATCH | `/api/ai/v1/authoring/drafts/:id/steps/:stepId` | Accept/reject/manual edit step revision |

### 7.2 Response envelope

**RECOMMENDED CHANGE:**

```typescript
type AiApiResponse<T> = ApiSuccessResponse<T>; // existing successResponse shape

type AiTurnResponse = {
  conversationId: string;
  messageId: string;
  role: 'assistant';
  mode: 'GENERAL_LEARNING' | 'LEARNER_AGENT' | 'PROJECT_AUTHORING';
  contentBlocks: AiContentBlock[];
  actions?: AiClientAction[];
  pendingActions?: AiPendingActionSummary[];
  meta: {
    provider: 'mock' | 'gemini' | 'disabled';
    model?: string;
    usage?: { inputTokens: number; outputTokens: number };
    scopeClassification: ScopeClass;
    toolCalls?: AiToolCallAudit[];
  };
};
```

### 7.3 Discriminated content blocks

**RECOMMENDED CHANGE — Flutter renders by `type`:**

| `type` | Purpose | Key fields |
|--------|---------|------------|
| `text` | Markdown/plain explanation | `text`, `locale?` |
| `material_card` | Listing card | `materialId`, `title`, `thumbnailUrl?`, `priceLabel`, `availabilityLabel`, `reasonCodes[]` |
| `project_card` | Project card | `projectId`, `title`, `difficulty`, `readinessPercent?`, `reasonCodes[]` |
| `checklist_summary` | Build readiness | `buildId`, `items[]: { componentId, status, readinessLabel }`, `readyCount`, `totalRequired` |
| `clarification` | Authoring questions | `questions[]: { id, prompt, answerType }` |
| `project_draft` | Authoring output | `draftId`, `overview`, `steps[]`, `components[]` |
| `step_revision` | Targeted edit | `stepId`, `stepNumber`, `before`, `after`, `diff` |
| `external_citation` | Non-listing knowledge | `title`, `url`, `snippet`, `sourceType`, `retrievedAt` |
| `error` | Safe failure | `code`, `message`, `retryable` |

**`readinessPercent` must include `source: 'deterministic'` and `calculatedAt` — never model-estimated.**

### 7.4 Client actions

**RECOMMENDED CHANGE:**

```typescript
type AiClientAction =
  | { type: 'open_material'; materialId: string }
  | { type: 'open_project'; projectId: string }
  | { type: 'open_build'; projectId: string }
  | { type: 'confirm_pending_action'; pendingActionId: string }
  | { type: 'authoring_accept_step'; draftId: string; stepId: string }
  | { type: 'authoring_reject_step'; draftId: string; stepId: string };
```

### 7.5 Pending action summary

```typescript
type AiPendingActionSummary = {
  id: string;
  actionType: 'CREATE_RESERVATION' | 'SAVE_PROJECT' | 'START_BUILD' | 'MISSING_MATERIAL_REQUEST';
  displaySummary: LocalizedText; // en + ar
  expiresAt: string; // ISO
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';
  payloadHash: string; // for UI integrity display
};
```

### 7.6 Error codes (safe)

`AI_DISABLED`, `AI_RATE_LIMITED`, `AI_SCOPE_REFUSED`, `AI_TOOL_FAILED`, `AI_VALIDATION_FAILED`, `AI_PENDING_ACTION_EXPIRED`, `AI_PENDING_ACTION_STALE`, `AI_PROVIDER_ERROR`

---

## 8. Database gap analysis

| Proposed model | Use case | Why existing tables insufficient | Relations | Constraints/indexes | Retention/privacy | Phase |
|----------------|----------|----------------------------------|-----------|---------------------|-------------------|-------|
| `AiConversation` | Thread per mode/user | No conversation storage | `userId` → User | `(userId, updatedAt DESC)` | Delete on account delete; TTL optional | **Phase 1** |
| `AiMessage` | User/assistant turns | — | `conversationId` | `(conversationId, createdAt)` | Minimize PII in content | **Phase 1** |
| `AiToolExecutionLog` | Audit tool args/results | Admin log too coarse | `messageId`, `userId` | `(userId, createdAt)` | Redact secrets; 90d retention | **Phase 2** |
| `AiPendingAction` | Confirmation flow | IdempotencyRecord lacks display summary | `userId`, optional `conversationId` | unique pending per action type+target; `expiresAt` index | Short TTL (15–30 min) | **Phase 3** |
| `AiProjectAuthoringDraft` | AI draft separate from submitted project | `LearningProject` is moderation truth | `userId`, optional link to `LearningProject` | `(userId, status)` | Until submit or abandon | **Phase 4** |
| `AiProjectAuthoringStep` | Stable stepId for "step 3" | `ProjectStep` is post-submit truth | `draftId` | `(draftId, stepNumber)` unique | Cascade delete with draft | **Phase 4** |
| `AiProjectStepRevision` | Diff/history/undo | — | `stepId` | `(stepId, revisionNumber)` | Keep last N revisions | **Phase 4** |
| `AiExternalCitation` | Store citations | — | `messageId` | — | Store URL + snippet hash only | **Phase 5** |
| `AiUsageRecord` | Cost metering | AiPriceLookupLog is price-only | `userId` | `(userId, createdAt)` | Aggregates for admin | **DEFERRED** |
| `AiFeedback` | thumbs up/down | — | `messageId` | unique `(messageId, userId)` | Optional | **DEFERRED** |
| `LearnerOwnedMaterial` | Inventory beyond checklist flag | `ALREADY_OWNED` is per-build-item only | `userId` | `(userId, normalizedName)` | User-controlled | **OPEN QUESTION** |
| `ComponentAlternative` | Approved substitutes | Json keywords not curated | `componentId` or taxonomy key | — | Admin curated | **Phase 2–3** |

**Not required for v1:** `ai_credit_wallets` (**DEFERRED** until product defines credits).

---

## 9. Deterministic matching architecture

### 9.1 Principles

**VERIFIED CURRENT STATE:** Per-item readiness in `resolveBuildItemReadiness` (`learning-projects.build-material-linking.ts`). Candidate scoring in `scoreBuildMaterialCandidate` / `rankBuildMaterialCandidates` (`learning-projects.build-candidate-ranking.ts`). Interest taxonomy in `learner-interest-taxonomy.ts`. Home feed scoring in `learner-home.scoring.ts`.

**RECOMMENDED CHANGE:** Centralize into `project-matching` services returning:

```typescript
type MaterialMatchResult = {
  materialId: string;
  matchType: 'EXACT' | 'SIMILAR' | 'ALTERNATIVE';
  score: number;
  evidence: { matchedKeywords: string[]; matchedCategoryId?: string; matchedTags: string[] };
  availability: { status: MaterialStatus; availableQuantity: number }; // from DB at query time
};
```

### 9.2 Operations (deterministic)

| Operation | Implementation source | Normalization location |
|-----------|----------------------|------------------------|
| Project → Materials | Extend `getBuildItemMaterialCandidates` logic | `normalizeSearchText`, category IDs, `MaterialTypeAlias`, component `searchKeywords` |
| Material → Projects | **RECOMMENDED CHANGE** — query `ProjectRequiredComponent` by keywords/category | Shared matcher |
| Owned → Projects | Intersect owned/already-owned component keys with project BOM | Build checklist + optional inventory |
| Budget rank | Filter/sort by `material.price`, `isFree` | Matching service input `maxBudgetNis?` |
| Location rank | Reuse PostGIS/nearest from `materials.repository.ts` + saved location | Matching service input `savedLocationId?` |
| Project readiness | Aggregate `resolveBuildItemReadiness` + required flags | `calculateProjectReadiness` — counts only, no LLM % |
| Missing detection | `ProjectBuildItem.status === MISSING` + no valid link | Build service |
| Alternatives | `alternativeKeywords` + future `ComponentAlternative` | Matcher with `canBeSubstituted` gate |

### 9.3 Preventing hallucination

- Tools return structured data; orchestrator may summarize but **must not alter** availability fields.
- Response validator rejects assistant blocks that include material/project IDs not present in tool results.
- UI cards always built from tool payload IDs, not parsed text.
- **RECOMMENDED CHANGE:** Include `evidence` and `queriedAt` on every match result.

---

## 10. Project authoring architecture

### 10.1 Flow

**RECOMMENDED CHANGE:**

1. Learner opens authoring mode → `POST /conversations` with `PROJECT_AUTHORING`.
2. Initial NL description → scope guard → `generateProjectDraft` tool produces `AiProjectAuthoringDraft` + child steps/components (draft tables).
3. Clarification: orchestrator returns `clarification` blocks; user answers in next message.
4. Targeted edits: user references "step 3" → resolve via stable `AiProjectAuthoringStep.id` (not just `stepNumber` — renumber-safe).
5. `reviseProjectStep` returns `step_revision` block with `before`/`after`/`diff` only for targeted step.
6. Accept → PATCH draft step content; Reject → discard revision row.
7. Manual edit → Flutter form writes draft directly (same API).
8. Undo → read `AiProjectStepRevision` history.
9. `reviewProjectConsistency` — deterministic checks (component referenced in steps, counts) + optional LLM narrative.
10. `reviewProjectSafety` — rule-based electrical/tool warnings + LLM explanation.
11. Publish path: learner confirms → map draft to `submitLearningProjectSchema` → existing `POST /api/learning-projects/submit` with idempotency → `PENDING_REVIEW` moderation (unchanged).

**VERIFIED CURRENT STATE:** Moderation flow via `submitLearningProjectForReview`, admin `admin-learning-projects` module.

### 10.2 Prevent full rewrite on single-step edit

- Mode policy instructs model; **enforced by** tool contract: `reviseProjectStep` accepts `{ draftId, stepId, instruction }` only.
- Validator rejects `project_draft` blocks that change more than one step when instruction scope is single-step.
- **RECOMMENDED CHANGE:** Deterministic diff engine compares revision to current draft step server-side.

---

## 11. External search boundary

**DEFERRED to Phase 5** — design now:

1. Internal tools run first (`searchMaterials`, project detail, etc.).
2. Orchestrator decides missing educational knowledge (not availability).
3. Scope guard confirms `DOMAIN_KNOWLEDGE`.
4. **`searchExternalDomainKnowledge` is orchestrator-invoked**, not model-invoked — model receives results as labeled citations.
5. Return `external_citation` blocks only; never `material_card` from external content.

**RECOMMENDED CHANGE:**

- Approved sources allowlist (educational domains, datasheet repos, vendor docs — **OPEN QUESTION** for final list).
- Query redaction: strip user email, phone, exact address before search.
- Timeouts (e.g. 5s), circuit breaker, fallback to "I don't have a verified source."
- Store citation metadata in `AiExternalCitation`; sanitize snippets; scan for injection patterns.
- Safety-critical topics require higher-trust sources or refuse.

---

## 12. Safe action and confirmation architecture

**VERIFIED CURRENT STATE to reuse:**

- `createReservation` — `reservations.service.ts`
- `runIdempotentOperation` — pattern for confirm endpoint
- `resolveLearnerConfirmation` — pattern for structured accept/cancel (different domain but UX precedent)
- Flutter `ReservationConfirmationController` — precedent for explicit UI actions

**RECOMMENDED CHANGE — pending action record:**

| Field | Purpose |
|-------|---------|
| `id`, `userId`, `actionType`, `payloadJson`, `payloadHash` | Ownership + integrity |
| `displaySummaryJson` | Safe EN/AR summary for UI |
| `status`, `expiresAt`, `confirmedAt` | Lifecycle |
| `idempotencyKey` | Confirm replay protection |
| `conversationId`, `messageId` | Traceability |

**Confirm flow:**

1. `prepareReservation` validates eligibility → creates `AiPendingAction` → returns summary block.
2. Client shows confirmation sheet (reuse `AppDialogShell` pattern from reservations).
3. `POST .../confirm` re-fetches material quantity/status/price → if stale → `AI_PENDING_ACTION_STALE`.
4. Execute via existing `createReservation` inside transaction.
5. Audit log + mark CONFIRMED.

**Never:** Model calling confirm; double-submit without idempotency key.

---

## 13. Security and privacy threat model

| Threat | Backend control | Prompt guidance | UI warning |
|--------|-----------------|-----------------|------------|
| Prompt injection | Scope guard; tool allowlist; auth per tool | Untrusted labels | — |
| Retrieved-content injection | Sanitize snippets; no instruction merge | — | Citation disclaimer |
| Tool arg manipulation | Zod schemas; userId from JWT not args | — | — |
| Cross-user leakage | Every query scoped by `req.auth.userId` | — | — |
| Excessive context | Context builder allowlist + caps | — | — |
| Unauthorized build/reservation access | Ownership checks in learning-projects/reservations services | — | — |
| Hallucinated availability | Deterministic tools only for listings | — | — |
| PII to external provider | Redact before provider call; minimal context | — | Privacy notice |
| API key leakage | `env.ts` only; never log keys | — | — |
| Conversation abuse | Rate limits; message size caps | — | — |
| Cost abuse | Per-user daily token budget | — | — |
| Confirmation replay | Idempotency + status transition guards | — | — |
| Malicious project descriptions | Sanitize storage; moderation on submit | Safety review tool | — |
| Unsafe electrical guidance | Scope guard `UNSAFE`; safety rules | Refusal templates | Safety banner |

**Prompts are not a security boundary.**

---

## 14. Testing and evaluation strategy

**RECOMMENDED CHANGE:**

| Layer | Focus |
|-------|-------|
| Unit | Scope guard rules, response validator, diff engine, matching normalization |
| Service | Tool executor auth, pending action stale detection, orchestrator with fake provider |
| Route | POST message returns valid block types; confirm/cancel flows |
| DB integration | Conversation persistence, pending action expiry |
| Flutter widget | Render each `contentBlock` type; RTL; confirmation sheet |
| Fake AI provider | Deterministic fixtures mirroring `mock-price-suggestion.provider.ts` pattern |

**Datasets:** scope classification (EN/AR), prompt injection, authorization (user A cannot access user B build), action confirmation stale cases, external citation separation.

**Acceptance criteria examples:**

- 100% of `material_card` blocks in LEARNER_AGENT reference IDs returned by `searchMaterials` in same turn.
- 0% confirm executes without valid pending action row.
- Single-step revise changes exactly one step in 95%+ eval set (manual review for remainder).

---

## 15. Recommended implementation phases

### Phase 1 — Foundation + GENERAL_LEARNING (first vertical slice)

**Goal:** Ship educational chat with scope guard; no domain tools.

| Area | Work |
|------|------|
| Backend | `modules/ai/` skeleton; generalized `AiProvider`; mock provider; conversation CRUD; scope guard (rule-based); orchestrator; response validator; routes under `/api/ai/v1` |
| DB | `AiConversation`, `AiMessage` |
| Flutter | `features/ai/` — chat page, prompt input, text blocks, loading/error; route from home placeholder |
| Tests | Fake provider; scope refusal tests; auth required |

**DoD:** Learner can chat educational topics; out-of-scope refused; mock provider tests pass; no production Gemini required.

**Deferred:** All LEARNER_AGENT tools, pending actions, authoring, external search.

### Phase 2 — Deterministic matching + read-only LEARNER_AGENT

**Goal:** "Find materials for project X" with real cards.

| Area | Work |
|------|------|
| Backend | `project-matching` module; tool adapters; context builder with behavior/interests; tool audit logs |
| DB | `AiToolExecutionLog`; optional `ComponentAlternative` seed |
| Flutter | `material_card`, `project_card`, `checklist_summary` renderers |
| Tests | Matching golden cases; auth isolation; no hallucinated IDs |

**Deferred:** Mutations, reservations via AI.

### Phase 3 — Pending actions (save, start build, missing request, prepare reservation)

**Goal:** Prepare → confirm → execute.

| Area | Work |
|------|------|
| Backend | `AiPendingAction` service; prepare tools; confirm/cancel routes; revalidation |
| DB | `AiPendingAction` |
| Flutter | Confirmation sheet pattern (from reservations) |
| Tests | Stale price/qty; idempotency; replay |

**Deferred:** Authoring, external search.

### Phase 4 — PROJECT_AUTHORING

**Goal:** Draft + step-targeted revisions + submit to moderation.

| Area | Work |
|------|------|
| Backend | Draft tables; revise tools; diff/accept/reject; map to submit |
| DB | `AiProjectAuthoringDraft`, steps, revisions |
| Flutter | Draft review UI, step diff, accept/reject |
| Tests | Single-step edit enforcement; moderation handoff |

### Phase 5 — External search + metering (optional)

**Goal:** Domain citations when internal data insufficient.

| Area | Work |
|------|------|
| Backend | External search gateway; citation storage; usage records |
| DB | `AiExternalCitation`, `AiUsageRecord` |
| Flutter | Citation blocks with external link disclaimer |

---

## 16. File impact and conflict plan

### Phase 1 new files (expected)

```
apps/backend/src/modules/ai/
  ai.routes.ts, ai.controller.ts, ai.validation.ts, ai.types.ts
  ai-orchestrator.service.ts, ai-scope-guard.service.ts
  ai-conversation.service.ts, ai-context-builder.service.ts
  ai-response-validator.ts, ai-mode-policy.ts
  providers/mock-chat.provider.ts, providers/gemini-chat.provider.ts
apps/backend/src/modules/ai/__tests__/...
apps/frontend/lib/features/ai/
  data/ai_api.dart, application/ai_providers.dart
  presentation/pages/ai_chat_page.dart, widgets/ai_message_list.dart, ...
```

### Phase 1 existing files to change

| File | Why |
|------|-----|
| `apps/backend/src/app.ts` | Mount `aiRouter` |
| `apps/frontend/lib/app/router/app_router.dart` | Add `/ai/chat` route |
| `apps/frontend/lib/features/home/presentation/pages/learner_home_page.dart` | Wire placeholder → real route |
| `prisma/schema.prisma` + migration | AiConversation, AiMessage |

### High-conflict files (do not edit concurrently across workstreams)

- `schema.prisma`
- `app.ts`, `app_router.dart`
- `learning-projects.service.ts` (Phase 2+ matching integration)
- `reservations.service.ts` (Phase 3 confirm integration)

### Split guidance

If Phase 2 exceeds 8 files, split into **Phase 2a** (project-matching module + tests) and **Phase 2b** (AI tool wiring + Flutter cards).

---

## 17. Risks, deferred work, and open questions

### Risks

1. **Conflating price AI with learner AI** — same env var `AI_PROVIDER` may need split config (**RECOMMENDED CHANGE:** `AI_CHAT_PROVIDER` vs `AI_PRICE_PROVIDER`).
2. **Matching duplication** if `project-matching` extraction delayed.
3. **Cost exposure** without rate limits/metering.
4. **Arabic quality** for scope guard and structured summaries — needs eval set early.
5. **User confusion** between rule-based home recommendations and AI agent (**UI labeling**).

### Deferred

- Credit wallets / billing (`ai_credit_wallets` roadmap names in `03-database.md` legacy doc).
- Realtime streaming (SSE/WebSocket) — start with full-turn responses.
- Moderator AI review tools.
- Vector/semantic search.

### Open questions (require approval)

1. **Learner owned inventory table** vs checklist-only `ALREADY_OWNED`?
2. **Single or split AI providers** in env/config?
3. **Credit model** for learner AI (per-day limits vs wallet)?
4. **External search provider** (Brave, Google Custom Search, curated static corpus)?
5. **Conversation retention TTL** and GDPR export/delete?
6. **Should GENERAL_LEARNING allow uploaded images** in v1?

---

## 18. Decisions required before Phase 1

| # | Decision | Recommendation |
|---|----------|----------------|
| 1 | Module path | `modules/ai/` + shared provider in `modules/ai/providers/` |
| 2 | API prefix | `/api/ai/v1` |
| 3 | Phase 1 scope | GENERAL_LEARNING only; mock provider default in dev |
| 4 | Schema | Add `AiConversation` + `AiMessage` only in Phase 1 |
| 5 | Flutter entry | Replace home `ComingSoonCard` with `/ai/chat?mode=GENERAL_LEARNING` |
| 6 | Provider config | Add `AI_CHAT_PROVIDER` separate from price AI (**RECOMMENDED CHANGE**) |
| 7 | Rate limit | Per-user 30 messages/hour in-memory Phase 1; Redis later |
| 8 | Localization | All block summaries via `LocalizedText` en/ar from day one |

---

## Appendix A — Proposed Phase 1 boundary (compact)

**In scope:**

- Prisma: `AiConversation`, `AiMessage`
- Backend: AI module with mock chat provider, rule-based scope guard, conversation API, structured `text` + `error` blocks only
- Flutter: Minimal chat UI (EN/AR), RTL-safe, loading/empty/error states
- Tests: Auth, scope refusal, mock provider round-trip
- Docs update in Phase 1 implementation PR (not this file)

**Out of scope for Phase 1:**

- LEARNER_AGENT tools, material/project cards, matching module, pending actions, authoring, external search, Gemini in production (optional flag only), credits, reservations via AI

**Definition of done:** Learner opens AI chat from home; asks Arduino educational question → helpful structured reply; asks weather → refused with clear message; all tests pass; no domain mutations; no other features regressed.

---

*End of Phase 0 architecture plan.*
