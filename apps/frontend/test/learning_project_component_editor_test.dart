import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/learning_hub/domain/models/learning_project_draft_component.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/learning_project_component_editor.dart';

void main() {
  group('LearningProjectComponentEditor', () {
    testWidgets('adds and removes component cards', (tester) async {
      var components = [LearningProjectDraftComponent.empty()];

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: StatefulBuilder(
                builder: (context, setState) {
                  return LearningProjectComponentEditor(
                  components: components,
                  materialCategories: const [],
                  onChanged: (next) => setState(() => components = next),
                  onAdd: () => setState(
                    () => components = [
                      ...components,
                      LearningProjectDraftComponent.empty(),
                    ],
                  ),
                  onRemove: (index) => setState(() {
                    final next = [...components]..removeAt(index);
                    components = next;
                  }),
                  );
                },
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Add component'), findsOneWidget);
      await tester.tap(find.text('Add component'));
      await tester.pumpAndSettle();

      expect(components, hasLength(2));
      expect(find.byIcon(Icons.close_rounded), findsNWidgets(2));

      await tester.tap(find.byIcon(Icons.close_rounded).first);
      await tester.pumpAndSettle();

      expect(components, hasLength(1));
    });
  });
}
