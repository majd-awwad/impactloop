import type {
  AiExternalKnowledgeProvider,
  AiExternalKnowledgeSearchInput,
  AiExternalKnowledgeSearchOutput,
} from './ai-external-knowledge.types.js';
import { scoreExternalSourceProvenance } from '../external-source-provenance.js';

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
          snippet: 'Arduino Uno hardware documentation and pinout reference.',
          provenance: scoreExternalSourceProvenance('https://docs.arduino.cc/hardware/uno-rev3'),
        },
        {
          title: 'Wire library reference',
          url: 'https://www.arduino.cc/reference/en/language/functions/communication/wire/',
          source: 'arduino.cc',
          publishedAt: null,
          snippet: 'I2C communication library reference for Arduino boards.',
          provenance: scoreExternalSourceProvenance(
            'https://www.arduino.cc/reference/en/language/functions/communication/wire/',
          ),
        },
      ].slice(0, input.maxResults),
    };
  }
}
