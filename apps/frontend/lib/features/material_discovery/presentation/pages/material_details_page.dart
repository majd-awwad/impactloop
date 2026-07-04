import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/network/api_client.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/materials/app_material_card.dart';
import '../../../../shared/widgets/materials/material_condition_badge.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../materials/data/material_reports_api.dart';
import '../../../../shared/widgets/materials/material_price_badge.dart';
import '../../../../shared/widgets/materials/material_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../deliveries/application/learner_deliveries_provider.dart';
import '../../../deliveries/data/models/learner_delivery.dart';
import '../../../deliveries/presentation/delivery_status_presentation.dart';
import '../../../home/application/home_suggested_materials_provider.dart';
import '../../../reservations/application/my_reservations_provider.dart';
import '../../../reservations/application/reservation_create_controller.dart';
import '../../../reservations/data/models/create_reservation_request.dart';
import '../../../reservations/data/models/learner_reservation.dart';
import '../../../reservations/data/models/reservation_preferred_window.dart';
import '../../../reservations/presentation/learner_reservation_ui_helpers.dart';
import '../../../reservations/presentation/reservation_create_error_message.dart';
import '../../data/api_material_discovery_repository.dart';
import '../../domain/discovery_material.dart';
import '../../domain/material_discovery_query.dart';
import '../../domain/material_discovery_repository.dart';
import '../material_discovery_content.dart';
import '../widgets/material_details_gallery.dart';
import '../discovery_material_display.dart';
import '../reservation_dialog_copy.dart';
import '../widgets/discovery_location_privacy_panel.dart';
import '../widgets/preferred_window_input.dart';

const _materialDetailsStickyCtaHeight = 76.0;
const _materialDetailsDesktopMaxWidth = 1160.0;
const _materialDetailsSectionGap = AppSpacing.lg;
const _materialDetailsRelatedSectionsTopGap = AppSpacing.xxl;
const _relatedCompactCardWidth = 340.0;
const _reservationDialogMaxWidth = 460.0;
const _reservationDialogMaxHeightFactor = 0.85;
const _reservationMessageMaxLength = 1000;
const _reservationDialogChromeHeight = 156.0;
const _reservationDialogSectionGap = AppSpacing.md;

class MaterialDetailsPage extends ConsumerStatefulWidget {
  const MaterialDetailsPage({
    super.key,
    required this.materialId,
    this.repository,
  });

  final String materialId;
  final MaterialDiscoveryRepository? repository;

  @override
  ConsumerState<MaterialDetailsPage> createState() =>
      _MaterialDetailsPageState();
}

class _MaterialDetailsPageState extends ConsumerState<MaterialDetailsPage> {
  late final MaterialDiscoveryRepository _defaultRepository;
  late MaterialDiscoveryRepository _activeRepository;
  late Future<DiscoveryMaterial?> _materialFuture;
  bool _showReservationStatusCta = false;

  @override
  void initState() {
    super.initState();
    _defaultRepository = ApiMaterialDiscoveryRepository(
      ref.read(apiClientProvider),
    );
    _activeRepository = widget.repository ?? _defaultRepository;
    _materialFuture = _activeRepository.getMaterialById(widget.materialId);
  }

  @override
  void didUpdateWidget(covariant MaterialDetailsPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    final nextRepository = widget.repository ?? _defaultRepository;
    if (oldWidget.materialId != widget.materialId ||
        oldWidget.repository != widget.repository ||
        _activeRepository != nextRepository) {
      _activeRepository = nextRepository;
      _showReservationStatusCta = false;
      _materialFuture = _activeRepository.getMaterialById(widget.materialId);
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

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
            child: Text(
              const LocalizedText(
                en: 'Unable to load material details right now.',
                ar: 'تعذر تحميل تفاصيل المادة حالياً.',
              ).resolve(context),
              style: AppTextStyles.title(
                context,
              ).copyWith(color: palette.textPrimary),
              textAlign: TextAlign.center,
            ),
          );
        }

        final material = snapshot.data;
        if (material == null) {
          return _SimpleStateScaffold(
            child: Text(
              const LocalizedText(
                en: 'Material not found',
                ar: 'المادة غير موجودة',
              ).resolve(context),
              style: AppTextStyles.title(
                context,
              ).copyWith(color: palette.textPrimary),
              textAlign: TextAlign.center,
            ),
          );
        }

        return _MaterialDetailsLoadedContent(
          material: material,
          showReservationStatusCta: _showReservationStatusCta,
          onReserve: () => _handleReserve(material),
        );
      },
    );
  }

  Future<void> _handleReserve(DiscoveryMaterial material) async {
    final authState = ref.read(authControllerProvider);

    if (authState.status != AuthStatus.authenticated) {
      final from = Uri.encodeQueryComponent('/materials/${material.id}');
      context.go('/login?from=$from');
      return;
    }

    if (authState.user?.hasRole('LEARNER') != true) {
      showInfoSnackBar(
        context,
        'Use a learner account to reserve materials.',
      );
      return;
    }

    FocusManager.instance.primaryFocus?.unfocus();

    await showDialog<void>(
      context: context,
      builder: (dialogContext) => _ReserveMaterialDialog(
        material: material,
        onSubmit: _submitReservationRequest,
      ),
    );
  }

  Future<void> _submitReservationRequest(
    CreateReservationRequest request,
  ) async {
    await ref.read(reservationCreateControllerProvider.notifier).create(
          request,
        );

    if (!mounted) {
      return;
    }

    ref.invalidate(myReservationsProvider);
    ref.invalidate(homeSuggestedMaterialsProvider);
    setState(() {
      _showReservationStatusCta = true;
      _materialFuture = _activeRepository.getMaterialById(widget.materialId);
    });
    showInfoSnackBar(context, 'Reservation request sent to the supplier.');
  }
}

class _MaterialDetailsLoadedContent extends ConsumerWidget {
  const _MaterialDetailsLoadedContent({
    required this.material,
    required this.showReservationStatusCta,
    required this.onReserve,
  });

  final DiscoveryMaterial material;
  final bool showReservationStatusCta;
  final VoidCallback onReserve;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authControllerProvider);
    final reserveState = ref.watch(reservationCreateControllerProvider);
    final myReservationsState =
        authState.status == AuthStatus.authenticated &&
            authState.user?.hasRole('LEARNER') == true
        ? ref.watch(myReservationsProvider)
        : null;
    final learnerReservation = myReservationsState?.maybeWhen(
      data: (reservations) => _reservationForMaterial(reservations, material),
      orElse: () => null,
    );
    final myDeliveriesState = learnerReservation != null
        ? ref.watch(learnerDeliveriesProvider)
        : null;
    final learnerDelivery = myDeliveriesState?.maybeWhen(
      data: (deliveries) =>
          _deliveryForReservation(deliveries, learnerReservation!.id),
      orElse: () => null,
    );
    final reservationUi = _ReservationUiState.from(
      material: material,
      authState: authState,
      isSubmitting: reserveState.isLoading,
      isLoadingReservation: myReservationsState?.isLoading == true,
      showReservationStatusCta: showReservationStatusCta,
      learnerReservation: learnerReservation,
    );
    final screenWidth = MediaQuery.sizeOf(context).width;
    final isWide = screenWidth >= 980;
    final showMobileStickyCta =
        !isWide &&
        !reservationUi.isLoadingReservation &&
        learnerReservation == null &&
        !showReservationStatusCta;

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
            Expanded(
              child: SingleChildScrollView(
                padding: EdgeInsetsDirectional.fromSTEB(
                  isWide ? AppSpacing.lg : AppSpacing.md,
                  isWide ? AppSpacing.xl : AppSpacing.md,
                  isWide ? AppSpacing.lg : AppSpacing.md,
                  AppSpacing.xl +
                      (showMobileStickyCta ? _materialDetailsStickyCtaHeight : 0),
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
                              const SizedBox(height: _materialDetailsSectionGap),
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    flex: 3,
                                    child: _DetailsMainColumn(
                                      material: material,
                                      includeHeader: false,
                                      compactDetailsLayout: true,
                                    ),
                                  ),
                                  const SizedBox(width: _materialDetailsSectionGap),
                                  Expanded(
                                    flex: 2,
                                    child: sideColumn,
                                  ),
                                ],
                              ),
                              const SizedBox(height: _materialDetailsRelatedSectionsTopGap),
                              _RelatedMaterialsSections(
                                material: material,
                                layout: _RelatedMaterialsLayout.desktop,
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
                              _MaterialSummaryPanel(material: material),
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
                              _SupplierCard(material: material),
                              const SizedBox(height: AppSpacing.md),
                              const DiscoveryLocationPrivacyPanel(),
                              const SizedBox(height: AppSpacing.md),
                              _RelatedMaterialsSections(
                                material: material,
                                layout: _RelatedMaterialsLayout.mobile,
                              ),
                              const SizedBox(height: AppSpacing.md),
                              _ReportMaterialSection(materialId: material.id),
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

class _ReservationUiState {
  const _ReservationUiState({
    required this.isAvailable,
    required this.isAuthenticatedLearner,
    required this.isAuthenticatedNonLearner,
    required this.canTapReserve,
    required this.isSubmitting,
    required this.isLoadingReservation,
    required this.showReservationStatusCta,
    required this.learnerReservation,
    required this.helperText,
    required this.buttonLabel,
  });

  final bool isAvailable;
  final bool isAuthenticatedLearner;
  final bool isAuthenticatedNonLearner;
  final bool canTapReserve;
  final bool isSubmitting;
  final bool isLoadingReservation;
  final bool showReservationStatusCta;
  final LearnerReservation? learnerReservation;
  final LocalizedText helperText;
  final LocalizedText buttonLabel;

  factory _ReservationUiState.from({
    required DiscoveryMaterial material,
    required AuthState authState,
    required bool isSubmitting,
    required bool isLoadingReservation,
    required bool showReservationStatusCta,
    required LearnerReservation? learnerReservation,
  }) {
    final isAvailable =
        material.availableQuantity > 0 &&
        material.status != 'REUSED' &&
        material.status != 'UNAVAILABLE';
    final isAuthenticatedLearner =
        authState.status == AuthStatus.authenticated &&
        authState.user?.hasRole('LEARNER') == true;
    final isAuthenticatedNonLearner =
        authState.status == AuthStatus.authenticated &&
        authState.user?.hasRole('LEARNER') != true;
    final isOwnMaterial = material.isOwnMaterial == true;
    final backendBlocksReserve =
        authState.status == AuthStatus.authenticated &&
        material.canReserve == false;
    final canTapReserve =
        isAvailable &&
        learnerReservation == null &&
        !isAuthenticatedNonLearner &&
        !isSubmitting &&
        !isOwnMaterial &&
        !backendBlocksReserve;

    final helperText = !isAvailable
        ? const LocalizedText(
            en: 'This material is no longer available.',
            ar: 'هذه المادة لم تعد متاحة.',
          )
        : isOwnMaterial
        ? const LocalizedText(
            en: 'This is your listing. You cannot reserve your own material.',
            ar: 'هذه مادتك. لا يمكنك حجز مادتك الخاصة.',
          )
        : material.reserveBlockReason == 'OPEN_RESERVATION_EXISTS'
        ? const LocalizedText(
            en: 'You already have an open reservation for this material.',
            ar: 'لديك بالفعل حجزاً مفتوحاً لهذه المادة.',
          )
        : isAuthenticatedNonLearner
        ? const LocalizedText(
            en: 'Use a learner account to reserve materials.',
            ar: 'استخدم حساب متعلم لحجز المواد.',
          )
        : authState.status == AuthStatus.unauthenticated
        ? const LocalizedText(
            en: 'Sign in as a learner to request this material.',
            ar: 'سجل الدخول كمتعلم لطلب هذه المادة.',
          )
        : const LocalizedText(
            en: 'Request this material from the supplier.',
            ar: 'اطلب هذه المادة من المورد.',
          );

    final buttonLabel = isSubmitting
        ? const LocalizedText(en: 'Requesting...', ar: 'جارٍ الطلب...')
        : isOwnMaterial
        ? const LocalizedText(en: 'Your listing', ar: 'مادتك')
        : !isAvailable
        ? const LocalizedText(
            en: 'Not available',
            ar: 'غير متاح',
          )
        : isAuthenticatedLearner || authState.status == AuthStatus.unauthenticated
        ? const LocalizedText(en: 'Reserve Material', ar: 'احجز المادة')
        : const LocalizedText(en: 'Sign in to Reserve', ar: 'سجل الدخول للحجز');

    return _ReservationUiState(
      isAvailable: isAvailable,
      isAuthenticatedLearner: isAuthenticatedLearner,
      isAuthenticatedNonLearner: isAuthenticatedNonLearner,
      canTapReserve: canTapReserve,
      isSubmitting: isSubmitting,
      isLoadingReservation: isLoadingReservation,
      showReservationStatusCta: showReservationStatusCta,
      learnerReservation: learnerReservation,
      helperText: helperText,
      buttonLabel: buttonLabel,
    );
  }
}

LearnerDelivery? _deliveryForReservation(
  List<LearnerDelivery> deliveries,
  String reservationId,
) {
  LearnerDelivery? latest;

  for (final delivery in deliveries) {
    if (delivery.reservationId != reservationId) {
      continue;
    }

    if (latest == null || delivery.requestedAt.isAfter(latest.requestedAt)) {
      latest = delivery;
    }
  }

  return latest;
}

LearnerReservation? _reservationForMaterial(
  List<LearnerReservation> reservations,
  DiscoveryMaterial material,
) {
  for (final reservation in reservations) {
    if (reservation.material.id != material.id) {
      continue;
    }

    if (!reservation.isPending && !reservation.isAccepted) {
      continue;
    }

    return reservation;
  }

  return null;
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
            Expanded(child: Center(child: child)),
          ],
        ),
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
          onPressed: () => context.go('/materials'),
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
  const _MaterialDetailsGallery({
    required this.material,
    this.compact = false,
  });

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
  const _MaterialSummaryPanel({required this.material});

  final DiscoveryMaterial material;

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
          Text(
            material.title.resolve(context),
            style: AppTextStyles.title(
              context,
            ).copyWith(color: palette.textPrimary),
            textAlign: TextAlign.start,
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
          if (material.viewsCount > 0) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              LocalizedText(
                en: '${material.viewsCount} views',
                ar: '${material.viewsCount} مشاهدة',
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
                      .map(
                        (row) => SizedBox(
                          width: itemWidth,
                          child: row,
                        ),
                      )
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

    final pickupNotes = material.pickupNotes?.trim();
    if (pickupNotes != null && pickupNotes.isNotEmpty) {
      sections.add(
        _DetailTextSection(
          title: const LocalizedText(
            en: 'Pickup notes',
            ar: 'ملاحظات الاستلام',
          ),
          body: pickupNotes,
          icon: Icons.notes_outlined,
        ),
      );
    }

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
                style: AppTextStyles.label(context).copyWith(
                  color: palette.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            body,
            style: AppTextStyles.body(context).copyWith(
              color: palette.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _SupplierCard extends StatelessWidget {
  const _SupplierCard({required this.material});

  final DiscoveryMaterial material;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return _Panel(
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: palette.mint.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: palette.borderSubtle),
            ),
            child: Icon(Icons.storefront_outlined, color: palette.mint, size: 22),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  const LocalizedText(en: 'Supplier', ar: 'المورد').resolve(
                    context,
                  ),
                  style: AppTextStyles.label(
                    context,
                  ).copyWith(color: palette.textMuted),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  material.supplierName.resolve(context),
                  style: AppTextStyles.title(
                    context,
                  ).copyWith(color: palette.textPrimary),
                ),
                const SizedBox(height: 2),
                Text(
                  material.supplierSubtitle.resolve(context),
                  style: AppTextStyles.body(
                    context,
                  ).copyWith(color: palette.textSecondary),
                ),
                if (material.supplierVerified) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Container(
                    padding: const EdgeInsetsDirectional.symmetric(
                      horizontal: AppSpacing.sm,
                      vertical: AppSpacing.xs,
                    ),
                    decoration: BoxDecoration(
                      color: palette.mint.withValues(alpha: 0.1),
                      borderRadius: AppRadius.pillAll,
                      border: Border.all(color: palette.borderSubtle),
                    ),
                    child: Text(
                      const LocalizedText(
                        en: 'Verified supplier',
                        ar: 'مورد موثّق',
                      ).resolve(context),
                      style: AppTextStyles.label(context).copyWith(
                        color: palette.textSecondary,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
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
  final _ReservationUiState reservationUi;
  final LearnerDelivery? learnerDelivery;
  final VoidCallback onReserve;
  final bool showPrimaryReserveButton;
  final bool emphasized;

  static const _quantityStepHint = LocalizedText(
    en: "You'll choose quantity in the next step.",
    ar: 'ستختار الكمية في الخطوة التالية.',
  );

  bool get _showQuantityStepHint =>
      reservationUi.isAvailable &&
      !reservationUi.isAuthenticatedNonLearner &&
      reservationUi.learnerReservation == null &&
      !reservationUi.showReservationStatusCta;

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
          color: emphasized ? themeColors.primary.withValues(alpha: 0.28) : palette.borderStrong,
          width: emphasized ? 1.2 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow.withValues(alpha: emphasized ? 0.16 : 0.12),
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
          if (reservationUi.isLoadingReservation &&
              reservationUi.isAuthenticatedLearner)
            const _ReservationLoadingState()
          else if (reservationUi.learnerReservation != null)
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

  final _ReservationUiState reservationUi;
  final VoidCallback onReserve;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return FilledButton.icon(
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

ButtonStyle _reservationDialogSubmitButtonStyle(BuildContext context) {
  final colors = AppThemeColors.of(context);
  final palette = MaterialsUiPalette.of(context);

  return ButtonStyle(
    minimumSize: const WidgetStatePropertyAll(Size(0, 44)),
    padding: const WidgetStatePropertyAll(
      EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
    ),
    shape: WidgetStatePropertyAll(
      RoundedRectangleBorder(borderRadius: AppRadius.lgAll),
    ),
    elevation: const WidgetStatePropertyAll(0),
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
  );
}

class _MobileStickyReserveBar extends StatelessWidget {
  const _MobileStickyReserveBar({
    required this.reservationUi,
    required this.onReserve,
  });

  final _ReservationUiState reservationUi;
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
    this.includeHeader = true,
    this.compactDetailsLayout = false,
  });

  final DiscoveryMaterial material;
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
        _MaterialSummaryPanel(material: material),
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
  final _ReservationUiState reservationUi;
  final LearnerDelivery? learnerDelivery;
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
        _ReportMaterialSection(materialId: material.id),
      ],
    );
  }
}

class _ReservationLoadingState extends StatelessWidget {
  const _ReservationLoadingState();

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Row(
      children: [
        SizedBox(
          width: 18,
          height: 18,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            color: palette.mint,
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Text(
          'Checking your reservations...',
          style: AppTextStyles.body(
            context,
          ).copyWith(color: palette.textSecondary),
        ),
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
            icon: const Icon(Icons.assignment_turned_in_outlined),
            label: const Text('View reservation status'),
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
  final LearnerDelivery? delivery;
  final bool deliveryAvailable;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final detail = _reservationDetailText(reservation);
    final activeDelivery = delivery?.isActive == true ? delivery : null;

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
          MaterialStatusBadge(
            label: _reservationStatusLabel(reservation.status),
            tone: _reservationStatusTone(reservation.status),
          ),
          if (delivery != null) ...[
            const SizedBox(height: AppSpacing.sm),
            MaterialStatusBadge(
              label: deliveryStatusLabel(delivery!.status),
              tone: deliveryStatusTone(delivery!.status),
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          Text(
            _materialDetailReservationText(
              reservation: reservation,
              delivery: delivery,
              deliveryAvailable: deliveryAvailable,
              fallback: detail,
            ),
            style: AppTextStyles.body(
              context,
            ).copyWith(color: palette.textSecondary),
          ),
          const SizedBox(height: AppSpacing.sm),
          if (activeDelivery != null)
            TextButton.icon(
              onPressed: () =>
                  context.go('/learner/deliveries/${activeDelivery.id}'),
              icon: const Icon(Icons.local_shipping_outlined),
              label: const Text('View delivery status'),
            )
          else
            TextButton.icon(
              onPressed: () => context.go('/learner/reservations'),
              icon: const Icon(Icons.assignment_turned_in_outlined),
              label: Text(
                reservation.isAccepted && deliveryAvailable
                    ? 'Request delivery in My Reservations'
                    : _reservationActionLabel(reservation.status),
              ),
            ),
        ],
      ),
    );
  }
}

String _materialDetailReservationText({
  required LearnerReservation reservation,
  required LearnerDelivery? delivery,
  required bool deliveryAvailable,
  required String fallback,
}) {
  if (delivery != null && delivery.isActive) {
    return 'Delivery status: ${deliveryStatusLabel(delivery.status)}.';
  }

  if (reservation.isAccepted && deliveryAvailable) {
    if (delivery != null) {
      return 'Previous delivery status: ${deliveryStatusLabel(delivery.status)}. Request delivery from My Reservations.';
    }

    return 'Reservation accepted. Internal delivery is available from My Reservations.';
  }

  return fallback;
}

String _reservationActionLabel(String status) {
  switch (status) {
    case 'PENDING':
      return 'View reservation request';
    case 'ACCEPTED':
      return 'View pickup details';
    case 'REJECTED':
    case 'COMPLETED':
      return 'View reservation history';
    default:
      return 'View reservation status';
  }
}

String _reservationStatusLabel(String status) => reservationStatusLabel(status);

MaterialStatusBadgeTone _reservationStatusTone(String status) {
  switch (status) {
    case 'PENDING':
    case 'ACCEPTED':
      return MaterialStatusBadgeTone.reserved;
    case 'COMPLETED':
      return MaterialStatusBadgeTone.reused;
    case 'REJECTED':
    case 'CANCELLED':
    case 'EXPIRED':
    default:
      return MaterialStatusBadgeTone.draft;
  }
}

String _reservationDetailText(LearnerReservation reservation) {
  if (reservation.isPending) {
    return 'Reservation request sent. Waiting for supplier response.';
  }

  if (reservation.isAccepted) {
    final pickup = _pickupWindowText(reservation);
    final note = reservation.supplierNote?.trim();
    if (pickup != null && note != null && note.isNotEmpty) {
      return '$pickup $note';
    }

    return pickup ?? 'Reservation accepted. Pickup details are ready.';
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

  return end == null ? 'Pickup starts $start.' : 'Pickup window: $start - $end.';
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

class _ReportMaterialSection extends ConsumerWidget {
  const _ReportMaterialSection({required this.materialId});

  final String materialId;

  static const _reasons = <String, String>{
    'MISLEADING_INFORMATION': 'Misleading information',
    'WRONG_CATEGORY': 'Wrong category',
    'WRONG_PRICE': 'Wrong price',
    'INAPPROPRIATE': 'Inappropriate material',
    'ITEM_NOT_AVAILABLE': 'Item not available',
    'SUSPICIOUS_SUPPLIER': 'Suspicious supplier',
    'OTHER': 'Other',
  };

  Future<void> _openReportDialog(BuildContext context, WidgetRef ref) async {
    final auth = ref.read(authControllerProvider);
    if (!auth.isAuthenticated) {
      showInfoSnackBar(
        context,
        const LocalizedText(
          en: 'Please sign in to report this material.',
          ar: 'يرجى تسجيل الدخول للإبلاغ عن هذه المادة.',
        ).resolve(context),
      );
      return;
    }

    var selectedReason = _reasons.keys.first;
    final noteController = TextEditingController();
    final submitted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              title: Text(
                const LocalizedText(
                  en: 'Report material',
                  ar: 'الإبلاغ عن المادة',
                ).resolve(context),
              ),
              content: SizedBox(
                width: 420,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    DropdownButtonFormField<String>(
                      initialValue: selectedReason,
                      decoration: const InputDecoration(labelText: 'Reason'),
                      items: _reasons.entries
                          .map(
                            (entry) => DropdownMenuItem(
                              value: entry.key,
                              child: Text(entry.value),
                            ),
                          )
                          .toList(),
                      onChanged: (value) {
                        if (value == null) return;
                        setState(() => selectedReason = value);
                      },
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: noteController,
                      maxLines: 4,
                      decoration: InputDecoration(
                        labelText: selectedReason == 'OTHER'
                            ? 'Describe the issue (required)'
                            : 'Additional note (optional)',
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext, false),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: () {
                    if (selectedReason == 'OTHER' &&
                        noteController.text.trim().isEmpty) {
                      return;
                    }
                    Navigator.pop(dialogContext, true);
                  },
                  child: const Text('Submit report'),
                ),
              ],
            );
          },
        );
      },
    );

    if (submitted != true) {
      noteController.dispose();
      return;
    }

    try {
      final message = await ref.read(materialReportsApiProvider).submitReport(
            materialId: materialId,
            reason: selectedReason,
            note: noteController.text.trim(),
          );
      noteController.dispose();
      if (!context.mounted) return;
      showInfoSnackBar(context, message);
    } on ApiException catch (error) {
      noteController.dispose();
      if (!context.mounted) return;
      showErrorSnackBar(context, error.displayMessage);
    } catch (_) {
      noteController.dispose();
      if (!context.mounted) return;
      showErrorSnackBar(
        context,
        const LocalizedText(
          en: 'Could not submit report right now.',
          ar: 'تعذر إرسال البلاغ حالياً.',
        ).resolve(context),
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = MaterialsUiPalette.of(context);
    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: TextButton.icon(
        onPressed: () => _openReportDialog(context, ref),
        icon: Icon(Icons.flag_outlined, color: palette.textSecondary, size: 18),
        label: Text(
          const LocalizedText(
            en: 'Report material',
            ar: 'الإبلاغ عن المادة',
          ).resolve(context),
          style: AppTextStyles.label(context).copyWith(
            color: palette.textSecondary,
          ),
        ),
      ),
    );
  }
}

enum _RelatedMaterialsLayout { desktop, mobile }

class _RelatedMaterialsSections extends ConsumerWidget {
  const _RelatedMaterialsSections({
    required this.material,
    required this.layout,
  });

  final DiscoveryMaterial material;
  final _RelatedMaterialsLayout layout;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categoryId = material.categoryId?.trim();
    final city = material.city?.trim();
    final strips = <Widget>[];

    if (categoryId != null && categoryId.isNotEmpty) {
      strips.add(
        _RelatedMaterialsStrip(
          excludeMaterialId: material.id,
          layout: layout,
          query: MaterialDiscoveryQuery(
            categoryId: categoryId,
            status: 'AVAILABLE',
            limit: 5,
          ),
          title: LocalizedText(
            en: 'More in ${material.category.en}',
            ar: 'المزيد في ${material.category.ar}',
          ),
        ),
      );
    }

    if (city != null && city.isNotEmpty) {
      final area = material.area?.trim();
      final locationLabel = area != null && area.isNotEmpty
          ? '$city, $area'
          : city;

      strips.add(
        _RelatedMaterialsStrip(
          excludeMaterialId: material.id,
          layout: layout,
          query: MaterialDiscoveryQuery(
            city: city,
            area: area?.isNotEmpty == true ? area : null,
            status: 'AVAILABLE',
            limit: 5,
          ),
          title: LocalizedText(
            en: 'More in $locationLabel',
            ar: 'المزيد في $locationLabel',
          ),
        ),
      );
    }

    if (strips.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < strips.length; i++) ...[
          if (i > 0) const SizedBox(height: _materialDetailsSectionGap),
          strips[i],
        ],
      ],
    );
  }
}

class _RelatedMaterialsStrip extends ConsumerStatefulWidget {
  const _RelatedMaterialsStrip({
    required this.excludeMaterialId,
    required this.layout,
    required this.query,
    required this.title,
  });

  final String excludeMaterialId;
  final _RelatedMaterialsLayout layout;
  final MaterialDiscoveryQuery query;
  final LocalizedText title;

  @override
  ConsumerState<_RelatedMaterialsStrip> createState() =>
      _RelatedMaterialsStripState();
}

class _RelatedMaterialsStripState extends ConsumerState<_RelatedMaterialsStrip> {
  List<DiscoveryMaterial> _materials = const [];
  var _loaded = false;

  @override
  void initState() {
    super.initState();
    _loadMaterials();
  }

  @override
  void didUpdateWidget(covariant _RelatedMaterialsStrip oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.excludeMaterialId != widget.excludeMaterialId ||
        oldWidget.query != widget.query) {
      _loaded = false;
      _materials = const [];
      _loadMaterials();
    }
  }

  Future<void> _loadMaterials() async {
    try {
      final repository = ApiMaterialDiscoveryRepository(
        ref.read(apiClientProvider),
      );
      final result = await repository.fetchMaterials(widget.query);
      final materials = result.items
          .where((item) => item.id != widget.excludeMaterialId)
          .take(4)
          .toList(growable: false);

      if (!mounted) {
        return;
      }

      setState(() {
        _materials = materials;
        _loaded = true;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _materials = const [];
        _loaded = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_loaded || _materials.isEmpty) {
      return const SizedBox.shrink();
    }

    final palette = MaterialsUiPalette.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          widget.title.resolve(context),
          style: AppTextStyles.title(
            context,
          ).copyWith(color: palette.textPrimary),
        ),
        const SizedBox(height: AppSpacing.md),
        if (widget.layout == _RelatedMaterialsLayout.desktop)
          Wrap(
            spacing: AppSpacing.lg,
            runSpacing: AppSpacing.lg,
            children: _materials
                .map(
                  (related) => SizedBox(
                    width: _relatedCompactCardWidth,
                    height: ImpactMaterialCompactCard.height,
                    child: _RelatedMaterialCompactCard(material: related),
                  ),
                )
                .toList(growable: false),
          )
        else
          SizedBox(
            height: ImpactMaterialCompactCard.height,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _materials.length,
              separatorBuilder: (context, index) =>
                  const SizedBox(width: AppSpacing.md),
              itemBuilder: (context, index) {
                final related = _materials[index];

                return SizedBox(
                  width: 320,
                  child: _RelatedMaterialCompactCard(material: related),
                );
              },
            ),
          ),
      ],
    );
  }
}

class _RelatedMaterialCompactCard extends StatelessWidget {
  const _RelatedMaterialCompactCard({required this.material});

  final DiscoveryMaterial material;

  @override
  Widget build(BuildContext context) {
    return ImpactMaterialCompactCard(
      title: material.title.resolve(context),
      description: material.description.resolve(context),
      category: material.category.resolve(context),
      conditionLabel: material.conditionLabel.resolve(context),
      conditionTone: material.conditionTone,
      statusLabel: material.statusLabel.resolve(context),
      statusTone: material.statusTone,
      quantityLabel: material.quantityLabel.resolve(context),
      priceLabel: material.priceLabel.resolve(context),
      locationLabel: material.locationLabel.resolve(context),
      availabilityLabel: material.availabilityLabel.resolve(context),
      deliveryAvailable: material.deliveryAvailable,
      isFree: material.isFree,
      gradientColors: materialGradient(material),
      imageUrl: material.imageUrl,
      ratingLabel: material.isPopular
          ? null
          : material.ratingLabel?.resolve(context),
      showPopularBadge: material.isPopular,
      fallbackIcon: material.heroIconData,
      onTap: () => context.go('/materials/${material.id}'),
    );
  }
}

class _ReserveMaterialDialog extends StatefulWidget {
  const _ReserveMaterialDialog({
    required this.material,
    required this.onSubmit,
  });

  final DiscoveryMaterial material;
  final Future<void> Function(CreateReservationRequest request) onSubmit;

  @override
  State<_ReserveMaterialDialog> createState() => _ReserveMaterialDialogState();
}

class _ReserveMaterialDialogState extends State<_ReserveMaterialDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _quantityController;
  final _messageController = TextEditingController();
  final _deliveryAddressController = TextEditingController();
  final _deliveryNoteController = TextEditingController();
  var _fulfillmentMethod = 'PICKUP';
  final _pickupWindows = <PreferredWindowDraft>[PreferredWindowDraft()];
  final _deliveryWindows = <PreferredWindowDraft>[PreferredWindowDraft()];
  bool? _safeDropoffAllowed;
  var _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    final defaultQuantity = _defaultQuantity(
      widget.material.availableQuantity,
      widget.material.unit,
    );
    _quantityController = TextEditingController(
      text: _formatQuantity(defaultQuantity),
    );
  }

  @override
  void dispose() {
    _quantityController.dispose();
    _messageController.dispose();
    _deliveryAddressController.dispose();
    _deliveryNoteController.dispose();
    super.dispose();
  }

  bool get _isPickup => _fulfillmentMethod == 'PICKUP';

  bool get _canChooseDelivery => widget.material.deliveryAvailable;

  List<ReservationPreferredWindow>? _validatedPreferredWindows(
    List<PreferredWindowDraft> drafts,
  ) {
    final now = DateTime.now();
    final windows = <ReservationPreferredWindow>[];

    for (final draft in drafts) {
      final error = draft.validationError(now: now);
      if (error != null) {
        setState(() => _errorMessage = error);
        return null;
      }

      windows.add(
        ReservationPreferredWindow(
          start: draft.start!,
          end: draft.end!,
        ),
      );
    }

    return windows;
  }

  bool get _usesCountSteps => _isCountLikeUnit(widget.material.unit);

  double get _availableQuantity => widget.material.availableQuantity;

  double _defaultQuantity(double available, String unit) {
    if (available <= 0) {
      return 0;
    }

    if (_isCountLikeUnit(unit)) {
      return available >= 1 ? 1 : available;
    }

    return available;
  }

  static bool _isCountLikeUnit(String unit) {
    const countLike = {
      'piece',
      'pieces',
      'item',
      'items',
      'unit',
      'units',
      'sheet',
      'sheets',
      'panel',
      'panels',
      'crate',
      'crates',
    };

    return countLike.contains(unit.toLowerCase());
  }

  static String _formatAvailableQuantityLabel(DiscoveryMaterial material) {
    return formatReservationAvailableQuantityLabel(
      availableQuantity: material.availableQuantity,
      unit: material.unit,
    );
  }

  String _formatQuantity(double value) =>
      formatReservationQuantity(value);

  double? _parsedQuantity() {
    return double.tryParse(_quantityController.text.trim());
  }

  void _setQuantity(double value) {
    final clamped = value.clamp(0, _availableQuantity).toDouble();
    _quantityController.text = _formatQuantity(clamped);
  }

  void _incrementQuantity() {
    final current = _parsedQuantity();
    if (current == null) {
      setState(() => _setQuantity(1));
      return;
    }

    if (current >= _availableQuantity) {
      return;
    }

    final step = _usesCountSteps ? 1.0 : 0.1;
    setState(() => _setQuantity(current + step));
  }

  void _decrementQuantity() {
    final current = _parsedQuantity();
    if (current == null) {
      setState(() => _setQuantity(1));
      return;
    }

    final step = _usesCountSteps ? 1.0 : 0.1;
    final minValue = _usesCountSteps ? 1.0 : 0.1;
    if (current <= minValue) {
      return;
    }

    setState(() => _setQuantity(current - step));
  }

  Future<void> _submit() async {
    if (_isSubmitting || _formKey.currentState?.validate() != true) {
      return;
    }

    final quantity = double.parse(_quantityController.text.trim());
    final message = _messageController.text.trim();

    if (_isPickup) {
      final windows = _validatedPreferredWindows(_pickupWindows);
      if (windows == null) {
        return;
      }

      setState(() {
        _isSubmitting = true;
        _errorMessage = null;
      });

      try {
        await widget.onSubmit(
          CreateReservationRequest(
            materialId: widget.material.id,
            quantityRequested: quantity,
            fulfillmentMethod: 'PICKUP',
            message: message.isEmpty ? null : message,
            learnerPreferredPickupWindows: windows,
          ),
        );
      } on ApiException catch (error) {
        if (!mounted) {
          return;
        }

        setState(() {
          _isSubmitting = false;
          _errorMessage = reservationCreateErrorMessage(error);
        });
        return;
      } catch (_) {
        if (!mounted) {
          return;
        }

        setState(() {
          _isSubmitting = false;
          _errorMessage =
              'Could not request this reservation. Please try again.';
        });
        return;
      }
    } else {
      final windows = _validatedPreferredWindows(_deliveryWindows);
      if (windows == null) {
        return;
      }

      final deliveryAddress = _deliveryAddressController.text.trim();
      if (deliveryAddress.isEmpty) {
        setState(() => _errorMessage = 'Enter a delivery address.');
        return;
      }

      if (_safeDropoffAllowed == null) {
        setState(
          () => _errorMessage = 'Choose whether safe drop-off is allowed.',
        );
        return;
      }

      final deliveryNote = _deliveryNoteController.text.trim();

      setState(() {
        _isSubmitting = true;
        _errorMessage = null;
      });

      try {
        await widget.onSubmit(
          CreateReservationRequest(
            materialId: widget.material.id,
            quantityRequested: quantity,
            fulfillmentMethod: 'DELIVERY',
            message: message.isEmpty ? null : message,
            learnerPreferredDeliveryWindows: windows,
            deliveryAddressText: deliveryAddress,
            safeDropoffAllowed: _safeDropoffAllowed,
            deliveryNote: deliveryNote.isEmpty ? null : deliveryNote,
          ),
        );
      } on ApiException catch (error) {
        if (!mounted) {
          return;
        }

        setState(() {
          _isSubmitting = false;
          _errorMessage = reservationCreateErrorMessage(error);
        });
        return;
      } catch (_) {
        if (!mounted) {
          return;
        }

        setState(() {
          _isSubmitting = false;
          _errorMessage =
              'Could not request this reservation. Please try again.';
        });
        return;
      }
    }

    if (!mounted) {
      return;
    }

    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final material = widget.material;
    final palette = MaterialsUiPalette.of(context);
    final screenSize = MediaQuery.sizeOf(context);
    final isNarrow = screenSize.width < 480;
    final dialogWidth = isNarrow
        ? screenSize.width * 0.92
        : _reservationDialogMaxWidth;
    final maxDialogHeight =
        screenSize.height * _reservationDialogMaxHeightFactor;
    final maxBodyHeight = (maxDialogHeight - _reservationDialogChromeHeight)
        .clamp(180.0, maxDialogHeight);

    return Dialog(
      insetPadding: EdgeInsets.symmetric(
        horizontal: isNarrow ? screenSize.width * 0.04 : AppSpacing.lg,
        vertical: AppSpacing.lg,
      ),
      backgroundColor: palette.panelSurface,
      shape: RoundedRectangleBorder(borderRadius: AppRadius.lgAll),
      child: SizedBox(
        width: dialogWidth,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: maxDialogHeight),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsetsDirectional.fromSTEB(
                  AppSpacing.md,
                  AppSpacing.sm,
                  AppSpacing.xs,
                  AppSpacing.sm,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Request reservation',
                        style: AppTextStyles.body(context).copyWith(
                          color: palette.textPrimary,
                          fontWeight: FontWeight.w600,
                          fontSize: 18,
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: _isSubmitting
                          ? null
                          : () => Navigator.of(context).pop(),
                      tooltip: 'Close',
                      visualDensity: VisualDensity.compact,
                      constraints: const BoxConstraints(
                        minWidth: 36,
                        minHeight: 36,
                      ),
                      icon: Icon(Icons.close_rounded, color: palette.textMuted),
                    ),
                  ],
                ),
              ),
              Divider(height: 1, color: palette.borderSubtle),
              ConstrainedBox(
                constraints: BoxConstraints(maxHeight: maxBodyHeight),
                child: SingleChildScrollView(
                  padding: const EdgeInsetsDirectional.fromSTEB(
                    AppSpacing.md,
                    AppSpacing.md,
                    AppSpacing.md,
                    AppSpacing.sm,
                  ),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _ReservationDialogMaterialSummary(
                          material: material,
                          availabilityLabel:
                              _formatAvailableQuantityLabel(material),
                        ),
                        if (_errorMessage != null) ...[
                          const SizedBox(height: _reservationDialogSectionGap),
                          Container(
                            padding: const EdgeInsetsDirectional.all(
                              AppSpacing.sm,
                            ),
                            decoration: BoxDecoration(
                              color: palette.inputSurface,
                              borderRadius: AppRadius.mdAll,
                              border: Border.all(color: palette.borderStrong),
                            ),
                            child: Text(
                              _errorMessage!,
                              style: AppTextStyles.body(context).copyWith(
                                color: palette.textPrimary,
                              ),
                            ),
                          ),
                        ],
                        const SizedBox(height: _reservationDialogSectionGap),
                        Text(
                          'Quantity',
                          style: AppTextStyles.label(context).copyWith(
                            color: palette.textSecondary,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        _ReservationDialogQuantityStepper(
                          controller: _quantityController,
                          unit: material.unit,
                          enabled: !_isSubmitting,
                          onDecrement: _isSubmitting ||
                                  (_parsedQuantity() ?? 1) <=
                                      (_usesCountSteps ? 1.0 : 0.1)
                              ? null
                              : _decrementQuantity,
                          onIncrement: _isSubmitting ||
                                  (_parsedQuantity() ?? 0) >= _availableQuantity
                              ? null
                              : _incrementQuantity,
                          validator: (value) {
                            final parsed = double.tryParse(value?.trim() ?? '');
                            if (parsed == null || parsed <= 0) {
                              return 'Enter a quantity greater than 0';
                            }
                            if (parsed > material.availableQuantity) {
                              return 'Cannot exceed available quantity';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: _reservationDialogSectionGap),
                        Text(
                          'Fulfillment',
                          style: AppTextStyles.label(context).copyWith(
                            color: palette.textSecondary,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        SegmentedButton<String>(
                          segments: [
                            const ButtonSegment(
                              value: 'PICKUP',
                              label: Text('Pickup'),
                              icon: Icon(Icons.storefront_outlined, size: 18),
                            ),
                            ButtonSegment(
                              value: 'DELIVERY',
                              enabled: _canChooseDelivery,
                              label: const Text('Delivery'),
                              icon: const Icon(
                                Icons.local_shipping_outlined,
                                size: 18,
                              ),
                            ),
                          ],
                          selected: {_fulfillmentMethod},
                          onSelectionChanged: _isSubmitting
                              ? null
                              : (selection) {
                                  setState(() {
                                    _fulfillmentMethod = selection.first;
                                    _errorMessage = null;
                                  });
                                },
                        ),
                        if (!_canChooseDelivery) ...[
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            'This material is pickup only.',
                            style: AppTextStyles.label(context).copyWith(
                              color: palette.textMuted,
                            ),
                          ),
                        ],
                        const SizedBox(height: _reservationDialogSectionGap),
                        if (_isPickup)
                          PreferredWindowInput(
                            windows: _pickupWindows,
                            enabled: !_isSubmitting,
                            label: 'Preferred pickup windows',
                            onChanged: (windows) {
                              setState(() => _pickupWindows
                                ..clear()
                                ..addAll(windows));
                            },
                          )
                        else ...[
                          PreferredWindowInput(
                            windows: _deliveryWindows,
                            enabled: !_isSubmitting,
                            label: 'Preferred delivery windows',
                            onChanged: (windows) {
                              setState(() => _deliveryWindows
                                ..clear()
                                ..addAll(windows));
                            },
                          ),
                          const SizedBox(height: _reservationDialogSectionGap),
                          Text(
                            'Delivery address',
                            style: AppTextStyles.label(context).copyWith(
                              color: palette.textSecondary,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          TextFormField(
                            controller: _deliveryAddressController,
                            enabled: !_isSubmitting,
                            minLines: 2,
                            maxLines: 3,
                            decoration: InputDecoration(
                              hintText: 'Street, building, city…',
                              filled: true,
                              fillColor: palette.inputSurface,
                              contentPadding: const EdgeInsetsDirectional.all(
                                AppSpacing.sm,
                              ),
                              border: OutlineInputBorder(
                                borderRadius: AppRadius.mdAll,
                                borderSide:
                                    BorderSide(color: palette.borderSubtle),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: AppRadius.mdAll,
                                borderSide:
                                    BorderSide(color: palette.borderSubtle),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: AppRadius.mdAll,
                                borderSide: BorderSide(color: palette.mint),
                              ),
                            ),
                          ),
                          const SizedBox(height: _reservationDialogSectionGap),
                          Text(
                            'Safe drop-off allowed?',
                            style: AppTextStyles.label(context).copyWith(
                              color: palette.textSecondary,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          Row(
                            children: [
                              Expanded(
                                child: RadioListTile<bool>(
                                  contentPadding: EdgeInsets.zero,
                                  dense: true,
                                  title: const Text('Yes'),
                                  value: true,
                                  groupValue: _safeDropoffAllowed,
                                  onChanged: _isSubmitting
                                      ? null
                                      : (value) => setState(
                                            () => _safeDropoffAllowed = value,
                                          ),
                                ),
                              ),
                              Expanded(
                                child: RadioListTile<bool>(
                                  contentPadding: EdgeInsets.zero,
                                  dense: true,
                                  title: const Text('No'),
                                  value: false,
                                  groupValue: _safeDropoffAllowed,
                                  onChanged: _isSubmitting
                                      ? null
                                      : (value) => setState(
                                            () => _safeDropoffAllowed = value,
                                          ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: _reservationDialogSectionGap),
                          Text(
                            'Delivery note',
                            style: AppTextStyles.label(context).copyWith(
                              color: palette.textSecondary,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          TextFormField(
                            controller: _deliveryNoteController,
                            enabled: !_isSubmitting,
                            minLines: 2,
                            maxLines: 3,
                            maxLength: _reservationMessageMaxLength,
                            decoration: InputDecoration(
                              hintText: 'Gate code, landmarks, or instructions…',
                              helperText: 'Optional',
                              filled: true,
                              fillColor: palette.inputSurface,
                              contentPadding: const EdgeInsetsDirectional.all(
                                AppSpacing.sm,
                              ),
                              border: OutlineInputBorder(
                                borderRadius: AppRadius.mdAll,
                                borderSide:
                                    BorderSide(color: palette.borderSubtle),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: AppRadius.mdAll,
                                borderSide:
                                    BorderSide(color: palette.borderSubtle),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: AppRadius.mdAll,
                                borderSide: BorderSide(color: palette.mint),
                              ),
                            ),
                          ),
                        ],
                        const SizedBox(height: _reservationDialogSectionGap),
                        Text(
                          'Message to supplier',
                          style: AppTextStyles.label(context).copyWith(
                            color: palette.textSecondary,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        TextFormField(
                          controller: _messageController,
                          enabled: !_isSubmitting,
                          minLines: 3,
                          maxLines: 5,
                          maxLength: _reservationMessageMaxLength,
                          decoration: InputDecoration(
                            hintText: _isPickup
                                ? 'Add pickup notes or questions…'
                                : 'Add reservation notes or questions…',
                            helperText: 'Optional',
                            filled: true,
                            fillColor: palette.inputSurface,
                            contentPadding: const EdgeInsetsDirectional.all(
                              AppSpacing.sm,
                            ),
                            border: OutlineInputBorder(
                              borderRadius: AppRadius.mdAll,
                              borderSide: BorderSide(color: palette.borderSubtle),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: AppRadius.mdAll,
                              borderSide: BorderSide(color: palette.borderSubtle),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: AppRadius.mdAll,
                              borderSide: BorderSide(color: palette.mint),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              Divider(height: 1, color: palette.borderSubtle),
              Padding(
                padding: const EdgeInsetsDirectional.fromSTEB(
                  AppSpacing.md,
                  AppSpacing.sm,
                  AppSpacing.md,
                  AppSpacing.md,
                ),
                child: isNarrow
                    ? Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _ReservationDialogSubmitButton(
                            isSubmitting: _isSubmitting,
                            onPressed: _submit,
                            fullWidth: true,
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          TextButton(
                            onPressed: _isSubmitting
                                ? null
                                : () => Navigator.of(context).pop(),
                            child: const Text('Cancel'),
                          ),
                        ],
                      )
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          TextButton(
                            onPressed: _isSubmitting
                                ? null
                                : () => Navigator.of(context).pop(),
                            child: const Text('Cancel'),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          _ReservationDialogSubmitButton(
                            isSubmitting: _isSubmitting,
                            onPressed: _submit,
                          ),
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

class _ReservationDialogMaterialSummary extends StatelessWidget {
  const _ReservationDialogMaterialSummary({
    required this.material,
    required this.availabilityLabel,
  });

  final DiscoveryMaterial material;
  final String availabilityLabel;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          material.title.resolve(context),
          style: AppTextStyles.body(context).copyWith(
            color: palette.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          material.category.resolve(context),
          style: AppTextStyles.label(context).copyWith(
            color: palette.textMuted,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          availabilityLabel,
          style: AppTextStyles.label(context).copyWith(
            color: palette.textSecondary,
          ),
        ),
      ],
    );
  }
}

class _ReservationDialogQuantityStepper extends StatelessWidget {
  const _ReservationDialogQuantityStepper({
    required this.controller,
    required this.unit,
    required this.enabled,
    required this.onDecrement,
    required this.onIncrement,
    required this.validator,
  });

  final TextEditingController controller;
  final String unit;
  final bool enabled;
  final VoidCallback? onDecrement;
  final VoidCallback? onIncrement;
  final FormFieldValidator<String> validator;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Row(
      children: [
        _QuantityStepButton(
          icon: Icons.remove_rounded,
          onPressed: onDecrement,
          compact: true,
        ),
        const SizedBox(width: AppSpacing.sm),
        SizedBox(
          width: 156,
          child: TextFormField(
            controller: controller,
            enabled: enabled,
            textAlign: TextAlign.center,
            keyboardType:
                const TextInputType.numberWithOptions(decimal: true),
            style: AppTextStyles.body(context).copyWith(
              color: palette.textPrimary,
              fontWeight: FontWeight.w600,
            ),
            decoration: InputDecoration(
              isDense: true,
              suffixText: unit,
              suffixStyle: AppTextStyles.label(context).copyWith(
                color: palette.textMuted,
              ),
              contentPadding: const EdgeInsetsDirectional.symmetric(
                horizontal: AppSpacing.sm,
                vertical: AppSpacing.sm,
              ),
              filled: true,
              fillColor: palette.inputSurface,
              border: OutlineInputBorder(
                borderRadius: AppRadius.mdAll,
                borderSide: BorderSide(color: palette.borderSubtle),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: AppRadius.mdAll,
                borderSide: BorderSide(color: palette.borderSubtle),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: AppRadius.mdAll,
                borderSide: BorderSide(color: palette.mint),
              ),
            ),
            validator: validator,
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        _QuantityStepButton(
          icon: Icons.add_rounded,
          onPressed: onIncrement,
          compact: true,
        ),
      ],
    );
  }
}

class _ReservationDialogSubmitButton extends StatelessWidget {
  const _ReservationDialogSubmitButton({
    required this.isSubmitting,
    required this.onPressed,
    this.fullWidth = false,
  });

  final bool isSubmitting;
  final VoidCallback? onPressed;
  final bool fullWidth;

  @override
  Widget build(BuildContext context) {
    final button = FilledButton(
      onPressed: isSubmitting ? null : onPressed,
      style: _reservationDialogSubmitButtonStyle(context),
      child: isSubmitting
          ? SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppThemeColors.of(context).textOnPrimary,
              ),
            )
          : const Text('Send request'),
    );

    if (fullWidth) {
      return Row(
        children: [
          Expanded(child: button),
        ],
      );
    }

    return IntrinsicWidth(child: button);
  }
}

class _QuantityStepButton extends StatelessWidget {
  const _QuantityStepButton({
    required this.icon,
    required this.onPressed,
    this.compact = false,
  });

  final IconData icon;
  final VoidCallback? onPressed;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final size = compact ? 36.0 : 44.0;

    return IconButton.outlined(
      onPressed: onPressed,
      visualDensity: VisualDensity.compact,
      style: IconButton.styleFrom(
        minimumSize: Size(size, size),
        maximumSize: Size(size, size),
        padding: EdgeInsets.zero,
        side: BorderSide(color: palette.borderStrong),
        foregroundColor: palette.textPrimary,
      ),
      icon: Icon(icon, size: compact ? 18 : 20),
    );
  }
}
