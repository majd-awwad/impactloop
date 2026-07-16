import {
  getConfiguredGeminiApiKey,
  getGeminiApiKeyFingerprint,
  getGeminiApiKeyLast4,
} from './env.js';
import { getAiChatProvider } from '../modules/ai/providers/ai-chat-provider.factory.js';

const inheritedKey = process.env.GEMINI_API_KEY ?? '';
const loadedKey = getConfiguredGeminiApiKey() ?? '';
const provider = getAiChatProvider();

const payload = {
  loadedKeyLast4: getGeminiApiKeyLast4(),
  fingerprint: getGeminiApiKeyFingerprint(),
  providerName: provider.name,
  usesMockWrapper: provider.name.includes('mock'),
  stdoutContainsFullInheritedKey: false,
  stdoutContainsFullFileKey: false,
};

const serialized = JSON.stringify(payload);
payload.stdoutContainsFullInheritedKey =
  inheritedKey.length > 0 && serialized.includes(inheritedKey);
payload.stdoutContainsFullFileKey =
  loadedKey.length > 0 && serialized.includes(loadedKey);

process.stdout.write(JSON.stringify(payload));
