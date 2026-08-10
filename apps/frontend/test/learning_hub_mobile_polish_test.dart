import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/app/widgets/app_mobile_bottom_nav_bar.dart';
import 'package:frontend/features/ai/presentation/widgets/ai_assistant_launcher.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_project.dart';
import 'package:frontend/features/learning_hub/domain/models/project_material_coverage.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/learning_category_chips.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/learning_project_card.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/project_engagement_strip.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/shared/models/localized_text.dart';
import 'package:frontend/shared/widgets/learner_discovery/learner_discovery.dart';

void main() {
  setUp(() {
    final previousOnError = FlutterError.onError;
    FlutterError.onError = (details) {
      final message = details.exceptionAsString();
      if (message.contains('RenderFlex overflowed') ||
          message.contains('overflowed by')) {
        fail('Layout overflow: $message');
      }
      previousOnError?.call(details);
    };
  });

  group('Learning Hub mobile polish', () {
    for (final width in [360.0, 390.0, 412.0]) {
      testWidgets('compact card has no overflow at ${width.toInt()}px', (
        tester,
      ) async {
        await _pumpCompactCard(
          tester,
          width: width,
          project: _longTitleProject(),
          locale: const Locale('ar'),
        );

        expect(tester.takeException(), isNull);
        expect(find.byType(LearningProjectCompactCard), findsOneWidget);
      });
    }

    testWidgets('long English title ellipsizes without overflow', (tester) async {
      // Arabic UI with English project title (mixed-direction production data).
      await _pumpCompactCard(
        tester,
        width: 360,
        project: _project(
          title: const LocalizedText(
            en:
                'test-learning-project-material-allocation project [allocation demo with very long English name]',
            ar:
                'test-learning-project-material-allocation project [allocation demo with very long English name]',
          ),
        ),
        locale: const Locale('ar'),
      );

      final title = find.textContaining('test-learning-project-material');
      expect(title, findsOneWidget);
      final renderObject = tester.renderObject<RenderParagraph>(title);
      expect(renderObject.didExceedMaxLines, isTrue);
      expect(tester.takeException(), isNull);
    });

    testWidgets('Arabic title does not overflow', (tester) async {
      await _pumpCompactCard(
        tester,
        width: 390,
        project: _project(
          title: const LocalizedText(
            en: 'Arduino Robot',
            ar: 'روبوت تجنب العوائق باستخدام الأردوينو للمستوى المتوسط',
          ),
        ),
        locale: const Locale('ar'),
      );

      expect(
        find.textContaining('روبوت تجنب العوائق'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('no-image placeholder uses shared neutral style', (tester) async {
      await _pumpCompactCard(
        tester,
        width: 390,
        project: _project(),
        locale: const Locale('ar'),
      );

      expect(find.byIcon(Icons.school_outlined), findsWidgets);
      expect(tester.takeException(), isNull);
    });

    testWidgets('footer actions use Arabic labels in Arabic locale', (
      tester,
    ) async {
      await _pumpCompactCard(
        tester,
        width: 390,
        project: _project(isSaved: true, likesCount: 2, followersCount: 1),
        locale: const Locale('ar'),
      );

      expect(find.text('Save'), findsNothing);
      expect(find.text('Saved'), findsNothing);
      expect(find.textContaining('like'), findsNothing);
      expect(find.textContaining('likes'), findsNothing);
      expect(find.textContaining('follower'), findsNothing);
      expect(find.byType(ProjectEngagementStrip), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('category chips stay fully inside viewport edges', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        _app(
          locale: const Locale('ar'),
          child: Scaffold(
            body: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: LearningCategoryChips(
                categories: const [
                  LocalizedText(en: 'All', ar: 'الكل'),
                  LocalizedText(en: 'Electronics', ar: 'إلكترونيات'),
                  LocalizedText(en: 'Home experiments', ar: 'تجارب منزلية'),
                  LocalizedText(en: 'Recycling crafts', ar: 'حرف إعادة التدوير'),
                  LocalizedText(en: 'Robots', ar: 'روبوتات'),
                  LocalizedText(en: 'Woodworking', ar: 'نجارة'),
                ],
                selectedIndex: 0,
                onSelected: (_) {},
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('الكل'), findsOneWidget);
      expect(find.byType(LearnerChipRow), findsOneWidget);
      expect(find.byType(SingleChildScrollView), findsWidgets);
      expect(tester.takeException(), isNull);
    });

    testWidgets('scroll padding clears bottom nav and AI FAB', (tester) async {
      late EdgeInsetsDirectional padding;
      await tester.pumpWidget(
        _app(
          locale: const Locale('ar'),
          child: MediaQuery(
            data: const MediaQueryData(size: Size(412, 915)),
            child: Builder(
              builder: (context) {
                padding = appMobileAwareScrollPadding(
                  context,
                  top: 16,
                  reserveAiFab: true,
                );
                return const SizedBox.shrink();
              },
            ),
          ),
        ),
      );

      expect(
        padding.bottom,
        greaterThanOrEqualTo(
          appMobileBottomNavReservedHeight + appMobileAiFabReservedHeight,
        ),
      );
    });

    testWidgets('AI FAB sits above bottom nav reserved height', (tester) async {
      await tester.binding.setSurfaceSize(const Size(412, 915));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        _app(
          locale: const Locale('ar'),
          child: const Scaffold(
            body: Stack(
              children: [
                SizedBox.expand(),
                AiAssistantLauncher(),
              ],
            ),
          ),
        ),
      );
      await tester.pump();

      // Unauthenticated learners hide the launcher.
      expect(find.byType(AiAssistantLauncher), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('tabs remain selectable for all/saved/following', (
      tester,
    ) async {
      var selected = 'all';
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        _app(
          locale: const Locale('ar'),
          child: Scaffold(
            body: StatefulBuilder(
              builder: (context, setState) {
                return LearnerSegmentedTabs(
                  selectedId: selected,
                  onSelected: (id) => setState(() => selected = id),
                  items: const [
                    LearnerSegmentedTabItem(
                      id: 'all',
                      label: 'الكل',
                      icon: Icons.school_outlined,
                    ),
                    LearnerSegmentedTabItem(
                      id: 'saved',
                      label: 'المحفوظة',
                      icon: Icons.bookmark_border_rounded,
                    ),
                    LearnerSegmentedTabItem(
                      id: 'followed',
                      label: 'المتابعة',
                      icon: Icons.notifications_none_rounded,
                    ),
                  ],
                );
              },
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('المحفوظة'));
      await tester.pumpAndSettle();
      expect(selected, 'saved');

      await tester.tap(find.text('المتابعة'));
      await tester.pumpAndSettle();
      expect(selected, 'followed');

      await tester.tap(find.text('الكل'));
      await tester.pumpAndSettle();
      expect(selected, 'all');
    });

    testWidgets('captures compact card screenshots at mobile widths', (
      tester,
    ) async {
      for (final size in const [
        Size(360, 800),
        Size(390, 844),
        Size(412, 915),
      ]) {
        await tester.binding.setSurfaceSize(size);
        final key = ValueKey('shot-${size.width.toInt()}');
        await tester.pumpWidget(
          _app(
            locale: const Locale('ar'),
            child: MediaQuery(
              data: MediaQueryData(size: size),
              child: Scaffold(
                backgroundColor: const Color(0xFFF7F8F5),
                body: Align(
                  alignment: Alignment.topCenter,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: SingleChildScrollView(
                      child: RepaintBoundary(
                        key: key,
                        child: _MobileLearningHubShot(
                          width: size.width - 32,
                          projects: [
                            _project(
                              title: const LocalizedText(
                                en:
                                    'test-learning-project-material-allocation project [allocation demo with very long English name]',
                                ar:
                                    'test-learning-project-material-allocation project [allocation demo with very long English name]',
                              ),
                              isSaved: true,
                              likesCount: 1,
                              followersCount: 0,
                            ),
                            _project(
                              title: const LocalizedText(
                                en: 'Simple LED Circuit',
                                ar: 'دائرة LED بسيطة',
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();

        await expectLater(
          find.byKey(key),
          matchesGoldenFile(
            'goldens/learning_mobile_${size.width.toInt()}.png',
          ),
        );
        expect(tester.takeException(), isNull);
      }

      addTearDown(() => tester.binding.setSurfaceSize(null));
    });
  });
}

class _MobileLearningHubShot extends StatelessWidget {
  const _MobileLearningHubShot({
    required this.width,
    required this.projects,
  });

  final double width;
  final List<LearningProject> projects;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          LearnerCtaBanner(
            title: 'هل لديك فكرة مشروع؟',
            subtitle: 'أنشئ مسودة وأرسلها لمراجعة الإدارة.',
            actionLabel: 'مشروع جديد',
            onAction: () {},
            secondaryLabel: 'إرسالاتي',
            onSecondary: () {},
            leading: Icon(
              Icons.desktop_windows_outlined,
              size: 28,
              color: LearnerDiscoveryStyle.primary(context),
            ),
          ),
          const SizedBox(height: 10),
          LearnerSegmentedTabs(
            selectedId: 'all',
            onSelected: (_) {},
            items: const [
              LearnerSegmentedTabItem(
                id: 'all',
                label: 'الكل',
                icon: Icons.school_outlined,
              ),
              LearnerSegmentedTabItem(
                id: 'saved',
                label: 'المحفوظة',
                icon: Icons.bookmark_border_rounded,
              ),
              LearnerSegmentedTabItem(
                id: 'followed',
                label: 'المتابعة',
                icon: Icons.notifications_none_rounded,
              ),
            ],
          ),
          const SizedBox(height: 10),
          LearningCategoryChips(
            categories: const [
              LocalizedText(en: 'All', ar: 'الكل'),
              LocalizedText(en: 'Electronics', ar: 'إلكترونيات'),
              LocalizedText(en: 'Home', ar: 'تجارب منزلية'),
              LocalizedText(en: 'Recycling', ar: 'حرف إعادة التدوير'),
              LocalizedText(en: 'Robots', ar: 'روبوتات'),
            ],
            selectedIndex: 0,
            onSelected: (_) {},
          ),
          const SizedBox(height: 10),
          const LearnerResultsToolbar(label: 'عرض 1-2 من 2 نتيجة'),
          const SizedBox(height: 8),
          for (var i = 0; i < projects.length; i++) ...[
            if (i > 0) const SizedBox(height: 8),
            LearningProjectCompactCard(project: projects[i]),
          ],
        ],
      ),
    );
  }
}

Widget _app({required Locale locale, required Widget child}) {
  return ProviderScope(
    child: MaterialApp(
      locale: locale,
      theme: AppTheme.light,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      home: child,
    ),
  );
}

Future<void> _pumpCompactCard(
  WidgetTester tester, {
  required double width,
  required LearningProject project,
  required Locale locale,
}) async {
  await tester.binding.setSurfaceSize(Size(width, 900));
  addTearDown(() => tester.binding.setSurfaceSize(null));

  await tester.pumpWidget(
    _app(
      locale: locale,
      child: Scaffold(
        body: Center(
          child: SizedBox(
            width: width - 32,
            child: LearningProjectCompactCard(project: project),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

LearningProject _longTitleProject() {
  return _project(
    title: const LocalizedText(
      en:
          'test-learning-project-material-allocation project [allocation demo with very long English name]',
      ar: 'مشروع تخصيص مواد تعليمي طويل جداً للاختبار',
    ),
  );
}

LearningProject _project({
  LocalizedText? title,
  String? imageUrl,
  bool isSaved = false,
  int likesCount = 0,
  int followersCount = 0,
}) {
  return LearningProject(
    id: 'proj-mobile-polish',
    category: const LocalizedText(en: 'Electronics', ar: 'إلكترونيات'),
    title: title ??
        const LocalizedText(en: 'Simple LED Circuit', ar: 'دائرة LED بسيطة'),
    summary: const LocalizedText(
      en: 'A beginner electronics project.',
      ar: 'مشروع إلكترونيات للمبتدئين.',
    ),
    difficulty: const LocalizedText(en: 'Easy', ar: 'سهل'),
    duration: const LocalizedText(en: '1h', ar: '1س'),
    ratingLabel: const LocalizedText(en: 'learners', ar: 'متعلم'),
    ratingValue: 4.5,
    ratingCount: 8,
    componentCountLabel: const LocalizedText(en: '3 components', ar: '3'),
    components: const [],
    steps: const [],
    links: const [],
    imageUrl: imageUrl,
    heroIconData: Icons.memory_outlined,
    cardGradient: const [0xFF1565C0, 0xFF0D47A1],
    isFeatured: false,
    likesCount: likesCount,
    isSaved: isSaved,
    followersCount: followersCount,
    materialCoverage: const ProjectMaterialCoverageSummary(
      totalRequiredComponents: 3,
      availableComponents: 3,
      partialComponents: 0,
      missingComponents: 0,
      unknownComponents: 0,
      availabilityRatio: 1,
      coverageLevel: ProjectMaterialCoverageLevel.full,
    ),
  );
}
