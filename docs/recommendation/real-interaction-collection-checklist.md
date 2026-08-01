# Real-Interaction Collection Checklist

Use this checklist at pilot start and at every collection checkpoint. Record aggregate results only; never paste raw rows or personal data into the report.

## Before a pilot session

- [ ] Pilot account is non-seeded, non-test, and not a load/benchmark account.
- [ ] Participant received the evaluation notice and deletion/withdrawal contact.
- [ ] Worker is explicitly enabled with the approved poll, batch, lease, retry, and maximum-attempt settings.
- [ ] `PENDING`, `PROCESSING`, `RETRY`, and `DEAD` queue counts are zero.
- [ ] Catalog materials/projects used for the session are available/public and isolated from unrelated reservations.
- [ ] No scorer, ranking, model, schema, seed, or UI experiment is enabled.

## During the session

- [ ] Learner Home request completes and recommendations display normally.
- [ ] Participant opens a recommended material or project naturally.
- [ ] Supported actions carry the originating recommendation impression context.
- [ ] Reservation actions use only agreed isolated inventory.
- [ ] Project build progress is meaningful rather than repeated filler updates.
- [ ] Accidental duplicate taps and bugs are recorded as QA notes, not manually corrected in the data.
- [ ] Participant is not instructed to repeat likes/views/saves/follows to inflate counts.

## After the session

- [ ] Run `node --import tsx apps/backend/scripts/evaluate-interaction-readiness.ts --progress`.
- [ ] Confirm origin counts keep engineering/test rows out of real-user progress.
- [ ] Confirm direct and assisted attribution are reported separately.
- [ ] Confirm no invalid impression references, action-before-impression rows, future timestamps, or unexpected dead events.
- [ ] Confirm queue backlog and dead count are zero, or document the incident before continuing.
- [ ] Record only aggregate counters and the checkpoint date.

## Before offline modeling

- [ ] 20 real learners have at least 5 unique eligible items.
- [ ] 10 real learners have at least 10 unique eligible items.
- [ ] 10 real learners are active on at least 2 UTC days.
- [ ] Activity spans at least 7 calendar days.
- [ ] Material and project multi-user coverage, cold-item share, graph overlap, split eligibility, and attribution gates in the Phase 3B report are met.
- [ ] Participant deletion requests are resolved under the approved retention process.
- [ ] The evaluator is rerun and its privacy-safe output is reviewed.
- [ ] No model-training job is scheduled automatically.
