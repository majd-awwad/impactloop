import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import 'reservation_form/reservation_form_theme.dart';

class PreferredWindowDraft {
  PreferredWindowDraft({this.date, this.startTime, this.endTime});

  DateTime? date;
  TimeOfDay? startTime;
  TimeOfDay? endTime;

  DateTime? get start {
    if (date == null || startTime == null) {
      return null;
    }

    return DateTime(
      date!.year,
      date!.month,
      date!.day,
      startTime!.hour,
      startTime!.minute,
    );
  }

  DateTime? get end {
    if (date == null || endTime == null) {
      return null;
    }

    return DateTime(
      date!.year,
      date!.month,
      date!.day,
      endTime!.hour,
      endTime!.minute,
    );
  }

  bool get isBlank => date == null && startTime == null && endTime == null;

  String? partialValidationError({
    String? incompleteMessage,
    String? endBeforeStartMessage,
  }) {
    if (isBlank) {
      return null;
    }

    if (date == null || startTime == null || endTime == null) {
      return incompleteMessage ?? 'Choose a date, start time, and end time.';
    }

    final startValue = start;
    final endValue = end;
    if (startValue != null &&
        endValue != null &&
        !endValue.isAfter(startValue)) {
      return endBeforeStartMessage ?? 'End time must be after start time.';
    }

    return null;
  }

  String? validationError({
    required DateTime now,
    Duration? minimumRemainingTime,
    String? minimumRemainingTimeMessage,
    Duration? minimumLeadTime,
    String? minimumLeadTimeMessage,
    String? incompleteMessage,
    String? endBeforeStartMessage,
  }) {
    final partialError = partialValidationError(
      incompleteMessage: incompleteMessage,
      endBeforeStartMessage: endBeforeStartMessage,
    );
    if (partialError != null) {
      return partialError;
    }

    final startValue = start;
    final endValue = end;

    if (startValue == null || endValue == null) {
      return incompleteMessage ?? 'Choose a date, start time, and end time.';
    }

    if (!startValue.isAfter(now)) {
      return 'Preferred pickup window start must be in the future.';
    }

    if (!endValue.isAfter(now)) {
      return 'Preferred window must be in the future.';
    }

    if (minimumLeadTime != null &&
        startValue.isBefore(now.add(minimumLeadTime))) {
      return minimumLeadTimeMessage ??
          'Preferred pickup window must start at least 30 minutes from now.';
    }

    if (minimumRemainingTime != null &&
        endValue.isBefore(now.add(minimumRemainingTime))) {
      return minimumRemainingTimeMessage ??
          'Preferred window is too close to ending.';
    }

    return null;
  }
}

class PreferredWindowInput extends StatelessWidget {
  const PreferredWindowInput({
    super.key,
    required this.windows,
    required this.enabled,
    required this.onChanged,
    this.label = 'Preferred windows',
    this.addAnotherLabel,
    this.allowMultipleWindows = true,
  });

  final List<PreferredWindowDraft> windows;
  final bool enabled;
  final ValueChanged<List<PreferredWindowDraft>> onChanged;
  final String label;
  final String? addAnotherLabel;
  final bool allowMultipleWindows;

  static const _mobileBreakpoint = 520.0;

  void _updateWindow(int index, PreferredWindowDraft window) {
    final next = [...windows];
    next[index] = window;
    onChanged(next);
  }

  void _removeWindow(int index) {
    if (windows.length <= 1) {
      return;
    }

    final next = [...windows]..removeAt(index);
    onChanged(next);
  }

  void _addWindow() {
    onChanged([...windows, PreferredWindowDraft()]);
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = context.l10n;
    final resolvedAddLabel = addAnotherLabel ?? l10n.reservationAddAnotherWindow;
    final showWindowLabels = windows.length > 1;
    final isMobile = MediaQuery.sizeOf(context).width < _mobileBreakpoint;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (label.trim().isNotEmpty) ...[
          Text(
            label,
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
        for (var index = 0; index < windows.length; index++) ...[
          if (index > 0) const SizedBox(height: AppSpacing.md),
          _PreferredWindowRow(
            key: ValueKey('preferred-window-row-$index'),
            index: index,
            window: windows[index],
            enabled: enabled,
            canRemove: windows.length > 1,
            showWindowLabel: showWindowLabels,
            isMobile: isMobile,
            onChanged: (window) => _updateWindow(index, window),
            onRemove: () => _removeWindow(index),
          ),
        ],
        if (allowMultipleWindows) ...[
          const SizedBox(height: AppSpacing.md),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: SizedBox(
              width: isMobile ? double.infinity : null,
              child: OutlinedButton.icon(
                key: const ValueKey('preferred-window-add-button'),
                onPressed: enabled ? _addWindow : null,
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(0, 46),
                  foregroundColor: palette.mint,
                  backgroundColor: palette.panelSurface,
                  side: BorderSide(color: palette.mint.withValues(alpha: 0.35)),
                  padding: const EdgeInsetsDirectional.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.sm,
                  ),
                ),
                icon: const Icon(Icons.add_rounded, size: 18),
                label: Text(resolvedAddLabel),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _PreferredWindowRow extends StatelessWidget {
  const _PreferredWindowRow({
    super.key,
    required this.index,
    required this.window,
    required this.enabled,
    required this.canRemove,
    required this.showWindowLabel,
    required this.isMobile,
    required this.onChanged,
    required this.onRemove,
  });

  final int index;
  final PreferredWindowDraft window;
  final bool enabled;
  final bool canRemove;
  final bool showWindowLabel;
  final bool isMobile;
  final ValueChanged<PreferredWindowDraft> onChanged;
  final VoidCallback onRemove;

  Future<void> _pickDate(BuildContext context) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: window.date ?? now,
      firstDate: now,
      lastDate: now.add(const Duration(days: 60)),
    );

    if (picked != null) {
      onChanged(
        PreferredWindowDraft(
          date: picked,
          startTime: window.startTime,
          endTime: window.endTime,
        ),
      );
    }
  }

  Future<void> _pickTime(BuildContext context, {required bool isStart}) async {
    final picked = await showTimePicker(
      context: context,
      initialTime:
          (isStart ? window.startTime : window.endTime) ?? TimeOfDay.now(),
    );

    if (picked != null) {
      onChanged(
        PreferredWindowDraft(
          date: window.date,
          startTime: isStart ? picked : window.startTime,
          endTime: isStart ? window.endTime : picked,
        ),
      );
    }
  }

  String? _formatDate(BuildContext context, DateTime? value) {
    if (value == null) {
      return null;
    }

    final locale = Localizations.localeOf(context).toString();
    return DateFormat.yMd(locale).format(value);
  }

  String? _formatTime(TimeOfDay? value) {
    if (value == null) {
      return null;
    }

    final hour = value.hour.toString().padLeft(2, '0');
    final minute = value.minute.toString().padLeft(2, '0');
    return '$hour:$minute';
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final l10n = context.l10n;
    final partialError = window.partialValidationError(
      incompleteMessage: l10n.preferredWindowIncompleteError,
      endBeforeStartMessage: l10n.endAfterStart,
    );

    final dateField = _PreferredWindowPickerField(
      key: ValueKey('preferred-window-date-field-$index'),
      label: l10n.preferredWindowDateLabel,
      placeholder: l10n.preferredWindowChooseDate,
      value: _formatDate(context, window.date),
      icon: Icons.calendar_today_outlined,
      enabled: enabled,
      onTap: enabled ? () => _pickDate(context) : null,
    );

    final startField = _PreferredWindowPickerField(
      key: ValueKey('preferred-window-start-field-$index'),
      label: l10n.preferredWindowStartTimeLabel,
      placeholder: l10n.preferredWindowChooseTime,
      value: _formatTime(window.startTime),
      icon: Icons.schedule_outlined,
      enabled: enabled,
      onTap: enabled ? () => _pickTime(context, isStart: true) : null,
    );

    final endField = _PreferredWindowPickerField(
      key: ValueKey('preferred-window-end-field-$index'),
      label: l10n.preferredWindowEndTimeLabel,
      placeholder: l10n.preferredWindowChooseTime,
      value: _formatTime(window.endTime),
      icon: Icons.schedule_outlined,
      enabled: enabled,
      onTap: enabled ? () => _pickTime(context, isStart: false) : null,
    );

    final deleteButton = canRemove
        ? IconButton(
            key: ValueKey('preferred-window-remove-$index'),
            onPressed: enabled ? onRemove : null,
            tooltip: l10n.preferredWindowRemoveTooltip,
            visualDensity: VisualDensity.compact,
            style: IconButton.styleFrom(
              minimumSize: const Size(44, 44),
              foregroundColor: materialDanger.withValues(alpha: 0.85),
            ),
            icon: const Icon(Icons.delete_outline_rounded, size: 20),
          )
        : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (showWindowLabel) ...[
          Row(
            children: [
              Expanded(
                child: Text(
                  l10n.preferredWindowNumberLabel(index + 1),
                  style: ReservationFormTheme.helperStyle(
                    context,
                    palette,
                  ).copyWith(
                    color: palette.textSecondary,
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                  ),
                ),
              ),
              if (isMobile && deleteButton != null) deleteButton,
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
        ],
        if (isMobile)
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              dateField,
              const SizedBox(height: AppSpacing.sm),
              startField,
              const SizedBox(height: AppSpacing.sm),
              endField,
            ],
          )
        else
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: dateField),
              const SizedBox(width: AppSpacing.sm),
              Expanded(child: startField),
              const SizedBox(width: AppSpacing.sm),
              Expanded(child: endField),
              if (!isMobile && deleteButton != null) ...[
                const SizedBox(width: AppSpacing.xs),
                Padding(
                  padding: const EdgeInsets.only(top: 22),
                  child: deleteButton,
                ),
              ],
            ],
          ),
        if (partialError != null) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            partialError,
            style: AppTextStyles.label(context).copyWith(
              color: materialDanger,
              fontSize: 12,
            ),
          ),
        ],
      ],
    );
  }
}

class _PreferredWindowPickerField extends StatelessWidget {
  const _PreferredWindowPickerField({
    super.key,
    required this.label,
    required this.placeholder,
    required this.value,
    required this.icon,
    required this.enabled,
    required this.onTap,
  });

  final String label;
  final String placeholder;
  final String? value;
  final IconData icon;
  final bool enabled;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final hasValue = value != null && value!.trim().isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          label,
          style: ReservationFormTheme.fieldLabelStyle(context, palette),
        ),
        const SizedBox(height: 6),
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            borderRadius: AppRadius.mdAll,
            hoverColor: enabled
                ? palette.borderSubtle.withValues(alpha: 0.35)
                : null,
            child: Ink(
              decoration: BoxDecoration(
                color: palette.panelSurface,
                borderRadius: AppRadius.mdAll,
                border: Border.all(color: palette.borderSubtle),
              ),
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 48),
                child: Padding(
                  padding: const EdgeInsetsDirectional.symmetric(
                    horizontal: AppSpacing.sm,
                    vertical: AppSpacing.sm,
                  ),
                  child: Row(
                    children: [
                      Icon(
                        icon,
                        size: ReservationFormTheme.metaIconSize,
                        color: enabled ? palette.textSecondary : palette.textMuted,
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          hasValue ? value! : placeholder,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.body(context).copyWith(
                            color: hasValue
                                ? palette.textPrimary
                                : palette.textMuted,
                            fontWeight:
                                hasValue ? FontWeight.w500 : FontWeight.w400,
                            fontSize: 14,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

