import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';

class PreferredWindowDraft {
  PreferredWindowDraft({
    this.date,
    this.startTime,
    this.endTime,
  });

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

  String? validationError({
    required DateTime now,
    Duration? minimumRemainingTime,
    String? minimumRemainingTimeMessage,
    Duration? minimumLeadTime,
    String? minimumLeadTimeMessage,
  }) {
    final startValue = start;
    final endValue = end;

    if (startValue == null || endValue == null) {
      return 'Choose a date, start time, and end time.';
    }

    if (!endValue.isAfter(startValue)) {
      return 'End time must be after start time.';
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
    this.allowMultipleWindows = true,
  });

  final List<PreferredWindowDraft> windows;
  final bool enabled;
  final ValueChanged<List<PreferredWindowDraft>> onChanged;
  final String label;
  final bool allowMultipleWindows;

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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          label,
          style: AppTextStyles.label(context).copyWith(
            color: palette.textSecondary,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        for (var index = 0; index < windows.length; index++) ...[
          if (index > 0) const SizedBox(height: AppSpacing.sm),
          _PreferredWindowRow(
            index: index,
            window: windows[index],
            enabled: enabled,
            canRemove: windows.length > 1,
            onChanged: (window) => _updateWindow(index, window),
            onRemove: () => _removeWindow(index),
          ),
        ],
        if (allowMultipleWindows) ...[
          const SizedBox(height: AppSpacing.sm),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: TextButton.icon(
              onPressed: enabled ? _addWindow : null,
              icon: const Icon(Icons.add_rounded, size: 18),
              label: const Text('Add another window'),
            ),
          ),
        ],
      ],
    );
  }
}

class _PreferredWindowRow extends StatelessWidget {
  const _PreferredWindowRow({
    required this.index,
    required this.window,
    required this.enabled,
    required this.canRemove,
    required this.onChanged,
    required this.onRemove,
  });

  final int index;
  final PreferredWindowDraft window;
  final bool enabled;
  final bool canRemove;
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

  Future<void> _pickTime(
    BuildContext context, {
    required bool isStart,
  }) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: (isStart ? window.startTime : window.endTime) ??
          TimeOfDay.now(),
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

  String? _formatDate(DateTime? value) {
    if (value == null) {
      return null;
    }

    return '${value.year}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';
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

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: palette.inputSurface,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Window ${index + 1}',
                  style: AppTextStyles.label(context).copyWith(
                    color: palette.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              if (canRemove)
                IconButton(
                  onPressed: enabled ? onRemove : null,
                  tooltip: 'Remove window',
                  visualDensity: VisualDensity.compact,
                  icon: Icon(Icons.close_rounded, color: palette.textMuted),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          _PickerField(
            label: 'Date',
            value: _formatDate(window.date),
            onTap: enabled ? () => _pickDate(context) : null,
          ),
          const SizedBox(height: AppSpacing.xs),
          Row(
            children: [
              Expanded(
                child: _PickerField(
                  label: 'Start',
                  value: _formatTime(window.startTime),
                  onTap: enabled ? () => _pickTime(context, isStart: true) : null,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _PickerField(
                  label: 'End',
                  value: _formatTime(window.endTime),
                  onTap: enabled ? () => _pickTime(context, isStart: false) : null,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PickerField extends StatelessWidget {
  const _PickerField({
    required this.label,
    required this.value,
    required this.onTap,
  });

  final String label;
  final String? value;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return InkWell(
      onTap: onTap,
      borderRadius: AppRadius.smAll,
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          isDense: true,
          filled: true,
          fillColor: palette.panelSurface,
          contentPadding: const EdgeInsetsDirectional.symmetric(
            horizontal: AppSpacing.sm,
            vertical: AppSpacing.sm,
          ),
          border: OutlineInputBorder(
            borderRadius: AppRadius.smAll,
            borderSide: BorderSide(color: palette.borderSubtle),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: AppRadius.smAll,
            borderSide: BorderSide(color: palette.borderSubtle),
          ),
        ),
        child: Text(
          value ?? 'Select',
          style: AppTextStyles.body(context).copyWith(
            color: value == null ? palette.textMuted : palette.textPrimary,
          ),
        ),
      ),
    );
  }
}
