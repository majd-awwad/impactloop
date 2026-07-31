import { hashPassword } from '../src/utils/password.js';
import { prisma } from '../src/database/prisma.js';
import { signAccessToken } from '../src/utils/jwt.js';
import {
  getAiChatDebugInfo,
  getResolvedAiChatModel,
  resolveAiChatProvider,
} from '../src/config/env.ts';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:4000';
const VERIFY_EMAIL =
  process.env.VERIFY_LEARNER_EMAIL ??
  `arduino-http-verify-${Date.now()}@impactloop.test`;
const VERIFY_PASSWORD = process.env.VERIFY_LEARNER_PASSWORD ?? 'TestPassword123!';

console.log(
  JSON.stringify(
    {
      resolvedChatProvider: resolveAiChatProvider(),
      aiChatModel: getResolvedAiChatModel(),
      debug: getAiChatDebugInfo(),
    },
    null,
    2,
  ),
);

let token = null;
const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-client-platform': 'mobile',
  },
  body: JSON.stringify({ email: VERIFY_EMAIL, password: VERIFY_PASSWORD }),
});

const loginJson = await loginResponse.json();
if (loginResponse.ok) {
  token = loginJson.data?.tokens?.accessToken ?? null;
}

if (!token) {
  const passwordHash = await hashPassword(VERIFY_PASSWORD);
  const user = await prisma.user.create({
    data: {
      displayName: 'Arduino HTTP Verify Learner',
      email: VERIFY_EMAIL,
      passwordHash,
      accountStatus: 'ACTIVE',
      roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
      learnerProfile: { create: { interests: ['arduino'] } },
    },
  });
  token = signAccessToken({ sub: user.id, roles: ['LEARNER'] });
}

const createConversationResponse = await fetch(`${API_BASE}/api/ai/v1/conversations`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ mode: 'GENERAL_LEARNING', locale: 'en' }),
});

const createConversationJson = await createConversationResponse.json();
if (!createConversationResponse.ok) {
  console.error('Conversation create failed', createConversationResponse.status, createConversationJson);
  process.exit(1);
}

const conversationId = createConversationJson.data?.id;
const clientMessageId = `arduino-http-verify-${Date.now()}`;

const response = await fetch(
  `${API_BASE}/api/ai/v1/conversations/${conversationId}/messages`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      text: 'Explain Arduino Uno simply',
      locale: 'en',
      clientMessageId,
    }),
  },
);

const json = await response.json();
const firstTextBlock = (json.data?.contentBlocks ?? []).find(
  (block) => block?.type === 'text',
);

const result = {
  status: response.status,
  errorCode: json.error?.code ?? null,
  provider: json.data?.meta?.provider ?? null,
  model: json.data?.meta?.model ?? null,
  scopeClassification: json.data?.meta?.scopeClassification ?? null,
  textPreview:
    typeof firstTextBlock?.text === 'string'
      ? firstTextBlock.text.slice(0, 200)
      : null,
  assistantMessageId: json.data?.assistantMessageId ?? null,
};

console.log(JSON.stringify({ conversationId, result }, null, 2));

const succeeded =
  result.status === 201 &&
  result.provider === 'gemini' &&
  result.model === 'gemini-3.1-flash-lite' &&
  Boolean(result.textPreview);

if (!succeeded) {
  process.exitCode = 1;
}

await prisma.$disconnect();
