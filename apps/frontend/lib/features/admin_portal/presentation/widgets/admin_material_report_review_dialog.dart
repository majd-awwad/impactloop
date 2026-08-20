import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../core/config/api_config.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_dialog_detail.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/material_status_badge.dart';
import '../../../../shared/widgets/review_status_presentation.dart';
import '../../data/admin_materials_api.dart';
import '../l10n/admin_material_reports_l10n.dart';
import '../theme/admin_decoration_set.dart';

enum AdminMaterialReportDecision {
  reject,
  resolveNoAction,
  markUnavailable,
  hide,
}

class AdminMaterialReportReviewDialog extends StatefulWidget {
  const AdminMaterialReportReviewDialog({
    super.key,
    required this.report,
    required this.onViewMaterial,
    required this.onSubmit,
  });

  final AdminMaterialReportListItem report;
  final VoidCallback onViewMaterial;
  final Future<void> Function(
    AdminMaterialReportDecision decision,
    String adminNote,
  )
  onSubmit;

  @override
  State<AdminMaterialReportReviewDialog> createState() =>
      _AdminMaterialReportReviewDialogState();
}

class _AdminMaterialReportReviewDialogState
    extends State<AdminMaterialReportReviewDialog> {
  final _noteController = TextEditingController();
  AdminMaterialReportDecision? _decision;
  var _submitting = false;
  String? _errorText;

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  bool get _canHide => widget.report.canHideMaterial;
  bool get _canMarkUnavailable => widget.report.canMarkUnavailable;

  bool get _selectedDecisionLocked {
    final decision = _decision;
    if (decision == AdminMaterialReportDecision.hide) return !_canHide;
    if (decision == AdminMaterialReportDecision.markUnavailable) {
      return !_canMarkUnavailable;
    }
    return false;
  }

  String _lockMessage(String languageCode) {
    final status = widget.report.materialStatus;
    if (status == 'REUSED') {
      return AdminMaterialReportsL10n.lockedLifecycleComplete.resolveFor(
        languageCode,
      );
    }
    return AdminMaterialReportsL10n.lockedDuringActiveReservation.resolveFor(
      languageCode,
    );
  }

  String? _impactCopy(String languageCode) {
    switch (_decision) {
      case AdminMaterialReportDecision.reject:
        return AdminMaterialReportsL10n.rejectImpact.resolveFor(languageCode);
      case AdminMaterialReportDecision.resolveNoAction:
        return AdminMaterialReportsL10n.resolveNoActionImpact.resolveFor(
          languageCode,
        );
      case AdminMaterialReportDecision.markUnavailable:
        return AdminMaterialReportsL10n.markUnavailableImpact.resolveFor(
          languageCode,
        );
      case AdminMaterialReportDecision.hide:
        return AdminMaterialReportsL10n.hideMaterialImpact.resolveFor(
          languageCode,
        );
      case null:
        return null;
    }
  }

  Future<void> _submit(String languageCode) async {
    if (_submitting) return;
    final decision = _decision;
    if (decision == null) {
      setState(() {
        _errorText = AdminMaterialReportsL10n.selectDecision.resolveFor(
          languageCode,
        );
      });
      return;
    }
    if (_selectedDecisionLocked) {
      setState(() => _errorText = _lockMessage(languageCode));
      return;
    }
    final note = _noteController.text.trim();
    if (note.length < 3) {
      setState(() {
        _errorText = AdminMaterialReportsL10n.adminNoteRequired.resolveFor(
          languageCode,
        );
      });
      return;
    }

    setState(() {
      _submitting = true;
      _errorText = null;
    });
    try {
      await widget.onSubmit(decision, note);
      if (!mounted) return;
      Navigator.of(context).pop(decision);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _errorText = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _errorText = AdminMaterialReportsL10n.adminNoteRequired.resolveFor(
          languageCode,
        );
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final languageCode = Localizations.localeOf(context).languageCode;
    final report = widget.report;
    final imageUrl = report.materialImageUrl;
    final resolvedImage = imageUrl == null || imageUrl.isEmpty
        ? null
        : ApiConfig.resolveMediaUrl(imageUrl);

    return AppDialogShell(
      maxWidth: 760,
      maxHeightFactor: 0.92,
      title: AppDialogTitleBlock(
        icon: Icons.flag_outlined,
        title: AdminMaterialReportsL10n.reviewReport.resolveFor(languageCode),
        badges: [
          AppStatusBadge(
            label: AdminMaterialReportsL10n.reportStatus(
              report.status,
              languageCode,
            ),
            tone: reviewStatusTone(report.status),
          ),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppDialogSection(
            title: AdminMaterialReportsL10n.reportContext.resolveFor(
              languageCode,
            ),
            icon: Icons.report_outlined,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AppDialogInfoRow(
                  label: AdminMaterialReportsL10n.reasonLabel.resolveFor(
                    languageCode,
                  ),
                  value: AdminMaterialReportsL10n.reason(
                    report.reason,
                    languageCode,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                AppDialogInfoRow(
                  label: AdminMaterialReportsL10n.reporterLabel.resolveFor(
                    languageCode,
                  ),
                  value: report.reporterName,
                ),
                const SizedBox(height: AppSpacing.sm),
                AppDialogInfoRow(
                  label: AdminMaterialReportsL10n.submittedLabel.resolveFor(
                    languageCode,
                  ),
                  value: MaterialLocalizations.of(
                    context,
                  ).formatMediumDate(report.createdAt.toLocal()),
                ),
                const SizedBox(height: AppSpacing.sm),
                AppDialogInfoRow(
                  label: AdminMaterialReportsL10n.reportStatusLabel.resolveFor(
                    languageCode,
                  ),
                  value: AdminMaterialReportsL10n.reportStatus(
                    report.status,
                    languageCode,
                  ),
                ),
                if (report.note != null && report.note!.trim().isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.md),
                  AppDialogNote(
                    title: AdminMaterialReportsL10n.reporterNoteLabel
                        .resolveFor(languageCode),
                    note: report.note!,
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          AppDialogSection(
            title: AdminMaterialReportsL10n.materialContext.resolveFor(
              languageCode,
            ),
            icon: Icons.inventory_2_outlined,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ClipRRect(
                      borderRadius: AppRadius.smAll,
                      child: SizedBox(
                        width: 72,
                        height: 72,
                        child: resolvedImage == null
                            ? ColoredBox(
                                color: colors.warningSoft,
                                child: Icon(
                                  Icons.inventory_2_outlined,
                                  color: colors.warningText,
                                ),
                              )
                            : Image.network(
                                resolvedImage,
                                fit: BoxFit.cover,
                                errorBuilder: (_, _, _) => ColoredBox(
                                  color: colors.surfaceMuted,
                                  child: Icon(
                                    Icons.image_not_supported_outlined,
                                    color: colors.textMuted,
                                  ),
                                ),
                              ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            report.materialTitle,
                            style: Theme.of(context).textTheme.titleSmall
                                ?.copyWith(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            report.supplierName,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: colors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: [
                    MaterialStatusBadge(
                      label: report.materialStatus.replaceAll('_', ' '),
                      tone: materialLifecycleStatusTone(report.materialStatus),
                    ),
                    AppStatusBadge(
                      label: report.isFree
                          ? AdminMaterialReportsL10n.freeLabel.resolveFor(
                              languageCode,
                            )
                          : AdminMaterialReportsL10n.paidLabel.resolveFor(
                              languageCode,
                            ),
                      tone: report.isFree
                          ? AppStatusTone.success
                          : AppStatusTone.info,
                    ),
                    if (!report.isFree && report.price != null)
                      AppStatusBadge(
                        label: '${report.price} ${report.currency}',
                        tone: AppStatusTone.neutral,
                      ),
                  ],
                ),
                if (widget.report.isModerationLocked) ...[
                  const SizedBox(height: AppSpacing.md),
                  AppDialogNote(
                    title: AdminMaterialReportsL10n.materialStatusLabel
                        .resolveFor(languageCode),
                    note: _lockMessage(languageCode),
                  ),
                ],
                const SizedBox(height: AppSpacing.md),
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: OutlinedButton.icon(
                    onPressed: widget.onViewMaterial,
                    icon: const Icon(Icons.open_in_new, size: 16),
                    label: Text(
                      AdminMaterialReportsL10n.viewFullMaterial.resolveFor(
                        languageCode,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          AppDialogSection(
            title: AdminMaterialReportsL10n.decision.resolveFor(languageCode),
            icon: Icons.gavel_outlined,
            child: Column(
              children: [
                _DecisionOption(
                  selected: _decision == AdminMaterialReportDecision.reject,
                  enabled: !_submitting,
                  title: AdminMaterialReportsL10n.rejectReport.resolveFor(
                    languageCode,
                  ),
                  description: AdminMaterialReportsL10n.rejectReportDescription
                      .resolveFor(languageCode),
                  onTap: () => setState(() {
                    _decision = AdminMaterialReportDecision.reject;
                    _errorText = null;
                  }),
                ),
                const SizedBox(height: AppSpacing.sm),
                _DecisionOption(
                  selected:
                      _decision == AdminMaterialReportDecision.resolveNoAction,
                  enabled: !_submitting,
                  title: AdminMaterialReportsL10n.resolveNoAction.resolveFor(
                    languageCode,
                  ),
                  description: AdminMaterialReportsL10n
                      .resolveNoActionDescription
                      .resolveFor(languageCode),
                  onTap: () => setState(() {
                    _decision = AdminMaterialReportDecision.resolveNoAction;
                    _errorText = null;
                  }),
                ),
                const SizedBox(height: AppSpacing.sm),
                _DecisionOption(
                  selected:
                      _decision == AdminMaterialReportDecision.markUnavailable,
                  enabled: !_submitting && _canMarkUnavailable,
                  title: AdminMaterialReportsL10n.markUnavailable.resolveFor(
                    languageCode,
                  ),
                  description: AdminMaterialReportsL10n
                      .markUnavailableDescription
                      .resolveFor(languageCode),
                  lockReason: _canMarkUnavailable
                      ? null
                      : _lockMessage(languageCode),
                  onTap: () => setState(() {
                    _decision = AdminMaterialReportDecision.markUnavailable;
                    _errorText = null;
                  }),
                ),
                const SizedBox(height: AppSpacing.sm),
                _DecisionOption(
                  selected: _decision == AdminMaterialReportDecision.hide,
                  enabled: !_submitting && _canHide,
                  title: AdminMaterialReportsL10n.hideMaterial.resolveFor(
                    languageCode,
                  ),
                  description: AdminMaterialReportsL10n.hideMaterialDescription
                      .resolveFor(languageCode),
                  lockReason: _canHide ? null : _lockMessage(languageCode),
                  onTap: () => setState(() {
                    _decision = AdminMaterialReportDecision.hide;
                    _errorText = null;
                  }),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          TextField(
            controller: _noteController,
            enabled: !_submitting,
            minLines: 3,
            maxLines: 5,
            onChanged: (_) {
              if (_errorText != null) setState(() => _errorText = null);
            },
            decoration: InputDecoration(
              labelText: AdminMaterialReportsL10n.adminNote.resolveFor(
                languageCode,
              ),
              hintText: AdminMaterialReportsL10n.adminNoteHint.resolveFor(
                languageCode,
              ),
              alignLabelWithHint: true,
            ),
          ),
          if (_impactCopy(languageCode) != null) ...[
            const SizedBox(height: AppSpacing.md),
            AppDialogNote(
              title: AdminMaterialReportsL10n.decision.resolveFor(languageCode),
              note: _impactCopy(languageCode)!,
            ),
          ],
          if (_errorText != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              _errorText!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
        ],
      ),
      footer: AppDialogFooter.decision(
        secondaryAction: TextButton(
          onPressed: _submitting ? null : () => Navigator.of(context).pop(),
          child: Text(AdminMaterialReportsL10n.cancel.resolveFor(languageCode)),
        ),
        primaryAction: FilledButton(
          onPressed: _submitting ? null : () => _submit(languageCode),
          style: AppStatusButtonStyle.filled(context, AppStatusTone.primary),
          child: _submitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text(
                  AdminMaterialReportsL10n.submitDecision.resolveFor(
                    languageCode,
                  ),
                ),
        ),
      ),
    );
  }
}

class _DecisionOption extends StatelessWidget {
  const _DecisionOption({
    required this.selected,
    required this.enabled,
    required this.title,
    required this.description,
    required this.onTap,
    this.lockReason,
  });

  final bool selected;
  final bool enabled;
  final String title;
  final String description;
  final VoidCallback onTap;
  final String? lockReason;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final palette = context.adminPalette;
    final interactive = enabled;
    return Material(
      color: selected
          ? palette.primaryTeal.withValues(alpha: 0.08)
          : colors.surfaceMuted,
      borderRadius: AppRadius.mdAll,
      child: InkWell(
        onTap: interactive ? onTap : null,
        borderRadius: AppRadius.mdAll,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 120),
          width: double.infinity,
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            borderRadius: AppRadius.mdAll,
            border: Border.all(
              color: selected ? palette.primaryTeal : colors.borderSubtle,
              width: selected ? 1.6 : 1,
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                selected ? Icons.radio_button_checked : Icons.radio_button_off,
                size: 20,
                color: !interactive
                    ? colors.textMuted
                    : selected
                    ? palette.primaryTeal
                    : colors.textSecondary,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: interactive
                            ? colors.textPrimary
                            : colors.textMuted,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      description,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: colors.textSecondary,
                        height: 1.35,
                      ),
                    ),
                    if (lockReason != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        lockReason!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: colors.warningText,
                          fontWeight: FontWeight.w600,
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
    );
  }
}
