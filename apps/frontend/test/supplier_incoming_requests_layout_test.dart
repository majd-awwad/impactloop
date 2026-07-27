import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/features/supplier_portal/data/models/supplier_incoming_request.dart';
import 'package:frontend/features/supplier_portal/presentation/controllers/supplier_requests_providers.dart';
import 'package:frontend/features/supplier_portal/presentation/pages/supplier_incoming_requests_page.dart';
import 'package:frontend/features/supplier_portal/presentation/theme/supplier_locale_scope.dart';

void main() {
  const response = SupplierReservationListResponse(
    summary: SupplierReservationSummary(
      total: 10,
      needsSupplierResponse: 2,
      waitingForLearner: 3,
      fulfillmentInProgress: 4,
      adminReview: 1,
      completed: 0,
      closed: 0,
    ),
  );

  testWidgets(
    'operational summary stays two columns across phone widths, RTL, and dark mode',
    (tester) async {
      addTearDown(() => tester.binding.setSurfaceSize(null));

      for (final brightness in Brightness.values) {
        for (final direction in [TextDirection.ltr, TextDirection.rtl]) {
          for (final width in [360.0, 400.0, 412.0]) {
            await tester.binding.setSurfaceSize(Size(width, 900));
            await tester.pumpWidget(
              ProviderScope(
                overrides: [
                  incomingRequestsProvider.overrideWith(
                    (ref) async => response,
                  ),
                ],
                child: MaterialApp(
                  theme: brightness == Brightness.dark
                      ? AppTheme.dark
                      : AppTheme.light,
                  home: Directionality(
                    textDirection: direction,
                    child: SupplierLocaleScope(
                      languageCode: direction == TextDirection.rtl
                          ? 'ar'
                          : 'en',
                      child: const Scaffold(
                        body: SupplierIncomingRequestsPage(),
                      ),
                    ),
                  ),
                ),
              ),
            );
            await tester.pumpAndSettle();

            final firstRowIcon = tester.getTopLeft(
              find.byIcon(Icons.priority_high_rounded),
            );
            final firstRowSecondIcon = tester.getTopLeft(
              find.byIcon(Icons.hourglass_top_rounded),
            );
            final secondRowIcon = tester.getTopLeft(
              find.byIcon(Icons.local_shipping_outlined),
            );
            final secondRowSecondIcon = tester.getTopLeft(
              find.byIcon(Icons.admin_panel_settings_outlined),
            );

            expect(
              (firstRowIcon.dx - firstRowSecondIcon.dx).abs(),
              greaterThan(40),
              reason: 'summary cards should occupy two columns at $width px',
            );
            expect(
              secondRowIcon.dy - firstRowIcon.dy,
              greaterThan(40),
              reason: 'summary cards should occupy two rows at $width px',
            );
            expect(
              secondRowSecondIcon.dy - firstRowSecondIcon.dy,
              greaterThan(40),
            );
            double cardHeight(IconData icon) {
              final heights = find
                  .ancestor(
                    of: find.byIcon(icon),
                    matching: find.byType(Container),
                  )
                  .evaluate()
                  .map(
                    (element) =>
                        (element.renderObject! as RenderBox).size.height,
                  )
                  .where((height) => height > 50)
                  .toList();
              return heights.first;
            }

            final heights = [
              cardHeight(Icons.priority_high_rounded),
              cardHeight(Icons.hourglass_top_rounded),
              cardHeight(Icons.local_shipping_outlined),
              cardHeight(Icons.admin_panel_settings_outlined),
            ];
            expect(
              heights.every((height) => (height - heights.first).abs() < 0.1),
              isTrue,
              reason: 'summary cards should have equal heights at $width px',
            );
            expect(tester.takeException(), isNull);
          }
        }
      }
    },
  );
}
