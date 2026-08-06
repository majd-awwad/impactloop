const MAX_TOPIC_TITLE_LENGTH = 120;

export const buildProjectHelpSessionZoomTopic = (projectTitle: string) => {
  const safeTitle = projectTitle
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TOPIC_TITLE_LENGTH);
  return `ImpactLoop — ${safeTitle || 'Project'} Help Session`;
};
