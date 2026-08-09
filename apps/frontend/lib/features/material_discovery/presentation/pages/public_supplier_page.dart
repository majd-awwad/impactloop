import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/app_back_action.dart';
import '../../../../shared/widgets/app_section_card.dart';
import '../../../../shared/widgets/materials/app_material_card.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../auth/application/auth_controller.dart';
import '../../application/material_discovery_providers.dart';
import '../../application/supplier_follow_controller.dart';
import '../../domain/discovery_material.dart';
import '../../domain/material_discovery_query.dart';
import '../../domain/material_discovery_repository.dart';
import '../../domain/material_performance_models.dart';
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
  static const _pageSize = 24;

  late MaterialDiscoveryRepository _repository;
  final ScrollController _scrollController = ScrollController();
  CancelToken? _profileCancelToken;
  CancelToken? _materialsCancelToken;
  CancelToken? _viewerCancelToken;

  PublicSupplier? _supplier;
  List<DiscoveryMaterial> _materials = const [];
  bool _isProfileLoading = true;
  bool _isMaterialsLoading = true;
  bool _isLoadingMore = false;
  String? _profileError;
  String? _materialsError;
  int _page = 0;
  int _total = 0;
  int _selectedTabIndex = 1;

  @override
  void initState() {
    super.initState();
    _repository =
        widget.repository ?? ref.read(materialDiscoveryRepositoryProvider);
    _scrollController.addListener(_handleScroll);
    _load();
  }

  Future<void> _load() async {
    final profileFuture = _loadProfile();
    final materialsFuture = _loadMaterials(reset: true);
    await profileFuture;
    if (mounted) {
      unawaited(_loadViewerState());
    }
    await materialsFuture;
  }

  Future<void> _loadProfile() async {
    _profileCancelToken?.cancel('Supplier profile request replaced');
    final token = CancelToken();
    _profileCancelToken = token;
    setState(() {
      _isProfileLoading = true;
      _profileError = null;
    });

    try {
      final usesSplitViewerState =
          _repository is PublicSupplierPerformanceRepository;
      final supplier = usesSplitViewerState
          ? await (_repository as PublicSupplierPerformanceRepository)
                .fetchPublicSupplierCore(
                  widget.supplierProfileId,
                  cancelToken: token,
                )
          : await _repository.fetchPublicSupplier(widget.supplierProfileId);
      if (!mounted || token.isCancelled) return;

      if (supplier == null) {
        setState(() {
          _supplier = null;
          _isProfileLoading = false;
          _profileError = context.l10n.supplierProfileNotFound;
        });
        return;
      }
      setState(() {
        _supplier = supplier;
        _isProfileLoading = false;
      });
      final auth = ref.read(authControllerProvider);
      final controller = ref.read(supplierFollowControllerProvider.notifier);
      if (usesSplitViewerState) {
        controller.setAuthoritativeCount(
          supplierProfileId: supplier.id,
          viewerId: auth.user?.id,
          followersCount: supplier.followersCount,
          fallbackIsFollowedByViewer: supplier.isFollowedByViewer,
        );
      } else {
        controller.setAuthoritative(
          supplierProfileId: supplier.id,
          viewerId: auth.user?.id,
          followersCount: supplier.followersCount,
          isFollowedByViewer: supplier.isFollowedByViewer,
        );
      }
    } on DioException catch (error) {
      if (CancelToken.isCancel(error) || !mounted) return;
      setState(() {
        _isProfileLoading = false;
        _profileError = localizedApiErrorMessage(error, context.l10n);
      });
    } catch (error) {
      if (error is ApiException && error.isCancellation) return;
      if (!mounted) return;
      setState(() {
        _isProfileLoading = false;
        _profileError = localizedApiErrorMessage(error, context.l10n);
      });
    }
  }

  Future<void> _loadMaterials({required bool reset}) async {
    if (_isLoadingMore && !reset) return;
    final nextPage = reset ? 1 : _page + 1;
    if (!reset && (_total == 0 || _materials.length >= _total)) return;
    _materialsCancelToken?.cancel('Supplier materials request replaced');
    final token = CancelToken();
    _materialsCancelToken = token;
    setState(() {
      _materialsError = null;
      if (reset) {
        _isMaterialsLoading = true;
      } else {
        _isLoadingMore = true;
      }
    });
    try {
      final result = _repository is PublicSupplierPerformanceRepository
          ? await (_repository as PublicSupplierPerformanceRepository)
                .fetchSupplierMaterialsPage(
                  widget.supplierProfileId,
                  page: nextPage,
                  limit: _pageSize,
                  cancelToken: token,
                )
          : await _repository.fetchSupplierMaterials(
              widget.supplierProfileId,
              MaterialDiscoveryQuery(page: nextPage, limit: _pageSize),
            );
      if (!mounted || token.isCancelled) return;
      setState(() {
        _materials = reset ? result.items : [..._materials, ...result.items];
        _page = nextPage;
        _total = result.pagination.total;
        _isMaterialsLoading = false;
        _isLoadingMore = false;
        _materialsError = null;
      });
    } on DioException catch (error) {
      if (CancelToken.isCancel(error) || !mounted) return;
      setState(() {
        _isMaterialsLoading = false;
        _isLoadingMore = false;
        _materialsError = localizedApiErrorMessage(error, context.l10n);
      });
    } catch (error) {
      if (error is ApiException && error.isCancellation) return;
      if (!mounted) return;
      setState(() {
        _isMaterialsLoading = false;
        _isLoadingMore = false;
        _materialsError = localizedApiErrorMessage(error, context.l10n);
      });
    }
  }

  Future<void> _loadViewerState() async {
    final auth = ref.read(authControllerProvider);
    final repository = _repository;
    if (repository is! PublicSupplierPerformanceRepository) {
      return;
    }
    if (auth.status != AuthStatus.authenticated) {
      _viewerCancelToken?.cancel('Supplier viewer is no longer authenticated');
      final supplier = _supplier;
      if (supplier != null) {
        ref
            .read(supplierFollowControllerProvider.notifier)
            .setAuthoritativeFollowing(
              supplierProfileId: supplier.id,
              viewerId: null,
              isFollowedByViewer: false,
              fallbackFollowersCount: supplier.followersCount,
            );
      }
      return;
    }
    _viewerCancelToken?.cancel('Supplier viewer request replaced');
    final token = CancelToken();
    _viewerCancelToken = token;
    try {
      final state = await (repository as PublicSupplierPerformanceRepository)
          .fetchSupplierViewerState(
            widget.supplierProfileId,
            cancelToken: token,
          );
      if (!mounted || token.isCancelled || _supplier == null) return;
      ref
          .read(supplierFollowControllerProvider.notifier)
          .setAuthoritativeFollowing(
            supplierProfileId: widget.supplierProfileId,
            viewerId: auth.user?.id,
            isFollowedByViewer: state.isFollowedByViewer,
            fallbackFollowersCount: _supplier!.followersCount,
          );
    } catch (_) {
      // Header remains usable; follow mutations surface their own errors.
    }
  }

  void _handleScroll() {
    if (_selectedTabIndex == 1 &&
        _scrollController.hasClients &&
        _scrollController.position.extentAfter < 600) {
      unawaited(_loadMaterials(reset: false));
    }
  }

  @override
  void didUpdateWidget(covariant PublicSupplierPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.supplierProfileId != widget.supplierProfileId ||
        oldWidget.repository != widget.repository) {
      _repository =
          widget.repository ?? ref.read(materialDiscoveryRepositoryProvider);
      _supplier = null;
      _materials = const [];
      _page = 0;
      _total = 0;
      _load();
    }
  }

  @override
  void dispose() {
    _scrollController
      ..removeListener(_handleScroll)
      ..dispose();
    _profileCancelToken?.cancel('Supplier page disposed');
    _materialsCancelToken?.cancel('Supplier page disposed');
    _viewerCancelToken?.cancel('Supplier page disposed');
    super.dispose();
  }

  Future<void> _toggleFollow() async {
    final supplier = _supplier;
    if (supplier == null) return;

    final authState = ref.read(authControllerProvider);
    if (authState.status != AuthStatus.authenticated) {
      final from = Uri.encodeQueryComponent(
        '/suppliers/${widget.supplierProfileId}',
      );
      context.go('/login?from=$from');
      return;
    }

    if (authState.user?.hasRole('LEARNER') != true) {
      showInfoSnackBar(context, context.l10n.learnerAccountFollowRequired);
      return;
    }

    _viewerCancelToken?.cancel('Follow mutation started');

    try {
      final status = await ref
          .read(supplierFollowControllerProvider.notifier)
          .toggle(
            supplierProfileId: widget.supplierProfileId,
            viewerId: authState.user?.id,
            repository: _repository,
            fallbackFollowersCount: supplier.followersCount,
            fallbackIsFollowedByViewer: supplier.isFollowedByViewer,
          );
      if (!mounted || status == null) return;
      showSuccessSnackBar(
        context,
        status.isFollowedByViewer
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
      if (mounted) {
        showErrorSnackBar(
          context,
          error,
          message: localizedApiErrorMessage(error, context.l10n),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final desktopViewport = MediaQuery.sizeOf(context).width >= 900;
    final sourceSupplier = _supplier;
    final auth = ref.watch(authControllerProvider);
    final followStates = ref.watch(supplierFollowControllerProvider);
    final followState = sourceSupplier == null
        ? null
        : followStates[supplierFollowStateKey(
            supplierProfileId: sourceSupplier.id,
            viewerId: auth.status == AuthStatus.authenticated
                ? auth.user?.id
                : null,
          )];
    final supplier = sourceSupplier == null || followState == null
        ? sourceSupplier
        : sourceSupplier.copyWith(
            followersCount: followState.followersCount,
            isFollowedByViewer: followState.isFollowedByViewer,
          );

    ref.listen(authControllerProvider, (previous, next) {
      if (previous?.status != next.status ||
          previous?.user?.id != next.user?.id) {
        unawaited(_loadViewerState());
      }
    });

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
            if (!desktopViewport)
              Padding(
                padding: const EdgeInsetsDirectional.fromSTEB(
                  AppSpacing.md,
                  AppSpacing.sm,
                  AppSpacing.md,
                  0,
                ),
                child: Row(
                  children: [
                    const AppBackAction.compact(fallbackLocation: '/materials'),
                    Expanded(
                      child: Text(
                        supplier?.displayName ?? context.l10n.supplierProfile,
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
              child: supplier == null && _isProfileLoading
                  ? const Center(child: CircularProgressIndicator())
                  : supplier == null && _profileError != null
                  ? _ErrorState(message: _profileError!, onRetry: _loadProfile)
                  : supplier == null
                  ? _ErrorState(
                      message: context.l10n.supplierProfileNotFound,
                      onRetry: _loadProfile,
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: LayoutBuilder(
                        builder: (context, constraints) {
                          final isDesktop = constraints.maxWidth >= 900;
                          final horizontalInset = isDesktop
                              ? math.max(
                                  32.0,
                                  (constraints.maxWidth - 1500) / 2,
                                )
                              : AppSpacing.md;
                          return CustomScrollView(
                            controller: _scrollController,
                            physics: const AlwaysScrollableScrollPhysics(),
                            slivers: [
                              SliverPadding(
                                padding: EdgeInsetsDirectional.fromSTEB(
                                  horizontalInset,
                                  isDesktop ? 20 : AppSpacing.md,
                                  horizontalInset,
                                  0,
                                ),
                                sliver: SliverToBoxAdapter(
                                  child: Column(
                                    children: [
                                      if (isDesktop) ...[
                                        Align(
                                          alignment:
                                              AlignmentDirectional.centerStart,
                                          child: const AppBackAction.pageLevel(
                                            key: ValueKey(
                                              'public-supplier-desktop-back',
                                            ),
                                            fallbackLocation: '/materials',
                                          ),
                                        ),
                                        const SizedBox(height: AppSpacing.sm),
                                        PublicSupplierDesktopHero(
                                          supplier: supplier,
                                          isUpdatingFollow:
                                              followState?.isUpdating ?? false,
                                          onToggleFollow: _toggleFollow,
                                        ),
                                        PublicSupplierTabBar(
                                          desktop: true,
                                          selectedIndex: _selectedTabIndex,
                                          onSelected: (index) => setState(
                                            () => _selectedTabIndex = index,
                                          ),
                                        ),
                                        const SizedBox(height: AppSpacing.lg),
                                      ] else ...[
                                        PublicSupplierProfileHeader(
                                          supplier: supplier,
                                          isUpdatingFollow:
                                              followState?.isUpdating ?? false,
                                          onToggleFollow: _toggleFollow,
                                        ),
                                        const SizedBox(height: AppSpacing.md),
                                        PublicSupplierStatsBar(
                                          materialsCount:
                                              supplier.materialsCount,
                                          followersCount:
                                              supplier.followersCount,
                                          isWide: false,
                                        ),
                                        const SizedBox(height: AppSpacing.sm),
                                        PublicSupplierTabBar(
                                          selectedIndex: _selectedTabIndex,
                                          onSelected: (index) => setState(
                                            () => _selectedTabIndex = index,
                                          ),
                                        ),
                                        const SizedBox(height: AppSpacing.md),
                                      ],
                                    ],
                                  ),
                                ),
                              ),
                              if (_selectedTabIndex == 0)
                                SliverPadding(
                                  padding: EdgeInsetsDirectional.fromSTEB(
                                    horizontalInset,
                                    0,
                                    horizontalInset,
                                    AppSpacing.xl,
                                  ),
                                  sliver: SliverToBoxAdapter(
                                    child: _OverviewSection(
                                      supplier: supplier,
                                      desktop: isDesktop,
                                    ),
                                  ),
                                )
                              else ...[
                                SliverPadding(
                                  padding: EdgeInsetsDirectional.fromSTEB(
                                    horizontalInset,
                                    0,
                                    horizontalInset,
                                    AppSpacing.md,
                                  ),
                                  sliver: SliverToBoxAdapter(
                                    child: isDesktop
                                        ? Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                const LocalizedText(
                                                  en: 'Available materials',
                                                  ar: 'المواد المتاحة',
                                                ).resolve(context),
                                                style:
                                                    AppTextStyles.title(
                                                      context,
                                                    ).copyWith(
                                                      color:
                                                          palette.textPrimary,
                                                      fontSize: 20,
                                                    ),
                                              ),
                                              const SizedBox(height: 4),
                                              Text(
                                                context.l10n
                                                    .publicMaterialsCount(
                                                      _total,
                                                    ),
                                                style:
                                                    AppTextStyles.body(
                                                      context,
                                                    ).copyWith(
                                                      color:
                                                          palette.textSecondary,
                                                    ),
                                              ),
                                            ],
                                          )
                                        : Text(
                                            context.l10n.publicMaterialsCount(
                                              _total,
                                            ),
                                            style:
                                                AppTextStyles.subtitle(
                                                  context,
                                                ).copyWith(
                                                  color: palette.textSecondary,
                                                ),
                                          ),
                                  ),
                                ),
                                if (_isMaterialsLoading && _materials.isEmpty)
                                  const SliverFillRemaining(
                                    hasScrollBody: false,
                                    child: Center(
                                      child: CircularProgressIndicator(),
                                    ),
                                  )
                                else if (_materialsError != null &&
                                    _materials.isEmpty)
                                  SliverFillRemaining(
                                    hasScrollBody: false,
                                    child: _ErrorState(
                                      message: _materialsError!,
                                      onRetry: () =>
                                          _loadMaterials(reset: true),
                                    ),
                                  )
                                else if (_materials.isEmpty)
                                  SliverToBoxAdapter(
                                    child: Padding(
                                      padding: const EdgeInsets.all(
                                        AppSpacing.lg,
                                      ),
                                      child: Text(
                                        context.l10n.noPublicMaterials,
                                      ),
                                    ),
                                  )
                                else
                                  SliverPadding(
                                    padding: EdgeInsetsDirectional.fromSTEB(
                                      horizontalInset,
                                      0,
                                      horizontalInset,
                                      AppSpacing.md,
                                    ),
                                    sliver: SliverMaterialsDiscoveryResultsGrid(
                                      materials: _materials,
                                      cardVariant: isDesktop
                                          ? AppMaterialCardVariant
                                                .desktopCompact
                                          : AppMaterialCardVariant.standard,
                                      onMaterialTap: (material) => context.push(
                                        '/materials/${material.id}',
                                      ),
                                      showSupplierAttribution: false,
                                    ),
                                  ),
                                if (_isLoadingMore)
                                  const SliverToBoxAdapter(
                                    child: Padding(
                                      padding: EdgeInsets.all(AppSpacing.md),
                                      child: Center(
                                        child: CircularProgressIndicator(),
                                      ),
                                    ),
                                  ),
                                if (_materialsError != null &&
                                    _materials.isNotEmpty)
                                  SliverToBoxAdapter(
                                    child: Center(
                                      child: TextButton.icon(
                                        onPressed: () =>
                                            _loadMaterials(reset: false),
                                        icon: const Icon(Icons.refresh_rounded),
                                        label: Text(
                                          context.l10n.retryLoadingMore,
                                        ),
                                      ),
                                    ),
                                  ),
                                const SliverToBoxAdapter(
                                  child: SizedBox(height: AppSpacing.xl),
                                ),
                              ],
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
  const _OverviewSection({required this.supplier, required this.desktop});

  final PublicSupplier supplier;
  final bool desktop;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final location = [
      supplier.city,
      supplier.area,
    ].whereType<String>().where((value) => value.trim().isNotEmpty).join(', ');
    final description = supplier.description?.trim();
    final typeLabel = DiscoveryMaterial.supplierTypeLabelFor(
      supplier.supplierType,
    )?.resolve(context);

    if (desktop) {
      return Align(
        alignment: AlignmentDirectional.centerStart,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 920),
          child: AppSectionCard(
            padding: const EdgeInsetsDirectional.all(28),
            borderRadius: AppRadius.xlAll,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  context.l10n.aboutSupplier,
                  style: AppTextStyles.title(
                    context,
                  ).copyWith(color: palette.textPrimary, fontSize: 20),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  description != null && description.isNotEmpty
                      ? description
                      : context.l10n.aboutSupplierDescription,
                  style: AppTextStyles.body(
                    context,
                  ).copyWith(color: palette.textSecondary, height: 1.6),
                ),
                if (location.isNotEmpty || typeLabel != null) ...[
                  const SizedBox(height: AppSpacing.lg),
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: [
                      if (location.isNotEmpty)
                        _OverviewInfoChip(
                          icon: Icons.location_on_outlined,
                          label: location,
                        ),
                      if (typeLabel != null)
                        _OverviewInfoChip(
                          icon: Icons.storefront_outlined,
                          label: typeLabel,
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          context.l10n.aboutSupplier,
          style: AppTextStyles.title(
            context,
          ).copyWith(color: palette.textPrimary, fontSize: 18),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          context.l10n.aboutSupplierDescription,
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

class _OverviewInfoChip extends StatelessWidget {
  const _OverviewInfoChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: palette.cardSurfaceAlt,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: palette.mint),
          const SizedBox(width: AppSpacing.xs),
          Text(
            label,
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
        ],
      ),
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
