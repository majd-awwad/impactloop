import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../ai/application/ai_assistant_shell_provider.dart';
import '../../application/learning_hub_providers.dart';
import '../../application/learning_session_providers.dart';
import '../../domain/models/project_build.dart';
import '../l10n/step_learning_check_l10n.dart';
import '../theme/learning_ui_palette.dart';

const double _stepLearningCheckLayoutBreakpoint = 840;

class StepLearningCheckStatusRow extends ConsumerWidget {
  const StepLearningCheckStatusRow({
    super.key,
    required this.projectId,
    required this.buildRecord,
    required this.step,
    required this.onOpenCheck,
  });

  final String projectId;
  final ProjectBuild buildRecord;
  final ProjectBuildStepView step;
  final VoidCallback onOpenCheck;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (step.state != ProjectBuildStepState.completed) {
      return const SizedBox.shrink();
    }

    final sessionAsync = ref.watch(buildLearningSessionProvider(projectId));
    return sessionAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, _) => const SizedBox.shrink(),
      data: (bundle) {
        final assignment = bundle.session?.assignmentForStep(step.stepId);
        if (assignment == null) {
          return const SizedBox.shrink();
        }

        final readOnly = buildRecord.isEditingLocked;
        final uiState = assignment.uiState(readOnly: readOnly);
        final palette = LearningUiPalette.of(context);

        return Padding(
          padding: const EdgeInsetsDirectional.only(top: AppSpacing.sm),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  _statusLabel(uiState).resolve(context),
                  style: AppTextStyles.body(context).copyWith(
                    color: palette.textSecondary,
                  ),
                ),
              ),
              TextButton(
                onPressed: onOpenCheck,
                child: Text(_actionLabel(uiState).resolve(context)),
              ),
            ],
          ),
        );
      },
    );
  }

  LocalizedText _statusLabel(StepLearningCheckUiState state) {
    return switch (state) {
      StepLearningCheckUiState.notAttempted =>
        StepLearningCheckL10n.statusNotAttempted,
      StepLearningCheckUiState.incorrect =>
        StepLearningCheckL10n.statusIncorrect,
      StepLearningCheckUiState.correct => StepLearningCheckL10n.statusCorrect,
      StepLearningCheckUiState.skipped => StepLearningCheckL10n.statusSkipped,
      StepLearningCheckUiState.reviewed => StepLearningCheckL10n.statusCorrect,
    };
  }

  LocalizedText _actionLabel(StepLearningCheckUiState state) {
    return switch (state) {
      StepLearningCheckUiState.notAttempted => StepLearningCheckL10n.actionStart,
      StepLearningCheckUiState.incorrect =>
        StepLearningCheckL10n.actionTryAgain,
      StepLearningCheckUiState.skipped => StepLearningCheckL10n.actionContinue,
      StepLearningCheckUiState.correct ||
      StepLearningCheckUiState.reviewed =>
        StepLearningCheckL10n.actionReview,
    };
  }
}

Future<void> showStepLearningCheckSheet({
  required BuildContext context,
  required WidgetRef ref,
  required String projectId,
  required ProjectBuild buildRecord,
  required ProjectBuildStepView step,
  Future<void> Function()? onOpenAi,
}) {
  final isDesktop =
      MediaQuery.sizeOf(context).width >= _stepLearningCheckLayoutBreakpoint;

  if (isDesktop) {
    return showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return Dialog(
          insetPadding: const EdgeInsets.all(AppSpacing.lg),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: 640,
              maxHeight: MediaQuery.sizeOf(dialogContext).height * 0.85,
            ),
            child: StepLearningCheckSheet(
              projectId: projectId,
              buildRecord: buildRecord,
              step: step,
              onOpenAi: onOpenAi,
              isDialogPresentation: true,
            ),
          ),
        );
      },
    );
  }

  return showModalBottomSheet<void>(
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
          child: StepLearningCheckSheet(
            projectId: projectId,
            buildRecord: buildRecord,
            step: step,
            onOpenAi: onOpenAi,
            isDialogPresentation: false,
          ),
        ),
      );
    },
  );
}

class StepLearningCheckSheet extends ConsumerStatefulWidget {
  const StepLearningCheckSheet({
    super.key,
    required this.projectId,
    required this.buildRecord,
    required this.step,
    this.onOpenAi,
    this.isDialogPresentation = false,
  });

  final String projectId;
  final ProjectBuild buildRecord;
  final ProjectBuildStepView step;
  final Future<void> Function()? onOpenAi;
  final bool isDialogPresentation;

  @override
  ConsumerState<StepLearningCheckSheet> createState() =>
      _StepLearningCheckSheetState();
}

class _StepLearningCheckSheetState extends ConsumerState<StepLearningCheckSheet> {
  StepLearningCheck? _check;
  bool _loading = true;
  bool _busy = false;
  String? _inlineError;
  String? _selectedOptionKey;
  bool _showHint = false;
  String? _feedbackMessage;
  bool? _lastAnswerCorrect;
  bool _answerSubmitted = false;
  bool _showCompletionScreen = false;
  bool _reviewingFromCompletion = false;

  @override
  void initState() {
    super.initState();
    _loadCheck();
  }

  String get _languageCode => Localizations.localeOf(context).languageCode;

  bool _isCheckComplete(StepLearningCheck check) {
    return check.hasCorrectAttempt ||
        check.status == LearningAssignmentStatus.skipped;
  }

  Future<void> _loadCheck() async {
    setState(() {
      _loading = true;
      _inlineError = null;
    });

    try {
      final check = await ref
          .read(learningHubRepositoryProvider)
          .fetchStepLearningCheck(widget.projectId, widget.step.stepId);
      if (!mounted) return;
      setState(() {
        _check = check;
        if (check?.unclearReported == true) {
          _feedbackMessage =
              StepLearningCheckL10n.reportUnclearThanks.resolve(context);
        }
        if (check != null && _isCheckComplete(check)) {
          _showCompletionScreen = true;
        }
        _loading = false;
      });
    } on ApiException {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _inlineError = StepLearningCheckL10n.loadError.resolve(context);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _inlineError = StepLearningCheckL10n.loadError.resolve(context);
      });
    }
  }

  Future<void> _submitAnswer() async {
    final selected = _selectedOptionKey;
    if (selected == null || _check == null || _check!.isReadOnly) {
      return;
    }

    setState(() {
      _busy = true;
      _inlineError = null;
      _feedbackMessage = null;
      _answerSubmitted = false;
    });

    try {
      final result = await ref
          .read(learningHubRepositoryProvider)
          .submitStepLearningCheckAnswer(
            widget.projectId,
            widget.step.stepId,
            selectedOptionKey: selected,
          );
      if (!mounted) return;
      setState(() {
        _check = result.check;
        _lastAnswerCorrect = result.attempt.isCorrect;
        _answerSubmitted = true;
        _feedbackMessage = result.attempt.isCorrect
            ? StepLearningCheckL10n.correct.resolve(context)
            : StepLearningCheckL10n.notQuite.resolve(context);
      });
      ref.invalidate(buildLearningSessionProvider(widget.projectId));
    } on ApiException {
      if (!mounted) return;
      setState(() {
        _inlineError = StepLearningCheckL10n.answerError.resolve(context);
      });
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _viewHint() async {
    if (_check == null || _check!.isReadOnly) {
      return;
    }

    setState(() => _busy = true);
    try {
      final updated = await ref
          .read(learningHubRepositoryProvider)
          .viewStepLearningCheckHint(
            widget.projectId,
            widget.step.stepId,
          );
      if (!mounted) return;
      setState(() {
        _check = updated;
        _showHint = true;
      });
    } on ApiException {
      if (!mounted) return;
      setState(() {
        _inlineError = StepLearningCheckL10n.hintError.resolve(context);
      });
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _skipCheck() async {
    if (_check == null || _check!.isReadOnly) {
      return;
    }

    setState(() => _busy = true);
    try {
      final updated = await ref
          .read(learningHubRepositoryProvider)
          .skipStepLearningCheck(widget.projectId, widget.step.stepId);
      if (!mounted) return;
      setState(() {
        _check = updated;
        _feedbackMessage = null;
        _answerSubmitted = true;
      });
      ref.invalidate(buildLearningSessionProvider(widget.projectId));
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _openAiHandoff() async {
    if (_check == null || _check!.attemptCount == 0) {
      return;
    }

    setState(() => _busy = true);
    try {
      final handoff = await ref
          .read(learningHubRepositoryProvider)
          .fetchStepLearningCheckAiHandoff(
            widget.projectId,
            widget.step.stepId,
          );
      if (!mounted) return;
      if (widget.onOpenAi != null) {
        ref.read(aiAssistantShellProvider.notifier).open(
              composerPrefill: handoff.suggestedPromptFor(_languageCode),
            );
        await widget.onOpenAi!();
      }
    } on ApiException {
      if (!mounted) return;
      setState(() {
        _inlineError = StepLearningCheckL10n.aiHandoffError.resolve(context);
      });
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _reportUnclear() async {
    final check = _check;
    if (check == null) {
      return;
    }
    setState(() {
      _busy = true;
      _inlineError = null;
    });
    try {
      await ref.read(learningHubRepositoryProvider).reportLearningAssignmentUnclear(
            widget.projectId,
            check.assignmentId,
          );
      if (!mounted) return;
      setState(() {
        _inlineError = null;
        _feedbackMessage =
            StepLearningCheckL10n.reportUnclearThanks.resolve(context);
        final current = _check;
        if (current != null) {
          _check = StepLearningCheck(
            assignmentId: current.assignmentId,
            stepId: current.stepId,
            stage: current.stage,
            questionType: current.questionType,
            displayOrder: current.displayOrder,
            status: current.status,
            uiState: current.uiState,
            attemptCount: current.attemptCount,
            hintViewed: current.hintViewed,
            unclearReported: true,
            mayRetry: current.mayRetry,
            isReadOnly: current.isReadOnly,
            question: current.question,
            answerAttempts: current.answerAttempts,
            latestSelectedOptionKey: current.latestSelectedOptionKey,
            hasCorrectAttempt: current.hasCorrectAttempt,
            correctOptionKey: current.correctOptionKey,
            latestResult: current.latestResult,
          );
        }
      });
    } on ApiException {
      if (!mounted) return;
      setState(() {
        _inlineError = StepLearningCheckL10n.reportUnclearError.resolve(context);
      });
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
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
            ? _buildErrorState(context)
            : _buildShell(context, _check!),
      ),
    );
  }

  Widget _buildErrorState(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          _inlineError ?? StepLearningCheckL10n.loadError.resolve(context),
          style: AppTextStyles.body(context),
        ),
        const SizedBox(height: AppSpacing.md),
        Align(
          alignment: AlignmentDirectional.centerEnd,
          child: TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(StepLearningCheckL10n.close.resolve(context)),
          ),
        ),
      ],
    );
  }

  Widget _buildShell(BuildContext context, StepLearningCheck check) {
    final showCompletion =
        _showCompletionScreen && !_reviewingFromCompletion && _isCheckComplete(check);

    final screenHeight = MediaQuery.sizeOf(context).height;
    final maxContentHeight =
        screenHeight * (widget.isDialogPresentation ? 0.85 : 0.9) - 140;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ConstrainedBox(
          constraints: BoxConstraints(maxHeight: maxContentHeight),
          child: SingleChildScrollView(
            child: showCompletion
                ? _buildCompletionContent(context, check)
                : _buildQuestionContent(context, check),
          ),
        ),
        if (!showCompletion) _buildActionBar(context, check),
        if (showCompletion) _buildCompletionActions(context),
      ],
    );
  }

  Widget _buildCompletionContent(BuildContext context, StepLearningCheck check) {
    final palette = LearningUiPalette.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Icon(
          Icons.check_circle_outline,
          size: 48,
          color: palette.lime,
        ),
        const SizedBox(height: AppSpacing.md),
        Text(
          StepLearningCheckL10n.stepCheckCompleted.resolve(context),
          style: AppTextStyles.title(context),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          StepLearningCheckL10n.stepCheckCompletedBody.resolve(context),
          style: AppTextStyles.body(context).copyWith(
            color: palette.textSecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildCompletionActions(BuildContext context) {
    return Padding(
      padding: const EdgeInsetsDirectional.only(top: AppSpacing.md),
      child: Wrap(
        spacing: AppSpacing.sm,
        runSpacing: AppSpacing.xs,
        children: [
          FilledButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(StepLearningCheckL10n.actionContinue.resolve(context)),
          ),
          OutlinedButton(
            onPressed: () => setState(() {
              _reviewingFromCompletion = true;
              _showCompletionScreen = false;
            }),
            child: Text(StepLearningCheckL10n.actionReview.resolve(context)),
          ),
          OutlinedButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(StepLearningCheckL10n.close.resolve(context)),
          ),
        ],
      ),
    );
  }

  Widget _buildQuestionContent(BuildContext context, StepLearningCheck check) {
    final palette = LearningUiPalette.of(context);
    final question = check.question;
    final showResults = check.attemptCount > 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          StepLearningCheckL10n.title.resolve(context),
          style: AppTextStyles.title(context),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          '${widget.step.stepNumber}. ${widget.step.title}',
          style: AppTextStyles.subtitle(context),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          StepLearningCheckL10n.optional.resolve(context),
          style: AppTextStyles.body(context).copyWith(
            color: palette.textSecondary,
          ),
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
              selected: _selectedOptionKey == option.optionKey ||
                  check.latestSelectedOptionKey == option.optionKey,
              enabled: !check.isReadOnly && !_busy,
              showResult: showResults,
              isCorrectOption: _isCorrectOption(check, option.optionKey),
              isIncorrectSelection: showResults &&
                  check.latestSelectedOptionKey == option.optionKey &&
                  check.latestResult != null &&
                  !check.latestResult!.isCorrect,
              onTap: () => setState(() => _selectedOptionKey = option.optionKey),
            ),
          ),
        ),
        if (_showHint || check.hintViewed) ...[
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
        if (_feedbackMessage != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            _feedbackMessage!,
            style: AppTextStyles.body(context).copyWith(
              color: _lastAnswerCorrect == true
                  ? Colors.green.shade700
                  : Colors.orange.shade800,
            ),
          ),
        ],
        if (_answerSubmitted && check.latestResult != null) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            check.latestResult!.explanationFor(_languageCode),
            style: AppTextStyles.body(context),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            StepLearningCheckL10n.answerSaved.resolve(context),
            style: AppTextStyles.label(context).copyWith(
              color: palette.textSecondary,
            ),
          ),
        ],
        if (_inlineError != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            _inlineError!,
            style: AppTextStyles.body(context).copyWith(
              color: Colors.orange.shade800,
            ),
          ),
        ],
      ],
    );
  }

  bool _isCorrectOption(StepLearningCheck check, String optionKey) {
    final correctKey =
        check.correctOptionKey ?? check.latestResult?.correctOptionKey;
    if (correctKey != null) {
      return optionKey == correctKey;
    }
    return check.hasCorrectAttempt &&
        check.latestSelectedOptionKey == optionKey &&
        check.latestResult?.isCorrect == true;
  }

  Widget _buildActionBar(BuildContext context, StepLearningCheck check) {
    final canMutate = !check.isReadOnly;
    final showAi =
        check.attemptCount > 0 && widget.onOpenAi != null && canMutate;
    final showFinish = _isCheckComplete(check);

    return Padding(
      padding: const EdgeInsetsDirectional.only(top: AppSpacing.md),
      child: Row(
        children: [
          if (canMutate && !showFinish)
            FilledButton(
              onPressed: _busy || _selectedOptionKey == null ? null : _submitAnswer,
              child: Text(
                check.attemptCount > 0 && !check.hasCorrectAttempt
                    ? StepLearningCheckL10n.actionTryAgain.resolve(context)
                    : StepLearningCheckL10n.submitAnswer.resolve(context),
              ),
            ),
          if (canMutate && showFinish)
            FilledButton(
              onPressed: _busy
                  ? null
                  : () => setState(() {
                        _showCompletionScreen = true;
                        _reviewingFromCompletion = false;
                      }),
              child: Text(StepLearningCheckL10n.finishCheck.resolve(context)),
            ),
          if (canMutate && !check.hasCorrectAttempt && !showFinish) ...[
            const SizedBox(width: AppSpacing.sm),
            OutlinedButton(
              onPressed: _busy ? null : _viewHint,
              child: Text(StepLearningCheckL10n.showHint.resolve(context)),
            ),
          ],
          if (canMutate && !showFinish) ...[
            const SizedBox(width: AppSpacing.sm),
            TextButton(
              onPressed: _busy ? null : _skipCheck,
              child: Text(StepLearningCheckL10n.skipForNow.resolve(context)),
            ),
          ],
          const Spacer(),
          PopupMenuButton<String>(
            tooltip: StepLearningCheckL10n.moreActions.resolve(context),
            onSelected: (value) {
              switch (value) {
                case 'unclear':
                  _reportUnclear();
                case 'ai':
                  _openAiHandoff();
                case 'close':
                  Navigator.of(context).pop();
              }
            },
            itemBuilder: (menuContext) => [
              if (canMutate && !check.unclearReported)
                PopupMenuItem(
                  value: 'unclear',
                  child: Text(
                    StepLearningCheckL10n.reportUnclear.resolve(context),
                  ),
                ),
              if (showAi)
                PopupMenuItem(
                  value: 'ai',
                  child: Text(StepLearningCheckL10n.askAi.resolve(context)),
                ),
              PopupMenuItem(
                value: 'close',
                child: Text(StepLearningCheckL10n.close.resolve(context)),
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
            border: Border.all(color: borderColor, width: selected || showResult ? 2 : 1),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  style: AppTextStyles.body(context),
                ),
              ),
              if (trailingIcon != null)
                Icon(trailingIcon, color: iconColor, size: 22),
            ],
          ),
        ),
      ),
    );
  }
}
