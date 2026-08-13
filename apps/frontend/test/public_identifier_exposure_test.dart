import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/core/network/api_response.dart';
import 'package:frontend/features/payments/application/learner_checkout_controller.dart';
import 'package:frontend/features/payments/presentation/widgets/checkout_reservation_summary_card.dart';
import 'package:frontend/features/payments/presentation/widgets/checkout_result_view.dart';
import 'package:frontend/features/reservations/data/models/learner_reservation.dart';
import 'package:frontend/features/reservations/presentation/detail/reservation_detail_pickup_code_card.dart';
import 'package:frontend/features/reservations/presentation/detail/reservation_detail_summary_card.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/l10n/app_localizations_ar.dart';
import 'package:frontend/l10n/app_localizations_en.dart';

const _internalUuid = '550e8400-e29b-41d4-a716-446655440000';
const _internalCuid = 'cm4internalidentifier12345';

void main() {
  final en = AppLocalizationsEn();
  final ar = AppLocalizationsAr();

  test('localized API errors reject raw UUID and CUID details', () {
    const uuidError = ApiException(
      message: 'Delivery $_internalUuid failed in the database',
      code: 'UNKNOWN_DELIVERY_FAILURE',
      statusCode: 409,
    );
    const cuidError = ApiException(
      message: 'reservationId=$_internalCuid could not be loaded',
      code: 'UNKNOWN_RESERVATION_FAILURE',
      statusCode: 400,
    );

    expect(localizedApiErrorMessage(uuidError, en), en.somethingWentWrong);
    expect(localizedApiErrorMessage(uuidError, ar), ar.somethingWentWrong);
    expect(localizedApiErrorMessage(cuidError, en), en.somethingWentWrong);
    expect(localizedApiErrorMessage(cuidError, ar), ar.somethingWentWrong);
  });

  test('network error mapping discards internal backend prose', () {
    final request = RequestOptions(path: '/api/reservations/$_internalUuid');
    final mapped = mapDioException(
      DioException(
        requestOptions: request,
        response: Response<Map<String, dynamic>>(
          requestOptions: request,
          statusCode: 500,
          data: const {
            'success': false,
            'message': 'SQL failed for reservation $_internalUuid',
            'error': {'code': 'INTERNAL_ERROR'},
          },
        ),
        type: DioExceptionType.badResponse,
      ),
    );

    expect(mapped.message, 'Request failed');
    expect(mapped.message, isNot(contains(_internalUuid)));
    expect(localizedApiErrorMessage(mapped, en), en.serverError);
  });

  test('safe domain errors retain their localized public behavior', () {
    const error = ApiException(
      message: 'The reservation changed.',
      code: 'CONFLICT',
      statusCode: 409,
    );

    expect(localizedApiErrorMessage(error, en), en.conflictError);
    expect(localizedApiErrorMessage(error, ar), ar.conflictError);
  });

  testWidgets(
    'reservation UI omits ID fields but preserves normal content and pickup code',
    (tester) async {
      tester.view.physicalSize = const Size(1000, 1600);
      tester.view.devicePixelRatio = 1;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final now = DateTime.utc(2026, 8, 13);
      final reservation = LearnerReservation(
        id: _internalUuid,
        status: 'ACCEPTED',
        quantityRequested: 1,
        createdAt: now,
        updatedAt: now,
        selfPickupCode: '123456',
        fulfillmentMethod: 'PICKUP',
        material: const LearnerReservationMaterial(
          id: _internalCuid,
          title: 'Arduino $_internalUuid',
          materialType: 'Electronics',
          status: 'RESERVED',
          deliveryAllowed: true,
        ),
        supplier: const LearnerReservationSupplier(
          id: 'cm4supplieridentifier12345',
          displayName: 'Community $_internalCuid',
        ),
      );

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            theme: AppTheme.light,
            locale: const Locale('en'),
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: AppLocalizations.supportedLocales,
            home: Scaffold(
              body: SingleChildScrollView(
                child: Column(
                  children: [
                    const CheckoutResultView(
                      phase: CheckoutPhase.succeeded,
                    ),
                    CheckoutReservationSummaryCard(reservation: reservation),
                    ReservationDetailSummaryCard(
                      reservation: reservation,
                      delivery: null,
                    ),
                    ReservationDetailPickupCodeCard(
                      reservation: reservation,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pump();

      expect(find.text(_internalUuid), findsNothing);
      expect(find.text(_internalCuid), findsNothing);
      expect(find.text('Arduino $_internalUuid'), findsOneWidget);
      expect(find.text('Community $_internalCuid'), findsOneWidget);
      expect(find.text(en.checkoutSuccessTransactionLabel), findsNothing);
      expect(find.text(en.reservationReference), findsNothing);
      expect(find.text('123 456'), findsOneWidget);
      expect(find.text(en.pickupCodeSafetyNote), findsOneWidget);
    },
  );
}
