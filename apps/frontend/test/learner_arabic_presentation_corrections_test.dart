import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/notifications/application/notifications_provider.dart';
import 'package:frontend/features/notifications/data/models/app_notification.dart';
import 'package:frontend/features/notifications/presentation/pages/user_notifications_page.dart';
import 'package:frontend/features/reservations/data/models/learner_reservation.dart';
import 'package:frontend/features/reservations/presentation/widgets/learner_reservation_card.dart';
import 'package:frontend/l10n/app_localizations.dart';

class _LearnerAuthController extends AuthController {
  @override
  AuthState build() => AuthState(
    hasBootstrapped: true,
    accessToken: 'token',
    user: User(
      id: 'learner-1',
      displayName: 'متعلّم',
      email: 'learner@example.com',
      accountStatus: 'ACTIVE',
      roles: const ['LEARNER'],
      createdAt: DateTime.utc(2026),
    ),
  );
}

class _ArabicNotificationsNotifier extends NotificationsListNotifier {
  @override
  Future<NotificationsListState> build() async => NotificationsListState(
    items: [
      AppNotification(
        id: 'notification-1',
        notificationType: 'RESERVATION_ACCEPTED',
        title: 'Legacy English title',
        body: 'Legacy English body',
        isRead: false,
        createdAt: DateTime.now(),
        relatedEntityType: 'RESERVATION',
        relatedEntityId: 'reservation-1',
        actionType: 'VIEW_RESERVATION',
        metadata: const {'materialTitle': 'ألواح خشبية'},
      ),
    ],
    page: 1,
    totalPages: 1,
    total: 1,
    unreadCount: 1,
    isLoadingMore: false,
    filter: NotificationReadFilter.all,
  );
}

class _ArabicUnreadCountNotifier extends NotificationUnreadCountNotifier {
  @override
  Future<int> build() async => 1;
}

LearnerReservation _reservation(String status) {
  return LearnerReservation.fromJson({
    'id': 'reservation-$status',
    'status': status,
    'quantityRequested': 1,
    'fulfillmentMethod': 'PICKUP',
    'createdAt': '2026-01-01T00:00:00.000Z',
    'updatedAt': '2026-01-01T00:00:00.000Z',
    'material': {
      'id': 'material-1',
      'title': 'ألواح خشبية',
      'materialType': 'خشب',
      'status': status == 'COMPLETED' ? 'REUSED' : 'AVAILABLE',
      'unit': 'قطعة',
      'city': 'الخليل',
    },
    'supplier': {'id': 'supplier-1', 'displayName': 'المورّد التجريبي'},
  });
}

Widget _arabicApp(Widget child) {
  return ProviderScope(
    overrides: [
      authControllerProvider.overrideWith(_LearnerAuthController.new),
      notificationsListProvider.overrideWith(_ArabicNotificationsNotifier.new),
      myNotificationUnreadCountProvider.overrideWith(
        _ArabicUnreadCountNotifier.new,
      ),
    ],
    child: MaterialApp(
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar'), Locale('en')],
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: AppTheme.lightFor('ar'),
      home: Scaffold(body: child),
    ),
  );
}

void main() {
  testWidgets('Arabic pickup card uses the fulfillment-method field label', (
    tester,
  ) async {
    await tester.pumpWidget(
      _arabicApp(
        SingleChildScrollView(
          child: LearnerReservationCard(
            reservation: _reservation('PENDING'),
            delivery: null,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.text('طريقة استلام الطلب: الاستلام من المورّد'),
      findsOneWidget,
    );
    expect(find.textContaining('التوصيل: الاستلام'), findsNothing);
  });

  testWidgets('Arabic completed reservation renders the completed state', (
    tester,
  ) async {
    await tester.pumpWidget(
      _arabicApp(
        SingleChildScrollView(
          child: LearnerReservationCard(
            reservation: _reservation('COMPLETED'),
            delivery: null,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('مكتمل'), findsOneWidget);
    expect(find.text('اكتمل هذا الحجز.'), findsOneWidget);
  });

  testWidgets('Arabic notification tile renders structured metadata copy', (
    tester,
  ) async {
    await tester.pumpWidget(
      _arabicApp(const UserNotificationsPage(embeddedInShell: true)),
    );
    await tester.pumpAndSettle();

    expect(find.text('تم قبول الحجز'), findsOneWidget);
    expect(
      find.text(
        'تم قبول طلب ألواح خشبية. تحقّق من تفاصيل الاستلام أو التوصيل.',
      ),
      findsOneWidget,
    );
    expect(find.textContaining('Legacy English'), findsNothing);
  });
}
