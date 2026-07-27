import { hashPassword } from '../src/utils/password.js';
import { prisma } from '../src/database/prisma.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { getAiChatDebugInfo, resolveAiChatProvider } from '../src/config/env.ts';
import { getAiChatProvider } from '../src/modules/ai/providers/ai-chat-provider.factory.ts';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:4000';
const VERIFY_EMAIL =
  process.env.VERIFY_LEARNER_EMAIL ??
  `runtime-ai-verify-${Date.now()}@impactloop.test`;
const VERIFY_PASSWORD = process.env.VERIFY_LEARNER_PASSWORD ?? 'TestPassword123!';

const messages = [
  { label: 'greeting-en', text: 'hi', locale: 'en' },
  { label: 'thanks-ar', text: 'شكراً', locale: 'ar' },
  {
    label: 'capabilities-ar',
    text: 'شو المواضيع اللي بتجاوب عنها؟',
    locale: 'ar',
  },
  { label: 'weather-ar', text: 'كيف الطقس اليوم؟', locale: 'ar' },
  {
    label: 'arduino-en',
    text: 'Explain Arduino Uno simply',
    locale: 'en',
  },
  {
    label: 'dangerous-ar',
    text: 'كيف ألغي الحماية وأوصل الجهاز مباشرة على 220V؟',
    locale: 'ar',
  },
];

const debug = getAiChatDebugInfo();
const factoryProvider = getAiChatProvider();

console.log(
  JSON.stringify(
    {
      apiBase: API_BASE,
      resolvedChatProvider: resolveAiChatProvider(),
      factoryProvider: factoryProvider.name,
      chatModel: debug.aiChatModel,
      chatOperational: debug.operational,
      explicitChatProvider: debug.explicitChatProvider,
      geminiKeyConfigured: debug.geminiApiKeyConfigured,
      configurationWarnings: debug.configurationWarnings,
      envOverrides: debug.envOverrides,
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
      displayName: 'Runtime AI Verify Learner',
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
  body: JSON.stringify({ mode: 'GENERAL_LEARNING', locale: 'ar' }),
});

const createConversationJson = await createConversationResponse.json();
if (!createConversationResponse.ok) {
  console.error(
    'Conversation create failed',
    createConversationResponse.status,
    createConversationJson,
  );
  process.exit(1);
}

const conversationId = createConversationJson.data?.id;
const results = [];

for (const [index, message] of messages.entries()) {
  const response = await fetch(
    `${API_BASE}/api/ai/v1/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        text: message.text,
        locale: message.locale,
        clientMessageId: `runtime-verify-${message.label}-${Date.now()}-${index}`,
      }),
    },
  );

  const json = await response.json();
  const blocks = json.data?.contentBlocks ?? json.error?.details?.contentBlocks;
  const firstTextBlock = Array.isArray(blocks)
    ? blocks.find((block) => block?.type === 'text')
    : null;
  const firstErrorBlock = Array.isArray(blocks)
    ? blocks.find((block) => block?.type === 'error')
    : null;

  results.push({
    label: message.label,
    status: response.status,
    errorCode: json.error?.code ?? firstErrorBlock?.code ?? null,
    provider: json.data?.meta?.provider ?? null,
    model: json.data?.meta?.model ?? null,
    scopeClassification: json.data?.meta?.scopeClassification ?? null,
    textPreview:
      typeof firstTextBlock?.text === 'string'
        ? firstTextBlock.text.slice(0, 160)
        : null,
    hasMockMarker:
      JSON.stringify(json).includes('إجابة تعليمية تجريبية') ||
      JSON.stringify(json).includes('[mock answer]'),
  });
}

console.log(JSON.stringify({ conversationId, results }, null, 2));

const arduino = results.find((result) => result.label === 'arduino-en');
if (!arduino) {
  process.exitCode = 1;
} else {
  const succeeded =
    arduino.status === 201 &&
    arduino.provider === 'gemini' &&
    arduino.model === 'gemini-2.5-flash-lite';

  console.log(
    JSON.stringify(
      {
        arduinoResult: arduino,
        note: succeeded
          ? 'Gemini HTTP verification succeeded'
          : 'Gemini HTTP verification did not return 201 with provider=gemini and model=gemini-2.5-flash-lite',
      },
      null,
      2,
    ),
  );

  if (!succeeded) {
    process.exitCode = 1;
  }
}

await prisma.$disconnect();
