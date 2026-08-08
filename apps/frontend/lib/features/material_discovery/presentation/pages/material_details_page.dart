import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../l10n/l10n.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../core/polling/lifecycle_polling_controller.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/material_condition_badge.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../../shared/widgets/materials/material_price_badge.dart';
import '../../../../shared/widgets/materials/material_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../../shared/widgets/supplier/supplier_identity_widgets.dart';
import '../../../comments/domain/comment_models.dart';
import '../../../comments/presentation/comments_section.dart';
import '../../../deliveries/presentation/delivery_status_presentation.dart';
import '../../../home/application/home_suggested_materials_provider.dart';
import '../../../profile/application/profile_providers.dart';
import '../../../learning_hub/application/project_build_refresh.dart';
import '../../../learner_material_requests/application/learner_material_requests_providers.dart';
import '../../../reservations/application/reservation_create_controller.dart';
import '../../../reservations/data/models/create_reservation_request.dart';
import '../../../reservations/data/models/learner_reservation.dart';
import '../../../reservations/presentation/learner_reservation_ui_helpers.dart';
import '../../application/material_related_projects_providers.dart';
import '../../application/material_discovery_providers.dart';
import '../../domain/discovery_material.dart';
import '../../domain/material_discovery_repository.dart';
import '../../domain/material_performance_models.dart';
import '../../domain/material_view_operation_key.dart';
import '../material_reserve_eligibility.dart';
import '../material_discovery_content.dart';
import '../widgets/material_related_projects_section.dart';
import '../widgets/material_details_gallery.dart';
import '../discovery_material_display.dart';
import '../widgets/discovery_location_privacy_panel.dart';
import '../widgets/material_details_report_section.dart';
import '../widgets/material_details_related_sections.dart';
import '../widgets/material_reservation_dialog.dart';

const _materialDetailsStickyCtaHeight = 76.0;
const _materialDetailsDesktopMaxWidth = 1160.0;
const _materialDetailsSectionGap = AppSpacing.lg;
const _materialDetailsRelatedSectionsTopGap = AppSpacing.xxl;

class MaterialDetailsPage extends ConsumerStatefulWidget {
  const MaterialDetailsPage({
    super.key,
    required this.materialId,
    this.repository,
    this.projectId,
    this.buildItemId,
    this.returnTo,
    this.componentName,
    this.recommendationImpressionId,
    this.materialRequestMatchId,
  });

  final String materialId;
  final MaterialDiscoveryRepository? repository;
  final String? projectId;
  final String? buildItemId;
  final String? returnTo;
  final String? componentName;
  final String? recommendationImpressionId;
  final String? materialRequestMatchId;

  @override
  ConsumerState<MaterialDetailsPage> createState() =>
      _MaterialDetailsPageState();
}

class _MaterialDetailsPageState extends ConsumerState<MaterialDetailsPage>
    with WidgetsBindingObserver {
  static const _reservationRefreshInterval = Duration(seconds: 30);
  static const _transitionalDeliveryStatuses = {
    'WAITING_FOR_DRIVER',
    'DRIVER_ASSIGNED',
    'ARRIVED_PICKUP',
    'PICKED_UP',
    'ON_THE_WAY',
    'ARRIVED_DROPOFF',
  };

  late final MaterialDiscoveryRepository _defaultRepository;
  late MaterialDiscoveryRepository _activeRepository;
  late Future<DiscoveryMaterial?> _materialFuture;
  DiscoveryMaterial? _materialOverride;
  bool _showReservationStatusCta = false;
  bool _isLikeUpdating = false;
  MaterialViewerState? _viewerState;
  bool _viewerStateLoading = false;
  CancelToken? _materialCancelToken;
  CancelToken? _viewerCancelToken;
  late String _viewOperationKey;
  bool _viewRecorded = false;
  late final LifecyclePollingController _reservationPollingController =
      LifecyclePollingController(
        interval: _reservationRefreshInterval,
        onRefresh: () => unawaited(_loadViewerStateIfAuthenticated()),
      );
  int _likeMutationGeneration = 0;
  bool _observingLifecycle = false;
  bool _isActive = true;

  @override
  void initState() {
    super.initState();
    _startObservingLifecycle();
    _defaultRepository = ref.read(materialDiscoveryRepositoryProvider);
    _activeRepository = widget.repository ?? _defaultRepository;
    _viewOperationKey = createMaterialViewOperationKey(widget.materialId);
    _materialFuture = _loadPublicMaterial();
    Future.microtask(_loadViewerStateIfAuthenticated);
  }

  void _startObservingLifecycle() {
    if (_observingLifecycle) return;
    WidgetsBinding.instance.addObserver(this);
    _observingLifecycle = true;
  }

  void _stopObservingLifecycle() {
    if (!_observingLifecycle) return;
    WidgetsBinding.instance.removeObserver(this);
    _observingLifecycle = false;
  }

  @override
  void activate() {
    super.activate();
    _isActive = true;
    _startObservingLifecycle();
    _reservationPollingController.setPaused(false);
    invalidateMaterialRelatedProjects(ref, widget.materialId);
  }

  @override
  void deactivate() {
    _isActive = false;
    _reservationPollingController.setPaused(true);
    _stopObservingLifecycle();
    super.deactivate();
  }

  Future<DiscoveryMaterial?> _loadPublicMaterial() {
    _materialCancelToken?.cancel('Material request replaced');
    final cancelToken = CancelToken();
    _materialCancelToken = cancelToken;
    final repository = _activeRepository;
    if (repository is MaterialDetailsPerformanceRepository) {
      final performanceRepository =
          repository as MaterialDetailsPerformanceRepository;
      return performanceRepository
          .getPublicMaterialById(widget.materialId, cancelToken: cancelToken)
          .then((material) {
            if (material != null) _recordViewOnce(performanceRepository);
            return material;
          });
    }
    return repository.getMaterialById(
      widget.materialId,
      recommendationImpressionId: widget.recommendationImpressionId,
    );
  }

  void _recordViewOnce(MaterialDetailsPerformanceRepository repository) {
    if (_viewRecorded) return;
    _viewRecorded = true;
    unawaited(
      repository
          .recordMaterialView(
            widget.materialId,
            operationKey: _viewOperationKey,
            recommendationImpressionId: widget.recommendationImpressionId,
          )
          .catchError((_) {}),
    );
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.resumed:
        _reservationPollingController.setPaused(!_isActive);
        if (mounted && _isActive) {
          unawaited(_loadViewerStateIfAuthenticated());
        }
      case AppLifecycleState.inactive:
      case AppLifecycleState.paused:
      case AppLifecycleState.hidden:
        _reservationPollingController.setPaused(true);
      case AppLifecycleState.detached:
        break;
    }
  }

  Future<void> _loadViewerStateIfAuthenticated() async {
    // `mounted` remains true while a state is deactivated. Avoid reading a
    // provider from a page that has already left the active element tree.
    if (!mounted || !_isActive) return;
    final authState = ref.read(authControllerProvider);
    final repository = _activeRepository;
    if (authState.status != AuthStatus.authenticated ||
        repository is! MaterialDetailsPerformanceRepository) {
      _viewerCancelToken?.cancel('Viewer is not authenticated');
      if (mounted) {
        setState(() {
          _viewerState = null;
          _viewerStateLoading = false;
        });
      }
      _reservationPollingController.syncEnabled(false);
      return;
    }

    _viewerCancelToken?.cancel('Viewer-state request replaced');
    final cancelToken = CancelToken();
    _viewerCancelToken = cancelToken;
    if (mounted) setState(() => _viewerStateLoading = true);
    try {
      final state = await (repository as MaterialDetailsPerformanceRepository)
          .getMaterialViewerState(widget.materialId, cancelToken: cancelToken);
      if (!mounted || !_isActive || cancelToken.isCancelled) return;
      setState(() {
        _viewerState = state;
        _viewerStateLoading = false;
      });
      _syncReservationPolling();
    } on DioException catch (error) {
      if (CancelToken.isCancel(error)) return;
      if (!cancelToken.isCancelled && mounted && _isActive) {
        setState(() => _viewerStateLoading = false);
      }
    } catch (_) {
      if (!cancelToken.isCancelled && mounted && _isActive) {
        setState(() => _viewerStateLoading = false);
      }
    }
  }

  void _syncReservationPolling() {
    final reservation = _viewerState?.reservation;
    final shouldPoll =
        _isActive &&
        reservation != null &&
        _shouldPollReservation(reservation);
    _reservationPollingController.syncEnabled(shouldPoll);
  }

  bool _shouldPollReservation(LearnerReservation reservation) {
    if (reservation.isPending ||
        reservation.isAwaitingConfirmation ||
        reservation.isAwaitingSupplierConfirmation) {
      return true;
    }

    final deliveryStatus = reservation.activeDelivery?.status.toUpperCase();
    return deliveryStatus != null &&
        _transitionalDeliveryStatuses.contains(deliveryStatus);
  }

  @override
  void dispose() {
    _isActive = false;
    _stopObservingLifecycle();
    _reservationPollingController.dispose();
    _materialCancelToken?.cancel('Material details disposed');
    _viewerCancelToken?.cancel('Material details disposed');
    super.dispose();
  }

  void _retryLoadMaterial() {
    setState(() {
      _materialOverride = null;
      _showReservationStatusCta = false;
      _materialFuture = _loadPublicMaterial();
    });
  }

  @override
  void didUpdateWidget(covariant MaterialDetailsPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    final nextRepository = widget.repository ?? _defaultRepository;
    if (oldWidget.materialId != widget.materialId ||
        oldWidget.repository != widget.repository ||
        oldWidget.recommendationImpressionId !=
            widget.recommendationImpressionId ||
        _activeRepository != nextRepository) {
      _activeRepository = nextRepository;
      _likeMutationGeneration += 1;
      _isLikeUpdating = false;
      _showReservationStatusCta = false;
      _materialOverride = null;
      _viewerState = null;
      _viewRecorded = false;
      _viewOperationKey = createMaterialViewOperationKey(widget.materialId);
      _materialFuture = _loadPublicMaterial();
      Future.microtask(_loadViewerStateIfAuthenticated);
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    ref.listen(authControllerProvider, (previous, next) {
      final previousUserId = previous?.user?.id;
      final nextUserId = next.user?.id;
      if (previous?.status != next.status || previousUserId != nextUserId) {
        if (previousUserId != nextUserId) {
          _likeMutationGeneration += 1;
          _materialOverride = null;
          _isLikeUpdating = false;
        }
        unawaited(_loadViewerStateIfAuthenticated());
      }
    });

    return FutureBuilder<DiscoveryMaterial?>(
      future: _materialFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return Scaffold(
            backgroundColor: palette.pageBackground,
            body: SafeArea(
              child: Center(
                child: CircularProgressIndicator(color: palette.mint),
              ),
            ),
          );
        }

        if (snapshot.hasError) {
          return _SimpleStateScaffold(
            child: _MaterialDetailsStatePanel(
              icon: Icons.cloud_off_outlined,
              title: const LocalizedText(
                en: 'Unable to load material details right now.',
                ar: 'تعذر تحميل تفاصيل المادة حالياً.',
              ),
              subtitle: const LocalizedText(
                en: 'Check your connection, then try loading this material again.',
                ar: 'تحقق من الاتصال، ثم حاول تحميل هذه المادة مرة أخرى.',
              ),
              primaryActionLabel: const LocalizedText(
                en: 'Try again',
                ar: 'حاول مرة أخرى',
              ),
              primaryActionIcon: Icons.refresh_rounded,
              onPrimaryAction: _retryLoadMaterial,
              secondaryActionLabel: const LocalizedText(
                en: 'Back to materials',
                ar: 'العودة إلى المواد',
              ),
              onSecondaryAction: () => context.go('/materials'),
            ),
          );
        }

        var material = _materialOverride ?? snapshot.data;
        if (material == null) {
          return _SimpleStateScaffold(
            child: _MaterialDetailsStatePanel(
              icon: Icons.inventory_2_outlined,
              title: const LocalizedText(
                en: 'Material not found',
                ar: 'المادة غير موجودة',
              ),
              subtitle: const LocalizedText(
                en: 'This material may have been removed, reused, or made unavailable.',
                ar: 'قد تكون هذه المادة حُذفت أو أُعيد استخدامها أو أصبحت غير متاحة.',
              ),
              primaryActionLabel: const LocalizedText(
                en: 'Back to materials',
                ar: 'العودة إلى المواد',
              ),
              primaryActionIcon: Icons.arrow_back_rounded,
              primaryActionTone: AppStatusTone.neutral,
              primaryActionProminent: false,
              onPrimaryAction: () => context.go('/materials'),
            ),
          );
        }

        final viewerState = _viewerState;
        if (viewerState != null) {
          material = material.copyWith(
            isLiked: _materialOverride?.isLiked ?? viewerState.isLiked,
            isOwnMaterial: viewerState.isOwnMaterial,
            canReserve: viewerState.canReserve,
            reserveBlockReason: viewerState.reserveBlockReason,
          );
        }

        final loadedMaterial = material;
        return _MaterialDetailsLoadedContent(
          material: loadedMaterial,
          learnerReservation: viewerState?.reservation,
          isLoadingReservation: _viewerStateLoading,
          buildItemId: widget.buildItemId,
          componentName: widget.componentName,
          showReservationStatusCta: _showReservationStatusCta,
          isLikeUpdating: _isLikeUpdating,
          onReserve: () => _handleReserve(loadedMaterial),
          onToggleLike: () => _handleToggleLike(loadedMaterial),
        );
      },
    );
  }

  Future<void> _handleToggleLike(DiscoveryMaterial material) async {
    final authState = ref.read(authControllerProvider);

    if (authState.status != AuthStatus.authenticated) {
      final from = Uri.encodeQueryComponent('/materials/${material.id}');
      context.go('/login?from=$from');
      return;
    }

    if (authState.user?.hasRole('LEARNER') != true) {
      showInfoSnackBar(context, 'Use a learner account to like materials.');
      return;
    }

    if (_isLikeUpdating) {
      return;
    }

    final shouldLike = !material.isLiked;
    final optimisticLikes = shouldLike
        ? material.likesCount + 1
        : (material.likesCount > 0 ? material.likesCount - 1 : 0);
    final optimisticMaterial = material.copyWith(
      likesCount: optimisticLikes,
      isLiked: shouldLike,
    );
    final mutationGeneration = ++_likeMutationGeneration;

    setState(() {
      _isLikeUpdating = true;
      _materialOverride = optimisticMaterial;
    });

    try {
      final engagement = shouldLike
          ? await _activeRepository.likeMaterial(
              material.id,
              recommendationImpressionId: widget.recommendationImpressionId,
            )
          : await _activeRepository.unlikeMaterial(
              material.id,
              recommendationImpressionId: widget.recommendationImpressionId,
            );

      if (!mounted || mutationGeneration != _likeMutationGeneration) {
        return;
      }

      ref.invalidate(homeSuggestedMaterialsProvider);
      final userId = ref.read(authControllerProvider).user?.id;
      if (userId != null && userId.trim().isNotEmpty) {
        ref.invalidate(learnerProfileSummaryProvider(userId));
      }
      setState(() {
        _materialOverride = optimisticMaterial.copyWith(
          likesCount: engagement.likesCount,
          isLiked: engagement.isLiked,
        );
      });
    } catch (error) {
      if (!mounted || mutationGeneration != _likeMutationGeneration) {
        return;
      }

      setState(() {
        _materialOverride = material;
      });
      showErrorSnackBar(context, error);
    } finally {
      if (mounted && mutationGeneration == _likeMutationGeneration) {
        setState(() {
          _isLikeUpdating = false;
        });
      }
    }
  }

  Future<void> _handleReserve(DiscoveryMaterial material) async {
    final authState = ref.read(authControllerProvider);

    if (authState.status != AuthStatus.authenticated) {
      final from = Uri.encodeQueryComponent('/materials/${material.id}');
      context.go('/login?from=$from');
      return;
    }

    if (authState.user?.hasRole('LEARNER') != true) {
      showInfoSnackBar(context, 'Use a learner account to reserve materials.');
      return;
    }

    FocusManager.instance.primaryFocus?.unfocus();

    await showDialog<void>(
      context: context,
      builder: (dialogContext) => MaterialReservationDialog(
        material: material,
        onSubmit: _submitReservationRequest,
      ),
    );
  }

  Future<void> _submitReservationRequest(
    CreateReservationRequest request,
  ) async {
    final buildItemId = widget.buildItemId?.trim();
    final materialRequestMatchId = widget.materialRequestMatchId?.trim();
    final hasBuildItemId = buildItemId != null && buildItemId.isNotEmpty;
    final hasMaterialRequestMatchId =
        materialRequestMatchId != null && materialRequestMatchId.isNotEmpty;
    final enrichedRequest = hasBuildItemId || hasMaterialRequestMatchId
        ? CreateReservationRequest(
            materialId: request.materialId,
            quantityRequested: request.quantityRequested,
            fulfillmentMethod: request.fulfillmentMethod,
            message: request.message,
            buildItemId: hasBuildItemId ? buildItemId : null,
            materialRequestMatchId: hasMaterialRequestMatchId
                ? materialRequestMatchId
                : null,
            learnerPreferredPickupWindows:
                request.learnerPreferredPickupWindows,
            learnerPreferredDeliveryWindows:
                request.learnerPreferredDeliveryWindows,
            deliveryAddressText: request.deliveryAddressText,
            safeDropoffAllowed: request.safeDropoffAllowed,
            deliveryNote: request.deliveryNote,
          )
        : request;

    await ref
        .read(reservationCreateControllerProvider.notifier)
        .create(
          enrichedRequest,
          recommendationImpressionId: widget.recommendationImpressionId,
        );

    if (!mounted) {
      return;
    }

    ref.invalidate(homeSuggestedMaterialsProvider);
    unawaited(_loadViewerStateIfAuthenticated());

    ref.refreshLinkedProjectBuild(widget.projectId);

    if (hasMaterialRequestMatchId) {
      invalidateLearnerMaterialRequests(ref);
    }

    final returnTo = widget.returnTo?.trim();
    if (returnTo != null && returnTo.isNotEmpty) {
      if (hasMaterialRequestMatchId) {
        showInfoSnackBar(
          context,
          'Reservation linked to your material request.',
        );
      } else if (hasBuildItemId) {
        showInfoSnackBar(context, 'Reservation linked to your build checklist.');
      }
      context.go(Uri.decodeComponent(returnTo));
      return;
    }

    setState(() {
      _showReservationStatusCta = true;
    });
    showInfoSnackBar(context, 'Reservation request sent to the supplier.');
  }
}

class _MaterialDetailsLoadedContent extends ConsumerWidget {
  const _MaterialDetailsLoadedContent({
    required this.material,
    required this.learnerReservation,
    required this.isLoadingReservation,
    this.buildItemId,
    this.componentName,
    required this.showReservationStatusCta,
    required this.isLikeUpdating,
    required this.onReserve,
    required this.onToggleLike,
  });

  final DiscoveryMaterial material;
  final LearnerReservation? learnerReservation;
  final bool isLoadingReservation;
  final String? buildItemId;
  final String? componentName;
  final bool showReservationStatusCta;
  final bool isLikeUpdating;
  final VoidCallback onReserve;
  final VoidCallback onToggleLike;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authControllerProvider);
    final reserveState = ref.watch(reservationCreateControllerProvider);
    final learnerDelivery = learnerReservation?.activeDelivery;
    final reservationUi = MaterialReserveEligibility.resolve(
      material: material,
      authState: authState,
      isSubmitting: reserveState.isLoading,
      isLoadingReservation: isLoadingReservation,
      showReservationStatusCta: showReservationStatusCta,
      learnerReservation: learnerReservation,
    );
    final screenWidth = MediaQuery.sizeOf(context).width;
    final isWide = screenWidth >= 980;
    final showMobileStickyCta =
        !isWide && learnerReservation == null && !showReservationStatusCta;

    final sideColumn = _DetailsSideColumn(
      material: material,
      reservationUi: reservationUi,
      learnerDelivery: learnerDelivery,
      onReserve: onReserve,
      showPrimaryReserveButton: true,
    );

    return Scaffold(
      backgroundColor: MaterialsUiPalette.of(context).pageBackground,
      bottomNavigationBar: showMobileStickyCta
          ? _MobileStickyReserveBar(
              reservationUi: reservationUi,
              onReserve: onReserve,
            )
          : null,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const EntryNavBar(
              showSignIn: true,
              showCreateAccount: true,
              homeRoute: '/',
            ),
            if (buildItemId != null && buildItemId!.trim().isNotEmpty)
              Padding(
                padding: const EdgeInsetsDirectional.fromSTEB(
                  AppSpacing.md,
                  AppSpacing.sm,
                  AppSpacing.md,
                  0,
                ),
                child: MaterialBuildChecklistContextBanner(
                  componentName: componentName,
                ),
              ),
            Expanded(
              child: SingleChildScrollView(
                padding: EdgeInsetsDirectional.fromSTEB(
                  isWide ? AppSpacing.lg : AppSpacing.md,
                  isWide ? AppSpacing.xl : AppSpacing.md,
                  isWide ? AppSpacing.lg : AppSpacing.md,
                  AppSpacing.xl +
                      (showMobileStickyCta
                          ? _materialDetailsStickyCtaHeight
                          : 0),
                ),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(
                      maxWidth: _materialDetailsDesktopMaxWidth,
                    ),
                    child: isWide
                        ? Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              _DetailsPageHeader(material: material),
                              const SizedBox(
                                height: _materialDetailsSectionGap,
                              ),
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    flex: 3,
                                    child: _DetailsMainColumn(
                                      material: material,
                                      includeHeader: false,
                                      compactDetailsLayout: true,
                                      isLikeUpdating: isLikeUpdating,
                                      onToggleLike: onToggleLike,
                                    ),
                                  ),
                                  const SizedBox(
                                    width: _materialDetailsSectionGap,
                                  ),
                                  Expanded(flex: 2, child: sideColumn),
                                ],
                              ),
                              const SizedBox(
                                height: _materialDetailsRelatedSectionsTopGap,
                              ),
                              _LazyViewportSection(
                                builder: (_) => MaterialDetailsRelatedSections(
                                  material: material,
                                  layout: RelatedMaterialsLayout.desktop,
                                ),
                              ),
                              const SizedBox(
                                height: _materialDetailsSectionGap,
                              ),
                              _LazyViewportSection(
                                builder: (_) => CommentsSection(
                                  targetType: CommentTargetType.material,
                                  targetId: material.id,
                                ),
                              ),
                            ],
                          )
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              _DetailsPageHeader(material: material),
                              _MaterialDetailsGallery(
                                material: material,
                                compact: true,
                              ),
                              const SizedBox(height: AppSpacing.md),
                              _MaterialSummaryPanel(
                                material: material,
                                isLikeUpdating: isLikeUpdating,
                                onToggleLike: onToggleLike,
                              ),
                              const SizedBox(height: AppSpacing.md),
                              _ReservationPanel(
                                material: material,
                                reservationUi: reservationUi,
                                learnerDelivery: learnerDelivery,
                                onReserve: onReserve,
                                showPrimaryReserveButton: false,
                              ),
                              const SizedBox(height: AppSpacing.md),
                              _MaterialDetailsPanel(material: material),
                              _MaterialDetailExtraSections(material: material),
                              const SizedBox(height: AppSpacing.md),
                              MaterialRelatedProjectsSection(
                                materialId: material.id,
                              ),
                              const SizedBox(height: AppSpacing.md),
                              _SupplierCard(material: material),
                              const SizedBox(height: AppSpacing.md),
                              _LazyViewportSection(
                                builder: (_) => CommentsSection(
                                  targetType: CommentTargetType.material,
                                  targetId: material.id,
                                ),
                              ),
                              const SizedBox(height: AppSpacing.md),
                              const DiscoveryLocationPrivacyPanel(),
                              const SizedBox(height: AppSpacing.md),
                              _LazyViewportSection(
                                builder: (_) => MaterialDetailsRelatedSections(
                                  material: material,
                                  layout: RelatedMaterialsLayout.mobile,
                                ),
                              ),
                              const SizedBox(height: AppSpacing.md),
                              MaterialDetailsReportSection(materialId: material.id),
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

class _SimpleStateScaffold extends StatelessWidget {
  const _SimpleStateScaffold({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

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
              child: Center(
                child: Padding(
                  padding: const EdgeInsetsDirectional.all(AppSpacing.xl),
                  child: child,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MaterialDetailsStatePanel extends StatelessWidget {
  const _MaterialDetailsStatePanel({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.primaryActionLabel,
    required this.primaryActionIcon,
    required this.onPrimaryAction,
    this.secondaryActionLabel,
    this.onSecondaryAction,
    this.primaryActionTone = AppStatusTone.primary,
    this.primaryActionProminent = true,
  });

  final IconData icon;
  final LocalizedText title;
  final LocalizedText subtitle;
  final LocalizedText primaryActionLabel;
  final IconData primaryActionIcon;
  final VoidCallback onPrimaryAction;
  final LocalizedText? secondaryActionLabel;
  final VoidCallback? onSecondaryAction;
  final AppStatusTone primaryActionTone;
  final bool primaryActionProminent;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 540),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: palette.mint.withValues(alpha: 0.14),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: palette.mint, size: 34),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            title.resolve(context),
            style: AppTextStyles.title(
              context,
            ).copyWith(color: palette.textPrimary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            subtitle.resolve(context),
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.lg),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              if (primaryActionProminent)
                FilledButton.icon(
                  onPressed: onPrimaryAction,
                  style: AppStatusButtonStyle.filled(
                    context,
                    primaryActionTone,
                  ),
                  icon: Icon(primaryActionIcon),
                  label: Text(primaryActionLabel.resolve(context)),
                )
              else
                OutlinedButton.icon(
                  onPressed: onPrimaryAction,
                  style: AppStatusButtonStyle.outlined(
                    context,
                    primaryActionTone,
                  ),
                  icon: Icon(primaryActionIcon),
                  label: Text(primaryActionLabel.resolve(context)),
                ),
              if (secondaryActionLabel != null && onSecondaryAction != null)
                OutlinedButton(
                  onPressed: onSecondaryAction,
                  style: AppStatusButtonStyle.outlined(
                    context,
                    AppStatusTone.neutral,
                  ),
                  child: Text(secondaryActionLabel!.resolve(context)),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DetailsPageHeader extends StatelessWidget {
  const _DetailsPageHeader({required this.material});

  final DiscoveryMaterial material;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Row(
      children: [
        IconButton.outlined(
          onPressed: () => context.popOrGo('/materials'),
          style: IconButton.styleFrom(
            foregroundColor: palette.textPrimary,
            side: BorderSide(color: palette.borderStrong),
          ),
          icon: const Icon(Icons.arrow_back_rounded),
        ),
        const Spacer(),
        Container(
          padding: const EdgeInsetsDirectional.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.xs,
          ),
          decoration: BoxDecoration(
            color: palette.cardSurfaceAlt,
            borderRadius: AppRadius.pillAll,
            border: Border.all(color: palette.borderSubtle),
          ),
          child: Text(
            material.category.resolve(context),
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
        ),
      ],
    );
  }
}

class _MaterialDetailsGallery extends StatelessWidget {
  const _MaterialDetailsGallery({required this.material, this.compact = false});

  final DiscoveryMaterial material;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return MaterialDetailsGallery(
      images: material.resolvedGalleryImages,
      imageAltText: material.title,
      fallbackIcon: material.heroIconData,
      gradientColors: materialGradient(material),
      compact: compact,
    );
  }
}

class _MaterialSummaryPanel extends StatelessWidget {
  const _MaterialSummaryPanel({
    required this.material,
    required this.isLikeUpdating,
    required this.onToggleLike,
  });

  final DiscoveryMaterial material;
  final bool isLikeUpdating;
  final VoidCallback onToggleLike;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final description = DiscoveryMaterialDisplay.displayDescription(
      material.description,
    );
    final showDescription = DiscoveryMaterialDisplay.hasDisplayDescription(
      material.description,
    );

    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  material.title.resolve(context),
                  style: AppTextStyles.title(
                    context,
                  ).copyWith(color: palette.textPrimary),
                  textAlign: TextAlign.start,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              _MaterialLikeButton(
                isLiked: material.isLiked,
                isLoading: isLikeUpdating,
                onPressed: onToggleLike,
              ),
            ],
          ),
          if (showDescription) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              description.resolve(context),
              style: AppTextStyles.body(
                context,
              ).copyWith(color: palette.textSecondary),
              textAlign: TextAlign.start,
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              MaterialConditionBadge(
                label: material.conditionLabel.resolve(context),
                tone: material.conditionTone,
              ),
              MaterialStatusBadge(
                label: material.statusLabel.resolve(context),
                tone: material.statusTone,
              ),
              MaterialPriceBadge(
                label: material.priceLabel.resolve(context),
                isFree: material.isFree,
              ),
            ],
          ),
          if (material.viewsCount > 0 || material.likesCount > 0) ...[
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.xs,
              children: [
                _EngagementChip(
                  icon: Icons.visibility_outlined,
                  label: LocalizedText(
                    en: '${material.viewsCount} views',
                    ar: '${material.viewsCount} مشاهدة',
                  ).resolve(context),
                ),
                _EngagementChip(
                  icon: material.isLiked
                      ? Icons.favorite_rounded
                      : Icons.favorite_border_rounded,
                  label: LocalizedText(
                    en: '${material.likesCount} likes',
                    ar: '${material.likesCount} إعجاب',
                  ).resolve(context),
                  highlighted: material.isLiked,
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _MaterialLikeButton extends StatelessWidget {
  const _MaterialLikeButton({
    required this.isLiked,
    required this.isLoading,
    required this.onPressed,
  });

  final bool isLiked;
  final bool isLoading;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final foreground = isLiked ? Colors.white : palette.mint;
    final background = isLiked
        ? palette.mint
        : palette.mint.withValues(alpha: 0.10);

    return Tooltip(
      message: isLiked ? 'Unlike material' : 'Like material',
      child: SizedBox(
        width: 42,
        height: 42,
        child: IconButton(
          onPressed: isLoading ? null : onPressed,
          style: IconButton.styleFrom(
            backgroundColor: background,
            foregroundColor: foreground,
            disabledBackgroundColor: background.withValues(alpha: 0.6),
            disabledForegroundColor: foreground.withValues(alpha: 0.6),
            side: BorderSide(color: palette.borderSubtle),
          ),
          icon: isLoading
              ? SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: foreground,
                  ),
                )
              : Icon(
                  isLiked
                      ? Icons.favorite_rounded
                      : Icons.favorite_border_rounded,
                ),
        ),
      ),
    );
  }
}

class _EngagementChip extends StatelessWidget {
  const _EngagementChip({
    required this.icon,
    required this.label,
    this.highlighted = false,
  });

  final IconData icon;
  final String label;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final foreground = highlighted ? palette.mint : palette.textMuted;

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: foreground),
          const SizedBox(width: AppSpacing.xs),
          Text(
            label,
            style: AppTextStyles.label(
              context,
            ).copyWith(color: foreground, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class _MaterialDetailsPanel extends StatelessWidget {
  const _MaterialDetailsPanel({
    required this.material,
    this.compactDesktopLayout = false,
  });

  final DiscoveryMaterial material;
  final bool compactDesktopLayout;

  List<Widget> _infoRows(BuildContext context) {
    return [
      _InfoRow(
        icon: Icons.category_outlined,
        label: const LocalizedText(
          en: 'Category',
          ar: 'الفئة',
        ).resolve(context),
        value: material.category.resolve(context),
      ),
      if (material.sourceTypeLabel != null)
        _InfoRow(
          icon: Icons.inventory_outlined,
          label: const LocalizedText(
            en: 'Source',
            ar: 'المصدر',
          ).resolve(context),
          value: material.sourceTypeLabel!.resolve(context),
        ),
      _InfoRow(
        icon: Icons.straighten_rounded,
        label: const LocalizedText(
          en: 'Quantity',
          ar: 'الكمية',
        ).resolve(context),
        value: material.quantityLabel.resolve(context),
      ),
      _InfoRow(
        icon: Icons.location_on_outlined,
        label: const LocalizedText(
          en: 'Location',
          ar: 'الموقع',
        ).resolve(context),
        value: material.locationLabel.resolve(context),
      ),
      _InfoRow(
        icon: material.deliveryAvailable
            ? Icons.local_shipping_outlined
            : Icons.storefront_outlined,
        label: const LocalizedText(
          en: 'Delivery',
          ar: 'التوصيل',
        ).resolve(context),
        value: material.availabilityLabel.resolve(context),
      ),
      if (material.postedAt != null)
        _InfoRow(
          icon: Icons.calendar_today_outlined,
          label: const LocalizedText(
            en: 'Posted',
            ar: 'تاريخ النشر',
          ).resolve(context),
          value: _formatPostedDate(material.postedAt!),
        ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final rows = _infoRows(context);

    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionTitle(
            title: const LocalizedText(
              en: 'Material Details',
              ar: 'تفاصيل المادة',
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          if (compactDesktopLayout)
            LayoutBuilder(
              builder: (context, constraints) {
                final itemWidth = (constraints.maxWidth - AppSpacing.md) / 2;

                return Wrap(
                  spacing: AppSpacing.md,
                  runSpacing: AppSpacing.md,
                  children: rows
                      .map((row) => SizedBox(width: itemWidth, child: row))
                      .toList(growable: false),
                );
              },
            )
          else
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var i = 0; i < rows.length; i++) ...[
                  if (i > 0) const SizedBox(height: AppSpacing.md),
                  rows[i],
                ],
              ],
            ),
        ],
      ),
    );
  }
}

class _MaterialDetailExtraSections extends StatelessWidget {
  const _MaterialDetailExtraSections({
    required this.material,
    this.topSpacing = AppSpacing.md,
  });

  final DiscoveryMaterial material;
  final double topSpacing;

  @override
  Widget build(BuildContext context) {
    final sections = <Widget>[];

    final suggestedUses = material.suggestedUses?.trim();
    if (suggestedUses != null && suggestedUses.isNotEmpty) {
      sections.add(
        _DetailTextSection(
          title: const LocalizedText(
            en: 'Suggested uses',
            ar: 'استخدامات مقترحة',
          ),
          body: suggestedUses,
          icon: Icons.lightbulb_outline_rounded,
        ),
      );
    }

    if (sections.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(height: topSpacing),
        for (var i = 0; i < sections.length; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.md),
          sections[i],
        ],
      ],
    );
  }
}

class _DetailTextSection extends StatelessWidget {
  const _DetailTextSection({
    required this.title,
    required this.body,
    required this.icon,
  });

  final LocalizedText title;
  final String body;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: palette.textMuted),
              const SizedBox(width: AppSpacing.sm),
              Text(
                title.resolve(context),
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.textSecondary),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            body,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textPrimary),
          ),
        ],
      ),
    );
  }
}

class _SupplierCard extends ConsumerStatefulWidget {
  const _SupplierCard({required this.material});

  final DiscoveryMaterial material;

  @override
  ConsumerState<_SupplierCard> createState() => _SupplierCardState();
}

class _SupplierCardState extends ConsumerState<_SupplierCard> {
  late bool _isFollowedByViewer;
  late int _followersCount;
  bool _isUpdatingFollow = false;

  DiscoveryMaterial get material => widget.material;

  @override
  void initState() {
    super.initState();
    _syncFromMaterial();
  }

  @override
  void didUpdateWidget(covariant _SupplierCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.material.id != material.id ||
        oldWidget.material.supplier?.isFollowedByViewer !=
            material.supplier?.isFollowedByViewer ||
        oldWidget.material.supplier?.followersCount !=
            material.supplier?.followersCount) {
      _syncFromMaterial();
    }
  }

  void _syncFromMaterial() {
    _isFollowedByViewer = material.supplier?.isFollowedByViewer ?? false;
    _followersCount = material.supplier?.followersCount ?? 0;
  }

  String? get _supplierProfileId => material.supplier?.id.trim();

  Future<void> _toggleFollow() async {
    final supplierProfileId = _supplierProfileId;
    if (supplierProfileId == null ||
        supplierProfileId.isEmpty ||
        _isUpdatingFollow) {
      return;
    }

    final authState = ref.read(authControllerProvider);
    if (authState.status != AuthStatus.authenticated) {
      final from = Uri.encodeQueryComponent('/materials/${material.id}');
      context.go('/login?from=$from');
      return;
    }

    if (authState.user?.hasRole('LEARNER') != true) {
      showInfoSnackBar(context, 'Use a learner account to follow suppliers.');
      return;
    }

    final previousFollowing = _isFollowedByViewer;
    final previousCount = _followersCount;
    final shouldFollow = !_isFollowedByViewer;

    setState(() {
      _isUpdatingFollow = true;
      _isFollowedByViewer = shouldFollow;
      _followersCount = shouldFollow
          ? _followersCount + 1
          : (_followersCount > 0 ? _followersCount - 1 : 0);
    });

    try {
      final repository = ref.read(materialDiscoveryRepositoryProvider);
      final status = shouldFollow
          ? await repository.followSupplier(supplierProfileId)
          : await repository.unfollowSupplier(supplierProfileId);

      if (!mounted) {
        return;
      }

      setState(() {
        _followersCount = status.followersCount;
        _isFollowedByViewer = status.isFollowedByViewer;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _isFollowedByViewer = previousFollowing;
        _followersCount = previousCount;
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

  void _openSupplierProfile() {
    final supplierProfileId = _supplierProfileId;
    if (supplierProfileId == null || supplierProfileId.isEmpty) {
      return;
    }

    context.go('/suppliers/$supplierProfileId');
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final supplier = material.supplier;
    final displayName =
        supplier?.displayName ?? material.supplierName.resolve(context);
    final location = [
      supplier?.city,
      supplier?.area,
    ].whereType<String>().where((value) => value.trim().isNotEmpty).join(', ');
    final canNavigate = _supplierProfileId != null;

    return _Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              GestureDetector(
                onTap: canNavigate ? _openSupplierProfile : null,
                child: SupplierIdentityAvatar(
                  displayName: displayName,
                  avatarUrl: supplier?.avatarUrl,
                  radius: 28,
                  borderColor: palette.cardSurface,
                  borderWidth: 2,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: GestureDetector(
                  onTap: canNavigate ? _openSupplierProfile : null,
                  behavior: HitTestBehavior.opaque,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        const LocalizedText(
                          en: 'Supplier',
                          ar: 'المورد',
                        ).resolve(context),
                        style: AppTextStyles.label(
                          context,
                        ).copyWith(color: palette.textMuted),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              displayName,
                              style: AppTextStyles.title(
                                context,
                              ).copyWith(color: palette.textPrimary),
                            ),
                          ),
                          if (material.supplierVerified)
                            Icon(
                              Icons.verified_rounded,
                              color: palette.mint,
                              size: 18,
                            ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        material.supplierSubtitle.resolve(context),
                        style: AppTextStyles.body(
                          context,
                        ).copyWith(color: palette.textSecondary),
                      ),
                      if (location.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          location,
                          style: AppTextStyles.body(
                            context,
                          ).copyWith(color: palette.textSecondary),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
          if (canNavigate) ...[
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                Expanded(
                  child: FilledButton(
                    onPressed: _isUpdatingFollow ? null : _toggleFollow,
                    child: Text(
                      _isFollowedByViewer
                          ? const LocalizedText(
                              en: 'Following',
                              ar: 'متابَع',
                            ).resolve(context)
                          : const LocalizedText(
                              en: 'Follow',
                              ar: 'متابعة',
                            ).resolve(context),
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                OutlinedButton(
                  onPressed: _openSupplierProfile,
                  child: Text(
                    const LocalizedText(
                      en: 'View profile',
                      ar: 'عرض الملف',
                    ).resolve(context),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              LocalizedText(
                en: '$_followersCount followers',
                ar: '$_followersCount متابع',
              ).resolve(context),
              style: AppTextStyles.label(
                context,
              ).copyWith(color: palette.textMuted),
            ),
          ],
        ],
      ),
    );
  }
}

class _ReservationPanel extends StatelessWidget {
  const _ReservationPanel({
    required this.material,
    required this.reservationUi,
    required this.learnerDelivery,
    required this.onReserve,
    required this.showPrimaryReserveButton,
    this.emphasized = false,
  });

  final DiscoveryMaterial material;
  final MaterialReserveEligibility reservationUi;
  final LearnerReservationActiveDelivery? learnerDelivery;
  final VoidCallback onReserve;
  final bool showPrimaryReserveButton;
  final bool emphasized;

  static const _quantityStepHint = LocalizedText(
    en: "You'll choose quantity in the next step.",
    ar: 'ستختار الكمية في الخطوة التالية.',
  );

  bool get _showQuantityStepHint => reservationUi.canTapReserve;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final themeColors = AppThemeColors.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: emphasized ? themeColors.primarySoft : palette.panelSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(
          color: emphasized
              ? themeColors.primary.withValues(alpha: 0.28)
              : palette.borderStrong,
          width: emphasized ? 1.2 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow.withValues(
              alpha: emphasized ? 0.16 : 0.12,
            ),
            blurRadius: emphasized ? 20 : 16,
            offset: Offset(0, emphasized ? 8 : 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _SectionTitle(
            title: const LocalizedText(en: 'Reservation', ar: 'الحجز'),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            reservationUi.helperText.resolve(context),
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
          if (_showQuantityStepHint) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              _quantityStepHint.resolve(context),
              style: AppTextStyles.label(
                context,
              ).copyWith(color: palette.textMuted),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          if (reservationUi.learnerReservation != null)
            _LearnerReservationStateCard(
              reservation: reservationUi.learnerReservation!,
              delivery: learnerDelivery,
              deliveryAvailable: material.deliveryAvailable,
            )
          else if (reservationUi.showReservationStatusCta)
            const _PostReservationStatusCta()
          else if (showPrimaryReserveButton)
            _ReserveMaterialButton(
              reservationUi: reservationUi,
              onReserve: onReserve,
            ),
        ],
      ),
    );
  }
}

class _ReserveMaterialButton extends StatelessWidget {
  const _ReserveMaterialButton({
    required this.reservationUi,
    required this.onReserve,
  });

  final MaterialReserveEligibility reservationUi;
  final VoidCallback onReserve;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final palette = MaterialsUiPalette.of(context);
    final disabledReason = reservationUi.disabledReason;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FilledButton.icon(
          onPressed: reservationUi.canTapReserve ? onReserve : null,
          style: _materialDetailsReserveButtonStyle(context),
          icon: reservationUi.isSubmitting
              ? SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: colors.textOnPrimary,
                  ),
                )
              : const Icon(Icons.shopping_bag_outlined),
          label: Text(reservationUi.buttonLabel.resolve(context)),
        ),
        if (!reservationUi.canTapReserve && disabledReason != null) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            disabledReason.resolve(context),
            style: AppTextStyles.label(
              context,
            ).copyWith(color: palette.textMuted),
          ),
        ],
      ],
    );
  }
}

ButtonStyle _materialDetailsReserveButtonStyle(BuildContext context) {
  final colors = AppThemeColors.of(context);
  final palette = MaterialsUiPalette.of(context);

  return FilledButton.styleFrom(
    minimumSize: const Size.fromHeight(52),
    shape: RoundedRectangleBorder(borderRadius: AppRadius.lgAll),
    elevation: 0,
  ).merge(
    ButtonStyle(
      backgroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.disabled)) {
          return palette.mutedSurface;
        }
        if (states.contains(WidgetState.pressed) ||
            states.contains(WidgetState.hovered)) {
          return colors.primaryHover;
        }
        return colors.primary;
      }),
      foregroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.disabled)) {
          return palette.textMuted;
        }
        return colors.textOnPrimary;
      }),
    ),
  );
}


class _MobileStickyReserveBar extends StatelessWidget {
  const _MobileStickyReserveBar({
    required this.reservationUi,
    required this.onReserve,
  });

  final MaterialReserveEligibility reservationUi;
  final VoidCallback onReserve;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Material(
      elevation: 8,
      color: palette.panelSurface,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(
            AppSpacing.md,
            AppSpacing.sm,
            AppSpacing.md,
            AppSpacing.sm,
          ),
          child: _ReserveMaterialButton(
            reservationUi: reservationUi,
            onReserve: onReserve,
          ),
        ),
      ),
    );
  }
}

String _formatPostedDate(DateTime value) {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  return '${months[value.month - 1]} ${value.day}, ${value.year}';
}

class _DetailsMainColumn extends StatelessWidget {
  const _DetailsMainColumn({
    required this.material,
    required this.isLikeUpdating,
    required this.onToggleLike,
    this.includeHeader = true,
    this.compactDetailsLayout = false,
  });

  final DiscoveryMaterial material;
  final bool isLikeUpdating;
  final VoidCallback onToggleLike;
  final bool includeHeader;
  final bool compactDetailsLayout;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (includeHeader) ...[
          _DetailsPageHeader(material: material),
          const SizedBox(height: _materialDetailsSectionGap),
        ],
        _MaterialDetailsGallery(material: material),
        const SizedBox(height: _materialDetailsSectionGap),
        _MaterialSummaryPanel(
          material: material,
          isLikeUpdating: isLikeUpdating,
          onToggleLike: onToggleLike,
        ),
        const SizedBox(height: _materialDetailsSectionGap),
        _MaterialDetailsPanel(
          material: material,
          compactDesktopLayout: compactDetailsLayout,
        ),
        _MaterialDetailExtraSections(
          material: material,
          topSpacing: _materialDetailsSectionGap,
        ),
        const SizedBox(height: _materialDetailsSectionGap),
        const DiscoveryLocationPrivacyPanel(),
      ],
    );
  }
}

class _DetailsSideColumn extends StatelessWidget {
  const _DetailsSideColumn({
    required this.material,
    required this.reservationUi,
    required this.learnerDelivery,
    required this.onReserve,
    required this.showPrimaryReserveButton,
  });

  final DiscoveryMaterial material;
  final MaterialReserveEligibility reservationUi;
  final LearnerReservationActiveDelivery? learnerDelivery;
  final VoidCallback onReserve;
  final bool showPrimaryReserveButton;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _SupplierCard(material: material),
        const SizedBox(height: _materialDetailsSectionGap),
        _ReservationPanel(
          material: material,
          reservationUi: reservationUi,
          learnerDelivery: learnerDelivery,
          onReserve: onReserve,
          showPrimaryReserveButton: showPrimaryReserveButton,
          emphasized: showPrimaryReserveButton,
        ),
        const SizedBox(height: _materialDetailsSectionGap),
        MaterialRelatedProjectsSection(materialId: material.id),
        const SizedBox(height: _materialDetailsSectionGap),
        MaterialDetailsReportSection(materialId: material.id),
      ],
    );
  }
}

class _PostReservationStatusCta extends StatelessWidget {
  const _PostReservationStatusCta();

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardSurfaceAlt,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Reservation request sent.',
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textPrimary),
          ),
          const SizedBox(height: AppSpacing.sm),
          TextButton.icon(
            onPressed: () => context.go('/learner/reservations'),
            style: AppStatusButtonStyle.text(context, AppStatusTone.neutral),
            icon: const Icon(Icons.assignment_turned_in_outlined),
            label: const Text('View all reservations'),
          ),
        ],
      ),
    );
  }
}

class _LearnerReservationStateCard extends StatelessWidget {
  const _LearnerReservationStateCard({
    required this.reservation,
    required this.delivery,
    required this.deliveryAvailable,
  });

  final LearnerReservation reservation;
  final LearnerReservationActiveDelivery? delivery;
  final bool deliveryAvailable;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final palette = MaterialsUiPalette.of(context);
    final detail = _reservationDetailText(reservation, l10n: l10n);
    final activeDelivery =
        delivery != null && _isActiveDelivery(delivery!.status)
        ? delivery
        : null;
    final summary = reservation.paymentSummary;
    final paymentRequired = summary != null &&
        !summary.isPaymentsDisabled &&
        summary.isPaymentActionRequired;

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardSurfaceAlt,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppStatusBadge(
            label: _reservationStatusLabel(reservation.status),
            tone: learnerReservationStatusTone(
              reservation.status,
              incidentReviewStatus: reservation.incidentReviewStatus,
            ),
          ),
          if (delivery != null) ...[
            const SizedBox(height: AppSpacing.sm),
            AppStatusBadge(
              label: deliveryStatusLabel(delivery!.status, l10n: context.l10n),
              tone: deliveryStatusAppTone(delivery!.status),
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          Text(
            _materialDetailReservationText(
              reservation: reservation,
              delivery: delivery,
              deliveryAvailable: deliveryAvailable,
              paymentRequired: paymentRequired,
              fallback: detail,
              l10n: l10n,
            ),
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
          const SizedBox(height: AppSpacing.sm),
          if (activeDelivery != null)
            TextButton.icon(
              onPressed: () =>
                  context.push('/learner/deliveries/${activeDelivery.id}'),
              style: AppStatusButtonStyle.text(context, AppStatusTone.neutral),
              icon: const Icon(Icons.local_shipping_outlined),
              label: Text(l10n.materialDetailViewDeliveryStatus),
            )
          else if (paymentRequired)
            TextButton.icon(
              onPressed: () =>
                  context.push('/learner/reservations/${reservation.id}'),
              style: AppStatusButtonStyle.text(context, AppStatusTone.neutral),
              icon: const Icon(Icons.account_balance_wallet_outlined),
              label: Text(l10n.materialDetailViewReservation),
            )
          else
            TextButton.icon(
              onPressed: () =>
                  context.push('/learner/reservations/${reservation.id}'),
              style: AppStatusButtonStyle.text(context, AppStatusTone.neutral),
              icon: const Icon(Icons.assignment_turned_in_outlined),
              label: Text(
                _reservationActionLabel(
                  reservation,
                  deliveryAvailable: deliveryAvailable,
                  l10n: l10n,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

String _materialDetailReservationText({
  required LearnerReservation reservation,
  required LearnerReservationActiveDelivery? delivery,
  required bool deliveryAvailable,
  required bool paymentRequired,
  required String fallback,
  required AppLocalizations l10n,
}) {
  if (paymentRequired) {
    return l10n.materialDetailPaymentRequired;
  }

  if (delivery != null && _isActiveDelivery(delivery.status)) {
    return l10n.materialDetailDeliveryStatusLine(
      deliveryStatusLabel(delivery.status, l10n: l10n),
    );
  }

  if (reservation.isAccepted) {
    if (reservation.isDeliveryFulfillment) {
      return l10n.materialDetailAcceptedDeliveryReady;
    }

    if (reservation.canLearnerRequestDelivery && deliveryAvailable) {
      if (delivery != null) {
        return l10n.materialDetailPreviousDeliveryRequestAgain(
          deliveryStatusLabel(delivery.status, l10n: l10n),
        );
      }
      return l10n.materialDetailAcceptedRequestDelivery;
    }

    return fallback;
  }

  return fallback;
}

bool _isActiveDelivery(String status) => !const {
  'DELIVERED',
  'CANCELLED',
  'FAILED_PICKUP',
  'FAILED_DELIVERY',
  'DRIVER_NO_SHOW',
  'LEARNER_NO_SHOW',
}.contains(status);

String _reservationActionLabel(
  LearnerReservation reservation, {
  required bool deliveryAvailable,
  required AppLocalizations l10n,
}) {
  if (reservation.isAccepted) {
    if (reservation.isDeliveryFulfillment) {
      return l10n.materialDetailViewDeliveryDetails;
    }
    if (reservation.canLearnerRequestDelivery && deliveryAvailable) {
      return l10n.materialDetailRequestDeliveryInReservations;
    }
    return l10n.materialDetailViewPickupDetails;
  }

  switch (reservation.status) {
    case 'PENDING':
      return l10n.materialDetailViewReservationRequest;
    case 'REJECTED':
    case 'COMPLETED':
      return l10n.materialDetailViewReservationHistory;
    default:
      return l10n.materialDetailViewReservationStatus;
  }
}

String _reservationStatusLabel(String status) => reservationStatusLabel(status);

String _reservationDetailText(
  LearnerReservation reservation, {
  required AppLocalizations l10n,
}) {
  if (reservation.isPending) {
    return l10n.materialDetailReservationPending;
  }

  if (reservation.isAccepted) {
    final pickup = _pickupWindowText(reservation);
    final note = reservation.supplierNote?.trim();
    if (reservation.isDeliveryFulfillment) {
      return note != null && note.isNotEmpty
          ? note
          : l10n.materialDetailAcceptedDeliveryReady;
    }
    if (pickup != null && note != null && note.isNotEmpty) {
      return '$pickup $note';
    }

    return pickup ?? l10n.materialDetailAcceptedPickupReady;
  }

  if (reservation.isRejected) {
    final reason = reservation.rejectionReason?.trim();
    return reason != null && reason.isNotEmpty
        ? reason
        : 'The supplier rejected this reservation.';
  }

  if (reservation.isCompleted) {
    return 'This reservation is completed.';
  }

  if (reservation.isCancelled) {
    return 'This reservation was cancelled.';
  }

  if (reservation.isExpired) {
    return 'This reservation expired.';
  }

  return 'Reservation status updated.';
}

String? _pickupWindowText(LearnerReservation reservation) {
  if (reservation.pickupWindowStart == null) {
    return null;
  }

  final start = _formatDateTime(reservation.pickupWindowStart!);
  final end = reservation.pickupWindowEnd == null
      ? null
      : _formatDateTime(reservation.pickupWindowEnd!);

  return end == null
      ? 'Pickup starts $start.'
      : 'Pickup window: $start - $end.';
}

String _formatDateTime(DateTime value) {
  return '${value.year}-${_two(value.month)}-${_two(value.day)} '
      '${_two(value.hour)}:${_two(value.minute)}';
}

String _two(int value) => value.toString().padLeft(2, '0');

class _Panel extends StatelessWidget {
  const _Panel({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderStrong),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow.withValues(alpha: 0.12),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title});

  final LocalizedText title;

  @override
  Widget build(BuildContext context) {
    return Text(
      title.resolve(context),
      style: AppTextStyles.title(
        context,
      ).copyWith(color: MaterialsUiPalette.of(context).textPrimary),
      textAlign: TextAlign.start,
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: palette.cardSurfaceAlt,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: palette.borderSubtle),
          ),
          child: Icon(icon, color: palette.mint, size: 20),
        ),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: AppTextStyles.label(
                  context,
                ).copyWith(color: palette.textSecondary),
                textAlign: TextAlign.start,
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                value,
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: palette.textPrimary),
                textAlign: TextAlign.start,
              ),
            ],
          ),
        ),
      ],
    );
  }
}


class _LazyViewportSection extends StatefulWidget {
  const _LazyViewportSection({required this.builder});

  final WidgetBuilder builder;

  @override
  State<_LazyViewportSection> createState() => _LazyViewportSectionState();
}

class _LazyViewportSectionState extends State<_LazyViewportSection> {
  ScrollPosition? _position;
  bool _visible = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _bindAndCheck());
  }

  void _bindAndCheck() {
    if (!mounted || _visible) return;
    final next = Scrollable.maybeOf(context)?.position;
    if (!identical(next, _position)) {
      _position?.removeListener(_check);
      _position = next;
      _position?.addListener(_check);
    }
    _check();
  }

  void _check() {
    if (!mounted || _visible) return;
    final box = context.findRenderObject();
    if (box is! RenderBox || !box.hasSize) return;
    final top = box.localToGlobal(Offset.zero).dy;
    if (top <= MediaQuery.sizeOf(context).height + 400) {
      _position?.removeListener(_check);
      setState(() => _visible = true);
    }
  }

  @override
  void dispose() {
    _position?.removeListener(_check);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_visible) return widget.builder(context);
    WidgetsBinding.instance.addPostFrameCallback((_) => _bindAndCheck());
    return const SizedBox(height: 1);
  }
}



