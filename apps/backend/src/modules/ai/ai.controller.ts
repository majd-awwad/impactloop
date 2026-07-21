import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';
import {
  readValidatedParams,
  readValidatedQuery,
} from '../../middlewares/validate.middleware.js';

import {
  archiveGeneralLearningConversationForUser,
  createGeneralLearningConversationForUser,
  getOwnedConversationMessagesForUser,
  listGeneralLearningConversationsForUser,
  restoreGeneralLearningConversationForUser,
  sendGeneralLearningMessageForUser,
  startProjectAuthoringForUser,
  generateProjectAuthoringProposalForUser,
  submitProjectAuthoringProposalReviewForUser,
  submitProjectAuthoringDiscussionForUser,
  reviseProjectAuthoringProposalForUser,
  prepareApplyReviewedAuthoringProposalForUser,
  runSequentialAuthoringActionForUser,
  discussSequentialAuthoringTurnForUser,
  getSequentialAuthoringStateForUser,
} from './ai.service.js';
import {
  cancelAiPendingAction,
  confirmAiPendingAction,
} from './ai-action.service.js';
import {
  conversationIdParamSchema,
  authoringProposalIdParamSchema,
  authoringReviewStateIdParamSchema,
  submitAuthoringProposalReviewSchema,
  submitAuthoringProposalDiscussionSchema,
  reviseAuthoringProposalSchema,
  sequentialAuthoringActionSchema,
  discussSequentialAuthoringTurnSchema,
  authoringTurnIdParamSchema,
  confirmAiPendingActionSchema,
  createAiConversationSchema,
  listAiConversationsQuerySchema,
  listAiMessagesQuerySchema,
  aiPendingActionIdParamSchema,
  sendAiMessageSchema,
} from './ai.validation.js';

export const createAiConversationHandler = async (
  req: Request,
  res: Response,
) => {
  const body = createAiConversationSchema.parse(req.body);
  const data = await createGeneralLearningConversationForUser(req.auth!.sub, body);

  res.status(201).json(successResponse('Conversation created.', data));
};

export const listAiConversationsHandler = async (req: Request, res: Response) => {
  const query = readValidatedQuery<ReturnType<typeof listAiConversationsQuerySchema.parse>>(
    req,
  );
  const limit = query.limit ?? 20;
  const page = query.page ?? 1;
  const data = await listGeneralLearningConversationsForUser(req.auth!.sub, {
    limit,
    offset: (page - 1) * limit,
    status: query.status ?? 'ACTIVE',
  });

  res.json(successResponse('Conversations loaded.', data));
};

export const listAiConversationMessagesHandler = async (
  req: Request,
  res: Response,
) => {
  const params = readValidatedParams<
    ReturnType<typeof conversationIdParamSchema.parse>
  >(req);
  const query = readValidatedQuery<ReturnType<typeof listAiMessagesQuerySchema.parse>>(
    req,
  );
  const limit = query.limit ?? 50;
  const page = query.page ?? 1;
  const data = await getOwnedConversationMessagesForUser(
    req.auth!.sub,
    params.conversationId,
    {
      limit,
      offset: (page - 1) * limit,
    },
  );

  res.json(successResponse('Conversation messages loaded.', data));
};

export const sendAiConversationMessageHandler = async (
  req: Request,
  res: Response,
) => {
  const params = readValidatedParams<
    ReturnType<typeof conversationIdParamSchema.parse>
  >(req);
  const body = sendAiMessageSchema.parse(req.body);
  const data = await sendGeneralLearningMessageForUser(
    req.auth!.sub,
    params.conversationId,
    body,
  );

  res.status(201).json(successResponse('Message processed.', data));
};

export const startProjectAuthoringHandler = async (
  req: Request,
  res: Response,
) => {
  const params = readValidatedParams<
    ReturnType<typeof conversationIdParamSchema.parse>
  >(req);
  const data = await startProjectAuthoringForUser(
    req.auth!.sub,
    params.conversationId,
  );

  res.status(201).json(successResponse('Authoring clarification started.', data));
};

export const generateProjectAuthoringProposalHandler = async (
  req: Request,
  res: Response,
) => {
  const params = readValidatedParams<
    ReturnType<typeof conversationIdParamSchema.parse>
  >(req);
  const data = await generateProjectAuthoringProposalForUser(
    req.auth!.sub,
    params.conversationId,
  );

  res.status(201).json(successResponse('Authoring proposal generated.', data));
};

export const submitProjectAuthoringProposalReviewHandler = async (
  req: Request,
  res: Response,
) => {
  const params = readValidatedParams<
    ReturnType<typeof authoringProposalIdParamSchema.parse>
  >(req);
  const body = req.body as ReturnType<
    typeof submitAuthoringProposalReviewSchema.parse
  >;
  const data = await submitProjectAuthoringProposalReviewForUser(
    req.auth!.sub,
    params.conversationId,
    params.proposalId,
    body,
  );

  res.status(201).json(successResponse('Authoring review updated.', data));
};

export const submitProjectAuthoringDiscussionHandler = async (
  req: Request,
  res: Response,
) => {
  const params = readValidatedParams<
    ReturnType<typeof authoringProposalIdParamSchema.parse>
  >(req);
  const body = req.body as ReturnType<
    typeof submitAuthoringProposalDiscussionSchema.parse
  >;
  const data = await submitProjectAuthoringDiscussionForUser(
    req.auth!.sub,
    params.conversationId,
    params.proposalId,
    body,
  );

  res.status(201).json(successResponse('Authoring discussion saved.', data));
};

export const reviseProjectAuthoringProposalHandler = async (
  req: Request,
  res: Response,
) => {
  const params = readValidatedParams<
    ReturnType<typeof authoringProposalIdParamSchema.parse>
  >(req);
  const body = req.body as ReturnType<typeof reviseAuthoringProposalSchema.parse>;
  const data = await reviseProjectAuthoringProposalForUser(
    req.auth!.sub,
    params.conversationId,
    params.proposalId,
    body,
  );

  res.status(201).json(successResponse('Authoring proposal revised.', data));
};

export const prepareApplyReviewedAuthoringProposalHandler = async (
  req: Request,
  res: Response,
) => {
  const params = readValidatedParams<
    ReturnType<typeof authoringReviewStateIdParamSchema.parse>
  >(req);
  const data = await prepareApplyReviewedAuthoringProposalForUser(
    req.auth!.sub,
    params.conversationId,
    params.reviewStateId,
  );

  res.status(201).json(successResponse('Apply reviewed proposal prepared.', data));
};

export const archiveAiConversationHandler = async (
  req: Request,
  res: Response,
) => {
  const params = readValidatedParams<
    ReturnType<typeof conversationIdParamSchema.parse>
  >(req);
  const data = await archiveGeneralLearningConversationForUser(
    req.auth!.sub,
    params.conversationId,
  );

  res.json(successResponse('Conversation archived.', data));
};

export const restoreAiConversationHandler = async (
  req: Request,
  res: Response,
) => {
  const params = readValidatedParams<
    ReturnType<typeof conversationIdParamSchema.parse>
  >(req);
  const data = await restoreGeneralLearningConversationForUser(
    req.auth!.sub,
    params.conversationId,
  );

  res.json(successResponse('Conversation restored.', data));
};

export const confirmAiPendingActionHandler = async (
  req: Request,
  res: Response,
) => {
  const params = readValidatedParams<
    ReturnType<typeof aiPendingActionIdParamSchema.parse>
  >(req);
  const body = confirmAiPendingActionSchema.parse(req.body);
  const data = await confirmAiPendingAction({
    userId: req.auth!.sub,
    pendingActionId: params.pendingActionId,
    idempotencyKey: body.idempotencyKey,
    locale: body.locale,
  });

  res.status(201).json(successResponse('Action confirmed.', data));
};

export const cancelAiPendingActionHandler = async (
  req: Request,
  res: Response,
) => {
  const params = readValidatedParams<
    ReturnType<typeof aiPendingActionIdParamSchema.parse>
  >(req);
  const data = await cancelAiPendingAction({
    userId: req.auth!.sub,
    pendingActionId: params.pendingActionId,
  });

  res.json(successResponse('Action cancelled.', data));
};

export const runSequentialAuthoringActionHandler = async (
  req: Request,
  res: Response,
) => {
  const params = readValidatedParams<
    ReturnType<typeof conversationIdParamSchema.parse>
  >(req);
  const body = sequentialAuthoringActionSchema.parse(req.body);
  const data = await runSequentialAuthoringActionForUser(
    req.auth!.sub,
    params.conversationId,
    body,
  );

  res.status(201).json(successResponse('Authoring action completed.', data));
};

export const discussSequentialAuthoringTurnHandler = async (
  req: Request,
  res: Response,
) => {
  const params = readValidatedParams<
    ReturnType<typeof authoringTurnIdParamSchema.parse>
  >(req);
  const body = discussSequentialAuthoringTurnSchema.parse(req.body);
  const data = await discussSequentialAuthoringTurnForUser(
    req.auth!.sub,
    params.conversationId,
    params.turnId,
    body,
  );

  res.status(201).json(successResponse('Authoring discussion saved.', data));
};

export const getSequentialAuthoringStateHandler = async (
  req: Request,
  res: Response,
) => {
  const params = readValidatedParams<
    ReturnType<typeof conversationIdParamSchema.parse>
  >(req);
  const data = await getSequentialAuthoringStateForUser(
    req.auth!.sub,
    params.conversationId,
  );

  res.status(200).json(successResponse('Authoring state loaded.', data));
};

export {
  startAuthoringSessionHandler,
  getAuthoringSessionHandler,
  runAuthoringSessionActionHandler,
  sendAuthoringSessionMessageHandler,
} from './project-authoring-session.controller.js';
