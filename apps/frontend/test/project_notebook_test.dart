import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/app/router/navigation_extensions.dart';
import 'package:frontend/features/learner_builds/application/learner_builds_providers.dart';
import 'package:frontend/features/learner_builds/data/learner_builds_api.dart';
import 'package:frontend/features/project_notebook/application/project_notebook_controller.dart';
import 'package:frontend/features/project_notebook/domain/models/project_build_notebook.dart';
import 'package:frontend/features/project_notebook/presentation/l10n/project_notebook_l10n.dart';
import 'package:frontend/features/project_notebook/presentation/pages/project_notebook_page.dart';
import 'package:frontend/features/project_notebook/presentation/utils/notebook_pdf_export.dart';
import 'package:frontend/features/project_notebook/presentation/widgets/notebook_drawing_canvas.dart';
import 'package:frontend/shared/models/localized_text.dart';

class _FakeNotebookApi extends LearnerBuildsApi {
  _FakeNotebookApi() : super(Dio());

  int saveCount = 0;
  ProjectBuildNotebook? stored;
  bool failNextSave = false;
  bool failAllSaves = false;

  @override
  Future<ProjectBuildNotebook> fetchNotebook(String buildId) async {
    return stored ??
        ProjectBuildNotebook(
          buildId: buildId,
          buildStatus: 'IN_PROGRESS',
          attemptNumber: 1,
          projectTitle: 'Robot Car',
          readOnly: false,
          persisted: false,
          content: createDefaultNotebookDocument(defaultPageTitle: 'Page 1'),
          createdAt: null,
          updatedAt: null,
        );
  }

  @override
  Future<ProjectBuildNotebook> saveNotebook(
    String buildId,
    NotebookDocument content,
  ) async {
    saveCount += 1;
    if (failAllSaves || failNextSave) {
      failNextSave = false;
      throw Exception('save failed');
    }
    stored = ProjectBuildNotebook(
      buildId: buildId,
      buildStatus: 'IN_PROGRESS',
      attemptNumber: 1,
      projectTitle: 'Robot Car',
      readOnly: false,
      persisted: true,
      content: content,
      createdAt: DateTime.utc(2026, 8, 5),
      updatedAt: DateTime.utc(2026, 8, 5, 1),
    );
    return stored!;
  }
}

class _StaleResponseNotebookApi extends _FakeNotebookApi {
  @override
  Future<ProjectBuildNotebook> saveNotebook(
    String buildId,
    NotebookDocument content,
  ) async {
    saveCount += 1;
    final stale = ProjectBuildNotebook(
      buildId: buildId,
      buildStatus: 'IN_PROGRESS',
      attemptNumber: 1,
      projectTitle: 'Robot Car',
      readOnly: false,
      persisted: true,
      content: createDefaultNotebookDocument(defaultPageTitle: 'Page 1'),
      createdAt: DateTime.utc(2026, 8, 5),
      updatedAt: DateTime.utc(2026, 8, 5, 1),
    );
    stored = stale;
    return stale;
  }
}

class _FetchCountingNotebookApi extends _FakeNotebookApi {
  int fetchCount = 0;

  @override
  Future<ProjectBuildNotebook> fetchNotebook(String buildId) async {
    fetchCount += 1;
    return super.fetchNotebook(buildId);
  }
}

Future<void> _tapAddPage(WidgetTester tester) async {
  final label = find.text(ProjectNotebookL10n.addPage.en);
  await tester.ensureVisible(label);
  await tester.tap(label);
}

Future<void> _pumpNotebook(
  WidgetTester tester,
  _FakeNotebookApi api, {
  Locale locale = const Locale('en'),
  Size size = const Size(1280, 900),
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [learnerBuildsApiProvider.overrideWithValue(api)],
      child: MaterialApp(
        locale: locale,
        home: ProjectNotebookPage(buildId: 'build-1'),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Finder _notesField() {
  return find.byType(TextField).last;
}

Finder _titleField() {
  return find.byType(TextField).first;
}

Future<void> _typeIncrementally(
  WidgetTester tester,
  Finder field,
  String text,
) async {
  await tester.tap(field);
  await tester.pump();
  var current = '';
  for (var index = 0; index < text.length; index += 1) {
    current += text[index];
    await tester.enterText(field, current);
    await tester.pump();
  }
}

void main() {
  test('canonical notebook route uses build id', () {
    expect(
      learnerBuildNotebookRoute('build-123'),
      '/learner/builds/build-123/notebook',
    );
  });

  test('Arabic labels resolve', () {
    expect(ProjectNotebookL10n.projectNotebook.resolveFor('ar'), 'دفتر المشروع');
    expect(ProjectNotebookL10n.pages.resolveFor('ar'), 'الصفحات');
    expect(ProjectNotebookL10n.addPage.resolveFor('ar'), 'إضافة صفحة');
  });

  test('createNotebookStableId works on web-safe random range', () {
    for (var index = 0; index < 50; index += 1) {
      expect(createNotebookStableId(), isNotEmpty);
    }
  });

  testWidgets('default page appears after load', (tester) async {
    await _pumpNotebook(tester, _FakeNotebookApi());
    expect(find.text(ProjectNotebookL10n.projectNotebook.en), findsOneWidget);
    expect(find.text('Page 1'), findsOneWidget);
  });

  testWidgets('desktop shows page rail and dominant editor', (tester) async {
    await _pumpNotebook(tester, _FakeNotebookApi());
    expect(find.text(ProjectNotebookL10n.pages.en), findsOneWidget);
    expect(find.text(ProjectNotebookL10n.addPage.en), findsOneWidget);
    expect(find.byType(NotebookDrawingCanvas), findsNothing);
  });

  testWidgets('Add Page button is enabled and creates one page', (tester) async {
    final api = _FakeNotebookApi();
    await _pumpNotebook(tester, api);

    expect(find.text(ProjectNotebookL10n.addPage.en), findsOneWidget);

    await _tapAddPage(tester);
    await tester.pump();

    expect(find.text('Page 2'), findsOneWidget);
    expect(api.saveCount, 1);
  });

  testWidgets('new page becomes selected with unique id', (tester) async {
    final api = _FakeNotebookApi();
    await _pumpNotebook(tester, api);

    await _tapAddPage(tester);
    await tester.pump();

    final container = ProviderScope.containerOf(
      tester.element(find.byType(ProjectNotebookPage)),
    );
    final state = container.read(projectNotebookControllerProvider('build-1'));
    expect(state.document?.pages.length, 2);
    expect(state.selectedPageId, state.document?.pages.last.id);
    expect(
      state.document!.pages[0].id,
      isNot(state.document!.pages[1].id),
    );
  });

  testWidgets('existing content preserved when adding page', (tester) async {
    final api = _FakeNotebookApi();
    await _pumpNotebook(tester, api);

    await tester.enterText(find.byType(TextField).last, 'Keep this note');
    await tester.pump(const Duration(milliseconds: 1200));
    await tester.pumpAndSettle();

    await _tapAddPage(tester);
    await tester.pump();

    await tester.tap(find.textContaining('1.'));
    await tester.pump();

    expect(find.text('Keep this note'), findsOneWidget);
  });

  testWidgets('failed add page save keeps page locally and retry works', (
    tester,
  ) async {
    final api = _FakeNotebookApi()..failNextSave = true;
    await _pumpNotebook(tester, api);

    await _tapAddPage(tester);
    await tester.pumpAndSettle();

    expect(find.text('Page 2'), findsOneWidget);
    expect(find.text(ProjectNotebookL10n.addPageSaveFailed.en), findsOneWidget);

    await tester.tap(find.text(ProjectNotebookL10n.retry.en));
    await tester.pumpAndSettle();
    expect(api.saveCount, greaterThan(1));
  });

  testWidgets('double tap add page does not duplicate pages', (tester) async {
    final api = _FakeNotebookApi();
    await _pumpNotebook(tester, api);

    await _tapAddPage(tester);
    await _tapAddPage(tester);
    await tester.pumpAndSettle();

    final container = ProviderScope.containerOf(
      tester.element(find.byType(ProjectNotebookPage)),
    );
    final state = container.read(projectNotebookControllerProvider('build-1'));
    expect(state.document?.pages.length, 2);
  });

  testWidgets('page limit disables Add Page', (tester) async {
    final api = _FakeNotebookApi();
    final pages = List.generate(
      notebookMaxPages,
      (index) => createDefaultNotebookPage(title: 'Page ${index + 1}'),
    );
    api.stored = ProjectBuildNotebook(
      buildId: 'build-1',
      buildStatus: 'IN_PROGRESS',
      attemptNumber: 1,
      projectTitle: 'Robot Car',
      readOnly: false,
      persisted: true,
      content: NotebookDocument(schemaVersion: 1, pages: pages),
      createdAt: DateTime.utc(2026, 8, 5),
      updatedAt: DateTime.utc(2026, 8, 5),
    );
    await _pumpNotebook(tester, api);

    expect(find.text(ProjectNotebookL10n.addPage.en), findsOneWidget);
    expect(find.text(ProjectNotebookL10n.pageLimitReached.en), findsOneWidget);

    await _tapAddPage(tester);
    await tester.pump();

    final container = ProviderScope.containerOf(
      tester.element(find.byType(ProjectNotebookPage)),
    );
    final state = container.read(projectNotebookControllerProvider('build-1'));
    expect(state.document?.pages.length, notebookMaxPages);
  });

  testWidgets('typing triggers debounced save once', (tester) async {
    final api = _FakeNotebookApi();
    await _pumpNotebook(tester, api);

    await tester.enterText(_notesField(), 'Hello notebook');
    await tester.pump(const Duration(milliseconds: 500));
    expect(api.saveCount, 0);
    await tester.pump(const Duration(milliseconds: 700));
    await tester.pumpAndSettle();
    expect(api.saveCount, 1);
  });

  testWidgets('notes field keeps focus after one character', (tester) async {
    await _pumpNotebook(tester, _FakeNotebookApi());

    await _typeIncrementally(tester, _notesField(), 'H');
    final focusNode = tester.widget<TextField>(_notesField()).focusNode;
    expect(focusNode?.hasFocus, isTrue);
  });

  testWidgets('notes field keeps focus after multiple rapid characters', (
    tester,
  ) async {
    await _pumpNotebook(tester, _FakeNotebookApi());

    await _typeIncrementally(tester, _notesField(), 'Hello notebook');
    final focusNode = tester.widget<TextField>(_notesField()).focusNode;
    expect(focusNode?.hasFocus, isTrue);
    expect(
      tester.widget<TextField>(_notesField()).controller?.text,
      'Hello notebook',
    );
  });

  testWidgets('save status changes do not remove notes focus', (tester) async {
    await _pumpNotebook(tester, _FakeNotebookApi());

    await _typeIncrementally(tester, _notesField(), 'Typing test');
    final focusNode = tester.widget<TextField>(_notesField()).focusNode;
    expect(focusNode?.hasFocus, isTrue);

    await tester.pump(const Duration(milliseconds: 1100));
    await tester.pumpAndSettle();

    expect(find.text(ProjectNotebookL10n.saved.en), findsOneWidget);
    expect(focusNode?.hasFocus, isTrue);
  });

  testWidgets('save failure does not remove notes focus', (tester) async {
    final api = _FakeNotebookApi()..failNextSave = true;
    await _pumpNotebook(tester, api);

    await _typeIncrementally(tester, _notesField(), 'Keep focus');
    final focusNode = tester.widget<TextField>(_notesField()).focusNode;

    await tester.pump(const Duration(milliseconds: 1100));
    await tester.pumpAndSettle();

    expect(find.text(ProjectNotebookL10n.couldNotSave.en), findsOneWidget);
    expect(focusNode?.hasFocus, isTrue);
    expect(
      tester.widget<TextField>(_notesField()).controller?.text,
      'Keep focus',
    );
  });

  testWidgets('cursor position is preserved after autosave', (tester) async {
    await _pumpNotebook(tester, _FakeNotebookApi());

    await tester.enterText(_notesField(), 'Hello world');
    await tester.pump();
    tester.testTextInput.updateEditingValue(
      const TextEditingValue(
        text: 'Hello world',
        selection: TextSelection.collapsed(offset: 5),
      ),
    );
    await tester.pump();
    tester.testTextInput.updateEditingValue(
      const TextEditingValue(
        text: 'HelloX world',
        selection: TextSelection.collapsed(offset: 6),
      ),
    );
    await tester.pump(const Duration(milliseconds: 1100));
    await tester.pump();

    final controller = tester.widget<TextField>(_notesField()).controller!;
    expect(controller.text, 'HelloX world');
    expect(controller.selection.baseOffset, 6);
  });

  testWidgets('typing in the middle preserves insertion position', (tester) async {
    await _pumpNotebook(tester, _FakeNotebookApi());

    await tester.enterText(_notesField(), 'abc');
    await tester.pump();
    tester.testTextInput.updateEditingValue(
      const TextEditingValue(
        text: 'abc',
        selection: TextSelection.collapsed(offset: 1),
      ),
    );
    await tester.pump();
    tester.testTextInput.updateEditingValue(
      const TextEditingValue(
        text: 'aXbc',
        selection: TextSelection.collapsed(offset: 2),
      ),
    );
    await tester.pump();

    final controller = tester.widget<TextField>(_notesField()).controller!;
    expect(controller.text, 'aXbc');
    expect(controller.selection.baseOffset, 2);
  });

  testWidgets('rapid typing triggers one bounded save request', (tester) async {
    final api = _FakeNotebookApi();
    await _pumpNotebook(tester, api);

    await _typeIncrementally(tester, _notesField(), 'abcdefghij');
    await tester.pump(const Duration(milliseconds: 500));
    expect(api.saveCount, 0);
    await tester.pump(const Duration(milliseconds: 700));
    await tester.pumpAndSettle();
    expect(api.saveCount, 1);
  });

  testWidgets('page title field keeps focus while typing', (tester) async {
    await _pumpNotebook(tester, _FakeNotebookApi());

    await _typeIncrementally(tester, _titleField(), 'My title');
    final focusNode = tester.widget<TextField>(_titleField()).focusNode;
    expect(focusNode?.hasFocus, isTrue);
    expect(
      tester.widget<TextField>(_titleField()).controller?.text,
      'My title',
    );
  });

  testWidgets('stale save response does not overwrite newer local text', (
    tester,
  ) async {
    final api = _StaleResponseNotebookApi();
    await _pumpNotebook(tester, api);

    await _typeIncrementally(tester, _notesField(), 'Latest local text');
    await tester.pump(const Duration(milliseconds: 1100));
    await tester.pumpAndSettle();

    expect(
      tester.widget<TextField>(_notesField()).controller?.text,
      'Latest local text',
    );
  });

  testWidgets('switching pages preserves independent content', (tester) async {
    final api = _FakeNotebookApi();
    await _pumpNotebook(tester, api);

    await tester.enterText(_notesField(), 'Page one note');
    await tester.pump();

    await _tapAddPage(tester);
    await tester.pump();

    await tester.enterText(_notesField(), 'Page two note');
    await tester.pump();

    await tester.tap(find.textContaining('1.'));
    await tester.pump();

    expect(
      tester.widget<TextField>(_notesField()).controller?.text,
      'Page one note',
    );

    await tester.tap(find.textContaining('2.'));
    await tester.pump();

    expect(
      tester.widget<TextField>(_notesField()).controller?.text,
      'Page two note',
    );
  });

  testWidgets('returning to a page restores its content', (tester) async {
    final api = _FakeNotebookApi();
    await _pumpNotebook(tester, api);

    await tester.enterText(_notesField(), 'Remember this');
    await tester.pump();

    await _tapAddPage(tester);
    await tester.pump();
    await tester.enterText(_notesField(), 'Other page');
    await tester.pump();

    await tester.tap(find.textContaining('1.'));
    await tester.pump();

    expect(
      tester.widget<TextField>(_notesField()).controller?.text,
      'Remember this',
    );
  });

  testWidgets('autosave does not trigger notebook reload loop', (tester) async {
    final api = _FetchCountingNotebookApi();
    await _pumpNotebook(tester, api);
    expect(api.fetchCount, 1);

    await _typeIncrementally(tester, _notesField(), 'No reload');
    await tester.pump(const Duration(milliseconds: 1100));
    await tester.pumpAndSettle();

    expect(api.fetchCount, 1);
    expect(api.saveCount, 1);
  });

  testWidgets('drawing canvas has non-zero size', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: 400,
              child: NotebookDrawingCanvas(
                strokes: const [],
                readOnly: false,
                onStrokesChanged: (_) {},
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final box = tester.renderObject<RenderBox>(find.byType(NotebookDrawingCanvas));
    expect(box.size.width, greaterThan(0));
    expect(box.size.height, greaterThan(0));
  });

  testWidgets('pointer movement creates normalized stroke', (tester) async {
    List<NotebookStroke>? saved;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 400,
            child: NotebookDrawingCanvas(
              strokes: const [],
              readOnly: false,
              onStrokesChanged: (strokes) => saved = strokes,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final canvas = find.byType(NotebookDrawingCanvas);
    final center = tester.getCenter(canvas);
    final gesture = await tester.startGesture(center);
    await gesture.moveBy(const Offset(60, 30));
    await gesture.up();
    await tester.pumpAndSettle();

    expect(saved, isNotNull);
    expect(saved!, isNotEmpty);
    expect(saved!.first.points.first.x, greaterThan(0));
    expect(saved!.first.points.first.x, lessThanOrEqualTo(1));
  });

  testWidgets('right click does not create stroke', (tester) async {
    var saved = <NotebookStroke>[];
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 400,
            child: NotebookDrawingCanvas(
              strokes: const [],
              readOnly: false,
              onStrokesChanged: (strokes) => saved = strokes,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Canvas ignores non-primary mouse buttons; verify no strokes without input.
    expect(
      const PointerDownEvent(
        position: Offset(10, 10),
        buttons: kSecondaryMouseButton,
        kind: PointerDeviceKind.mouse,
      ).buttons,
      isNot(kPrimaryMouseButton),
    );
    expect(saved, isEmpty);
  });

  testWidgets('undo and redo work on drawing canvas', (tester) async {
    final key = GlobalKey<NotebookDrawingCanvasState>();
    List<NotebookStroke>? saved;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 400,
            child: NotebookDrawingCanvas(
              key: key,
              strokes: const [],
              readOnly: false,
              onStrokesChanged: (strokes) => saved = strokes,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final center = tester.getCenter(find.byType(NotebookDrawingCanvas));
    final gesture = await tester.startGesture(center);
    await gesture.moveBy(const Offset(50, 20));
    await gesture.up();
    await tester.pumpAndSettle();
    expect(saved?.length, 1);

    key.currentState!.undo();
    await tester.pump();
    expect(saved, isEmpty);

    key.currentState!.redo();
    await tester.pump();
    expect(saved?.length, 1);
  });

  testWidgets('drawing mode shows bounded canvas and helper text', (tester) async {
    await _pumpNotebook(tester, _FakeNotebookApi());
    await tester.tap(find.text(ProjectNotebookL10n.drawing.en));
    await tester.pumpAndSettle();

    expect(find.byType(NotebookDrawingCanvas), findsOneWidget);
    expect(find.text(ProjectNotebookL10n.drawHelper.en), findsOneWidget);
  });

  testWidgets('compact privacy callout is shown', (tester) async {
    await _pumpNotebook(tester, _FakeNotebookApi());
    expect(find.text(ProjectNotebookL10n.privateToYou.en), findsWidgets);
    expect(find.text(ProjectNotebookL10n.privacyMessage.en), findsOneWidget);
  });

  testWidgets('mobile layout has no overflow', (tester) async {
    await _pumpNotebook(
      tester,
      _FakeNotebookApi(),
      size: const Size(390, 844),
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('archived notebook is read-only', (tester) async {
    final api = _FakeNotebookApi();
    api.stored = ProjectBuildNotebook(
      buildId: 'build-1',
      buildStatus: 'ARCHIVED',
      attemptNumber: 1,
      projectTitle: 'Robot Car',
      readOnly: true,
      persisted: true,
      content: createDefaultNotebookDocument(defaultPageTitle: 'Page 1'),
      createdAt: DateTime.utc(2026, 8, 5),
      updatedAt: DateTime.utc(2026, 8, 5),
    );
    await _pumpNotebook(tester, api);

    expect(find.text(ProjectNotebookL10n.readOnly.en), findsOneWidget);
    expect(find.text(ProjectNotebookL10n.addPage.en), findsNothing);
  });
}
