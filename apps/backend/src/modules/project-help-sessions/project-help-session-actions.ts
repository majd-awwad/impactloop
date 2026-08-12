import type { ProjectHelpSessionDetailRecord } from './project-help-session.repository.js';

import {

  getAuthorAlternativeOption,

  hasAuthorAlternativeOption,

} from './project-help-session.repository.js';

import { isProjectHelpSessionCancellableStatus } from './project-help-session-status.js';

import { computeProjectHelpSessionMeetingWindow } from './project-help-session-zoom-windows.js';
import { deriveProjectHelpSessionCompletionState } from './project-help-session-completion.js';
import { getProjectHelpSessionNow } from './project-help-session-clock.js';



export type ProjectHelpSessionViewerRole = 'learner' | 'author';



export type ProjectHelpSessionLearnerAllowedActions = {

  canAcceptAlternative: boolean;

  canRejectAlternative: boolean;

  canCancel: boolean;

  canJoin: boolean;

  canReportNoShow: boolean;

};



export type ProjectHelpSessionAuthorAllowedActions = {

  canAcceptOption: boolean;

  canProposeAlternative: boolean;

  canDecline: boolean;

  canCancel: boolean;

  canJoin: boolean;

  canReportNoShow: boolean;

  canRetryZoom: boolean;

  canComplete: boolean;

};



export const deriveProjectHelpSessionMeetingState = (

  session: ProjectHelpSessionDetailRecord,

  now: Date = new Date(),

) => {

  const startsAt = session.selectedTimeOption?.startsAt;

  const meetingReady =

    session.status === 'SCHEDULED' && Boolean(session.zoomJoinUrl && session.zoomMeetingId);



  if (!startsAt) {

    return {

      meetingReady,

      joinAvailableAt: null as string | null,

      joinClosesAt: null as string | null,

      inWindow: false,

      isBeforeWindow: false,

      isAfterWindow: false,

    };

  }



  const window = computeProjectHelpSessionMeetingWindow({

    startsAt,

    durationMinutes: session.durationMinutes,

    now,

  });



  return {

    meetingReady,

    joinAvailableAt: window.joinAvailableAt.toISOString(),

    joinClosesAt: window.joinClosesAt.toISOString(),

    inWindow: window.isJoinable,

    isBeforeWindow: window.isBeforeWindow,

    isAfterWindow: window.isAfterWindow,

  };

};



export const deriveProjectHelpSessionAllowedActions = (

  session: ProjectHelpSessionDetailRecord,

  viewerRole: ProjectHelpSessionViewerRole,

  now: Date = new Date(),

):

  | ProjectHelpSessionLearnerAllowedActions

  | ProjectHelpSessionAuthorAllowedActions => {

  const meetingState = deriveProjectHelpSessionMeetingState(session, now);

  const canCancel =
    isProjectHelpSessionCancellableStatus(session.status) &&
    (session.status !== 'SCHEDULED' || meetingState.isBeforeWindow);

  const completionState = deriveProjectHelpSessionCompletionState(session, now);



  if (viewerRole === 'learner') {

    return {

      canAcceptAlternative: session.status === 'ALTERNATIVE_PROPOSED',

      canRejectAlternative: session.status === 'ALTERNATIVE_PROPOSED',

      canCancel,

      canJoin: meetingState.meetingReady && meetingState.inWindow,

      canReportNoShow:
        session.status === 'SCHEDULED' &&
        meetingState.isAfterWindow &&
        (session.autoFinalizeAt === null || now < session.autoFinalizeAt) &&
        session.learnerReportedAuthorNoShowAt === null,

    };

  }



  return {

    canAcceptOption: session.status === 'PENDING',

    canProposeAlternative:

      session.status === 'PENDING' && !hasAuthorAlternativeOption(session),

    canDecline: session.status === 'PENDING',

    canCancel,

    canJoin: meetingState.meetingReady && meetingState.inWindow,

    canReportNoShow:
      session.status === 'SCHEDULED' &&
      meetingState.isAfterWindow &&
      (session.autoFinalizeAt === null || now < session.autoFinalizeAt) &&
      session.authorReportedLearnerNoShowAt === null,

    canRetryZoom: session.status === 'SCHEDULING_FAILED',

    canComplete: completionState.isCompletable,

  };

};



export const getSelectedStartsAt = (session: ProjectHelpSessionDetailRecord) =>

  session.selectedTimeOption?.startsAt?.toISOString() ?? null;



export const getProjectHelpSessionCompletionTiming = (

  session: ProjectHelpSessionDetailRecord,

  now: Date = getProjectHelpSessionNow(),

) => {

  const completionState = deriveProjectHelpSessionCompletionState(session, now);

  return {

    scheduledEndsAt: completionState.scheduledEndsAt?.toISOString() ?? null,

    completionAvailableAt:

      completionState.completionAvailableAt?.toISOString() ?? null,

  };

};



export const hasValidAuthorAlternative = (session: ProjectHelpSessionDetailRecord) =>

  getAuthorAlternativeOption(session) !== null;

