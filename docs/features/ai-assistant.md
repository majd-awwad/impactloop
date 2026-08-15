# ImpactLoop Assistant

The **ImpactLoop Assistant** is the shipped conversational AI product at `/api/ai/v1` and Flutter `/ai/assistant`. It provides general learning chat, build-guide tools, and project authoring waves.

**Not the same as:** [ai-material-matching.md](ai-material-matching.md) (material-matching agent — not implemented).

Phase 1 ships General Learning educational chat with conversation persistence, scope guard, structured assistant blocks, and a minimal Flutter chat UI.

## Environment variables

Chat AI is configured separately from price suggestion AI. Price AI env vars remain unchanged.

| Variable | Default | Description |
| --- | --- | --- |
| `AI_CHAT_PROVIDER` | `mock` | `openai`, `gemini`, `mock`, or `disabled` |
| `AI_CHAT_MODEL` | `gemini-2.5-flash` (falls back to `GEMINI_MODEL`) | Model when provider is `gemini` |
| `OPENAI_API_KEY` | — | OpenAI API key when `AI_CHAT_PROVIDER=openai` |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model when provider is `openai` (`AI_CHAT_MODEL` overrides if set) |
| `AI_CHAT_TIMEOUT_MS` | `30000` | Provider request timeout |
| `AI_CHAT_MAX_OUTPUT_TOKENS` | `1024` | Max generated tokens |
| `AI_CHAT_MAX_MESSAGE_LENGTH` | `4000` | Max user message length |
| `AI_CHAT_MAX_HISTORY_MESSAGES` | `20` | Recent messages sent as bounded context |
| `AI_CHAT_RATE_LIMIT_PER_USER` | `30` | Per-user message send rate limit (per window) |
| `AI_CHAT_RATE_LIMIT_WINDOW_MS` | `3600000` | Rate-limit window (1 hour) |
| `AI_CHAT_MAX_CONVERSATIONS_PER_HOUR` | `20` | Per-user conversation create limit (same window) |
| `AI_CHAT_PROCESSING_STALE_MS` | `120000` | Stale processing lock recovery window |
| `AI_CHAT_CLASSIFIER_CONFIDENCE_THRESHOLD` | `0.7` | Minimum confidence for model-assisted scope classification |

Gemini chat uses the existing `GEMINI_API_KEY` when `AI_CHAT_PROVIDER=gemini`.

OpenAI chat uses `OPENAI_API_KEY` and `OPENAI_MODEL` when `AI_CHAT_PROVIDER=openai`.

When `AI_CHAT_PROVIDER` is unset, auto-resolution prefers a usable `OPENAI_API_KEY`, then `GEMINI_API_KEY`, then `mock` in non-production.

## Provider modes

- **`openai`**: OpenAI Chat Completions with JSON response format.
- **`mock`**: Deterministic structured responses for development and automated tests.
- **`gemini`**: Real Gemini chat generation when API key is configured.
- **`disabled`**: Safe `AI_DISABLED` error; no external calls.

## Scope

General Learning answers practical educational questions about:

- Arduino, microcontrollers, electronics, robotics, sensors, motors, tools
- Woodworking, DIY, fabric, art, recycling, reusable materials
- Project ideas, alternatives, steps, beginner explanations, legitimate safety guidance

It refuses unrelated topics such as weather, news, sports, exchange rates, restaurants, recipes, poetry, and general off-domain questions.

Mixed messages answer the in-scope portion and refuse the out-of-scope portion in separate structured text blocks.

Dangerous requests do not receive actionable unsafe instructions; legitimate safety education is allowed.

## API endpoints

Base path: `/api/ai/v1`

All routes require authenticated **LEARNER** role.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/conversations` | Create `GENERAL_LEARNING` conversation |
| `GET` | `/conversations` | List current user's conversations |
| `GET` | `/conversations/:conversationId/messages` | Read bounded message history |
| `POST` | `/conversations/:conversationId/messages` | Send message (`text`, `locale`, `clientMessageId`) |
| `POST` | `/conversations/:conversationId/archive` | Archive owned conversation |

Phase 1 rejects future modes such as `LEARNER_AGENT` and `PROJECT_AUTHORING`.

## Structured response blocks

Assistant turns return typed blocks only:

```ts
type AiContentBlock =
  | { type: 'text'; text: string; purpose: 'answer' | 'refusal' | 'clarification' | 'safety' }
  | { type: 'error'; code: string; message: string; retryable: boolean };
```

The Flutter client renders these blocks directly. It does not parse assistant prose to infer UI behavior.

Policy version `GENERAL_LEARNING_POLICY_V1` is stored on assistant messages; full system prompts are not stored per row.

## Rate limits and bounds

- Per-user message rate limit (default 30/hour)
- Per-user conversation create limit (default 20/hour)
- Message length cap (default 4000 chars)
- Bounded recent history (default 12 messages)
- Provider timeout and max output tokens

Rate limiting is in-memory in Phase 1 (single-instance behavior).

## Idempotency

`clientMessageId` is unique per conversation. Retries with the same ID:

- Do not create duplicate user messages
- Do not call the provider twice
- Return the existing completed turn when available

The Flutter client keeps a stable `clientMessageId` for retry of the same logical send.

## Concurrent turns

Only one active generation per conversation is allowed. Concurrent requests receive `AI_CONVERSATION_BUSY`.

Processing ownership is DB-backed with stale-lock recovery so crashed requests do not permanently lock a conversation.

External provider calls are not made inside long-lived database transactions.

## Flutter route

- Route: `/ai/general-learning`
- Entry: Learner Home → General Learning Chat card
- Localization: static UI labels via `LocalizedText`; dynamic assistant text uses the user's active locale (`en` or `ar`)

## Manual testing

1. Set `AI_CHAT_PROVIDER=mock` and open `/ai/general-learning`.
2. Send Arabic and English in-scope questions.
3. Ask weather or exchange-rate questions and confirm refusal without useful off-domain answers.
4. Ask a mixed breadboard + exchange-rate question.
5. Ask soldering safety guidance and confirm useful safe advice.
6. Ask a dangerous mains-wiring bypass question and confirm no actionable unsafe steps.
7. Double-click Send and confirm one turn.
8. Retry a failed network send with the same client message ID.
9. Open two clients on one conversation and confirm busy handling.
10. Attempt cross-user conversation access and confirm 404/forbidden behavior.
11. Verify existing price AI behavior is unchanged.

For `AI_CHAT_PROVIDER=openai`, set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` (default `gpt-4o-mini`), then send from the ImpactLoop Assistant in Flutter. The client merges the POST turn `contentBlocks` into the message list immediately.

For `AI_CHAT_PROVIDER=gemini`, repeat key scenarios only when a valid API key is available.

## Closure verification (2026-07-14)

Verified in this repository run:

- Prisma format/validate/generate/migrate status (48 migrations, database up to date)
- Backend AI unit tests (16) and HTTP closure tests (15) with embedded Express app + real middleware/auth/DB
- Flutter AI widget tests (10) and `flutter analyze lib/features/ai`
- Price AI mock provider regression (separate from chat config)

Not verified in this run:

- Live Gemini provider (`NOT RUN — no verified GEMINI_API_KEY` in closure environment)
- Full backend `npm run typecheck` clean (pre-existing unrelated error in `admin-people.service.ts`; AI controller pagination TS defect fixed during closure)
- Disposable-database migration replay from empty (local DB already at head; `migrate status` reports up to date)
- Manual Flutter visual spot-check on device/browser (automated RTL/LTR tests passed)

## Known Phase 1 limitations

- No `LEARNER_AGENT`, project authoring, tools, cards, pending actions, or domain mutations
- No external web search, citations, image/file input, voice, or streaming
- No vector search, embeddings, AI credits, or admin AI dashboards
- No conversation summarization beyond recent-message cap
- In-memory rate limits (not distributed)

## Phase 1.1 — Unified ImpactLoop Assistant (corrective slice)

Phase 1.1 keeps Phase 1 backend guarantees but changes the learner-facing product to one assistant:

- **User-facing name:** ImpactLoop Assistant (no separate bots or mode picker)
- **Flutter entry:** global floating launcher on authenticated learner shell routes (`/home`, `/materials`, `/learning`, `/profile`, reservations)
- **Layout:** desktop right-side panel (~460px) over current page; mobile full-screen assistant (bottom nav hidden while open)
- **Route:** `/ai/assistant` (legacy `/ai/general-learning` redirects here)
- **History:** active/archived tabs with archive + restore
- **Lazy conversation create:** conversations persist on first send, not on panel open

### Compatibility decision (no DB reset)

- Prisma still stores `AiConversation.mode = GENERAL_LEARNING` (no enum migration).
- API accepts both `LEARNER_ASSISTANT` and `GENERAL_LEARNING` on create; both normalize to stored `GENERAL_LEARNING`.
- API responses map stored mode to user-facing `LEARNER_ASSISTANT`.
- Existing Phase 1 conversations remain readable; per-turn routing can expand later without changing the conversation UI.

### API additions (Phase 1.1)

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/conversations?status=ACTIVE\|ARCHIVED` | Filter conversation list (default `ACTIVE`) |
| `POST` | `/conversations/:conversationId/restore` | Restore owned archived conversation |

Create conversation body may use `mode: "LEARNER_ASSISTANT"` (preferred) or legacy `"GENERAL_LEARNING"`.

### Flutter send fix

The client merges the POST turn response into Riverpod state immediately (optimistic user bubble + assistant blocks). Background `listMessages` reload is best-effort and no longer clears visible replies when it returns empty.

## Deferred to later phases

- Learner agent with material/project/profile tools
- Project authoring assistant
- External search and citations
- Pending actions and reservation mutations through AI
- AI credits/wallets and admin dashboards
