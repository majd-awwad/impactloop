import 'dart:async';

import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../auth/application/auth_controller.dart';
import '../../application/material_discovery_providers.dart';
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
  bool _isUpdatingFollow = false;
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
      final supplier = _repository is PublicSupplierPerformanceRepository
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
      if (mounted && _supplier?.isFollowedByViewer == true) {
        setState(
          () => _supplier = _supplier!.copyWith(isFollowedByViewer: false),
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
      setState(
        () => _supplier = _supplier!.copyWith(
          isFollowedByViewer: state.isFollowedByViewer,
        ),
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
      showInfoSnackBar(context, context.l10n.learnerAccountFollowRequired);
      return;
    }

    final previousCount = supplier.followersCount;
    final previousFollowing = supplier.isFollowedByViewer;
    final shouldFollow = !supplier.isFollowedByViewer;
    _viewerCancelToken?.cancel('Follow mutation started');

    setState(() {
      _isUpdatingFollow = true;
      _supplier = supplier.copyWith(
        isFollowedByViewer: shouldFollow,
        followersCount: shouldFollow
            ? supplier.followersCount + 1
            : (supplier.followersCount > 0 ? supplier.followersCount - 1 : 0),
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
      showErrorSnackBar(context, localizedApiErrorMessage(error, context.l10n));
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
                    icon: const BackButtonIcon(),
                  ),
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
                          final isWide = constraints.maxWidth >= 1024;
                          return CustomScrollView(
                            controller: _scrollController,
                            physics: const AlwaysScrollableScrollPhysics(),
                            slivers: [
                              SliverPadding(
                                padding: const EdgeInsetsDirectional.fromSTEB(
                                  AppSpacing.md,
                                  AppSpacing.md,
                                  AppSpacing.md,
                                  0,
                                ),
                                sliver: SliverToBoxAdapter(
                                  child: Column(
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
                                        onSelected: (index) => setState(
                                          () => _selectedTabIndex = index,
                                        ),
                                      ),
                                      const SizedBox(height: AppSpacing.md),
                                    ],
                                  ),
                                ),
                              ),
                              if (_selectedTabIndex == 0)
                                SliverPadding(
                                  padding: const EdgeInsetsDirectional.fromSTEB(
                                    AppSpacing.md,
                                    0,
                                    AppSpacing.md,
                                    AppSpacing.xl,
                                  ),
                                  sliver: SliverToBoxAdapter(
                                    child: _OverviewSection(supplier: supplier),
                                  ),
                                )
                              else ...[
                                SliverPadding(
                                  padding: const EdgeInsetsDirectional.fromSTEB(
                                    AppSpacing.md,
                                    0,
                                    AppSpacing.md,
                                    AppSpacing.md,
                                  ),
                                  sliver: SliverToBoxAdapter(
                                    child: Text(
                                      context.l10n.publicMaterialsCount(_total),
                                      style: AppTextStyles.subtitle(
                                        context,
                                      ).copyWith(color: palette.textSecondary),
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
                                    padding:
                                        const EdgeInsetsDirectional.fromSTEB(
                                          AppSpacing.md,
                                          0,
                                          AppSpacing.md,
                                          AppSpacing.md,
                                        ),
                                    sliver: SliverMaterialsDiscoveryResultsGrid(
                                      materials: _materials,
                                      onMaterialTap: (material) => context.go(
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
