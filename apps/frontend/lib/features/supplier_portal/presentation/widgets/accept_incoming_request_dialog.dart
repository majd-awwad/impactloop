import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';
import '../../data/models/supplier_incoming_request.dart';
import 'supplier_dark_form_field.dart';

class AcceptIncomingRequestDialog extends StatefulWidget {
  const AcceptIncomingRequestDialog({
    super.key,
    required this.materialTitle,
    required this.learnerName,
  });

  final String materialTitle;
  final String learnerName;

  static Future<SupplierPickupWindow?> show(
    BuildContext context, {
    required String materialTitle,
    required String learnerName,
  }) {
    return showDialog<SupplierPickupWindow>(
      context: context,
      builder: (context) => AcceptIncomingRequestDialog(
        materialTitle: materialTitle,
        learnerName: learnerName,
      ),
    );
  }

  @override
  State<AcceptIncomingRequestDialog> createState() =>
      _AcceptIncomingRequestDialogState();
}

class _AcceptIncomingRequestDialogState
    extends State<AcceptIncomingRequestDialog> {
  final _formKey = GlobalKey<FormState>();
  final _noteController = TextEditingController();
  DateTime? _pickupDate;
  TimeOfDay? _startTime;
  TimeOfDay? _endTime;

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final compact = MediaQuery.sizeOf(context).width < 480;
    final dialogWidth = compact ? MediaQuery.sizeOf(context).width - 32 : 440.0;

    return Dialog(
      backgroundColor: AuthDarkColors.surfaceSolid,
      insetPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.lg,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.lgAll,
        side: BorderSide(color: AuthDarkColors.border.withValues(alpha: 0.4)),
      ),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: dialogWidth),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.lg,
            AppSpacing.lg,
            AppSpacing.md,
          ),
          child: Form(
            key: _formKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Accept request',
                    style: AuthDarkTextStyles.title(
                      context,
                    ).copyWith(fontSize: 20),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    'Choose a pickup window for the learner.',
                    style: AuthDarkTextStyles.body(
                      context,
                    ).copyWith(color: AuthDarkColors.textPrimary),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(AppSpacing.sm),
                    decoration: BoxDecoration(
                      color: AuthDarkColors.chipUnselected.withValues(
                        alpha: 0.5,
                      ),
                      borderRadius: AppRadius.mdAll,
                    ),
                    child: Text(
                      '${widget.materialTitle} · ${widget.learnerName}',
                      style: AuthDarkTextStyles.label(
                        context,
                      ).copyWith(color: AuthDarkColors.textPrimary),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  _PickerField(
                    label: 'Pickup date',
                    value: _formatDate(_pickupDate),
                    onTap: _pickDate,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  if (compact) ...[
                    _PickerField(
                      label: 'Start time',
                      value: _formatTime(_startTime),
                      onTap: () => _pickTime(isStart: true),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    _PickerField(
                      label: 'End time',
                      value: _formatTime(_endTime),
                      onTap: () => _pickTime(isStart: false),
                    ),
                  ] else
                    Row(
                      children: [
                        Expanded(
                          child: _PickerField(
                            label: 'Start time',
                            value: _formatTime(_startTime),
                            onTap: () => _pickTime(isStart: true),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: _PickerField(
                            label: 'End time',
                            value: _formatTime(_endTime),
                            onTap: () => _pickTime(isStart: false),
                          ),
                        ),
                      ],
                    ),
                  const SizedBox(height: AppSpacing.md),
                  SupplierDarkTextArea(
                    controller: _noteController,
                    label: 'Pickup note (optional)',
                    hint: 'Ring the workshop bell when you arrive.',
                    maxLines: 3,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => Navigator.of(context).pop(),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AuthDarkColors.textSecondary,
                            side: BorderSide(
                              color: AuthDarkColors.border.withValues(
                                alpha: 0.45,
                              ),
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                          child: const Text('Cancel'),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: FilledButton(
                          onPressed: _submit,
                          style: FilledButton.styleFrom(
                            backgroundColor: AuthDarkColors.accentMuted
                                .withValues(alpha: 0.9),
                            foregroundColor: AuthDarkColors.textOnAccent,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                          child: const Text('Accept request'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _pickupDate ?? now,
      firstDate: now,
      lastDate: now.add(const Duration(days: 60)),
    );
    if (picked != null) {
      setState(() => _pickupDate = picked);
    }
  }

  Future<void> _pickTime({required bool isStart}) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: (isStart ? _startTime : _endTime) ?? TimeOfDay.now(),
    );
    if (picked != null) {
      setState(() {
        if (isStart) {
          _startTime = picked;
        } else {
          _endTime = picked;
        }
      });
    }
  }

  void _submit() {
    if (_pickupDate == null || _startTime == null || _endTime == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Choose a pickup date and time window.')),
      );
      return;
    }

    final start = DateTime(
      _pickupDate!.year,
      _pickupDate!.month,
      _pickupDate!.day,
      _startTime!.hour,
      _startTime!.minute,
    );
    final end = DateTime(
      _pickupDate!.year,
      _pickupDate!.month,
      _pickupDate!.day,
      _endTime!.hour,
      _endTime!.minute,
    );

    if (!end.isAfter(start)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('End time must be after start time.')),
      );
      return;
    }

    Navigator.of(context).pop(
      SupplierPickupWindow(
        start: start,
        end: end,
        note: _noteController.text.trim().isEmpty
            ? null
            : _noteController.text.trim(),
      ),
    );
  }

  String? _formatDate(DateTime? value) {
    if (value == null) return null;
    return '${value.year}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';
  }

  String? _formatTime(TimeOfDay? value) {
    if (value == null) return null;
    final hour = value.hour.toString().padLeft(2, '0');
    final minute = value.minute.toString().padLeft(2, '0');
    return '$hour:$minute';
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
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SupplierFormLabel(label: label),
        const SizedBox(height: AppSpacing.xs),
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            borderRadius: AppRadius.mdAll,
            child: InputDecorator(
              decoration: SupplierDecorations.darkFormFieldDecoration(
                hint: 'Tap to choose',
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      value ?? 'Tap to choose',
                      style: TextStyle(
                        color: value == null
                            ? AuthDarkColors.textMuted
                            : AuthDarkColors.textPrimary,
                      ),
                    ),
                  ),
                  const Icon(
                    Icons.calendar_today_outlined,
                    size: 16,
                    color: AuthDarkColors.textSecondary,
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
