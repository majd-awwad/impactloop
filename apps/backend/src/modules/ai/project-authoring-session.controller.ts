import type { Request, Response } from 'express';
import { z } from 'zod';

import { successResponse } from '../../utils/api-response.js';
import { readValidatedParams } from '../../middlewares/validate.middleware.js';

import {
  getPersistedAuthoringSessionStateById,
  runPersistedAuthoringSessionAction,
  sendPersistedAuthoringSessionMessage,
  startPersistedAuthoringSession,
} from './project-authoring-session.service.js';
import { PROJECT_AUTHORING_SESSION_POLICY_VERSION } from './project-authoring-session.constants.js';
import type { AuthoringSessionResponse } from './project-authoring-session.state.js';

export { PROJECT_AUTHORING_SESSION_POLICY_VERSION } from './project-authoring-session.constants.js';

export const startAuthoringSessionSchema = z.object({
  conversationId: z.string().trim().min(1).max(80),
});

export const sessionIdParamSchema = z.object({
  sessionId: z.string().uuid(),
});

export const authoringSessionActionSchema = z.object({
  action: z.enum([
    'START',
    'ACCEPT_CURRENT',
    'SUGGEST_ANOTHER',
    'SAVE_MANUAL',
    'REGENERATE_FAILED_STAGE',
    'FINISH',
    'CHOOSE_COMPONENT_MODE',
    'ACCEPT_COMPONENT_ITEM',
    'REMOVE_COMPONENT_ITEM',
    'ADD_COMPONENT_ITEM',
    'BACK_COMPONENT_ITEM',
    'FINALIZE_COMPONENTS',
    'CHOOSE_STEP_MODE',
    'ACCEPT_STEP_ITEM',
    'REMOVE_STEP_ITEM',
    'ADD_STEP_ITEM',
    'BACK_STEP_ITEM',
    'EXPLAIN_STEP',
    'FINALIZE_STEPS',
    'REVISIT_STAGE',
  ]),
  expectedVersion: z.number().int().positive(),
  turnId: z.string().uuid().optional(),
  manualValue: z.unknown().optional(),
  mode: z.enum(['FULL_LIST', 'ONE_BY_ONE', 'FULL_PLAN', 'STEP_BY_STEP']).optional(),
  targetStage: z.string().optional(),
});

export const authoringSessionMessageSchema = z
  .object({
    text: z.string().trim().min(1).max(4000).optional(),
    questionId: z.string().trim().min(1).max(128).optional(),
    selectedOptionIds: z.array(z.string().trim().min(1).max(128)).max(5).optional(),
    otherText: z.string().trim().max(500).optional().nullable(),
    currentTurnId: z.string().uuid().optional(),
    clientMessageId: z.string().trim().min(1).max(128).optional(),
    expectedVersion: z.number().int().positive(),
  })
  .superRefine((body, ctx) => {
    const isStructured = body.questionId != null;
    if (isStructured) {
      if (!body.currentTurnId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'currentTurnId is required for structured clarification answers.',
          path: ['currentTurnId'],
        });
      }
      if (!body.selectedOptionIds || body.selectedOptionIds.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'selectedOptionIds is required for structured clarification answers.',
          path: ['selectedOptionIds'],
        });
      }
      return;
    }

    if (!body.text) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'text is required for composer messages.',
        path: ['text'],
      });
    }
  });

export const startAuthoringSessionHandler = async (req: Request, res: Response) => {
  const body = startAuthoringSessionSchema.parse(req.body);
  const data = (await startPersistedAuthoringSession(req.auth!.sub, body.conversationId, {
    writeLegacyMessage: false,
  })) as AuthoringSessionResponse;
  res.status(201).json(successResponse('Authoring session ready.', data));
};

export const getAuthoringSessionHandler = async (req: Request, res: Response) => {
  const params = readValidatedParams<ReturnType<typeof sessionIdParamSchema.parse>>(req);
  const data = await getPersistedAuthoringSessionStateById(req.auth!.sub, params.sessionId);
  res.status(200).json(successResponse('Authoring session loaded.', data));
};

export const runAuthoringSessionActionHandler = async (req: Request, res: Response) => {
  const params = readValidatedParams<ReturnType<typeof sessionIdParamSchema.parse>>(req);
  const body = authoringSessionActionSchema.parse(req.body);
  const data = await runPersistedAuthoringSessionAction(req.auth!.sub, params.sessionId, body);
  res.status(200).json(successResponse('Authoring action completed.', data));
};

export const sendAuthoringSessionMessageHandler = async (req: Request, res: Response) => {
  const params = readValidatedParams<ReturnType<typeof sessionIdParamSchema.parse>>(req);
  const body = authoringSessionMessageSchema.parse(req.body);
  const data = await sendPersistedAuthoringSessionMessage(req.auth!.sub, params.sessionId, body);
  res.status(200).json(successResponse('Authoring message processed.', data));
};
