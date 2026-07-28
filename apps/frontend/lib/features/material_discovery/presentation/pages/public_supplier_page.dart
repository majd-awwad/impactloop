import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../auth/application/auth_controller.dart';
import '../../application/material_discovery_providers.dart';
import '../../domain/discovery_material.dart';
import '../../domain/material_discovery_query.dart';
import '../../domain/material_discovery_repository.dart';
import '../widgets/materials_discovery_results_grid.dart';
import '../widgets/public_supplier_profile_widgets.dart';

class PublicSupplierPage extends ConsumerStatefulWidget {
  const PublicSupplierPage({
    super.key,
    required this.supplierProfileId,
    this.repository,
  });

  final String supplierProfileId;
  final MaterialDiscoveryRepository? repository;

  @override
  ConsumerState<PublicSupplierPage> createState() => _PublicSupplierPageState();
}

class _PublicSupplierPageState extends ConsumerState<PublicSupplierPage> {
  late final MaterialDiscoveryRepository _repository;

  PublicSupplier? _supplier;
  List<DiscoveryMaterial> _materials = const [];
  bool _isLoading = true;
  bool _isUpdatingFollow = false;
  String? _errorMessage;
  int _selectedTabIndex = 1;

  @override
  void initState() {
    super.initState();
    _repository =
        widget.repository ?? ref.read(materialDiscoveryRepositoryProvider);
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final supplier = await _repository.fetchPublicSupplier(
        widget.supplierProfileId,
      );
      if (!mounted) {
        return;
      }

      if (supplier == null) {
        setState(() {
          _supplier = null;
          _materials = const [];
          _isLoading = false;
          _errorMessage = 'Supplier profile not found.';
        });
        return;
      }

      final materialsResult = await _repository.fetchSupplierMaterials(
        widget.supplierProfileId,
        const MaterialDiscoveryQuery(page: 1, limit: 24),
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _supplier = supplier;
        _materials = materialsResult.items;
        _isLoading = false;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _isLoading = false;
        _errorMessage = error.toString();
      });
    }
  }

  Future<void> _toggleFollow() async {
    final supplier = _supplier;
    if (supplier == null || _isUpdatingFollow) {
      return;
    }

    final authState = ref.read(authControllerProvider);
    if (authState.status != AuthStatus.authenticated) {
      final from = Uri.encodeQueryComponent(
        '/suppliers/${widget.supplierProfileId}',
      );
      context.go('/login?from=$from');
      return;
    }

    if (authState.user?.hasRole('LEARNER') != true) {
      showInfoSnackBar(context, 'Use a learner account to follow suppliers.');
      return;
    }

    final previousCount = supplier.followersCount;
    final previousFollowing = supplier.isFollowedByViewer;
    final shouldFollow = !supplier.isFollowedByViewer;

    setState(() {
      _isUpdatingFollow = true;
      _supplier = supplier.copyWith(
        isFollowedByViewer: shouldFollow,
        followersCount: shouldFollow
            ? supplier.followersCount + 1
            : (supplier.followersCount > 0
                  ? supplier.followersCount - 1
                  : 0),
      );
    });

    try {
      final status = shouldFollow
          ? await _repository.followSupplier(widget.supplierProfileId)
          : await _repository.unfollowSupplier(widget.supplierProfileId);

      if (!mounted) {
        return;
      }

      setState(() {
        _supplier = supplier.copyWith(
          followersCount: status.followersCount,
          isFollowedByViewer: status.isFollowedByViewer,
        );
      });
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _supplier = supplier.copyWith(
          followersCount: previousCount,
          isFollowedByViewer: previousFollowing,
        );
      });
      showErrorSnackBar(context, error);
    } finally {
      if (mounted) {
        setState(() {
          _isUpdatingFollow = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final supplier = _supplier;

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const EntryNavBar(
              showSignIn: true,
              showCreateAccount: true,
              homeRoute: '/',
            ),
            Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(
                AppSpacing.md,
                AppSpacing.sm,
                AppSpacing.md,
                0,
              ),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => context.popOrGo('/materials'),
                    icon: const Icon(Icons.arrow_back_rounded),
                  ),
                  Expanded(
                    child: Text(
                      supplier?.displayName ??
                          const LocalizedText(
                            en: 'Supplier profile',
                            ar: 'ملف المورد',
                          ).resolve(context),
                      style: AppTextStyles.title(
                        context,
                      ).copyWith(color: palette.textPrimary),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : _errorMessage != null
                  ? _ErrorState(message: _errorMessage!, onRetry: _load)
                  : supplier == null
                  ? _ErrorState(
                      message: 'Supplier profile not found.',
                      onRetry: _load,
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: LayoutBuilder(
                        builder: (context, constraints) {
                          final isWide = constraints.maxWidth >= 1024;

                          return ListView(
                            padding: const EdgeInsetsDirectional.all(
                              AppSpacing.md,
                            ),
                            children: [
                              PublicSupplierProfileHeader(
                                supplier: supplier,
                                isUpdatingFollow: _isUpdatingFollow,
                                onToggleFollow: _toggleFollow,
                              ),
                              const SizedBox(height: AppSpacing.md),
                              PublicSupplierStatsBar(
                                materialsCount: supplier.materialsCount,
                                followersCount: supplier.followersCount,
                                isWide: isWide,
                              ),
                              const SizedBox(height: AppSpacing.sm),
                              PublicSupplierTabBar(
                                selectedIndex: _selectedTabIndex,
                                onSelected: (index) {
                                  setState(() => _selectedTabIndex = index);
                                },
                              ),
                              const SizedBox(height: AppSpacing.md),
                              if (_selectedTabIndex == 0)
                                _OverviewSection(supplier: supplier)
                              else
                                _MaterialsSection(
                                  materials: _materials,
                                  onMaterialTap: (material) =>
                                      context.go('/materials/${material.id}'),
                                ),
                            ],
                          );
                        },
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OverviewSection extends StatelessWidget {
  const _OverviewSection({required this.supplier});

  final PublicSupplier supplier;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final location = [
      supplier.city,
      supplier.area,
    ].whereType<String>().where((value) => value.trim().isNotEmpty).join(', ');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          const LocalizedText(
            en: 'About this supplier',
            ar: 'عن هذا المورد',
          ).resolve(context),
          style: AppTextStyles.title(
            context,
          ).copyWith(color: palette.textPrimary, fontSize: 18),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          const LocalizedText(
            en:
                'Browse public materials from this supplier and follow updates when new stock is published.',
            ar:
                'تصفح المواد العامة من هذا المورد وتابع التحديثات عند نشر مخزون جديد.',
          ).resolve(context),
          style: AppTextStyles.body(
            context,
          ).copyWith(color: palette.textSecondary, height: 1.5),
        ),
        if (location.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Icon(Icons.location_on_outlined, color: palette.textMuted),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Text(
                  location,
                  style: AppTextStyles.body(
                    context,
                  ).copyWith(color: palette.textSecondary),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _MaterialsSection extends StatelessWidget {
  const _MaterialsSection({
    required this.materials,
    required this.onMaterialTap,
  });

  final List<DiscoveryMaterial> materials;
  final ValueChanged<DiscoveryMaterial> onMaterialTap;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    if (materials.isEmpty) {
      return Padding(
        padding: const EdgeInsetsDirectional.symmetric(
          vertical: AppSpacing.lg,
        ),
        child: Text(
          const LocalizedText(
            en: 'No public materials are available right now.',
            ar: 'لا توجد مواد عامة متاحة حالياً.',
          ).resolve(context),
          style: AppTextStyles.body(
            context,
          ).copyWith(color: palette.textSecondary),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          LocalizedText(
            en: '${materials.length} public materials',
            ar: '${materials.length} مواد عامة',
          ).resolve(context),
          style: AppTextStyles.subtitle(
            context,
          ).copyWith(color: palette.textSecondary),
        ),
        const SizedBox(height: AppSpacing.md),
        MaterialsDiscoveryResultsGrid(
          materials: materials,
          onMaterialTap: onMaterialTap,
          showSupplierAttribution: false,
        ),
      ],
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: AppSpacing.md),
            FilledButton(
              onPressed: onRetry,
              child: Text(
                const LocalizedText(
                  en: 'Retry',
                  ar: 'إعادة المحاولة',
                ).resolve(context),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
