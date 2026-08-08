import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../application/learning_hub_providers.dart';
import '../../application/learning_session_providers.dart';
import '../../domain/models/project_build.dart';
import '../l10n/learning_session_l10n.dart';
import '../theme/learning_ui_palette.dart';

class StartKnowledgeCheckSection extends ConsumerStatefulWidget {
  const StartKnowledgeCheckSection({
    super.key,
    required this.projectId,
    required this.buildRecord,
  });

  final String projectId;
  final ProjectBuild buildRecord;

  @override
  ConsumerState<StartKnowledgeCheckSection> createState() =>
      _StartKnowledgeCheckSectionState();
}

class _StartKnowledgeCheckSectionState
    extends ConsumerState<StartKnowledgeCheckSection> {
  bool _busy = false;
  BuildLearningSession? _session;
  bool _preparingPollActive = false;
  String? _setupError;

  Future<void> _reloadSession() async {
    ref.invalidate(buildLearningSessionProvider(widget.projectId));
    final bundle = await ref.read(
      buildLearningSessionProvider(widget.projectId).future,
    );
    if (!mounted) return;
    setState(() => _session = bundle.session);
  }

  Future<BuildLearningSession?> _beginCheck({
    required String? learningGoal,
    required int? confidenceBefore,
  }) async {
    setState(() {
      _busy = true;
      _setupError = null;
    });

    try {
      final bundle = await ref.read(learningHubRepositoryProvider).setupLearningSession(
            widget.projectId,
            learningGoal: learningGoal,
            confidenceBefore: confidenceBefore,
          );

      if (!mounted) return null;

      ref.invalidate(projectBuildProvider(widget.projectId));
      ref.invalidate(buildLearningSessionProvider(widget.projectId));

      if (bundle.session != null) {
        setState(() {
          _session = bundle.session;
          _setupError = null;
        });
        return bundle.session;
      } else if (bundle.learningSetup.isPreparing) {
        _ensurePreparingPoll(bundle.learningSetup);
      } else if (bundle.learningSetup.isUnavailable) {
        setState(() {
          _setupError = LearningSessionL10n.retrySetupError.resolve(context);
        });
      }
      return null;
    } on ApiException {
      if (mounted) {
        setState(() {
          _setupError = LearningSessionL10n.retrySetupError.resolve(context);
        });
      }
      return null;
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  void _ensurePreparingPoll(ProjectBuildLearningSetup setup) {
    if (_preparingPollActive) {
      return;
    }
    _preparingPollActive = true;
    Future<void>(() async {
      while (mounted) {
        await Future<void>.delayed(
          Duration(seconds: setup.retryAfterSeconds ?? 5),
        );
        if (!mounted) {
          break;
        }
        await _reloadSession();
        final bundle = await ref.read(
          buildLearningSessionProvider(widget.projectId).future,
        );
        if (!mounted) {
          break;
        }
        if (bundle.session != null || !bundle.learningSetup.isPreparing) {
          setState(() => _session = bundle.session);
          break;
        }
      }
      if (mounted) {
        setState(() => _preparingPollActive = false);
      } else {
        _preparingPollActive = false;
      }
    });
  }

  void _onSessionChanged(BuildLearningSession? session) {
    setState(() => _session = session);
  }

  Future<void> _openCheck({required bool review}) async {
    final session = _session;
    final width = MediaQuery.sizeOf(context).width;
    final flow = _StartKnowledgeCheckFlow(
      projectId: widget.projectId,
      initialSession: session,
      reviewMode: review,
      onSessionChanged: _onSessionChanged,
      onSetup: _beginCheck,
    );

    if (width >= 700) {
      await showDialog<void>(
        context: context,
        builder: (dialogContext) {
          return Dialog(
            insetPadding: const EdgeInsets.all(AppSpacing.lg),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: 720,
                maxHeight: MediaQuery.sizeOf(dialogContext).height * 0.85,
              ),
              child: flow,
            ),
          );
        },
      );
    } else {
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        builder: (sheetContext) {
          return Align(
            alignment: Alignment.bottomCenter,
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.sizeOf(sheetContext).height * 0.9,
              ),
              child: flow,
            ),
          );
        },
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.buildRecord.isEditingLocked) {
      return const SizedBox.shrink();
    }

    final setup = widget.buildRecord.learningSetup;
    final sessionAsync = ref.watch(
      buildLearningSessionProvider(widget.projectId),
    );

    return sessionAsync.when(
      loading: () => _card(
        child: const Center(child: CircularProgressIndicator()),
      ),
      error: (_, _) => const SizedBox.shrink(),
      data: (bundle) {
        final session = _session ?? bundle.session;
        final effectiveSetup = bundle.learningSetup.status !=
                LearningSetupStatus.notRequested
            ? bundle.learningSetup
            : setup;

        if (effectiveSetup?.isUnavailable == true && session == null) {
          return _buildUnavailableCard(context, effectiveSetup!);
        }

        if (effectiveSetup?.isPreparing == true && session == null) {
          _ensurePreparingPoll(effectiveSetup!);
          return _card(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  LearningSessionL10n.preparing.resolve(context),
                  style: AppTextStyles.body(context),
                ),
                const SizedBox(height: AppSpacing.sm),
                const LinearProgressIndicator(),
              ],
            ),
          );
        }

        return _buildCompactCard(context, session);
      },
    );
  }

  Widget _buildUnavailableCard(
    BuildContext context,
    ProjectBuildLearningSetup effectiveSetup,
  ) {
    final retryable = effectiveSetup.retryable;
    final ineligible = effectiveSetup.reasonCode == 'PROJECT_NOT_ELIGIBLE' ||
        effectiveSetup.reasonCode == 'PROJECT_HAS_NO_STEPS' ||
        effectiveSetup.reasonCode == 'LEARNING_PACK_STALE';

    return _card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            ineligible
                ? LearningSessionL10n.ineligible.resolve(context)
                : LearningSessionL10n.unavailable.resolve(context),
            style: AppTextStyles.body(context),
          ),
          if (_setupError != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              _setupError!,
              style: AppTextStyles.body(context).copyWith(
                color: Colors.orange.shade800,
              ),
            ),
          ],
          if (retryable && !ineligible) ...[
            const SizedBox(height: AppSpacing.sm),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: FilledButton.tonal(
                onPressed: _busy
                    ? null
                    : () => _beginCheck(learningGoal: null, confidenceBefore: null),
                child: _busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(
                        LearningSessionL10n.retrySetup.resolve(context),
                      ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildCompactCard(BuildContext context, BuildLearningSession? session) {
    final palette = LearningUiPalette.of(context);
    final assignments = session?.startAssignments ?? const <LearningAssignment>[];
    final total = assignments.length;
    final handled = assignments.where((item) => item.isComplete).length;
    final remaining = total - handled;

    final LocalizedText actionLabel;
    final bool reviewMode;
    if (session == null || total == 0) {
      actionLabel = LearningSessionL10n.beginCheck;
      reviewMode = false;
    } else if (session.isStartCheckComplete) {
      actionLabel = LearningSessionL10n.reviewAnswers;
      reviewMode = true;
    } else if (handled == 0) {
      actionLabel = LearningSessionL10n.beginCheck;
      reviewMode = false;
    } else {
      actionLabel = LearningSessionL10n.continueCheck;
      reviewMode = false;
    }

    return _card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            LearningSessionL10n.title.resolve(context),
            style: AppTextStyles.title(context),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            LearningSessionL10n.optional.resolve(context),
            style: AppTextStyles.body(context).copyWith(
              color: palette.textSecondary,
            ),
          ),
          if (session != null && total > 0) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              '$handled/$total · $remaining ${LearningSessionL10n.remainingLabel.resolve(context)}',
              style: AppTextStyles.label(context),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: FilledButton(
              onPressed: _busy ? null : () => _openCheck(review: reviewMode),
              child: Text(actionLabel.resolve(context)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _card({required Widget child}) {
    final palette = LearningUiPalette.of(context);
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        side: BorderSide(color: palette.borderSubtle),
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        child: child,
      ),
    );
  }
}

enum _FlowPhase { setup, quiz, completed, review }

class _StartKnowledgeCheckFlow extends ConsumerStatefulWidget {
  const _StartKnowledgeCheckFlow({
    required this.projectId,
    required this.initialSession,
    required this.reviewMode,
    required this.onSessionChanged,
    required this.onSetup,
  });

  final String projectId;
  final BuildLearningSession? initialSession;
  final bool reviewMode;
  final ValueChanged<BuildLearningSession?> onSessionChanged;
  final Future<BuildLearningSession?> Function({
    required String? learningGoal,
    required int? confidenceBefore,
  }) onSetup;

  @override
  ConsumerState<_StartKnowledgeCheckFlow> createState() =>
      _StartKnowledgeCheckFlowState();
}

class _StartKnowledgeCheckFlowState extends ConsumerState<_StartKnowledgeCheckFlow> {
  final _goalController = TextEditingController();
  int? _confidenceBefore;
  BuildLearningSession? _session;
  late _FlowPhase _phase;
  late int _questionIndex;
  bool _busy = false;
  String? _selectedOptionKey;
  bool _showHint = false;
  String? _feedbackMessage;
  bool? _lastAnswerCorrect;
  bool _awaitingAdvance = false;
  String? _setupError;

  @override
  void initState() {
    super.initState();
    _session = widget.initialSession;
    _confidenceBefore = _session?.confidenceBefore;
    if (_goalController.text.isEmpty && _session?.learningGoal != null) {
      _goalController.text = _session!.learningGoal!;
    }
    if (widget.reviewMode && _session != null) {
      _phase = _FlowPhase.review;
      _questionIndex = 0;
    } else if (_session == null) {
      _phase = _FlowPhase.setup;
      _questionIndex = 0;
    } else if (_session!.isStartCheckComplete) {
      _phase = _FlowPhase.completed;
      _questionIndex = 0;
    } else {
      _phase = _FlowPhase.quiz;
      _questionIndex = _firstOpenIndex(_session!);
    }
  }

  @override
  void dispose() {
    _goalController.dispose();
    super.dispose();
  }

  String get _languageCode => Localizations.localeOf(context).languageCode;

  int _firstOpenIndex(BuildLearningSession session) {
    final assignments = session.startAssignments;
    final index = assignments.indexWhere((item) => !item.isComplete);
    return index >= 0 ? index : 0;
  }

  BuildLearningSession _sessionWithAssignment(LearningAssignment updated) {
    final current = _session!;
    return BuildLearningSession(
      id: current.id,
      buildId: current.buildId,
      packId: current.packId,
      learningGoal: current.learningGoal,
      confidenceBefore: current.confidenceBefore,
      assignments: current.assignments
          .map((item) => item.id == updated.id ? updated : item)
          .toList(growable: false),
    );
  }

  void _updateSession(BuildLearningSession? session) {
    setState(() => _session = session);
    widget.onSessionChanged(session);
  }

  Future<void> _startFromSetup() async {
    setState(() {
      _busy = true;
      _setupError = null;
    });

    final goal = _goalController.text.trim();
    final session = await widget.onSetup(
      learningGoal: goal.isEmpty ? null : goal,
      confidenceBefore: _confidenceBefore,
    );

    if (!mounted) return;

    setState(() => _busy = false);

    if (session != null) {
      _updateSession(session);
      setState(() {
        _phase = _FlowPhase.quiz;
        _questionIndex = _firstOpenIndex(session);
        _resetQuestionUi();
      });
    } else {
      setState(() {
        _setupError = LearningSessionL10n.retrySetupError.resolve(context);
      });
    }
  }

  void _resetQuestionUi() {
    _selectedOptionKey = null;
    _showHint = false;
    _feedbackMessage = null;
    _lastAnswerCorrect = null;
    _awaitingAdvance = false;
  }

  Future<void> _submitAnswer(LearningAssignment assignment) async {
    final selected = _selectedOptionKey;
    if (selected == null || _awaitingAdvance) {
      return;
    }

    setState(() {
      _busy = true;
      _feedbackMessage = null;
    });

    try {
      final result = await ref
          .read(learningHubRepositoryProvider)
          .submitLearningAnswer(
            widget.projectId,
            assignment.id,
            selectedOptionKey: selected,
          );

      if (!mounted) return;

      final updatedSession = _sessionWithAssignment(result.assignment);
      _updateSession(updatedSession);
      ref.invalidate(buildLearningSessionProvider(widget.projectId));

      setState(() {
        _lastAnswerCorrect = result.attempt.isCorrect;
        _feedbackMessage = result.attempt.isCorrect
            ? LearningSessionL10n.correct.resolve(context)
            : LearningSessionL10n.notQuite.resolve(context);
        if (result.attempt.isCorrect) {
          _awaitingAdvance = true;
        }
      });
    } on ApiException catch (error) {
      if (mounted) {
        showErrorSnackBar(context, error);
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _skipQuestion(LearningAssignment assignment) async {
    if (_awaitingAdvance) {
      return;
    }

    setState(() => _busy = true);
    try {
      final updated = await ref
          .read(learningHubRepositoryProvider)
          .skipLearningAssignment(widget.projectId, assignment.id);

      if (!mounted) return;

      final updatedSession = _sessionWithAssignment(updated);
      _updateSession(updatedSession);
      ref.invalidate(buildLearningSessionProvider(widget.projectId));

      setState(() {
        _awaitingAdvance = true;
        _feedbackMessage = null;
        _lastAnswerCorrect = null;
      });
    } on ApiException catch (error) {
      if (mounted) {
        showErrorSnackBar(context, error);
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _viewHint(LearningAssignment assignment) async {
    try {
      final updated = await ref
          .read(learningHubRepositoryProvider)
          .viewLearningHint(widget.projectId, assignment.id);
      if (!mounted) return;
      _updateSession(_sessionWithAssignment(updated));
      setState(() => _showHint = true);
    } on ApiException catch (error) {
      if (mounted) {
        showErrorSnackBar(context, error);
      }
    }
  }

  Future<void> _reportUnclear(LearningAssignment assignment) async {
    setState(() {
      _busy = true;
      _feedbackMessage = null;
    });
    try {
      await ref.read(learningHubRepositoryProvider).reportLearningAssignmentUnclear(
            widget.projectId,
            assignment.id,
          );
      if (!mounted) return;
      _updateSession(
        _session == null
            ? null
            : BuildLearningSession(
                id: _session!.id,
                buildId: _session!.buildId,
                packId: _session!.packId,
                learningGoal: _session!.learningGoal,
                confidenceBefore: _session!.confidenceBefore,
                assignments: _session!.assignments
                    .map(
                      (item) => item.id == assignment.id
                          ? LearningAssignment(
                              id: item.id,
                              stage: item.stage,
                              status: item.status,
                              displayOrder: item.displayOrder,
                              question: item.question,
                              answerAttempts: item.answerAttempts,
                              projectStepId: item.projectStepId,
                              hintViewedAt: item.hintViewedAt,
                              unclearReported: true,
                            )
                          : item,
                    )
                    .toList(growable: false),
              ),
      );
      setState(() {
        _lastAnswerCorrect = null;
        _feedbackMessage =
            LearningSessionL10n.reportUnclearThanks.resolve(context);
      });
    } on ApiException {
      if (mounted) {
        setState(() {
          _feedbackMessage =
              LearningSessionL10n.reportUnclearError.resolve(context);
        });
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  void _advanceQuestion() {
    final session = _session;
    if (session == null) {
      return;
    }

    final assignments = session.startAssignments;
    final nextIndex = _questionIndex + 1;

    if (nextIndex >= assignments.length) {
      setState(() {
        _phase = _FlowPhase.completed;
        _resetQuestionUi();
      });
      return;
    }

    setState(() {
      _questionIndex = nextIndex;
      _resetQuestionUi();
    });
  }

  void _enterReview() {
    setState(() {
      _phase = _FlowPhase.review;
      _questionIndex = 0;
      _resetQuestionUi();
    });
  }

  void _close() {
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final isSheet = MediaQuery.sizeOf(context).width < 700;

    return Material(
      color: palette.cardSurface,
      borderRadius: isSheet
          ? const BorderRadius.vertical(top: Radius.circular(AppRadius.xl))
          : BorderRadius.circular(AppRadius.lg),
      child: Padding(
        padding: EdgeInsetsDirectional.only(
          start: AppSpacing.lg,
          end: AppSpacing.lg,
          top: AppSpacing.lg,
          bottom: AppSpacing.lg +
              (isSheet ? MediaQuery.viewInsetsOf(context).bottom : 0),
        ),
        child: switch (_phase) {
          _FlowPhase.setup => _buildSetup(context),
          _FlowPhase.completed => _buildCompleted(context),
          _FlowPhase.review => _buildReview(context),
          _FlowPhase.quiz => _buildQuiz(context),
        },
      ),
    );
  }

  Widget _buildSetup(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    return _flowScaffold(
      context,
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            LearningSessionL10n.title.resolve(context),
            style: AppTextStyles.title(context),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            LearningSessionL10n.optional.resolve(context),
            style: AppTextStyles.body(context).copyWith(
              color: palette.textSecondary,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          TextField(
            controller: _goalController,
            maxLines: 2,
            maxLength: 500,
            decoration: InputDecoration(
              labelText: LearningSessionL10n.personalGoalLabel.resolve(context),
              hintText: LearningSessionL10n.personalGoalHint.resolve(context),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            LearningSessionL10n.confidenceLabel.resolve(context),
            style: AppTextStyles.label(context),
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: List.generate(5, (index) {
              final value = index + 1;
              final selected = _confidenceBefore == value;
              return Padding(
                padding: const EdgeInsetsDirectional.only(end: AppSpacing.xs),
                child: ChoiceChip(
                  label: Text('$value'),
                  selected: selected,
                  onSelected: _busy
                      ? null
                      : (_) => setState(() => _confidenceBefore = value),
                ),
              );
            }),
          ),
          if (_setupError != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              _setupError!,
              style: AppTextStyles.body(context).copyWith(
                color: Colors.orange.shade800,
              ),
            ),
          ],
        ],
      ),
      primaryLabel: LearningSessionL10n.beginCheck.resolve(context),
      onPrimary: _busy ? null : _startFromSetup,
      primaryBusy: _busy,
      secondaryActions: [
        _SecondaryAction(
          label: LearningSessionL10n.close.resolve(context),
          onPressed: _busy ? null : _close,
        ),
      ],
    );
  }

  Widget _buildCompleted(BuildContext context) {
    return _flowScaffold(
      context,
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            LearningSessionL10n.completed.resolve(context),
            style: AppTextStyles.title(context),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            LearningSessionL10n.completedBody.resolve(context),
            style: AppTextStyles.body(context),
          ),
        ],
      ),
      primaryLabel: LearningSessionL10n.continueBuilding.resolve(context),
      onPrimary: _close,
      secondaryActions: [
        _SecondaryAction(
          label: LearningSessionL10n.reviewAnswers.resolve(context),
          onPressed: _enterReview,
        ),
      ],
    );
  }

  Widget _buildReview(BuildContext context) {
    final session = _session;
    if (session == null) {
      return _flowScaffold(
        context,
        content: const SizedBox.shrink(),
        primaryLabel: LearningSessionL10n.close.resolve(context),
        onPrimary: _close,
        secondaryActions: const [],
      );
    }

    final assignments = session.startAssignments;
    if (assignments.isEmpty) {
      return _buildCompleted(context);
    }

    final assignment = assignments[_questionIndex.clamp(0, assignments.length - 1)];
    final question = assignment.question;
    final palette = LearningUiPalette.of(context);
    final selectedKey = assignment.answerAttempts.isNotEmpty
        ? assignment.answerAttempts.last.selectedOptionKey
        : null;

    return _flowScaffold(
      context,
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _questionHeader(context, _questionIndex + 1, assignments.length),
          const SizedBox(height: AppSpacing.md),
          Text(
            question.promptFor(_languageCode),
            style: AppTextStyles.subtitle(context),
          ),
          const SizedBox(height: AppSpacing.md),
          ...question.options.map(
            (option) => _optionCard(
              context,
              option: option,
              selected: selectedKey == option.optionKey,
              enabled: false,
              showResult: true,
              isCorrectOption: _isCorrectOption(assignment, option.optionKey),
              isIncorrectSelection: selectedKey == option.optionKey &&
                  !assignment.hasCorrectAnswer,
            ),
          ),
          if (assignment.hintViewed) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              question.hintFor(_languageCode),
              style: AppTextStyles.body(context).copyWith(
                color: palette.textSecondary,
              ),
            ),
          ],
          if (assignment.hasCorrectAnswer || assignment.isComplete) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              question.explanationFor(_languageCode),
              style: AppTextStyles.body(context),
            ),
          ],
        ],
      ),
      primaryLabel: _questionIndex < assignments.length - 1
          ? LearningSessionL10n.nextQuestion.resolve(context)
          : LearningSessionL10n.close.resolve(context),
      onPrimary: () {
        if (_questionIndex < assignments.length - 1) {
          setState(() => _questionIndex += 1);
        } else {
          _close();
        }
      },
      secondaryActions: [
        if (_questionIndex > 0)
          _SecondaryAction(
            label: '${LearningSessionL10n.questionProgress.resolve(context)} $_questionIndex',
            onPressed: () => setState(() => _questionIndex -= 1),
          ),
        if (_questionIndex < assignments.length - 1)
          _SecondaryAction(
            label: LearningSessionL10n.close.resolve(context),
            onPressed: _close,
          ),
      ],
    );
  }

  Widget _buildQuiz(BuildContext context) {
    final session = _session;
    if (session == null) {
      return _buildSetup(context);
    }

    final assignments = session.startAssignments;
    if (assignments.isEmpty || _questionIndex >= assignments.length) {
      return _buildCompleted(context);
    }

    final assignment = assignments[_questionIndex];
    final question = assignment.question;
    final palette = LearningUiPalette.of(context);
    final showExplanation = _feedbackMessage != null &&
        (_lastAnswerCorrect == true || _lastAnswerCorrect == false);
    final isLast = _questionIndex >= assignments.length - 1;

    return _flowScaffold(
      context,
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _questionHeader(context, _questionIndex + 1, assignments.length),
          const SizedBox(height: AppSpacing.xs),
          Text(
            LearningSessionL10n.optional.resolve(context),
            style: AppTextStyles.body(context).copyWith(
              color: palette.textSecondary,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            question.promptFor(_languageCode),
            style: AppTextStyles.subtitle(context),
          ),
          const SizedBox(height: AppSpacing.md),
          ...question.options.map(
            (option) => _optionCard(
              context,
              option: option,
              selected: _selectedOptionKey == option.optionKey,
              enabled: !_busy && !_awaitingAdvance,
              showResult: _feedbackMessage != null || _awaitingAdvance,
              isCorrectOption: _isCorrectOption(assignment, option.optionKey),
              isIncorrectSelection: _selectedOptionKey == option.optionKey &&
                  _lastAnswerCorrect == false,
              onTap: () => setState(() {
                _selectedOptionKey = option.optionKey;
                if (_lastAnswerCorrect == false) {
                  _feedbackMessage = null;
                  _lastAnswerCorrect = null;
                }
              }),
            ),
          ),
          if (_showHint || assignment.hintViewedAt != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              question.hintFor(_languageCode),
              style: AppTextStyles.body(context),
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
          if (showExplanation) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              question.explanationFor(_languageCode),
              style: AppTextStyles.body(context),
            ),
          ],
          if (_awaitingAdvance) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              LearningSessionL10n.answerSaved.resolve(context),
              style: AppTextStyles.label(context).copyWith(
                color: palette.textSecondary,
              ),
            ),
          ],
        ],
      ),
      primaryLabel: _primaryActionLabel(assignment, isLast).resolve(context),
      onPrimary: _busy ? null : () => _onPrimaryAction(assignment, isLast),
      primaryBusy: _busy,
      secondaryActions: _quizSecondaryActions(assignment),
    );
  }

  LocalizedText _primaryActionLabel(LearningAssignment assignment, bool isLast) {
    if (_awaitingAdvance) {
      return isLast ? LearningSessionL10n.finishCheck : LearningSessionL10n.nextQuestion;
    }
    if (_lastAnswerCorrect == false || assignment.hasCorrectAnswer) {
      return LearningSessionL10n.tryAgain;
    }
    return LearningSessionL10n.submitAnswer;
  }

  void _onPrimaryAction(LearningAssignment assignment, bool isLast) {
    if (_awaitingAdvance) {
      if (_session?.isStartCheckComplete == true && isLast) {
        setState(() => _phase = _FlowPhase.completed);
        _resetQuestionUi();
      } else {
        _advanceQuestion();
      }
      return;
    }

    if (_lastAnswerCorrect == false || assignment.hasCorrectAnswer) {
      _submitAnswer(assignment);
      return;
    }

    _submitAnswer(assignment);
  }

  List<_SecondaryAction> _quizSecondaryActions(LearningAssignment assignment) {
    if (_awaitingAdvance) {
      return [
        _SecondaryAction(
          label: LearningSessionL10n.close.resolve(context),
          onPressed: _busy ? null : _close,
        ),
      ];
    }

    return [
      if (!assignment.hasCorrectAnswer)
        _SecondaryAction(
          label: LearningSessionL10n.showHint.resolve(context),
          onPressed: _busy ? null : () => _viewHint(assignment),
        ),
      _SecondaryAction(
        label: LearningSessionL10n.skipQuestion.resolve(context),
        onPressed: _busy ? null : () => _skipQuestion(assignment),
      ),
      if (!assignment.unclearReported)
        _SecondaryAction(
          label: LearningSessionL10n.reportUnclear.resolve(context),
          onPressed: _busy ? null : () => _reportUnclear(assignment),
        ),
      _SecondaryAction(
        label: LearningSessionL10n.close.resolve(context),
        onPressed: _busy ? null : _close,
      ),
    ];
  }

  Widget _questionHeader(BuildContext context, int current, int total) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          '${LearningSessionL10n.questionProgress.resolve(context)} $current ${LearningSessionL10n.questionOf.resolve(context)} $total',
          style: AppTextStyles.label(context),
        ),
        const SizedBox(height: AppSpacing.xs),
        LinearProgressIndicator(value: total == 0 ? 0 : current / total),
      ],
    );
  }

  Widget _optionCard(
    BuildContext context, {
    required LearningQuestionOption option,
    required bool selected,
    required bool enabled,
    required bool showResult,
    required bool isCorrectOption,
    required bool isIncorrectSelection,
    VoidCallback? onTap,
  }) {
    final palette = LearningUiPalette.of(context);

    Color borderColor = palette.borderSubtle;
    Color backgroundColor = palette.cardSurface;
    IconData trailingIcon = Icons.radio_button_off;
    Color iconColor = palette.textSecondary;
    String? statusLabel;

    if (showResult) {
      if (isCorrectOption) {
        borderColor = Colors.green.shade600;
        backgroundColor = Colors.green.shade50;
        trailingIcon = Icons.check_circle;
        iconColor = Colors.green.shade700;
        statusLabel = LearningSessionL10n.correct.resolve(context);
      } else if (isIncorrectSelection) {
        borderColor = Colors.orange.shade700;
        backgroundColor = Colors.orange.shade50;
        trailingIcon = Icons.cancel;
        iconColor = Colors.orange.shade800;
        statusLabel = LearningSessionL10n.notQuiteShort.resolve(context);
      }
    } else if (selected) {
      borderColor = palette.lime;
      backgroundColor = palette.limeSoft;
      trailingIcon = Icons.radio_button_checked;
      iconColor = palette.lime;
    }

    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.xs),
      child: Material(
        color: backgroundColor,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          side: BorderSide(
            color: borderColor,
            width: selected || showResult ? 2 : 1,
          ),
        ),
        child: InkWell(
          onTap: enabled ? onTap : null,
          borderRadius: BorderRadius.circular(AppRadius.md),
          child: Semantics(
            button: true,
            selected: selected,
            label: [
              option.promptFor(_languageCode),
              ?statusLabel,
            ].join('. '),
            child: Padding(
              padding: const EdgeInsetsDirectional.all(AppSpacing.md),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(trailingIcon, color: iconColor, size: 22),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          option.promptFor(_languageCode),
                          style: AppTextStyles.body(context),
                        ),
                        if (statusLabel != null) ...[
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            statusLabel,
                            style: AppTextStyles.label(context).copyWith(
                              color: iconColor,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  bool _isCorrectOption(LearningAssignment assignment, String optionKey) {
    for (final attempt in assignment.answerAttempts) {
      if (attempt.isCorrect) {
        return optionKey == attempt.selectedOptionKey;
      }
    }
    return assignment.hasCorrectAnswer &&
        _selectedOptionKey == optionKey &&
        _lastAnswerCorrect == true;
  }

  Widget _flowScaffold(
    BuildContext context, {
    required Widget content,
    required String primaryLabel,
    required VoidCallback? onPrimary,
    bool primaryBusy = false,
    required List<_SecondaryAction> secondaryActions,
  }) {
    final useOverflow = MediaQuery.sizeOf(context).width < 480 &&
        secondaryActions.length > 2;

    final screenHeight = MediaQuery.sizeOf(context).height;
    final isDesktop = MediaQuery.sizeOf(context).width >= 700;
    final maxContentHeight = screenHeight * (isDesktop ? 0.85 : 0.9) - 120;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        ConstrainedBox(
          constraints: BoxConstraints(maxHeight: maxContentHeight),
          child: SingleChildScrollView(child: content),
        ),
        const SizedBox(height: AppSpacing.md),
        _buildActionBar(
          context,
          primaryLabel: primaryLabel,
          onPrimary: onPrimary,
          primaryBusy: primaryBusy,
          secondaryActions: secondaryActions,
          useOverflow: useOverflow,
        ),
      ],
    );
  }

  Widget _buildActionBar(
    BuildContext context, {
    required String primaryLabel,
    required VoidCallback? onPrimary,
    required bool primaryBusy,
    required List<_SecondaryAction> secondaryActions,
    required bool useOverflow,
  }) {
    final isSubmit = primaryLabel ==
            LearningSessionL10n.submitAnswer.resolve(context) ||
        primaryLabel == LearningSessionL10n.tryAgain.resolve(context);
    final primaryDisabled = onPrimary == null ||
        (isSubmit &&
            _selectedOptionKey == null &&
            _phase == _FlowPhase.quiz &&
            !_awaitingAdvance);

    if (useOverflow) {
      return Row(
        children: [
          Expanded(
            child: FilledButton(
              onPressed: primaryDisabled ? null : onPrimary,
              child: primaryBusy
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(primaryLabel),
            ),
          ),
          if (secondaryActions.isNotEmpty) ...[
            const SizedBox(width: AppSpacing.sm),
            PopupMenuButton<_SecondaryAction>(
              itemBuilder: (context) => secondaryActions
                  .map(
                    (action) => PopupMenuItem<_SecondaryAction>(
                      value: action,
                      enabled: action.onPressed != null,
                      child: Text(action.label),
                    ),
                  )
                  .toList(growable: false),
              onSelected: (action) => action.onPressed?.call(),
            ),
          ],
        ],
      );
    }

    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.xs,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        FilledButton(
          onPressed: primaryDisabled ? null : onPrimary,
          child: primaryBusy
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text(primaryLabel),
        ),
        ...secondaryActions.map(
          (action) => TextButton(
            onPressed: action.onPressed,
            child: Text(action.label),
          ),
        ),
      ],
    );
  }
}

class _SecondaryAction {
  const _SecondaryAction({
    required this.label,
    required this.onPressed,
  });

  final String label;
  final VoidCallback? onPressed;
}
