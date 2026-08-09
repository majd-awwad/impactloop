import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../../shared/widgets/supplier/supplier_identity_widgets.dart';
import '../../../auth/application/auth_controller.dart';
import '../../application/supplier_follow_controller.dart';
import '../../domain/discovery_material.dart';
import '../../domain/material_discovery_repository.dart';

class MaterialSupplierProfileCard extends ConsumerStatefulWidget {
  const MaterialSupplierProfileCard({
    super.key,
    required this.material,
    required this.repository,
  });

  final DiscoveryMaterial material;
  final MaterialDiscoveryRepository repository;

  @override
  ConsumerState<MaterialSupplierProfileCard> createState() =>
      _MaterialSupplierProfileCardState();
}

class _MaterialSupplierProfileCardState
    extends ConsumerState<MaterialSupplierProfileCard> {
  DiscoveryMaterial get material => widget.material;

  String? get _supplierProfileId {
    final id = material.supplier?.id.trim();
    return id == null || id.isEmpty ? null : id;
  }

  String? get _viewerId {
    final auth = ref.read(authControllerProvider);
    return auth.status == AuthStatus.authenticated ? auth.user?.id : null;
  }

  int get _sourceFollowersCount => material.supplier?.followersCount ?? 0;

  bool get _sourceIsFollowing => material.supplier?.isFollowedByViewer ?? false;

  @override
  void initState() {
    super.initState();
    _scheduleSharedStateSeed();
  }

  @override
  void didUpdateWidget(covariant MaterialSupplierProfileCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    final oldSupplier = oldWidget.material.supplier;
    final nextSupplier = material.supplier;
    if (oldSupplier?.id != nextSupplier?.id) {
      _scheduleSharedStateSeed();
      return;
    }

    if (oldSupplier?.followersCount != nextSupplier?.followersCount ||
        oldSupplier?.isFollowedByViewer != nextSupplier?.isFollowedByViewer) {
      final supplierProfileId = _supplierProfileId;
      if (supplierProfileId != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted || _supplierProfileId != supplierProfileId) return;
          ref
              .read(supplierFollowControllerProvider.notifier)
              .setAuthoritative(
                supplierProfileId: supplierProfileId,
                viewerId: _viewerId,
                followersCount: _sourceFollowersCount,
                isFollowedByViewer: _sourceIsFollowing,
              );
        });
      }
    }
  }

  void _scheduleSharedStateSeed() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _seedSharedState();
    });
  }

  void _seedSharedState() {
    final supplierProfileId = _supplierProfileId;
    if (supplierProfileId == null) return;

    ref
        .read(supplierFollowControllerProvider.notifier)
        .seed(
          supplierProfileId: supplierProfileId,
          viewerId: _viewerId,
          followersCount: _sourceFollowersCount,
          isFollowedByViewer: _sourceIsFollowing,
        );
  }

  Future<void> _toggleFollow() async {
    final supplierProfileId = _supplierProfileId;
    if (supplierProfileId == null) return;

    final authState = ref.read(authControllerProvider);
    if (authState.status != AuthStatus.authenticated) {
      final from = Uri.encodeQueryComponent('/materials/${material.id}');
      context.go('/login?from=$from');
      return;
    }

    if (authState.user?.hasRole('LEARNER') != true) {
      showInfoSnackBar(
        context,
        const LocalizedText(
          en: 'Use a learner account to follow suppliers.',
          ar: 'استخدم حساب متعلّم لمتابعة المورّدين.',
        ).resolve(context),
      );
      return;
    }

    try {
      final result = await ref
          .read(supplierFollowControllerProvider.notifier)
          .toggle(
            supplierProfileId: supplierProfileId,
            viewerId: authState.user?.id,
            repository: widget.repository,
            fallbackFollowersCount: _sourceFollowersCount,
            fallbackIsFollowedByViewer: _sourceIsFollowing,
          );
      if (!mounted || result == null) return;

      showSuccessSnackBar(
        context,
        result.isFollowedByViewer
            ? const LocalizedText(
                en: 'Supplier followed successfully',
                ar: 'تمت المتابعة بنجاح',
              ).resolve(context)
            : const LocalizedText(
                en: 'Supplier unfollowed',
                ar: 'تم إلغاء المتابعة',
              ).resolve(context),
      );
    } catch (error) {
      if (mounted) showErrorSnackBar(context, error);
    }
  }

  void _openSupplierProfile() {
    final supplierProfileId = _supplierProfileId;
    if (supplierProfileId != null) {
      context.go('/suppliers/$supplierProfileId');
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final supplier = material.supplier;
    final supplierProfileId = _supplierProfileId;
    final auth = ref.watch(authControllerProvider);
    final viewerId = auth.status == AuthStatus.authenticated
        ? auth.user?.id
        : null;
    final stateKey = supplierProfileId == null
        ? null
        : supplierFollowStateKey(
            supplierProfileId: supplierProfileId,
            viewerId: viewerId,
          );
    final sharedStates = ref.watch(supplierFollowControllerProvider);
    final followState = stateKey == null ? null : sharedStates[stateKey];
    final isFollowing = followState?.isFollowedByViewer ?? _sourceIsFollowing;
    final followersCount = followState?.followersCount ?? _sourceFollowersCount;
    final isUpdating = followState?.isUpdating ?? false;
    final displayName =
        supplier?.displayName ?? material.supplierName.resolve(context);
    final location = [
      supplier?.city,
      supplier?.area,
    ].whereType<String>().where((value) => value.trim().isNotEmpty).join(', ');
    final canNavigate = supplierProfileId != null;

    if (stateKey != null && !sharedStates.containsKey(stateKey)) {
      _scheduleSharedStateSeed();
    }

    return Container(
      key: const ValueKey('material-supplier-profile-card'),
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: palette.mint.withValues(alpha: 0.22)),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow.withValues(alpha: 0.14),
            blurRadius: 28,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: _SupplierSectionLabel(
              label: const LocalizedText(
                en: 'Supplier',
                ar: 'المورد',
              ).resolve(context),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          LayoutBuilder(
            builder: (context, identityConstraints) {
              final compactIdentity = identityConstraints.maxWidth < 330;
              return Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  GestureDetector(
                    onTap: canNavigate ? _openSupplierProfile : null,
                    child: SupplierIdentityAvatar(
                      displayName: displayName,
                      avatarUrl: supplier?.avatarUrl,
                      radius: compactIdentity ? 34 : 42,
                      borderColor: palette.mint.withValues(alpha: 0.2),
                      borderWidth: 2,
                    ),
                  ),
                  SizedBox(
                    width: compactIdentity ? AppSpacing.md : AppSpacing.lg,
                  ),
                  Expanded(
                    child: GestureDetector(
                      onTap: canNavigate ? _openSupplierProfile : null,
                      behavior: HitTestBehavior.opaque,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            displayName,
                            style: AppTextStyles.title(context).copyWith(
                              color: palette.textPrimary,
                              fontSize: compactIdentity ? 17 : 19,
                              fontWeight: FontWeight.w800,
                              height: 1.2,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Wrap(
                            spacing: AppSpacing.md,
                            runSpacing: AppSpacing.xs,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              _SupplierTypeLabel(
                                label: material.supplierSubtitle.resolve(
                                  context,
                                ),
                              ),
                              if (material.supplierVerified)
                                _SupplierIdentityBadge(
                                  label: const LocalizedText(
                                    en: 'Verified',
                                    ar: 'موثّق',
                                  ).resolve(context),
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
          if (location.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            Align(
              alignment: Alignment.center,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.location_on_outlined,
                    size: 20,
                    color: palette.textMuted,
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Flexible(
                    child: Text(
                      location,
                      style: AppTextStyles.body(
                        context,
                      ).copyWith(color: palette.textSecondary, fontSize: 14),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                    ),
                  ),
                ],
              ),
            ),
          ],
          if (canNavigate) ...[
            const SizedBox(height: AppSpacing.lg),
            Divider(height: 1, thickness: 1, color: palette.borderSubtle),
            Padding(
              key: const ValueKey('supplier-followers-stat'),
              padding: const EdgeInsetsDirectional.symmetric(
                vertical: AppSpacing.md,
              ),
              child: Row(
                children: [
                  Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      color: palette.mint.withValues(alpha: 0.08),
                      borderRadius: AppRadius.mdAll,
                      border: Border.all(
                        color: palette.mint.withValues(alpha: 0.1),
                      ),
                    ),
                    child: Icon(
                      Icons.people_outline_rounded,
                      size: 25,
                      color: palette.mint,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Text(
                      const LocalizedText(
                        en: 'Followers',
                        ar: 'المتابعون',
                      ).resolve(context),
                      style: AppTextStyles.label(context).copyWith(
                        color: palette.textSecondary,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  Container(width: 1, height: 34, color: palette.borderSubtle),
                  const SizedBox(width: AppSpacing.lg),
                  Text(
                    '$followersCount',
                    key: const ValueKey('supplier-followers-count'),
                    style: AppTextStyles.title(context).copyWith(
                      color: palette.mint,
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            Divider(height: 1, thickness: 1, color: palette.borderSubtle),
            const SizedBox(height: AppSpacing.md),
            LayoutBuilder(
              builder: (context, constraints) {
                final primary = _SupplierFollowButton(
                  isFollowing: isFollowing,
                  isUpdating: isUpdating,
                  onPressed: _toggleFollow,
                );
                final secondary = OutlinedButton(
                  key: const ValueKey('supplier-view-profile-button'),
                  onPressed: _openSupplierProfile,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: palette.mint,
                    side: BorderSide(
                      color: palette.mint.withValues(alpha: 0.62),
                    ),
                    minimumSize: const Size.fromHeight(52),
                    shape: RoundedRectangleBorder(
                      borderRadius: AppRadius.mdAll,
                    ),
                  ),
                  child: Text(
                    const LocalizedText(
                      en: 'View profile',
                      ar: 'عرض الملف',
                    ).resolve(context),
                  ),
                );

                if (constraints.maxWidth < 290) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      primary,
                      const SizedBox(height: AppSpacing.sm),
                      secondary,
                    ],
                  );
                }

                return Row(
                  children: [
                    Expanded(child: primary),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(child: secondary),
                  ],
                );
              },
            ),
          ],
        ],
      ),
    );
  }
}

class _SupplierSectionLabel extends StatelessWidget {
  const _SupplierSectionLabel({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Container(
      key: const ValueKey('supplier-section-label'),
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: palette.mint.withValues(alpha: 0.07),
        borderRadius: AppRadius.pillAll,
      ),
      child: Text(
        label,
        style: AppTextStyles.label(context).copyWith(
          color: palette.textSecondary,
          fontSize: 13,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _SupplierTypeLabel extends StatelessWidget {
  const _SupplierTypeLabel({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.storefront_outlined, size: 16, color: palette.textMuted),
        const SizedBox(width: AppSpacing.xs),
        Flexible(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.body(context).copyWith(
              color: palette.textSecondary,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}

class _SupplierIdentityBadge extends StatelessWidget {
  const _SupplierIdentityBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Container(
      key: const ValueKey('supplier-verified-badge'),
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: palette.mint.withValues(alpha: 0.1),
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: palette.mint.withValues(alpha: 0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.verified_rounded, size: 14, color: palette.mint),
          const SizedBox(width: AppSpacing.xs),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.label(
                context,
              ).copyWith(
                color: palette.mint,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SupplierFollowButton extends StatelessWidget {
  const _SupplierFollowButton({
    required this.isFollowing,
    required this.isUpdating,
    required this.onPressed,
  });

  final bool isFollowing;
  final bool isUpdating;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final background = palette.mint;
    final foreground = palette.ctaForeground;

    return Semantics(
      selected: isFollowing,
      button: true,
      child: FilledButton.icon(
        key: const ValueKey('supplier-follow-button'),
        onPressed: isUpdating ? null : onPressed,
        icon: isUpdating
            ? SizedBox(
                width: 17,
                height: 17,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: foreground,
                ),
              )
            : Icon(
                isFollowing ? Icons.check_rounded : Icons.person_add_outlined,
                size: 19,
              ),
        label: Text(
          isFollowing
              ? const LocalizedText(
                  en: 'Following',
                  ar: 'متابَع',
                ).resolve(context)
              : const LocalizedText(
                  en: 'Follow',
                  ar: 'متابعة',
                ).resolve(context),
        ),
        style: FilledButton.styleFrom(
          backgroundColor: background,
          foregroundColor: foreground,
          disabledBackgroundColor: background,
          disabledForegroundColor: foreground,
          side: BorderSide(color: palette.mint),
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
        ),
      ),
    );
  }
}
