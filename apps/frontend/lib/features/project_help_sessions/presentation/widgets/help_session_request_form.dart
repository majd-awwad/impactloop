import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../learning_hub/domain/models/project_build.dart';
import '../../application/help_session_mutation_feedback.dart';
import '../../application/project_help_session_mutation.dart';
import '../../application/project_help_session_timezone.dart';
import '../../application/project_help_sessions_providers.dart';
import '../../data/models/project_help_session_models.dart';
import '../l10n/project_help_sessions_l10n.dart';
import 'help_session_status_utils.dart';

class ProjectHelpSessionRequestForm extends ConsumerStatefulWidget {
  const ProjectHelpSessionRequestForm({
    super.key,
    required this.hostContext,
    required this.build,
    required this.availability,
    required this.isCompact,
    this.onSubmitted,
  });

  final BuildContext hostContext;
  final ProjectBuild build;
  final ProjectHelpSessionAvailability availability;
  final bool isCompact;
  final VoidCallback? onSubmitted;

  @override
  ConsumerState<ProjectHelpSessionRequestForm> createState() =>
      _ProjectHelpSessionRequestFormState();
}

class _SlotDraft {
  DateTime? date;
  TimeOfDay? time;
}

class _ProjectHelpSessionRequestFormState
    extends ConsumerState<ProjectHelpSessionRequestForm> {
  final _problemController = TextEditingController();
  final _problemFocusNode = FocusNode();
  final _slots = List<_SlotDraft>.generate(3, (_) => _SlotDraft());
  String? _selectedStepId;
  int? _durationMinutes;
  String _timezone = defaultProjectHelpSessionTimezone;
  String? _inlineError;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    final durations = widget.availability.allowedDurations;
    if (durations.isNotEmpty) {
      _durationMinutes = durations.first;
    }
  }

  @override
  void dispose() {
    _problemController.dispose();
    _problemFocusNode.dispose();
    super.dispose();
  }

  bool get _isArabic => Localizations.localeOf(context).languageCode == 'ar';

  Future<void> _pickSlot(int index) async {
    final now = DateTime.now();
    final pickedDate = await showDatePicker(
      context: context,
      initialDate: now.add(const Duration(days: 1)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 60)),
    );
    if (pickedDate == null || !mounted) {
      return;
    }
    final pickedTime = await showTimePicker(
      context: context,
      initialTime: const TimeOfDay(hour: 10, minute: 0),
    );
    if (pickedTime == null || !mounted) {
      return;
    }
    setState(() {
      _slots[index].date = pickedDate;
      _slots[index].time = pickedTime;
      _inlineError = null;
    });
  }

  DateTime? _slotDateTime(int index) {
    final slot = _slots[index];
    if (slot.date == null || slot.time == null) {
      return null;
    }
    return DateTime(
      slot.date!.year,
      slot.date!.month,
      slot.date!.day,
      slot.time!.hour,
      slot.time!.minute,
    );
  }

  String? _validate() {
    final problem = _problemController.text.trim();
    if (problem.length < 20) {
      return _isArabic
          ? 'الوصف قصير جدًا (20 حرفًا على الأقل).'
          : 'Description is too short (minimum 20 characters).';
    }
    if (problem.length > 500) {
      return _isArabic
          ? 'الوصف طويل جدًا (500 حرف كحد أقصى).'
          : 'Description is too long (maximum 500 characters).';
    }
    if (_durationMinutes == null) {
      return _isArabic ? 'اختر مدة الجلسة.' : 'Choose a session duration.';
    }
    final now = DateTime.now();
    final utcTimes = <DateTime>[];
    for (var i = 0; i < 3; i++) {
      final local = _slotDateTime(i);
      if (local == null) {
        return _isArabic
            ? 'اختر المواعيد الثلاثة.'
            : 'Choose all three proposed times.';
      }
      if (!local.isAfter(now.add(const Duration(minutes: 60)))) {
        return _isArabic
            ? 'يجب أن تكون المواعيد بعد ساعة على الأقل من الآن.'
            : 'Times must be at least 60 minutes in the future.';
      }
      if (local.isAfter(now.add(const Duration(days: 60)))) {
        return _isArabic ? 'الموعد بعيد جدًا.' : 'A proposed time is too far in the future.';
      }
      try {
        utcTimes.add(projectHelpSessionLocalToUtc(local, _timezone));
      } on ProjectHelpSessionTimezoneException catch (error) {
        return error.message;
      }
    }
    final unique = utcTimes.map((e) => e.toIso8601String()).toSet();
    if (unique.length != 3) {
      return _isArabic
          ? 'يجب أن تكون المواعيد مختلفة.'
          : 'Proposed times must be distinct.';
    }
    return null;
  }

  void _dismissError() {
    if (_inlineError != null) {
      setState(() => _inlineError = null);
    }
  }

  Future<void> _submit() async {
    if (_submitting) {
      return;
    }
    final validation = _validate();
    if (validation != null) {
      setState(() => _inlineError = validation);
      return;
    }
    setState(() {
      _submitting = true;
      _inlineError = null;
    });

    final modalContext = context;
    final hostContext = widget.hostContext;

    ProjectHelpSession? session;
    Object? mutationError;
    try {
      final payload = CreateProjectHelpSessionRequestPayload(
        problemDescription: _problemController.text.trim(),
        durationMinutes: _durationMinutes!,
        learnerTimeZone: _timezone,
        projectStepId: _selectedStepId,
        proposedTimes: List.generate(
          3,
          (index) => projectHelpSessionLocalToUtc(_slotDateTime(index)!, _timezone),
        ),
      );
      session = await runProjectHelpSessionMutation(
        () => ref
            .read(projectHelpSessionActionControllerProvider.notifier)
            .createRequest(buildId: widget.build.id, payload: payload),
      );
    } on ProjectHelpSessionMutationFailure catch (failure) {
      mutationError = failure.error;
    } catch (error) {
      mutationError = error;
    }

    if (!mounted || !modalContext.mounted) {
      return;
    }

    if (mutationError != null) {
      final error = mutationError;
      if (isActiveHelpSessionAlreadyExistsError(error)) {
        if (!modalContext.mounted || !hostContext.mounted) {
          return;
        }
        final recovered = await tryRecoverExistingHelpSessionRequest(
          modalContext: modalContext,
          hostContext: hostContext,
          ref: ref,
          buildId: widget.build.id,
        );
        if (recovered) {
          return;
        }
        if (!modalContext.mounted || !hostContext.mounted) {
          return;
        }
        if (error is ApiException && error.code == 'ACTIVE_SESSION_EXISTS') {
          recoverActiveHelpSessionRequestExists(
            modalContext: modalContext,
            hostContext: hostContext,
            ref: ref,
            buildId: widget.build.id,
          );
          return;
        }
      }
      if (!modalContext.mounted || !hostContext.mounted) {
        return;
      }
      if (await tryRecoverExistingHelpSessionRequest(
        modalContext: modalContext,
        hostContext: hostContext,
        ref: ref,
        buildId: widget.build.id,
      )) {
        return;
      }
      if (!mounted) {
        return;
      }
      if (kDebugMode && error is ApiException) {
        debugPrint(
          'help-session request failed status=${error.statusCode} code=${error.code}',
        );
      }
      setState(() {
        _submitting = false;
        _inlineError = resolveProjectHelpSessionErrorFromObject(
          error,
          isArabic: _isArabic,
        );
      });
      return;
    }

    if (session == null) {
      if (!modalContext.mounted || !hostContext.mounted) {
        return;
      }
      if (await tryRecoverExistingHelpSessionRequest(
        modalContext: modalContext,
        hostContext: hostContext,
        ref: ref,
        buildId: widget.build.id,
      )) {
        return;
      }
      setState(() => _submitting = false);
      return;
    }

    if (!modalContext.mounted) {
      return;
    }

    completeLearnerHelpSessionRequestCreation(
      modalContext: modalContext,
      hostContext: hostContext,
      ref: ref,
      session: session,
      buildId: widget.build.id,
      onSubmitted: widget.onSubmitted,
    );
  }

  void _close() {
    if (_submitting) {
      return;
    }
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final durations = widget.availability.allowedDurations;
    final creatorName = widget.availability.authorDisplayName?.trim();

    return Material(
      color: palette.panelSurface,
      borderRadius: widget.isCompact ? null : AppRadius.lgAll,
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _RequestFormHeader(
            projectTitle: widget.build.project.title,
            onClose: _close,
            enabled: !_submitting,
          ),
          if (_inlineError != null)
            _InlineErrorBanner(
              message: _inlineError!,
              onDismiss: _dismissError,
            ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsetsDirectional.fromSTEB(
                AppSpacing.lg,
                AppSpacing.md,
                AppSpacing.lg,
                AppSpacing.md,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (creatorName != null && creatorName.isNotEmpty) ...[
                    Text(
                      ProjectHelpSessionsL10n.projectCreatorLabel(creatorName)
                          .resolve(context),
                      style: AppTextStyles.label(context).copyWith(
                        color: palette.textSecondary,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                  ],
                  DropdownButtonFormField<String?>(
                    key: ValueKey(_selectedStepId),
                    isExpanded: true,
                    initialValue: _selectedStepId,
                    decoration: InputDecoration(
                      labelText: _isArabic ? 'الخطوة (اختياري)' : 'Step (optional)',
                      border: const OutlineInputBorder(),
                    ),
                    items: [
                      DropdownMenuItem<String?>(
                        value: null,
                        child: Text(
                          ProjectHelpSessionsL10n.generalQuestion.resolve(context),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      ...widget.build.stepProgress.steps.map(
                        (step) => DropdownMenuItem<String?>(
                          value: step.stepId,
                          child: Text(
                            '#${step.stepNumber} ${step.title}',
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ),
                    ],
                    onChanged: _submitting
                        ? null
                        : (value) => setState(() => _selectedStepId = value),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  TextField(
                    controller: _problemController,
                    focusNode: _problemFocusNode,
                    minLines: 4,
                    maxLines: 6,
                    maxLength: 500,
                    enabled: !_submitting,
                    decoration: InputDecoration(
                      labelText: ProjectHelpSessionsL10n.problemLabel.resolve(context),
                      helperText: ProjectHelpSessionsL10n.problemHelper.resolve(context),
                      border: const OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    _isArabic ? 'مدة الجلسة' : 'Session duration',
                    style: AppTextStyles.label(context),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: durations.map((duration) {
                      final selected = _durationMinutes == duration;
                      return ChoiceChip(
                        label: Text(
                          ProjectHelpSessionsL10n.durationLabel(duration)
                              .resolve(context),
                        ),
                        selected: selected,
                        onSelected: _submitting
                            ? null
                            : (_) => setState(() => _durationMinutes = duration),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  DropdownButtonFormField<String>(
                    key: ValueKey(_timezone),
                    isExpanded: true,
                    initialValue: _timezone,
                    decoration: InputDecoration(
                      labelText: _isArabic ? 'المنطقة الزمنية' : 'Timezone',
                      border: const OutlineInputBorder(),
                    ),
                    items: projectHelpSessionMvpTimezones
                        .map(
                          (zone) => DropdownMenuItem(
                            value: zone,
                            child: Text(
                              zone,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: _submitting
                        ? null
                        : (value) {
                            if (value != null) {
                              setState(() => _timezone = value);
                            }
                          },
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    ProjectHelpSessionsL10n.timezoneDisplay(_timezone).resolve(context),
                    style: AppTextStyles.label(context).copyWith(
                      color: palette.textMuted,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Text(
                    _isArabic ? 'المواعيد المقترحة' : 'Proposed times',
                    style: AppTextStyles.label(context),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  for (var i = 0; i < 3; i++) ...[
                    _SlotCard(
                      title: [
                        ProjectHelpSessionsL10n.slot1,
                        ProjectHelpSessionsL10n.slot2,
                        ProjectHelpSessionsL10n.slot3,
                      ][i].resolve(context),
                      localDateTime: _slotDateTime(i),
                      timezone: _timezone,
                      compact: widget.isCompact,
                      onEdit: _submitting ? null : () => _pickSlot(i),
                    ),
                    if (i < 2) const SizedBox(height: AppSpacing.sm),
                  ],
                ],
              ),
            ),
          ),
          _RequestFormFooter(
            submitting: _submitting,
            compact: widget.isCompact,
            onCancel: _close,
            onSubmit: _submit,
          ),
        ],
      ),
    );
  }
}

class _RequestFormHeader extends StatelessWidget {
  const _RequestFormHeader({
    required this.projectTitle,
    required this.onClose,
    required this.enabled,
  });

  final String projectTitle;
  final VoidCallback onClose;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Container(
      padding: const EdgeInsetsDirectional.fromSTEB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
      ),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: palette.borderSubtle),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  ProjectHelpSessionsL10n.requestCta.resolve(context),
                  style: AppTextStyles.title(context).copyWith(
                    color: palette.textPrimary,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  projectTitle,
                  style: AppTextStyles.body(context).copyWith(
                    color: palette.textSecondary,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: MaterialLocalizations.of(context).closeButtonTooltip,
            onPressed: enabled ? onClose : null,
            icon: const Icon(Icons.close),
          ),
        ],
      ),
    );
  }
}

class _RequestFormFooter extends StatelessWidget {
  const _RequestFormFooter({
    required this.submitting,
    required this.compact,
    required this.onCancel,
    required this.onSubmit,
  });

  final bool submitting;
  final bool compact;
  final VoidCallback onCancel;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final cancel = TextButton(
      onPressed: submitting ? null : onCancel,
      child: Text(
        Localizations.localeOf(context).languageCode == 'ar' ? 'إلغاء' : 'Cancel',
      ),
    );
    final submit = FilledButton(
      onPressed: submitting ? null : onSubmit,
      child: submitting
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Text(ProjectHelpSessionsL10n.sendRequest.resolve(context)),
    );

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        border: Border(top: BorderSide(color: palette.borderSubtle)),
      ),
      child: SafeArea(
        top: false,
        child: compact
            ? Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  submit,
                  const SizedBox(height: AppSpacing.sm),
                  cancel,
                ],
              )
            : AppDialogFooter.actions(actions: [cancel, submit]),
      ),
    );
  }
}

class _InlineErrorBanner extends StatelessWidget {
  const _InlineErrorBanner({
    required this.message,
    required this.onDismiss,
  });

  final String message;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: scheme.errorContainer,
      child: Padding(
        padding: const EdgeInsetsDirectional.fromSTEB(
          AppSpacing.lg,
          AppSpacing.sm,
          AppSpacing.sm,
          AppSpacing.sm,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.error_outline, color: scheme.onErrorContainer, size: 20),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                message,
                style: AppTextStyles.body(context).copyWith(
                  color: scheme.onErrorContainer,
                ),
              ),
            ),
            IconButton(
              tooltip: ProjectHelpSessionsL10n.dismissError.resolve(context),
              onPressed: onDismiss,
              icon: Icon(Icons.close, color: scheme.onErrorContainer, size: 18),
            ),
          ],
        ),
      ),
    );
  }
}

class _SlotCard extends StatelessWidget {
  const _SlotCard({
    required this.title,
    required this.localDateTime,
    required this.timezone,
    required this.compact,
    required this.onEdit,
  });

  final String title;
  final DateTime? localDateTime;
  final String timezone;
  final bool compact;
  final VoidCallback? onEdit;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final hasValue = localDateTime != null;
    final actionLabel = hasValue
        ? ProjectHelpSessionsL10n.editSlot.resolve(context)
        : ProjectHelpSessionsL10n.selectDateAndTime.resolve(context);
    final valueText = hasValue
        ? '${formatHelpSessionDateTime(context, localDateTime!, timezone)} ($timezone)'
        : ProjectHelpSessionsL10n.selectDateAndTime.resolve(context);

    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: AppTextStyles.label(context)),
        const SizedBox(height: 2),
        Text(
          valueText,
          style: AppTextStyles.body(context).copyWith(
            color: hasValue ? palette.textPrimary : palette.textMuted,
          ),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );

    final action = TextButton(
      onPressed: onEdit,
      child: Text(actionLabel),
    );

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: palette.pageBackground,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: compact
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                content,
                Align(
                  alignment: AlignmentDirectional.centerEnd,
                  child: TextButton(
                    onPressed: onEdit,
                    style: TextButton.styleFrom(
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      padding: const EdgeInsetsDirectional.symmetric(
                        horizontal: AppSpacing.sm,
                      ),
                    ),
                    child: Text(
                      actionLabel,
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
                    ),
                  ),
                ),
              ],
            )
          : Row(
              children: [
                Expanded(child: content),
                action,
              ],
            ),
    );
  }
}
