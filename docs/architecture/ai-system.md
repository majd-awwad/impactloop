# Recommendation ML vs conversational AI

ImpactLoop has two **separate** AI-related subsystems. Do not describe them as one runtime or model.

---

## Recommendation ML (Learner Home)

- **Purpose:** Rank `suggested_materials` and `suggested_projects` on Learner Home
- **Model:** LightFM portable artifacts scored in TypeScript at request time
- **Default mode:** `ML_PRIMARY` with deterministic fallback
- **Documentation:** [recommendation-system.md](recommendation-system.md), [development/local-ml.md](../development/local-ml.md)

This is **not** the chat assistant. It does not use Gemini/OpenAI for ranking.

---

## Conversational AI (ImpactLoop Assistant)

- **Purpose:** General/learning chat, tutoring-style responses
- **Providers:** Configured LLM providers (e.g. Gemini) via backend AI modules
- **Documentation:** [01-general-learning-chat.md](../ai/01-general-learning-chat.md), [features/ai-agent.md](../features/ai-agent.md) (material matching gap)

Chat behavior does not control Learner Home section ordering.

---

## Historical planning

Early combined AI architecture plan (2026-07): [history/ai/00-ai-system-architecture-plan.md](../history/ai/00-ai-system-architecture-plan.md) — historical only.
