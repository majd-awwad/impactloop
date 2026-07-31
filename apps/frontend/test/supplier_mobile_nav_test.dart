import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/features/supplier_portal/presentation/shell/supplier_mobile_nav.dart';
import 'package:frontend/features/supplier_portal/presentation/shell/supplier_nav_config.dart';
import 'package:frontend/features/supplier_portal/presentation/theme/supplier_locale_scope.dart';

void main() {
  test('keeps grouped supplier destinations discoverable on mobile', () {
    expect(supplierMobileNavItems.map((item) => item.route).toList(), <String>[
      '/supplier',
      '/supplier/materials',
      '/supplier/materials/new',
      '/supplier/reservations',
    ]);
    expect(
      supplierMobileMoreNavItems.map((item) => item.route).toList(),
      <String>[
        '/supplier/pickup-schedule',
        '/supplier/material-requests',
        '/supplier/notifications',
        '/supplier/profile',
      ],
    );
  });

  test('selects More for every grouped supplier route', () {
    for (final route in <String>[
      '/supplier/pickup-schedule',
      '/supplier/material-requests',
      '/supplier/notifications',
      '/supplier/profile',
      '/supplier/profile/edit',
    ]) {
      expect(isSupplierMoreNavActive(route), isTrue, reason: route);
    }

    for (final route in <String>[
      '/supplier',
      '/supplier/materials',
      '/supplier/reservations',
    ]) {
      expect(isSupplierMoreNavActive(route), isFalse, reason: route);
    }
  });

  test('selects Home for the supplier overview redirect destination', () {
    expect(
      isSupplierMobileNavActive('/supplier/overview', supplierNavItems[0]),
      isTrue,
    );
    expect(
      isSupplierNavActive('/supplier/overview', supplierNavItems[0].route),
      isFalse,
    );
  });

  testWidgets(
    'renders compact mobile destinations in all supported phone modes',
    (tester) async {
      for (final width in <double>[360, 400, 412]) {
        for (final direction in <TextDirection>[
          TextDirection.ltr,
          TextDirection.rtl,
        ]) {
          for (final brightness in Brightness.values) {
            final isArabic = direction == TextDirection.rtl;
            final labels = isArabic
                ? <String>['الرئيسية', 'المواد', 'إضافة', 'الطلبات', 'المزيد']
                : <String>['Home', 'Materials', 'Add', 'Requests', 'More'];
            final moreLabels = isArabic
                ? <String>[
                    'جدول الاستلام',
                    'طلبات المواد من المتعلمين',
                    'الإشعارات',
                    'الملف الشخصي',
                  ]
                : <String>[
                    'Pickup Schedule',
                    'Learner Material Requests',
                    'Notifications',
                    'Profile',
                  ];

            await tester.binding.setSurfaceSize(Size(width, 800));
            await tester.pumpWidget(
              MaterialApp(
                theme: brightness == Brightness.dark
                    ? AppTheme.dark
                    : AppTheme.light,
                home: SupplierLocaleScope(
                  languageCode: isArabic ? 'ar' : 'en',
                  child: Directionality(
                    textDirection: direction,
                    child: Scaffold(
                      bottomNavigationBar: const SupplierMobileNav(
                        currentLocation: '/supplier',
                      ),
                    ),
                  ),
                ),
              ),
            );
            await tester.pumpAndSettle();

            expect(tester.takeException(), isNull);
            for (final label in labels) {
              expect(
                find.text(label),
                findsOneWidget,
                reason: '$width $direction $brightness',
              );
            }

            await tester.tap(find.text(labels.last));
            await tester.pumpAndSettle();
            for (final label in moreLabels) {
              expect(
                find.text(label),
                findsOneWidget,
                reason: '$width $direction $brightness',
              );
            }
            expect(tester.takeException(), isNull);

            Navigator.of(tester.element(find.text(moreLabels.first))).pop();
            await tester.pumpAndSettle();
            for (final label in moreLabels) {
              expect(
                find.text(label),
                findsNothing,
                reason: '$width $direction $brightness',
              );
            }
          }
        }
      }

      await tester.binding.setSurfaceSize(null);
    },
  );
}
