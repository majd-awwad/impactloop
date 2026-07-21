import type {
  Prisma,
  ProjectAuthoringSession,
  ProjectAuthoringTurn,
  ProjectAuthoringSessionStage,
  ProjectAuthoringSessionStatus,
  ProjectAuthoringTurnStatus,
} from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';

export type ProjectAuthoringSessionWithTurn = ProjectAuthoringSession & {
  currentTurn: ProjectAuthoringTurn | null;
};

const sessionInclude = {
  currentTurn: true,
} satisfies Prisma.ProjectAuthoringSessionInclude;

export const projectAuthoringSessionRepository = {
  findByConversationId(conversationId: string) {
    return prisma.projectAuthoringSession.findUnique({
      where: { conversationId },
      include: sessionInclude,
    });
  },

  findByIdForOwner(sessionId: string, ownerId: string) {
    return prisma.projectAuthoringSession.findFirst({
      where: { id: sessionId, ownerId },
      include: sessionInclude,
    });
  },

  findTurnById(turnId: string) {
    return prisma.projectAuthoringTurn.findUnique({ where: { id: turnId } });
  },

  listTurnsForSession(sessionId: string) {
    return prisma.projectAuthoringTurn.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  },

  async createSession(input: {
    conversationId: string;
    learningProjectId: string;
    ownerId: string;
    stage: ProjectAuthoringSessionStage;
    status: ProjectAuthoringSessionStatus;
    baseProjectUpdatedAt: Date;
    completedStages?: ProjectAuthoringSessionStage[];
    componentWorkingState?: Record<string, unknown>;
    stepWorkingState?: Record<string, unknown>;
  }) {
    return prisma.projectAuthoringSession.create({
      data: {
        conversationId: input.conversationId,
        learningProjectId: input.learningProjectId,
        ownerId: input.ownerId,
        stage: input.stage,
        status: input.status,
        baseProjectUpdatedAt: input.baseProjectUpdatedAt,
        completedStages: input.completedStages ?? [],
        componentWorkingState: input.componentWorkingState as Prisma.InputJsonValue | undefined,
        stepWorkingState: input.stepWorkingState as Prisma.InputJsonValue | undefined,
      },
      include: sessionInclude,
    });
  },

  async assertSessionVersion(sessionId: string, expectedVersion: number) {
    const session = await prisma.projectAuthoringSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    if (session.version !== expectedVersion) {
      throw new AppError(
        'This authoring session is out of date. Reload the workspace.',
        409,
        'AI_AUTHORING_SESSION_STALE',
      );
    }
    return session;
  },

  async supersedeCurrentTurn(input: {
    sessionId: string;
    expectedVersion: number;
    supersededTurnId: string;
    newTurn: Prisma.ProjectAuthoringTurnUncheckedCreateInput;
    sessionPatch?: Prisma.ProjectAuthoringSessionUncheckedUpdateInput;
  }): Promise<ProjectAuthoringSessionWithTurn> {
    return prisma.$transaction(async (tx) => {
      const session = await tx.projectAuthoringSession.findUniqueOrThrow({
        where: { id: input.sessionId },
      });
      if (session.version !== input.expectedVersion) {
        throw new AppError(
          'This authoring session is out of date. Reload the workspace.',
          409,
          'AI_AUTHORING_SESSION_STALE',
        );
      }
      if (session.currentTurnId !== input.supersededTurnId) {
        throw new AppError(
          'This proposal is no longer current.',
          409,
          'AI_AUTHORING_TURN_SUPERSEDED',
        );
      }
      const now = new Date();
      await tx.projectAuthoringTurn.update({
        where: { id: input.supersededTurnId },
        data: { status: 'SUPERSEDED', supersededAt: now },
      });
      const createdTurn = await tx.projectAuthoringTurn.create({
        data: input.newTurn,
      });
      return tx.projectAuthoringSession.update({
        where: { id: input.sessionId },
        data: {
          currentTurnId: createdTurn.id,
          version: session.version + 1,
          status: 'WAITING_FOR_USER',
          generationErrorCode: null,
          ...input.sessionPatch,
        },
        include: sessionInclude,
      });
    });
  },

  async setCurrentTurn(input: {
    sessionId: string;
    expectedVersion: number;
    turn: Prisma.ProjectAuthoringTurnUncheckedCreateInput;
    sessionPatch?: Prisma.ProjectAuthoringSessionUncheckedUpdateInput;
  }): Promise<ProjectAuthoringSessionWithTurn> {
    return prisma.$transaction(async (tx) => {
      const session = await tx.projectAuthoringSession.findUniqueOrThrow({
        where: { id: input.sessionId },
      });
      if (session.version !== input.expectedVersion) {
        throw new AppError(
          'This authoring session is out of date. Reload the workspace.',
          409,
          'AI_AUTHORING_SESSION_STALE',
        );
      }
      const createdTurn = await tx.projectAuthoringTurn.create({ data: input.turn });
      return tx.projectAuthoringSession.update({
        where: { id: input.sessionId },
        data: {
          currentTurnId: createdTurn.id,
          version: session.version + 1,
          ...input.sessionPatch,
        },
        include: sessionInclude,
      });
    });
  },

  async acceptCurrentTurn(input: {
    sessionId: string;
    expectedVersion: number;
    turnId: string;
    sessionPatch: Prisma.ProjectAuthoringSessionUncheckedUpdateInput;
  }): Promise<ProjectAuthoringSessionWithTurn> {
    return prisma.$transaction(async (tx) => {
      const session = await tx.projectAuthoringSession.findUniqueOrThrow({
        where: { id: input.sessionId },
        include: { currentTurn: true },
      });
      if (session.version !== input.expectedVersion) {
        throw new AppError(
          'This authoring session is out of date. Reload the workspace.',
          409,
          'AI_AUTHORING_SESSION_STALE',
        );
      }
      if (!session.currentTurnId || session.currentTurnId !== input.turnId) {
        throw new AppError(
          'This proposal is no longer current.',
          409,
          'AI_AUTHORING_TURN_SUPERSEDED',
        );
      }
      const turn = session.currentTurn;
      if (!turn || turn.status !== 'PROPOSED') {
        throw new AppError(
          'This proposal is no longer current.',
          409,
          'AI_AUTHORING_TURN_SUPERSEDED',
        );
      }
      const now = new Date();
      await tx.projectAuthoringTurn.update({
        where: { id: turn.id },
        data: { status: 'ACCEPTED' as ProjectAuthoringTurnStatus, acceptedAt: now },
      });
      return tx.projectAuthoringSession.update({
        where: { id: input.sessionId },
        data: {
          version: session.version + 1,
          ...input.sessionPatch,
        },
        include: sessionInclude,
      });
    });
  },

  async abandonCurrentTurn(input: {
    sessionId: string;
    expectedVersion: number;
    turnId: string;
    sessionPatch?: Prisma.ProjectAuthoringSessionUncheckedUpdateInput;
  }): Promise<ProjectAuthoringSessionWithTurn> {
    return prisma.$transaction(async (tx) => {
      const session = await tx.projectAuthoringSession.findUniqueOrThrow({
        where: { id: input.sessionId },
        include: { currentTurn: true },
      });
      if (session.version !== input.expectedVersion) {
        throw new AppError(
          'This authoring session is out of date. Reload the workspace.',
          409,
          'AI_AUTHORING_SESSION_STALE',
        );
      }
      if (!session.currentTurnId || session.currentTurnId !== input.turnId) {
        throw new AppError(
          'This proposal is no longer current.',
          409,
          'AI_AUTHORING_TURN_SUPERSEDED',
        );
      }
      const now = new Date();
      await tx.projectAuthoringTurn.update({
        where: { id: input.turnId },
        data: { status: 'SUPERSEDED' as ProjectAuthoringTurnStatus, supersededAt: now },
      });
      return tx.projectAuthoringSession.update({
        where: { id: input.sessionId },
        data: {
          currentTurnId: null,
          version: session.version + 1,
          ...input.sessionPatch,
        },
        include: sessionInclude,
      });
    });
  },

  async recordOverviewClarificationReady(input: {
    sessionId: string;
    expectedVersion: number;
    turn: Prisma.ProjectAuthoringTurnUncheckedCreateInput;
    sessionPatch?: Prisma.ProjectAuthoringSessionUncheckedUpdateInput;
  }): Promise<ProjectAuthoringSessionWithTurn> {
    return prisma.$transaction(async (tx) => {
      const session = await tx.projectAuthoringSession.findUniqueOrThrow({
        where: { id: input.sessionId },
      });
      if (session.version !== input.expectedVersion) {
        throw new AppError(
          'This authoring session is out of date. Reload the workspace.',
          409,
          'AI_AUTHORING_SESSION_STALE',
        );
      }
      await tx.projectAuthoringTurn.create({
        data: {
          ...input.turn,
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      });
      return tx.projectAuthoringSession.update({
        where: { id: input.sessionId },
        data: {
          currentTurnId: null,
          version: session.version + 1,
          status: 'WAITING_FOR_USER',
          generationErrorCode: null,
          ...input.sessionPatch,
        },
        include: sessionInclude,
      });
    });
  },

  async updateSession(input: {
    sessionId: string;
    expectedVersion: number;
    patch: Prisma.ProjectAuthoringSessionUncheckedUpdateInput;
  }): Promise<ProjectAuthoringSessionWithTurn> {
    return prisma.$transaction(async (tx) => {
      const session = await tx.projectAuthoringSession.findUniqueOrThrow({
        where: { id: input.sessionId },
      });
      if (session.version !== input.expectedVersion) {
        throw new AppError(
          'This authoring session is out of date. Reload the workspace.',
          409,
          'AI_AUTHORING_SESSION_STALE',
        );
      }
      return tx.projectAuthoringSession.update({
        where: { id: input.sessionId },
        data: {
          version: session.version + 1,
          ...input.patch,
        },
        include: sessionInclude,
      });
    });
  },
};
