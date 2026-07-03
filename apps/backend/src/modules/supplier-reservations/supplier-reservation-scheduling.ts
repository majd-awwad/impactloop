export const DELIVERY_BUFFER_MINUTES = 60;

export type PreferredWindow = {
  start: Date;
  end: Date;
};

export const parsePreferredWindowsJson = (value: unknown): PreferredWindow[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return [];
    }

    const startRaw = 'start' in entry ? entry.start : null;
    const endRaw = 'end' in entry ? entry.end : null;

    if (typeof startRaw !== 'string' || typeof endRaw !== 'string') {
      return [];
    }

    const start = new Date(startRaw);
    const end = new Date(endRaw);

    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      return [];
    }

    if (end <= start) {
      return [];
    }

    return [{ start, end }];
  });
};

export const windowsEqual = (left: PreferredWindow, right: PreferredWindow) =>
  left.start.getTime() === right.start.getTime() &&
  left.end.getTime() === right.end.getTime();

export const windowMatchesLearnerPreference = (
  proposed: PreferredWindow,
  learnerWindows: PreferredWindow[],
) => learnerWindows.some((window) => windowsEqual(window, proposed));

export const computeEarliestDeliveryStart = (
  supplierPickupWindowEnd: Date,
  bufferMinutes = DELIVERY_BUFFER_MINUTES,
) =>
  new Date(supplierPickupWindowEnd.getTime() + bufferMinutes * 60_000);

export const findFeasibleDeliveryWindow = (
  supplierPickupWindowEnd: Date,
  learnerWindows: PreferredWindow[],
  bufferMinutes = DELIVERY_BUFFER_MINUTES,
): {
  confirmed: PreferredWindow;
  earliestDeliveryStart: Date;
} | null => {
  const earliestDeliveryStart = computeEarliestDeliveryStart(
    supplierPickupWindowEnd,
    bufferMinutes,
  );

  for (const window of learnerWindows) {
    if (window.end.getTime() <= earliestDeliveryStart.getTime()) {
      continue;
    }

    const confirmedStart = new Date(
      Math.max(window.start.getTime(), earliestDeliveryStart.getTime()),
    );

    if (confirmedStart.getTime() >= window.end.getTime()) {
      continue;
    }

    return {
      confirmed: {
        start: confirmedStart,
        end: window.end,
      },
      earliestDeliveryStart,
    };
  }

  return null;
};

export const mapPreferredWindowsForResponse = (
  value: unknown,
): { start: string; end: string }[] =>
  parsePreferredWindowsJson(value).map((window) => ({
    start: window.start.toISOString(),
    end: window.end.toISOString(),
  }));

export const resolvePreferredWindowByIndex = (
  value: unknown,
  index: number,
): PreferredWindow | null => {
  const windows = parsePreferredWindowsJson(value);

  if (!Number.isInteger(index) || index < 0 || index >= windows.length) {
    return null;
  }

  return windows[index] ?? null;
};
