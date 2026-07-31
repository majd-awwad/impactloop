import '../../../shared/models/localized_text.dart';
import '../../auth/application/auth_controller.dart';
import '../../reservations/data/models/learner_reservation.dart';
import '../domain/discovery_material.dart';

class MaterialReserveEligibility {
  const MaterialReserveEligibility({
    required this.canTapReserve,
    required this.helperText,
    required this.disabledReason,
    required this.isAvailable,
    required this.isAuthenticatedLearner,
    required this.isAuthenticatedNonLearner,
    required this.isLoadingReservation,
    required this.buttonLabel,
    required this.showReservationStatusCta,
    required this.learnerReservation,
    required this.isSubmitting,
  });

  final bool canTapReserve;
  final LocalizedText helperText;
  final LocalizedText? disabledReason;
  final bool isAvailable;
  final bool isAuthenticatedLearner;
  final bool isAuthenticatedNonLearner;
  final bool isLoadingReservation;
  final LocalizedText buttonLabel;
  final bool showReservationStatusCta;
  final LearnerReservation? learnerReservation;
  final bool isSubmitting;

  factory MaterialReserveEligibility.resolve({
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
    final hasFulfillmentOption =
        material.pickupAllowed || material.deliveryAvailable;
    final isAuthenticated =
        authState.status == AuthStatus.authenticated && authState.user != null;
    final isAuthenticatedLearner =
        isAuthenticated && authState.user!.hasRole('LEARNER');
    final isAuthenticatedNonLearner =
        isAuthenticated && !authState.user!.hasRole('LEARNER');
    final isOwnMaterial = material.isOwnMaterial == true;
    final backendBlocksReserve =
        isAuthenticated && material.canReserve == false;
    final blockingReservation =
        learnerReservation?.blocksNewMaterialReservation == true
        ? learnerReservation
        : null;
    final hasBlockingReservation =
        showReservationStatusCta || blockingReservation != null;

    final canTapReserve =
        isAvailable &&
        hasFulfillmentOption &&
        !hasBlockingReservation &&
        !isAuthenticatedNonLearner &&
        !isSubmitting &&
        !isOwnMaterial &&
        !backendBlocksReserve;

    final disabledReason = !canTapReserve
        ? _disabledReason(
            material: material,
            authState: authState,
            isAvailable: isAvailable,
            hasFulfillmentOption: hasFulfillmentOption,
            isOwnMaterial: isOwnMaterial,
            isAuthenticatedNonLearner: isAuthenticatedNonLearner,
            backendBlocksReserve: backendBlocksReserve,
            learnerReservation: blockingReservation,
            showReservationStatusCta: showReservationStatusCta,
            isSubmitting: isSubmitting,
          )
        : null;

    final helperText =
        disabledReason ??
        (authState.status == AuthStatus.unauthenticated
            ? const LocalizedText(
                en: 'Sign in as a learner to request this material.',
                ar: 'سجل الدخول كمتعلم لطلب هذه المادة.',
              )
            : const LocalizedText(
                en: 'Request this material from the supplier.',
                ar: 'اطلب هذه المادة من المورد.',
              ));

    final buttonLabel = isSubmitting
        ? const LocalizedText(en: 'Requesting...', ar: 'جارٍ الطلب...')
        : isOwnMaterial
        ? const LocalizedText(en: 'Your listing', ar: 'مادتك')
        : !isAvailable
        ? const LocalizedText(en: 'Not available', ar: 'غير متاح')
        : !hasFulfillmentOption
        ? const LocalizedText(
            en: 'Reservation unavailable',
            ar: 'الحجز غير متاح',
          )
        : isAuthenticatedLearner ||
              authState.status == AuthStatus.unauthenticated
        ? const LocalizedText(en: 'Reserve Material', ar: 'احجز المادة')
        : const LocalizedText(en: 'Sign in to Reserve', ar: 'سجل الدخول للحجز');

    return MaterialReserveEligibility(
      canTapReserve: canTapReserve,
      helperText: helperText,
      disabledReason: disabledReason,
      isAvailable: isAvailable,
      isAuthenticatedLearner: isAuthenticatedLearner,
      isAuthenticatedNonLearner: isAuthenticatedNonLearner,
      isLoadingReservation: isLoadingReservation,
      buttonLabel: buttonLabel,
      showReservationStatusCta: showReservationStatusCta,
      learnerReservation: blockingReservation,
      isSubmitting: isSubmitting,
    );
  }

  static LocalizedText? _disabledReason({
    required DiscoveryMaterial material,
    required AuthState authState,
    required bool isAvailable,
    required bool hasFulfillmentOption,
    required bool isOwnMaterial,
    required bool isAuthenticatedNonLearner,
    required bool backendBlocksReserve,
    required LearnerReservation? learnerReservation,
    required bool showReservationStatusCta,
    required bool isSubmitting,
  }) {
    if (isSubmitting) {
      return const LocalizedText(
        en: 'Sending your reservation request…',
        ar: 'جارٍ إرسال طلب الحجز…',
      );
    }

    if (showReservationStatusCta || learnerReservation != null) {
      return const LocalizedText(
        en: 'You already have a reservation request for this material.',
        ar: 'لديك بالفعل طلب حجز لهذه المادة.',
      );
    }

    if (!isAvailable) {
      return const LocalizedText(
        en: 'This material is not available.',
        ar: 'هذه المادة غير متاحة.',
      );
    }

    if (!hasFulfillmentOption) {
      return const LocalizedText(
        en: 'Reservation is not available for this material.',
        ar: 'الحجز غير متاح لهذه المادة.',
      );
    }

    if (isOwnMaterial) {
      return const LocalizedText(
        en: 'You cannot reserve your own material.',
        ar: 'لا يمكنك حجز مادتك الخاصة.',
      );
    }

    if (authState.status == AuthStatus.unauthenticated) {
      return null;
    }

    if (isAuthenticatedNonLearner) {
      return const LocalizedText(
        en: 'Become a learner to reserve materials.',
        ar: 'كن متعلماً لحجز المواد.',
      );
    }

    if (backendBlocksReserve) {
      return switch (material.reserveBlockReason) {
        'OPEN_RESERVATION_EXISTS' => const LocalizedText(
          en: 'You already have an open reservation for this material.',
          ar: 'لديك بالفعل حجزاً مفتوحاً لهذه المادة.',
        ),
        'UNAVAILABLE' => const LocalizedText(
          en: 'This material is not available.',
          ar: 'هذه المادة غير متاحة.',
        ),
        'OWN_MATERIAL' => const LocalizedText(
          en: 'You cannot reserve your own material.',
          ar: 'لا يمكنك حجز مادتك الخاصة.',
        ),
        'NOT_LEARNER' => const LocalizedText(
          en: 'Become a learner to reserve materials.',
          ar: 'كن متعلماً لحجز المواد.',
        ),
        _ => const LocalizedText(
          en: 'Reservation is not available for this material.',
          ar: 'الحجز غير متاح لهذه المادة.',
        ),
      };
    }

    return null;
  }
}
