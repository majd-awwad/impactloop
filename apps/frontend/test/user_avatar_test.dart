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
}
