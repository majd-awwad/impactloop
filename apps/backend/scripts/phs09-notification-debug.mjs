import { prisma } from '../src/database/prisma.js';

const sessionId = 'cmshfxe490000q8vgcy58ce27';
const notification = await prisma.notification.findFirst({
  where: {
    notificationType: 'PROJECT_HELP_SESSION_REQUESTED',
    OR: [
      { relatedEntityId: sessionId },
      { metadata: { path: ['sessionId'], equals: sessionId } },
    ],
  },
  orderBy: { createdAt: 'desc' },
});
const user = await prisma.user.findFirst({
  where: { email: 'majd@learner.com' },
  select: { id: true, email: true },
});
console.log(JSON.stringify({ user, notification }, null, 2));
await prisma.$disconnect();
