import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';

import {
  cancelReservation,
  createReservation,
  createLearnerReservationMessage,
  listLearnerReservationMessages,
  listMyReservations,
  requestLearnerPickupReschedule,
  reportLearnerSupplierIssue,
  reportNoDriverAvailable,
  resolveLearnerConfirmation,
} from './reservations.service.js';
import type {
  CreateReservationInput,
  CreateReservationMessageInput,
  LearnerConfirmationInput,
  ReportNoDriverInput,
  ReportSupplierIssueInput,
  RequestPickupRescheduleInput,
} from './reservations.validation.js';

export const createReservationHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const reservation = await createReservation(
    req.auth!.sub,
    req.body as CreateReservationInput,
  );

  res
    .status(201)
    .json(successResponse('Reservation requested.', reservation));
};

export const listMyReservationsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const reservations = await listMyReservations(req.auth!.sub);

  res.json(successResponse('Reservations loaded.', { reservations }));
};

export const cancelReservationHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const reservation = await cancelReservation(
    req.auth!.sub,
    req.params.id as string,
  );

  res.json(successResponse('Reservation cancelled.', reservation));
};

export const listLearnerReservationMessagesHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const messages = await listLearnerReservationMessages(
    req.auth!.sub,
    req.params.id as string,
  );

  res.json(successResponse('Reservation messages loaded.', { messages }));
};

export const createLearnerReservationMessageHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const message = await createLearnerReservationMessage(
    req.auth!.sub,
    req.params.id as string,
    req.body as CreateReservationMessageInput,
  );

  res.json(successResponse('Message sent.', message));
};

export const resolveLearnerConfirmationHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const reservation = await resolveLearnerConfirmation(
    req.auth!.sub,
    req.params.id as string,
    req.body as LearnerConfirmationInput,
  );

  res.json(successResponse('Reservation updated.', reservation));
};

export const requestLearnerPickupRescheduleHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const reservation = await requestLearnerPickupReschedule(
    req.auth!.sub,
    req.params.id as string,
    req.body as RequestPickupRescheduleInput,
  );

  res.json(successResponse('Reschedule request submitted.', reservation));
};

export const reportLearnerSupplierIssueHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const reservation = await reportLearnerSupplierIssue(
    req.auth!.sub,
    req.params.id as string,
    req.body as ReportSupplierIssueInput,
  );

  res.json(successResponse('Supplier issue reported to admin.', reservation));
};

export const reportNoDriverAvailableHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const reservation = await reportNoDriverAvailable(
    req.auth!.sub,
    req.params.id as string,
    req.body as ReportNoDriverInput,
  );

  res.json(successResponse('No-driver case reported to admin.', reservation));
};
