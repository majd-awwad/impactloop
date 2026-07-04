import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../application/supplier_delivery_scheduling_preview.dart';
import '../../data/models/supplier_incoming_request.dart';
import '../../../reservations/data/models/reservation_preferred_window.dart';
import 'incoming_request_card.dart';
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
  bool _useCustomDeliveryWindow = false;
  DateTime? _customDeliveryDate;
  TimeOfDay? _customDeliveryStartTime;
  TimeOfDay? _customDeliveryEndTime;

  bool get _isDelivery => widget.request.isDeliveryFulfillment;

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  DateTime? get _supplierPickupWindowEnd {
    if (_pickupDate == null || _endTime == null) {
      return null;
    }

    return DateTime(
      _pickupDate!.year,
      _pickupDate!.month,
      _pickupDate!.day,
      _endTime!.hour,
      _endTime!.minute,
    );
  }

  SupplierDeliverySchedulingPreview? get _deliveryPreview {
    if (!_isDelivery) {
      return null;
    }

    final supplierPickupWindowEnd = _supplierPickupWindowEnd;
    if (supplierPickupWindowEnd == null) {
      return null;
    }

    List<ReservationPreferredWindow> learnerDeliveryWindows;
    final selectedIndex = _selectedPreferredIndex;
    if (selectedIndex != null &&
        !_useCustomDeliveryWindow &&
        selectedIndex < widget.request.learnerPreferredDeliveryWindows.length) {
      learnerDeliveryWindows = [
        widget.request.learnerPreferredDeliveryWindows[selectedIndex],
      ];
    } else {
      learnerDeliveryWindows = widget.request.learnerPreferredDeliveryWindows;
    }

    return previewSupplierDeliveryScheduling(
      supplierPickupWindowEnd: supplierPickupWindowEnd,
      learnerDeliveryWindows: learnerDeliveryWindows,
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final compact = MediaQuery.sizeOf(context).width < 480;
    final dialogWidth = compact
        ? MediaQuery.sizeOf(context).width - 32
        : 480.0;
    final preferredWindows = _isDelivery
        ? widget.request.learnerPreferredDeliveryWindows
        : widget.request.learnerPreferredPickupWindows;
    final deliveryPreview = _deliveryPreview;
    final timeFormat = DateFormat('MMM d, h:mm a');

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
                    style: context.supplierTitle().copyWith(fontSize: 20),
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
                      'Delivery address: ${widget.request.deliveryAddressText!.trim()}',
                      style: context.supplierBody().copyWith(fontSize: 13),
                    ),
                  ],
                  if (preferredWindows.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      _isDelivery
                          ? context.s.learnerPreferredDeliveryWindows
                          : context.s.learnerPreferredPickupWindows,
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
                              formatPickupWindowShort(
                                SupplierPickupWindow(
                                  start: preferredWindows[i].start,
                                  end: preferredWindows[i].end,
                                ),
                              ),
                              style: context.supplierBody().copyWith(
                                fontSize: 12,
                              ),
                            ),
                            selected: _selectedPreferredIndex == i,
                            onSelected: (selected) {
                              setState(() {
                                if (selected) {
                                  _selectedPreferredIndex = i;
                                  _useCustomDeliveryWindow = false;
                                  if (!_isDelivery) {
                                    _applyPreferredWindow(
                                      preferredWindows[i],
                                    );
                                  }
                                } else {
                                  _selectedPreferredIndex = null;
                                }
                              });
                            },
                          ),
                      ],
                    ),
                    if (_selectedPreferredIndex != null) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        _isDelivery
                            ? context.s.deliveryPreferredWindowSelectedHint
                            : context.s.pickupPreferredWindowSelectedHint,
                        style: context.supplierBody().copyWith(
                          fontSize: 12,
                          color: colors.textSecondary,
                        ),
                      ),
                    ],
                  ],
                  if (_isDelivery) ...[
                    const SizedBox(height: AppSpacing.md),
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      controlAffinity: ListTileControlAffinity.leading,
                      title: Text(
                        context.s.proposeCustomDeliveryWindow,
                        style: context.supplierBody().copyWith(fontSize: 13),
                      ),
                      value: _useCustomDeliveryWindow,
                      onChanged: (value) {
                        setState(() {
                          _useCustomDeliveryWindow = value ?? false;
                          if (_useCustomDeliveryWindow) {
                            _selectedPreferredIndex = null;
                          }
                        });
                      },
                    ),
                    if (_useCustomDeliveryWindow) ...[
                      Text(
                        context.s.customDeliveryWindowLabel,
                        style: context.supplierLabel(),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      _PickerField(
                        label: context.s.pickupDate,
                        value: _formatDate(_customDeliveryDate),
                        onTap: _pickCustomDeliveryDate,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      if (compact) ...[
                        _PickerField(
                          label: context.s.startTime,
                          value: _formatTime(_customDeliveryStartTime),
                          onTap: () => _pickCustomDeliveryTime(isStart: true),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        _PickerField(
                          label: context.s.endTime,
                          value: _formatTime(_customDeliveryEndTime),
                          onTap: () => _pickCustomDeliveryTime(isStart: false),
                        ),
                      ] else
                        Row(
                          children: [
                            Expanded(
                              child: _PickerField(
                                label: context.s.startTime,
                                value: _formatTime(_customDeliveryStartTime),
                                onTap: () =>
                                    _pickCustomDeliveryTime(isStart: true),
                              ),
                            ),
                            const SizedBox(width: AppSpacing.md),
                            Expanded(
                              child: _PickerField(
                                label: context.s.endTime,
                                value: _formatTime(_customDeliveryEndTime),
                                onTap: () =>
                                    _pickCustomDeliveryTime(isStart: false),
                              ),
                            ),
                          ],
                        ),
                    ],
                  ],
                  const SizedBox(height: AppSpacing.lg),
                  Text(
                    _isDelivery
                        ? context.s.driverPickupWindowFromSupplier
                        : context.s.confirmPickupWindowLabel,
                    style: context.supplierLabel(),
                  ),
                  if (_isDelivery) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      context.s.deliverySchedulingPreviewIntro,
                      style: context.supplierBody().copyWith(
                        fontSize: 12,
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
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
                  if (_isDelivery && deliveryPreview != null) ...[
                    const SizedBox(height: AppSpacing.md),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(AppSpacing.sm),
                      decoration: BoxDecoration(
                        color: colors.chipUnselected.withValues(alpha: 0.45),
                        borderRadius: AppRadius.mdAll,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            context.s.deliveryEarliestAfterPickupLabel(
                              timeFormat.format(
                                deliveryPreview.earliestDeliveryStart.toLocal(),
                              ),
                            ),
                            style: context.supplierBody().copyWith(
                              fontSize: 12,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            deliveryPreview.isFeasible
                                ? context.s.deliveryConfirmedWindowLabel(
                                    _formatPreviewWindow(
                                      deliveryPreview.confirmedStart!,
                                      deliveryPreview.confirmedEnd!,
                                    ),
                                  )
                                : context.s.deliveryNoFeasibleWindowPreview,
                            style: context.supplierBody().copyWith(
                              fontSize: 12,
                              color: deliveryPreview.isFeasible
                                  ? colors.textPrimary
                                  : colors.textSecondary,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            deliveryPreview.isFeasible
                                ? context.s.deliveryScheduleCanAcceptDirectly
                                : context.s.deliveryScheduleNeedsLearnerConfirmation,
                            style: context.supplierBody().copyWith(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: deliveryPreview.isFeasible
                                  ? colors.accentMuted
                                  : colors.amberAccent,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
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
                          child: Text(
                            widget.submitLabel ?? context.s.acceptRequest,
                          ),
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

  String _formatPreviewWindow(DateTime start, DateTime end) {
    final localStart = start.toLocal();
    final localEnd = end.toLocal();
    final dateFormat = DateFormat('MMM d, h:mm a');

    if (localStart.year == localEnd.year &&
        localStart.month == localEnd.month &&
        localStart.day == localEnd.day) {
      return '${dateFormat.format(localStart)} – ${DateFormat('h:mm a').format(localEnd)}';
    }

    return '${dateFormat.format(localStart)} – ${dateFormat.format(localEnd)}';
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

  Future<void> _pickCustomDeliveryDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _customDeliveryDate ?? now,
      firstDate: now,
      lastDate: now.add(const Duration(days: 60)),
    );
    if (picked != null) {
      setState(() => _customDeliveryDate = picked);
    }
  }

  Future<void> _pickCustomDeliveryTime({required bool isStart}) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: (isStart ? _customDeliveryStartTime : _customDeliveryEndTime) ??
          TimeOfDay.now(),
    );
    if (picked != null) {
      setState(() {
        if (isStart) {
          _customDeliveryStartTime = picked;
        } else {
          _customDeliveryEndTime = picked;
        }
      });
    }
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

      if (_useCustomDeliveryWindow) {
        if (_customDeliveryDate == null ||
            _customDeliveryStartTime == null ||
            _customDeliveryEndTime == null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(context.s.chooseCustomDeliveryWindow)),
          );
          return;
        }

        final proposedStart = DateTime(
          _customDeliveryDate!.year,
          _customDeliveryDate!.month,
          _customDeliveryDate!.day,
          _customDeliveryStartTime!.hour,
          _customDeliveryStartTime!.minute,
        );
        final proposedEnd = DateTime(
          _customDeliveryDate!.year,
          _customDeliveryDate!.month,
          _customDeliveryDate!.day,
          _customDeliveryEndTime!.hour,
          _customDeliveryEndTime!.minute,
        );

        if (!proposedEnd.isAfter(proposedStart)) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(context.s.endTimeMustBeAfterStart)),
          );
          return;
        }

        Navigator.of(context).pop(
          SupplierPickupWindow(
            start: supplierStart,
            end: supplierEnd,
            note: note,
            proposedDeliveryWindowStart: proposedStart,
            proposedDeliveryWindowEnd: proposedEnd,
          ),
        );
        return;
      }

      if (_selectedPreferredIndex != null &&
          _selectedPreferredIndex! <
              widget.request.learnerPreferredDeliveryWindows.length) {
        Navigator.of(context).pop(
          SupplierPickupWindow(
            start: supplierStart,
            end: supplierEnd,
            selectedPreferredWindowIndex: _selectedPreferredIndex,
            note: note,
          ),
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
      final selected =
          widget.request.learnerPreferredPickupWindows[_selectedPreferredIndex!];

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

    Navigator.of(context).pop(
      SupplierPickupWindow(
        start: start,
        end: end,
        note: note,
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
