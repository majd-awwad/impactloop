import { isAiChatProviderOperational } from '../../../config/env.js';
import type { AiContentBlock } from '../ai.content-blocks.js';
import { parseStoredContentBlocks } from '../ai-context-builder.js';
import {
  customizeActionConfirmationLabels,
  prepareAiPendingAction,
} from '../ai-action.service.js';
import type { VersionedActionPayload } from '../ai-action.payloads.js';
import { loadRecentConversationMessages } from '../ai.repository.js';
import type { AiLocale } from '../ai.types.js';
import { getAiChatProvider } from '../providers/ai-chat-provider.factory.js';
import { getOwnedProjectBuildByBuildId } from '../../learning-projects/learning-projects.service.js';
import type { AiAgentRouteType } from './ai-agent.types.js';
import {
  mergeAgentBlocks,
  toMissingBuildChecklistBlock,
} from './ai-tool-mappers.js';

export type BuildGuideStepTurnResult = {
  blocks: AiContentBlock[];
  usedProvider: boolean;
  providerName: string;
  model: string | null;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  route: AiAgentRouteType;
};

type MappedBuild = NonNullable<
  Awaited<ReturnType<typeof getOwnedProjectBuildByBuildId>>
>;

type CurrentStepView = {
  stepId: string;
  stepNumber: number;
  title: string;
  description: string;
  imageUrl: string | null;
};

const textBlock = (
  text: string,
  purpose: 'answer' | 'clarification' = 'answer',
): AiContentBlock => ({
  type: 'text',
  text,
  purpose,
});

const normalizeMessage = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const detectStepCompleteIntent = (message: string): boolean =>
  /(خلصت|خلصت الخطوة|أنهيتها|أنهيت|تمت|كملت هاي الخطوة|كملت الخطوة|روح عاللي بعدها|انتقل للخطوة|الخطوة التالية|move to the next step|i finished|i completed|completed the step|\bdone\b)/i.test(
    message,
  );

const detectStepProgressIntent = (message: string): boolean => {
  const normalized = normalizeMessage(message);
  return (
    /(وين وصلت|كم خلصت|نسبة|كم نسبة|شو الخطوة الحالية|شو الخطوة الجاية|شو ضايل|كم خطوة ضايلة|where am i|what is my progress|current step|what is next|how many steps|steps left|remaining steps)/i.test(
      normalized,
    ) ||
    /(what('?s| is) left|progress percent|completion percent)/i.test(normalized)
  );
};

const detectStepBeginIntent = (message: string): boolean =>
  /(ابدأ معي|يلا نبدأ|ساعدني أبدأ|كملني من وين وقفت|نرجع نكمل|شو أعمل هلا|start with me|let'?s begin|continue from where|what should i do now)/i.test(
    message,
  );

const detectStepExplainIntent = (message: string): boolean =>
  /(اشرحلي|اشرح|كيف أنفذ|شو المطلوب|شو لازم أعمل|explain the current step|explain this step|how do i do this step|what should i do in this step)/i.test(
    message,
  );

const detectStepFollowUpIntent = (message: string): boolean => {
  const trimmed = message.trim();
  if (trimmed.length <= 48) {
    return /(ليش|وين|شو قصدك|وضح|أكثر|أبسط|عيد|مثال|why|where|what do you mean|simpler|again|example)/i.test(
      trimmed,
    );
  }
  return (
    /(مش فاهم|وضحلي أكثر|اشرح بطريقة أبسط|عيدها|اعطيني مثال|ليش بنعمل|وين أحط|أي جهة|الأخطاء الشائعة|الأدوات المطلوبة|i don'?t understand|explain.*simply|common mistakes|what tools)/i.test(
      message,
    )
  );
};

const allMaterialsReady = (build: MappedBuild): boolean =>
  build.stepProgress.nextAction === 'COMPLETE_CURRENT_STEP' ||
  (build.stepProgress.currentStep != null && build.materialReadiness.missing === 0);

const resolveCurrentStepView = (build: MappedBuild): CurrentStepView | null => {
  const step = build.stepProgress.steps.find((entry) => entry.state === 'CURRENT');
  if (!step) {
    return null;
  }
  return {
    stepId: step.stepId,
    stepNumber: step.stepNumber,
    title: step.title,
    description: step.description,
    imageUrl: step.imageUrl,
  };
};

const toBuildStepGuideBlock = (
  build: MappedBuild,
  step: CurrentStepView,
): AiContentBlock => ({
  type: 'build_step_guide',
  projectBuildId: build.id,
  projectId: build.projectId,
  projectTitle: build.project.title,
  projectStepId: step.stepId,
  stepNumber: step.stepNumber,
  totalSteps: build.stepProgress.total,
  title: step.title,
  description: step.description,
  imageUrl: step.imageUrl ?? undefined,
  progressPercent: build.stepProgress.percent,
  completedSteps: build.stepProgress.completed,
  materialReadiness: build.materialReadiness,
  stepStatus: 'CURRENT',
});

export const findLatestBuildStepGuideBlock = async (
  conversationId: string,
): Promise<AiContentBlock | null> => {
  const messages = await loadRecentConversationMessages({
    conversationId,
    limit: 24,
  });

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== 'ASSISTANT') {
      continue;
    }
    const blocks = parseStoredContentBlocks(message.contentBlocks);
    for (let blockIndex = blocks.length - 1; blockIndex >= 0; blockIndex -= 1) {
      const block = blocks[blockIndex];
      if (block?.type === 'build_step_guide') {
        return block;
      }
    }
  }

  return null;
};

const buildMaterialsNotReadyResponse = (
  build: MappedBuild,
  locale: AiLocale,
): BuildGuideStepTurnResult => ({
  blocks: mergeAgentBlocks(
    locale === 'ar'
      ? 'لسه في مواد مطلوبة غير جاهزة قبل بدء التنفيذ.'
      : 'Some required materials are not ready before you can start execution.',
    [toMissingBuildChecklistBlock(build)],
  ),
  usedProvider: false,
  providerName: 'system',
  model: null,
  latencyMs: null,
  inputTokens: null,
  outputTokens: null,
  route: 'BUILD_GAP_ANALYSIS',
});

const buildCompletedResponse = (
  build: MappedBuild,
  locale: AiLocale,
): BuildGuideStepTurnResult => ({
  blocks: [
    textBlock(
      locale === 'ar'
        ? `اكتمل مشروع "${build.project.title}". التقدم: ${build.stepProgress.percent}% (${build.stepProgress.completed} من ${build.stepProgress.total} خطوات).`
        : `"${build.project.title}" is complete. Progress: ${build.stepProgress.percent}% (${build.stepProgress.completed} of ${build.stepProgress.total} steps).`,
    ),
  ],
  usedProvider: false,
  providerName: 'system',
  model: null,
  latencyMs: null,
  inputTokens: null,
  outputTokens: null,
  route: 'BUILD_CHECKLIST',
});

const buildZeroStepsResponse = (locale: AiLocale): BuildGuideStepTurnResult => ({
  blocks: [
    textBlock(
      locale === 'ar'
        ? 'هذا المشروع لا يحتوي على خطوات تنفيذ رسمية بعد.'
        : 'This project does not have executable steps yet.',
    ),
  ],
  usedProvider: false,
  providerName: 'system',
  model: null,
  latencyMs: null,
  inputTokens: null,
  outputTokens: null,
  route: 'BUILD_CHECKLIST',
});

const buildProgressResponse = (
  build: MappedBuild,
  locale: AiLocale,
  userMessage: string,
): BuildGuideStepTurnResult => {
  const normalized = normalizeMessage(userMessage);
  const remainingSteps = build.stepProgress.steps.filter(
    (step) => step.state !== 'COMPLETED',
  );
  const current = build.stepProgress.currentStep;

  if (/(شو ضايل|what('?s| is) left|remaining)/i.test(normalized)) {
    const lines = remainingSteps.map(
      (step) =>
        locale === 'ar'
          ? `- الخطوة ${step.stepNumber}: ${step.title}`
          : `- Step ${step.stepNumber}: ${step.title}`,
    );
    const prefix =
      locale === 'ar'
        ? `تبقّى ${remainingSteps.length} خطوة:\n`
        : `${remainingSteps.length} steps remain:\n`;
    return {
      blocks: [textBlock(`${prefix}${lines.join('\n')}`)],
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: 'BUILD_CHECKLIST',
    };
  }

  if (/(الجاية|next step|what is next)/i.test(normalized)) {
    const text =
      current == null
        ? locale === 'ar'
          ? build.status === 'COMPLETED'
            ? 'اكتمل المشروع ولا توجد خطوة تالية.'
            : 'تحضير المواد ما زال مطلوباً قبل بدء الخطوات.'
          : build.status === 'COMPLETED'
            ? 'The project is complete and there is no next step.'
            : 'Material preparation is still required before steps can begin.'
        : locale === 'ar'
          ? `الخطوة الحالية/التالية للتنفيذ هي: ${current.stepNumber} — ${current.title}.`
          : `The current/next executable step is: ${current.stepNumber} — ${current.title}.`;
    return {
      blocks: [textBlock(text)],
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: 'BUILD_CHECKLIST',
    };
  }

  const summary =
    locale === 'ar'
      ? `أنجزت ${build.stepProgress.completed} من ${build.stepProgress.total} خطوات (${build.stepProgress.percent}%).${
          current
            ? ` الخطوة الحالية: ${current.stepNumber} — ${current.title}.`
            : ''
        }`
      : `You completed ${build.stepProgress.completed} of ${build.stepProgress.total} steps (${build.stepProgress.percent}%).${
          current
            ? ` Current step: ${current.stepNumber} — ${current.title}.`
            : ''
        }`;

  return {
    blocks: [textBlock(summary)],
    usedProvider: false,
    providerName: 'system',
    model: null,
    latencyMs: null,
    inputTokens: null,
    outputTokens: null,
    route: 'BUILD_CHECKLIST',
  };
};

const buildStepExplanationPrompt = (input: {
  build: MappedBuild;
  step: CurrentStepView;
  locale: AiLocale;
  userMessage: string;
}) => {
  const components = input.build.items
    .map((item) => item.component.componentName)
    .join(', ');
  return [
    'You are helping a learner execute ONE official build step in ImpactLoop.',
    'Use only the trusted step data below. Do not invent step numbers, IDs, or completion status.',
    `Project: ${input.build.project.title}`,
    `Step ${input.step.stepNumber} of ${input.build.stepProgress.total}: ${input.step.title}`,
    `Official instructions: ${input.step.description}`,
    `Required components: ${components}`,
    `Progress: ${input.build.stepProgress.percent}%`,
    `Learner question (${input.locale}): ${input.userMessage}`,
    'Answer in the learner language. Keep guidance practical and bounded to this step.',
  ].join('\n');
};

const generateStepExplanation = async (input: {
  build: MappedBuild;
  step: CurrentStepView;
  locale: AiLocale;
  userMessage: string;
}): Promise<{
  text: string;
  providerName: string;
  model: string | null;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
}> => {
  if (!isAiChatProviderOperational()) {
    return {
      text:
        input.locale === 'ar'
          ? `${input.step.title}\n\n${input.step.description}`
          : `${input.step.title}\n\n${input.step.description}`,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
    };
  }

  const provider = getAiChatProvider();
  const answer = await provider.generateGeneralLearningAnswer({
    locale: input.locale,
    userMessage: buildStepExplanationPrompt(input),
    history: [],
    scopeClassification: 'DOMAIN_KNOWLEDGE',
  });
  const text =
    answer.data.blocks.find((block) => block.type === 'text')?.text?.trim() ??
    input.step.description;

  return {
    text,
    providerName: answer.provider,
    model: answer.model,
    latencyMs: answer.latencyMs,
    inputTokens: answer.usage.inputTokens,
    outputTokens: answer.usage.outputTokens,
  };
};

const buildStepGuideResponse = async (input: {
  build: MappedBuild;
  step: CurrentStepView;
  locale: AiLocale;
  userMessage: string;
}): Promise<BuildGuideStepTurnResult> => {
  const guideBlock = toBuildStepGuideBlock(input.build, input.step);
  const explanation = await generateStepExplanation(input);

  return {
    blocks: mergeAgentBlocks(explanation.text, [guideBlock]),
    usedProvider: explanation.providerName !== 'system',
    providerName: explanation.providerName,
    model: explanation.model,
    latencyMs: explanation.latencyMs,
    inputTokens: explanation.inputTokens,
    outputTokens: explanation.outputTokens,
    route: 'BUILD_CHECKLIST',
  };
};

const buildCompleteStepPayload = (
  build: MappedBuild,
  step: CurrentStepView,
  locale: AiLocale,
): VersionedActionPayload => ({
  schemaVersion: 1,
  actionType: 'COMPLETE_CURRENT_BUILD_STEP',
  target: {
    projectId: build.projectId,
    buildId: build.id,
    projectStepId: step.stepId,
  },
  parameters: {
    stepNumber: step.stepNumber,
    stepTitle: step.title,
    expectedBuildStatus: 'IN_PROGRESS',
  },
  displaySnapshot: {
    title: build.project.title,
    summary:
      locale === 'ar'
        ? `الخطوة ${step.stepNumber}: ${step.title} — التقدم ${build.stepProgress.percent}%`
        : `Step ${step.stepNumber}: ${step.title} — progress ${build.stepProgress.percent}%`,
  },
});

export const tryHandleBuildGuideStepTurn = async (input: {
  userMessage: string;
  locale: AiLocale;
  conversationId: string;
  authenticatedUserId: string;
  clientMessageId: string;
  projectBuildId: string;
}): Promise<BuildGuideStepTurnResult | null> => {
  const completeIntent = detectStepCompleteIntent(input.userMessage);
  const progressIntent = detectStepProgressIntent(input.userMessage);
  const beginIntent = detectStepBeginIntent(input.userMessage);
  const explainIntent = detectStepExplainIntent(input.userMessage);
  const followUpIntent = detectStepFollowUpIntent(input.userMessage);

  if (
    !completeIntent &&
    !progressIntent &&
    !beginIntent &&
    !explainIntent &&
    !followUpIntent
  ) {
    return null;
  }

  const build = await getOwnedProjectBuildByBuildId(
    input.projectBuildId,
    input.authenticatedUserId,
  );

  if (!build) {
    return {
      blocks: [
        textBlock(
          input.locale === 'ar'
            ? 'لا يمكن الوصول إلى مشروع البناء المرتبط بهذه المحادثة.'
            : 'The build linked to this conversation is not accessible.',
          'clarification',
        ),
      ],
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: 'BUILD_CHECKLIST',
    };
  }

  if (build.status === 'ARCHIVED') {
    return {
      blocks: [
        textBlock(
          input.locale === 'ar'
            ? 'هذا البناء للقراءة فقط ولا يمكن إكمال خطوات جديدة من المحادثة.'
            : 'This build is read-only and step completion is not available from chat.',
        ),
      ],
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: 'BUILD_CHECKLIST',
    };
  }

  if (build.stepProgress.total === 0) {
    return buildZeroStepsResponse(input.locale);
  }

  if (build.status === 'COMPLETED' || build.stepProgress.nextAction === 'BUILD_COMPLETED') {
    if (completeIntent) {
      return buildCompletedResponse(build, input.locale);
    }
    if (progressIntent || beginIntent || explainIntent || followUpIntent) {
      return buildCompletedResponse(build, input.locale);
    }
  }

  const currentStep = resolveCurrentStepView(build);
  const materialsReady = allMaterialsReady(build);

  if (completeIntent) {
    if (!materialsReady || !currentStep) {
      return buildMaterialsNotReadyResponse(build, input.locale);
    }
    const payload = buildCompleteStepPayload(build, currentStep, input.locale);
    const prepared = await prepareAiPendingAction({
      userId: input.authenticatedUserId,
      conversationId: input.conversationId,
      actionType: 'COMPLETE_CURRENT_BUILD_STEP',
      payload,
      idempotencyKey: `${input.clientMessageId}:COMPLETE_CURRENT_BUILD_STEP:${currentStep.stepId}`,
      locale: input.locale,
    });
    const confirmationBlock = customizeActionConfirmationLabels(prepared.block, {
      confirmLabel:
        input.locale === 'ar' ? 'نعم، أنهيتها' : 'Yes, I finished it',
      cancelLabel: input.locale === 'ar' ? 'إلغاء' : 'Cancel',
    });
    return {
      blocks: mergeAgentBlocks(
        input.locale === 'ar'
          ? 'راجع التفاصيل ثم أكّد إكمال الخطوة:'
          : 'Review the details, then confirm step completion:',
        [confirmationBlock],
      ),
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: 'ACTION_REQUEST',
    };
  }

  if (progressIntent) {
    if (!materialsReady && build.stepProgress.currentStep == null) {
      return buildMaterialsNotReadyResponse(build, input.locale);
    }
    return buildProgressResponse(build, input.locale, input.userMessage);
  }

  if (beginIntent || explainIntent) {
    if (!materialsReady || !currentStep) {
      return buildMaterialsNotReadyResponse(build, input.locale);
    }
    return buildStepGuideResponse({
      build,
      step: currentStep,
      locale: input.locale,
      userMessage: input.userMessage,
    });
  }

  if (followUpIntent) {
    const persistedGuide = await findLatestBuildStepGuideBlock(input.conversationId);
    const step =
      currentStep &&
      (!persistedGuide ||
        persistedGuide.type !== 'build_step_guide' ||
        persistedGuide.projectStepId === currentStep.stepId)
        ? currentStep
        : persistedGuide?.type === 'build_step_guide' &&
            persistedGuide.projectStepId === currentStep?.stepId
          ? currentStep
          : currentStep;

    if (!step || !materialsReady) {
      return {
        blocks: [
          textBlock(
            input.locale === 'ar'
              ? 'حدّد الخطوة الحالية أولاً، مثلاً: "اشرحلي الخطوة الحالية".'
              : 'Ask about the current step first, for example: "Explain the current step".',
            'clarification',
          ),
        ],
        usedProvider: false,
        providerName: 'system',
        model: null,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        route: 'BUILD_CHECKLIST',
      };
    }

    return buildStepGuideResponse({
      build,
      step,
      locale: input.locale,
      userMessage: input.userMessage,
    });
  }

  return null;
};
