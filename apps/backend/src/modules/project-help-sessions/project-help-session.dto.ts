import type { ProjectHelpSessionDetailRecord } from './project-help-session.repository.js';
import {
  deriveProjectHelpSessionAllowedActions,
  deriveProjectHelpSessionMeetingState,
  getProjectHelpSessionCompletionTiming,
  type ProjectHelpSessionViewerRole,
} from './project-help-session-actions.js';
import { getProjectHelpSessionNow } from './project-help-session-clock.js';
import { getSelectedStartsAt } from './project-help-session-actions.js';

const publicUserSummary = (user: {
  id: string;
  displayName: string;
  profileImageUrl: string | null;
}) => ({
  id: user.id,
  displayName: user.displayName,
  profileImageUrl: user.profileImageUrl,
});

const mapTimeOption = (
  option: ProjectHelpSessionDetailRecord['timeOptions'][number],
  session: ProjectHelpSessionDetailRecord,
) => ({
  id: option.id,
  type: option.proposalType,
  startsAt: option.startsAt.toISOString(),
  proposedBy: {
    id: option.proposedBy.id,
    displayName: option.proposedBy.displayName,
    role:
      option.proposedById === session.learnerId
        ? ('LEARNER' as const)
        : ('AUTHOR' as const),
  },
});

export const mapProjectHelpSessionPrivateDto = (
  session: ProjectHelpSessionDetailRecord,
  viewerRole: ProjectHelpSessionViewerRole,
) => {
  const now = getProjectHelpSessionNow();
  const meetingState = deriveProjectHelpSessionMeetingState(session, now);
  const completionTiming = getProjectHelpSessionCompletionTiming(session, now);
  const allowedActions = deriveProjectHelpSessionAllowedActions(
    session,
    viewerRole,
    now,
  );
  return {
  id: session.id,
  status: session.status,
  project: {
    id: session.project.id,
    title: session.project.title,
    coverImageUrl: session.project.coverImageUrl,
  },
  build: {
    id: session.build.id,
    attemptNumber: session.build.attemptNumber,
  },
  learner: publicUserSummary(session.learner),
  author: publicUserSummary(session.author),
  projectStep: session.projectStep
    ? {
        id: session.projectStep.id,
        title: session.projectStep.title,
        stepNumber: session.projectStep.stepNumber,
      }
    : null,
  problemDescription: session.problemDescription,
  durationMinutes: session.durationMinutes,
  learnerTimeZone: session.learnerTimeZone,
  timeOptions: session.timeOptions.map((option) => mapTimeOption(option, session)),
  selectedTimeOptionId: session.selectedTimeOptionId,
  selectedStartsAt: getSelectedStartsAt(session),
  allowedActions,
  alternativeProposedAt: session.alternativeProposedAt?.toISOString() ?? null,
  confirmedAt: session.confirmedAt?.toISOString() ?? null,
  declinedReason:
    viewerRole === 'learner' && session.status === 'DECLINED'
      ? session.declinedReason
      : viewerRole === 'author'
        ? session.declinedReason
        : session.declinedReason,
  declinedAt: session.declinedAt?.toISOString() ?? null,
  cancelledById: session.cancelledById,
  cancellationReason:
    session.status === 'CANCELLED' ? session.cancellationReason : null,
  cancelledAt: session.cancelledAt?.toISOString() ?? null,
  cancelledByRole:
    session.cancelledById == null
      ? null
      : session.cancelledById === session.learnerId
        ? ('LEARNER' as const)
        : session.cancelledById === session.authorId
          ? ('AUTHOR' as const)
          : null,
  completedAt: session.completedAt?.toISOString() ?? null,
  scheduledEndsAt: completionTiming.scheduledEndsAt,
  completionAvailableAt: completionTiming.completionAvailableAt,
  createdAt: session.createdAt.toISOString(),
  updatedAt: session.updatedAt.toISOString(),
  meetingReady: meetingState.meetingReady,
  provider: meetingState.meetingReady ? ('ZOOM' as const) : null,
  joinAvailableAt: meetingState.joinAvailableAt,
  joinClosesAt: meetingState.joinClosesAt,
  zoomFailureState:
    session.status === 'SCHEDULING_FAILED' ? session.zoomLastFailureCode : null,
  };
};

export const mapProjectHelpSessionListResponse = (input: {
  items: ProjectHelpSessionDetailRecord[];
  total: number;
  page: number;
  limit: number;
  viewerRole: ProjectHelpSessionViewerRole;
}) => ({
  items: input.items.map((session) =>
    mapProjectHelpSessionPrivateDto(session, input.viewerRole),
  ),
  pagination: {
    page: input.page,
    limit: input.limit,
    total: input.total,
    totalPages: Math.max(1, Math.ceil(input.total / input.limit)),
  },
});
