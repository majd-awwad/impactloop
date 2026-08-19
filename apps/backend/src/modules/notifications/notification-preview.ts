const PREVIEW_MAX_LENGTH = 80;

/** Collapse whitespace and truncate a user-authored snippet for notification copy. */
export const sanitizeNotificationPreview = (value: string): string => {
  const collapsed = value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!collapsed) {
    return '';
  }

  if (collapsed.length <= PREVIEW_MAX_LENGTH) {
    return collapsed;
  }

  return `${collapsed.slice(0, PREVIEW_MAX_LENGTH - 1).trimEnd()}…`;
};

export const safeActorDisplayName = (value: string | null | undefined) => {
  const name = value?.trim() ?? '';
  return name || 'Someone';
};
