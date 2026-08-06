import { z } from 'zod';

import type { ProjectHelpSessionStatus } from '../../generated/prisma/client.js';
import { paginationQuerySchema } from '../../utils/zod-helpers.js';

import {
  PROJECT_HELP_SESSION_MAX_WEEKLY_LIMIT,
  PROJECT_HELP_SESSION_MIN_WEEKLY_LIMIT,
} from './project-help-session-offering.js';
import {
  isValidIanaTimeZone,
  normalizeProposedUtcTimes,
  PROJECT_HELP_SESSION_ALLOWED_DURATIONS,
  PROJECT_HELP_SESSION_MAX_PROBLEM_LENGTH,
  PROJECT_HELP_SESSION_MAX_REASON_LENGTH,
  PROJECT_HELP_SESSION_MIN_PROBLEM_LENGTH,
  PROJECT_HELP_SESSION_MAX_TIMEZONE_LENGTH,
  validateProblemDescription,
} from './project-help-session-time.js';

export const updateProjectHelpSessionSettingsSchema = z
  .object({
    isEnabled: z.boolean(),
    allow15Minutes: z.boolean(),
    allow30Minutes: z.boolean(),
    weeklyLimit: z
      .number()
      .int()
      .min(PROJECT_HELP_SESSION_MIN_WEEKLY_LIMIT)
      .max(PROJECT_HELP_SESSION_MAX_WEEKLY_LIMIT),
  })
  .superRefine((value, context) => {
    if (value.isEnabled && !value.allow15Minutes && !value.allow30Minutes) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one session duration must be enabled.',
        path: ['allow15Minutes'],
      });
    }
  });

export type UpdateProjectHelpSessionSettingsInput = z.infer<
  typeof updateProjectHelpSessionSettingsSchema
>;

const helpSessionStatusSchema = z.enum([
  'PENDING',
  'ALTERNATIVE_PROPOSED',
  'ZOOM_PENDING',
  'SCHEDULING_FAILED',
  'SCHEDULED',
  'DECLINED',
  'CANCELLED',
  'COMPLETED',
]) satisfies z.ZodType<ProjectHelpSessionStatus>;

export const projectHelpSessionIdParamSchema = z.object({
  sessionId: z.string().cuid(),
});

export const projectHelpSessionBuildIdParamSchema = z.object({
  buildId: z.string().cuid(),
});

export const createProjectHelpSessionRequestSchema = z
  .object({
    problemDescription: z.string(),
    projectStepId: z.string().cuid().nullable().optional(),
    durationMinutes: z.number().int(),
    learnerTimeZone: z.string().trim().min(1).max(PROJECT_HELP_SESSION_MAX_TIMEZONE_LENGTH),
    proposedTimes: z.array(z.string()).length(3),
  })
  .superRefine((value, context) => {
    const problem = validateProblemDescription(value.problemDescription);
    if (!problem.valid) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: problem.message,
        path: ['problemDescription'],
      });
    } else if (
      problem.value.length < PROJECT_HELP_SESSION_MIN_PROBLEM_LENGTH ||
      problem.value.length > PROJECT_HELP_SESSION_MAX_PROBLEM_LENGTH
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Problem description must be between ${PROJECT_HELP_SESSION_MIN_PROBLEM_LENGTH} and ${PROJECT_HELP_SESSION_MAX_PROBLEM_LENGTH} characters.`,
        path: ['problemDescription'],
      });
    }

    if (
      !PROJECT_HELP_SESSION_ALLOWED_DURATIONS.includes(
        value.durationMinutes as (typeof PROJECT_HELP_SESSION_ALLOWED_DURATIONS)[number],
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Duration must be 15 or 30 minutes.',
        path: ['durationMinutes'],
      });
    }

    if (!isValidIanaTimeZone(value.learnerTimeZone)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'learnerTimeZone must be a valid IANA timezone.',
        path: ['learnerTimeZone'],
      });
    }

    const normalizedTimes = normalizeProposedUtcTimes(value.proposedTimes);
    if (!normalizedTimes.valid) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: normalizedTimes.message,
        path: ['proposedTimes'],
      });
    }
  })
  .transform((value) => {
    const problem = validateProblemDescription(value.problemDescription);
    const normalizedTimes = normalizeProposedUtcTimes(value.proposedTimes);
    return {
      problemDescription: problem.valid ? problem.value : value.problemDescription.trim(),
      projectStepId: value.projectStepId ?? null,
      durationMinutes: value.durationMinutes,
      learnerTimeZone: value.learnerTimeZone,
      proposedTimes: normalizedTimes.valid ? normalizedTimes.values : [],
    };
  });

export type CreateProjectHelpSessionRequestInput = z.infer<
  typeof createProjectHelpSessionRequestSchema
>;

export const acceptProjectHelpSessionOptionSchema = z.object({
  timeOptionId: z.string().cuid(),
});

export const proposeProjectHelpSessionAlternativeSchema = z.object({
  startsAt: z.string().trim().min(1),
});

export const declineProjectHelpSessionSchema = z.object({
  reason: z.string().max(PROJECT_HELP_SESSION_MAX_REASON_LENGTH).nullable().optional(),
});

export const cancelProjectHelpSessionSchema = z.object({
  reason: z.string().max(PROJECT_HELP_SESSION_MAX_REASON_LENGTH).nullable().optional(),
});

export const listLearnerProjectHelpSessionsQuerySchema = paginationQuerySchema.extend({
  status: helpSessionStatusSchema.optional(),
});

export const listAuthorProjectHelpSessionsQuerySchema = paginationQuerySchema.extend({
  status: helpSessionStatusSchema.optional(),
  projectId: z.string().uuid().optional(),
});

export type ListLearnerProjectHelpSessionsQuery = z.infer<
  typeof listLearnerProjectHelpSessionsQuerySchema
>;
export type ListAuthorProjectHelpSessionsQuery = z.infer<
  typeof listAuthorProjectHelpSessionsQuerySchema
>;

export type AcceptProjectHelpSessionOptionInput = z.infer<
  typeof acceptProjectHelpSessionOptionSchema
>;
export type ProposeProjectHelpSessionAlternativeInput = z.infer<
  typeof proposeProjectHelpSessionAlternativeSchema
>;
export type DeclineProjectHelpSessionInput = z.infer<
  typeof declineProjectHelpSessionSchema
>;
export type CancelProjectHelpSessionInput = z.infer<
  typeof cancelProjectHelpSessionSchema
>;