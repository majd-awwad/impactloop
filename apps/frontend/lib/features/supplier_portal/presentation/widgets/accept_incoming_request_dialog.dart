import 'package:flutter/material.dart';

import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../data/models/supplier_incoming_request.dart';
import 'supplier_dark_form_field.dart';

class AcceptIncomingRequestDialog extends StatefulWidget {
  const AcceptIncomingRequestDialog({
    super.key,
    required this.materialTitle,
    required this.learnerName,
    this.dialogTitle,
    this.submitLabel,
  });

  final String materialTitle;
  final String learnerName;
  final String? dialogTitle;
  final String? submitLabel;

  static Future<SupplierPickupWindow?> show(
    BuildContext context, {
    required String materialTitle,
    required String learnerName,
    String? dialogTitle,
    String? submitLabel,
  }) {
    return showDialog<SupplierPickupWindow>(
      context: context,
      builder: (context) => AcceptIncomingRequestDialog(
        materialTitle: materialTitle,
        learnerName: learnerName,
        dialogTitle: dialogTitle,
        submitLabel: submitLabel,
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
    final colors = context.supplierColors;
    final compact = MediaQuery.sizeOf(context).width < 480;
    final dialogWidth = compact
        ? MediaQuery.sizeOf(context).width - 32
        : 440.0;

    return Dialog(
      backgroundColor: colors.surfaceSolid,
      insetPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.lg,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.lgAll,
        side: BorderSide(color: colors.border.withValues(alpha: 0.4)),
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
                    widget.dialogTitle ?? context.s.acceptRequest,
                    style: context.supplierTitle().copyWith(
                      fontSize: 20,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    context.s.acceptRequestSubtitle,
                    style: context.supplierBody().copyWith(
                      color: colors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(AppSpacing.sm),
                    decoration: BoxDecoration(
                      color: colors.chipUnselected.withValues(alpha: 0.5),
                      borderRadius: AppRadius.mdAll,
                    ),
                    child: Text(
                      '${widget.materialTitle} · ${widget.learnerName}',
                      style: context.supplierLabel().copyWith(
                        color: colors.textPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  _PickerField(
                    label: context.s.pickupDate,
                    value: _formatDate(_pickupDate),
                    onTap: _pickDate,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  if (compact) ...[
                    _PickerField(
                      label: context.s.startTime,
                      value: _formatTime(_startTime),
                      onTap: () => _pickTime(isStart: true),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    _PickerField(
                      label: context.s.endTime,
                      value: _formatTime(_endTime),
                      onTap: () => _pickTime(isStart: false),
                    ),
                  ] else
                    Row(
                      children: [
                        Expanded(
                          child: _PickerField(
                            label: context.s.startTime,
                            value: _formatTime(_startTime),
                            onTap: () => _pickTime(isStart: true),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          child: _PickerField(
                            label: context.s.endTime,
                            value: _formatTime(_endTime),
                            onTap: () => _pickTime(isStart: false),
                          ),
                        ),
                      ],
                    ),
                  const SizedBox(height: AppSpacing.md),
                  SupplierDarkTextArea(
                    controller: _noteController,
                    label: context.s.pickupNoteOptional,
                    hint: context.s.pickupNoteHint,
                    maxLines: 3,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => Navigator.of(context).pop(),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: colors.textSecondary,
                            side: BorderSide(
                              color: colors.border.withValues(alpha: 0.45),
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                          child: Text(context.s.cancel),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: FilledButton(
                          onPressed: _submit,
                          style: FilledButton.styleFrom(
                            backgroundColor:
                                colors.accentMuted.withValues(alpha: 0.9),
                            foregroundColor: colors.textOnAccent,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                          child: Text(widget.submitLabel ?? context.s.acceptRequest),
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
        SnackBar(content: Text(context.s.choosePickupDateAndTime)),
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
        SnackBar(content: Text(context.s.endTimeMustBeAfterStart)),
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
    final colors = context.supplierColors;
    final tapLabel = context.s.tapToChoose;

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
              decoration: context.supplierDecorations.formFieldDecoration(
                hint: tapLabel,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      value ?? tapLabel,
                      style: TextStyle(
                        color: value == null
                            ? colors.textMuted
                            : colors.textPrimary,
                      ),
                    ),
                  ),
                  Icon(
                    Icons.calendar_today_outlined,
                    size: 16,
                    color: colors.textSecondary,
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
