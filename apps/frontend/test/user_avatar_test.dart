import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/shared/widgets/user_avatar.dart';

void main() {
  testWidgets('UserAvatar shows network image when profileImageUrl is set', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: UserAvatar(
            displayName: 'Learner User',
            profileImageUrl: '/uploads/profiles/profile_test.webp',
            radius: 20,
          ),
        ),
      ),
    );

    expect(find.byType(Image), findsOneWidget);
    expect(find.text('L'), findsNothing);
  });

  testWidgets(
    'UserAvatar falls back to initial when profileImageUrl is empty',
    (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: UserAvatar(displayName: 'Learner User', radius: 20),
          ),
        ),
      );

      expect(find.byType(Image), findsNothing);
      expect(find.text('L'), findsOneWidget);
    },
  );

  testWidgets(
    'UserAvatar shows initials for DiceBear placeholder URLs without loading network image',
    (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: UserAvatar(
              displayName: 'Majd Learner',
              profileImageUrl:
                  'https://api.dicebear.com/9.x/initials/png?seed=Majd%20Learner',
              radius: 20,
            ),
          ),
        ),
      );

      expect(find.byType(Image), findsNothing);
      expect(find.text('M'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'UserAvatar falls back to initial when network image fails to load',
    (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: UserAvatar(
              displayName: 'Learner User',
              profileImageUrl: 'https://invalid.invalid/avatar.png',
              radius: 20,
            ),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(seconds: 2));

      expect(find.text('L'), findsOneWidget);
    },
  );
}
