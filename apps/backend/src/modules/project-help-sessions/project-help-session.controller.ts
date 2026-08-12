import type { Request, Response } from 'express';

import { readValidatedParams, readValidatedQuery } from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';

import {
  getAuthorHelpSessionSettings,
  getProjectHelpSessionAvailability,
  upsertAuthorHelpSessionSettings,
} from './project-help-session-offering.js';
import {
  authorAcceptProjectHelpSessionOption,
  authorCompleteProjectHelpSession,
  authorDeclineProjectHelpSession,
  authorProposeProjectHelpSessionAlternative,
  cancelProjectHelpSession,
  createProjectHelpSessionRequest,
  getAuthorProjectHelpSession,
  getLearnerProjectHelpSession,
  learnerAcceptProjectHelpSessionAlternative,
  learnerRejectProjectHelpSessionAlternative,
  listAuthorProjectHelpSessionViews,
  listLearnerProjectHelpSessionViews,
} from './project-help-session.service.js';
import { ensureProjectHelpSessionNotebookPage } from './project-help-session-notebook-handoff.service.js';
import { listLearnerHelpSessionProjectOptions } from './project-help-session-project-options.service.js';
import {
  getAuthorProjectHelpSessionZoomJoin,
  getLearnerProjectHelpSessionZoomJoin,
} from './project-help-session-zoom.service.js';
import { retryZoomProvisioningForAuthor } from './project-help-session-zoom-provisioning.service.js';
import type {
  AcceptProjectHelpSessionOptionInput,
  CancelProjectHelpSessionInput,
  CreateProjectHelpSessionRequestInput,
  DeclineProjectHelpSessionInput,
  ListAuthorProjectHelpSessionsQuery,
  ListLearnerProjectHelpSessionsQuery,
  LearnerHelpSessionProjectOptionsQuery,
  ProposeProjectHelpSessionAlternativeInput,
  UpdateProjectHelpSessionSettingsInput,
} from './project-help-session.validation.js';

export const listLearnerHelpSessionProjectOptionsHandler = async (
  req: Request,
  res: Response,
) => {
  const query = readValidatedQuery<LearnerHelpSessionProjectOptionsQuery>(req);
  const result = await listLearnerHelpSessionProjectOptions({
    learnerId: req.auth!.sub,
    q: query.q,
    page: query.page,
    limit: query.limit,
  });
  res.json(
    successResponse('Eligible help session projects fetched successfully', result),
  );
};
export const getProjectHelpSessionAvailabilityHandler = async (
  req: Request,
  res: Response,
) => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const availability = await getProjectHelpSessionAvailability(id, req.auth!.sub);
  res.json(
    successResponse('Project help session availability fetched successfully', availability),
  );
};

export const getAuthorHelpSessionSettingsHandler = async (
  req: Request,
  res: Response,
) => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const settings = await getAuthorHelpSessionSettings(id, req.auth!.sub);
  res.json(
    successResponse('Project help session settings fetched successfully', settings),
  );
};

export const updateAuthorHelpSessionSettingsHandler = async (
  req: Request,
  res: Response,
) => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const body = req.body as UpdateProjectHelpSessionSettingsInput;
  const settings = await upsertAuthorHelpSessionSettings(
    id,
    req.auth!.sub,
    body,
  );
  res.json(
    successResponse('Project help session settings updated successfully', settings),
  );
};

export const createProjectHelpSessionRequestHandler = async (
  req: Request,
  res: Response,
) => {
  const { buildId } = readValidatedParams<{ buildId: string }>(req);
  const body = req.body as CreateProjectHelpSessionRequestInput;
  const session = await createProjectHelpSessionRequest(
    req.auth!.sub,
    buildId,
    body,
  );
  res.status(201).json(
    successResponse('Project help session request created successfully', session),
  );
};

export const listLearnerProjectHelpSessionsHandler = async (
  req: Request,
  res: Response,
) => {
  const query = readValidatedQuery<ListLearnerProjectHelpSessionsQuery>(req);
  const result = await listLearnerProjectHelpSessionViews({
    learnerId: req.auth!.sub,
    status: query.status,
    buildId: query.buildId,
    page: query.page,
    limit: query.limit,
  });
  res.json(
    successResponse('Learner help sessions fetched successfully', result),
  );
};

export const getLearnerProjectHelpSessionHandler = async (
  req: Request,
  res: Response,
) => {
  const { sessionId } = readValidatedParams<{ sessionId: string }>(req);
  const session = await getLearnerProjectHelpSession(req.auth!.sub, sessionId);
  res.json(
    successResponse('Learner help session fetched successfully', session),
  );
};

export const listAuthorProjectHelpSessionsHandler = async (
  req: Request,
  res: Response,
) => {
  const query = readValidatedQuery<ListAuthorProjectHelpSessionsQuery>(req);
  const result = await listAuthorProjectHelpSessionViews({
    authorId: req.auth!.sub,
    status: query.status,
    projectId: query.projectId,
    page: query.page,
    limit: query.limit,
  });
  res.json(
    successResponse('Author help sessions fetched successfully', result),
  );
};

export const getAuthorProjectHelpSessionHandler = async (
  req: Request,
  res: Response,
) => {
  const { sessionId } = readValidatedParams<{ sessionId: string }>(req);
  const session = await getAuthorProjectHelpSession(req.auth!.sub, sessionId);
  res.json(
    successResponse('Author help session fetched successfully', session),
  );
};

export const authorAcceptProjectHelpSessionOptionHandler = async (
  req: Request,
  res: Response,
) => {
  const { sessionId } = readValidatedParams<{ sessionId: string }>(req);
  const body = req.body as AcceptProjectHelpSessionOptionInput;
  const session = await authorAcceptProjectHelpSessionOption(
    req.auth!.sub,
    sessionId,
    body.timeOptionId,
  );
  res.json(
    successResponse('Help session option accepted successfully', session),
  );
};

export const authorProposeProjectHelpSessionAlternativeHandler = async (
  req: Request,
  res: Response,
) => {
  const { sessionId } = readValidatedParams<{ sessionId: string }>(req);
  const body = req.body as ProposeProjectHelpSessionAlternativeInput;
  const session = await authorProposeProjectHelpSessionAlternative(
    req.auth!.sub,
    sessionId,
    body.startsAt,
  );
  res.json(
    successResponse('Help session alternative proposed successfully', session),
  );
};

export const authorDeclineProjectHelpSessionHandler = async (
  req: Request,
  res: Response,
) => {
  const { sessionId } = readValidatedParams<{ sessionId: string }>(req);
  const body = req.body as DeclineProjectHelpSessionInput;
  const session = await authorDeclineProjectHelpSession(
    req.auth!.sub,
    sessionId,
    body.reason,
  );
  res.json(successResponse('Help session declined successfully', session));
};

export const learnerAcceptProjectHelpSessionAlternativeHandler = async (
  req: Request,
  res: Response,
) => {
  const { sessionId } = readValidatedParams<{ sessionId: string }>(req);
  const session = await learnerAcceptProjectHelpSessionAlternative(
    req.auth!.sub,
    sessionId,
  );
  res.json(
    successResponse('Help session alternative accepted successfully', session),
  );
};

export const learnerRejectProjectHelpSessionAlternativeHandler = async (
  req: Request,
  res: Response,
) => {
  const { sessionId } = readValidatedParams<{ sessionId: string }>(req);
  const session = await learnerRejectProjectHelpSessionAlternative(
    req.auth!.sub,
    sessionId,
  );
  res.json(
    successResponse('Help session alternative rejected successfully', session),
  );
};

export const learnerCancelProjectHelpSessionHandler = async (
  req: Request,
  res: Response,
) => {
  const { sessionId } = readValidatedParams<{ sessionId: string }>(req);
  const body = req.body as CancelProjectHelpSessionInput;
  const session = await cancelProjectHelpSession({
    sessionId,
    actorId: req.auth!.sub,
    actorRole: 'learner',
    reason: body.reason,
  });
  res.json(successResponse('Help session cancelled successfully', session));
};

export const authorRetryProjectHelpSessionZoomHandler = async (
  req: Request,
  res: Response,
) => {
  const { sessionId } = readValidatedParams<{ sessionId: string }>(req);
  const session = await retryZoomProvisioningForAuthor(req.auth!.sub, sessionId);
  res.json(successResponse('Help session Zoom retry completed', session));
};

export const learnerJoinProjectHelpSessionZoomHandler = async (
  req: Request,
  res: Response,
) => {
  const { sessionId } = readValidatedParams<{ sessionId: string }>(req);
  const join = await getLearnerProjectHelpSessionZoomJoin(req.auth!.sub, sessionId);
  res.json(successResponse('Help session join details fetched successfully', join));
};

export const authorJoinProjectHelpSessionZoomHandler = async (
  req: Request,
  res: Response,
) => {
  const { sessionId } = readValidatedParams<{ sessionId: string }>(req);
  const join = await getAuthorProjectHelpSessionZoomJoin(req.auth!.sub, sessionId);
  res.json(successResponse('Help session join details fetched successfully', join));
};
export const authorCancelProjectHelpSessionHandler = async (
  req: Request,
  res: Response,
) => {
  const { sessionId } = readValidatedParams<{ sessionId: string }>(req);
  const body = req.body as CancelProjectHelpSessionInput;
  const session = await cancelProjectHelpSession({
    sessionId,
    actorId: req.auth!.sub,
    actorRole: 'author',
    reason: body.reason,
  });
  res.json(successResponse('Help session cancelled successfully', session));
};

export const authorCompleteProjectHelpSessionHandler = async (
  req: Request,
  res: Response,
) => {
  const { sessionId } = readValidatedParams<{ sessionId: string }>(req);
  const session = await authorCompleteProjectHelpSession(req.auth!.sub, sessionId);
  res.json(successResponse('Help session completed successfully', session));
};

export const learnerEnsureProjectHelpSessionNotebookPageHandler = async (
  req: Request,
  res: Response,
) => {
  const { sessionId } = readValidatedParams<{ sessionId: string }>(req);
  const locale = req.query.locale === 'ar' ? 'ar' : 'en';
  const result = await ensureProjectHelpSessionNotebookPage({
    learnerId: req.auth!.sub,
    sessionId,
    locale,
  });
  res.json(
    successResponse('Help session notebook page ensured successfully', result),
  );
};
