import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../core/errors/api_exception.dart';
import '../../application/supplier_material_requests_providers.dart';
import '../../data/models/supplier_material_request.dart';
import '../theme/supplier_theme_extension.dart';
import '../widgets/supplier_feedback.dart';

const _contentMaxWidth = 820.0;

class SupplierMaterialRequestDetailPage extends ConsumerWidget {
  const SupplierMaterialRequestDetailPage({super.key, required this.requestId});

  final String requestId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final compact = MediaQuery.sizeOf(context).width < 900;
    final detailAsync = ref.watch(
      supplierMaterialRequestDetailProvider(requestId),
    );

    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: _contentMaxWidth),
        child: SingleChildScrollView(
          padding: context.supplierDecorations
              .pagePadding(compact: compact)
              .add(const EdgeInsets.only(top: AppSpacing.lg)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  IconButton(
                    onPressed: () =>
                        context.canPop() ? context.pop() : context.go('/supplier/material-requests'),
                    icon: const Icon(Icons.arrow_back_rounded),
                    tooltip: context.s.back,
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Expanded(
                    child: Text(
                      context.s.materialRequestDetailsTitle,
                      style: context.supplierTitle().copyWith(fontSize: 20),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              detailAsync.when(
                loading: () => const Padding(
                  padding: EdgeInsets.symmetric(vertical: AppSpacing.xxl),
                  child: Center(child: CircularProgressIndicator()),
                ),
                error: (_, _) => _ErrorPanel(
                  onRetry: () => ref.invalidate(
                    supplierMaterialRequestDetailProvider(requestId),
                  ),
                ),
                data: (request) => _RequestDetailBody(request: request),
              ),
            ],
          ),
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
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: context.supplierColors.border),
      ),
      child: Row(
        children: [
          const Icon(Icons.cloud_off_outlined),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              context.s.materialRequestLoadError,
              style: context.supplierBody(),
            ),
          ),
          OutlinedButton(onPressed: onRetry, child: Text(context.s.tryAgain)),
        ],
      ),
    );
  }
}

class _RequestDetailBody extends ConsumerWidget {
  const _RequestDetailBody({required this.request});

  final SupplierMaterialRequest request;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.supplierColors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
          decoration: BoxDecoration(
            color: colors.surfaceSolid,
            borderRadius: AppRadius.lgAll,
            border: Border.all(color: colors.border.withValues(alpha: .6)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                request.requestedItemName,
                style: context.supplierTitle().copyWith(fontSize: 20),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                '${_formatQuantity(request.quantity)} ${request.unit}',
                style: context
                    .supplierBody()
                    .copyWith(color: colors.textSecondary),
              ),
              if (request.description != null &&
                  request.description!.trim().isNotEmpty) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(request.description!, style: context.supplierBody()),
              ],
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  Icon(
                    Icons.place_outlined,
                    size: 16,
                    color: colors.textSecondary,
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Text(
                    request.location.displayLabel,
                    style: context
                        .supplierBody()
                        .copyWith(color: colors.textSecondary),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Container(
                padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
                decoration: BoxDecoration(
                  color: colors.accentSoft,
                  borderRadius: AppRadius.mdAll,
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.privacy_tip_outlined,
                      size: 16,
                      color: colors.accent,
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Text(
                        context.s.materialRequestPrivacyNote,
                        style: context
                            .supplierBody()
                            .copyWith(fontSize: 12, color: colors.textSecondary),
                      ),
                    ),
                  ],
                ),
              ),
              if (!request.isOpen) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  context.s.requestNoLongerOpen,
                  style: context.supplierBody().copyWith(color: colors.error),
                ),
              ],
              const SizedBox(height: AppSpacing.md),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => context.push(
                    '/supplier/materials/new?materialRequestId=${Uri.encodeComponent(request.id)}',
                  ),
                  icon: const Icon(Icons.add_business_outlined),
                  label: Text(context.s.publishMatchingMaterial),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        Text(
          context.s.candidateMaterialsTitle,
          style: context.supplierSectionTitle(),
        ),
        const SizedBox(height: AppSpacing.sm),
        if (request.isOpen)
          _CandidateMaterialsSection(requestId: request.id)
        else
          Container(
            width: double.infinity,
            padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
            decoration: BoxDecoration(
              color: colors.surfaceSolid,
              borderRadius: AppRadius.lgAll,
              border: Border.all(color: colors.border),
            ),
            child: Text(
              context.s.candidateMaterialsEmpty,
              style: context.supplierBody(),
              textAlign: TextAlign.center,
            ),
          ),
        if (request.ownMatches.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.lg),
          Text(
            context.s.alreadySuggestedLabel,
            style: context.supplierSectionTitle(),
          ),
          const SizedBox(height: AppSpacing.sm),
          Column(
            children: request.ownMatches
                .map(
                  (match) => Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                    child: _OwnMatchTile(match: match),
                  ),
                )
                .toList(growable: false),
          ),
        ],
      ],
    );
  }
}

class _OwnMatchTile extends StatelessWidget {
  const _OwnMatchTile({required this.match});

  final SupplierMaterialRequestOwnMatch match;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surfaceSolid,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: colors.border.withValues(alpha: .6)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              match.materialTitle ?? 'Material',
              style: context.supplierBody(),
            ),
          ),
          if (match.isReserved)
            Text(
              'Reserved',
              style: context.supplierChip().copyWith(color: colors.accent),
            )
          else
            Text(
              match.status,
              style: context
                  .supplierChip()
                  .copyWith(color: colors.textSecondary),
            ),
        ],
      ),
    );
  }
}

class _CandidateMaterialsSection extends ConsumerStatefulWidget {
  const _CandidateMaterialsSection({required this.requestId});

  final String requestId;

  @override
  ConsumerState<_CandidateMaterialsSection> createState() =>
      _CandidateMaterialsSectionState();
}

class _CandidateMaterialsSectionState
    extends ConsumerState<_CandidateMaterialsSection> {
  String? _suggestingMaterialId;

  Future<void> _suggest(
    SupplierMaterialRequestCandidate candidate, {
    bool confirmWeakMatch = false,
  }) async {
    setState(() => _suggestingMaterialId = candidate.materialId);
    try {
      await suggestSupplierMaterialForRequest(
        ref,
        widget.requestId,
        materialId: candidate.materialId,
        confirmWeakMatch: confirmWeakMatch,
      );
      if (!mounted) return;
      showSupplierInfoSnackBar(context, context.s.suggestionSent);
    } on ApiException catch (error) {
      if (!mounted) return;
      if (error.code == 'WEAK_MATCH_CONFIRMATION_REQUIRED') {
        final confirmed = await _confirmWeakMatch();
        if (confirmed && mounted) {
          await _suggest(candidate, confirmWeakMatch: true);
          return;
        }
      } else {
        showSupplierErrorSnackBar(context, error.displayMessage);
      }
    } catch (_) {
      if (!mounted) return;
      showSupplierErrorSnackBar(context, context.s.suggestionFailed);
    } finally {
      if (mounted) {
        setState(() => _suggestingMaterialId = null);
      }
    }
  }

  Future<bool> _confirmWeakMatch() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(context.s.weakMatchTitle),
        content: Text(context.s.weakMatchMessage),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(context.s.cancel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(context.s.suggestAnyway),
          ),
        ],
      ),
    );
    return confirmed ?? false;
  }

  @override
  Widget build(BuildContext context) {
    final candidatesAsync = ref.watch(
      supplierMaterialRequestCandidatesProvider(widget.requestId),
    );
    final colors = context.supplierColors;

    return candidatesAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: AppSpacing.lg),
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (_, _) => Container(
        width: double.infinity,
        padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
        decoration: BoxDecoration(
          color: colors.surfaceSolid,
          borderRadius: AppRadius.lgAll,
          border: Border.all(color: colors.border),
        ),
        child: Text(
          context.s.materialRequestLoadError,
          style: context.supplierBody(),
        ),
      ),
      data: (result) {
        if (result.items.isEmpty) {
          return Container(
            width: double.infinity,
            padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
            decoration: BoxDecoration(
              color: colors.surfaceSolid,
              borderRadius: AppRadius.lgAll,
              border: Border.all(color: colors.border),
            ),
            child: Text(
              context.s.candidateMaterialsEmpty,
              style: context.supplierBody(),
              textAlign: TextAlign.center,
            ),
          );
        }

        return Column(
          children: result.items
              .map(
                (candidate) => Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                  child: _CandidateCard(
                    candidate: candidate,
                    isSuggesting: _suggestingMaterialId == candidate.materialId,
                    onSuggest: () => _suggest(candidate),
                  ),
                ),
              )
              .toList(growable: false),
        );
      },
    );
  }
}

class _CandidateCard extends StatelessWidget {
  const _CandidateCard({
    required this.candidate,
    required this.isSuggesting,
    required this.onSuggest,
  });

  final SupplierMaterialRequestCandidate candidate;
  final bool isSuggesting;
  final VoidCallback onSuggest;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surfaceSolid,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: colors.border.withValues(alpha: .6)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(candidate.title, style: context.supplierBody()),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  '${_formatQuantity(candidate.availableQuantity)} ${candidate.unit} available',
                  style: context
                      .supplierBody()
                      .copyWith(fontSize: 12, color: colors.textSecondary),
                ),
                if (candidate.isWeakMatch) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Container(
                    padding: const EdgeInsetsDirectional.symmetric(
                      horizontal: AppSpacing.sm,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: colors.amberAccent.withValues(alpha: 0.12),
                      borderRadius: AppRadius.pillAll,
                    ),
                    child: Text(
                      context.s.weakMatchBadge,
                      style: context
                          .supplierChip()
                          .copyWith(color: colors.amberAccent),
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          FilledButton(
            onPressed: isSuggesting ? null : onSuggest,
            child: isSuggesting
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(context.s.suggestThisMaterial),
          ),
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
