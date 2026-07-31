import { prisma } from '../src/database/prisma.ts';

const conversation = await prisma.aiConversation.findFirst({
  where: { processingState: { not: undefined } },
  orderBy: { updatedAt: 'desc' },
  select: {
    id: true,
    processingState: true,
    processingStartedAt: true,
  },
});

if (!conversation) {
  console.log(JSON.stringify({ conversation: null, messages: [] }, null, 2));
} else {
  const messages = await prisma.aiMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' },
    select: {
      role: true,
      status: true,
      provider: true,
      errorCode: true,
      scopeClassification: true,
    },
  });

  console.log(JSON.stringify({ conversation, messages }, null, 2));
}

await prisma.$disconnect();
