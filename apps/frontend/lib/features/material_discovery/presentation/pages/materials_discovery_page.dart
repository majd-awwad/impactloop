import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/widgets/app_mobile_bottom_nav_bar.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../materials/application/material_listing_providers.dart';
import '../../../materials/data/models/category.dart';
import '../../application/material_discovery_providers.dart';
import '../../domain/discovery_material.dart';
import '../../domain/material_discovery_list_merge.dart';
import '../../domain/material_discovery_query.dart';
import '../../domain/material_discovery_repository.dart';
import '../../domain/material_discovery_result.dart';
import '../material_discovery_content.dart';
import '../views/materials_discovery_view.dart';

class MaterialsDiscoveryPage extends ConsumerStatefulWidget {
  const MaterialsDiscoveryPage({super.key, this.repository});

  final MaterialDiscoveryRepository? repository;

  @override
  ConsumerState<MaterialsDiscoveryPage> createState() =>
      _MaterialsDiscoveryPageState();
}

class _MaterialsDiscoveryPageState extends ConsumerState<MaterialsDiscoveryPage> {
  static const _debounceDuration = Duration(milliseconds: 300);

  late final MaterialDiscoveryRepository _defaultRepository;
  late MaterialDiscoveryRepository _activeRepository;

  final _searchController = TextEditingController();
  final _cityController = TextEditingController();
  final _areaController = TextEditingController();

  Timer? _debounceTimer;
  MaterialDiscoveryQuery _query = const MaterialDiscoveryQuery();
  List<DiscoveryMaterial> _materials = [];
  MaterialDiscoveryPagination? _pagination;
  bool _isLoading = true;
  bool _isRefetching = false;
  bool _isLoadingMore = false;
  String? _errorMessage;
  int _fetchGeneration = 0;
  int _lastCategoryCount = 0;
  bool _pendingCategoryRefetch = false;

  int _selectedCategoryIndex = 0;
  int _selectedQuickFilterIndex = 0;
  int _selectedSortIndex = 0;
  int _selectedConditionIndex = 0;
  String _searchValue = '';

  @override
  void initState() {
    super.initState();
    _defaultRepository = ref.read(materialDiscoveryRepositoryProvider);
    _activeRepository = widget.repository ?? _defaultRepository;
    _fetchMaterials(reset: true);
  }

  @override
  void didUpdateWidget(covariant MaterialsDiscoveryPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    final nextRepository = widget.repository ?? _defaultRepository;
    if (oldWidget.repository != widget.repository ||
        _activeRepository != nextRepository) {
      _activeRepository = nextRepository;
      _fetchMaterials(reset: true);
    }
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _searchController.dispose();
    _cityController.dispose();
    _areaController.dispose();
    super.dispose();
  }

  bool _hasActiveFilters(List<MaterialCategory> categories) {
    return _buildQuery(categories: categories).hasActiveFilters;
  }

  MaterialDiscoveryQuery _buildQuery({
    required List<MaterialCategory> categories,
    int? page,
  }) {
    final categoryId = _selectedCategoryIndex == 0 ||
            categories.isEmpty ||
            _selectedCategoryIndex - 1 >= categories.length
        ? null
        : categories[_selectedCategoryIndex - 1].id;

    final quickFilter = _selectedQuickFilterIndex;
    final priceType = switch (quickFilter) {
      1 => 'FREE',
      2 => 'PAID',
      _ => 'ANY',
    };
    final deliveryAvailable = quickFilter == 3 ? true : null;
    final pickupAllowed = quickFilter == 4 ? true : null;

    final condition = materialConditionFilters[_selectedConditionIndex].value;
    final sort = _selectedSortIndex == 1 ? 'popular' : 'newest';

    return MaterialDiscoveryQuery(
      q: _searchController.text.trim().isEmpty
          ? null
          : _searchController.text.trim(),
      categoryId: categoryId,
      condition: condition,
      priceType: priceType,
      deliveryAvailable: deliveryAvailable,
      pickupAllowed: pickupAllowed,
      city: _cityController.text.trim().isEmpty
          ? null
          : _cityController.text.trim(),
      area: _areaController.text.trim().isEmpty
          ? null
          : _areaController.text.trim(),
      sort: sort,
      page: page ?? 1,
    );
  }

  void _scheduleRefetch(List<MaterialCategory> categories) {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(_debounceDuration, () {
      if (!mounted) {
        return;
      }

      setState(() {
        _query = _buildQuery(categories: categories);
      });
      _fetchMaterials(reset: true);
    });
  }

  void _maybeRefetchForLoadedCategories(List<MaterialCategory> categories) {
    final categoriesJustLoaded =
        _lastCategoryCount == 0 && categories.isNotEmpty;
    _lastCategoryCount = categories.length;

    if (!categoriesJustLoaded ||
        _selectedCategoryIndex == 0 ||
        _pendingCategoryRefetch) {
      return;
    }

    _pendingCategoryRefetch = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _query = _buildQuery(categories: categories);
      });
      _fetchMaterials(reset: true).whenComplete(() {
        _pendingCategoryRefetch = false;
      });
    });
  }

  void _releaseFetchLoadingIfLatest(int requestGeneration) {
    if (!mounted || requestGeneration != _fetchGeneration) {
      return;
    }

    setState(() {
      _isLoading = false;
      _isRefetching = false;
      _isLoadingMore = false;
    });
  }

  Future<void> _fetchMaterials({required bool reset}) async {
    final requestGeneration = ++_fetchGeneration;
    final query = _query;

    if (reset) {
      setState(() {
        if (_materials.isEmpty) {
          _isLoading = true;
          _errorMessage = null;
        } else {
          _isRefetching = true;
        }
      });
    } else {
      setState(() {
        _isLoadingMore = true;
      });
    }

    try {
      final result = await _activeRepository.fetchMaterials(query);

      if (!mounted ||
          !shouldApplyDiscoveryFetchResult(
            requestGeneration: requestGeneration,
            latestGeneration: _fetchGeneration,
          )) {
        return;
      }

      setState(() {
        _materials = mergeDiscoveryMaterials(
          reset: reset,
          current: _materials,
          incoming: result.items,
        );
        _pagination = result.pagination;
        _isLoading = false;
        _isRefetching = false;
        _isLoadingMore = false;
        _errorMessage = null;
      });
    } catch (_) {
      if (!mounted ||
          !shouldApplyDiscoveryFetchResult(
            requestGeneration: requestGeneration,
            latestGeneration: _fetchGeneration,
          )) {
        return;
      }

      setState(() {
        _isLoading = false;
        _isRefetching = false;
        _isLoadingMore = false;
        _errorMessage = 'Unable to load materials right now.';
      });
    } finally {
      _releaseFetchLoadingIfLatest(requestGeneration);
    }
  }

  void _loadMore(List<MaterialCategory> categories) {
    final pagination = _pagination;
    if (pagination == null || !pagination.hasMore || _isLoadingMore) {
      return;
    }

    setState(() {
      _query = _buildQuery(
        categories: categories,
        page: pagination.page + 1,
      );
    });
    _fetchMaterials(reset: false);
  }

  void _clearFilters(List<MaterialCategory> categories) {
    _debounceTimer?.cancel();
    _searchController.clear();
    _cityController.clear();
    _areaController.clear();
    setState(() {
      _searchValue = '';
      _selectedCategoryIndex = 0;
      _selectedQuickFilterIndex = 0;
      _selectedSortIndex = 0;
      _selectedConditionIndex = 0;
      _query = _buildQuery(categories: categories);
    });
    _fetchMaterials(reset: true);
  }

  void _applyImmediateFilter(
    List<MaterialCategory> categories,
    VoidCallback updateSelection,
  ) {
    _debounceTimer?.cancel();
    setState(updateSelection);
    setState(() {
      _query = _buildQuery(categories: categories);
    });
    _fetchMaterials(reset: true);
  }

  void _retryFetch(List<MaterialCategory> categories) {
    final shouldReset = _query.page <= 1;
    setState(() {
      _query = _buildQuery(
        categories: categories,
        page: _query.page,
      );
    });
    _fetchMaterials(reset: shouldReset);
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final categoriesAsync = ref.watch(discoveryMaterialCategoriesProvider);
    final categories = categoriesAsync.maybeWhen(
      data: (value) => value,
      orElse: () => const <MaterialCategory>[],
    );

    _maybeRefetchForLoadedCategories(categories);

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
            Expanded(
              child: () {
                if (_isLoading && _materials.isEmpty) {
                  return _CenteredState(
                    child: CircularProgressIndicator(color: palette.mint),
                  );
                }

                if (_errorMessage != null && _materials.isEmpty) {
                  return _CenteredState(
                    child: _InitialLoadErrorState(
                      onRetry: () => _retryFetch(categories),
                    ),
                  );
                }

                return SingleChildScrollView(
                  padding: appMobileAwareScrollPadding(context),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 1400),
                      child: MaterialsDiscoveryView(
                        materials: _materials,
                        pagination: _pagination,
                        categories: categories,
                        searchController: _searchController,
                        cityController: _cityController,
                        areaController: _areaController,
                        searchValue: _searchValue,
                        selectedCategoryIndex: _selectedCategoryIndex,
                        selectedQuickFilterIndex: _selectedQuickFilterIndex,
                        selectedSortIndex: _selectedSortIndex,
                        selectedConditionIndex: _selectedConditionIndex,
                        hasActiveFilters: _hasActiveFilters(categories),
                        isRefetching: _isRefetching,
                        isLoadingMore: _isLoadingMore,
                        refetchErrorMessage: _materials.isNotEmpty
                            ? _errorMessage
                            : null,
                        onRetryRefetch: _materials.isNotEmpty
                            ? () => _retryFetch(categories)
                            : null,
                        onSearchChanged: (value) {
                          setState(() => _searchValue = value);
                          _scheduleRefetch(categories);
                        },
                        onCityChanged: (_) => _scheduleRefetch(categories),
                        onAreaChanged: (_) => _scheduleRefetch(categories),
                        onCategorySelected: (index) => _applyImmediateFilter(
                          categories,
                          () => _selectedCategoryIndex = index,
                        ),
                        onQuickFilterSelected: (index) => _applyImmediateFilter(
                          categories,
                          () => _selectedQuickFilterIndex = index,
                        ),
                        onSortSelected: (index) => _applyImmediateFilter(
                          categories,
                          () => _selectedSortIndex = index,
                        ),
                        onConditionSelected: (index) => _applyImmediateFilter(
                          categories,
                          () => _selectedConditionIndex = index,
                        ),
                        onClearFilters: () => _clearFilters(categories),
                        onLoadMore: () => _loadMore(categories),
                        onMaterialTap: (material) =>
                            context.go('/materials/${material.id}'),
                      ),
                    ),
                  ),
                );
              }(),
            ),
          ],
        ),
      ),
    );
  }
}

class _CenteredState extends StatelessWidget {
  const _CenteredState({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.xl),
        child: child,
      ),
    );
  }
}

class _StateMessage extends StatelessWidget {
  const _StateMessage({required this.text});

  final LocalizedText text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text.resolve(context),
      style: Theme.of(context).textTheme.titleMedium?.copyWith(
        color: MaterialsUiPalette.of(context).textPrimary,
      ),
      textAlign: TextAlign.center,
    );
  }
}

class _InitialLoadErrorState extends StatelessWidget {
  const _InitialLoadErrorState({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 520),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.cloud_off_outlined, size: 42, color: palette.mint),
          const SizedBox(height: AppSpacing.md),
          _StateMessage(
            text: const LocalizedText(
              en: 'Unable to load materials',
              ar: 'تعذر تحميل المواد',
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            const LocalizedText(
              en: 'Check your connection or try again in a moment.',
              ar: 'تحقق من الاتصال أو حاول مرة أخرى بعد قليل.',
            ).resolve(context),
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.lg),
          FilledButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded),
            label: Text(
              const LocalizedText(
                en: 'Try again',
                ar: 'حاول مرة أخرى',
              ).resolve(context),
            ),
          ),
        ],
      ),
    );
  }
}
