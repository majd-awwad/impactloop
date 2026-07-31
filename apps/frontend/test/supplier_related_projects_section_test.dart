import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/supplier_portal/data/models/supplier_related_projects.dart';
import 'package:frontend/features/supplier_portal/presentation/theme/supplier_locale_scope.dart';
import 'package:frontend/features/supplier_portal/presentation/widgets/materials/supplier_related_projects_section.dart';

void main() {
  group('SupplierRelatedProjectsSectionContent', () {
    testWidgets('shows empty-state copy when no matches', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const SupplierRelatedProjectsSectionContent(
            result: SupplierRelatedProjectsResult(
              materialId: 'mat-1',
              relatedProjectCount: 0,
              items: [],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Related Projects'), findsOneWidget);
      expect(
        find.text(
          'No Learning Hub projects currently match this material.',
        ),
        findsOneWidget,
      );
      expect(find.textContaining('Project impact'), findsNothing);
    });

    testWidgets('shows count summary and project previews', (tester) async {
      final tapped = <String>[];
      await tester.pumpWidget(
        _wrap(
          SupplierRelatedProjectsSectionContent(
            result: SupplierRelatedProjectsResult(
              materialId: 'mat-1',
              relatedProjectCount: 2,
              items: const [
                SupplierRelatedProjectItem(
                  projectId: 'proj-1',
                  title: 'Solar charger kit',
                  coverImageUrl: null,
                  difficulty: 'BEGINNER',
                  matchedComponentId: 'comp-1',
                  matchedComponentName: 'Arduino Uno board',
                  matchReasonCode: 'EXACT_NAME',
                  rankingScore: 670,
                ),
                SupplierRelatedProjectItem(
                  projectId: 'proj-2',
                  title: 'LED badge',
                  coverImageUrl: null,
                  difficulty: 'BEGINNER',
                  matchedComponentId: 'comp-2',
                  matchedComponentName: 'LED',
                  matchReasonCode: 'CATEGORY_MATCH',
                  rankingScore: 150,
                ),
              ],
            ),
            onProjectTap: tapped.add,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.text('This material can be used in 2 projects.'),
        findsOneWidget,
      );
      expect(find.text('Solar charger kit'), findsOneWidget);
      expect(find.text('Exact name match'), findsOneWidget);
      expect(find.textContaining('Arduino Uno board'), findsOneWidget);

      await tester.tap(find.text('Solar charger kit'));
      await tester.pumpAndSettle();
      expect(tapped, ['proj-1']);
    });

    testWidgets('shows Arabic summary and RTL direction', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const SupplierRelatedProjectsSectionContent(
            result: SupplierRelatedProjectsResult(
              materialId: 'mat-1',
              relatedProjectCount: 1,
              items: [
                SupplierRelatedProjectItem(
                  projectId: 'proj-1',
                  title: 'مشروع شمسي',
                  coverImageUrl: null,
                  difficulty: 'BEGINNER',
                  matchedComponentId: 'comp-1',
                  matchedComponentName: 'أردوينو',
                  matchReasonCode: 'EXACT_NAME',
                  rankingScore: 400,
                ),
              ],
            ),
          ),
          languageCode: 'ar',
          textDirection: TextDirection.rtl,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('المشاريع ذات الصلة'), findsOneWidget);
      expect(
        find.text('يمكن استخدام هذه المادة في مشروع واحد.'),
        findsOneWidget,
      );
      expect(find.text('تطابق تام للاسم'), findsOneWidget);

      final rtlScopes = find.byWidgetPredicate(
        (widget) =>
            widget is Directionality &&
            widget.textDirection == TextDirection.rtl,
      );
      expect(rtlScopes, findsWidgets);
    });

    testWidgets('uses image fallback when cover is missing', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const SupplierRelatedProjectsSectionContent(
            result: SupplierRelatedProjectsResult(
              materialId: 'mat-1',
              relatedProjectCount: 1,
              items: [
                SupplierRelatedProjectItem(
                  projectId: 'proj-1',
                  title: 'Fallback project',
                  coverImageUrl: null,
                  difficulty: 'BEGINNER',
                  matchedComponentId: 'comp-1',
                  matchedComponentName: 'Board',
                  matchReasonCode: 'NAME_MATCH',
                  rankingScore: 280,
                ),
              ],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.school_outlined), findsOneWidget);
      expect(find.byType(Image), findsNothing);
    });
  });

  test('parses related projects json', () {
    final result = SupplierRelatedProjectsResult.fromJson({
      'materialId': 'mat-9',
      'relatedProjectCount': 1,
      'items': [
        {
          'projectId': 'p1',
          'title': 'Title',
          'coverImageUrl': null,
          'difficulty': 'ADVANCED',
          'matchedComponentId': 'c1',
          'matchedComponentName': 'Motor',
          'matchReasonCode': 'MATERIAL_TYPE_MATCH',
          'rankingScore': 120,
        },
      ],
    });

    expect(result.materialId, 'mat-9');
    expect(result.relatedProjectCount, 1);
    expect(result.items.single.matchReasonCode, 'MATERIAL_TYPE_MATCH');
  });
}

Widget _wrap(
  Widget child, {
  String languageCode = 'en',
  TextDirection textDirection = TextDirection.ltr,
}) {
  return MaterialApp(
    home: Directionality(
      textDirection: textDirection,
      child: SupplierLocaleScope(
        languageCode: languageCode,
        child: Scaffold(
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: child,
          ),
        ),
      ),
    ),
  );
}
