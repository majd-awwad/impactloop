import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/learning_hub/application/learning_hub_providers.dart';
import 'package:frontend/features/learning_hub/application/smart_build_plan_material_requests.dart';
import 'package:frontend/features/learning_hub/domain/models/smart_build_plan.dart';
import 'package:frontend/features/learning_hub/presentation/pages/smart_build_plan_page.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/smart_build_plan/smart_build_plan_material_thumbnail.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/smart_build_plan/smart_build_plan_sections.dart';
import 'package:frontend/features/material_discovery/domain/discovery_material.dart';
import 'package:frontend/features/material_discovery/domain/material_discovery_query.dart';
import 'package:frontend/features/material_discovery/domain/material_discovery_repository.dart';
import 'package:frontend/features/material_discovery/domain/material_discovery_result.dart';
import 'package:frontend/features/material_discovery/domain/material_engagement.dart';
import 'package:frontend/features/material_discovery/application/material_discovery_providers.dart';
import 'package:frontend/l10n/l10n.dart';

void main() {
  group('SmartBuildPlanPage', () {
    testWidgets('shows loading indicator initially', (tester) async {
      final completer = Completer<SmartBuildPlanResult>();
      await _pumpPage(
        tester,
        planFuture: () => completer.future,
      );

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('shows error state', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            smartBuildPlanProvider('project-1').overrideWith(
              (ref) => Future<SmartBuildPlanResult>.error(
                const ApiException(message: 'Optimizer failed', code: 'X'),
              ),
            ),
          ],
          child: const MaterialApp(
            locale: Locale('en'),
            localizationsDelegates: [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: AppLocalizations.supportedLocales,
            home: SmartBuildPlanPage(projectId: 'project-1'),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Optimizer failed'), findsOneWidget);
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('retry reloads optimizer after error', (tester) async {
      var allowSuccess = false;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            smartBuildPlanProvider('project-1').overrideWith((ref) async {
              if (!allowSuccess) {
                throw const ApiException(
                  message: 'Optimizer failed',
                  code: 'X',
                );
              }
              return _sampleResult();
            }),
          ],
          child: const MaterialApp(
            locale: Locale('en'),
            localizationsDelegates: [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: AppLocalizations.supportedLocales,
            home: SmartBuildPlanPage(projectId: 'project-1'),
          ),
        ),
      );

      await tester.pumpAndSettle();
      expect(find.text('Try again'), findsOneWidget);

      allowSuccess = true;
      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();

      expect(find.text('Build summary'), findsOneWidget);
    });

    testWidgets('refresh replaces stale plan data', (tester) async {
      var loads = 0;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            smartBuildPlanProvider('project-1').overrideWith((ref) async {
              loads += 1;
              if (loads == 1) {
                return _sampleResult(
                  plans: [
                    _samplePlan(
                      items: [_plannedItem(title: 'Initial material')],
                    ),
                  ],
                );
              }
              return _sampleResult(
                plans: [
                  _samplePlan(
                    items: [_plannedItem(title: 'Refreshed material')],
                  ),
                ],
              );
            }),
          ],
          child: const MaterialApp(
            locale: Locale('en'),
            localizationsDelegates: [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: AppLocalizations.supportedLocales,
            home: SmartBuildPlanPage(projectId: 'project-1'),
          ),
        ),
      );

      await tester.pumpAndSettle();
      expect(find.text('Initial material'), findsOneWidget);

      await tester.tap(find.byTooltip('Refresh plan'));
      await tester.pumpAndSettle();

      expect(find.text('Refreshed material'), findsOneWidget);
      expect(find.text('Initial material'), findsNothing);
      expect(loads, greaterThanOrEqualTo(2));
    });

    testWidgets('preserves cheapest selection across refresh when still available', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(1280, 1600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      var loads = 0;

      SmartBuildPlanResult buildResult() {
        loads += 1;
        return _sampleResult(
          plans: [
            _samplePlan(
              labels: const [SmartBuildPlanLabel.bestOverall],
              items: [_plannedItem(title: 'Best overall material')],
            ),
            _samplePlan(
              key: SmartBuildPlanPolicyKey.cheapest,
              labels: const [SmartBuildPlanLabel.cheapest],
              summary: const SmartBuildPlanPlanSummary(
                newlyPlannedComponents: 1,
                totalCoveredComponents: 1,
                totalRequiredComponents: 2,
                uncoveredComponents: 1,
                materialSubtotal: 5,
                currency: 'ILS',
                priceUnknownCount: 0,
                supplierCount: 1,
                pickupLocationCount: 1,
                deliveryFeeIncluded: false,
              ),
              items: [_plannedItem(title: 'Cheapest material')],
            ),
          ],
        );
      }

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            smartBuildPlanProvider('project-1').overrideWith((ref) async {
              return buildResult();
            }),
          ],
          child: const MaterialApp(
            locale: Locale('en'),
            localizationsDelegates: [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: AppLocalizations.supportedLocales,
            home: SmartBuildPlanPage(projectId: 'project-1'),
          ),
        ),
      );

      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Cheapest'));
      await _tapPlanCard(tester, SmartBuildPlanPolicyKey.cheapest);
      await tester.pumpAndSettle();
      expect(find.text('Cheapest material'), findsOneWidget);

      await tester.tap(find.byTooltip('Refresh plan'));
      await tester.pumpAndSettle();

      expect(find.text('Cheapest material'), findsOneWidget);
      expect(find.text('Best overall material'), findsNothing);
    });

    testWidgets('transitions to no optimizable state after refresh', (tester) async {
      var loads = 0;

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            smartBuildPlanProvider('project-1').overrideWith((ref) async {
              loads += 1;
              if (loads == 1) {
                return _sampleResult(
                  plans: [
                    _samplePlan(items: [_plannedItem()]),
                  ],
                );
              }
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
                  optimizable: 0,
                ),
                plans: const [],
              );
            }),
          ],
          child: const MaterialApp(
            locale: Locale('en'),
            localizationsDelegates: [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: AppLocalizations.supportedLocales,
            home: SmartBuildPlanPage(projectId: 'project-1'),
          ),
        ),
      );

      await tester.pumpAndSettle();
      expect(find.text('Suggested material'), findsOneWidget);

      await tester.tap(find.byTooltip('Refresh plan'));
      await tester.pumpAndSettle();

      expect(find.text('No items to optimize right now'), findsOneWidget);
      expect(find.text('Suggested material'), findsNothing);
    });

    testWidgets('renders merged-label plan', (tester) async {
      await _pumpPage(
        tester,
        planFuture: () async => _sampleResult(
          plans: [
            _samplePlan(
              labels: const [
                SmartBuildPlanLabel.bestOverall,
                SmartBuildPlanLabel.cheapest,
              ],
              items: [_plannedItem(), _attentionItem()],
            ),
          ],
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Best overall'), findsWidgets);
      expect(find.textContaining('Cheapest'), findsWidgets);
      expect(find.text('Needs attention item'), findsOneWidget);
      expect(find.text('Suggested material'), findsOneWidget);
    });

    testWidgets('supports switching between multiple plans', (tester) async {
      tester.view.physicalSize = const Size(1280, 1600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await _pumpPage(
        tester,
        planFuture: () async => _sampleResult(
          plans: [
            _samplePlan(
              labels: const [SmartBuildPlanLabel.bestOverall],
              summary: const SmartBuildPlanPlanSummary(
                newlyPlannedComponents: 1,
                totalCoveredComponents: 1,
                totalRequiredComponents: 2,
                uncoveredComponents: 1,
                materialSubtotal: 10,
                currency: 'ILS',
                priceUnknownCount: 0,
                supplierCount: 1,
                pickupLocationCount: 1,
                deliveryFeeIncluded: false,
              ),
              items: [
                _plannedItem(title: 'Plan A material'),
              ],
            ),
            _samplePlan(
              key: SmartBuildPlanPolicyKey.cheapest,
              labels: const [SmartBuildPlanLabel.cheapest],
              summary: const SmartBuildPlanPlanSummary(
                newlyPlannedComponents: 1,
                totalCoveredComponents: 1,
                totalRequiredComponents: 2,
                uncoveredComponents: 1,
                materialSubtotal: 5,
                currency: 'ILS',
                priceUnknownCount: 0,
                supplierCount: 1,
                pickupLocationCount: 1,
                deliveryFeeIncluded: false,
              ),
              items: [
                _plannedItem(title: 'Plan B material'),
              ],
            ),
          ],
        ),
      );

      await tester.pumpAndSettle();
      expect(find.text('Plan A material'), findsOneWidget);

      await _tapPlanCard(tester, SmartBuildPlanPolicyKey.cheapest);
      await tester.pumpAndSettle();

      expect(find.text('Plan B material'), findsOneWidget);
      expect(find.text('Plan A material'), findsNothing);
    });

    testWidgets('renders ATTENTION without replacement material', (tester) async {
      await _pumpPage(
        tester,
        planFuture: () async => _sampleResult(
          plans: [
            _samplePlan(
              items: [_attentionItem()],
            ),
          ],
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Needs attention (1)'), findsOneWidget);
      expect(find.text('Needs attention item'), findsOneWidget);
      expect(
        find.text(
          'This item needs your attention before planning can continue.',
        ),
        findsOneWidget,
      );
      expect(find.text('View material'), findsNothing);
      expect(find.text('Reserve'), findsNothing);
    });

    testWidgets('groups PLANNED items under Recommended materials', (tester) async {
      await _pumpPage(
        tester,
        planFuture: () async => _sampleResult(
          plans: [
            _samplePlan(
              items: [
                _plannedItem(title: 'Recommended board'),
                _uncoveredItem(),
              ],
            ),
          ],
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Recommended materials (1)'), findsOneWidget);
      expect(find.text('Recommended board'), findsOneWidget);
      expect(find.text('Required component'), findsOneWidget);
      expect(find.text('Recommended material'), findsOneWidget);
      expect(find.text('Still missing — 1 components'), findsOneWidget);
    });

    testWidgets('renders UNCOVERED in one section without repeated errors', (
      tester,
    ) async {
      await _pumpPage(
        tester,
        planFuture: () async => _sampleResult(
          plans: [
            _samplePlan(
              items: [_uncoveredItem()],
            ),
          ],
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('No materials available for this build yet'), findsNothing);
      expect(find.text('No new material recommendations right now'), findsOneWidget);
      expect(
        find.text('No valid recommendation is currently available.'),
        findsNothing,
      );
      expect(find.text('No eligible materials found'), findsNothing);
      expect(find.text('View missing components (1)'), findsOneWidget);
    });

    testWidgets('uncovered with recommendations uses compact missing rows', (
      tester,
    ) async {
      await _pumpPage(
        tester,
        planFuture: () async => _sampleResult(
          plans: [
            _samplePlan(
              items: [
                _plannedItem(),
                _uncoveredItem(name: 'GT2 Pulley'),
              ],
            ),
          ],
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('GT2 Pulley'), findsOneWidget);
      expect(
        find.text('No valid recommendation is currently available.'),
        findsNothing,
      );
    });

    testWidgets('supports show all for many uncovered items', (tester) async {
      tester.view.physicalSize = const Size(1280, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            openMaterialRequestsByBuildItemProvider.overrideWith(
              (ref, buildId) async => const {},
            ),
            projectBuildProvider('project-1').overrideWith((ref) async => null),
          ],
          child: MaterialApp(
            locale: const Locale('en'),
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: AppLocalizations.supportedLocales,
            home: Scaffold(
              body: SmartBuildPlanMissingSection(
                projectId: 'project-1',
                buildId: 'build-1',
                items: [
                  for (var index = 0; index < 6; index++)
                    _uncoveredItem(name: 'Missing $index'),
                ],
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Missing 0'), findsOneWidget);
      expect(find.text('Missing 5'), findsNothing);
      final showAll = find.byKey(const ValueKey('smart-build-plan-show-all-missing'));
      await tester.ensureVisible(showAll);
      await tester.tap(showAll);
      await tester.pumpAndSettle();
      expect(find.text('Show less'), findsOneWidget);
      expect(find.text('Missing 5'), findsOneWidget);
    });

    testWidgets('renders IN_PROGRESS as compact section', (tester) async {
      await _pumpPage(
        tester,
        planFuture: () async => _sampleResult(
          plans: [
            _samplePlan(
              items: [
                _plannedItem(),
                _inProgressItem(),
              ],
            ),
          ],
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('In progress (1)'), findsOneWidget);
      expect(find.text('DC Motor'), findsOneWidget);
      expect(find.text('Active reservation'), findsOneWidget);
    });

    testWidgets('renders ALREADY_SATISFIED as compact section', (tester) async {
      await _pumpPage(
        tester,
        planFuture: () async => _sampleResult(
          plans: [
            _samplePlan(
              items: [
                _plannedItem(),
                _satisfiedItem(),
              ],
            ),
          ],
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Already covered (1)'), findsOneWidget);
      expect(find.text('Battery pack'), findsOneWidget);
      expect(find.text('Already owned'), findsOneWidget);
    });

    testWidgets('planned items expose Reserve and View material actions', (
      tester,
    ) async {
      await _pumpPage(
        tester,
        planFuture: () async => _sampleResult(
          plans: [
            _samplePlan(items: [_plannedItem()]),
          ],
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Reserve'), findsOneWidget);
      expect(find.text('View material'), findsOneWidget);
      expect(
        find.text(
          'Reserve links this material to your build checklist, then opens the existing reservation flow. Availability is rechecked before booking.',
        ),
        findsNothing,
      );
    });

    testWidgets('narrow width layout does not overflow', (tester) async {
      tester.view.physicalSize = const Size(360, 1200);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            smartBuildPlanProvider('project-1').overrideWith((ref) async {
              return _sampleResult(
                plans: [
                  _samplePlan(
                    items: [
                      _plannedItem(),
                      _uncoveredItem(),
                    ],
                  ),
                ],
              );
            }),
            learningProjectProvider('project-1').overrideWith((ref) async => null),
          ],
          child: MaterialApp(
            locale: Locale('en'),
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: AppLocalizations.supportedLocales,
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(context).copyWith(
                size: const Size(360, 1200),
              ),
              child: child ?? const SizedBox.shrink(),
            ),
            home: const SmartBuildPlanPage(projectId: 'project-1'),
          ),
        ),
      );

      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });

    testWidgets('arabic RTL layout does not overflow', (tester) async {
      tester.view.physicalSize = const Size(390, 1200);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            smartBuildPlanProvider('project-1').overrideWith((ref) async {
              return _sampleResult(
                plans: [
                  _samplePlan(
                    items: [
                      _plannedItem(),
                      _uncoveredItem(),
                    ],
                  ),
                ],
              );
            }),
            learningProjectProvider('project-1').overrideWith((ref) async => null),
          ],
          child: MaterialApp(
            locale: const Locale('ar'),
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: AppLocalizations.supportedLocales,
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(context).copyWith(
                size: const Size(390, 1200),
              ),
              child: child ?? const SizedBox.shrink(),
            ),
            home: const Directionality(
              textDirection: TextDirection.rtl,
              child: SmartBuildPlanPage(projectId: 'project-1'),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text('المواد المقترحة (1)'), findsOneWidget);
    });

    testWidgets('shows unknown price instead of zero', (tester) async {
      await _pumpPage(
        tester,
        planFuture: () async => _sampleResult(
          plans: [
            _samplePlan(
              summary: const SmartBuildPlanPlanSummary(
                newlyPlannedComponents: 1,
                totalCoveredComponents: 1,
                totalRequiredComponents: 1,
                uncoveredComponents: 0,
                materialSubtotal: 0,
                currency: 'ILS',
                priceUnknownCount: 1,
                supplierCount: 1,
                pickupLocationCount: 1,
                deliveryFeeIncluded: false,
              ),
              items: [
                _plannedItem(priceKnown: false),
              ],
            ),
          ],
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Price unknown'), findsNWidgets(2));
      expect(find.text('₪0.00'), findsNothing);
      expect(
        find.textContaining('Subtotal includes known material prices only.'),
        findsOneWidget,
      );
    });

    testWidgets('shows no optimizable items state', (tester) async {
      await _pumpPage(
        tester,
        planFuture: () async => SmartBuildPlanResult(
          buildId: 'build-1',
          projectId: 'project-1',
          generatedAt: DateTime.utc(2026, 1, 1),
          advisory: true,
          summary: const SmartBuildPlanBuildSummary(
            requiredComponents: 2,
            alreadySatisfied: 2,
            inProgress: 0,
            attention: 0,
            optimizable: 0,
          ),
          plans: const [],
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('No items to optimize right now'), findsOneWidget);
      expect(find.text('Back to build'), findsOneWidget);
    });

    testWidgets('recommended card renders material image when imageUrl exists', (
      tester,
    ) async {
      await _pumpPage(
        tester,
        planFuture: () async => _sampleResult(
          plans: [
            _samplePlan(
              items: [
                _plannedItem(
                  title: 'Arduino board',
                  imageUrl: 'https://example.com/material.jpg',
                ),
              ],
            ),
          ],
        ),
      );

      await tester.pump();

      final thumbnail = tester.widget<SmartBuildPlanMaterialThumbnail>(
        find.byType(SmartBuildPlanMaterialThumbnail),
      );
      expect(thumbnail.imageUrl, 'https://example.com/material.jpg');
    });

    testWidgets('recommended card shows placeholder when imageUrl is absent', (
      tester,
    ) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            smartBuildPlanProvider('project-1').overrideWith((ref) async {
              return _sampleResult(
                plans: [
                  _samplePlan(
                    items: [_plannedItem(title: 'Arduino board')],
                  ),
                ],
              );
            }),
            materialDiscoveryRepositoryProvider.overrideWithValue(
              _EmptyMaterialDiscoveryRepository(),
            ),
          ],
          child: const MaterialApp(
            locale: Locale('en'),
            localizationsDelegates: [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: AppLocalizations.supportedLocales,
            home: SmartBuildPlanPage(projectId: 'project-1'),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(
        find.descendant(
          of: find.byType(SmartBuildPlanMaterialThumbnail),
          matching: find.byIcon(Icons.inventory_2_outlined),
        ),
        findsOneWidget,
      );
    });

    testWidgets('desktop workspace uses two-column layout', (tester) async {
      tester.view.physicalSize = const Size(1280, 1600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await _pumpPage(
        tester,
        planFuture: () async => _sampleResult(
          plans: [
            _samplePlan(
              items: [
                _plannedItem(title: 'Recommended board'),
                _uncoveredItem(),
              ],
            ),
          ],
        ),
      );

      await tester.pumpAndSettle();

      expect(find.byType(Row), findsWidgets);
      expect(find.text('Recommended materials (1)'), findsOneWidget);
      expect(find.textContaining('Still missing'), findsOneWidget);
    });
  });
}

Future<void> _tapPlanCard(
  WidgetTester tester,
  SmartBuildPlanPolicyKey policyKey,
) async {
  final card = find.byKey(ValueKey(policyKey));
  await tester.ensureVisible(card);
  final rect = tester.getRect(card);
  await tester.tapAt(rect.center);
}

Future<void> _pumpPage(
  WidgetTester tester, {
  Future<SmartBuildPlanResult> Function()? planFuture,
}) async {
  Future<SmartBuildPlanResult> resolvePlan() {
    final future = planFuture;
    if (future == null) {
      return Future.value(_sampleResult());
    }
    return future();
  }

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        smartBuildPlanProvider('project-1').overrideWith((ref) async {
          return resolvePlan();
        }),
      ],
      child: const MaterialApp(
        locale: Locale('en'),
        localizationsDelegates: [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        home: SmartBuildPlanPage(projectId: 'project-1'),
      ),
    ),
  );
  await tester.pump();
}

SmartBuildPlanResult _sampleResult({
  SmartBuildPlanBuildSummary? summary,
  List<SmartBuildPlan>? plans,
}) {
  return SmartBuildPlanResult(
    buildId: 'build-1',
    projectId: 'project-1',
    generatedAt: DateTime.utc(2026, 1, 1),
    advisory: true,
    summary: summary ??
        const SmartBuildPlanBuildSummary(
          requiredComponents: 2,
          alreadySatisfied: 0,
          inProgress: 0,
          attention: 0,
          optimizable: 1,
        ),
    plans: plans ??
        [
          _samplePlan(),
        ],
  );
}

SmartBuildPlan _samplePlan({
  SmartBuildPlanPolicyKey key = SmartBuildPlanPolicyKey.recommended,
  List<SmartBuildPlanLabel>? labels,
  SmartBuildPlanPlanSummary? summary,
  List<SmartBuildPlanItem>? items,
}) {
  return SmartBuildPlan(
    key: key,
    labels: labels ?? const [SmartBuildPlanLabel.bestOverall],
    summary: summary ??
        const SmartBuildPlanPlanSummary(
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
    items: items ?? [_plannedItem()],
  );
}

SmartBuildPlanItem _plannedItem({
  String title = 'Suggested material',
  bool priceKnown = true,
  String? imageUrl,
}) {
  return SmartBuildPlanItem(
    buildItemId: 'item-1',
    requiredComponentId: 'component-1',
    componentName: 'Arduino Uno',
    requiredQuantity: 1,
    requiredUnit: 'piece',
    plannerState: SmartBuildPlannerState.planned,
    candidate: SmartBuildPlanCandidate(
      materialId: 'material-1',
      title: title,
      imageUrl: imageUrl,
      matchType: SmartBuildMatchType.exact,
      matchHints: const [],
      allocatedQuantity: 1,
      unit: 'piece',
      availableQuantity: 5,
      isFree: false,
      unitPrice: 75,
      lineSubtotal: 75,
      currency: 'ILS',
      priceKnown: priceKnown,
      locationId: 'loc-1',
      city: 'Ramallah',
      pickupAllowed: true,
      deliveryAllowed: false,
    ),
    reasonTags: const [SmartBuildReasonTag.exactMatch],
  );
}

SmartBuildPlanItem _attentionItem() {
  return const SmartBuildPlanItem(
    buildItemId: 'item-attention',
    requiredComponentId: 'component-attention',
    componentName: 'Needs attention item',
    requiredQuantity: 1,
    requiredUnit: 'piece',
    plannerState: SmartBuildPlannerState.attention,
  );
}

SmartBuildPlanItem _uncoveredItem({String name = 'Uncovered item'}) {
  return SmartBuildPlanItem(
    buildItemId: 'item-uncovered-$name',
    requiredComponentId: 'component-uncovered-$name',
    componentName: name,
    requiredQuantity: 1,
    requiredUnit: 'piece',
    plannerState: SmartBuildPlannerState.uncovered,
    uncoveredReason: SmartBuildUncoveredReason.noEligibleCandidates,
  );
}

SmartBuildPlanItem _inProgressItem() {
  return const SmartBuildPlanItem(
    buildItemId: 'item-in-progress',
    requiredComponentId: 'component-in-progress',
    componentName: 'DC Motor',
    requiredQuantity: 2,
    requiredUnit: 'piece',
    plannerState: SmartBuildPlannerState.inProgress,
  );
}

SmartBuildPlanItem _satisfiedItem() {
  return const SmartBuildPlanItem(
    buildItemId: 'item-satisfied',
    requiredComponentId: 'component-satisfied',
    componentName: 'Battery pack',
    requiredQuantity: 1,
    requiredUnit: 'piece',
    plannerState: SmartBuildPlannerState.alreadySatisfied,
  );
}

class _EmptyMaterialDiscoveryRepository implements MaterialDiscoveryRepository {
  @override
  Future<MaterialDiscoveryResult> fetchMaterials(MaterialDiscoveryQuery query) {
    throw UnimplementedError();
  }

  @override
  Future<DiscoveryMaterial?> getMaterialById(
    String id, {
    String? recommendationImpressionId,
  }) async {
    return null;
  }

  @override
  Future<MaterialEngagement> likeMaterial(
    String id, {
    String? recommendationImpressionId,
  }) {
    throw UnimplementedError();
  }

  @override
  Future<MaterialEngagement> unlikeMaterial(
    String id, {
    String? recommendationImpressionId,
  }) {
    throw UnimplementedError();
  }

  @override
  Future<PublicSupplier?> fetchPublicSupplier(String supplierProfileId) {
    throw UnimplementedError();
  }

  @override
  Future<MaterialDiscoveryResult> fetchSupplierMaterials(
    String supplierProfileId,
    MaterialDiscoveryQuery query,
  ) {
    throw UnimplementedError();
  }

  @override
  Future<SupplierFollowStatus> followSupplier(String supplierProfileId) {
    throw UnimplementedError();
  }

  @override
  Future<SupplierFollowStatus> unfollowSupplier(String supplierProfileId) {
    throw UnimplementedError();
  }
}
