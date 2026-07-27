import type {
  AiExternalKnowledgeProvider,
  AiExternalKnowledgeSearchInput,
  AiExternalKnowledgeSearchOutput,
} from './ai-external-knowledge.types.js';

export class MockExternalKnowledgeProvider implements AiExternalKnowledgeProvider {
  async search(
    input: AiExternalKnowledgeSearchInput,
  ): Promise<AiExternalKnowledgeSearchOutput> {
    return {
      provider: 'mock',
      latencyMs: 1,
      results: [
        {
          title: 'Arduino Uno documentation',
          url: 'https://docs.arduino.cc/hardware/uno-rev3',
          source: 'docs.arduino.cc',
          publishedAt: null,
          snippet: 'Official Arduino Uno hardware documentation and pinout reference.',
        },
        {
          title: 'Wire library reference',
          url: 'https://www.arduino.cc/reference/en/language/functions/communication/wire/',
          source: 'arduino.cc',
          publishedAt: null,
          snippet: 'I2C communication library reference for Arduino boards.',
        },
      ].slice(0, input.maxResults),
    };
  }
}
