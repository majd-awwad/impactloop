import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/app_back_action.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../application/learner_material_requests_providers.dart';
import '../../data/models/learner_material_request.dart';
import '../l10n/learner_material_requests_l10n.dart';

const _kMaxContentWidth = 920.0;

const _kStatusFilters = <String?>[null, 'OPEN', 'FULFILLED', 'CANCELLED', 'EXPIRED'];

class LearnerMaterialRequestsPage extends ConsumerWidget {
  const LearnerMaterialRequestsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = MaterialsUiPalette.of(context);

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
              phoneTitle: LearnerMaterialRequestsL10n.pageTitle.resolve(
                context,
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(
                      maxWidth: _kMaxContentWidth,
                    ),
                    child: const _LearnerMaterialRequestsContent(),
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

class _LearnerMaterialRequestsContent extends ConsumerWidget {
  const _LearnerMaterialRequestsContent();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = MaterialsUiPalette.of(context);
    final requestsAsync = ref.watch(learnerMaterialRequestsProvider);
    final query = ref.watch(learnerMaterialRequestsQueryProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const AppBackAction(fallbackLocation: '/home'),
                      const SizedBox(width: AppSpacing.xs),
                      Expanded(
                        child: Text(
                          LearnerMaterialRequestsL10n.pageTitle.resolve(
                            context,
                          ),
                          style: AppTextStyles.title(
                            context,
                          ).copyWith(color: palette.textPrimary),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Padding(
                    padding: const EdgeInsetsDirectional.only(start: 48),
                    child: Text(
                      LearnerMaterialRequestsL10n.pageSubtitle.resolve(
                        context,
                      ),
                      style: AppTextStyles.body(
                        context,
                      ).copyWith(color: palette.textSecondary),
                    ),
                  ),
                ],
              ),
            ),
            FilledButton.icon(
              onPressed: () => context.push('/learner/material-requests/new'),
              icon: const Icon(Icons.add_rounded),
              label: Text(
                LearnerMaterialRequestsL10n.newRequest.resolve(context),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        _StatusFilterChips(
          selected: query.status,
          onSelected: (status) => ref
              .read(learnerMaterialRequestsQueryProvider.notifier)
              .setStatus(status),
        ),
        const SizedBox(height: AppSpacing.lg),
        requestsAsync.when(
          loading: () => _StatePanel(
            icon: Icons.hourglass_empty_rounded,
            title: LearnerMaterialRequestsL10n.loading.resolve(context),
            subtitle: '',
          ),
          error: (error, _) => _StatePanel(
            icon: Icons.cloud_off_outlined,
            title: LearnerMaterialRequestsL10n.loadError.resolve(context),
            subtitle: '',
            actionLabel: LearnerMaterialRequestsL10n.retry.resolve(context),
            onAction: () => ref.invalidate(learnerMaterialRequestsProvider),
          ),
          data: (result) {
            if (result.items.isEmpty) {
              final hasFilter = query.status != null;
              return _StatePanel(
                icon: Icons.inventory_2_outlined,
                title: hasFilter
                    ? LearnerMaterialRequestsL10n.emptyFilteredTitle.resolve(
                        context,
                      )
                    : LearnerMaterialRequestsL10n.emptyTitle.resolve(context),
                subtitle: hasFilter
                    ? ''
                    : LearnerMaterialRequestsL10n.emptySubtitle.resolve(
                        context,
                      ),
                actionLabel: hasFilter
                    ? null
                    : LearnerMaterialRequestsL10n.newRequest.resolve(context),
                onAction: hasFilter
                    ? null
                    : () => context.push('/learner/material-requests/new'),
              );
            }

            return Column(
              children: result.items
                  .map(
                    (request) => Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.md),
                      child: _MaterialRequestCard(request: request),
                    ),
                  )
                  .toList(growable: false),
            );
          },
        ),
      ],
    );
  }
}

class _StatusFilterChips extends StatelessWidget {
  const _StatusFilterChips({required this.selected, required this.onSelected});

  final String? selected;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final colors = AppThemeColors.of(context);

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: _kStatusFilters.map((status) {
          final isSelected = status == selected;
          final label = status == null
              ? LearnerMaterialRequestsL10n.statusAll.resolve(context)
              : LearnerMaterialRequestsL10n.statusLabel(status).resolve(
                  context,
                );

          return Padding(
            padding: const EdgeInsetsDirectional.only(end: AppSpacing.sm),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () => onSelected(status),
                borderRadius: AppRadius.pillAll,
                child: Ink(
                  padding: const EdgeInsetsDirectional.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.sm,
                  ),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? colors.primarySoft
                        : palette.panelSurface,
                    borderRadius: AppRadius.pillAll,
                    border: Border.all(
                      color: isSelected
                          ? colors.primary.withValues(alpha: 0.35)
                          : palette.borderSubtle,
                    ),
                  ),
                  child: Text(
                    label,
                    style: AppTextStyles.label(context).copyWith(
                      color: isSelected ? colors.primary : palette.textSecondary,
                      fontWeight: isSelected
                          ? FontWeight.w600
                          : FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ),
          );
        }).toList(growable: false),
      ),
    );
  }
}

class _MaterialRequestCard extends StatelessWidget {
  const _MaterialRequestCard({required this.request});

  final LearnerMaterialRequest request;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final colors = AppThemeColors.of(context);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () =>
            context.push('/learner/material-requests/${request.id}'),
        borderRadius: AppRadius.lgAll,
        child: Container(
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
                    Text(
                      request.requestedItemName,
                      style: AppTextStyles.subtitle(
                        context,
                      ).copyWith(color: palette.textPrimary),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      LearnerMaterialRequestsL10n.quantityUnitLine(
                        _formatQuantity(request.quantity),
                        request.unit,
                      ).resolve(context),
                      style: AppTextStyles.body(
                        context,
                      ).copyWith(color: palette.textSecondary),
                    ),
                    if (request.suggestionCount > 0) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        LearnerMaterialRequestsL10n.suggestionsCount(
                          request.suggestionCount,
                        ).resolve(context),
                        style: AppTextStyles.label(
                          context,
                        ).copyWith(color: colors.primary),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              _StatusBadge(status: request.status),
            ],
          ),
        ),
      ),
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

class _StatePanel extends StatelessWidget {
  const _StatePanel({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

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
          Icon(icon, color: palette.mint, size: 34),
          const SizedBox(height: AppSpacing.md),
          Text(
            title,
            style: AppTextStyles.title(
              context,
            ).copyWith(color: palette.textPrimary),
            textAlign: TextAlign.center,
          ),
          if (subtitle.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              subtitle,
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textSecondary),
              textAlign: TextAlign.center,
            ),
          ],
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: AppSpacing.lg),
            FilledButton(onPressed: onAction, child: Text(actionLabel!)),
          ],
        ],
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
