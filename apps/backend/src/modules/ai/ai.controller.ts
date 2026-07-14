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
} from './ai.service.js';
import {
  conversationIdParamSchema,
  createAiConversationSchema,
  listAiConversationsQuerySchema,
  listAiMessagesQuerySchema,
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
