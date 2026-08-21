import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { afterEach, before, describe, test } from 'node:test';

import {
  resetLoggerForTests,
  setLoggerDestinationForTests,
} from '../../observability/logger.js';
import { AppError } from '../../utils/app-error.js';
import {
  formatAuthoringProviderSchemaRepairIssue,
  getLastAuthoringValidationDiagnosticForTests,
  resetAuthoringValidationDiagnosticForTests,
} from './ai-project-authoring-clarification.shared.js';
import {
  buildAuthoringClarificationPrompt,
  generateRealAuthoringComponentList,
  generateRealAuthoringScalarProposal,
  generateRealAuthoringClarification,
  setAuthoringOpenAiClientFactoryForTests,
} from './ai-project-authoring-real.provider.js';

const validClarificationResponse = JSON.stringify({
  clarification: {
    type: 'project_authoring_clarification',
    status: 'READY_FOR_PROPOSAL',
    summary: 'The project has enough detail to prepare a proposal.',
    knownFacts: [],
    nextQuestion: null,
    remainingTopics: 0,
    assumptions: [],
    warnings: [],
  },
  assistantText: 'Your project is ready for a proposal.',
});

const validClarification = {
  type: 'project_authoring_clarification',
  status: 'NEEDS_CLARIFICATION',
  summary: 'The project needs one clarification.',
  knownFacts: [],
  nextQuestion: {
    key: 'target_user',
    prompt: 'Who will use the phone stand?',
    answerType: 'SINGLE_CHOICE',
    options: ['A student', 'A family member'],
  },
  remainingTopics: 2,
  assumptions: [],
  warnings: [],
};

const providerPayload = (
  clarification: Record<string, unknown>,
  assistantText: string | null = 'Please answer this question.',
) => JSON.stringify({
  clarification,
  ...(assistantText === null ? {} : { assistantText }),
});

const input = {
  locale: 'en' as const,
  ideaText: 'A beginner cardboard phone stand.',
  projectTitle: null,
  projectShortDescription: null,
  projectDescription: null,
  categoryName: null,
  difficulty: 'BEGINNER',
  componentNames: [],
  stepTitles: [],
  answeredQuestionKeys: [],
  answeredQuestionCount: 0,
  currentAnswer: null,
  latestClarification: null,
  repairAttempt: false,
};

const scalarInput = (
  stage: 'TITLE' | 'SHORT_DESCRIPTION' | 'FULL_DESCRIPTION' | 'DIFFICULTY' | 'ESTIMATED_DURATION' = 'TITLE',
) => ({
  locale: 'en' as const,
  projectId: 'project-scalar-test',
  stage,
  canonicalProject: {
    title: 'Cardboard phone stand',
    shortDescription: 'A simple recycled cardboard phone stand.',
    description: 'A beginner project that makes a sturdy phone stand from cardboard.',
    difficulty: 'BEGINNER',
    estimatedMinutes: 45,
  },
  currentProposal: {
    value: stage === 'TITLE'
      ? 'Untitled project'
      : stage === 'DIFFICULTY'
        ? 'BEGINNER'
        : stage === 'ESTIMATED_DURATION'
          ? 45
          : 'A simple cardboard phone stand.',
  },
  learnerFeedback: '',
  projectConstraints: ['Use recycled cardboard.', 'Suitable for a beginner.'],
  clarificationContext: ['The learner wants a stable stand for a desk.'],
  suggestAnother: false,
  repairAttempt: false,
});

const componentInput = {
  locale: 'en' as const,
  projectId: 'project-component-test',
  ideaText: 'Build a beginner cardboard phone stand.',
  projectTitle: 'Cardboard phone stand',
  projectShortDescription: 'A simple recycled cardboard phone stand.',
  projectDescription: 'A beginner project that makes a sturdy phone stand from cardboard.',
  difficulty: 'BEGINNER',
  durationMinutes: 45,
  learnerConstraints: ['Use recycled cardboard.', 'Suitable for a beginner.'],
  recentMessages: [],
  clarification: validClarification,
  repairAttempt: false,
};

const validComponentResponse = JSON.stringify({
  kind: 'COMPONENT_LIST',
  components: [
    {
      name: 'Recycled cardboard sheet',
      quantity: 1,
      unit: 'sheet',
      role: 'MATERIAL',
      required: true,
      notes: 'Forms the main structure of the phone stand.',
    },
  ],
  explanation: 'This compact list contains the material needed for the stand.',
});

const snapshotEnv = () => ({ ...process.env });
let savedEnv = snapshotEnv();

const setOpenRouterEnv = () => {
  process.env.AI_CHAT_PROVIDER = 'openai';
  process.env.OPENAI_API_KEY = 'sk-or-test-openrouter-key-1234567890';
  process.env.OPENAI_BASE_URL = 'https://openrouter.ai/api/v1';
  process.env.AI_CHAT_MODEL = 'google/gemma-4-26b-a4b-it:free';
  process.env.OPENAI_JSON_MODE = 'false';
};

const providerResponse = (content: string) => ({
  model: 'google/gemma-4-26b-a4b-it:free',
  choices: [{ message: { content } }],
  usage: { prompt_tokens: 10, completion_tokens: 20 },
});

describe('real authoring OpenAI-compatible provider', () => {
  before(async () => {
    const { setResolvedAiChatProviderForTests } = await import('../../config/env.js');
    setResolvedAiChatProviderForTests(null);
  });

  afterEach(async () => {
    for (const key of Object.keys(process.env)) {
      if (!(key in savedEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, savedEnv);
    savedEnv = snapshotEnv();
    setAuthoringOpenAiClientFactoryForTests(null);
    resetAuthoringValidationDiagnosticForTests();
    setLoggerDestinationForTests(null);
    resetLoggerForTests();
    const { setResolvedAiChatProviderForTests } = await import('../../config/env.js');
    setResolvedAiChatProviderForTests(null);
  });

  test('uses an OpenRouter-compatible request and extracts fenced JSON with harmless prose', async () => {
    setOpenRouterEnv();
    let capturedRequest: Record<string, unknown> | null = null;
    setAuthoringOpenAiClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async (request) => {
            capturedRequest = request as Record<string, unknown>;
            return providerResponse(
              `Here is the structured result:\n\`\`\`json\n${validClarificationResponse}\n\`\`\`\nUse it as requested.`,
            ) as never;
          },
        },
      },
    }));

    const result = await generateRealAuthoringClarification(input, 'openai');

    assert.equal(result.model, 'google/gemma-4-26b-a4b-it:free');
    assert.equal(result.data.clarification.status, 'READY_FOR_PROPOSAL');
    assert.equal(capturedRequest?.model, 'google/gemma-4-26b-a4b-it:free');
    assert.equal(capturedRequest?.response_format, undefined);
    assert.equal(capturedRequest?.temperature, 0.2);
    assert.ok(Array.isArray(capturedRequest?.messages));
  });

  test('still rejects malformed assistant JSON', async () => {
    setOpenRouterEnv();
    setAuthoringOpenAiClientFactoryForTests(() => ({
      chat: { completions: { create: async () => providerResponse('{"clarification":') as never } },
    }));

    await assert.rejects(
      () => generateRealAuthoringClarification(input, 'openai'),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'AI_RESPONSE_INVALID');
        return true;
      },
    );
  });

  test('validates component output against the canonical schema and logs the exact invalid path', async () => {
    setOpenRouterEnv();
    process.env.NODE_ENV = 'development';
    const lines: string[] = [];
    const stream = new PassThrough();
    stream.on('data', (chunk) => lines.push(chunk.toString()));
    setLoggerDestinationForTests(stream);
    resetLoggerForTests();
    setAuthoringOpenAiClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async () => providerResponse(JSON.stringify({
            ...JSON.parse(validComponentResponse),
            components: [{
              name: 'Recycled cardboard sheet',
              quantity: 'one',
              unit: 'sheet',
              role: 'MATERIAL',
              required: true,
              notes: 'Forms the main structure of the phone stand.',
            }],
          })) as never,
        },
      },
    }));

    await assert.rejects(
      () => generateRealAuthoringComponentList(componentInput, 'openai'),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'AI_RESPONSE_INVALID');
        const issues = (error.details as { providerSchemaIssues?: Array<Record<string, unknown>> })
          .providerSchemaIssues;
        assert.deepEqual(issues?.find((issue) => issue.path === 'components.0.quantity'), {
          path: 'components.0.quantity',
          expected: 'number',
          received: 'string',
          code: 'invalid_type',
        });
        return true;
      },
    );

    const diagnostics = lines.join('');
    assert.match(diagnostics, /"operation":"component_generation"/);
    assert.match(diagnostics, /"responseFailure":"SCHEMA_VALIDATION"/);
    assert.match(diagnostics, /components\.0\.quantity/);
  });

  test('uses strict structured output for the canonical component schema when supported', async () => {
    setOpenRouterEnv();
    process.env.AI_CHAT_MODEL = 'openai/gpt-4.1-nano';
    let capturedRequest: Record<string, unknown> | null = null;
    setAuthoringOpenAiClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async (request) => {
            capturedRequest = request as Record<string, unknown>;
            return {
              ...providerResponse(validComponentResponse),
              model: 'openai/gpt-4.1-nano',
            } as never;
          },
        },
      },
    }));

    const result = await generateRealAuthoringComponentList(componentInput, 'openai');

    assert.equal(result.data.components[0]?.componentName, 'Recycled cardboard sheet');
    const responseFormat = capturedRequest?.response_format as {
      type?: string;
      json_schema?: { name?: string; strict?: boolean };
    };
    assert.equal(responseFormat.type, 'json_schema');
    assert.equal(responseFormat.json_schema?.name, 'impactloop_authoring_component_list');
    assert.equal(responseFormat.json_schema?.strict, true);
  });

  test('rejects nextQuestion serialized as a string and records its exact schema issue', async () => {
    setOpenRouterEnv();
    resetAuthoringValidationDiagnosticForTests();
    setAuthoringOpenAiClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async () => providerResponse(providerPayload({
            ...validClarification,
            nextQuestion: "{ key: 'target_user' } | null",
          })) as never,
        },
      },
    }));

    await assert.rejects(
      () => generateRealAuthoringClarification(input, 'openai'),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        const issues = (error.details as { providerSchemaIssues?: Array<Record<string, unknown>> })
          .providerSchemaIssues;
        assert.deepEqual(issues?.find((issue) => issue.path === 'clarification.nextQuestion'), {
          path: 'clarification.nextQuestion',
          expected: 'object',
          received: 'string',
          code: 'invalid_type',
        });
        return true;
      },
    );

    const diagnostic = getLastAuthoringValidationDiagnosticForTests();
    assert.equal(diagnostic?.stage, 'provider_schema');
    assert.equal(diagnostic?.issues.find((issue) => issue.path === 'clarification.nextQuestion')?.received, 'string');
  });

  test('rejects remainingTopics serialized as a string', async () => {
    setOpenRouterEnv();
    setAuthoringOpenAiClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async () => providerResponse(providerPayload({
            ...validClarification,
            remainingTopics: '9',
          })) as never,
        },
      },
    }));

    await assert.rejects(
      () => generateRealAuthoringClarification(input, 'openai'),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        const issues = (error.details as { providerSchemaIssues?: Array<Record<string, unknown>> })
          .providerSchemaIssues;
        assert.deepEqual(issues?.find((issue) => issue.path === 'clarification.remainingTopics'), {
          path: 'clarification.remainingTopics',
          expected: 'number',
          received: 'string',
          code: 'invalid_type',
        });
        return true;
      },
    );
  });

  test('rejects a response that omits required assistantText', async () => {
    setOpenRouterEnv();
    setAuthoringOpenAiClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async () => providerResponse(providerPayload(validClarification, null)) as never,
        },
      },
    }));

    await assert.rejects(
      () => generateRealAuthoringClarification(input, 'openai'),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        const issues = (error.details as { providerSchemaIssues?: Array<Record<string, unknown>> })
          .providerSchemaIssues;
        assert.deepEqual(issues?.find((issue) => issue.path === 'assistantText'), {
          path: 'assistantText',
          expected: 'string',
          received: 'undefined',
          code: 'invalid_type',
        });
        return true;
      },
    );
  });

  test('passes compliant Nano JSON and emits strict JSON Schema output configuration', async () => {
    setOpenRouterEnv();
    process.env.AI_CHAT_MODEL = 'openai/gpt-4.1-nano';
    let capturedRequest: Record<string, unknown> | null = null;
    setAuthoringOpenAiClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async (request) => {
            capturedRequest = request as Record<string, unknown>;
            return {
              ...providerResponse(providerPayload(validClarification)),
              model: 'openai/gpt-4.1-nano',
            } as never;
          },
        },
      },
    }));

    const result = await generateRealAuthoringClarification(input, 'openai');

    assert.equal(result.data.assistantText, 'Please answer this question.');
    assert.deepEqual(capturedRequest?.response_format, {
      type: 'json_schema',
      json_schema: {
        name: 'impactloop_authoring_clarification',
        strict: true,
        schema: capturedRequest?.response_format && (capturedRequest.response_format as {
          json_schema: { schema: unknown };
        }).json_schema.schema,
      },
    });
  });

  test('uses source-validator strict JSON Schema for Title and a later scalar stage', async () => {
    setOpenRouterEnv();
    process.env.AI_CHAT_MODEL = 'openai/gpt-4.1-nano';
    const capturedRequests: Record<string, unknown>[] = [];
    const responses = [
      JSON.stringify({ result: {
        kind: 'REVISED_PROPOSAL',
        stage: 'TITLE',
        value: 'Recycled Cardboard Phone Stand',
        explanation: 'The title is concise and describes the material and project.',
      } }),
      JSON.stringify({ result: {
        kind: 'REVISED_PROPOSAL',
        stage: 'SHORT_DESCRIPTION',
        value: 'A beginner-friendly recycled cardboard stand that holds a phone on a desk.',
        explanation: 'The short description identifies the audience, material, and use.',
      } }),
    ];
    setAuthoringOpenAiClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async (request) => {
            capturedRequests.push(request as Record<string, unknown>);
            return {
              ...providerResponse(responses.shift() ?? ''),
              model: 'openai/gpt-4.1-nano',
            } as never;
          },
        },
      },
    }));

    const title = await generateRealAuthoringScalarProposal(scalarInput('TITLE'), 'openai');
    const shortDescription = await generateRealAuthoringScalarProposal(
      scalarInput('SHORT_DESCRIPTION'),
      'openai',
    );

    assert.equal(title.data.kind, 'REVISED_PROPOSAL');
    assert.equal(title.data.kind === 'REVISED_PROPOSAL' && title.data.stage, 'TITLE');
    assert.equal(shortDescription.data.kind, 'REVISED_PROPOSAL');
    assert.equal(
      shortDescription.data.kind === 'REVISED_PROPOSAL' && shortDescription.data.stage,
      'SHORT_DESCRIPTION',
    );
    for (const request of capturedRequests) {
      const responseFormat = request.response_format as {
        type?: string;
        json_schema?: { name?: string; strict?: boolean; schema?: Record<string, unknown> };
      };
      assert.equal(responseFormat.type, 'json_schema');
      assert.equal(responseFormat.json_schema?.name, 'impactloop_authoring_scalar_proposal');
      assert.equal(responseFormat.json_schema?.strict, true);
      assert.equal(responseFormat.json_schema?.schema?.type, 'object');
      const envelope = responseFormat.json_schema?.schema?.properties as {
        result?: { anyOf?: unknown[] };
      };
      assert.equal(Array.isArray(envelope?.result?.anyOf), true);
      assert.equal(responseFormat.json_schema?.schema?.oneOf, undefined);
    }
  });

  test('uses a DIFFICULTY-specific strict schema and accepts every canonical difficulty token', async () => {
    setOpenRouterEnv();
    process.env.AI_CHAT_MODEL = 'openai/gpt-4.1-nano';
    const capturedRequests: Record<string, unknown>[] = [];
    const values = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
    setAuthoringOpenAiClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async (request) => {
            capturedRequests.push(request as Record<string, unknown>);
            const value = values[capturedRequests.length - 1] ?? 'BEGINNER';
            return {
              ...providerResponse(JSON.stringify({ result: {
                kind: 'REVISED_PROPOSAL',
                stage: 'DIFFICULTY',
                value,
                explanation: `The project difficulty is ${value}.`,
              } })),
              model: 'openai/gpt-4.1-nano',
            } as never;
          },
        },
      },
    }));

    for (const value of values) {
      const result = await generateRealAuthoringScalarProposal(scalarInput('DIFFICULTY'), 'openai');
      assert.equal(result.data.kind, 'REVISED_PROPOSAL');
      assert.equal(result.data.kind === 'REVISED_PROPOSAL' && result.data.value, value);
    }

    const responseFormat = capturedRequests[0]?.response_format as {
      json_schema?: { schema?: { properties?: { result?: { anyOf?: Array<{
        properties?: { stage?: { const?: string }; value?: { enum?: string[] } };
      }> } } } };
    };
    const difficultyProposal = responseFormat.json_schema?.schema?.properties?.result?.anyOf?.find(
      (candidate) => candidate.properties?.stage?.const === 'DIFFICULTY',
    );
    assert.deepEqual(difficultyProposal?.properties?.value?.enum, values);
  });

  test('rejects a localized DIFFICULTY value at provider-schema validation before normalization', async () => {
    setOpenRouterEnv();
    process.env.AI_CHAT_MODEL = 'openai/gpt-4.1-nano';
    setAuthoringOpenAiClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async () => providerResponse(JSON.stringify({ result: {
            kind: 'REVISED_PROPOSAL',
            stage: 'DIFFICULTY',
            value: 'مبتدئ',
            explanation: 'هذا المشروع مناسب للمبتدئين.',
          } })) as never,
        },
      },
    }));

    await assert.rejects(
      () => generateRealAuthoringScalarProposal(scalarInput('DIFFICULTY'), 'openai'),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'AI_RESPONSE_INVALID');
        const issues = (error.details as { providerSchemaIssues?: Array<Record<string, unknown>> })
          .providerSchemaIssues;
        const valueIssue = issues?.find((issue) => issue.path === 'value');
        assert.equal(valueIssue?.expected, 'BEGINNER | INTERMEDIATE | ADVANCED');
        assert.equal(valueIssue?.received, 'string');
        return true;
      },
    );
  });

  test('accepts an Arabic explanation with a canonical DIFFICULTY value', async () => {
    setOpenRouterEnv();
    process.env.AI_CHAT_MODEL = 'openai/gpt-4.1-nano';
    setAuthoringOpenAiClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async () => providerResponse(JSON.stringify({ result: {
            kind: 'REVISED_PROPOSAL',
            stage: 'DIFFICULTY',
            value: 'BEGINNER',
            explanation: 'المشروع مناسب للمبتدئين ولا يتطلب خبرة سابقة.',
          } })) as never,
        },
      },
    }));

    const result = await generateRealAuthoringScalarProposal({
      ...scalarInput('DIFFICULTY'),
      locale: 'ar',
    }, 'openai');

    assert.equal(result.data.kind, 'REVISED_PROPOSAL');
    assert.equal(result.data.kind === 'REVISED_PROPOSAL' && result.data.value, 'BEGINNER');
    assert.equal(
      result.data.kind === 'REVISED_PROPOSAL' && result.data.explanation,
      'المشروع مناسب للمبتدئين ولا يتطلب خبرة سابقة.',
    );
  });

  test('rejects malformed scalar JSON and invalid scalar field types with exact issues', async () => {
    setOpenRouterEnv();
    process.env.AI_CHAT_MODEL = 'openai/gpt-4.1-nano';
    const responses = [
      '{"kind":"REVISED_PROPOSAL",',
      JSON.stringify({
        kind: 'REVISED_PROPOSAL',
        stage: 'TITLE',
        value: 'Valid title',
        explanation: 42,
      }),
    ];
    setAuthoringOpenAiClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async () => providerResponse(responses.shift() ?? '') as never,
        },
      },
    }));

    await assert.rejects(
      () => generateRealAuthoringScalarProposal(scalarInput(), 'openai'),
      (error: unknown) => error instanceof AppError && error.code === 'AI_RESPONSE_INVALID',
    );
    await assert.rejects(
      () => generateRealAuthoringScalarProposal(scalarInput(), 'openai'),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'AI_RESPONSE_INVALID');
        const issues = (error.details as { providerSchemaIssues?: Array<Record<string, unknown>> })
          .providerSchemaIssues;
        assert.deepEqual(issues?.find((issue) => issue.path === 'explanation'), {
          path: 'explanation',
          expected: 'string',
          received: 'number',
          code: 'invalid_type',
        });
        return true;
      },
    );
  });

  test('rejects missing scalar fields while preserving FOLLOW_UP_QUESTION union responses', async () => {
    setOpenRouterEnv();
    process.env.AI_CHAT_MODEL = 'openai/gpt-4.1-nano';
    const responses = [
      JSON.stringify({ result: {
        kind: 'REVISED_PROPOSAL',
        stage: 'TITLE',
        value: 'Missing explanation',
      } }),
      JSON.stringify({ result: {
        kind: 'FOLLOW_UP_QUESTION',
        question: 'Which recycled material is strongest enough for the phone stand?',
        explanation: null,
      } }),
    ];
    setAuthoringOpenAiClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async () => providerResponse(responses.shift() ?? '') as never,
        },
      },
    }));

    await assert.rejects(
      () => generateRealAuthoringScalarProposal(scalarInput(), 'openai'),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        const issues = (error.details as { providerSchemaIssues?: Array<Record<string, unknown>> })
          .providerSchemaIssues;
        assert.deepEqual(issues?.find((issue) => issue.path === 'explanation'), {
          path: 'explanation',
          expected: 'string',
          received: 'undefined',
          code: 'invalid_type',
        });
        return true;
      },
    );

    const followUp = await generateRealAuthoringScalarProposal(scalarInput(), 'openai');
    assert.equal(followUp.data.kind, 'FOLLOW_UP_QUESTION');
    assert.equal(
      followUp.data.kind === 'FOLLOW_UP_QUESTION' && followUp.data.question,
      'Which recycled material is strongest enough for the phone stand?',
    );
    assert.equal(
      followUp.data.kind === 'FOLLOW_UP_QUESTION' && followUp.data.explanation,
      undefined,
    );
  });

  test('places exact validator issues into the repair prompt', () => {
    const repairIssue = formatAuthoringProviderSchemaRepairIssue([
      {
        path: 'clarification.nextQuestion',
        expected: 'object',
        received: 'string',
        code: 'invalid_type',
      },
      {
        path: 'assistantText',
        expected: 'string',
        received: 'undefined',
        code: 'invalid_type',
      },
    ]);
    const prompt = buildAuthoringClarificationPrompt({
      ...input,
      repairAttempt: true,
      repairIssue,
    });

    assert.match(prompt, /clarification\.nextQuestion: expected object, received string/);
    assert.match(prompt, /assistantText: expected string, received undefined/);
  });

  test('rejects the observed Liquid tool-call syntax while logging its safe response shape', async () => {
    setOpenRouterEnv();
    process.env.AI_CHAT_MODEL = 'openrouter/free';
    process.env.NODE_ENV = 'development';
    const lines: string[] = [];
    const stream = new PassThrough();
    stream.on('data', (chunk) => lines.push(chunk.toString()));
    setLoggerDestinationForTests(stream);
    resetLoggerForTests();
    let capturedRequest: Record<string, unknown> | null = null;
    const toolCall = "<|tool_call_start|>[question(key='project_goal', prompt='What is the goal?', answerType='string', options=['Use', 'Learn'])]<|tool_call_end|>";

    setAuthoringOpenAiClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async (request) => {
            capturedRequest = request as Record<string, unknown>;
            return {
              id: 'gen-observed-openrouter-shape',
              model: 'liquid/lfm-2.5-2.6b:free',
              choices: [{
                finish_reason: 'stop',
                message: {
                  role: 'assistant',
                  content: toolCall,
                  refusal: null,
                  reasoning: 'Hidden reasoning is not an authoring answer.',
                  reasoning_details: [{ type: 'reasoning.text' }],
                },
              }],
              usage: { prompt_tokens: 10, completion_tokens: 61 },
              provider: 'Liquid',
            } as never;
          },
        },
      },
    }));

    await assert.rejects(
      () => generateRealAuthoringClarification(input, 'openai'),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'AI_RESPONSE_INVALID');
        return true;
      },
    );

    assert.match(JSON.stringify(capturedRequest?.messages), /Do not emit tool calls/);
    const output = lines.join('');
    assert.match(output, /liquid\/lfm-2\.5-2\.6b:free/);
    assert.match(output, /"finishReason":"stop"/);
    assert.match(output, /"usageCompletionCount":61/);
    assert.match(output, /"messageHasReasoning":true/);
    assert.match(output, /"messageHasReasoningDetails":true/);
    assert.match(output, /"messageContentLength":/);
    assert.match(output, /"messageContentStartsWithJsonObject":false/);
    assert.doesNotMatch(output, /tool_call_start/);
  });

  for (const [status, expectedCode] of [
    [400, 'AI_PROVIDER_REQUEST_INVALID'],
    [429, 'AI_PROVIDER_RATE_LIMITED'],
    [502, 'AI_PROVIDER_ERROR'],
  ] as const) {
    test(`maps upstream ${status} without collapsing it into a generic authoring error`, async () => {
      setOpenRouterEnv();
      setAuthoringOpenAiClientFactoryForTests(() => ({
        chat: {
          completions: {
            create: async () => {
              const error = new Error(`Upstream ${status}`) as Error & {
                status: number;
                code: string;
                type: string;
                error: { message: string };
              };
              error.status = status;
              error.code = `upstream_${status}`;
              error.type = 'provider_error';
              error.error = { message: 'provider rejected the request' };
              throw error;
            },
          },
        },
      }));

      await assert.rejects(
        () => generateRealAuthoringClarification(input, 'openai'),
        (error: unknown) => {
          assert.ok(error instanceof AppError);
          assert.equal(error.code, expectedCode);
          assert.equal((error.details as { status?: number }).status, status);
          return true;
        },
      );
    });
  }

  test('redacts API secrets from development diagnostics and client errors', async () => {
    setOpenRouterEnv();
    process.env.NODE_ENV = 'development';
    const secret = 'sk-or-never-log-this-secret-value';
    const lines: string[] = [];
    const stream = new PassThrough();
    stream.on('data', (chunk) => lines.push(chunk.toString()));
    setLoggerDestinationForTests(stream);
    resetLoggerForTests();

    setAuthoringOpenAiClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async () => {
            const error = new Error(`Authorization: Bearer ${secret}`) as Error & {
              status: number;
              error: { message: string };
            };
            error.status = 400;
            error.error = { message: `Bearer ${secret}` };
            throw error;
          },
        },
      },
    }));

    await assert.rejects(
      () => generateRealAuthoringClarification(input, 'openai'),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.doesNotMatch(JSON.stringify(error), new RegExp(secret));
        return true;
      },
    );

    assert.doesNotMatch(lines.join(''), new RegExp(secret));
    assert.match(lines.join(''), /\[redacted\]/);
  });
});
