import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/features/learning_hub/application/learning_hub_providers.dart';
import 'package:frontend/features/learning_hub/application/smart_build_plan_material_requests.dart';
import 'package:frontend/features/learning_hub/domain/learning_project_repository.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_project.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build_material_link.dart';
import 'package:frontend/features/learning_hub/domain/models/smart_build_plan.dart';
import 'package:frontend/features/learning_hub/presentation/pages/smart_build_plan_page.dart';
import 'package:frontend/l10n/l10n.dart';

void main() {
  group('Smart Build Plan browse/reserve flows', () {
    testWidgets('View Material does not call linkMaterial', (tester) async {
      final tracker = _FlowTracker();
      await _pumpFlowHarness(
        tester,
        tracker: tracker,
        materialDetailsBuilder: (context, state) => const _StubMaterialDetailsPage(
          mode: _StubMaterialDetailsMode.browse,
        ),
      );

      await tester.pumpAndSettle();
      expect(find.text('Suggested material'), findsOneWidget);

      await _tapLabel(tester, 'View material');
      await tester.pumpAndSettle();

      expect(tracker.linkMaterialCalls, 0);
      expect(find.byType(_StubMaterialDetailsPage), findsOneWidget);

      await _tapLabel(tester, 'Back');
      await tester.pumpAndSettle();

      expect(tracker.linkMaterialCalls, 0);
      expect(tracker.unlinkMaterialCalls, 0);
      expect(tracker.smartPlanFetchCount, 1);
      expect(find.text('Suggested material'), findsOneWidget);
      expect(find.text('Reserve'), findsOneWidget);
    });

    testWidgets('View Material back preserves PLANNED recommendation', (tester) async {
      final tracker = _FlowTracker();
      await _pumpFlowHarness(
        tester,
        tracker: tracker,
        materialDetailsBuilder: (context, state) => const _StubMaterialDetailsPage(
          mode: _StubMaterialDetailsMode.browse,
        ),
      );

      await tester.pumpAndSettle();
      await _tapLabel(tester, 'View material');
      await tester.pumpAndSettle();
      await _tapLabel(tester, 'Back');
      await tester.pumpAndSettle();

      expect(find.text('Recommended materials (1)'), findsOneWidget);
      expect(find.text('Arduino Uno'), findsOneWidget);
      expect(tracker.build.linkedMaterialIdFor('item-1'), isNull);
      expect(tracker.build.linkedReservationIdFor('item-1'), isNull);
    });

    testWidgets('Reserve cancel rolls back ghost material link', (tester) async {
      final tracker = _FlowTracker();
      await _pumpFlowHarness(
        tester,
        tracker: tracker,
        materialDetailsBuilder: (context, state) => const _StubMaterialDetailsPage(
          mode: _StubMaterialDetailsMode.reserveCancel,
        ),
      );

      await tester.pumpAndSettle();
      await _tapLabel(tester, 'Reserve');
      await tester.pumpAndSettle();

      expect(tracker.linkMaterialCalls, 1);
      expect(tracker.build.linkedMaterialIdFor('item-1'), 'material-1');
      expect(tracker.build.linkedReservationIdFor('item-1'), isNull);

      await _tapLabel(tester, 'Back');
      await tester.pumpAndSettle();

      expect(tracker.unlinkMaterialCalls, 1);
      expect(tracker.build.linkedMaterialIdFor('item-1'), isNull);
      expect(find.text('Suggested material'), findsOneWidget);
      expect(find.text('Reserve'), findsOneWidget);
    });

    testWidgets('Reserve failure rolls back ghost material link', (tester) async {
      final tracker = _FlowTracker(reservationFails: true);
      await _pumpFlowHarness(
        tester,
        tracker: tracker,
        materialDetailsBuilder: (context, state) => const _StubMaterialDetailsPage(
          mode: _StubMaterialDetailsMode.reserveFailure,
        ),
      );

      await tester.pumpAndSettle();
      await _tapLabel(tester, 'Reserve');
      await tester.pumpAndSettle();

      expect(find.text('Reservation failed'), findsOneWidget);
      await _tapLabel(tester, 'Back');
      await tester.pumpAndSettle();

      expect(tracker.unlinkMaterialCalls, 1);
      expect(tracker.build.linkedMaterialIdFor('item-1'), isNull);
      expect(find.text('Suggested material'), findsOneWidget);
    });

    testWidgets('Reserve success refreshes to IN_PROGRESS', (tester) async {
      final tracker = _FlowTracker();
      await _pumpFlowHarness(
        tester,
        tracker: tracker,
        materialDetailsBuilder: (context, state) => const _StubMaterialDetailsPage(
          mode: _StubMaterialDetailsMode.reserveSuccess,
        ),
      );

      await tester.pumpAndSettle();
      await _tapLabel(tester, 'Reserve');
      await tester.pumpAndSettle();
      await _tapLabel(tester, 'Confirm reservation');
      await tester.pumpAndSettle();

      expect(tracker.linkMaterialCalls, 1);
      expect(tracker.build.linkedReservationIdFor('item-1'), isNotNull);
      expect(find.text('In progress (1)'), findsOneWidget);
      expect(find.text('Suggested material'), findsNothing);
      expect(find.text('Reserve'), findsNothing);
    });
  });

  group('Smart Build Plan uncovered UX', () {
    testWidgets('shows platform availability copy for uncovered items', (tester) async {
      final tracker = _FlowTracker(
        planResult: _plannedAndUncoveredResult(),
      );
      await _pumpFlowHarness(tester, tracker: tracker);

      await tester.pumpAndSettle();

      expect(
        find.text('Not currently available on ImpactLoop'),
        findsOneWidget,
      );
      expect(find.text('Request this material'), findsOneWidget);
      expect(
        find.textContaining(
          "We couldn't find an eligible compatible material on ImpactLoop",
        ),
        findsOneWidget,
      );
    });

    testWidgets('shows active material request instead of duplicate CTA', (
      tester,
    ) async {
      final tracker = _FlowTracker(
        planResult: _plannedAndUncoveredResult(),
        openRequests: {
          'item-uncovered': 'request-1',
        },
      );
      await _pumpFlowHarness(tester, tracker: tracker);

      await tester.pumpAndSettle();

      expect(find.text('Request active'), findsOneWidget);
      expect(find.text('View request'), findsOneWidget);
      expect(find.text('Request this material'), findsNothing);
    });

    testWidgets('empty recommendation copy is accurate', (tester) async {
      final tracker = _FlowTracker(
        planResult: _uncoveredOnlyResult(),
      );
      await _pumpFlowHarness(tester, tracker: tracker);

      await tester.pumpAndSettle();

      expect(
        find.text('No new material recommendations right now'),
        findsOneWidget,
      );
      expect(
        find.text(
          'The remaining components do not currently have eligible materials available on ImpactLoop.',
        ),
        findsOneWidget,
      );
    });
  });
}

enum _StubMaterialDetailsMode {
  browse,
  reserveCancel,
  reserveFailure,
  reserveSuccess,
}

class _StubMaterialDetailsPage extends StatelessWidget {
  const _StubMaterialDetailsPage({required this.mode});

  final _StubMaterialDetailsMode mode;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Material details stub'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: Column(
        children: [
          if (mode == _StubMaterialDetailsMode.reserveFailure)
            const Text('Reservation failed'),
          if (mode == _StubMaterialDetailsMode.reserveSuccess)
            FilledButton(
              onPressed: () {
                final tracker = _FlowTrackerScope.of(context);
                final container = ProviderScope.containerOf(context);
                tracker.completeReservation();
                container.invalidate(projectBuildProvider('project-1'));
                container.invalidate(smartBuildPlanProvider('project-1'));
                context.go('/learning/project-1/build/smart-plan');
              },
              child: const Text('Confirm reservation'),
            ),
          TextButton(
            onPressed: () => context.pop(),
            child: const Text('Back'),
          ),
        ],
      ),
    );
  }
}

class _FlowTracker {
  _FlowTracker({
    SmartBuildPlanResult? planResult,
    this.reservationFails = false,
    Map<String, String>? openRequests,
  })  : planResult = planResult ?? _plannedOnlyResult(),
        openRequests = openRequests ?? const {},
        build = _MutableBuildState.initial();

  final SmartBuildPlanResult planResult;
  final bool reservationFails;
  final Map<String, String> openRequests;
  final _MutableBuildState build;

  int linkMaterialCalls = 0;
  int unlinkMaterialCalls = 0;
  int smartPlanFetchCount = 0;

  SmartBuildPlanResult nextPlanResult() {
    smartPlanFetchCount += 1;
    if (build.hasActiveReservationFor('item-1')) {
      return _inProgressResult();
    }
    return planResult;
  }

  void completeReservation() {
    build.setLinkedReservation('item-1', reservationId: 'reservation-1');
  }
}

class _MutableBuildState {
  _MutableBuildState({
    required this.linkedMaterialByItemId,
    required this.linkedReservationByItemId,
  });

  factory _MutableBuildState.initial() {
    return _MutableBuildState(
      linkedMaterialByItemId: {},
      linkedReservationByItemId: {},
    );
  }

  final Map<String, String> linkedMaterialByItemId;
  final Map<String, String> linkedReservationByItemId;

  String? linkedMaterialIdFor(String itemId) => linkedMaterialByItemId[itemId];

  String? linkedReservationIdFor(String itemId) =>
      linkedReservationByItemId[itemId];

  bool hasActiveReservationFor(String itemId) =>
      linkedReservationByItemId.containsKey(itemId);

  void linkMaterial(String itemId, String materialId) {
    linkedMaterialByItemId[itemId] = materialId;
  }

  void unlinkMaterial(String itemId) {
    linkedMaterialByItemId.remove(itemId);
    linkedReservationByItemId.remove(itemId);
  }

  void setLinkedReservation(String itemId, {required String reservationId}) {
    linkedReservationByItemId[itemId] = reservationId;
  }

  ProjectBuild toProjectBuild() {
    return ProjectBuild(
      id: 'build-1',
      projectId: 'project-1',
      status: ProjectBuildStatus.inProgress,
      project: const ProjectBuildProject(
        id: 'project-1',
        title: 'Test project',
        shortDescription: '',
      ),
      progress: const ProjectBuildProgress(total: 1, ready: 0, percent: 0),
      materialReadiness: const ProjectBuildMaterialReadiness(
        ready: 0,
        linked: 0,
        reserved: 0,
        missing: 1,
        total: 1,
      ),
      stepProgress: const ProjectBuildStepProgress(
        completed: 0,
        total: 0,
        percent: 0,
        steps: [],
      ),
      items: [
        ProjectBuildItem(
          id: 'item-1',
          requiredComponentId: 'component-1',
          status: ProjectBuildItemStatus.missing,
          component: const ProjectRequiredComponentItem(
            id: 'component-1',
            name: LocalizedText(en: 'Arduino Uno', ar: 'Arduino Uno'),
            materialType: 'Electronics',
            quantity: 1,
            unit: 'piece',
            isRequired: true,
            canBeSubstituted: false,
            categoryId: 'category-1',
          ),
          isReadyForBuild: false,
          readinessLabel: 'Still missing',
          linkedMaterial: linkedMaterialIdFor('item-1') == null
              ? null
              : LinkedMaterialSummary(
                  id: linkedMaterialIdFor('item-1')!,
                  title: 'Suggested material',
                  categoryNameEn: 'Electronics',
                  condition: 'GOOD',
                  status: 'REUSED',
                  isPubliclyAvailable: true,
                  isFree: false,
                  currency: 'NIS',
                  supplierName: 'Supplier',
                  city: 'Ramallah',
                  pickupAllowed: true,
                  deliveryAllowed: false,
                ),
          linkedReservation: linkedReservationIdFor('item-1') == null
              ? null
              : LinkedReservationSummary(
                  id: linkedReservationIdFor('item-1')!,
                  status: 'PENDING',
                  materialId: linkedMaterialIdFor('item-1') ?? 'material-1',
                  needsAction: false,
                  statusLabel: 'Pending',
                  quantityRequested: 1,
                ),
          acquisitionState: linkedReservationIdFor('item-1') != null
              ? 'reserved'
              : linkedMaterialIdFor('item-1') != null
              ? 'selected'
              : 'missing',
        ),
      ],
    );
  }
}

class _FlowTrackerScope extends InheritedWidget {
  const _FlowTrackerScope({
    required this.tracker,
    required super.child,
  });

  final _FlowTracker tracker;

  static _FlowTracker of(BuildContext context) {
    final scope =
        context.dependOnInheritedWidgetOfExactType<_FlowTrackerScope>();
    assert(scope != null, 'No _FlowTrackerScope found in context');
    return scope!.tracker;
  }

  @override
  bool updateShouldNotify(_FlowTrackerScope oldWidget) =>
      oldWidget.tracker != tracker;
}

class _TrackingRepository implements LearningProjectRepository {
  _TrackingRepository(this.tracker);

  final _FlowTracker tracker;

  @override
  Future<ProjectBuild?> fetchMyBuild(String projectId) async {
    return tracker.build.toProjectBuild();
  }

  @override
  Future<ProjectBuild> linkMaterial(
    String projectId,
    String itemId, {
    required String materialId,
  }) async {
    tracker.linkMaterialCalls += 1;
    tracker.build.linkMaterial(itemId, materialId);
    return tracker.build.toProjectBuild();
  }

  @override
  Future<ProjectBuild> unlinkMaterial(String projectId, String itemId) async {
    tracker.unlinkMaterialCalls += 1;
    tracker.build.unlinkMaterial(itemId);
    return tracker.build.toProjectBuild();
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Future<void> _pumpFlowHarness(
  WidgetTester tester, {
  required _FlowTracker tracker,
  Widget Function(BuildContext, GoRouterState)? materialDetailsBuilder,
}) async {
  tester.view.physicalSize = const Size(1280, 1600);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final router = GoRouter(
    initialLocation: '/learning/project-1/build/smart-plan',
    routes: [
      GoRoute(
        path: '/learning/:projectId/build/smart-plan',
        builder: (context, state) =>
            SmartBuildPlanPage(projectId: state.pathParameters['projectId']!),
      ),
      GoRoute(
        path: '/materials/:id',
        builder: materialDetailsBuilder ??
            (context, state) => const _StubMaterialDetailsPage(
              mode: _StubMaterialDetailsMode.browse,
            ),
      ),
    ],
  );

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        learningHubRepositoryProvider.overrideWithValue(
          _TrackingRepository(tracker),
        ),
        smartBuildPlanProvider('project-1').overrideWith((ref) async {
          return tracker.nextPlanResult();
        }),
        projectBuildProvider('project-1').overrideWith((ref) async {
          return tracker.build.toProjectBuild();
        }),
        openMaterialRequestsByBuildItemProvider.overrideWith((ref, buildId) async {
          return tracker.openRequests;
        }),
      ],
      child: _FlowTrackerScope(
        tracker: tracker,
        child: MaterialApp.router(
          routerConfig: router,
          locale: const Locale('en'),
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
        ),
      ),
    ),
  );
}

Future<void> _tapLabel(WidgetTester tester, String label) async {
  final finder = find.text(label);
  await tester.ensureVisible(finder);
  final rect = tester.getRect(finder);
  await tester.tapAt(rect.center);
}

SmartBuildPlanResult _plannedOnlyResult() {
  return SmartBuildPlanResult(
    buildId: 'build-1',
    projectId: 'project-1',
    generatedAt: DateTime.utc(2026, 1, 1),
    advisory: true,
    summary: const SmartBuildPlanBuildSummary(
      requiredComponents: 1,
      alreadySatisfied: 0,
      inProgress: 0,
      attention: 0,
      optimizable: 1,
    ),
    plans: [
      SmartBuildPlan(
        key: SmartBuildPlanPolicyKey.recommended,
        labels: const [SmartBuildPlanLabel.bestOverall],
        summary: const SmartBuildPlanPlanSummary(
          newlyPlannedComponents: 1,
          totalCoveredComponents: 1,
          totalRequiredComponents: 1,
          uncoveredComponents: 0,
          materialSubtotal: 75,
          currency: 'ILS',
          priceUnknownCount: 0,
          supplierCount: 1,
          pickupLocationCount: 1,
          deliveryFeeIncluded: false,
        ),
        items: [_plannedItem()],
      ),
    ],
  );
}

SmartBuildPlanResult _plannedAndUncoveredResult() {
  return SmartBuildPlanResult(
    buildId: 'build-1',
    projectId: 'project-1',
    generatedAt: DateTime.utc(2026, 1, 1),
    advisory: true,
    summary: const SmartBuildPlanBuildSummary(
      requiredComponents: 2,
      alreadySatisfied: 0,
      inProgress: 0,
      attention: 0,
      optimizable: 1,
    ),
    plans: [
      SmartBuildPlan(
        key: SmartBuildPlanPolicyKey.recommended,
        labels: const [SmartBuildPlanLabel.bestOverall],
        summary: const SmartBuildPlanPlanSummary(
          newlyPlannedComponents: 1,
          totalCoveredComponents: 1,
          totalRequiredComponents: 2,
          uncoveredComponents: 1,
          materialSubtotal: 75,
          currency: 'ILS',
          priceUnknownCount: 0,
          supplierCount: 1,
          pickupLocationCount: 1,
          deliveryFeeIncluded: false,
        ),
        items: [
          _plannedItem(),
          const SmartBuildPlanItem(
            buildItemId: 'item-uncovered',
            requiredComponentId: 'component-uncovered',
            componentName: 'Caster wheels',
            requiredQuantity: 4,
            requiredUnit: 'piece',
            plannerState: SmartBuildPlannerState.uncovered,
            uncoveredReason: SmartBuildUncoveredReason.noEligibleCandidates,
          ),
        ],
      ),
    ],
  );
}

SmartBuildPlanResult _uncoveredOnlyResult() {
  return SmartBuildPlanResult(
    buildId: 'build-1',
    projectId: 'project-1',
    generatedAt: DateTime.utc(2026, 1, 1),
    advisory: true,
    summary: const SmartBuildPlanBuildSummary(
      requiredComponents: 1,
      alreadySatisfied: 0,
      inProgress: 0,
      attention: 0,
      optimizable: 1,
    ),
    plans: [
      SmartBuildPlan(
        key: SmartBuildPlanPolicyKey.recommended,
        labels: const [SmartBuildPlanLabel.bestOverall],
        summary: const SmartBuildPlanPlanSummary(
          newlyPlannedComponents: 0,
          totalCoveredComponents: 0,
          totalRequiredComponents: 1,
          uncoveredComponents: 1,
          materialSubtotal: 0,
          currency: 'ILS',
          priceUnknownCount: 0,
          supplierCount: 0,
          pickupLocationCount: 0,
          deliveryFeeIncluded: false,
        ),
        items: [
          const SmartBuildPlanItem(
            buildItemId: 'item-uncovered',
            requiredComponentId: 'component-uncovered',
            componentName: 'Caster wheels',
            requiredQuantity: 4,
            requiredUnit: 'piece',
            plannerState: SmartBuildPlannerState.uncovered,
            uncoveredReason: SmartBuildUncoveredReason.noEligibleCandidates,
          ),
        ],
      ),
    ],
  );
}

SmartBuildPlanResult _inProgressResult() {
  return SmartBuildPlanResult(
    buildId: 'build-1',
    projectId: 'project-1',
    generatedAt: DateTime.utc(2026, 1, 1),
    advisory: true,
    summary: const SmartBuildPlanBuildSummary(
      requiredComponents: 1,
      alreadySatisfied: 0,
      inProgress: 1,
      attention: 0,
      optimizable: 1,
    ),
    plans: [
      SmartBuildPlan(
        key: SmartBuildPlanPolicyKey.recommended,
        labels: const [SmartBuildPlanLabel.bestOverall],
        summary: const SmartBuildPlanPlanSummary(
          newlyPlannedComponents: 0,
          totalCoveredComponents: 1,
          totalRequiredComponents: 1,
          uncoveredComponents: 0,
          materialSubtotal: 75,
          currency: 'ILS',
          priceUnknownCount: 0,
          supplierCount: 1,
          pickupLocationCount: 1,
          deliveryFeeIncluded: false,
        ),
        items: [
          const SmartBuildPlanItem(
            buildItemId: 'item-1',
            requiredComponentId: 'component-1',
            componentName: 'Arduino Uno',
            requiredQuantity: 1,
            requiredUnit: 'piece',
            plannerState: SmartBuildPlannerState.inProgress,
          ),
        ],
      ),
    ],
  );
}

SmartBuildPlanItem _plannedItem() {
  return SmartBuildPlanItem(
    buildItemId: 'item-1',
    requiredComponentId: 'component-1',
    componentName: 'Arduino Uno',
    requiredQuantity: 1,
    requiredUnit: 'piece',
    plannerState: SmartBuildPlannerState.planned,
    candidate: const SmartBuildPlanCandidate(
      materialId: 'material-1',
      title: 'Suggested material',
      matchType: SmartBuildMatchType.exact,
      matchHints: [],
      allocatedQuantity: 1,
      unit: 'piece',
      availableQuantity: 5,
      isFree: false,
      unitPrice: 75,
      lineSubtotal: 75,
      currency: 'ILS',
      priceKnown: true,
      locationId: 'loc-1',
      city: 'Ramallah',
      pickupAllowed: true,
      deliveryAllowed: false,
    ),
    reasonTags: const [SmartBuildReasonTag.exactMatch],
  );
}
