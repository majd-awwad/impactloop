import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../../shared/widgets/materials/material_condition_badge.dart';
import '../../../../shared/widgets/materials/material_price_badge.dart';
import '../../../../shared/widgets/materials/material_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../deliveries/application/learner_deliveries_provider.dart';
import '../../../deliveries/data/models/learner_delivery.dart';
import '../../../deliveries/presentation/delivery_status_presentation.dart';
import '../../../home/application/home_suggested_materials_provider.dart';
import '../../../reservations/application/my_reservations_provider.dart';
import '../../../reservations/application/reservation_create_controller.dart';
import '../../../reservations/data/models/create_reservation_request.dart';
import '../../../reservations/data/models/learner_reservation.dart';
import '../../data/api_material_discovery_repository.dart';
import '../../domain/discovery_material.dart';
import '../../domain/material_discovery_repository.dart';
import '../material_discovery_content.dart';
import '../widgets/nearby_map_placeholder.dart';

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

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: FutureBuilder<DiscoveryMaterial?>(
          future: _materialFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return Center(
                child: CircularProgressIndicator(color: palette.mint),
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

            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const EntryNavBar(
                  showSignIn: true,
                  showCreateAccount: true,
                  homeRoute: '/',
                ),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsetsDirectional.only(
                      bottom: AppSpacing.xl,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _MaterialDetailsHero(material: material),
                        Transform.translate(
                          offset: const Offset(0, -34),
                          child: Padding(
                            padding: const EdgeInsetsDirectional.symmetric(
                              horizontal: AppSpacing.md,
                            ),
                            child: Center(
                              child: ConstrainedBox(
                                constraints: const BoxConstraints(
                                  maxWidth: 1400,
                                ),
                                child: LayoutBuilder(
                                  builder: (context, constraints) {
                                    final wide = constraints.maxWidth >= 980;
                                    final authState = ref.watch(
                                      authControllerProvider,
                                    );
                                    final reserveState = ref.watch(
                                      reservationCreateControllerProvider,
                                    );
                                    final myReservationsState =
                                        authState.status ==
                                                AuthStatus.authenticated &&
                                            authState.user?.hasRole(
                                                  'LEARNER',
                                                ) ==
                                                true
                                        ? ref.watch(myReservationsProvider)
                                        : null;
                                    final learnerReservation =
                                        myReservationsState?.maybeWhen(
                                          data: (reservations) =>
                                              _reservationForMaterial(
                                                reservations,
                                                material,
                                              ),
                                          orElse: () => null,
                                        );
                                    final myDeliveriesState =
                                        learnerReservation != null
                                        ? ref.watch(learnerDeliveriesProvider)
                                        : null;
                                    final learnerDelivery =
                                        myDeliveriesState?.maybeWhen(
                                          data: (deliveries) =>
                                              _deliveryForReservation(
                                                deliveries,
                                                learnerReservation!.id,
                                              ),
                                          orElse: () => null,
                                        );

                                    final mainColumn = _DetailsMainColumn(
                                      material: material,
                                    );
                                    final sideColumn = _DetailsSideColumn(
                                      material: material,
                                      authState: authState,
                                      isSubmitting: reserveState.isLoading,
                                      isLoadingReservation:
                                          myReservationsState?.isLoading ==
                                          true,
                                      showReservationStatusCta:
                                          _showReservationStatusCta,
                                      learnerReservation: learnerReservation,
                                      learnerDelivery: learnerDelivery,
                                      onReserve: () =>
                                          _handleReserve(material),
                                    );

                                    if (!wide) {
                                      return Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.stretch,
                                        children: [
                                          mainColumn,
                                          const SizedBox(height: AppSpacing.lg),
                                          sideColumn,
                                        ],
                                      );
                                    }

                                    return Row(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Expanded(flex: 7, child: mainColumn),
                                        const SizedBox(width: AppSpacing.lg),
                                        Expanded(flex: 4, child: sideColumn),
                                      ],
                                    );
                                  },
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
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

    try {
      await ref.read(reservationCreateControllerProvider.notifier).create(
            CreateReservationRequest(
              materialId: material.id,
              quantityRequested: material.quantity,
            ),
          );

      if (!mounted) {
        return;
      }

      showInfoSnackBar(context, 'Reservation request sent to the supplier.');
      ref.invalidate(myReservationsProvider);
      ref.invalidate(homeSuggestedMaterialsProvider);
      setState(() {
        _showReservationStatusCta = true;
        _materialFuture = _activeRepository.getMaterialById(widget.materialId);
      });
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }

      showInfoSnackBar(
        context,
        error.statusCode == 409
            ? 'This material is no longer available.'
            : error.displayMessage,
      );
      setState(() {
        _materialFuture = _activeRepository.getMaterialById(widget.materialId);
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      showInfoSnackBar(
        context,
        'Could not request this reservation. Please try again.',
      );
    }
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

    if (reservation.isRejected && material.status == 'AVAILABLE') {
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const EntryNavBar(
          showSignIn: true,
          showCreateAccount: true,
          homeRoute: '/',
        ),
        Expanded(child: Center(child: child)),
      ],
    );
  }
}

class _MaterialDetailsHero extends StatelessWidget {
  const _MaterialDetailsHero({required this.material});

  final DiscoveryMaterial material;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final screenWidth = MediaQuery.sizeOf(context).width;
    final heroHeight = screenWidth >= 1100
        ? 380.0
        : screenWidth >= 700
        ? 340.0
        : 296.0;

    return SizedBox(
      height: heroHeight,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: AlignmentDirectional.topStart,
            end: AlignmentDirectional.bottomEnd,
            colors: materialGradient(material),
          ),
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (material.imageUrl != null)
              Image.network(
                material.imageUrl!,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) =>
                    const SizedBox.shrink(),
              ),
            const DecoratedBox(
              decoration: BoxDecoration(color: materialOverlayDark),
            ),
            PositionedDirectional(
              top: 34,
              start: 24,
              child: IconButton.filled(
                onPressed: () => context.go('/materials'),
                style: IconButton.styleFrom(
                  backgroundColor: palette.panelSurface.withValues(alpha: 0.9),
                ),
                icon: const Icon(Icons.arrow_back_rounded),
              ),
            ),
            PositionedDirectional(
              top: 34,
              end: 24,
              child: Container(
                padding: const EdgeInsetsDirectional.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: AppSpacing.sm,
                ),
                decoration: BoxDecoration(
                  color: palette.panelSurface.withValues(alpha: 0.88),
                  borderRadius: AppRadius.pillAll,
                  border: Border.all(color: palette.borderSubtle),
                ),
                child: Text(
                  material.category.resolve(context),
                  style: AppTextStyles.label(
                    context,
                  ).copyWith(color: palette.textPrimary),
                  textAlign: TextAlign.start,
                ),
              ),
            ),
            Align(
              alignment: AlignmentDirectional.center,
              child: Container(
                width: 112,
                height: 112,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: AlignmentDirectional.topStart,
                    end: AlignmentDirectional.bottomEnd,
                    colors: [
                      materialFallbackStart,
                      materialFallbackMid,
                      materialFallbackEnd,
                    ],
                  ),
                  borderRadius: BorderRadius.circular(30),
                  border: Border.all(color: palette.borderStrong),
                ),
                child: Icon(
                  material.heroIconData,
                  size: 52,
                  color: palette.mint,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DetailsMainColumn extends StatelessWidget {
  const _DetailsMainColumn({required this.material});

  final DiscoveryMaterial material;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                material.title.resolve(context),
                style: AppTextStyles.display(
                  context,
                ).copyWith(color: palette.textPrimary),
                textAlign: TextAlign.start,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                material.description.resolve(context),
                style: AppTextStyles.subtitle(
                  context,
                ).copyWith(color: palette.textSecondary),
                textAlign: TextAlign.start,
              ),
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
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        _Panel(
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
              _InfoRow(
                icon: Icons.straighten_rounded,
                label: const LocalizedText(
                  en: 'Quantity',
                  ar: 'الكمية',
                ).resolve(context),
                value: material.quantityLabel.resolve(context),
              ),
              const SizedBox(height: AppSpacing.md),
              _InfoRow(
                icon: Icons.location_on_outlined,
                label: const LocalizedText(
                  en: 'Location',
                  ar: 'الموقع',
                ).resolve(context),
                value: material.locationLabel.resolve(context),
              ),
              const SizedBox(height: AppSpacing.md),
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
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        const NearbyMapPlaceholder(
          title: LocalizedText(
            en: 'Nearby Map Preview',
            ar: 'معاينة الخريطة القريبة',
          ),
          subtitle: LocalizedText(
            en: 'Exact public coordinates remain hidden until reservation logic exists.',
            ar: 'تبقى الإحداثيات العامة الدقيقة مخفية حتى يوجد منطق حجز فعلي.',
          ),
        ),
      ],
    );
  }
}

class _DetailsSideColumn extends StatelessWidget {
  const _DetailsSideColumn({
    required this.material,
    required this.authState,
    required this.isSubmitting,
    required this.isLoadingReservation,
    required this.showReservationStatusCta,
    required this.learnerReservation,
    required this.learnerDelivery,
    required this.onReserve,
  });

  final DiscoveryMaterial material;
  final AuthState authState;
  final bool isSubmitting;
  final bool isLoadingReservation;
  final bool showReservationStatusCta;
  final LearnerReservation? learnerReservation;
  final LearnerDelivery? learnerDelivery;
  final VoidCallback onReserve;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final isAvailable = material.status == 'AVAILABLE' && material.quantity > 0;
    final isAuthenticatedLearner =
        authState.status == AuthStatus.authenticated &&
        authState.user?.hasRole('LEARNER') == true;
    final isAuthenticatedNonLearner =
        authState.status == AuthStatus.authenticated &&
        authState.user?.hasRole('LEARNER') != true;
    final canTapReserve =
        isAvailable && !isAuthenticatedNonLearner && !isSubmitting;
    final reservationHelperText = !isAvailable
        ? const LocalizedText(
            en: 'This material is not available for new reservations.',
            ar: 'هذه المادة غير متاحة لحجوزات جديدة.',
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
                    en: 'Send a reservation request for the full listed material.',
                    ar: 'أرسل طلب حجز لكامل المادة المعروضة.',
                  );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _SectionTitle(
                title: const LocalizedText(en: 'Supplier', ar: 'المورد'),
              ),
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: palette.mint.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Icon(Icons.apartment_rounded, color: palette.mint),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          material.supplierName.resolve(context),
                          style: AppTextStyles.title(
                            context,
                          ).copyWith(color: palette.textPrimary),
                          textAlign: TextAlign.start,
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          material.supplierSubtitle.resolve(context),
                          style: AppTextStyles.body(
                            context,
                          ).copyWith(color: palette.textSecondary),
                          textAlign: TextAlign.start,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              if (material.ratingLabel != null) ...[
                const SizedBox(height: AppSpacing.md),
                Container(
                  padding: const EdgeInsetsDirectional.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.sm,
                  ),
                  decoration: BoxDecoration(
                    color: palette.cardSurfaceAlt,
                    borderRadius: AppRadius.pillAll,
                    border: Border.all(color: palette.borderStrong),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.star_rounded, color: materialLime),
                      const SizedBox(width: AppSpacing.xs),
                      Text(
                        LocalizedText(
                          en: '${material.ratingLabel!.resolve(context)} supplier rating',
                          ar: 'تقييم المورد ${material.ratingLabel!.resolve(context)}',
                        ).resolve(context),
                        style: AppTextStyles.label(
                          context,
                        ).copyWith(color: palette.textPrimary),
                        textAlign: TextAlign.start,
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        _Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _SectionTitle(
                title: const LocalizedText(en: 'Reservation', ar: 'الحجز'),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                reservationHelperText.resolve(context),
                style: AppTextStyles.body(
                  context,
                ).copyWith(color: palette.textSecondary),
                textAlign: TextAlign.start,
              ),
              const SizedBox(height: AppSpacing.md),
              if (isLoadingReservation && isAuthenticatedLearner)
                const _ReservationLoadingState()
              else if (learnerReservation != null)
                _LearnerReservationStateCard(
                  reservation: learnerReservation!,
                  delivery: learnerDelivery,
                  deliveryAvailable: material.deliveryAvailable,
                )
              else if (showReservationStatusCta)
                const _PostReservationStatusCta()
              else
                FilledButton.icon(
                  onPressed: canTapReserve ? onReserve : null,
                  style: FilledButton.styleFrom(
                    backgroundColor: materialMint,
                    foregroundColor: palette.ctaForeground,
                    minimumSize: const Size.fromHeight(54),
                    shape: RoundedRectangleBorder(
                      borderRadius: AppRadius.lgAll,
                    ),
                  ),
                  icon: isSubmitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.shopping_bag_outlined),
                  label: Text(
                    (isSubmitting
                            ? const LocalizedText(
                                en: 'Requesting...',
                                ar: 'جارٍ الطلب...',
                              )
                            : isAuthenticatedLearner || !isAvailable
                                ? const LocalizedText(
                                    en: 'Reserve Material',
                                    ar: 'احجز المادة',
                                  )
                                : const LocalizedText(
                                    en: 'Sign in to Reserve',
                                    ar: 'سجل الدخول للحجز',
                                  ))
                        .resolve(context),
                  ),
                ),
            ],
          ),
        ),
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

String _reservationStatusLabel(String status) {
  switch (status) {
    case 'PENDING':
      return 'Reservation request sent';
    case 'ACCEPTED':
      return 'Reservation accepted';
    case 'REJECTED':
      return 'Reservation rejected';
    case 'COMPLETED':
      return 'Reservation completed';
    case 'CANCELLED':
      return 'Reservation cancelled';
    case 'EXPIRED':
      return 'Reservation expired';
    default:
      return status;
  }
}

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
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: palette.borderStrong),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow,
            blurRadius: 28,
            offset: Offset(0, 10),
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
