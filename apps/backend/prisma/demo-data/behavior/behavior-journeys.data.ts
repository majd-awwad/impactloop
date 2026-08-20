/**
 * BEHAVIOR-DATA-02 — Material Request demo journey definitions.
 *
 * Journeys are resolved at runtime against live build/component IDs.
 * Ownership: openBusinessKey / normalized requested name + optional legacy `[cdb2]`
 * description marker. Notification eventKeys use `cdb2:`.
 * Do not put BD02_MARKER in user-visible description text.
 */

export const BD02_MARKER = "[cdb2]";
export const BD02_OP_PREFIX = "cdb2";

export type MrJourneyKind =
  | "open_no_suggestions"
  | "open_with_suggestion"
  | "open_with_dismissed_suggestion";

export type MrJourneyPlan = {
  /** Stable demo identity used for logs / idempotency notes. */
  key: string;
  kind: MrJourneyKind;
  learnerEmail: string;
  /** Substring match against LearningProjectTag.tag (demo-project-key:…). */
  projectKey: string;
  /** Case-insensitive substring against componentName or materialType. */
  componentIncludes: string;
  /** English request name shown in UI / search. */
  requestedItemName: string;
  description: string;
  quantity: number;
  unit: string;
  /** Optional suggestion material title substring (same category preferred). */
  suggestMaterialTitleIncludes?: string;
  /** Prefer materials owned by this supplier email when suggesting. */
  preferSupplierEmail?: string;
};

/**
 * Small, domain-valid journeys tied to existing BEHAVIOR-DATA-01 builds.
 * No FULFILLED / reservation lifecycle noise.
 */
export const MR_JOURNEY_PLANS: MrJourneyPlan[] = [
  {
    key: "user52-capacitance-open",
    kind: "open_no_suggestions",
    learnerEmail: "user52@impactloop.demo",
    projectKey: "najah-automated-liquid-sample-trainer",
    // Canonical Najah identity is Arabic + English: "دائرة تحسس سعوية (Capacitance)"
    // / "Capacitance Sensing Circuit". Keep both needles so a label-only drift
    // still resolves the same intentional marketplace gap.
    componentIncludes: "Capacitance|سعوية",
    requestedItemName: "Capacitance Sensing Circuit",
    description:
      "Need a capacitance sensing circuit for the liquid sample trainer build — nothing matching in browse yet.",
    quantity: 1,
    unit: "set",
  },
  {
    key: "user90-gt2-belt-open",
    kind: "open_no_suggestions",
    learnerEmail: "user90@impactloop.demo",
    projectKey: "najah-henna-cnc-pattern-machine",
    componentIncludes: "توقيت GT2",
    requestedItemName: "GT2 Timing Belt",
    description:
      "Looking for GT2 timing belt stock for the Henna CNC pattern machine. Marketplace intentionally has no GT2 belt listing yet.",
    quantity: 2,
    unit: "piece",
  },
  {
    key: "user58-oakd-dismissed",
    kind: "open_with_dismissed_suggestion",
    learnerEmail: "user58@impactloop.demo",
    projectKey: "najah-bottle-separator-robot",
    componentIncludes: "OAK-D",
    requestedItemName: "OAK-D Camera",
    description:
      "Need an OAK-D (or close depth camera) for Bottle Separator vision. Pi camera suggestion was not suitable.",
    quantity: 1,
    unit: "piece",
    suggestMaterialTitleIncludes: "raspberry pi camera",
  },
];
