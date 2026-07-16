export type AiExternalKnowledgeResult = {
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
  snippet: string | null;
};

export type AiExternalKnowledgeSearchInput = {
  query: string;
  locale: 'en' | 'ar';
  maxResults: number;
  requestId: string | null;
};

export type AiExternalKnowledgeSearchOutput = {
  results: AiExternalKnowledgeResult[];
  provider: string;
  latencyMs: number;
};

export interface AiExternalKnowledgeProvider {
  search(
    input: AiExternalKnowledgeSearchInput,
  ): Promise<AiExternalKnowledgeSearchOutput>;
}
