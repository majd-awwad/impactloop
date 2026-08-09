import { randomUUID } from 'node:crypto';

import { COMMON_ERROR_CODES } from '../../contracts/errors/common-error-codes.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import {
  createDefaultNotebookDocument,
} from '../learner-builds/project-build-notebook.js';
import {
  NOTEBOOK_MAX_PAGES,
  notebookDocumentSchema,
  type NotebookDocument,
} from '../learner-builds/learner-build-notebook.validation.js';

import { INVALID_SESSION_STATE, PROJECT_HELP_SESSION_NOT_FOUND } from './project-help-session.service.js';
import { findLearnerProjectHelpSessionDetail } from './project-help-session.repository.js';

export const NOTEBOOK_PAGE_SOURCE_PROJECT_HELP_SESSION = 'PROJECT_HELP_SESSION';

type NotebookPageWithSource = NotebookDocument['pages'][number] & {
  source?: {
    type: typeof NOTEBOOK_PAGE_SOURCE_PROJECT_HELP_SESSION;
    id: string;
  };
};

export const findNotebookPageForHelpSession = (
  content: NotebookDocument,
  sessionId: string,
) =>
  content.pages.find((page) => {
    const source = (page as NotebookPageWithSource).source;
    return (
      source?.type === NOTEBOOK_PAGE_SOURCE_PROJECT_HELP_SESSION &&
      source.id === sessionId
    );
  });

const formatSessionDate = (startsAt: Date, timeZone: string, locale: 'ar' | 'en') => {
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone,
    }).format(startsAt);
  } catch {
    return startsAt.toISOString();
  }
};

export const buildHelpSessionNotebookPageTemplate = (input: {
  locale: 'ar' | 'en';
  projectTitle: string;
  projectStepTitle?: string | null;
  scheduledStartsAt?: Date | null;
  learnerTimeZone: string;
}) => {
  const contextLines: string[] = [];
  if (input.projectTitle.trim()) {
    contextLines.push(
      input.locale === 'ar'
        ? `المشروع: ${input.projectTitle.trim()}`
        : `Project: ${input.projectTitle.trim()}`,
    );
  }
  if (input.projectStepTitle?.trim()) {
    contextLines.push(
      input.locale === 'ar'
        ? `الخطوة: ${input.projectStepTitle.trim()}`
        : `Step: ${input.projectStepTitle.trim()}`,
    );
  }
  if (input.scheduledStartsAt) {
    contextLines.push(
      input.locale === 'ar'
        ? `موعد الجلسة: ${formatSessionDate(input.scheduledStartsAt, input.learnerTimeZone, input.locale)}`
        : `Session time: ${formatSessionDate(input.scheduledStartsAt, input.learnerTimeZone, input.locale)}`,
    );
  }

  const contextBlock =
    contextLines.length > 0 ? `${contextLines.join('\n')}\n\n` : '';

  if (input.locale === 'ar') {
    return `${contextBlock}ما تعلمته:\n-\n\nالخطوات التالية:\n-\n\nأسئلة أريد مراجعتها:\n-`;
  }

  return `${contextBlock}What I learned:\n-\n\nNext steps:\n-\n\nQuestions to revisit:\n-`;
};

const buildHelpSessionNotebookPageTitle = (
  locale: 'ar' | 'en',
  scheduledStartsAt: Date | null,
  learnerTimeZone: string,
) => {
  const base = locale === 'ar' ? 'ملاحظات جلسة المساعدة' : 'Help session notes';
  if (!scheduledStartsAt) {
    return base;
  }
  const dateLabel = formatSessionDate(scheduledStartsAt, learnerTimeZone, locale);
  return `${base} — ${dateLabel}`;
};

export const ensureProjectHelpSessionNotebookPage = async (input: {
  learnerId: string;
  sessionId: string;
  locale: 'ar' | 'en';
}) => {
  const session = await findLearnerProjectHelpSessionDetail(
    input.sessionId,
    input.learnerId,
  );
  if (!session) {
    throw new AppError('Help session not found.', 404, PROJECT_HELP_SESSION_NOT_FOUND);
  }
  if (session.status !== 'COMPLETED') {
    throw new AppError(
      'Help session is not in a valid state for this action.',
      409,
      INVALID_SESSION_STATE,
    );
  }

  const build = await prisma.projectBuild.findFirst({
    where: { id: session.buildId, learnerId: input.learnerId },
    select: {
      id: true,
      status: true,
      project: { select: { title: true } },
    },
  });
  if (!build || !['IN_PROGRESS', 'PAUSED', 'COMPLETED'].includes(build.status)) {
    throw new AppError('Help session not found.', 404, PROJECT_HELP_SESSION_NOT_FOUND);
  }
  if (build.status === 'ARCHIVED') {
    throw new AppError(
      'Archived notebooks are read-only.',
      409,
      'NOTEBOOK_READ_ONLY',
    );
  }

  return prisma.$transaction(async (tx) => {
    const existingNotebook = await tx.projectBuildNotebook.findUnique({
      where: { buildId: session.buildId },
      select: { content: true },
    });

    let content = (existingNotebook?.content ??
      createDefaultNotebookDocument()) as NotebookDocument;

    const existingPage = findNotebookPageForHelpSession(content, session.id);
    if (existingPage) {
      return { buildId: session.buildId, pageId: existingPage.id };
    }

    if (content.pages.length >= NOTEBOOK_MAX_PAGES) {
      throw new AppError('Notebook page limit reached.', 409, 'NOTEBOOK_PAGE_LIMIT');
    }

    const now = new Date().toISOString();
    const scheduledStartsAt = session.selectedTimeOption?.startsAt ?? null;
    const page: NotebookPageWithSource = {
      id: randomUUID(),
      title: buildHelpSessionNotebookPageTitle(
        input.locale,
        scheduledStartsAt,
        session.learnerTimeZone,
      ),
      text: buildHelpSessionNotebookPageTemplate({
        locale: input.locale,
        projectTitle: session.project.title,
        projectStepTitle: session.projectStep?.title ?? null,
        scheduledStartsAt,
        learnerTimeZone: session.learnerTimeZone,
      }),
      strokes: [],
      createdAt: now,
      updatedAt: now,
      source: {
        type: NOTEBOOK_PAGE_SOURCE_PROJECT_HELP_SESSION,
        id: session.id,
      },
    };

    content = {
      ...content,
      pages: [...content.pages, page],
    };

    const parsed = notebookDocumentSchema.safeParse(content);
    if (!parsed.success) {
      throw new AppError(
        'Invalid notebook document.',
        400,
        COMMON_ERROR_CODES.validationError,
      );
    }

    if (existingNotebook) {
      await tx.projectBuildNotebook.update({
        where: { buildId: session.buildId },
        data: { content: parsed.data },
      });
    } else {
      await tx.projectBuildNotebook.create({
        data: {
          buildId: session.buildId,
          content: parsed.data,
        },
      });
    }

    return { buildId: session.buildId, pageId: page.id };
  });
};
