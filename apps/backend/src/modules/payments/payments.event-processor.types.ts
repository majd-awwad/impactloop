export type ProcessProviderEventResult = {
  processingStatus:
    | 'PROCESSED'
    | 'IGNORED_DUPLICATE'
    | 'REJECTED'
    | 'RECEIVED';
  paymentOrderId?: string;
  /** All orders settled by a session-owned attempt (PAY-05D). */
  paymentOrderIds?: string[];
  checkoutSessionId?: string;
  paymentAttemptId?: string | null;
  reason?: string;
  /** When set, post-commit hook must start refund orchestration (not fulfillment). */
  postCommitAutoRefund?: boolean;
  /** Allocation-aware late-success refunds for one or more session items. */
  postCommitAutoRefundOrderIds?: string[];
  /**
   * Orders already PAID by another charge — refund the session allocation only
   * and keep the order PAID (PAY-05D-R2 double-charge defense).
   */
  postCommitDuplicateAllocationOrderIds?: string[];
};
