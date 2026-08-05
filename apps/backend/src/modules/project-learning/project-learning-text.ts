const CONTROL_CHAR_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HTML_TAG_PATTERN = /<[^>]+>/g;
const SCRIPT_PATTERN = /<script[\s\S]*?>[\s\S]*?<\/script>/gi;

export const normalizeProjectLearningText = (value: string): string =>
  value.replace(/\s+/g, ' ').trim();

export const sanitizeProjectLearningText = (value: string): string => {
  const withoutScripts = value.replace(SCRIPT_PATTERN, '');
  const withoutTags = withoutScripts.replace(HTML_TAG_PATTERN, '');
  return normalizeProjectLearningText(
    withoutTags.replace(CONTROL_CHAR_PATTERN, ''),
  );
};

export const containsUnsafeProjectLearningMarkup = (value: string): boolean =>
  SCRIPT_PATTERN.test(value) || HTML_TAG_PATTERN.test(value);
