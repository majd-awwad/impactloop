import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../learner_builds/application/learner_builds_providers.dart';
import '../domain/models/project_build_notebook.dart';

enum NotebookSaveStatus { idle, saving, saved, error }

enum NotebookSaveErrorKind { general, addPage, drawing }

class ProjectNotebookState {
  const ProjectNotebookState({
    required this.isLoading,
    required this.loadError,
    required this.notebook,
    required this.document,
    required this.selectedPageId,
    required this.saveStatus,
    required this.saveErrorKind,
    required this.readOnly,
    required this.isInitialized,
    required this.documentRevision,
    required this.isAddingPage,
  });

  factory ProjectNotebookState.initial() {
    return const ProjectNotebookState(
      isLoading: true,
      loadError: null,
      notebook: null,
      document: null,
      selectedPageId: null,
      saveStatus: NotebookSaveStatus.idle,
      saveErrorKind: NotebookSaveErrorKind.general,
      readOnly: false,
      isInitialized: false,
      documentRevision: 0,
      isAddingPage: false,
    );
  }

  final bool isLoading;
  final String? loadError;
  final ProjectBuildNotebook? notebook;
  final NotebookDocument? document;
  final String? selectedPageId;
  final NotebookSaveStatus saveStatus;
  final NotebookSaveErrorKind saveErrorKind;
  final bool readOnly;
  final bool isInitialized;
  final int documentRevision;
  final bool isAddingPage;

  NotebookPage? get selectedPage {
    final doc = document;
    final pageId = selectedPageId;
    if (doc == null || pageId == null) {
      return null;
    }
    for (final page in doc.pages) {
      if (page.id == pageId) {
        return page;
      }
    }
    return doc.pages.isEmpty ? null : doc.pages.first;
  }

  ProjectNotebookState copyWith({
    bool? isLoading,
    String? loadError,
    ProjectBuildNotebook? notebook,
    NotebookDocument? document,
    String? selectedPageId,
    NotebookSaveStatus? saveStatus,
    NotebookSaveErrorKind? saveErrorKind,
    bool? readOnly,
    bool? isInitialized,
    int? documentRevision,
    bool? isAddingPage,
    bool clearLoadError = false,
    bool clearSaveError = false,
  }) {
    return ProjectNotebookState(
      isLoading: isLoading ?? this.isLoading,
      loadError: clearLoadError ? null : (loadError ?? this.loadError),
      notebook: notebook ?? this.notebook,
      document: document ?? this.document,
      selectedPageId: selectedPageId ?? this.selectedPageId,
      saveStatus: saveStatus ?? this.saveStatus,
      saveErrorKind: clearSaveError
          ? NotebookSaveErrorKind.general
          : (saveErrorKind ?? this.saveErrorKind),
      readOnly: readOnly ?? this.readOnly,
      isInitialized: isInitialized ?? this.isInitialized,
      documentRevision: documentRevision ?? this.documentRevision,
      isAddingPage: isAddingPage ?? this.isAddingPage,
    );
  }
}

final projectNotebookControllerProvider = NotifierProvider.autoDispose
    .family<ProjectNotebookController, ProjectNotebookState, String>(
      ProjectNotebookController.new,
    );

class ProjectNotebookController extends Notifier<ProjectNotebookState> {
  ProjectNotebookController(this.buildId);

  final String buildId;

  Timer? _debounceTimer;
  int _saveGeneration = 0;
  int _latestEditGeneration = 0;
  bool _saveInFlight = false;
  bool _queuedSave = false;
  bool _disposed = false;
  bool _addPageInFlight = false;
  DateTime? _lastAddPageAt;
  NotebookSaveErrorKind _pendingSaveErrorKind = NotebookSaveErrorKind.general;

  @override
  ProjectNotebookState build() {
    ref.onDispose(() {
      _disposed = true;
      _debounceTimer?.cancel();
    });
    Future.microtask(load);
    return ProjectNotebookState.initial();
  }

  Future<void> load() async {
    state = state.copyWith(isLoading: true, clearLoadError: true);
    try {
      final notebook = await ref.read(learnerBuildsApiProvider).fetchNotebook(
        buildId,
      );
      final selectedPageId = notebook.content.pages.isEmpty
          ? null
          : notebook.content.pages.first.id;
      state = state.copyWith(
        isLoading: false,
        notebook: notebook,
        document: notebook.content,
        selectedPageId: selectedPageId,
        readOnly: notebook.readOnly,
        isInitialized: true,
        saveStatus: NotebookSaveStatus.idle,
        clearSaveError: true,
      );
    } catch (_) {
      state = state.copyWith(
        isLoading: false,
        loadError: 'load_failed',
        isInitialized: true,
      );
    }
  }

  void selectPage(String pageId) {
    if (state.selectedPageId == pageId) {
      return;
    }
    _flushDebouncedSaveIfPending();
    state = state.copyWith(selectedPageId: pageId);
  }

  void selectPageIfExists(String pageId) {
    final doc = state.document;
    if (doc == null) {
      return;
    }
    final exists = doc.pages.any((page) => page.id == pageId);
    if (!exists) {
      return;
    }
    selectPage(pageId);
  }

  void updatePageTitle(String pageId, String title) {
    _pendingSaveErrorKind = NotebookSaveErrorKind.general;
    _mutatePage(pageId, (page) => page.copyWith(
      title: title,
      updatedAt: DateTime.now().toUtc(),
    ));
    _scheduleDebouncedSave();
  }

  void updatePageText(String pageId, String text) {
    _pendingSaveErrorKind = NotebookSaveErrorKind.general;
    _mutatePage(pageId, (page) => page.copyWith(
      text: text,
      updatedAt: DateTime.now().toUtc(),
    ));
    _scheduleDebouncedSave();
  }

  void updatePageStrokes(String pageId, List<NotebookStroke> strokes) {
    _pendingSaveErrorKind = NotebookSaveErrorKind.drawing;
    _mutatePage(pageId, (page) => page.copyWith(
      strokes: List<NotebookStroke>.from(strokes),
      updatedAt: DateTime.now().toUtc(),
    ));
    _scheduleDebouncedSave();
  }

  bool addPage(String languageCode) {
    final now = DateTime.now();
    if (_addPageInFlight ||
        (_lastAddPageAt != null &&
            now.difference(_lastAddPageAt!) <
                const Duration(milliseconds: 500))) {
      return false;
    }
    final document = state.document;
    if (document == null || state.readOnly || !state.isInitialized) {
      return false;
    }
    if (document.pages.length >= notebookMaxPages) {
      return false;
    }

    _addPageInFlight = true;
    _lastAddPageAt = now;
    _pendingSaveErrorKind = NotebookSaveErrorKind.addPage;
    final pageNumber = document.pages.length + 1;
    final page = createDefaultNotebookPage(
      title: defaultNotebookPageTitle(languageCode, pageNumber),
    );
    final pages = List<NotebookPage>.from(document.pages)..add(page);

    state = state.copyWith(
      document: NotebookDocument(
        schemaVersion: document.schemaVersion,
        pages: pages,
      ),
      selectedPageId: page.id,
      documentRevision: state.documentRevision + 1,
      isAddingPage: false,
      clearSaveError: true,
    );
    _saveImmediately();
    _addPageInFlight = false;
    return true;
  }

  void deletePage(String pageId) {
    final document = state.document;
    if (document == null || state.readOnly) {
      return;
    }
    if (document.pages.length <= 1) {
      return;
    }
    final pages = document.pages.where((page) => page.id != pageId).toList();
    final nextSelected = state.selectedPageId == pageId
        ? pages.first.id
        : state.selectedPageId;
    _pendingSaveErrorKind = NotebookSaveErrorKind.general;
    state = state.copyWith(
      document: document.copyWith(pages: pages),
      selectedPageId: nextSelected,
      documentRevision: state.documentRevision + 1,
    );
    _saveImmediately();
  }

  void clearPageContent(String pageId) {
    _pendingSaveErrorKind = NotebookSaveErrorKind.general;
    _mutatePage(
      pageId,
      (page) => page.copyWith(
        text: '',
        strokes: const [],
        updatedAt: DateTime.now().toUtc(),
      ),
    );
    _saveImmediately();
  }

  Future<void> retrySave() => _performSave();

  Future<void> flushPendingSave() async {
    _debounceTimer?.cancel();
    _debounceTimer = null;
    if (state.document == null || state.readOnly || !state.isInitialized) {
      return;
    }
    if (_saveInFlight) {
      _queuedSave = true;
      return;
    }
    await _performSave();
  }

  void _mutatePage(
    String pageId,
    NotebookPage Function(NotebookPage page) transform,
  ) {
    final document = state.document;
    if (document == null || state.readOnly) {
      return;
    }
    final pages = document.pages
        .map((page) => page.id == pageId ? transform(page) : page)
        .toList();
    state = state.copyWith(
      document: document.copyWith(pages: pages),
    );
  }

  void _flushDebouncedSaveIfPending() {
    if (_debounceTimer?.isActive ?? false) {
      _debounceTimer?.cancel();
      _debounceTimer = null;
      unawaited(_performSave());
    }
  }

  void _scheduleDebouncedSave() {
    if (!state.isInitialized || state.readOnly) {
      return;
    }
    _latestEditGeneration += 1;
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 1000), () {
      unawaited(_performSave());
    });
  }

  void _saveImmediately() {
    if (!state.isInitialized || state.readOnly) {
      return;
    }
    _latestEditGeneration += 1;
    _debounceTimer?.cancel();
    _debounceTimer = null;
    unawaited(_performSave());
  }

  Future<void> _performSave() async {
    final document = state.document;
    if (document == null || state.readOnly || _disposed) {
      return;
    }

    if (_saveInFlight) {
      _queuedSave = true;
      return;
    }

    final saveGeneration = ++_saveGeneration;
    final snapshot = NotebookDocument(
      schemaVersion: document.schemaVersion,
      pages: document.pages
          .map(
            (page) => NotebookPage(
              id: page.id,
              title: page.title,
              text: page.text,
              strokes: List<NotebookStroke>.from(page.strokes),
              createdAt: page.createdAt,
              updatedAt: page.updatedAt,
            ),
          )
          .toList(),
    );
    final errorKind = _pendingSaveErrorKind;
    _saveInFlight = true;
    state = state.copyWith(
      saveStatus: NotebookSaveStatus.saving,
      clearSaveError: true,
    );

    try {
      final saved = await ref
          .read(learnerBuildsApiProvider)
          .saveNotebook(buildId, snapshot);
      if (_disposed) {
        return;
      }

      if (saveGeneration < _saveGeneration) {
        return;
      }

      state = state.copyWith(
        notebook: saved,
        readOnly: saved.readOnly,
        saveStatus: NotebookSaveStatus.saved,
        clearSaveError: true,
      );
    } catch (_) {
      if (!_disposed && saveGeneration == _saveGeneration) {
        state = state.copyWith(
          saveStatus: NotebookSaveStatus.error,
          saveErrorKind: errorKind,
        );
      }
    } finally {
      _saveInFlight = false;
      if (_queuedSave) {
        _queuedSave = false;
        if (_latestEditGeneration > saveGeneration) {
          unawaited(_performSave());
        }
      }
    }
  }
}
