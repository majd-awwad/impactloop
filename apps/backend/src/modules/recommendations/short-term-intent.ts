export const SHORT_TERM_CONFIG = { viewWeight: 0.35, activeLikeWeight: 1, projectActionWeight: 1.8, strongActionWeight: 2.5, repeatedViewCap: 2, halfLifeDays: 4, recentBlend: 0.35 } as const;

export type IntentMetadata = { categoryKey: string; conceptKeys: string[]; componentConceptKeys: string[] };
export type RecentIntentEvent = { entityKey: string; actionType: string; timestampUtc: string };

const strength = (kind: string) => kind === 'view' ? SHORT_TERM_CONFIG.viewWeight : ['project_save', 'project_follow'].includes(kind) ? SHORT_TERM_CONFIG.projectActionWeight : ['reservation', 'build_started'].includes(kind) ? SHORT_TERM_CONFIG.strongActionWeight : 0;

export const buildShortTermIntent = (events: RecentIntentEvent[], metadata: Map<string, IntentMetadata>, evaluationTimestamp: string) => {
  const now = Date.parse(evaluationTimestamp); if (!Number.isFinite(now)) throw new Error('invalid_evaluation_timestamp');
  const active = new Map<string, { active: boolean; kind: string; timestamp: number }>(); const views = new Map<string, number>(); const intent = new Map<string, number>(); let evidenceCount = 0;
  const add = (key: string, value: number) => intent.set(key, Math.min(4, (intent.get(key) ?? 0) + value));
  for (const event of [...events].sort((a, b) => a.timestampUtc.localeCompare(b.timestampUtc))) {
    const timestamp = Date.parse(event.timestampUtc); if (!Number.isFinite(timestamp) || timestamp > now) continue;
    if (['unlike', 'unsave', 'unfollow'].includes(event.actionType)) { active.set(event.entityKey, { active: false, kind: event.actionType, timestamp }); continue; }
    if (['like', 'project_save', 'project_follow'].includes(event.actionType)) { active.set(event.entityKey, { active: true, kind: event.actionType, timestamp }); continue; }
    if (event.actionType === 'view') { const count = (views.get(event.entityKey) ?? 0) + 1; views.set(event.entityKey, count); if (count > SHORT_TERM_CONFIG.repeatedViewCap) continue; }
    const value = strength(event.actionType); if (value <= 0) continue;
    const item = metadata.get(event.entityKey); if (!item) continue;
    const decay = 0.5 ** (Math.max(0, now - timestamp) / 86_400_000 / SHORT_TERM_CONFIG.halfLifeDays); evidenceCount += 1;
    add(`category:${item.categoryKey}`, value * decay); item.conceptKeys.forEach((key) => add(`concept:${key}`, value * decay)); item.componentConceptKeys.forEach((key) => add(`component:${key}`, value * decay));
  }
  for (const [entityKey, state] of active) {
    if (!state.active) continue; const item = metadata.get(entityKey); if (!item) continue; evidenceCount += 1;
    const base = state.kind === 'like' ? SHORT_TERM_CONFIG.activeLikeWeight : SHORT_TERM_CONFIG.projectActionWeight;
    const value = state.kind === 'like' ? base : base * 0.5 ** (Math.max(0, now - state.timestamp) / 86_400_000 / SHORT_TERM_CONFIG.halfLifeDays);
    add(`category:${item.categoryKey}`, value); item.conceptKeys.forEach((key) => add(`concept:${key}`, value));
    if (state.kind !== 'like') item.componentConceptKeys.forEach((key) => add(`component:${key}`, value));
  }
  return { intent, evidenceCount };
};

export const recentItemScore = (item: IntentMetadata, intent: Map<string, number>) => {
  const values = [intent.get(`category:${item.categoryKey}`) ?? 0, ...item.conceptKeys.map((key) => intent.get(`concept:${key}`) ?? 0), ...item.componentConceptKeys.map((key) => intent.get(`component:${key}`) ?? 0)];
  return Math.min(1, values.reduce((sum, value) => sum + value, 0) / (4 * Math.max(1, values.length)));
};
