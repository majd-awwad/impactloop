import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../learning_hub/domain/models/project_build.dart';
import '../../application/project_help_session_timezone.dart';
import '../../application/project_help_sessions_providers.dart';
import '../../data/models/project_help_session_models.dart';
import '../l10n/project_help_sessions_l10n.dart';
import 'help_session_request_flow.dart';
import 'help_session_status_utils.dart';

class ProjectHelpSessionRequestForm extends ConsumerStatefulWidget {
  const ProjectHelpSessionRequestForm({
    super.key,
    required this.build,
    required this.availability,
  });

  final ProjectBuild build;
  final ProjectHelpSessionAvailability availability;

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
  final _slots = List<_SlotDraft>.generate(3, (_) => _SlotDraft());
  String? _selectedStepId;
  int? _durationMinutes;
  String _timezone = defaultProjectHelpSessionTimezone;
  String? _errorText;
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
    super.dispose();
  }

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
      _errorText = null;
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
      return Localizations.localeOf(context).languageCode == 'ar'
          ? 'الوصف قصير جدًا (20 حرفًا على الأقل).'
          : 'Description is too short (minimum 20 characters).';
    }
    if (problem.length > 500) {
      return Localizations.localeOf(context).languageCode == 'ar'
          ? 'الوصف طويل جدًا (500 حرف كحد أقصى).'
          : 'Description is too long (maximum 500 characters).';
    }
    if (_durationMinutes == null) {
      return Localizations.localeOf(context).languageCode == 'ar'
          ? 'اختر مدة الجلسة.'
          : 'Choose a session duration.';
    }
    final now = DateTime.now();
    final utcTimes = <DateTime>[];
    for (var i = 0; i < 3; i++) {
      final local = _slotDateTime(i);
      if (local == null) {
        return Localizations.localeOf(context).languageCode == 'ar'
            ? 'اختر المواعيد الثلاثة.'
            : 'Choose all three proposed times.';
      }
      if (!local.isAfter(now.add(const Duration(minutes: 60)))) {
        return Localizations.localeOf(context).languageCode == 'ar'
            ? 'يجب أن تكون المواعيد بعد ساعة على الأقل من الآن.'
            : 'Times must be at least 60 minutes in the future.';
      }
      if (local.isAfter(now.add(const Duration(days: 60)))) {
        return Localizations.localeOf(context).languageCode == 'ar'
            ? 'الموعد بعيد جدًا.'
            : 'A proposed time is too far in the future.';
      }
      utcTimes.add(projectHelpSessionLocalToUtc(local, _timezone));
    }
    final unique = utcTimes.map((e) => e.toIso8601String()).toSet();
    if (unique.length != 3) {
      return Localizations.localeOf(context).languageCode == 'ar'
          ? 'يجب أن تكون المواعيد مختلفة.'
          : 'Proposed times must be distinct.';
    }
    return null;
  }

  Future<void> _submit() async {
    if (_submitting) {
      return;
    }
    final validation = _validate();
    if (validation != null) {
      setState(() => _errorText = validation);
      return;
    }
    setState(() {
      _submitting = true;
      _errorText = null;
    });
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
      final session = await ref
          .read(projectHelpSessionActionControllerProvider.notifier)
          .createRequest(buildId: widget.build.id, payload: payload);
      if (!mounted || session == null) {
        return;
      }
      invalidateBuildHelpSessionProviders(ref, widget.build.id);
      invalidateLearnerHelpSessionProviders(ref, sessionId: session.id);
      if (context.mounted) {
        Navigator.of(context).pop(session);
      }
    } catch (error) {
      if (mounted) {
        setState(() => _submitting = false);
        await handleHelpSessionRequestError(context, error);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final isArabic = Localizations.localeOf(context).languageCode == 'ar';
  final durations = widget.availability.allowedDurations;
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              ProjectHelpSessionsL10n.requestCta.resolve(context),
              style: AppTextStyles.title(context).copyWith(
                color: palette.textPrimary,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              widget.build.project.title,
              style: AppTextStyles.body(context).copyWith(
                color: palette.textSecondary,
              ),
            ),
            if (widget.availability.authorDisplayName != null) ...[
              const SizedBox(height: AppSpacing.xs),
              Text(
                widget.availability.authorDisplayName!,
                style: AppTextStyles.label(context).copyWith(
                  color: palette.textMuted,
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.lg),
            DropdownButtonFormField<String?>(
              initialValue: _selectedStepId,
              decoration: InputDecoration(
                labelText: isArabic ? 'الخطوة (اختياري)' : 'Step (optional)',
              ),
              items: [
                DropdownMenuItem<String?>(
                  value: null,
                  child: Text(ProjectHelpSessionsL10n.generalQuestion.resolve(context)),
                ),
                ...widget.build.stepProgress.steps.map(
                  (step) => DropdownMenuItem<String?>(
                    value: step.stepId,
                    child: Text('#${step.stepNumber} ${step.title}'),
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
              minLines: 4,
              maxLines: 6,
              maxLength: 500,
              enabled: !_submitting,
              decoration: InputDecoration(
                labelText: ProjectHelpSessionsL10n.problemLabel.resolve(context),
                helperText: ProjectHelpSessionsL10n.problemHelper.resolve(context),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              isArabic ? 'مدة الجلسة' : 'Session duration',
              style: AppTextStyles.label(context),
            ),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.sm,
              children: durations.map((duration) {
                final selected = _durationMinutes == duration;
                return ChoiceChip(
                  label: Text(ProjectHelpSessionsL10n.durationLabel(duration)
                      .resolve(context)),
                  selected: selected,
                  onSelected: _submitting
                      ? null
                      : (_) => setState(() => _durationMinutes = duration),
                );
              }).toList(),
            ),
            const SizedBox(height: AppSpacing.md),
            DropdownButtonFormField<String>(
              initialValue: _timezone,
              decoration: InputDecoration(
                labelText: isArabic ? 'المنطقة الزمنية' : 'Timezone',
              ),
              items: projectHelpSessionMvpTimezones
                  .map(
                    (zone) => DropdownMenuItem(
                      value: zone,
                      child: Text(zone),
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
            for (var i = 0; i < 3; i++) ...[
              _SlotCard(
                title: [
                  ProjectHelpSessionsL10n.slot1,
                  ProjectHelpSessionsL10n.slot2,
                  ProjectHelpSessionsL10n.slot3,
                ][i].resolve(context),
                value: _slotDateTime(i),
                onEdit: _submitting ? null : () => _pickSlot(i),
              ),
              const SizedBox(height: AppSpacing.sm),
            ],
            if (_errorText != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                _errorText!,
                style: AppTextStyles.label(context).copyWith(
                  color: Theme.of(context).colorScheme.error,
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.lg),
            AppDialogFooter.actions(
              actions: [
                TextButton(
                  onPressed: _submitting ? null : () => Navigator.of(context).pop(),
                  child: Text(isArabic ? 'إلغاء' : 'Cancel'),
                ),
                FilledButton(
                  onPressed: _submitting ? null : _submit,
                  child: _submitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(ProjectHelpSessionsL10n.sendRequest.resolve(context)),
                ),
              ],
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
    required this.value,
    required this.onEdit,
  });

  final String title;
  final DateTime? value;
  final VoidCallback? onEdit;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: AppTextStyles.label(context)),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  value == null
                      ? ProjectHelpSessionsL10n.selectDate.resolve(context)
                      : formatHelpSessionDateTime(context, value!, 'local'),
                  style: AppTextStyles.body(context),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: onEdit,
            child: Text(ProjectHelpSessionsL10n.editSlot.resolve(context)),
          ),
        ],
      ),
    );
  }
}
