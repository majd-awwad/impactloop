import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../ai/application/ai_assistant_shell_provider.dart';
import '../../application/learning_hub_providers.dart';
import '../../application/learning_session_providers.dart';
import '../../domain/models/project_build.dart';
import '../l10n/final_learning_check_l10n.dart';
import '../l10n/learning_session_l10n.dart';
import '../l10n/project_build_page_l10n.dart';
import '../theme/learning_ui_palette.dart';

const double _finalLearningCheckLayoutBreakpoint = 840;

bool areRequiredBuildStepsComplete(ProjectBuild build) {
  if (build.status == ProjectBuildStatus.completed ||
      build.stepProgress.nextAction == ProjectBuildNextAction.buildCompleted) {
    return true;
  }

  final steps = build.stepProgress.steps;
  if (steps.isEmpty) {
    return false;
  }
  return steps.every((step) => step.state == ProjectBuildStepState.completed);
}

class CompletedReviewFinalCheckUi {
  const CompletedReviewFinalCheckUi({this.actionLabel, this.compactNotice});

  final LocalizedText? actionLabel;
  final LocalizedText? compactNotice;

  bool get hasAction => actionLabel != null;
  bool get hasNotice => compactNotice != null;
  bool get isVisible => hasAction || hasNotice;
}

CompletedReviewFinalCheckUi resolveCompletedReviewFinalCheckUi({
  required ProjectBuild buildRecord,
  required BuildLearningSession? session,
  required ProjectBuildLearningSetup? learningSetup,
}) {
  final setup = learningSetup ?? buildRecord.learningSetup;

  if (buildRecord.status == ProjectBuildStatus.archived) {
    final finals = session?.finalAssignments ?? const [];
    if (finals.isEmpty) {
      return const CompletedReviewFinalCheckUi();
    }
    return const CompletedReviewFinalCheckUi(
      actionLabel: FinalLearningCheckL10n.reviewFinalCheck,
    );
  }

  if (buildRecord.status != ProjectBuildStatus.completed) {
    return const CompletedReviewFinalCheckUi();
  }

  if (!areRequiredBuildStepsComplete(buildRecord)) {
    return const CompletedReviewFinalCheckUi();
  }

  if (setup?.isPreparing == true) {
    return const CompletedReviewFinalCheckUi(
      compactNotice: LearningSessionL10n.preparing,
    );
  }

  if (setup?.isUnavailable == true) {
    return const CompletedReviewFinalCheckUi(
      compactNotice: ProjectBuildPageL10n.finalCheckUnavailable,
    );
  }

  final finals = session?.finalAssignments ?? const [];
  if (finals.isEmpty) {
    if (setup?.isReady == true) {
      return const CompletedReviewFinalCheckUi(
        actionLabel: FinalLearningCheckL10n.start,
      );
    }
    return const CompletedReviewFinalCheckUi();
  }

  final handled = finals.where((item) => item.isComplete).length;
  final remaining = finals.length - handled;
  if (remaining == finals.length) {
    return const CompletedReviewFinalCheckUi(
      actionLabel: FinalLearningCheckL10n.start,
    );
  }
  if (remaining > 0) {
    return const CompletedReviewFinalCheckUi(
      actionLabel: FinalLearningCheckL10n.continueCheck,
    );
  }
  return const CompletedReviewFinalCheckUi(
    actionLabel: FinalLearningCheckL10n.reviewFinalCheck,
  );
}

class FinalLearningCheckSection extends ConsumerWidget {
  const FinalLearningCheckSection({
    super.key,
    required this.projectId,
    required this.buildRecord,
    required this.onOpenCheck,
  });

  final String projectId;
  final ProjectBuild buildRecord;
  final VoidCallback onOpenCheck;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!areRequiredBuildStepsComplete(buildRecord)) {
      return const SizedBox.shrink();
    }

    final setup = buildRecord.learningSetup;
    if (setup?.isPreparing == true) {
      return _messageCard(
        context,
        FinalLearningCheckL10n.supporting.resolve(context),
      );
    }
    if (setup?.isUnavailable == true) {
      return const SizedBox.shrink();
    }

    final sessionAsync = ref.watch(buildLearningSessionProvider(projectId));
    return sessionAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, _) => const SizedBox.shrink(),
      data: (bundle) {
        final finals = bundle.session?.finalAssignments ?? const [];
        if (finals.isEmpty) {
          return const SizedBox.shrink();
        }

        final handled = finals.where((item) => item.isComplete).length;
        final remaining = finals.length - handled;
        final action = remaining == finals.length
            ? FinalLearningCheckL10n.start
            : remaining > 0
            ? FinalLearningCheckL10n.continueCheck
            : FinalLearningCheckL10n.review;

        final palette = LearningUiPalette.of(context);
        return Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.lg),
            side: BorderSide(color: palette.borderSubtle),
          ),
          child: Padding(
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  FinalLearningCheckL10n.title.resolve(context),
                  style: AppTextStyles.title(context),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  FinalLearningCheckL10n.supporting.resolve(context),
                  style: AppTextStyles.body(
                    context,
                  ).copyWith(color: palette.textSecondary),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  '$handled/${finals.length} · ${FinalLearningCheckL10n.progressRemaining.resolve(context)} $remaining',
                  style: AppTextStyles.label(context),
                ),
                const SizedBox(height: AppSpacing.md),
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: FilledButton(
                    onPressed: onOpenCheck,
                    child: Text(action.resolve(context)),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _messageCard(BuildContext context, String text) {
    final palette = LearningUiPalette.of(context);
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        side: BorderSide(color: palette.borderSubtle),
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        child: Text(text, style: AppTextStyles.body(context)),
      ),
    );
  }
}

enum FinalCheckCelebrationCloseAction {
  viewLearningSummary,
  addLearningReflection,
  close,
}

Future<FinalCheckCelebrationCloseAction?> showFinalLearningCheckSheet({
  required BuildContext context,
  required WidgetRef ref,
  required String projectId,
  required ProjectBuild buildRecord,
  Future<void> Function()? onOpenAi,
}) {
  final isDesktop =
      MediaQuery.sizeOf(context).width >= _finalLearningCheckLayoutBreakpoint;

  if (isDesktop) {
    return showDialog<FinalCheckCelebrationCloseAction>(
      context: context,
      barrierDismissible: true,
      builder: (dialogContext) {
        return Dialog(
          insetPadding: const EdgeInsets.all(AppSpacing.lg),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: 640,
              maxHeight: MediaQuery.sizeOf(dialogContext).height * 0.85,
            ),
            child: FinalLearningCheckSheet(
              projectId: projectId,
              buildRecord: buildRecord,
              onOpenAi: onOpenAi,
              isDialogPresentation: true,
            ),
          ),
        );
      },
    );
  }

  return showModalBottomSheet<FinalCheckCelebrationCloseAction>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (sheetContext) {
      return Align(
        alignment: Alignment.bottomCenter,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxWidth: 640,
            maxHeight: MediaQuery.sizeOf(sheetContext).height * 0.9,
          ),
          child: FinalLearningCheckSheet(
            projectId: projectId,
            buildRecord: buildRecord,
            onOpenAi: onOpenAi,
            isDialogPresentation: false,
          ),
        ),
      );
    },
  );
}

class FinalLearningCheckSheet extends ConsumerStatefulWidget {
  const FinalLearningCheckSheet({
    super.key,
    required this.projectId,
    required this.buildRecord,
    this.onOpenAi,
    this.isDialogPresentation = false,
  });

  final String projectId;
  final ProjectBuild buildRecord;
  final Future<void> Function()? onOpenAi;
  final bool isDialogPresentation;

  @override
  ConsumerState<FinalLearningCheckSheet> createState() =>
      _FinalLearningCheckSheetState();
}

class _FinalLearningCheckSheetState
    extends ConsumerState<FinalLearningCheckSheet>
    with SingleTickerProviderStateMixin {
  FinalLearningCheck? _check;
  bool _loading = true;
  bool _busy = false;
  int _index = 0;
  String? _selectedOptionKey;
  bool _showHint = false;
  String? _feedback;
  bool? _lastCorrect;
  String? _inlineError;
  bool _answerSubmitted = false;
  bool _showCelebration = false;
  bool _celebrationTriggeredThisSession = false;
  late final AnimationController _celebrationController;
  late final Animation<double> _celebrationScale;

  @override
  void initState() {
    super.initState();
    _celebrationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _celebrationScale = CurvedAnimation(
      parent: _celebrationController,
      curve: Curves.elasticOut,
    );
    _load();
  }

  @override
  void dispose() {
    _celebrationController.dispose();
    super.dispose();
  }

  String get _languageCode => Localizations.localeOf(context).languageCode;

  bool _isAssignmentHandled(FinalLearningAssignment assignment) {
    return assignment.hasCorrectAttempt ||
        assignment.status == LearningAssignmentStatus.skipped;
  }

  bool _allAssignmentsHandled(FinalLearningCheck check) {
    return check.assignments.every(_isAssignmentHandled);
  }

  void _triggerCelebration() {
    if (_celebrationTriggeredThisSession) {
      return;
    }
    _celebrationTriggeredThisSession = true;
    setState(() => _showCelebration = true);
    _celebrationController.forward(from: 0);
  }

  void _closeCelebration(FinalCheckCelebrationCloseAction action) {
    Navigator.of(context).pop(action);
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _inlineError = null;
    });
    try {
      final check = await ref
          .read(learningHubRepositoryProvider)
          .fetchFinalLearningCheck(widget.projectId);
      if (!mounted) return;
      final firstOpen = check.assignments.indexWhere(
        (item) =>
            !item.hasCorrectAttempt &&
            item.status != LearningAssignmentStatus.skipped,
      );
      setState(() {
        _check = check;
        _index = firstOpen >= 0 ? firstOpen : 0;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _inlineError = FinalLearningCheckL10n.loadError.resolve(context);
      });
    }
  }

  Future<void> _submit() async {
    final check = _check;
    final selected = _selectedOptionKey;
    if (check == null || selected == null || check.isReadOnly) return;
    final assignment = check.assignments[_index];
    setState(() {
      _busy = true;
      _answerSubmitted = false;
    });
    try {
      final result = await ref
          .read(learningHubRepositoryProvider)
          .submitFinalLearningCheckAnswer(
            widget.projectId,
            assignment.assignmentId,
            selectedOptionKey: selected,
          );
      if (!mounted) return;
      final updated = List<FinalLearningAssignment>.from(check.assignments);
      updated[_index] = result.assignment;
      final newCheck = FinalLearningCheck(
        available: check.available,
        isReadOnly: check.isReadOnly,
        progress: result.progress ?? check.progress,
        assignments: updated,
        learningSummary: result.learningSummary ?? check.learningSummary,
      );
      setState(() {
        _check = newCheck;
        _lastCorrect = result.attempt?.isCorrect;
        _answerSubmitted = true;
        _feedback = result.attempt?.isCorrect == true
            ? FinalLearningCheckL10n.correct.resolve(context)
            : FinalLearningCheckL10n.notQuite.resolve(context);
      });
      ref.invalidate(buildLearningSessionProvider(widget.projectId));
    } on ApiException {
      if (mounted) {
        setState(() {
          _inlineError = FinalLearningCheckL10n.answerError.resolve(context);
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _hint() async {
    final check = _check;
    if (check == null || check.isReadOnly) return;
    final assignment = check.assignments[_index];
    setState(() => _busy = true);
    try {
      final updatedAssignment = await ref
          .read(learningHubRepositoryProvider)
          .viewFinalLearningCheckHint(
            widget.projectId,
            assignment.assignmentId,
          );
      if (!mounted) return;
      final updated = List<FinalLearningAssignment>.from(check.assignments);
      updated[_index] = updatedAssignment;
      setState(() {
        _check = FinalLearningCheck(
          available: check.available,
          isReadOnly: check.isReadOnly,
          progress: check.progress,
          assignments: updated,
          learningSummary: check.learningSummary,
        );
        _showHint = true;
      });
    } on ApiException {
      if (mounted) {
        setState(() {
          _inlineError = FinalLearningCheckL10n.hintError.resolve(context);
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _skip() async {
    final check = _check;
    if (check == null || check.isReadOnly) return;
    final assignment = check.assignments[_index];
    setState(() => _busy = true);
    try {
      final result = await ref
          .read(learningHubRepositoryProvider)
          .skipFinalLearningCheckAssignment(
            widget.projectId,
            assignment.assignmentId,
          );
      if (!mounted) return;
      final updated = List<FinalLearningAssignment>.from(check.assignments);
      updated[_index] = result.assignment;
      setState(() {
        _check = FinalLearningCheck(
          available: check.available,
          isReadOnly: check.isReadOnly,
          progress: result.progress ?? check.progress,
          assignments: updated,
          learningSummary: result.learningSummary ?? check.learningSummary,
        );
        _selectedOptionKey = null;
        _showHint = false;
        _feedback = null;
        _answerSubmitted = false;
      });
      ref.invalidate(buildLearningSessionProvider(widget.projectId));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _askAi() async {
    final check = _check;
    if (check == null || check.assignments[_index].attemptCount == 0) return;
    setState(() => _busy = true);
    try {
      final handoff = await ref
          .read(learningHubRepositoryProvider)
          .fetchFinalLearningCheckAiHandoff(
            widget.projectId,
            check.assignments[_index].assignmentId,
          );
      if (!mounted) return;
      ref
          .read(aiAssistantShellProvider.notifier)
          .open(composerPrefill: handoff.suggestedPromptFor(_languageCode));
      await widget.onOpenAi?.call();
    } on ApiException {
      if (mounted) {
        setState(() {
          _inlineError = FinalLearningCheckL10n.aiHandoffError.resolve(context);
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reportUnclear() async {
    final check = _check;
    if (check == null) return;
    setState(() {
      _busy = true;
      _inlineError = null;
    });
    try {
      await ref
          .read(learningHubRepositoryProvider)
          .reportLearningAssignmentUnclear(
            widget.projectId,
            check.assignments[_index].assignmentId,
          );
      if (!mounted) return;
      setState(() {
        _feedback = FinalLearningCheckL10n.reportUnclearThanks.resolve(context);
        final assignment = check.assignments[_index];
        final updated = List<FinalLearningAssignment>.from(check.assignments);
        updated[_index] = FinalLearningAssignment(
          assignmentId: assignment.assignmentId,
          questionId: assignment.questionId,
          stage: assignment.stage,
          questionType: assignment.questionType,
          displayOrder: assignment.displayOrder,
          status: assignment.status,
          uiState: assignment.uiState,
          attemptCount: assignment.attemptCount,
          hintViewed: assignment.hintViewed,
          unclearReported: true,
          mayRetry: assignment.mayRetry,
          isReadOnly: assignment.isReadOnly,
          question: assignment.question,
          answerAttempts: assignment.answerAttempts,
          hasCorrectAttempt: assignment.hasCorrectAttempt,
          latestSelectedOptionKey: assignment.latestSelectedOptionKey,
          correctOptionKey: assignment.correctOptionKey,
          latestResult: assignment.latestResult,
        );
        _check = FinalLearningCheck(
          available: check.available,
          isReadOnly: check.isReadOnly,
          progress: check.progress,
          assignments: updated,
          learningSummary: check.learningSummary,
        );
      });
    } on ApiException {
      if (mounted) {
        setState(() {
          _inlineError = FinalLearningCheckL10n.reportUnclearError.resolve(
            context,
          );
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _goToNextQuestion() {
    final check = _check;
    if (check == null) return;
    setState(() {
      _index = (_index + 1).clamp(0, check.assignments.length - 1);
      _selectedOptionKey = null;
      _showHint = false;
      _feedback = null;
      _answerSubmitted = false;
      _lastCorrect = null;
    });
  }

  void _finishCheck() {
    final check = _check;
    if (check != null && _allAssignmentsHandled(check)) {
      _triggerCelebration();
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final borderRadius = widget.isDialogPresentation
        ? BorderRadius.circular(AppRadius.lg)
        : const BorderRadius.vertical(top: Radius.circular(AppRadius.xl));

    return Material(
      color: palette.cardSurface,
      borderRadius: borderRadius,
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: EdgeInsetsDirectional.only(
          start: AppSpacing.lg,
          end: AppSpacing.lg,
          top: AppSpacing.lg,
          bottom: widget.isDialogPresentation
              ? AppSpacing.lg
              : AppSpacing.lg + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _check == null
            ? Text(
                _inlineError ??
                    FinalLearningCheckL10n.loadError.resolve(context),
              )
            : _buildShell(context, _check!),
      ),
    );
  }

  Widget _buildShell(BuildContext context, FinalLearningCheck check) {
    final screenHeight = MediaQuery.sizeOf(context).height;
    final maxContentHeight =
        screenHeight * (widget.isDialogPresentation ? 0.85 : 0.9) - 140;

    if (_showCelebration) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ConstrainedBox(
            constraints: BoxConstraints(maxHeight: maxContentHeight),
            child: SingleChildScrollView(child: _buildCelebration(context)),
          ),
          _buildCelebrationActions(context),
        ],
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ConstrainedBox(
          constraints: BoxConstraints(maxHeight: maxContentHeight),
          child: SingleChildScrollView(
            child: _buildQuestionBody(context, check),
          ),
        ),
        _buildQuestionActions(context, check),
      ],
    );
  }

  Widget _buildCelebration(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(
          child: ScaleTransition(
            scale: _celebrationScale,
            child: Icon(
              Icons.emoji_events_outlined,
              size: 56,
              color: palette.lime,
              semanticLabel: FinalLearningCheckL10n.celebrationTitle.en,
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Semantics(
          header: true,
          child: Text(
            FinalLearningCheckL10n.celebrationTitle.resolve(context),
            style: AppTextStyles.title(context),
            textAlign: TextAlign.center,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          FinalLearningCheckL10n.supporting.resolve(context),
          style: AppTextStyles.body(
            context,
          ).copyWith(color: palette.textSecondary),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildCelebrationActions(BuildContext context) {
    final buildCompleted =
        widget.buildRecord.status == ProjectBuildStatus.completed ||
        widget.buildRecord.status == ProjectBuildStatus.archived;
    final isMobile = MediaQuery.sizeOf(context).width < 600;

    Widget primaryButton = SizedBox(
      width: isMobile ? double.infinity : null,
      height: 52,
      child: FilledButton(
        onPressed: () => _closeCelebration(
          FinalCheckCelebrationCloseAction.viewLearningSummary,
        ),
        child: Text(
          FinalLearningCheckL10n.viewLearningSummary.resolve(context),
        ),
      ),
    );

    Widget? secondaryButton;
    if (buildCompleted) {
      secondaryButton = SizedBox(
        width: isMobile ? double.infinity : null,
        height: 52,
        child: OutlinedButton(
          onPressed: () => _closeCelebration(
            FinalCheckCelebrationCloseAction.addLearningReflection,
          ),
          child: Text(FinalLearningCheckL10n.addReflection.resolve(context)),
        ),
      );
    }

    final closeButton = SizedBox(
      width: isMobile ? double.infinity : null,
      height: 52,
      child: TextButton(
        onPressed: () =>
            _closeCelebration(FinalCheckCelebrationCloseAction.close),
        child: Text(FinalLearningCheckL10n.close.resolve(context)),
      ),
    );

    if (isMobile) {
      return Padding(
        padding: const EdgeInsetsDirectional.only(top: AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            primaryButton,
            if (secondaryButton != null) ...[
              const SizedBox(height: AppSpacing.sm),
              secondaryButton,
            ],
            const SizedBox(height: AppSpacing.sm),
            closeButton,
          ],
        ),
      );
    }

    return Padding(
      padding: const EdgeInsetsDirectional.only(top: AppSpacing.md),
      child: Wrap(
        spacing: AppSpacing.sm,
        runSpacing: AppSpacing.sm,
        alignment: WrapAlignment.end,
        children: [closeButton, ?secondaryButton, primaryButton],
      ),
    );
  }

  Widget _buildQuestionBody(BuildContext context, FinalLearningCheck check) {
    final palette = LearningUiPalette.of(context);
    final assignment = check.assignments[_index];
    final question = assignment.question;
    final showResults = assignment.attemptCount > 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          FinalLearningCheckL10n.title.resolve(context),
          style: AppTextStyles.title(context),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          '${FinalLearningCheckL10n.questionProgress.resolve(context)} ${_index + 1}/${check.assignments.length}',
          style: AppTextStyles.label(context),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          FinalLearningCheckL10n.optional.resolve(context),
          style: AppTextStyles.body(
            context,
          ).copyWith(color: palette.textSecondary),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          question.promptFor(_languageCode),
          style: AppTextStyles.body(context),
        ),
        const SizedBox(height: AppSpacing.md),
        ...question.options.map(
          (option) => Padding(
            padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.xs),
            child: _LearningRadioOptionCard(
              label: option.promptFor(_languageCode),
              selected:
                  _selectedOptionKey == option.optionKey ||
                  assignment.latestSelectedOptionKey == option.optionKey,
              enabled: !check.isReadOnly && !assignment.isReadOnly && !_busy,
              showResult: showResults,
              isCorrectOption: _isCorrectOption(assignment, option.optionKey),
              isIncorrectSelection:
                  showResults &&
                  assignment.latestSelectedOptionKey == option.optionKey &&
                  assignment.latestResult != null &&
                  !assignment.latestResult!.isCorrect,
              onTap: () =>
                  setState(() => _selectedOptionKey = option.optionKey),
            ),
          ),
        ),
        if (_showHint || assignment.hintViewed) ...[
          const SizedBox(height: AppSpacing.sm),
          Container(
            padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: palette.hintSurface,
              borderRadius: BorderRadius.circular(AppRadius.md),
              border: Border.all(color: palette.hintBorder),
            ),
            child: Text(
              question.hintFor(_languageCode),
              style: AppTextStyles.body(context),
            ),
          ),
        ],
        if (_feedback != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            _feedback!,
            style: AppTextStyles.body(context).copyWith(
              color: _lastCorrect == true
                  ? Colors.green.shade700
                  : Colors.orange.shade800,
            ),
          ),
        ],
        if (_answerSubmitted && assignment.latestResult != null) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            assignment.latestResult!.explanationFor(_languageCode),
            style: AppTextStyles.body(context),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            FinalLearningCheckL10n.answerSaved.resolve(context),
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
        ],
        if (_inlineError != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            _inlineError!,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: Colors.orange.shade800),
          ),
        ],
      ],
    );
  }

  bool _isCorrectOption(FinalLearningAssignment assignment, String optionKey) {
    final correctKey =
        assignment.correctOptionKey ??
        assignment.latestResult?.correctOptionKey;
    if (correctKey != null) {
      return optionKey == correctKey;
    }
    return assignment.hasCorrectAttempt &&
        assignment.latestSelectedOptionKey == optionKey &&
        assignment.latestResult?.isCorrect == true;
  }

  Widget _buildQuestionActions(BuildContext context, FinalLearningCheck check) {
    final assignment = check.assignments[_index];
    final canMutate = !check.isReadOnly && !assignment.isReadOnly;
    final handled = _isAssignmentHandled(assignment);
    final isLast = _index >= check.assignments.length - 1;
    final showAi =
        assignment.attemptCount > 0 && widget.onOpenAi != null && canMutate;

    return Padding(
      padding: const EdgeInsetsDirectional.only(top: AppSpacing.md),
      child: Wrap(
        spacing: AppSpacing.sm,
        runSpacing: AppSpacing.xs,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          if (canMutate && !handled)
            FilledButton(
              onPressed: _busy || _selectedOptionKey == null ? null : _submit,
              child: Text(
                assignment.attemptCount > 0 && !assignment.hasCorrectAttempt
                    ? FinalLearningCheckL10n.tryAgain.resolve(context)
                    : FinalLearningCheckL10n.submitAnswer.resolve(context),
              ),
            ),
          if (canMutate && handled && isLast)
            FilledButton(
              onPressed: _busy ? null : _finishCheck,
              child: Text(FinalLearningCheckL10n.finishCheck.resolve(context)),
            ),
          if (canMutate && handled && !isLast)
            FilledButton(
              onPressed: _busy ? null : _goToNextQuestion,
              child: Text(FinalLearningCheckL10n.nextQuestion.resolve(context)),
            ),
          if (canMutate && !handled && !assignment.hasCorrectAttempt)
            OutlinedButton(
              onPressed: _busy ? null : _hint,
              child: Text(FinalLearningCheckL10n.showHint.resolve(context)),
            ),
          if (canMutate && !handled)
            TextButton(
              onPressed: _busy ? null : _skip,
              child: Text(FinalLearningCheckL10n.skipForNow.resolve(context)),
            ),
          PopupMenuButton<String>(
            tooltip: FinalLearningCheckL10n.moreActions.resolve(context),
            onSelected: (value) {
              switch (value) {
                case 'unclear':
                  _reportUnclear();
                case 'ai':
                  _askAi();
                case 'close':
                  Navigator.of(context).pop();
              }
            },
            itemBuilder: (menuContext) => [
              if (canMutate && !assignment.unclearReported)
                PopupMenuItem(
                  value: 'unclear',
                  child: Text(
                    FinalLearningCheckL10n.reportUnclear.resolve(context),
                  ),
                ),
              if (showAi)
                PopupMenuItem(
                  value: 'ai',
                  child: Text(FinalLearningCheckL10n.askAi.resolve(context)),
                ),
              PopupMenuItem(
                value: 'close',
                child: Text(FinalLearningCheckL10n.close.resolve(context)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _LearningRadioOptionCard extends StatelessWidget {
  const _LearningRadioOptionCard({
    required this.label,
    required this.selected,
    required this.enabled,
    required this.showResult,
    required this.isCorrectOption,
    required this.isIncorrectSelection,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final bool enabled;
  final bool showResult;
  final bool isCorrectOption;
  final bool isIncorrectSelection;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    Color borderColor = palette.borderSubtle;
    Color backgroundColor = palette.cardSurface;
    IconData? trailingIcon;
    Color? iconColor;

    if (showResult) {
      if (isCorrectOption) {
        borderColor = Colors.green.shade600;
        backgroundColor = Colors.green.shade50;
        trailingIcon = Icons.check_circle;
        iconColor = Colors.green.shade700;
      } else if (isIncorrectSelection) {
        borderColor = Colors.orange.shade700;
        backgroundColor = Colors.orange.shade50;
        trailingIcon = Icons.cancel;
        iconColor = Colors.orange.shade800;
      }
    } else if (selected) {
      borderColor = palette.lime;
      backgroundColor = palette.limeSoft;
      trailingIcon = Icons.radio_button_checked;
      iconColor = palette.lime;
    } else {
      trailingIcon = Icons.radio_button_off;
      iconColor = palette.textSecondary;
    }

    return Material(
      color: backgroundColor,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: Container(
          padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(
              color: borderColor,
              width: selected || showResult ? 2 : 1,
            ),
          ),
          child: Row(
            children: [
              Expanded(child: Text(label, style: AppTextStyles.body(context))),
              if (trailingIcon != null)
                Icon(trailingIcon, color: iconColor, size: 22),
            ],
          ),
        ),
      ),
    );
  }
}

class LearningSummarySection extends StatelessWidget {
  const LearningSummarySection({super.key, required this.summary});

  final BuildLearningSummary summary;

  @override
  Widget build(BuildContext context) {
    final languageCode = Localizations.localeOf(context).languageCode;
    final palette = LearningUiPalette.of(context);
    final hasUnderstood = summary.understoodConcepts.isNotEmpty;
    final hasReview = summary.reviewConcepts.isNotEmpty;
    final hasUnchecked = summary.uncheckedConceptCount > 0;
    final hasConfidence =
        summary.confidenceBefore != null && summary.confidenceAfter != null;

    if (!hasUnderstood && !hasReview && !hasUnchecked && !hasConfidence) {
      return const SizedBox.shrink();
    }

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        side: BorderSide(color: palette.borderSubtle),
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              FinalLearningCheckL10n.summaryTitle.resolve(context),
              style: AppTextStyles.title(context),
            ),
            if (hasUnderstood) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                FinalLearningCheckL10n.understood.resolve(context),
                style: AppTextStyles.label(context),
              ),
              const SizedBox(height: AppSpacing.xs),
              Wrap(
                spacing: AppSpacing.xs,
                runSpacing: AppSpacing.xs,
                children: summary.understoodConcepts
                    .map(
                      (item) => Chip(
                        label: Text(item.labelFor(languageCode)),
                        backgroundColor: palette.limeSoft,
                        side: BorderSide(color: palette.lime),
                      ),
                    )
                    .toList(growable: false),
              ),
            ],
            if (hasReview) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                FinalLearningCheckL10n.reviewConcepts.resolve(context),
                style: AppTextStyles.label(context),
              ),
              const SizedBox(height: AppSpacing.xs),
              Wrap(
                spacing: AppSpacing.xs,
                runSpacing: AppSpacing.xs,
                children: summary.reviewConcepts
                    .map(
                      (item) => Chip(
                        label: Text(item.labelFor(languageCode)),
                        backgroundColor: palette.mutedChip,
                        side: BorderSide(color: palette.borderSubtle),
                      ),
                    )
                    .toList(growable: false),
              ),
            ],
            if (hasUnchecked) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                '${FinalLearningCheckL10n.unchecked.resolve(context)}: ${summary.uncheckedConceptCount}',
              ),
            ],
            if (hasConfidence) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                _confidenceText(
                  context,
                  summary.confidenceBefore!,
                  summary.confidenceAfter!,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _confidenceText(BuildContext context, int before, int after) {
    final label = FinalLearningCheckL10n.confidenceProgressLabel.resolve(
      context,
    );
    if (Localizations.localeOf(context).languageCode == 'ar') {
      return '$label: $before ← $after';
    }
    return '$label: $before → $after';
  }
}

class LearningReflectionSection extends ConsumerStatefulWidget {
  const LearningReflectionSection({
    super.key,
    required this.projectId,
    required this.buildRecord,
    required this.session,
  });

  final String projectId;
  final ProjectBuild buildRecord;
  final BuildLearningSession session;

  @override
  ConsumerState<LearningReflectionSection> createState() =>
      _LearningReflectionSectionState();
}

class _LearningReflectionSectionState
    extends ConsumerState<LearningReflectionSection> {
  late final TextEditingController _reflectionController;
  LearningGoalOutcome? _goalOutcome;
  int? _confidenceAfter;
  bool _busy = false;
  bool _saved = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _reflectionController = TextEditingController(
      text: widget.session.finalReflection ?? '',
    );
    _goalOutcome = widget.session.goalOutcome;
    _confidenceAfter = widget.session.confidenceAfter;
  }

  @override
  void dispose() {
    _reflectionController.dispose();
    super.dispose();
  }

  LocalizedText _confidenceAnchor(int value) {
    return switch (value) {
      1 => FinalLearningCheckL10n.confidenceAnchor1,
      2 => FinalLearningCheckL10n.confidenceAnchor2,
      3 => FinalLearningCheckL10n.confidenceAnchor3,
      4 => FinalLearningCheckL10n.confidenceAnchor4,
      5 => FinalLearningCheckL10n.confidenceAnchor5,
      _ => FinalLearningCheckL10n.confidenceAnchor3,
    };
  }

  Future<void> _save() async {
    if (widget.buildRecord.status != ProjectBuildStatus.completed) {
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _saved = false;
    });
    try {
      await ref
          .read(learningHubRepositoryProvider)
          .updateLearningCompletionReflection(
            widget.projectId,
            goalOutcome: _goalOutcome,
            confidenceAfter: _confidenceAfter,
            finalReflection: _reflectionController.text,
          );
      ref.invalidate(buildLearningSessionProvider(widget.projectId));
      if (mounted) {
        setState(() => _saved = true);
      }
    } on ApiException {
      if (mounted) {
        setState(() {
          _error = FinalLearningCheckL10n.reflectionError.resolve(context);
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _saveButtonLabel(BuildContext context) {
    if (_busy) {
      return FinalLearningCheckL10n.savingReflection.resolve(context);
    }
    if (_saved) {
      return FinalLearningCheckL10n.savedReflection.resolve(context);
    }
    return FinalLearningCheckL10n.saveLearningReflection.resolve(context);
  }

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final readOnly = widget.buildRecord.status == ProjectBuildStatus.archived;
    final canSave =
        widget.buildRecord.status == ProjectBuildStatus.completed && !readOnly;
    final goal = widget.session.learningGoal;

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        side: BorderSide(color: palette.borderSubtle),
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              FinalLearningCheckL10n.reflectionTitle.resolve(context),
              style: AppTextStyles.title(context),
            ),
            if (goal != null && goal.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(goal, style: AppTextStyles.body(context)),
            ],
            const SizedBox(height: AppSpacing.md),
            Text(
              FinalLearningCheckL10n.goalOutcomeLabel.resolve(context),
              style: AppTextStyles.label(context),
            ),
            const SizedBox(height: AppSpacing.xs),
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: [
                _GoalOutcomeChip(
                  label: FinalLearningCheckL10n.goalAchieved.resolve(context),
                  selected: _goalOutcome == LearningGoalOutcome.achieved,
                  onSelected: readOnly
                      ? null
                      : () => setState(
                          () => _goalOutcome = LearningGoalOutcome.achieved,
                        ),
                ),
                _GoalOutcomeChip(
                  label: FinalLearningCheckL10n.goalPartial.resolve(context),
                  selected:
                      _goalOutcome == LearningGoalOutcome.partiallyAchieved,
                  onSelected: readOnly
                      ? null
                      : () => setState(
                          () => _goalOutcome =
                              LearningGoalOutcome.partiallyAchieved,
                        ),
                ),
                _GoalOutcomeChip(
                  label: FinalLearningCheckL10n.goalNotYet.resolve(context),
                  selected: _goalOutcome == LearningGoalOutcome.notYetAchieved,
                  onSelected: readOnly
                      ? null
                      : () => setState(
                          () =>
                              _goalOutcome = LearningGoalOutcome.notYetAchieved,
                        ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              FinalLearningCheckL10n.confidenceAfterLabel.resolve(context),
              style: AppTextStyles.label(context),
            ),
            const SizedBox(height: AppSpacing.xs),
            ...List.generate(5, (index) {
              final value = index + 1;
              final selected = _confidenceAfter == value;
              return Padding(
                padding: const EdgeInsetsDirectional.only(
                  bottom: AppSpacing.xs,
                ),
                child: Material(
                  color: selected ? palette.limeSoft : palette.cardSurface,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  child: InkWell(
                    onTap: readOnly
                        ? null
                        : () => setState(() => _confidenceAfter = value),
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    child: Container(
                      padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(AppRadius.md),
                        border: Border.all(
                          color: selected ? palette.lime : palette.borderSubtle,
                          width: selected ? 2 : 1,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            selected
                                ? Icons.radio_button_checked
                                : Icons.radio_button_off,
                            color: selected
                                ? palette.lime
                                : palette.textSecondary,
                            size: 20,
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Text(
                              _confidenceAnchor(value).resolve(context),
                              style: AppTextStyles.body(context),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            }),
            if (widget.session.confidenceBefore != null &&
                _confidenceAfter != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                _confidenceProgressText(
                  context,
                  widget.session.confidenceBefore!,
                  _confidenceAfter!,
                ),
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.textSecondary),
              ),
            ],
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: _reflectionController,
              minLines: 4,
              maxLines: 6,
              maxLength: 1500,
              enabled: !readOnly,
              onChanged: (_) {
                if (_saved) setState(() => _saved = false);
              },
              decoration: InputDecoration(
                labelText: FinalLearningCheckL10n.reflectionPrompt.resolve(
                  context,
                ),
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              (_saved
                      ? FinalLearningCheckL10n.reflectionSavedDestination
                      : FinalLearningCheckL10n.reflectionDestination)
                  .resolve(context),
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textSecondary),
            ),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                _error!,
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: Colors.orange.shade800),
              ),
            ],
            const SizedBox(height: AppSpacing.md),
            if (canSave)
              FilledButton(
                onPressed: _busy ? null : _save,
                child: Text(_saveButtonLabel(context)),
              ),
            if (_saved) ...[
              const SizedBox(height: AppSpacing.md),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  OutlinedButton(
                    onPressed: () {},
                    child: Text(
                      FinalLearningCheckL10n.stayOnBuild.resolve(context),
                    ),
                  ),
                  FilledButton(
                    onPressed: () => context.push(learnerPortfolioRoute),
                    child: Text(
                      FinalLearningCheckL10n.viewPrivatePortfolio.resolve(
                        context,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _confidenceProgressText(BuildContext context, int before, int after) {
    final label = FinalLearningCheckL10n.confidenceProgressLabel.resolve(
      context,
    );
    if (Localizations.localeOf(context).languageCode == 'ar') {
      return '$label: $before ← $after';
    }
    return '$label: $before → $after';
  }
}

class _GoalOutcomeChip extends StatelessWidget {
  const _GoalOutcomeChip({
    required this.label,
    required this.selected,
    required this.onSelected,
  });

  final String label;
  final bool selected;
  final VoidCallback? onSelected;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Material(
      color: selected ? palette.limeSoft : palette.cardSurface,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: InkWell(
        onTap: onSelected,
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: Container(
          padding: const EdgeInsetsDirectional.symmetric(
            horizontal: AppSpacing.sm,
            vertical: AppSpacing.xs,
          ),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(
              color: selected ? palette.lime : palette.borderSubtle,
              width: selected ? 2 : 1,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (selected)
                Padding(
                  padding: const EdgeInsetsDirectional.only(end: AppSpacing.xs),
                  child: Icon(Icons.check, color: palette.lime, size: 18),
                ),
              Text(label, style: AppTextStyles.body(context)),
            ],
          ),
        ),
      ),
    );
  }
}
