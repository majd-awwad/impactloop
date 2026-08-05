import type {
  GeneratedLearningPack,
  GeneratedLearningPackQuestion,
} from './project-learning-pack-generation.schema.js';
import { PROJECT_LEARNING_PACK_GENERATOR_SCHEMA_VERSION } from './project-learning-pack-generation.schema.js';
import type {
  ProjectLearningCanonicalSnapshot,
  ProjectLearningComponentSnapshot,
  ProjectLearningStepSnapshot,
} from './project-learning-snapshot.js';
import type {
  ProjectLearningPackGeneratorInput,
  ProjectLearningPackGeneratorProvider,
  ProjectLearningPackGeneratorResult,
} from './project-learning-pack-generator.provider.types.js';

const option = (
  optionKey: string,
  textEn: string,
  textAr: string,
  displayOrder: number,
) => ({
  optionKey,
  textEn,
  textAr,
  displayOrder,
});

const question = (
  input: GeneratedLearningPackQuestion,
): GeneratedLearningPackQuestion => input;

const truncate = (value: string, max = 140): string => {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
};

const requiredComponents = (
  snapshot: ProjectLearningCanonicalSnapshot,
): ProjectLearningComponentSnapshot[] =>
  snapshot.components.filter((component) => component.isRequired);

const primaryName = (snapshot: ProjectLearningCanonicalSnapshot): string =>
  requiredComponents(snapshot)[0]?.componentName ?? 'the primary component';

const secondaryName = (snapshot: ProjectLearningCanonicalSnapshot): string =>
  requiredComponents(snapshot)[1]?.componentName ?? primaryName(snapshot);

/**
 * Deterministic local Pack generator for non-production development only.
 * Questions test preparation, component purpose, step meaning, and troubleshooting
 * using only the canonical Project snapshot — no absurd distractors.
 */
export const buildLocalDeterministicLearningPack = (
  snapshot: ProjectLearningCanonicalSnapshot,
): GeneratedLearningPack => {
  const questions: GeneratedLearningPackQuestion[] = [];
  const primary = primaryName(snapshot);
  const secondary = secondaryName(snapshot);
  const goal = truncate(
    snapshot.shortDescription || snapshot.description || snapshot.title,
    100,
  );
  const firstStep = snapshot.steps[0];

  questions.push(
    question({
      stage: 'START',
      questionType: 'MULTIPLE_CHOICE',
      conceptKey: 'component_purpose',
      relativeDifficulty: 2,
      promptEn: `Why is "${primary}" listed as a required component for "${snapshot.title}"?`,
      promptAr: `لماذا يُدرج "${primary}" كمكون مطلوب في مشروع "${snapshot.title}"؟`,
      explanationEn: `"${primary}" supports the practical function described in the project materials list.`,
      explanationAr: `"${primary}" يدعم الوظيفة العملية الموضحة في قائمة مواد المشروع.`,
      hintEn: 'Look at the required components and their roles.',
      hintAr: 'راجع المكونات المطلوبة وأدوارها.',
      packDisplayOrder: 1,
      correctOptionKey: 'a',
      options: [
        option(
          'a',
          `It is needed for the intended function of ${truncate(snapshot.title, 40)}`,
          `مطلوب للوظيفة المقصودة من ${truncate(snapshot.title, 40)}`,
          1,
        ),
        option(
          'b',
          `It only changes the project title and not the circuit or build`,
          'يغيّر عنوان المشروع فقط دون التأثير على الدائرة أو البناء',
          2,
        ),
        option(
          'c',
          `It replaces every other material listed for the project`,
          'يستبدل كل المواد الأخرى المدرجة في المشروع',
          3,
        ),
      ],
    }),
    question({
      stage: 'START',
      questionType: 'TRUE_FALSE',
      conceptKey: 'safe_preparation',
      relativeDifficulty: 1,
      promptEn:
        'Before applying power or force, you should verify materials and follow safety guidance for this build.',
      promptAr:
        'قبل توصيل الطاقة أو تطبيق القوة، يجب التحقق من المواد واتباع إرشادات السلامة لهذا البناء.',
      explanationEn:
        'Safe preparation prevents damage and reduces avoidable build failures.',
      explanationAr:
        'التحضير الآمن يمنع التلف ويقلل أعطال البناء التي يمكن تجنبها.',
      hintEn: 'Think about preparation before the first practical step.',
      hintAr: 'فكر في التحضير قبل أول خطوة عملية.',
      packDisplayOrder: 2,
      correctOptionKey: 'true',
      options: [
        option('true', 'True', 'صحيح', 1),
        option('false', 'False', 'خطأ', 2),
      ],
    }),
    question({
      stage: 'START',
      questionType: 'BEST_ACTION',
      conceptKey: 'materials_readiness',
      relativeDifficulty: 3,
      promptEn: `What is the best preparation action before starting "${snapshot.title}"?`,
      promptAr: `ما أفضل إجراء تحضيري قبل بدء "${snapshot.title}"؟`,
      explanationEn: `Gather and check required materials such as ${primary}${secondary !== primary ? ` and ${secondary}` : ''} against the project list.`,
      explanationAr: `اجمع وتحقق من المواد المطلوبة مثل ${primary}${secondary !== primary ? ` و${secondary}` : ''} وفق قائمة المشروع.`,
      hintEn: 'Compare your materials to the required components list.',
      hintAr: 'قارن موادك بقائمة المكونات المطلوبة.',
      packDisplayOrder: 3,
      correctOptionKey: 'a',
      options: [
        option(
          'a',
          `Confirm required materials (including ${primary}) match the project list`,
          `تأكد أن المواد المطلوبة (بما فيها ${primary}) تطابق قائمة المشروع`,
          1,
        ),
        option(
          'b',
          'Begin the final step first to save time',
          'ابدأ بالخطوة النهائية أولًا لتوفير الوقت',
          2,
        ),
        option(
          'c',
          `Assume ${secondary} is optional even though it is marked required`,
          `افترض أن ${secondary} اختياري رغم أنه مُعلَّم كمطلوب`,
          3,
        ),
      ],
    }),
  );

  for (const [index, step] of snapshot.steps.entries()) {
    const stepWhy = truncate(
      step.description ||
        `Completing "${step.title}" correctly so later work builds on a solid result`,
      110,
    );
    const correctWhy = truncate(
      step.description
        ? `It achieves the step outcome: ${step.description}`
        : `It correctly performs "${step.title}" so the build can progress safely`,
      90,
    );
    questions.push(
      question({
        stage: 'STEP',
        projectStepId: step.id,
        questionType: index % 2 === 0 ? 'BEST_ACTION' : 'MULTIPLE_CHOICE',
        conceptKey: `step_${step.stepNumber}_purpose`,
        relativeDifficulty: Math.min(5, 2 + (step.stepNumber % 3)),
        promptEn: `In step ${step.stepNumber} ("${step.title}"), why does this action matter?`,
        promptAr: `في الخطوة ${step.stepNumber} ("${step.title}")، لماذا يهم هذا الإجراء؟`,
        explanationEn: `The correct choice matches the step intent: ${stepWhy}`,
        explanationAr: `الخيار الصحيح يطابق قصد الخطوة: ${stepWhy}`,
        hintEn: 'Use the step description, not only the step title.',
        hintAr: 'استخدم وصف الخطوة وليس عنوانها فقط.',
        packDisplayOrder: 1,
        correctOptionKey: 'a',
        options: [
          option(
            'a',
            correctWhy,
            truncate(
              step.description
                ? `يحقق نتيجة الخطوة: ${step.description}`
                : `ينفّذ "${step.title}" بشكل صحيح حتى يتقدّم البناء بأمان`,
              90,
            ),
            1,
          ),
          option(
            'b',
            'It only renames the project without changing the build',
            'يعيد تسمية المشروع فقط دون تغيير البناء',
            2,
          ),
          option(
            'c',
            'It replaces the need to check materials or connections later',
            'يلغي الحاجة للتحقق من المواد أو التوصيلات لاحقًا',
            3,
          ),
        ],
      }),
    );

    if (snapshot.steps.length <= 4 || index % 2 === 0) {
      questions.push(
        question({
          stage: 'STEP',
          projectStepId: step.id,
          questionType: 'TRUE_FALSE',
          conceptKey: `step_${step.stepNumber}_verification`,
          relativeDifficulty: 2,
          promptEn: `After "${step.title}", you should verify the described result (${truncate(step.description || step.title, 60)}) before rushing into later steps.`,
          promptAr: `بعد "${step.title}"، يجب التحقق من النتيجة الموصوفة قبل التسرع إلى الخطوات التالية.`,
          explanationEn:
            `Checking the outcome of "${step.title}" catches placement, polarity, or connection mistakes early.`,
          explanationAr:
            `التحقق من نتيجة "${step.title}" يكتشف أخطاء الوضع أو القطبية أو التوصيل مبكرًا.`,
          hintEn: 'Think about verification after finishing the step action.',
          hintAr: 'فكر في التحقق بعد إنهاء إجراء الخطوة.',
          packDisplayOrder: 2,
          correctOptionKey: 'a',
          options: [
            option('a', 'True', 'صحيح', 1),
            option('b', 'False', 'خطأ', 2),
          ],
        }),
      );
    }
  }

  const lastStep: ProjectLearningStepSnapshot | undefined =
    snapshot.steps[snapshot.steps.length - 1];

  const finalItems: Array<{
    conceptKey: string;
    promptEn: string;
    promptAr: string;
    explanationEn: string;
    explanationAr: string;
    correctEn: string;
    correctAr: string;
    wrongBEn: string;
    wrongBAr: string;
    wrongCEn: string;
    wrongCAr: string;
  }> = [
    {
      conceptKey: 'component_role_application',
      promptEn: `How does "${primary}" contribute to a successful "${snapshot.title}"?`,
      promptAr: `كيف يساهم "${primary}" في نجاح "${snapshot.title}"؟`,
      explanationEn: `${primary} is required so the build can perform its intended practical function.`,
      explanationAr: `${primary} مطلوب حتى يؤدي البناء وظيفته العملية المقصودة.`,
      correctEn: `It enables the intended practical function of the build`,
      correctAr: `يمكّن الوظيفة العملية المقصودة للبناء`,
      wrongBEn: `It only decorates the project title card`,
      wrongBAr: `يزيّن بطاقة عنوان المشروع فقط`,
      wrongCEn: `It removes the need for every other listed component`,
      wrongCAr: `يلغي الحاجة لكل المكونات الأخرى المدرجة`,
    },
    {
      conceptKey: 'circuit_troubleshooting',
      promptEn: `If "${snapshot.title}" does not produce the expected result, what should you check first?`,
      promptAr: `إذا لم يُنتج "${snapshot.title}" النتيجة المتوقعة، ما الذي يجب التحقق منه أولًا؟`,
      explanationEn:
        'Re-check completed step outcomes, component orientation, and key connections before changing the design.',
      explanationAr:
        'أعد التحقق من نتائج الخطوات المكتملة وتوجيه المكونات والتوصيلات الأساسية قبل تغيير التصميم.',
      correctEn:
        'Completed steps, component orientation, and key connections',
      correctAr: 'الخطوات المكتملة وتوجيه المكونات والتوصيلات الأساسية',
      wrongBEn: 'Raise power immediately without inspecting connections',
      wrongBAr: 'ارفع الطاقة فورًا دون فحص التوصيلات',
      wrongCEn: `Remove ${primary} permanently and continue`,
      wrongCAr: `أزل ${primary} نهائيًا وتابع`,
    },
    {
      conceptKey: 'sequence_integrity',
      promptEn: firstStep
        ? `Why should earlier steps such as "${firstStep.title}" be completed before later assembly steps?`
        : `Why should earlier published steps be completed before later assembly steps?`,
      promptAr: firstStep
        ? `لماذا يجب إكمال خطوات مبكرة مثل "${firstStep.title}" قبل خطوات التجميع اللاحقة؟`
        : `لماذا يجب إكمال الخطوات المبكرة المنشورة قبل خطوات التجميع اللاحقة؟`,
      explanationEn:
        'Earlier steps create the conditions that later steps depend on.',
      explanationAr:
        'الخطوات المبكرة تهيئ الشروط التي تعتمد عليها الخطوات اللاحقة.',
      correctEn:
        'Later steps depend on conditions created by earlier steps',
      correctAr: 'الخطوات اللاحقة تعتمد على شروط تهيئها الخطوات المبكرة',
      wrongBEn: 'Step order exists only for documentation formatting',
      wrongBAr: 'ترتيب الخطوات موجود فقط لتنسيق التوثيق',
      wrongCEn: 'Any step can replace any other step with the same result',
      wrongCAr: 'أي خطوة يمكن أن تحل محل أي خطوة أخرى بالنتيجة نفسها',
    },
    {
      conceptKey: 'build_verification',
      promptEn: lastStep
        ? `After finishing "${lastStep.title}", what is the best verification action?`
        : `After finishing the final published step, what is the best verification action?`,
      promptAr: lastStep
        ? `بعد إنهاء "${lastStep.title}"، ما أفضل إجراء تحقق؟`
        : `بعد إنهاء آخر خطوة منشورة، ما أفضل إجراء تحقق؟`,
      explanationEn: `Confirm the expected project outcome for "${snapshot.title}" and that required parts like ${primary} are still correctly placed.`,
      explanationAr: `أكد النتيجة المتوقعة لمشروع "${snapshot.title}" وأن الأجزاء المطلوبة مثل ${primary} ما زالت في موضعها الصحيح.`,
      correctEn: `Confirm the expected outcome and correct placement of ${primary}`,
      correctAr: `أكد النتيجة المتوقعة والوضع الصحيح لـ ${primary}`,
      wrongBEn: 'Assume success without checking the practical result',
      wrongBAr: 'افترض النجاح دون التحقق من النتيجة العملية',
      wrongCEn: 'Delete unused materials from the project list automatically',
      wrongCAr: 'احذف المواد غير المستخدمة من قائمة المشروع تلقائيًا',
    },
  ];

  for (const [index, item] of finalItems.entries()) {
    questions.push(
      question({
        stage: 'FINAL',
        questionType: index % 2 === 0 ? 'BEST_ACTION' : 'MULTIPLE_CHOICE',
        conceptKey: item.conceptKey,
        relativeDifficulty: 4,
        promptEn: item.promptEn,
        promptAr: item.promptAr,
        explanationEn: item.explanationEn,
        explanationAr: item.explanationAr,
        hintEn: `Recall how ${primary} and the published steps support ${truncate(goal, 60)}.`,
        hintAr: `تذكر كيف يدعم ${primary} والخطوات المنشورة ${truncate(goal, 60)}.`,
        packDisplayOrder: index + 1,
        correctOptionKey: 'a',
        options: [
          option('a', item.correctEn, item.correctAr, 1),
          option('b', item.wrongBEn, item.wrongBAr, 2),
          option('c', item.wrongCEn, item.wrongCAr, 3),
        ],
      }),
    );
  }

  return {
    schemaVersion: PROJECT_LEARNING_PACK_GENERATOR_SCHEMA_VERSION,
    questions,
  };
};

export class LocalDeterministicProjectLearningPackGeneratorProvider
  implements ProjectLearningPackGeneratorProvider
{
  readonly name = 'local-deterministic';

  async generateProjectLearningPack(
    input: ProjectLearningPackGeneratorInput,
  ): Promise<ProjectLearningPackGeneratorResult> {
    return {
      provider: this.name,
      model: 'local-template-v1',
      data: buildLocalDeterministicLearningPack(input.snapshot),
      latencyMs: 1,
    };
  }
}
