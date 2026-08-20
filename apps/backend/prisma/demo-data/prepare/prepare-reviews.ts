import { prisma } from '../../../src/database/prisma.js';
import { env } from '../../../src/config/env.js';
import { assertLocalDemoDatabaseUrl } from '../../../scripts/lib/local-database-guard.mjs';
import { ISRAA_LEARNER_EMAIL, MAJD_LEARNER_EMAIL, redact } from './local-demo-accounts.js';

export const REVIEW_DEMO_PREFERRED_TITLES = [
  'Mini Wooden Phone Stand',
  'Recycled Cardboard Desk Organizer',
  'PVC Plant Stand',
  'Small Reclaimed Wood Wall Shelf',
  'Mini Greenhouse Prototype',
] as const;

export const REVIEW_COMMENT =
  'التعليمات واضحة والخطوات مرتبة. خلّصت المشروع من أول محاولة، والمواد المطلوبة كانت موجودة بسهولة.';
export const ROOT_COMMENT =
  'هل في نصيحة للخطوة اللي تحتاج قياس دقيق؟ أول مرة بشتغل على هالمشروع وبدي أتأكد قبل القص.';
export const REPLY_ONE =
  'خذي وقتك بالقياس وجرّبي التركيب الجاف قبل التثبيت النهائي. خطأ بسيط ما بيهدّ الشغل إذا ثبّتي الزوايا أول.';
export const REPLY_TWO = 'تمام، رح أجرّب التركيب الجاف اليوم. شكراً على التوضيح!';

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60_000);

export const isReviewThreadComplete = (input: {
  reviewRating: number | null;
  commentCount: number;
}) => input.reviewRating === 5 && input.commentCount === 3;

export async function prepareReviewDemo() {
  assertLocalDemoDatabaseUrl(env.databaseUrl, 'figure 3.39 demo prep');

  const [majd, israa] = await Promise.all([
    prisma.user.findUnique({
      where: { email: MAJD_LEARNER_EMAIL },
      select: { id: true, displayName: true, email: true },
    }),
    prisma.user.findUnique({
      where: { email: ISRAA_LEARNER_EMAIL },
      select: { id: true, displayName: true, email: true },
    }),
  ]);

  if (!majd) {
    throw new Error(`Majd Learner (${MAJD_LEARNER_EMAIL}) was not found.`);
  }
  if (!israa) {
    throw new Error(`Israa Learner (${ISRAA_LEARNER_EMAIL}) was not found.`);
  }

  const publicWhere = {
    status: 'PUBLISHED' as const,
    hiddenAt: null,
    archivedAt: null,
    createdBy: { notIn: [majd.id, israa.id] },
  };

  const preferred = await prisma.learningProject.findMany({
    where: { ...publicWhere, title: { in: [...REVIEW_DEMO_PREFERRED_TITLES] } },
    select: {
      id: true,
      title: true,
      createdBy: true,
      createdByUser: { select: { displayName: true, email: true } },
      _count: { select: { comments: true, userReviews: true } },
    },
  });

  preferred.sort((a, b) => {
    const rank = (title: string) => {
      const index = (REVIEW_DEMO_PREFERRED_TITLES as readonly string[]).indexOf(title);
      return index === -1 ? REVIEW_DEMO_PREFERRED_TITLES.length : index;
    };
    const rankDelta = rank(a.title) - rank(b.title);
    if (rankDelta !== 0) {
      return rankDelta;
    }
    return a._count.comments - b._count.comments;
  });

  let project = preferred[0];
  if (!project) {
    const fallback = await prisma.learningProject.findFirst({
      where: publicWhere,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        title: true,
        createdBy: true,
        createdByUser: { select: { displayName: true, email: true } },
        _count: { select: { comments: true, userReviews: true } },
      },
    });
    if (!fallback) {
      throw new Error(
        'No published public project was found that is owned by neither Majd nor Israa.',
      );
    }
    project = fallback;
  }

  const review = await prisma.projectUserReview.upsert({
    where: {
      projectId_userId: {
        projectId: project.id,
        userId: majd.id,
      },
    },
    create: {
      projectId: project.id,
      userId: majd.id,
      rating: 5,
      comment: REVIEW_COMMENT,
      createdAt: hoursAgo(36),
    },
    update: {
      rating: 5,
      comment: REVIEW_COMMENT,
    },
    select: {
      id: true,
      rating: true,
      comment: true,
      user: { select: { displayName: true, email: true } },
    },
  });

  let root = await prisma.comment.findFirst({
    where: {
      learningProjectId: project.id,
      authorId: israa.id,
      parentCommentId: null,
      rootCommentId: null,
      status: 'VISIBLE',
      body: ROOT_COMMENT,
    },
    select: { id: true, body: true, createdAt: true },
  });

  if (!root) {
    root = await prisma.comment.create({
      data: {
        authorId: israa.id,
        learningProjectId: project.id,
        body: ROOT_COMMENT,
        status: 'VISIBLE',
        createdAt: hoursAgo(20),
      },
      select: { id: true, body: true, createdAt: true },
    });
  }

  let replyOne = await prisma.comment.findFirst({
    where: {
      learningProjectId: project.id,
      authorId: majd.id,
      rootCommentId: root.id,
      status: 'VISIBLE',
      body: REPLY_ONE,
    },
    select: { id: true, body: true },
  });

  if (!replyOne) {
    replyOne = await prisma.comment.create({
      data: {
        authorId: majd.id,
        learningProjectId: project.id,
        parentCommentId: root.id,
        rootCommentId: root.id,
        replyToCommentId: root.id,
        body: REPLY_ONE,
        status: 'VISIBLE',
        createdAt: hoursAgo(8),
      },
      select: { id: true, body: true },
    });
  }

  let replyTwo = await prisma.comment.findFirst({
    where: {
      learningProjectId: project.id,
      authorId: israa.id,
      rootCommentId: root.id,
      status: 'VISIBLE',
      body: REPLY_TWO,
    },
    select: { id: true, body: true },
  });

  if (!replyTwo) {
    replyTwo = await prisma.comment.create({
      data: {
        authorId: israa.id,
        learningProjectId: project.id,
        parentCommentId: root.id,
        rootCommentId: root.id,
        replyToCommentId: replyOne.id,
        body: REPLY_TWO,
        status: 'VISIBLE',
        createdAt: hoursAgo(3),
      },
      select: { id: true, body: true },
    });
  }

  const verifiedReview = await prisma.projectUserReview.findUnique({
    where: {
      projectId_userId: { projectId: project.id, userId: majd.id },
    },
    select: {
      id: true,
      rating: true,
      comment: true,
      user: { select: { displayName: true, email: true } },
      project: { select: { title: true } },
    },
  });

  const verifiedThread = await prisma.comment.findMany({
    where: {
      learningProjectId: project.id,
      id: { in: [root.id, replyOne.id, replyTwo.id] },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      body: true,
      parentCommentId: true,
      rootCommentId: true,
      replyToCommentId: true,
      status: true,
      author: { select: { displayName: true, email: true } },
    },
  });

  if (!isReviewThreadComplete({
    reviewRating: verifiedReview?.rating ?? null,
    commentCount: verifiedThread.length,
  })) {
    throw new Error(
      `Verification failed: expected a 5-star review and 3 comments, found rating=${verifiedReview?.rating ?? 'none'} comments=${verifiedThread.length}.`,
    );
  }

  console.log('Figure 3.39 local demo data is ready.');
  console.log(`Project: ${project.title}`);
  console.log(`Project id: ${redact(project.id)}`);
  console.log(
    `Owner: ${project.createdByUser.displayName} <${project.createdByUser.email}>`,
  );
  console.log(
    `Review: ${verifiedReview!.rating}★ by ${verifiedReview!.user.displayName} <${verifiedReview!.user.email}>`,
  );
  console.log('Comment thread:');
  for (const row of verifiedThread) {
    const kind = row.parentCommentId ? 'reply' : 'comment';
    console.log(
      `  [${kind}] ${row.author.displayName} <${row.author.email}>: ${row.body}`,
    );
  }

  return {
    projectId: project.id,
    reviewId: review.id,
    commentIds: verifiedThread.map((row) => row.id),
  };
}
