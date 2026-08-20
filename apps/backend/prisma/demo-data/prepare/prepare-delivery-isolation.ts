import {
  CASH_HANDOVER_DEMO_KEY,
  CASH_HANDOVER_PREFERRED_TITLES,
  DRIVER_ON_THE_WAY_DEMO_KEY,
  DRIVER_ON_THE_WAY_PREFERRED_TITLES,
  hasDemoMarker,
  isCompletedReservationStatus,
  isTerminalReservationStatus,
} from './local-demo-keys.js';

export type DeliveryScenarioKind = 'cash-handover' | 'driver-on-the-way';

export type ScenarioCandidate = {
  reservationId: string;
  deliveryId: string | null;
  materialTitle: string;
  reservationStatus: string;
  paymentMethod?: string | null;
  message?: string | null;
  deliveryNote?: string | null;
};

export const cashHandoverTitleSet = new Set<string>(CASH_HANDOVER_PREFERRED_TITLES);
export const driverOnTheWayTitleSet = new Set<string>(
  DRIVER_ON_THE_WAY_PREFERRED_TITLES,
);

export const assertPreferredTitleSetsAreDisjoint = () => {
  for (const title of CASH_HANDOVER_PREFERRED_TITLES) {
    if (driverOnTheWayTitleSet.has(title)) {
      throw new Error(
        `CASH handover and ON_THE_WAY preferred titles overlap on "${title}".`,
      );
    }
  }
};

export const scenarioKeyFor = (kind: DeliveryScenarioKind): string =>
  kind === 'cash-handover' ? CASH_HANDOVER_DEMO_KEY : DRIVER_ON_THE_WAY_DEMO_KEY;

export const otherScenarioKeyFor = (kind: DeliveryScenarioKind): string =>
  kind === 'cash-handover' ? DRIVER_ON_THE_WAY_DEMO_KEY : CASH_HANDOVER_DEMO_KEY;

export const preferredTitlesFor = (
  kind: DeliveryScenarioKind,
): readonly string[] =>
  kind === 'cash-handover'
    ? CASH_HANDOVER_PREFERRED_TITLES
    : DRIVER_ON_THE_WAY_PREFERRED_TITLES;

export const belongsToScenario = (
  candidate: ScenarioCandidate,
  kind: DeliveryScenarioKind,
): boolean => {
  const key = scenarioKeyFor(kind);
  return (
    hasDemoMarker(candidate.message, key) ||
    hasDemoMarker(candidate.deliveryNote, key)
  );
};

export const belongsToOtherScenario = (
  candidate: ScenarioCandidate,
  kind: DeliveryScenarioKind,
): boolean => belongsToScenario(candidate, kind === 'cash-handover' ? 'driver-on-the-way' : 'cash-handover');

export const isForbiddenMaterialFor = (
  kind: DeliveryScenarioKind,
  materialTitle: string,
): boolean => {
  const otherTitles =
    kind === 'cash-handover' ? driverOnTheWayTitleSet : cashHandoverTitleSet;
  return otherTitles.has(materialTitle);
};

export const canMutateReservationForDemo = (status: string): boolean =>
  !isTerminalReservationStatus(status) && !isCompletedReservationStatus(status);

export const selectIsolatedScenarioCandidate = (input: {
  kind: DeliveryScenarioKind;
  candidates: ScenarioCandidate[];
}): { selected: ScenarioCandidate | null; skipped: ScenarioCandidate[] } => {
  assertPreferredTitleSetsAreDisjoint();
  const skipped: ScenarioCandidate[] = [];
  const preferred = preferredTitlesFor(input.kind);

  const usable = input.candidates.filter((candidate) => {
    if (!canMutateReservationForDemo(candidate.reservationStatus)) {
      skipped.push(candidate);
      return false;
    }
    if (belongsToOtherScenario(candidate, input.kind)) {
      skipped.push(candidate);
      return false;
    }
    if (isForbiddenMaterialFor(input.kind, candidate.materialTitle)) {
      skipped.push(candidate);
      return false;
    }
    return true;
  });

  const keyed = usable.filter((candidate) => belongsToScenario(candidate, input.kind));
  if (keyed[0]) {
    return { selected: keyed[0], skipped };
  }

  for (const title of preferred) {
    const match = usable.find((candidate) => candidate.materialTitle === title);
    if (match) {
      return { selected: match, skipped };
    }
  }

  return { selected: null, skipped };
};
