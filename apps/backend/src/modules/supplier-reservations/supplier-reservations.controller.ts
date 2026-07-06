import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';
import { readValidatedParams, readValidatedQuery } from '../../middlewares/validate.middleware.js';

import {
  acceptSupplierReservation,
  acceptLearnerRescheduleProposal,
  cancelSupplierAcceptedReservation,
  completeSupplierReservation,
  createSupplierReservationMessage,
  declineSupplierReservation,
  listSupplierReservationMessages,
  listSupplierReservations,
  rescheduleSupplierReservation,
  reportSupplierNoDriverAvailable,
  submitNoDriverPickupWindow,
  submitSupplierNoShowReport,
} from './supplier-reservations.service.js';
import type {
  AcceptSupplierReservationInput,
  CancelSupplierReservationInput,
  CompleteSupplierReservationInput,
  CreateReservationMessageInput,
  DeclineSupplierReservationInput,
  ListSupplierReservationsQuery,
  ReportSupplierNoDriverInput,
  RescheduleSupplierReservationInput,
  ReservationIdParams,
  SubmitNoDriverPickupWindowInput,
  SubmitNoShowReportInput,
} from './supplier-reservations.validation.js';

export const listSupplierReservationsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const reservations = await listSupplierReservations(
    req.auth!.sub,
    readValidatedQuery<ListSupplierReservationsQuery>(req),
  );

  res.json(successResponse('Supplier reservations loaded.', { reservations }));
};

export const acceptSupplierReservationHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<ReservationIdParams>(req);
  const reservation = await acceptSupplierReservation(
    req.auth!.sub,
    id,
    req.body as AcceptSupplierReservationInput,
  );

  res.json(successResponse('Reservation accepted.', reservation));
};

export const declineSupplierReservationHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<ReservationIdParams>(req);
  const reservation = await declineSupplierReservation(
    req.auth!.sub,
    id,
    req.body as DeclineSupplierReservationInput,
  );

  res.json(successResponse('Reservation declined.', reservation));
};

export const completeSupplierReservationHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<ReservationIdParams>(req);
  const reservation = await completeSupplierReservation(
    req.auth!.sub,
    id,
    req.body as CompleteSupplierReservationInput,
  );

  res.json(successResponse('Reservation completed.', reservation));
};

export const rescheduleSupplierReservationHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<ReservationIdParams>(req);
  const reservation = await rescheduleSupplierReservation(
    req.auth!.sub,
    id,
    req.body as RescheduleSupplierReservationInput,
  );

  res.json(successResponse('Pickup reschedule requested.', reservation));
};

export const acceptLearnerRescheduleProposalHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<ReservationIdParams>(req);
  const reservation = await acceptLearnerRescheduleProposal(req.auth!.sub, id);

  res.json(successResponse('Learner reschedule accepted.', reservation));
};

export const cancelSupplierAcceptedReservationHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<ReservationIdParams>(req);
  const reservation = await cancelSupplierAcceptedReservation(
    req.auth!.sub,
    id,
    req.body as CancelSupplierReservationInput,
  );

  res.json(successResponse('Reservation cancelled.', reservation));
};

export const submitSupplierNoShowReportHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<ReservationIdParams>(req);
  const report = await submitSupplierNoShowReport(
    req.auth!.sub,
    id,
    req.body as SubmitNoShowReportInput,
  );

  res.json(successResponse('No-show report submitted.', report));
};

export const reportSupplierNoDriverHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<ReservationIdParams>(req);
  const reservation = await reportSupplierNoDriverAvailable(
    req.auth!.sub,
    id,
    req.body as ReportSupplierNoDriverInput,
  );

  res.json(successResponse('No-driver report submitted.', reservation));
};

export const submitNoDriverPickupWindowHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<ReservationIdParams>(req);
  const reservation = await submitNoDriverPickupWindow(
    req.auth!.sub,
    id,
    req.body as SubmitNoDriverPickupWindowInput,
  );

  res.json(successResponse('New pickup window submitted.', reservation));
};

export const listSupplierReservationMessagesHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<ReservationIdParams>(req);
  const messages = await listSupplierReservationMessages(req.auth!.sub, id);

  res.json(successResponse('Reservation messages loaded.', { messages }));
};

export const createSupplierReservationMessageHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<ReservationIdParams>(req);
  const message = await createSupplierReservationMessage(
    req.auth!.sub,
    id,
    req.body as CreateReservationMessageInput,
  );

  res.json(successResponse('Message sent.', message));
};
