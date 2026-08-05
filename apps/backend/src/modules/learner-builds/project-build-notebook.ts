import { randomUUID } from 'node:crypto';

import type { ProjectBuildStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';

import type { NotebookDocument } from './learner-build-notebook.validation.js';

const READABLE_BUILD_STATUSES: ProjectBuildStatus[] = [
  'IN_PROGRESS',
  'PAUSED',
  'COMPLETED',
  'ARCHIVED',
];

const EDITABLE_BUILD_STATUSES: ProjectBuildStatus[] = [
  'IN_PROGRESS',
  'PAUSED',
  'COMPLETED',
];

export const createDefaultNotebookPage = (title = 'Page 1') => {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    title,
    text: '',
    strokes: [] as NotebookDocument['pages'][number]['strokes'],
    createdAt: now,
    updatedAt: now,
  };
};

export const createDefaultNotebookDocument = (
  defaultPageTitle = 'Page 1',
): NotebookDocument => ({
  schemaVersion: 1,
  pages: [createDefaultNotebookPage(defaultPageTitle)],
});

const assertOwnedReadableBuild = async (buildId: string, learnerId: string) => {
  const build = await prisma.projectBuild.findFirst({
    where: { id: buildId, learnerId },
    select: {
      id: true,
      status: true,
      attemptNumber: true,
      project: {
        select: {
          title: true,
        },
      },
    },
  });

  if (!build) {
    throw new AppError('Project build not found.', 404, 'BUILD_NOT_FOUND');
  }

  if (!READABLE_BUILD_STATUSES.includes(build.status)) {
    throw new AppError('Project build not found.', 404, 'BUILD_NOT_FOUND');
  }

  return build;
};

const assertOwnedEditableBuild = async (buildId: string, learnerId: string) => {
  const build = await assertOwnedReadableBuild(buildId, learnerId);

  if (!EDITABLE_BUILD_STATUSES.includes(build.status)) {
    throw new AppError(
      'Archived notebooks are read-only.',
      409,
      'NOTEBOOK_READ_ONLY',
    );
  }

  return build;
};

export const isNotebookEditableForStatus = (status: ProjectBuildStatus) =>
  EDITABLE_BUILD_STATUSES.includes(status);

export const getProjectBuildNotebook = async (
  buildId: string,
  learnerId: string,
) => {
  const build = await assertOwnedReadableBuild(buildId, learnerId);

  const notebook = await prisma.projectBuildNotebook.findUnique({
    where: { buildId },
    select: {
      content: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!notebook) {
    return {
      buildId,
      buildStatus: build.status,
      attemptNumber: build.attemptNumber,
      projectTitle: build.project.title,
      readOnly: !isNotebookEditableForStatus(build.status),
      persisted: false,
      content: createDefaultNotebookDocument(),
      createdAt: null,
      updatedAt: null,
    };
  }

  return {
    buildId,
    buildStatus: build.status,
    attemptNumber: build.attemptNumber,
    projectTitle: build.project.title,
    readOnly: !isNotebookEditableForStatus(build.status),
    persisted: true,
    content: notebook.content as NotebookDocument,
    createdAt: notebook.createdAt.toISOString(),
    updatedAt: notebook.updatedAt.toISOString(),
  };
};

export const upsertProjectBuildNotebook = async (
  buildId: string,
  learnerId: string,
  content: NotebookDocument,
) => {
  await assertOwnedEditableBuild(buildId, learnerId);

  const saved = await prisma.$transaction(async (tx) => {
    const existing = await tx.projectBuildNotebook.findUnique({
      where: { buildId },
      select: { id: true },
    });

    if (existing) {
      return tx.projectBuildNotebook.update({
        where: { buildId },
        data: { content },
        select: {
          content: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    return tx.projectBuildNotebook.create({
      data: {
        buildId,
        content,
      },
      select: {
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  const build = await prisma.projectBuild.findFirstOrThrow({
    where: { id: buildId, learnerId },
    select: {
      status: true,
      attemptNumber: true,
      project: {
        select: {
          title: true,
        },
      },
    },
  });

  return {
    buildId,
    buildStatus: build.status,
    attemptNumber: build.attemptNumber,
    projectTitle: build.project.title,
    readOnly: !isNotebookEditableForStatus(build.status),
    persisted: true,
    content: saved.content as NotebookDocument,
    createdAt: saved.createdAt.toISOString(),
    updatedAt: saved.updatedAt.toISOString(),
  };
};
