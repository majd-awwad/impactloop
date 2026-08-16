import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/supplier_portal/data/models/supplier_incoming_request.dart';
import 'package:frontend/features/supplier_portal/presentation/theme/supplier_locale_scope.dart';
import 'package:frontend/features/supplier_portal/presentation/widgets/incoming_request_card.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/l10n/app_localizations_en.dart';
import 'package:frontend/shared/l10n/learner_ui_labels.dart';

void main() {
  testWidgets(
    'renders canonical inbox fields without a duplicated learner note',
    (tester) async {
      final en = AppLocalizationsEn();
      final labels = LearnerUiLabels(en);
      final request = SupplierIncomingRequest(
        id: '24a91f00',
        materialTitle: 'Small DC Gear Motors Pair',
        learnerName: 'Majd Learner',
        quantityRequested: 2,
        unit: 'pieces',
        status: SupplierIncomingRequestStatus.pending,
        requestedAt: DateTime(2026, 7, 12),
        workflowPhase: const SupplierEnumValue(
          SupplierWorkflowPhase.initialDecision,
          'INITIAL_DECISION',
        ),
        attentionState: const SupplierEnumValue(
          SupplierAttentionState.supplierActionRequired,
          'SUPPLIER_ACTION_REQUIRED',
        ),
        nextActor: const SupplierEnumValue(
          SupplierNextActor.supplier,
          'SUPPLIER',
        ),
        fulfillmentContract: const SupplierFulfillmentSummary(label: 'Pickup'),
        scheduleSummary: SupplierScheduleSummary(
          activeWindowType: 'LEARNER_PREFERRED',
          effectiveWindow: SupplierScheduleWindow(
            start: DateTime(2026, 7, 18, 10),
            end: DateTime(2026, 7, 18, 12),
          ),
        ),
        learnerNote: 'Please use the north entrance.',
        messageSummary: const SupplierMessageSummary(
          matchesOriginalLearnerNote: true,
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('en'),
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          home: SupplierLocaleScope(
            languageCode: 'en',
            child: Scaffold(
              body: SizedBox(
                width: 1280,
                child: IncomingRequestCard(
                  request: request,
                  primaryLabel: 'Review request',
                  onPrimaryAction: () {},
                  onView: () {},
                ),
              ),
            ),
          ),
        ),
      );

      expect(find.text('Small DC Gear Motors Pair'), findsOneWidget);
      expect(find.text(labels.reservationStatus('PENDING')), findsOneWidget);
      expect(
        find.text(
          en.supplierAttentionNextActor(
            en.supplierAttentionNeedsYourResponse,
            en.supplier,
          ),
        ),
        findsOneWidget,
      );
      expect(find.text('Please use the north entrance.'), findsNothing);
    },
  );
}
