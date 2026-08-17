import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_project.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/build_materials/build_material_candidate_card.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/project_build_material_linking.dart';
import 'package:frontend/l10n/app_localizations.dart';

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

    await tester.tap(find.text('ربط بالمكوّن'));
    await tester.pump();
    await tester.pumpAndSettle();

    expect(
      find.text('الكمية غير كافية\nالمتوفر 2، المطلوب 4'),
      findsOneWidget,
    );
  });

  testWidgets('compact sheet header and match reasons stay short', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    const crowded = BuildMaterialCandidate(
      id: 'material-2',
      title: 'NEMA17 High Torque Stepper Motor with Mounting Bracket',
      categoryNameEn: 'Electronics',
      condition: 'GOOD',
      status: 'AVAILABLE',
      isFree: false,
      price: 40,
      currency: 'NIS',
      supplierName: 'جمعية يد بيد للعمل التطوعي المجتمعي',
      city: 'طوباس',
      area: 'وسط المدينة',
      pickupAllowed: true,
      deliveryAllowed: true,
      matchHints: [
        'Strong match',
        'Name match',
        'Category match',
        'Keyword match',
        'Material type match',
        'Pickup available',
        'Delivery available',
      ],
    );

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
        home: const Scaffold(
          body: Align(
            alignment: Alignment.topCenter,
            child: BuildMaterialCandidateCard(
              candidate: crowded,
              isLinking: false,
              onLink: _noop,
              onView: _noop,
            ),
          ),
        ),
      ),
    );

    expect(find.text('Strong match'), findsOneWidget);
    expect(find.text('Name match'), findsOneWidget);
    expect(find.text('+5'), findsOneWidget);
    expect(find.text('Keyword match'), findsNothing);
    expect(find.text('Pickup available'), findsNothing);
    expect(find.text('Link to component'), findsOneWidget);
    expect(find.text('View material'), findsOneWidget);
    expect(tester.takeException(), isNull);
    expect(
      tester.getSize(find.byType(BuildMaterialCandidateCard)).height,
      inInclusiveRange(160, 250),
    );

    await tester.tap(find.text('+5'));
    await tester.pumpAndSettle();
    expect(find.text('Match reasons'), findsOneWidget);
    expect(find.text('Pickup available'), findsOneWidget);
  });

  testWidgets('Arabic sheet uses localized header copy', (tester) async {
    await tester.pumpWidget(
      _sheetHarness(
        locale: const Locale('ar'),
        onLinkMaterial: (_) async => _linkedBuild(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('أفضل تطابق'), findsOneWidget);
    expect(find.textContaining('مادة مطابقة'), findsOneWidget);
    expect(find.text('Possible options'), findsNothing);
    expect(find.text('Best matches'), findsNothing);
  });

  testWidgets('phone sheet keeps two compact candidates on screen', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    BuildMaterialCandidate candidate(int index) {
      return BuildMaterialCandidate(
        id: 'material-$index',
        title: 'NEMA17 Stepper Motor $index',
        categoryNameEn: 'Electronics',
        condition: 'GOOD',
        status: 'AVAILABLE',
        isFree: false,
        price: 40,
        currency: 'NIS',
        supplierName: 'يد بيد',
        city: 'طوباس',
        pickupAllowed: true,
        deliveryAllowed: true,
        matchHints: const [
          'Name match',
          'Category match',
          'Keyword match',
          'Pickup available',
        ],
      );
    }

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
        home: Scaffold(
          body: ProjectBuildMaterialCandidatesSheet(
            projectId: 'project-1',
            item: _buildItem(),
            onLoadCandidates: () async => BuildMaterialCandidatesResult(
              itemId: 'item-1',
              componentId: 'component-1',
              searchTerm: 'Stepper Motor',
              items: [candidate(0), candidate(1), candidate(2)],
            ),
            onLinkMaterial: (_) async => _linkedBuild(),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Best matches'), findsOneWidget);
    expect(find.textContaining('3 matching materials for'), findsOneWidget);
    expect(find.text('NEMA17 Stepper Motor 0'), findsOneWidget);
    expect(find.text('NEMA17 Stepper Motor 1'), findsOneWidget);
    expect(
      tester.getRect(find.text('NEMA17 Stepper Motor 1')).bottom,
      lessThan(844),
    );
    expect(find.text('Keyword match'), findsNothing);
    expect(find.text('+2'), findsWidgets);
  });

  testWidgets('empty candidate sheet does not pad unrelated results', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('ar'),
        supportedLocales: const [Locale('en'), Locale('ar')],
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        theme: AppTheme.lightFor('ar'),
        home: Scaffold(
          body: ProjectBuildMaterialCandidatesSheet(
            projectId: 'project-1',
            item: _buildItem(),
            onLoadCandidates: () async => const BuildMaterialCandidatesResult(
              itemId: 'item-1',
              componentId: 'component-1',
              searchTerm: 'A4988 Stepper Driver',
              items: [],
            ),
            onLinkMaterial: (_) async => _linkedBuild(),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('لم نجد مادة مطابقة حاليًا'), findsOneWidget);
    expect(find.textContaining('تصفّح جميع المواد'), findsOneWidget);
    expect(find.byType(BuildMaterialCandidateCard), findsNothing);
  });
}

void _noop() {}

