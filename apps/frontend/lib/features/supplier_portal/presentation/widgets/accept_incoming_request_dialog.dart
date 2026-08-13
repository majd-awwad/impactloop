import 'package:flutter/material.dart';
import '../../../../l10n/l10n.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/widgets/app_close_button.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../data/models/supplier_incoming_request.dart';
import '../../../reservations/application/reservation_timing_policy.dart';
import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';
import '../supplier_reservation_ui_helpers.dart';
import 'supplier_dark_form_field.dart';

class AcceptIncomingRequestDialog extends StatefulWidget {
  const AcceptIncomingRequestDialog({
    super.key,
    required this.request,
    this.dialogTitle,
    this.submitLabel,
  });

  final SupplierIncomingRequest request;
  final String? dialogTitle;
  final String? submitLabel;

  static Future<SupplierPickupWindow?> show(
    BuildContext context, {
    required SupplierIncomingRequest request,
    String? dialogTitle,
    String? submitLabel,
  }) {
    return showDialog<SupplierPickupWindow>(
      context: context,
      builder: (context) => AcceptIncomingRequestDialog(
        request: request,
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
  int? _selectedPreferredIndex;

  bool get _isDelivery => widget.request.isDeliveryFulfillment;

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final actionStyle = AppStatusStyle.of(context, AppStatusTone.success);
    final compact = MediaQuery.sizeOf(context).width < 480;
    final dialogWidth = compact ? MediaQuery.sizeOf(context).width - 32 : 480.0;
    final preferredWindows = _isDelivery
        ? widget.request.learnerPreferredDeliveryWindows
        : widget.request.learnerPreferredPickupWindows;

    return Dialog(
      backgroundColor: colors.surfaceSolid,
      insetPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.lg,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.lgAll,
        side: BorderSide(color: actionStyle.border),
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
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          widget.dialogTitle ?? context.s.acceptRequest,
                          style: context.supplierTitle().copyWith(fontSize: 20),
                        ),
                      ),
                      AppCloseButton(
                        onPressed: () => Navigator.of(context).pop(),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    _isDelivery
                        ? context.s.deliveryAcceptExplanation
                        : context.s.acceptRequestSubtitle,
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
                      '${widget.request.materialTitle} · ${widget.request.learnerName}',
                      style: context.supplierLabel().copyWith(
                        color: colors.textPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    widget.request.fulfillmentSummary,
                    style: context.supplierLabel().copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                  if (_isDelivery &&
                      widget.request.deliveryAddressText?.trim().isNotEmpty ==
                          true) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      context.l10n.supplierDeliveryAddressPrefix(
                        widget.request.deliveryAddressText!.trim(),
                      ),
                      style: context.supplierBody().copyWith(fontSize: 13),
                    ),
                  ],
                  if (_isDelivery) ...[
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      context.s.learnerPreferredDeliveryWindows,
                      style: context.supplierLabel(),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    if (preferredWindows.isEmpty)
                      Text(
                        context.l10n.supplierNoPreferredDeliveryTime,
                        style: context.supplierBody().copyWith(
                          fontSize: 13,
                          color: colors.textSecondary,
                        ),
                      )
                    else
                      Wrap(
                        spacing: AppSpacing.xs,
                        runSpacing: AppSpacing.xs,
                        children: [
                          for (final window in preferredWindows)
                            Chip(
                              label: Text(
                                SupplierReservationUiHelpers.of(
                                  context,
                                ).formatPickupWindow(
                                  SupplierPickupWindow(
                                    start: window.start,
                                    end: window.end,
                                  ),
                                ),
                                style: context.supplierBody().copyWith(
                                  fontSize: 12,
                                ),
                              ),
                            ),
                        ],
                      ),
                  ] else if (preferredWindows.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      context.s.learnerPreferredPickupWindows,
                      style: context.supplierLabel(),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Wrap(
                      spacing: AppSpacing.xs,
                      runSpacing: AppSpacing.xs,
                      children: [
                        for (var i = 0; i < preferredWindows.length; i++)
                          ChoiceChip(
                            label: Text(
                              SupplierReservationUiHelpers.of(
                                context,
                              ).formatPickupWindow(
                                SupplierPickupWindow(
                                  start: preferredWindows[i].start,
                                  end: preferredWindows[i].end,
                                ),
                              ),
                            ),
                            selected: _selectedPreferredIndex == i,
                            onSelected: (selected) => setState(() {
                              _selectedPreferredIndex = selected ? i : null;
                              if (selected) {
                                _applyPreferredWindow(preferredWindows[i]);
                              }
                            }),
                          ),
                      ],
                    ),
                  ],
                  const SizedBox(height: AppSpacing.lg),
                  Text(
                    _isDelivery
                        ? context.s.driverPickupWindowFromSupplier
                        : context.s.confirmPickupWindowLabel,
                    style: context.supplierLabel(),
                  ),
                  const SizedBox(height: AppSpacing.sm),
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
                  if (!_isDelivery &&
                      _selectedPreferredIndex == null &&
                      _pickupDate != null &&
                      _startTime != null &&
                      _endTime != null) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      context.s.pickupCustomWindowHint,
                      style: context.supplierBody().copyWith(
                        fontSize: 12,
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                  const SizedBox(height: AppSpacing.md),
                  SupplierDarkTextArea(
                    controller: _noteController,
                    label: context.s.pickupNoteOptional,
                    hint: context.s.pickupNoteHint,
                    maxLines: 3,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _submit,
                      style: AppStatusButtonStyle.filled(
                        context,
                        AppStatusTone.success,
                      ),
                      child: Text(
                        widget.submitLabel ?? context.s.acceptRequest,
                      ),
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

  void _applyPreferredWindow(dynamic window) {
    final start = (window.start as DateTime).toLocal();
    final end = (window.end as DateTime).toLocal();
    setState(() {
      _pickupDate = DateTime(start.year, start.month, start.day);
      _startTime = TimeOfDay(hour: start.hour, minute: start.minute);
      _endTime = TimeOfDay(hour: end.hour, minute: end.minute);
    });
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
      setState(() {
        _pickupDate = picked;
        if (!_isDelivery) {
          _selectedPreferredIndex = null;
        }
      });
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
        if (!_isDelivery) {
          _selectedPreferredIndex = null;
        }
      });
    }
  }

  void _submit() {
    final now = DateTime.now();

    if (_pickupDate == null || _startTime == null || _endTime == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.s.choosePickupDateAndTime)),
      );
      return;
    }

    final note = _noteController.text.trim().isEmpty
        ? null
        : _noteController.text.trim();

    if (_isDelivery) {
      final supplierStart = DateTime(
        _pickupDate!.year,
        _pickupDate!.month,
        _pickupDate!.day,
        _startTime!.hour,
        _startTime!.minute,
      );
      final supplierEnd = DateTime(
        _pickupDate!.year,
        _pickupDate!.month,
        _pickupDate!.day,
        _endTime!.hour,
        _endTime!.minute,
      );

      if (!supplierEnd.isAfter(supplierStart)) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.s.endTimeMustBeAfterStart)),
        );
        return;
      }

      if (supplierStart.isBefore(now.add(minPickupLeadTime))) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text(proposedPickupStartTooSoonMessage)),
        );
        return;
      }

      Navigator.of(context).pop(
        SupplierPickupWindow(
          start: supplierStart,
          end: supplierEnd,
          note: note,
        ),
      );
      return;
    }

    if (!_isDelivery &&
        _selectedPreferredIndex != null &&
        _selectedPreferredIndex! <
            widget.request.learnerPreferredPickupWindows.length) {
      final selected = widget
          .request
          .learnerPreferredPickupWindows[_selectedPreferredIndex!];

      if (selected.end.isBefore(now.add(minRemainingPickupWindow))) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text(pickupWindowTooCloseMessage)),
        );
        return;
      }

      Navigator.of(context).pop(
        SupplierPickupWindow(
          start: selected.start,
          end: selected.end,
          selectedPreferredWindowIndex: _selectedPreferredIndex,
          note: note,
        ),
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

    if (start.isBefore(now.add(minPickupLeadTime))) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text(proposedPickupStartTooSoonMessage)),
      );
      return;
    }

    Navigator.of(
      context,
    ).pop(SupplierPickupWindow(start: start, end: end, note: note));
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
