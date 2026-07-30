import type { Prisma } from '../../generated/prisma/index.js';
import {
  ADMIN_ACTIVITY_ACTIONS,
  ADMIN_ACTIVITY_TARGET_TYPES,
  logAdminActivity,
} from '../admin/admin-activity-log.js';

export type AdminDataExportAuditInput = {
  actorUserId: string;
  domain: string;
  format: string;
  filters: Record<string, unknown>;
  expectedCount?: number;
  exportedCount: number;
  success: boolean;
  errorCode?: string;
};

export const logAdminDataExport = async (input: AdminDataExportAuditInput) => {
  await logAdminActivity({
    actorUserId: input.actorUserId,
    action: ADMIN_ACTIVITY_ACTIONS.DATA_EXPORTED,
    targetType: ADMIN_ACTIVITY_TARGET_TYPES.DATA_EXPORT,
    targetLabel: `${input.domain} ${input.format} export`,
    metadata: {
      domain: input.domain,
      format: input.format,
      filters: input.filters as Prisma.InputJsonValue,
      expectedCount: input.expectedCount ?? null,
      exportedCount: input.exportedCount,
      success: input.success,
      errorCode: input.errorCode ?? null,
    },
  });
};

/**
 * Exactly-once terminal audit for streamed downloads.
 * Success means the server finished writing the HTTP response body,
 * not that the browser saved or opened the file.
 */
export type StreamExportAuditGuard = {
  markFinished: () => void;
  markClosed: () => void;
  markError: (errorCode: string) => void;
  finalize: () => Promise<AdminDataExportAuditInput | null>;
};

export const createStreamExportAuditGuard = (input: {
  actorUserId: string;
  domain: string;
  format: string;
  filters: Record<string, unknown>;
  expectedCount: number;
  getExportedCount: () => number;
  log?: (payload: AdminDataExportAuditInput) => Promise<void>;
}): StreamExportAuditGuard => {
  let terminal: 'pending' | 'finished' | 'closed' | 'error' = 'pending';
  let errorCode = 'EXPORT_FAILED';
  let finalized = false;
  const writeLog = input.log ?? logAdminDataExport;

  return {
    markFinished: () => {
      if (terminal === 'pending' || terminal === 'closed') {
        // Prefer finish over a premature close race when both fire.
        terminal = 'finished';
      }
    },
    markClosed: () => {
      if (terminal === 'pending') {
        terminal = 'closed';
      }
    },
    markError: (code: string) => {
      if (terminal !== 'finished') {
        terminal = 'error';
        errorCode = code;
      }
    },
    finalize: async () => {
      if (finalized) {
        return null;
      }
      finalized = true;

      let success = false;
      let resolvedError: string | undefined;

      if (terminal === 'finished') {
        success = true;
      } else if (terminal === 'closed') {
        resolvedError = 'EXPORT_CLIENT_DISCONNECT';
      } else if (terminal === 'error') {
        resolvedError = errorCode;
      } else {
        resolvedError = 'EXPORT_INCOMPLETE';
      }

      const payload: AdminDataExportAuditInput = {
        actorUserId: input.actorUserId,
        domain: input.domain,
        format: input.format,
        filters: input.filters,
        expectedCount: input.expectedCount,
        exportedCount: input.getExportedCount(),
        success,
        errorCode: resolvedError,
      };

      await writeLog(payload);
      return payload;
    },
  };
};
