export type SafeLogValue =
  | string
  | number
  | boolean
  | null
  | SafeLogValue[]
  | { [key: string]: SafeLogValue };

export type LogContext = {
  operation?: string;
  errorCode?: string;
  statusCode?: number;
  durationMs?: number;
  route?: string;
  responseSize?: number;
  event?: string;
  deliveryId?: string;
  reservationId?: string;
  materialId?: string;
  userId?: string;
  activeRole?: string;
  requestId?: string;
  method?: string;
  path?: string;
  err?: SafeLogValue;
  [key: string]: SafeLogValue | undefined;
};
