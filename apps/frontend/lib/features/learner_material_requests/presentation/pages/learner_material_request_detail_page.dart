import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../home/application/learner_home_provider.dart';
import '../../../learning_hub/application/project_build_refresh.dart';
import '../../application/learner_material_requests_providers.dart';
import '../../data/models/learner_material_request.dart';
import '../l10n/learner_material_requests_l10n.dart';
import '../widgets/learner_material_request_match_card.dart';

const _kMaxContentWidth = 720.0;

class LearnerMaterialRequestDetailPage extends ConsumerWidget {
  const LearnerMaterialRequestDetailPage({super.key, required this.requestId});

  final String requestId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = MaterialsUiPalette.of(context);
    final detailAsync = ref.watch(
      learnerMaterialRequestDetailProvider(requestId),
    );

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            EntryNavBar(
              showSignIn: false,
              showCreateAccount: false,
              homeRoute: '/home',
              phoneTitle: LearnerMaterialRequestsL10n.requestDetailsTitle
                  .resolve(context),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(
                      maxWidth: _kMaxContentWidth,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            IconButton(
                              onPressed: () =>
                                  context.popOrGo('/learner/material-requests'),
                              icon: const Icon(Icons.arrow_back_rounded),
                              tooltip: 'Back',
                            ),
                            const SizedBox(width: AppSpacing.xs),
                            Expanded(
                              child: Text(
                                LearnerMaterialRequestsL10n
                                    .requestDetailsTitle
                                    .resolve(context),
                                style: AppTextStyles.title(
                                  context,
                                ).copyWith(color: palette.textPrimary),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.md),
                        detailAsync.when(
                          loading: () => const Padding(
                            padding: EdgeInsets.symmetric(
                              vertical: AppSpacing.xxl,
                            ),
                            child: Center(child: CircularProgressIndicator()),
                          ),
                          error: (error, _) => _ErrorPanel(
                            onRetry: () => ref.invalidate(
                              learnerMaterialRequestDetailProvider(requestId),
                            ),
                          ),
                          data: (request) =>
                              _RequestDetailBody(request: request),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorPanel extends StatelessWidget {
  const _ErrorPanel({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.xl),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderStrong),
      ),
      child: Column(
        children: [
          Icon(Icons.cloud_off_outlined, color: palette.mint, size: 34),
          const SizedBox(height: AppSpacing.md),
          Text(
            LearnerMaterialRequestsL10n.genericLoadError.resolve(context),
            style: AppTextStyles.title(
              context,
            ).copyWith(color: palette.textPrimary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.lg),
          FilledButton(
            onPressed: onRetry,
            child: Text(LearnerMaterialRequestsL10n.retry.resolve(context)),
          ),
        ],
      ),
    );
  }
}

class _RequestDetailBody extends ConsumerStatefulWidget {
  const _RequestDetailBody({required this.request});

  final LearnerMaterialRequest request;

  @override
  ConsumerState<_RequestDetailBody> createState() => _RequestDetailBodyState();
}

class _RequestDetailBodyState extends ConsumerState<_RequestDetailBody> {
  bool _isMutating = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _refreshLinkedBuildState(widget.request);
    });
  }

  @override
  void didUpdateWidget(covariant _RequestDetailBody oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.request.id != widget.request.id ||
        oldWidget.request.buildSyncRepaired != widget.request.buildSyncRepaired ||
        oldWidget.request.updatedAt != widget.request.updatedAt) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _refreshLinkedBuildState(widget.request);
      });
    }
  }

  void _refreshLinkedBuildState(LearnerMaterialRequest request) {
    if (request.projectId == null || request.projectId!.isEmpty) {
      return;
    }

    ref.refreshLinkedProjectBuild(request.projectId);
    if (request.buildSyncRepaired || request.isFulfilled) {
      ref.invalidate(learnerHomeFeedProvider);
      ref.invalidate(learnerHomeSectionDetailsProvider);
    }
  }

  Future<void> _runAction(Future<void> Function() action) async {
    if (_isMutating) return;
    setState(() => _isMutating = true);
    try {
      await action();
    } catch (error) {
      if (!mounted) return;
      showErrorSnackBar(context, error);
    } finally {
      if (mounted) {
        setState(() => _isMutating = false);
      }
    }
  }

  Future<bool> _confirm(String title) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        content: Text(title),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(
              LearnerMaterialRequestsL10n.cancelAction.resolve(context),
            ),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(LearnerMaterialRequestsL10n.confirm.resolve(context)),
          ),
        ],
      ),
    );
    return confirmed ?? false;
  }

  Future<void> _handleCancel() async {
    final confirmed = await _confirm(
      LearnerMaterialRequestsL10n.cancelRequestConfirm.resolve(context),
    );
    if (!confirmed) return;
    await _runAction(() async {
      await cancelLearnerMaterialRequest(ref, widget.request.id);
      if (!mounted) return;
      showInfoSnackBar(
        context,
        LearnerMaterialRequestsL10n.requestCancelled.resolve(context),
      );
    });
  }

  Future<void> _handleFulfill() async {
    final confirmed = await _confirm(
      LearnerMaterialRequestsL10n.markFulfilledConfirm.resolve(context),
    );
    if (!confirmed) return;
    await _runAction(() async {
      await fulfillLearnerMaterialRequest(ref, widget.request.id);
      if (!mounted) return;
      showInfoSnackBar(
        context,
        LearnerMaterialRequestsL10n.requestFulfilled.resolve(context),
      );
    });
  }

  Future<void> _handleDuplicate() async {
    await _runAction(() async {
      final duplicated = await duplicateLearnerMaterialRequest(
        ref,
        widget.request.id,
      );
      if (!mounted) return;
      showInfoSnackBar(
        context,
        LearnerMaterialRequestsL10n.requestDuplicated.resolve(context),
      );
      context.push('/learner/material-requests/${duplicated.id}');
    });
  }

  Future<void> _handleDismissMatch(LearnerMaterialRequestMatch match) async {
    final confirmed = await _confirm(
      LearnerMaterialRequestsL10n.dismissSuggestionConfirm.resolve(context),
    );
    if (!confirmed) return;
    await _runAction(() async {
      await dismissLearnerMaterialRequestMatch(
        ref,
        match.id,
        requestId: widget.request.id,
      );
      if (!mounted) return;
      showInfoSnackBar(
        context,
        LearnerMaterialRequestsL10n.suggestionDismissed.resolve(context),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final colors = AppThemeColors.of(context);
    final request = widget.request;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
          decoration: BoxDecoration(
            color: palette.panelSurface,
            borderRadius: AppRadius.lgAll,
            border: Border.all(color: palette.borderSubtle),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      request.requestedItemName,
                      style: AppTextStyles.title(
                        context,
                      ).copyWith(color: palette.textPrimary),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  _StatusBadge(status: request.status),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                LearnerMaterialRequestsL10n.quantityUnitLine(
                  _formatQuantity(request.quantity),
                  request.unit,
                ).resolve(context),
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: palette.textSecondary),
              ),
              if (request.description != null &&
                  request.description!.trim().isNotEmpty) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  request.description!,
                  style: AppTextStyles.body(
                    context,
                  ).copyWith(color: palette.textPrimary),
                ),
              ],
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  Icon(
                    Icons.place_outlined,
                    size: 16,
                    color: palette.textSecondary,
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Text(
                    request.location.displayLabel,
                    style: AppTextStyles.body(
                      context,
                    ).copyWith(color: palette.textSecondary),
                  ),
                ],
              ),
              if (request.neededBy != null) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  LearnerMaterialRequestsL10n.neededByLine(
                    _formatDate(request.neededBy!),
                  ).resolve(context),
                  style: AppTextStyles.body(
                    context,
                  ).copyWith(color: palette.textSecondary),
                ),
              ],
              if (request.isOpen) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  LearnerMaterialRequestsL10n.expiresLine(
                    _formatDate(request.expiresAt),
                  ).resolve(context),
                  style: AppTextStyles.body(
                    context,
                  ).copyWith(color: palette.textSecondary),
                ),
              ],
              if (request.projectContext != null) ...[
                const SizedBox(height: AppSpacing.sm),
                Container(
                  padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: colors.primarySoft,
                    borderRadius: AppRadius.mdAll,
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.construction_outlined,
                        size: 16,
                        color: colors.primary,
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Expanded(
                        child: Text(
                          '${LearnerMaterialRequestsL10n.projectContextLabel.resolve(context)}: '
                          '${request.projectContext!.title}'
                          '${request.projectContext!.componentName != null ? ' · ${request.projectContext!.componentName}' : ''}',
                          style: AppTextStyles.label(
                            context,
                          ).copyWith(color: colors.primary),
                        ),
                      ),
                    ],
                  ),
                ),
                if (request.isFulfilled &&
                    request.projectId != null &&
                    request.projectId!.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: FilledButton.tonalIcon(
                      onPressed: () =>
                          context.push('/learning/${request.projectId}/build'),
                      icon: const Icon(Icons.construction_outlined),
                      label: Text(
                        LearnerMaterialRequestsL10n.returnToProjectBuild.resolve(
                          context,
                        ),
                      ),
                    ),
                  ),
                ],
              ],
              const SizedBox(height: AppSpacing.md),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  if (request.isOpen) ...[
                    OutlinedButton(
                      onPressed: _isMutating ? null : _handleFulfill,
                      child: Text(
                        LearnerMaterialRequestsL10n.markFulfilled.resolve(
                          context,
                        ),
                      ),
                    ),
                    OutlinedButton(
                      onPressed: _isMutating ? null : _handleCancel,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: colors.danger,
                        side: BorderSide(
                          color: colors.danger.withValues(alpha: 0.4),
                        ),
                      ),
                      child: Text(
                        LearnerMaterialRequestsL10n.cancelRequest.resolve(
                          context,
                        ),
                      ),
                    ),
                  ] else
                    OutlinedButton(
                      onPressed: _isMutating ? null : _handleDuplicate,
                      child: Text(
                        LearnerMaterialRequestsL10n.duplicateRequest.resolve(
                          context,
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        Text(
          request.isFulfilled
              ? LearnerMaterialRequestsL10n.fulfilledMatchesTitle.resolve(
                  context,
                )
              : LearnerMaterialRequestsL10n.matchesTitle.resolve(context),
          style: AppTextStyles.subtitle(
            context,
          ).copyWith(color: palette.textPrimary),
        ),
        const SizedBox(height: AppSpacing.sm),
        if (request.matches.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
            decoration: BoxDecoration(
              color: palette.panelSurface,
              borderRadius: AppRadius.lgAll,
              border: Border.all(color: palette.borderSubtle),
            ),
            child: Text(
              LearnerMaterialRequestsL10n.noMatchesYet.resolve(context),
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textSecondary),
              textAlign: TextAlign.center,
            ),
          )
        else
          Column(
            children: request.matches
                .map(
                  (match) => Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.md),
                    child: LearnerMaterialRequestMatchCard(
                      match: match,
                      requestId: request.id,
                      requestStatus: request.status,
                      projectId: request.projectId,
                      isMutating: _isMutating,
                      onDismiss: request.isOpen
                          ? () => _handleDismissMatch(match)
                          : () {},
                    ),
                  ),
                )
                .toList(growable: false),
          ),
      ],
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final tone = switch (status) {
      'OPEN' => colors.primary,
      'FULFILLED' => colors.success,
      'CANCELLED' => colors.textSecondary,
      'EXPIRED' => colors.danger,
      _ => colors.textSecondary,
    };

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: 4,
      ),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: 0.12),
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: tone.withValues(alpha: 0.35)),
      ),
      child: Text(
        LearnerMaterialRequestsL10n.statusLabel(status).resolve(context),
        style: AppTextStyles.label(context).copyWith(color: tone),
      ),
    );
  }
}

String _formatQuantity(double value) {
  if (value == value.roundToDouble()) {
    return value.toStringAsFixed(0);
  }
  return value.toStringAsFixed(2);
}

String _formatDate(DateTime date) {
  final local = date.toLocal();
  return '${local.year}-${local.month.toString().padLeft(2, '0')}-${local.day.toString().padLeft(2, '0')}';
}
