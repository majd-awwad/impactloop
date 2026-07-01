import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/app/widgets/app_mobile_bottom_nav_bar.dart';

void main() {
  testWidgets('mobile navigation shell keeps routed page content visible', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(400, 800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: AppMobileNavigationShell(
            child: Scaffold(
              body: Center(child: Text('Home page body')),
            ),
          ),
        ),
      ),
    );

    await tester.pump();

    expect(find.text('Home page body'), findsOneWidget);
    expect(find.byType(AppMobileBottomNavBar), findsOneWidget);
    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Materials'), findsOneWidget);
    expect(find.text('Learning'), findsOneWidget);
    expect(find.text('Reservations'), findsOneWidget);
    expect(find.text('Profile'), findsOneWidget);
    expect(
      tester.getSize(find.byType(AppMobileBottomNavBar)).height,
      lessThan(120),
    );
    expect(tester.takeException(), isNull);
  });
}
