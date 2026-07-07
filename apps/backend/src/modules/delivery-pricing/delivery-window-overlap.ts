export type TimeWindow = {
  start: Date;
  end: Date;
};

export const windowsOverlap = (a: TimeWindow, b: TimeWindow): boolean =>
  a.start < b.end && a.end > b.start;

export const intersectWindows = (
  a: TimeWindow,
  b: TimeWindow,
): TimeWindow | null => {
  if (!windowsOverlap(a, b)) {
    return null;
  }

  const start = a.start > b.start ? a.start : b.start;
  const end = a.end < b.end ? a.end : b.end;

  if (start >= end) {
    return null;
  }

  return { start, end };
};

export const findBestOverlappingWindow = (
  candidateWindows: TimeWindow[],
  groupWindow: TimeWindow,
): TimeWindow | null => {
  let best: TimeWindow | null = null;

  for (const candidate of candidateWindows) {
    const overlap = intersectWindows(candidate, groupWindow);
    if (!overlap) {
      continue;
    }

    if (!best || overlap.end.getTime() - overlap.start.getTime() > best.end.getTime() - best.start.getTime()) {
      best = overlap;
    }
  }

  return best;
};

export const unionWindowBounds = (
  windows: TimeWindow[],
): TimeWindow | null => {
  if (windows.length === 0) {
    return null;
  }

  let start = windows[0]!.start;
  let end = windows[0]!.end;

  for (const window of windows.slice(1)) {
    if (window.start < start) {
      start = window.start;
    }
    if (window.end > end) {
      end = window.end;
    }
  }

  if (start >= end) {
    return null;
  }

  return { start, end };
};
