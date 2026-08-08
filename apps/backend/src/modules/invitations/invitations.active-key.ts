import type { RoleInvitationTargetRole } from '../../generated/prisma/client.js';

export const buildRoleInvitationActiveKey = (
  targetEmail: string,
  targetRole: RoleInvitationTargetRole,
) => `pending:${targetEmail.trim().toLowerCase()}:${targetRole}`;

export const clearRoleInvitationActiveKey = {
  activeKey: null,
} as const;
