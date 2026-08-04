import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_project.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build_material_link.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/project_build_material_linking.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/shared/models/localized_text.dart';

const _candidate = BuildMaterialCandidate(
  id: 'material-1',
  title: 'Wheels',
  categoryNameEn: 'Mobility',
  condition: 'GOOD',
  status: 'AVAILABLE',
  isFree: true,
  currency: 'NIS',
  supplierName: 'Supplier',
  city: 'Ramallah',
  pickupAllowed: true,
  deliveryAllowed: false,
  matchHints: ['Matches component type'],
);

const _component = ProjectRequiredComponentItem(
  id: 'component-1',
  name: LocalizedText(en: 'Wheels', ar: 'عجلات'),
  materialType: 'Wheels',
  quantity: 4,
  unit: 'pieces',
  isRequired: true,
  canBeSubstituted: false,
);

ProjectBuildItem _buildItem({LinkedMaterialSummary? linkedMaterial}) {
  return ProjectBuildItem(
    id: 'item-1',
    requiredComponentId: 'component-1',
    status: ProjectBuildItemStatus.missing,
    component: _component,
    isReadyForBuild: false,
    readinessLabel: 'Still missing',
    linkedMaterial: linkedMaterial,
  );
}

ProjectBuild _linkedBuild() {
  return ProjectBuild(
    id: 'build-1',
    projectId: 'project-1',
    status: ProjectBuildStatus.inProgress,
    project: const ProjectBuildProject(
      id: 'project-1',
      title: 'Test project',
      shortDescription: 'Short',
    ),
    progress: const ProjectBuildProgress(total: 1, ready: 0, percent: 0),
    materialReadiness: const ProjectBuildMaterialReadiness(
      ready: 0,
      linked: 1,
      reserved: 0,
      missing: 0,
      total: 1,
    ),
    stepProgress: const ProjectBuildStepProgress(
      completed: 0,
      total: 1,
      percent: 0,
      steps: [],
    ),
    items: [
      _buildItem(
        linkedMaterial: const LinkedMaterialSummary(
          id: 'material-1',
          title: 'Wheels',
          categoryNameEn: 'Mobility',
          condition: 'GOOD',
          status: 'AVAILABLE',
          isPubliclyAvailable: true,
          isFree: true,
          currency: 'NIS',
          supplierName: 'Supplier',
          city: 'Ramallah',
          pickupAllowed: true,
          deliveryAllowed: false,
        ),
      ),
    ],
  );
}

Widget _sheetHarness({
  required Future<ProjectBuild> Function(String materialId) onLinkMaterial,
  Locale locale = const Locale('en'),
}) {
  return MaterialApp(
    locale: locale,
    supportedLocales: const [Locale('en'), Locale('ar')],
    localizationsDelegates: const [
      AppLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    theme: AppTheme.lightFor(locale.languageCode),
    home: Scaffold(
      body: ProjectBuildMaterialCandidatesSheet(
        projectId: 'project-1',
        item: _buildItem(),
        onLoadCandidates: () async => const BuildMaterialCandidatesResult(
          itemId: 'item-1',
          componentId: 'component-1',
          searchTerm: 'Wheels',
          items: [_candidate],
        ),
        onLinkMaterial: onLinkMaterial,
      ),
    ),
  );
}

void main() {
  testWidgets('failed insufficient link keeps sheet open without Selected state', (
    tester,
  ) async {
    var linkAttempts = 0;

    await tester.pumpWidget(
      _sheetHarness(
        onLinkMaterial: (_) async {
          linkAttempts++;
          throw const ApiException(
            message: 'Insufficient quantity to link this material.',
            code: 'INSUFFICIENT_QUANTITY',
            statusCode: 400,
            details: {
              'messageEn': '2 available, 4 required',
              'messageAr': 'المتوفر 2، المطلوب 4',
              'availableQuantity': 2,
              'requiredQuantity': 4,
            },
          );
        },
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Link to component'), findsOneWidget);
    expect(find.text('Selected'), findsNothing);

    await tester.tap(find.text('Link to component'));
    await tester.pump();
    await tester.pumpAndSettle();

    expect(linkAttempts, 1);
    expect(
      find.text('Insufficient quantity\n2 available, 4 required'),
      findsOneWidget,
    );
    expect(find.text('Selected'), findsNothing);
    expect(find.text('Link to component'), findsOneWidget);
  });

  testWidgets('subsequent valid material link succeeds after insufficient rejection', (
    tester,
  ) async {
    var linkAttempts = 0;
  ProjectBuild? poppedBuild;

    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('en'),
        supportedLocales: const [Locale('en'), Locale('ar')],
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        theme: AppTheme.lightFor('en'),
        home: Builder(
          builder: (context) {
            return Scaffold(
              body: FilledButton(
                onPressed: () async {
                  final build = await ProjectBuildMaterialCandidatesSheet.show(
                    context,
                    projectId: 'project-1',
                    item: _buildItem(),
                    onLoadCandidates: () async =>
                        const BuildMaterialCandidatesResult(
                          itemId: 'item-1',
                          componentId: 'component-1',
                          searchTerm: 'Wheels',
                          items: [_candidate],
                        ),
                    onLinkMaterial: (materialId) async {
                      linkAttempts++;
                      if (linkAttempts == 1) {
                        throw const ApiException(
                          message: 'Insufficient quantity to link this material.',
                          code: 'INSUFFICIENT_QUANTITY',
                          statusCode: 400,
                          details: {
                            'messageEn': '2 available, 4 required',
                            'messageAr': 'المتوفر 2، المطلوب 4',
                            'availableQuantity': 2,
                            'requiredQuantity': 4,
                          },
                        );
                      }

                      return _linkedBuild();
                    },
                  );
                  poppedBuild = build;
                },
                child: const Text('Open candidates'),
              ),
            );
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Open candidates'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Link to component'));
    await tester.pump();
    await tester.pumpAndSettle();

    expect(linkAttempts, 1);
    expect(poppedBuild, isNull);
    expect(find.text('Link to component'), findsOneWidget);

    await tester.tap(find.text('Link to component'));
    await tester.pump();
    await tester.pumpAndSettle();

    expect(linkAttempts, 2);
    expect(poppedBuild, isNotNull);
    expect(poppedBuild!.items.single.linkedMaterial?.id, 'material-1');
  });

  testWidgets('Arabic insufficient quantity snackbar uses localized copy', (
    tester,
  ) async {
    await tester.pumpWidget(
      _sheetHarness(
        locale: const Locale('ar'),
        onLinkMaterial: (_) async {
          throw const ApiException(
            message: 'Insufficient quantity to link this material.',
            code: 'INSUFFICIENT_QUANTITY',
            statusCode: 400,
            details: {
              'messageEn': '2 available, 4 required',
              'messageAr': 'المتوفر 2، المطلوب 4',
              'availableQuantity': 2,
              'requiredQuantity': 4,
            },
          );
        },
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Link to component'));
    await tester.pump();
    await tester.pumpAndSettle();

    expect(
      find.text('الكمية غير كافية\nالمتوفر 2، المطلوب 4'),
      findsOneWidget,
    );
  });
}
