import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_project.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/build_journey/build_prepare_phase.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/build_journey/build_prepare_material_card.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/build_materials/build_project_materials_section.dart';
import 'package:frontend/l10n/app_localizations.dart';

ProjectRequiredComponentItem _component(String id, String name) {
  return ProjectRequiredComponentItem(
    id: id,
    name: LocalizedText(en: name, ar: name),
    materialType: 'Electronics',
    quantity: 1,
    unit: 'piece',
    isRequired: true,
    canBeSubstituted: false,
  );
}

LinkedMaterialSummary _material(String id, {String? imageUrl}) {
  return LinkedMaterialSummary(
    id: id,
    title: id,
    categoryNameEn: 'Electronics',
    condition: 'GOOD',
    status: 'AVAILABLE',
    isPubliclyAvailable: true,
    isFree: true,
    currency: 'NIS',
    supplierName: 'Supplier',
    city: 'Ramallah',
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrl: imageUrl,
  );
}

ProjectBuildItem _item({
  required String id,
  required String name,
  ProjectBuildItemStatus status = ProjectBuildItemStatus.missing,
  bool isReadyForBuild = false,
  LinkedMaterialSummary? linkedMaterial,
  LinkedReservationSummary? linkedReservation,
  ProjectBuildQuantityAllocation? quantityAllocation,
  String? acquisitionState,
  String? allocationResult,
}) {
  return ProjectBuildItem(
    id: id,
    requiredComponentId: id,
    status: status,
    component: _component(id, name),
    isReadyForBuild: isReadyForBuild,
    readinessLabel: isReadyForBuild ? 'Ready' : 'Still missing',
    linkedMaterial: linkedMaterial,
    linkedReservation: linkedReservation,
    quantityAllocation: quantityAllocation,
    acquisitionState: acquisitionState,
    allocationResult: allocationResult,
  );
}

ProjectBuild _build(List<ProjectBuildItem> items) {
  final ready = items.where((item) => item.isReadyForBuild).length;
  return ProjectBuild(
    id: 'build-1',
    projectId: 'project-1',
    status: ProjectBuildStatus.inProgress,
    project: const ProjectBuildProject(
      id: 'project-1',
      title: 'Line Follower',
      shortDescription: 'Demo',
    ),
    progress: ProjectBuildProgress(
      total: items.length,
      ready: ready,
      percent: items.isEmpty ? 0 : ((ready / items.length) * 100).round(),
    ),
    materialReadiness: ProjectBuildMaterialReadiness(
      ready: ready,
      linked: items.where((item) => item.linkedMaterial != null).length,
      reserved: items.where((item) => item.linkedReservation != null).length,
      missing: items.length - ready,
      total: items.length,
    ),
    stepProgress: const ProjectBuildStepProgress(
      completed: 0,
      total: 4,
      percent: 0,
      steps: [],
    ),
    items: items,
  );
}

Widget _harness({required Widget child, Locale locale = const Locale('ar')}) {
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
    home: Scaffold(body: SingleChildScrollView(child: child)),
  );
}

BuildPreparePhase _phase(
  ProjectBuild build, {
  bool isEditingLocked = false,
  VoidCallback? onStartBuilding,
  void Function(ProjectBuildItem item)? onFindMaterials,
  void Function(ProjectBuildItem item)? onRequestMaterial,
  void Function(ProjectBuildItem item)? onShowMaterialCandidates,
  void Function(ProjectBuildItem item)? onUnlinkMaterial,
  void Function(ProjectBuildItem item)? onViewLinkedMaterial,
  void Function(ProjectBuildItem item)? onReserveLinkedMaterial,
  void Function(ProjectBuildItem item)? onViewReservation,
  Future<void> Function(
    ProjectBuildItem item, {
    required ProjectBuildItemStatus status,
    String? learnerNote,
  })?
  onStatusChanged,
}) {
  return BuildPreparePhase(
    projectId: 'project-1',
    buildRecord: build,
    updatingItemIds: const {},
    isEditingLocked: isEditingLocked,
    onStartBuilding: onStartBuilding ?? () {},
    onStatusChanged:
        onStatusChanged ?? (item, {required status, learnerNote}) async {},
    onEditNote: (_) {},
    onFindMaterials: onFindMaterials ?? (_) {},
    onRequestMaterial: onRequestMaterial ?? (_) {},
    onShowMaterialCandidates: onShowMaterialCandidates ?? (_) {},
    onUnlinkMaterial: onUnlinkMaterial ?? (_) {},
    onViewLinkedMaterial: onViewLinkedMaterial ?? (_) {},
    onReserveLinkedMaterial: onReserveLinkedMaterial ?? (_) {},
    onViewReservation: onViewReservation ?? (_) {},
  );
}

void main() {
  testWidgets('PREPARE does not render reserved or ready items as missing', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final build = _build([
      _item(
        id: 'reserved',
        name: 'Arduino Uno',
        acquisitionState: 'missing',
        linkedMaterial: _material('material-1'),
        linkedReservation: const LinkedReservationSummary(
          id: 'reservation-1',
          status: 'ACCEPTED',
          materialId: 'material-1',
          needsAction: false,
          statusLabel: 'Accepted',
        ),
      ),
      _item(
        id: 'available',
        name: 'A4988 Stepper Driver',
        status: ProjectBuildItemStatus.available,
      ),
      _item(
        id: 'qty',
        name: 'Raspberry Pi Camera',
        acquisitionState: 'selected',
        allocationResult: 'insufficient_quantity',
        linkedMaterial: _material('material-2'),
        quantityAllocation: const ProjectBuildQuantityAllocation(
          outcome: 'insufficient_quantity',
          requiredQuantity: 3,
          requiredUnit: 'piece',
          availableQuantity: 1,
        ),
      ),
      _item(
        id: 'owned',
        name: 'IR Sensor',
        status: ProjectBuildItemStatus.alreadyOwned,
        isReadyForBuild: true,
        acquisitionState: 'already_owned',
      ),
      _item(id: 'missing', name: 'Linear Rails'),
    ]);

    await tester.pumpWidget(_harness(child: _phase(build)));

    expect(find.text('لم يتم توفيره بعد'), findsNothing);
    expect(find.text('العثور على مادة'), findsOneWidget);
    expect(find.text('العثور على مادة مطابقة'), findsNothing);
    expect(find.textContaining('بانتظار اكتمال الاستلام'), findsOneWidget);
    expect(find.textContaining('تم ربط هذا المكوّن بحجزك'), findsNothing);
    expect(find.text('عرض الحجز'), findsWidgets);
    expect(find.text('وجدنا مواد قد تناسب هذا المكوّن'), findsOneWidget);
    expect(find.text('عرض الخيارات'), findsOneWidget);
    expect(find.textContaining('الكمية غير كافية'), findsOneWidget);
    expect(find.textContaining('المتوفر 1، المطلوب 3'), findsOneWidget);
    expect(find.text('لم تختر مادة لهذا المكوّن بعد'), findsOneWidget);
    expect(find.text('لم يتم اختيار مادة لهذا المكوّن بعد'), findsNothing);
    expect(find.text('تحتاج اختيار · 3'), findsOneWidget);
    expect(find.text('قيد التجهيز · 1'), findsOneWidget);
    expect(find.textContaining('تحتاج إكمال'), findsNothing);
    expect(find.text('لدي هذا المكوّن'), findsWidgets);
    expect(find.textContaining('1 قطعة'), findsWidgets);
    expect(find.text('ابدأ البناء'), findsNothing);
    expect(find.text('عرض كل المواد المطلوبة'), findsNothing);
    expect(find.byType(BuildProjectMaterialsSection), findsNothing);
    expect(find.byType(BuildPrepareMaterialCard), findsNWidgets(4));
  });

  testWidgets(
    'PREPARE keeps a single phase-level CTA when all materials are ready',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final build = _build([
        _item(
          id: 'owned',
          name: 'IR Sensor',
          status: ProjectBuildItemStatus.alreadyOwned,
          isReadyForBuild: true,
          acquisitionState: 'already_owned',
        ),
      ]);

      await tester.pumpWidget(_harness(child: _phase(build)));

      expect(find.byType(FilledButton), findsOneWidget);
      expect(find.text('ابدأ البناء'), findsOneWidget);
      expect(find.textContaining('متوفر لديك'), findsOneWidget);
    },
  );

  testWidgets('PREPARE expands extra unresolved cards with the same design', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final build = _build([
      for (var i = 1; i <= 5; i++) _item(id: 'missing-$i', name: 'Part $i'),
    ]);

    await tester.pumpWidget(_harness(child: _phase(build)));

    expect(find.byType(BuildPrepareMaterialCard), findsNWidgets(3));
    expect(find.text('Part 4'), findsNothing);
    expect(find.text('عرض مادتين أخريين'), findsOneWidget);

    await tester.ensureVisible(find.text('عرض مادتين أخريين'));
    await tester.tap(find.text('عرض مادتين أخريين'));
    await tester.pumpAndSettle();

    expect(find.byType(BuildPrepareMaterialCard), findsNWidgets(5));
    expect(find.text('Part 4'), findsOneWidget);
    expect(find.byType(BuildProjectMaterialsSection), findsNothing);
  });

  testWidgets('PREPARE ready expansion uses a single جاهزة heading', (
    tester,
  ) async {
    _setPhoneViewport(tester, const Size(390, 844));

    final build = _build([
      _item(id: 'missing', name: 'Linear Rails'),
      for (var i = 1; i <= 4; i++)
        _item(
          id: 'ready-$i',
          name: 'Ready $i',
          status: ProjectBuildItemStatus.alreadyOwned,
          isReadyForBuild: true,
          acquisitionState: 'already_owned',
        ),
    ]);

    await tester.pumpWidget(_harness(child: _phase(build)));

    expect(find.text('جاهزة · 4'), findsOneWidget);
    expect(find.text('4 مواد جاهزة'), findsNothing);
    expect(find.text('Ready 1'), findsNothing);

    await tester.ensureVisible(find.text('عرض المواد الجاهزة'));
    await tester.tap(find.text('عرض المواد الجاهزة'));
    await tester.pumpAndSettle();

    expect(find.text('جاهزة · 4'), findsOneWidget);
    expect(find.text('4 مواد جاهزة'), findsNothing);
    expect(find.text('Ready 1'), findsOneWidget);
    expect(find.text('عرض التفاصيل'), findsNothing);
  });

  testWidgets('PREPARE hides Start building when editing is locked', (
    tester,
  ) async {
    _setPhoneViewport(tester, const Size(390, 844));

    final build = _build([
      _item(
        id: 'owned',
        name: 'IR Sensor',
        status: ProjectBuildItemStatus.alreadyOwned,
        isReadyForBuild: true,
        acquisitionState: 'already_owned',
      ),
    ]);

    await tester.pumpWidget(
      _harness(child: _phase(build, isEditingLocked: true)),
    );

    expect(find.text('ابدأ البناء'), findsNothing);
    expect(find.widgetWithText(FilledButton, 'ابدأ البناء'), findsNothing);
  });

  testWidgets('PREPARE footer uses learning-and-help, not view-details', (
    tester,
  ) async {
    _setPhoneViewport(tester, const Size(390, 844));

    await tester.pumpWidget(
      _harness(child: _phase(_build([_item(id: 'missing', name: 'Linear Rails')]))),
    );

    expect(find.text('التعلّم والمساعدة'), findsOneWidget);
    expect(find.text('عرض التفاصيل'), findsNothing);
  });

  testWidgets('PREPARE ready linked card shows عرض المادة', (tester) async {
    _setPhoneViewport(tester, const Size(390, 844));
    var viewed = 0;

    await tester.pumpWidget(
      _harness(
        child: _phase(
          _build([
            _item(
              id: 'owned',
              name: 'IR Sensor',
              status: ProjectBuildItemStatus.alreadyOwned,
              isReadyForBuild: true,
              acquisitionState: 'already_owned',
              linkedMaterial: _material('material-owned'),
            ),
          ]),
          onViewLinkedMaterial: (_) => viewed += 1,
        ),
      ),
    );

    expect(find.text('عرض المادة'), findsOneWidget);
    expect(find.text('عرض التفاصيل'), findsNothing);
    await tester.tap(find.text('عرض المادة'));
    await tester.pumpAndSettle();
    expect(viewed, 1);
  });

  testWidgets('PREPARE ready unlinked card keeps change-status in the more menu', (
    tester,
  ) async {
    _setPhoneViewport(tester, const Size(390, 844));

    await tester.pumpWidget(
      _harness(
        child: _phase(
          _build([
            _item(
              id: 'owned',
              name: 'IR Sensor',
              status: ProjectBuildItemStatus.alreadyOwned,
              isReadyForBuild: true,
              acquisitionState: 'already_owned',
            ),
          ]),
        ),
      ),
    );

    expect(find.byIcon(Icons.more_horiz_rounded), findsOneWidget);
    await tester.tap(find.byIcon(Icons.more_horiz_rounded));
    await tester.pumpAndSettle();
    expect(find.text('تغيير الحالة'), findsOneWidget);
    expect(find.text('العثور على مادة مطابقة'), findsNothing);
    expect(find.text('احجز هذه المادة'), findsNothing);
  });

  testWidgets('PREPARE card taps dispatch the wired action callbacks', (
    tester,
  ) async {
    _setPhoneViewport(tester, const Size(390, 1200));
    final shownCandidates = <String>[];
    final owned = <String>[];
    final reserved = <String>[];
    final viewedReservation = <String>[];
    final viewedMaterial = <String>[];

    final build = _build([
      _item(id: 'missing', name: 'Linear Rails'),
      _item(
        id: 'selected',
        name: 'Arduino Uno',
        acquisitionState: 'selected',
        linkedMaterial: _material('material-selected'),
      ),
      _item(
        id: 'reserved',
        name: 'Servo Motor',
        acquisitionState: 'reserved',
        linkedMaterial: _material('material-reserved'),
        linkedReservation: const LinkedReservationSummary(
          id: 'reservation-1',
          status: 'ACCEPTED',
          materialId: 'material-reserved',
          needsAction: false,
          statusLabel: 'Accepted',
        ),
      ),
      _item(
        id: 'qty',
        name: 'Raspberry Pi Camera',
        acquisitionState: 'selected',
        allocationResult: 'insufficient_quantity',
        linkedMaterial: _material('material-qty'),
        quantityAllocation: const ProjectBuildQuantityAllocation(
          outcome: 'insufficient_quantity',
          requiredQuantity: 3,
          requiredUnit: 'piece',
          availableQuantity: 1,
        ),
      ),
      _item(
        id: 'unit',
        name: 'Power Supply',
        acquisitionState: 'selected',
        allocationResult: 'incompatible_unit',
        linkedMaterial: _material('material-unit'),
        quantityAllocation: const ProjectBuildQuantityAllocation(
          outcome: 'incompatible_unit',
          requiredQuantity: 1,
          requiredUnit: 'piece',
          isQuantityReady: false,
        ),
      ),
    ]);

    await tester.pumpWidget(
      _harness(
        child: _phase(
          build,
          onShowMaterialCandidates: (item) => shownCandidates.add(item.id),
          onReserveLinkedMaterial: (item) => reserved.add(item.id),
          onViewReservation: (item) => viewedReservation.add(item.id),
          onViewLinkedMaterial: (item) => viewedMaterial.add(item.id),
          onStatusChanged: (item, {required status, learnerNote}) async {
            if (status == ProjectBuildItemStatus.alreadyOwned) {
              owned.add(item.id);
            }
          },
        ),
      ),
    );

    await tester.ensureVisible(find.text('العثور على مادة'));
    await tester.tap(find.text('العثور على مادة'));
    await tester.pumpAndSettle();
    expect(shownCandidates, ['missing']);

    await tester.ensureVisible(find.text('لدي هذا المكوّن').first);
    await tester.tap(find.text('لدي هذا المكوّن').first);
    await tester.pumpAndSettle();
    expect(owned, ['missing']);

    await tester.ensureVisible(find.text('احجز المادة'));
    await tester.tap(find.text('احجز المادة'));
    await tester.pumpAndSettle();
    expect(reserved, ['selected']);

    await tester.ensureVisible(find.text('عرض المادة'));
    await tester.tap(find.text('عرض المادة'));
    await tester.pumpAndSettle();
    expect(viewedMaterial, ['selected']);

    await tester.ensureVisible(find.text('عرض الحجز'));
    await tester.tap(find.text('عرض الحجز'));
    await tester.pumpAndSettle();
    expect(viewedReservation, ['reserved']);

    await tester.ensureVisible(find.text('حل المشكلة'));
    await tester.tap(find.text('حل المشكلة'));
    await tester.pumpAndSettle();
    expect(shownCandidates, ['missing', 'qty']);

    await tester.ensureVisible(find.text('اختيار مادة أخرى'));
    await tester.tap(find.text('اختيار مادة أخرى'));
    await tester.pumpAndSettle();
    expect(shownCandidates, ['missing', 'qty', 'unit']);
  });

  testWidgets('PREPARE missing menu dispatches request and alternative', (
    tester,
  ) async {
    _setPhoneViewport(tester, const Size(390, 844));
    final requested = <String>[];
    final alternatives = <String>[];

    await tester.pumpWidget(
      _harness(
        child: _phase(
          _build([_item(id: 'missing', name: 'Linear Rails')]),
          onRequestMaterial: (item) => requested.add(item.id),
          onStatusChanged: (item, {required status, learnerNote}) async {
            if (status == ProjectBuildItemStatus.alternative) {
              alternatives.add(item.id);
            }
          },
        ),
      ),
    );

    expect(find.byIcon(Icons.more_horiz_rounded), findsOneWidget);
    await tester.ensureVisible(find.byIcon(Icons.more_horiz_rounded));
    await tester.tap(find.byIcon(Icons.more_horiz_rounded));
    await tester.pumpAndSettle();
    await tester.tap(find.text('طلب هذا المكوّن'));
    await tester.pumpAndSettle();
    expect(requested, ['missing']);

    await tester.ensureVisible(find.byIcon(Icons.more_horiz_rounded));
    await tester.tap(find.byIcon(Icons.more_horiz_rounded));
    await tester.pumpAndSettle();
    await tester.tap(find.text('استخدام بديل'));
    await tester.pumpAndSettle();
    expect(alternatives, ['missing']);
  });

  testWidgets('PREPARE cards do not overflow at 360px RTL', (tester) async {
    _setPhoneViewport(tester, const Size(360, 800));
    final errors = <FlutterErrorDetails>[];
    final previous = FlutterError.onError;
    FlutterError.onError = (details) {
      errors.add(details);
      previous?.call(details);
    };
    addTearDown(() {
      FlutterError.onError = previous;
    });

    final build = _build([
      _item(id: 'a4988', name: 'A4988 Stepper Driver'),
      _item(
        id: 'long',
        name:
            'High-Precision Adjustable Aluminum Extrusion Bracket Assembly Kit',
      ),
      _item(
        id: 'selected',
        name: 'Arduino Uno',
        acquisitionState: 'selected',
        linkedMaterial: _material('material-selected'),
      ),
      _item(
        id: 'reserved',
        name: 'Servo Motor',
        acquisitionState: 'reserved',
        linkedMaterial: _material('material-reserved'),
        linkedReservation: const LinkedReservationSummary(
          id: 'reservation-1',
          status: 'ACCEPTED',
          materialId: 'material-reserved',
          needsAction: false,
          statusLabel: 'Accepted',
        ),
      ),
      _item(
        id: 'ready',
        name: 'IR Sensor',
        status: ProjectBuildItemStatus.alreadyOwned,
        isReadyForBuild: true,
        acquisitionState: 'already_owned',
        linkedMaterial: _material('material-ready'),
      ),
      _item(
        id: 'unit',
        name: 'Power Supply Module',
        acquisitionState: 'selected',
        allocationResult: 'incompatible_unit',
        linkedMaterial: _material('material-unit'),
        quantityAllocation: const ProjectBuildQuantityAllocation(
          outcome: 'incompatible_unit',
          requiredQuantity: 1,
          requiredUnit: 'piece',
          isQuantityReady: false,
        ),
      ),
    ]);

    await tester.pumpWidget(_harness(child: _phase(build)));
    await tester.pump();

    await tester.ensureVisible(find.text('عرض المواد الجاهزة'));
    await tester.tap(find.text('عرض المواد الجاهزة'));
    await tester.pumpAndSettle();

    expect(find.text('A4988 Stepper Driver'), findsOneWidget);
    expect(
      find.text(
        'High-Precision Adjustable Aluminum Extrusion Bracket Assembly Kit',
      ),
      findsOneWidget,
    );
    expect(find.text('العثور على مادة'), findsWidgets);
    expect(find.text('لدي هذا المكوّن'), findsWidgets);
    expect(find.text('احجز المادة'), findsOneWidget);
    expect(find.text('أكمل الحجز لتصبح جاهزة للمشروع.'), findsOneWidget);
    expect(find.textContaining('تم اختيار مادة لهذا المكوّن'), findsNothing);
    expect(find.textContaining('1 قطعة'), findsWidgets);
    expect(find.text('مادة مختارة'), findsOneWidget);
    expect(find.text('قيد التجهيز'), findsWidgets);
    expect(find.text('جاهز'), findsOneWidget);
    expect(find.text('الوحدة غير متوافقة'), findsOneWidget);
    expect(find.text('اختيار مادة أخرى'), findsOneWidget);
    expect(tester.takeException(), isNull);
    expect(
      errors.where((details) {
        final text = '${details.exception}\n${details.summary}';
        return text.contains('RenderFlex') ||
            text.contains('overflowed') ||
            text.contains('OVERFLOWING');
      }),
      isEmpty,
    );
  });

  testWidgets(
    'PREPARE missing actions sit on one 360px RTL row with tap targets',
    (tester) async {
      _setPhoneViewport(tester, const Size(360, 800));
      final errors = <FlutterErrorDetails>[];
      final previous = FlutterError.onError;
      FlutterError.onError = (details) {
        errors.add(details);
        previous?.call(details);
      };
      addTearDown(() {
        FlutterError.onError = previous;
      });

      await tester.pumpWidget(
        _harness(
          child: _phase(
            _build([
              _item(id: 'a4988', name: 'A4988 Stepper Driver'),
              _item(
                id: 'long',
                name:
                    'High-Precision Adjustable Aluminum Extrusion Bracket Assembly Kit',
              ),
            ]),
          ),
        ),
      );

      final primary = find.text('العثور على مادة').first;
      final secondary = find.text('لدي هذا المكوّن').first;
      expect(find.text('العثور على مادة'), findsWidgets);
      expect(find.text('لدي هذا المكوّن'), findsWidgets);

      final primaryBox = tester.getRect(primary);
      final secondaryBox = tester.getRect(secondary);
      expect((primaryBox.center.dy - secondaryBox.center.dy).abs(), lessThan(8));

      final primaryButton = tester.getSize(
        find.ancestor(of: primary, matching: find.byType(FilledButton)).first,
      );
      final secondaryButton = tester.getSize(
        find.ancestor(of: secondary, matching: find.byType(OutlinedButton)).first,
      );
      expect(primaryButton.height, greaterThanOrEqualTo(44));
      expect(secondaryButton.height, greaterThanOrEqualTo(44));

      final cardSize = tester.getSize(
        find.byType(BuildPrepareMaterialCard).first,
      );
      expect(cardSize.height, lessThan(170));
      expect(cardSize.height, greaterThanOrEqualTo(120));
      expect(tester.takeException(), isNull);
      expect(
        errors.where((details) {
          final text = '${details.exception}\n${details.summary}';
          return text.contains('RenderFlex') ||
              text.contains('overflowed') ||
              text.contains('OVERFLOWING');
        }),
        isEmpty,
      );
    },
  );
}

void _setPhoneViewport(WidgetTester tester, Size size) {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
}
