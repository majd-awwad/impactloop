import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../application/project_notebook_controller.dart';
import '../../domain/models/project_build_notebook.dart';
import '../l10n/project_notebook_l10n.dart';
import '../utils/notebook_file_download.dart';
import '../utils/notebook_pdf_export.dart';
import '../widgets/notebook_drawing_canvas.dart';

const _kMaxContentWidth = 1120.0;
const _kPageRailWidth = 250.0;
const _kNotesMinHeight = 420.0;

class ProjectNotebookPage extends ConsumerStatefulWidget {
  const ProjectNotebookPage({
    super.key,
    required this.buildId,
    this.initialPageId,
  });

  final String buildId;
  final String? initialPageId;

  @override
  ConsumerState<ProjectNotebookPage> createState() => _ProjectNotebookPageState();
}

class _ProjectNotebookPageState extends ConsumerState<ProjectNotebookPage> {
  final Map<String, GlobalKey<NotebookDrawingCanvasState>> _canvasKeys = {};
  final Map<String, TextEditingController> _titleControllers = {};
  final Map<String, TextEditingController> _textControllers = {};
  final Map<String, FocusNode> _titleFocusNodes = {};
  final Map<String, FocusNode> _textFocusNodes = {};
  NotebookDrawingTool _drawingTool = NotebookDrawingTool.pen;
  String _selectedColor = notebookSupportedColors.first;
  double _selectedWidth = notebookStrokeWidths[1];
  _NotebookEditorMode _editorMode = _NotebookEditorMode.notes;
  bool _exportingPdf = false;
  bool _appliedInitialPage = false;

  @override
  void dispose() {
    for (final controller in _titleControllers.values) {
      controller.dispose();
    }
    for (final controller in _textControllers.values) {
      controller.dispose();
    }
    for (final node in _titleFocusNodes.values) {
      node.dispose();
    }
    for (final node in _textFocusNodes.values) {
      node.dispose();
    }
    super.dispose();
  }

  GlobalKey<NotebookDrawingCanvasState> _canvasKeyFor(String pageId) {
    return _canvasKeys.putIfAbsent(pageId, GlobalKey.new);
  }

  TextEditingController _titleControllerFor(NotebookPage page) {
    return _titleControllers.putIfAbsent(page.id, () {
      return TextEditingController(text: page.title);
    });
  }

  TextEditingController _textControllerFor(NotebookPage page) {
    return _textControllers.putIfAbsent(page.id, () {
      return TextEditingController(text: page.text);
    });
  }

  FocusNode _titleFocusNodeFor(String pageId) {
    return _titleFocusNodes.putIfAbsent(pageId, FocusNode.new);
  }

  FocusNode _textFocusNodeFor(String pageId) {
    return _textFocusNodes.putIfAbsent(pageId, FocusNode.new);
  }

  void _syncControllersForPage(NotebookPage page, {required bool force}) {
    final titleController = _titleControllerFor(page);
    final textController = _textControllerFor(page);
    final titleFocus = _titleFocusNodeFor(page.id);
    final textFocus = _textFocusNodeFor(page.id);

    if (force || !titleFocus.hasFocus) {
      _syncControllerText(titleController, page.title);
    }
    if (force || !textFocus.hasFocus) {
      _syncControllerText(textController, page.text);
    }
  }

  void _syncControllerText(TextEditingController controller, String nextText) {
    if (controller.text == nextText) {
      return;
    }
    final selection = controller.selection;
    controller.value = controller.value.copyWith(
      text: nextText,
      selection: selection.isValid &&
              selection.end >= 0 &&
              selection.end <= nextText.length
          ? selection
          : TextSelection.collapsed(offset: nextText.length),
      composing: TextRange.empty,
    );
  }

  void _pruneControllersForPages(Set<String> activePageIds) {
    for (final pageId in _titleControllers.keys.toList()) {
      if (!activePageIds.contains(pageId)) {
        _titleControllers.remove(pageId)?.dispose();
        _titleFocusNodes.remove(pageId)?.dispose();
      }
    }
    for (final pageId in _textControllers.keys.toList()) {
      if (!activePageIds.contains(pageId)) {
        _textControllers.remove(pageId)?.dispose();
        _textFocusNodes.remove(pageId)?.dispose();
      }
    }
    for (final pageId in _canvasKeys.keys.toList()) {
      if (!activePageIds.contains(pageId)) {
        _canvasKeys.remove(pageId);
      }
    }
  }

  Future<void> _exportPdf(ProjectNotebookState state) async {
    if (_exportingPdf || state.document == null || state.notebook == null) {
      return;
    }
    setState(() => _exportingPdf = true);
    try {
      await ref
          .read(projectNotebookControllerProvider(widget.buildId).notifier)
          .flushPendingSave();
      if (!mounted) {
        return;
      }
      final refreshed = ref.read(projectNotebookControllerProvider(widget.buildId));
      final document = refreshed.document ?? state.document!;
      final notebook = refreshed.notebook ?? state.notebook!;
      final locale = Localizations.localeOf(context).languageCode;
      final bytes = await buildNotebookPdfBytes(
        NotebookPdfExportInput(
          document: document,
          projectTitle: notebook.projectTitle,
          attemptNumber: notebook.attemptNumber,
          learnerName: null,
          languageCode: locale,
          exportedAt: DateTime.now(),
        ),
      );
      downloadNotebookPdfBytes(
        bytes: bytes,
        filename: sanitizeNotebookPdfFilename(
          projectTitle: notebook.projectTitle,
          attemptNumber: notebook.attemptNumber,
        ),
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ProjectNotebookL10n.pdfExportFailed.resolve(context)),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _exportingPdf = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final state = ref.watch(projectNotebookControllerProvider(widget.buildId));
    final controller = ref.read(
      projectNotebookControllerProvider(widget.buildId).notifier,
    );

    ref.listen<ProjectNotebookState>(
      projectNotebookControllerProvider(widget.buildId),
      (previous, next) {
        if (next.isLoading || next.selectedPage == null) {
          return;
        }
        final activePageIds =
            next.document?.pages.map((page) => page.id).toSet() ?? {};
        _pruneControllersForPages(activePageIds);

        final initialLoad =
            previous?.isInitialized != true && next.isInitialized;
        if (initialLoad &&
            !_appliedInitialPage &&
            widget.initialPageId != null) {
          _appliedInitialPage = true;
          controller.selectPageIfExists(widget.initialPageId!);
        }
        final pageChanged = previous?.selectedPageId != next.selectedPageId;
        if (initialLoad || pageChanged) {
          _syncControllersForPage(next.selectedPage!, force: true);
        }
      },
    );

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          children: [
            EntryNavBar(
              showSignIn: false,
              showCreateAccount: false,
              homeRoute: '/home',
              phoneTitle: ProjectNotebookL10n.projectNotebook.resolve(context),
            ),
            Expanded(
              child: state.isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : state.loadError != null
                  ? _LoadError(
                      onRetry: controller.load,
                      onBack: () => context.popOrGo(learnerBuildsRoute),
                    )
                  : _NotebookWorkspace(
                      buildId: widget.buildId,
                      state: state,
                      controller: controller,
                      canvasKeyFor: _canvasKeyFor,
                      titleControllerFor: _titleControllerFor,
                      textControllerFor: _textControllerFor,
                      titleFocusNodeFor: _titleFocusNodeFor,
                      textFocusNodeFor: _textFocusNodeFor,
                      editorMode: _editorMode,
                      drawingTool: _drawingTool,
                      selectedColor: _selectedColor,
                      selectedWidth: _selectedWidth,
                      exportingPdf: _exportingPdf,
                      onEditorModeChanged: (mode) =>
                          setState(() => _editorMode = mode),
                      onDrawingToolChanged: (tool) =>
                          setState(() => _drawingTool = tool),
                      onColorChanged: (color) =>
                          setState(() => _selectedColor = color),
                      onWidthChanged: (width) =>
                          setState(() => _selectedWidth = width),
                      onExportPdf: () => _exportPdf(state),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

enum _NotebookEditorMode { notes, drawing }

class _LoadError extends StatelessWidget {
  const _LoadError({required this.onRetry, required this.onBack});

  final VoidCallback onRetry;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              ProjectNotebookL10n.loadError.resolve(context),
              style: AppTextStyles.body(context).copyWith(color: palette.textPrimary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.md),
            FilledButton(
              onPressed: onRetry,
              child: Text(ProjectNotebookL10n.retry.resolve(context)),
            ),
            const SizedBox(height: AppSpacing.sm),
            TextButton(
              onPressed: onBack,
              child: Text(ProjectNotebookL10n.backToBuild.resolve(context)),
            ),
          ],
        ),
      ),
    );
  }
}

class _NotebookWorkspace extends StatelessWidget {
  const _NotebookWorkspace({
    required this.buildId,
    required this.state,
    required this.controller,
    required this.canvasKeyFor,
    required this.titleControllerFor,
    required this.textControllerFor,
    required this.titleFocusNodeFor,
    required this.textFocusNodeFor,
    required this.editorMode,
    required this.drawingTool,
    required this.selectedColor,
    required this.selectedWidth,
    required this.exportingPdf,
    required this.onEditorModeChanged,
    required this.onDrawingToolChanged,
    required this.onColorChanged,
    required this.onWidthChanged,
    required this.onExportPdf,
  });

  final String buildId;
  final ProjectNotebookState state;
  final ProjectNotebookController controller;
  final GlobalKey<NotebookDrawingCanvasState> Function(String pageId) canvasKeyFor;
  final TextEditingController Function(NotebookPage page) titleControllerFor;
  final TextEditingController Function(NotebookPage page) textControllerFor;
  final FocusNode Function(String pageId) titleFocusNodeFor;
  final FocusNode Function(String pageId) textFocusNodeFor;
  final _NotebookEditorMode editorMode;
  final NotebookDrawingTool drawingTool;
  final String selectedColor;
  final double selectedWidth;
  final bool exportingPdf;
  final ValueChanged<_NotebookEditorMode> onEditorModeChanged;
  final ValueChanged<NotebookDrawingTool> onDrawingToolChanged;
  final ValueChanged<String> onColorChanged;
  final ValueChanged<double> onWidthChanged;
  final VoidCallback onExportPdf;

  @override
  Widget build(BuildContext context) {
    final notebook = state.notebook!;
    final isCompact = MediaQuery.sizeOf(context).width < 900;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.md),
      physics: editorMode == _NotebookEditorMode.drawing && !isCompact
          ? const ClampingScrollPhysics()
          : null,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: _kMaxContentWidth),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _NotebookHeader(
                projectTitle: notebook.projectTitle,
                readOnly: state.readOnly,
                saveStatus: state.saveStatus,
                saveErrorKind: state.saveErrorKind,
                exportingPdf: exportingPdf,
                compact: isCompact,
                onBack: () => context.pop(),
                onRetrySave: controller.retrySave,
                onExportPdf: onExportPdf,
              ),
              const SizedBox(height: AppSpacing.md),
              if (isCompact)
                _MobileNotebookLayout(
                  state: state,
                  controller: controller,
                  canvasKeyFor: canvasKeyFor,
                  titleControllerFor: titleControllerFor,
                  textControllerFor: textControllerFor,
                  titleFocusNodeFor: titleFocusNodeFor,
                  textFocusNodeFor: textFocusNodeFor,
                  editorMode: editorMode,
                  drawingTool: drawingTool,
                  selectedColor: selectedColor,
                  selectedWidth: selectedWidth,
                  onEditorModeChanged: onEditorModeChanged,
                  onDrawingToolChanged: onDrawingToolChanged,
                  onColorChanged: onColorChanged,
                  onWidthChanged: onWidthChanged,
                )
              else
                IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        width: _kPageRailWidth,
                        child: _PageRail(
                          state: state,
                          controller: controller,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: _EditorCard(
                          state: state,
                          controller: controller,
                          canvasKeyFor: canvasKeyFor,
                          titleControllerFor: titleControllerFor,
                          textControllerFor: textControllerFor,
                          titleFocusNodeFor: titleFocusNodeFor,
                          textFocusNodeFor: textFocusNodeFor,
                          editorMode: editorMode,
                          drawingTool: drawingTool,
                          selectedColor: selectedColor,
                          selectedWidth: selectedWidth,
                          onEditorModeChanged: onEditorModeChanged,
                          onDrawingToolChanged: onDrawingToolChanged,
                          onColorChanged: onColorChanged,
                          onWidthChanged: onWidthChanged,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NotebookHeader extends StatelessWidget {
  const _NotebookHeader({
    required this.projectTitle,
    required this.readOnly,
    required this.saveStatus,
    required this.saveErrorKind,
    required this.exportingPdf,
    required this.compact,
    required this.onBack,
    required this.onRetrySave,
    required this.onExportPdf,
  });

  final String projectTitle;
  final bool readOnly;
  final NotebookSaveStatus saveStatus;
  final NotebookSaveErrorKind saveErrorKind;
  final bool exportingPdf;
  final bool compact;
  final VoidCallback onBack;
  final VoidCallback onRetrySave;
  final VoidCallback onExportPdf;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              TextButton.icon(
                onPressed: onBack,
                icon: const Icon(Icons.arrow_back_rounded, size: 18),
                label: Text(ProjectNotebookL10n.backToBuild.resolve(context)),
              ),
              const Spacer(),
              if (compact)
                IconButton(
                  tooltip: ProjectNotebookL10n.exportPdf.resolve(context),
                  onPressed: exportingPdf ? null : onExportPdf,
                  icon: exportingPdf
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.picture_as_pdf_outlined),
                )
              else
                FilledButton.icon(
                  onPressed: exportingPdf ? null : onExportPdf,
                  icon: exportingPdf
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.picture_as_pdf_outlined, size: 18),
                  label: Text(
                    exportingPdf
                        ? ProjectNotebookL10n.generatingPdf.resolve(context)
                        : ProjectNotebookL10n.exportPdf.resolve(context),
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.menu_book_outlined, color: palette.mint, size: 28),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      ProjectNotebookL10n.projectNotebook.resolve(context),
                      style: AppTextStyles.display(context).copyWith(
                        color: palette.textPrimary,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      projectTitle,
                      style: AppTextStyles.body(context).copyWith(
                        color: palette.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.xs,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              AppStatusBadge(
                label: ProjectNotebookL10n.privateToYou.resolve(context),
                tone: AppStatusTone.primary,
              ),
              if (readOnly)
                AppStatusBadge(
                  label: ProjectNotebookL10n.readOnly.resolve(context),
                  tone: AppStatusTone.neutral,
                ),
              _SaveStatusRow(
                status: saveStatus,
                errorKind: saveErrorKind,
                onRetry: onRetrySave,
              ),
            ],
          ),
          if (readOnly) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              ProjectNotebookL10n.archivedReadOnly.resolve(context),
              style: AppTextStyles.label(context).copyWith(
                color: palette.textMuted,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _SaveStatusRow extends StatelessWidget {
  const _SaveStatusRow({
    required this.status,
    required this.errorKind,
    required this.onRetry,
  });

  final NotebookSaveStatus status;
  final NotebookSaveErrorKind errorKind;
  final VoidCallback onRetry;

  LocalizedText? _errorMessage() {
    return switch (errorKind) {
      NotebookSaveErrorKind.addPage => ProjectNotebookL10n.addPageSaveFailed,
      NotebookSaveErrorKind.drawing => ProjectNotebookL10n.drawingSaveFailed,
      NotebookSaveErrorKind.general => ProjectNotebookL10n.couldNotSave,
    };
  }

  @override
  Widget build(BuildContext context) {
    if (status == NotebookSaveStatus.idle) {
      return const SizedBox.shrink();
    }

    final label = switch (status) {
      NotebookSaveStatus.saving => ProjectNotebookL10n.saving,
      NotebookSaveStatus.saved => ProjectNotebookL10n.saved,
      NotebookSaveStatus.error => _errorMessage()!,
      NotebookSaveStatus.idle => ProjectNotebookL10n.saved,
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: AppSpacing.xs,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            AppStatusBadge(
              label: label.resolve(context),
              tone: status == NotebookSaveStatus.error
                  ? AppStatusTone.warning
                  : AppStatusTone.neutral,
            ),
            if (status == NotebookSaveStatus.error)
              TextButton(
                onPressed: onRetry,
                child: Text(ProjectNotebookL10n.retry.resolve(context)),
              ),
          ],
        ),
      ],
    );
  }
}

class _PageRail extends StatelessWidget {
  const _PageRail({required this.state, required this.controller});

  final ProjectNotebookState state;
  final ProjectNotebookController controller;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final pages = state.document?.pages ?? [];
    final atLimit = pages.length >= notebookMaxPages;

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            ProjectNotebookL10n.pages.resolve(context),
            style: AppTextStyles.title(context).copyWith(
              color: palette.textPrimary,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          if (!state.readOnly)
            FilledButton.tonalIcon(
              onPressed: atLimit
                  ? null
                  : () => controller.addPage(
                      Localizations.localeOf(context).languageCode,
                    ),
              icon: const Icon(Icons.add, size: 18),
              label: Text(ProjectNotebookL10n.addPage.resolve(context)),
            ),
          if (atLimit && !state.readOnly) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              ProjectNotebookL10n.pageLimitReached.resolve(context),
              style: AppTextStyles.label(context).copyWith(
                color: palette.textMuted,
                fontSize: 12,
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          for (var index = 0; index < pages.length; index += 1)
            _PageRailTile(
              page: pages[index],
              pageNumber: index + 1,
              selected: pages[index].id == state.selectedPageId,
              canDelete: !state.readOnly && pages.length > 1,
              onTap: () => controller.selectPage(pages[index].id),
              onDelete: () => _confirmDeletePage(context, controller, pages[index].id),
            ),
        ],
      ),
    );
  }
}

class _PageRailTile extends StatelessWidget {
  const _PageRailTile({
    required this.page,
    required this.pageNumber,
    required this.selected,
    required this.canDelete,
    required this.onTap,
    required this.onDelete,
  });

  final NotebookPage page;
  final int pageNumber;
  final bool selected;
  final bool canDelete;
  final VoidCallback onTap;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: Material(
        color: selected ? palette.mint.withValues(alpha: 0.12) : Colors.transparent,
        borderRadius: AppRadius.mdAll,
        child: InkWell(
          onTap: onTap,
          borderRadius: AppRadius.mdAll,
          child: Container(
            padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
            decoration: selected
                ? BoxDecoration(
                    borderRadius: AppRadius.mdAll,
                    border: Border.all(color: palette.mint),
                  )
                : null,
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '$pageNumber. ${page.title}',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.label(context).copyWith(
                          color: palette.textPrimary,
                          fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                        ),
                      ),
                      Text(
                        MaterialLocalizations.of(context)
                            .formatMediumDate(page.updatedAt.toLocal()),
                        style: AppTextStyles.label(context).copyWith(
                          color: palette.textMuted,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
                if (canDelete)
                  PopupMenuButton<String>(
                    tooltip: ProjectNotebookL10n.deletePage.resolve(context),
                    onSelected: (value) {
                      if (value == 'delete') {
                        onDelete();
                      }
                    },
                    itemBuilder: (context) => [
                      PopupMenuItem(
                        value: 'delete',
                        child: Text(ProjectNotebookL10n.deletePage.resolve(context)),
                      ),
                    ],
                    child: Icon(Icons.more_vert, color: palette.textMuted, size: 20),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MobileNotebookLayout extends StatelessWidget {
  const _MobileNotebookLayout({
    required this.state,
    required this.controller,
    required this.canvasKeyFor,
    required this.titleControllerFor,
    required this.textControllerFor,
    required this.titleFocusNodeFor,
    required this.textFocusNodeFor,
    required this.editorMode,
    required this.drawingTool,
    required this.selectedColor,
    required this.selectedWidth,
    required this.onEditorModeChanged,
    required this.onDrawingToolChanged,
    required this.onColorChanged,
    required this.onWidthChanged,
  });

  final ProjectNotebookState state;
  final ProjectNotebookController controller;
  final GlobalKey<NotebookDrawingCanvasState> Function(String pageId) canvasKeyFor;
  final TextEditingController Function(NotebookPage page) titleControllerFor;
  final TextEditingController Function(NotebookPage page) textControllerFor;
  final FocusNode Function(String pageId) titleFocusNodeFor;
  final FocusNode Function(String pageId) textFocusNodeFor;
  final _NotebookEditorMode editorMode;
  final NotebookDrawingTool drawingTool;
  final String selectedColor;
  final double selectedWidth;
  final ValueChanged<_NotebookEditorMode> onEditorModeChanged;
  final ValueChanged<NotebookDrawingTool> onDrawingToolChanged;
  final ValueChanged<String> onColorChanged;
  final ValueChanged<double> onWidthChanged;

  @override
  Widget build(BuildContext context) {
    final pages = state.document?.pages ?? [];
    final atLimit = pages.length >= notebookMaxPages;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InputDecorator(
          decoration: InputDecoration(
            labelText: ProjectNotebookL10n.selectPage.resolve(context),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              isExpanded: true,
              value: state.selectedPageId,
              items: [
                for (var index = 0; index < pages.length; index += 1)
                  DropdownMenuItem(
                    value: pages[index].id,
                    child: Text('${index + 1}. ${pages[index].title}'),
                  ),
              ],
              onChanged: (value) {
                if (value != null) {
                  controller.selectPage(value);
                }
              },
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        if (!state.readOnly)
          SizedBox(
            width: double.infinity,
            height: 48,
            child: FilledButton.tonalIcon(
              onPressed: atLimit
                  ? null
                  : () => controller.addPage(
                      Localizations.localeOf(context).languageCode,
                    ),
              icon: const Icon(Icons.add),
              label: Text(ProjectNotebookL10n.addPage.resolve(context)),
            ),
          ),
        if (atLimit && !state.readOnly) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            ProjectNotebookL10n.pageLimitReached.resolve(context),
            style: AppTextStyles.label(context).copyWith(fontSize: 12),
          ),
        ],
        const SizedBox(height: AppSpacing.md),
        _EditorCard(
          state: state,
          controller: controller,
          canvasKeyFor: canvasKeyFor,
          titleControllerFor: titleControllerFor,
          textControllerFor: textControllerFor,
          titleFocusNodeFor: titleFocusNodeFor,
          textFocusNodeFor: textFocusNodeFor,
          editorMode: editorMode,
          drawingTool: drawingTool,
          selectedColor: selectedColor,
          selectedWidth: selectedWidth,
          onEditorModeChanged: onEditorModeChanged,
          onDrawingToolChanged: onDrawingToolChanged,
          onColorChanged: onColorChanged,
          onWidthChanged: onWidthChanged,
        ),
      ],
    );
  }
}

class _EditorCard extends StatelessWidget {
  const _EditorCard({
    required this.state,
    required this.controller,
    required this.canvasKeyFor,
    required this.titleControllerFor,
    required this.textControllerFor,
    required this.titleFocusNodeFor,
    required this.textFocusNodeFor,
    required this.editorMode,
    required this.drawingTool,
    required this.selectedColor,
    required this.selectedWidth,
    required this.onEditorModeChanged,
    required this.onDrawingToolChanged,
    required this.onColorChanged,
    required this.onWidthChanged,
  });

  final ProjectNotebookState state;
  final ProjectNotebookController controller;
  final GlobalKey<NotebookDrawingCanvasState> Function(String pageId) canvasKeyFor;
  final TextEditingController Function(NotebookPage page) titleControllerFor;
  final TextEditingController Function(NotebookPage page) textControllerFor;
  final FocusNode Function(String pageId) titleFocusNodeFor;
  final FocusNode Function(String pageId) textFocusNodeFor;
  final _NotebookEditorMode editorMode;
  final NotebookDrawingTool drawingTool;
  final String selectedColor;
  final double selectedWidth;
  final ValueChanged<_NotebookEditorMode> onEditorModeChanged;
  final ValueChanged<NotebookDrawingTool> onDrawingToolChanged;
  final ValueChanged<String> onColorChanged;
  final ValueChanged<double> onWidthChanged;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final page = state.selectedPage;
    if (page == null) {
      return const SizedBox.shrink();
    }

    final titleController = titleControllerFor(page);
    final textController = textControllerFor(page);
    final titleFocusNode = titleFocusNodeFor(page.id);
    final textFocusNode = textFocusNodeFor(page.id);
    final canvasKey = canvasKeyFor(page.id);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SegmentedButton<_NotebookEditorMode>(
            segments: [
              ButtonSegment(
                value: _NotebookEditorMode.notes,
                icon: const Icon(Icons.notes_outlined, size: 18),
                label: Text(ProjectNotebookL10n.notes.resolve(context)),
              ),
              ButtonSegment(
                value: _NotebookEditorMode.drawing,
                icon: const Icon(Icons.draw_outlined, size: 18),
                label: Text(ProjectNotebookL10n.drawing.resolve(context)),
              ),
            ],
            selected: {editorMode},
            onSelectionChanged: state.readOnly
                ? null
                : (selection) => onEditorModeChanged(selection.first),
          ),
          const SizedBox(height: AppSpacing.md),
          _StablePageTextFields(
            key: ValueKey('page-fields-${page.id}'),
            pageId: page.id,
            readOnly: state.readOnly,
            showNotes: editorMode == _NotebookEditorMode.notes,
            titleController: titleController,
            textController: textController,
            titleFocusNode: titleFocusNode,
            textFocusNode: textFocusNode,
            onTitleChanged: (value) => controller.updatePageTitle(page.id, value),
            onTextChanged: (value) => controller.updatePageText(page.id, value),
          ),
          if (editorMode == _NotebookEditorMode.drawing) ...[
            _DrawingToolbar(
              readOnly: state.readOnly,
              drawingTool: drawingTool,
              selectedColor: selectedColor,
              selectedWidth: selectedWidth,
              canvasKey: canvasKey,
              onDrawingToolChanged: onDrawingToolChanged,
              onColorChanged: onColorChanged,
              onWidthChanged: onWidthChanged,
            ),
            const SizedBox(height: AppSpacing.sm),
            Semantics(
              label: ProjectNotebookL10n.drawingCanvas.resolve(context),
              child: NotebookDrawingCanvas(
                key: ValueKey('canvas-${page.id}'),
                strokes: page.strokes,
                readOnly: state.readOnly,
                selectedColor: selectedColor,
                selectedWidth: selectedWidth,
                selectedTool: drawingTool,
                onStrokesChanged: (strokes) =>
                    controller.updatePageStrokes(page.id, strokes),
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              ProjectNotebookL10n.drawHelper.resolve(context),
              style: AppTextStyles.label(context).copyWith(
                color: palette.textMuted,
                fontSize: 12,
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.lg),
          _EditorFooter(state: state),
          const SizedBox(height: AppSpacing.md),
          _PrivacyCallout(),
        ],
      ),
    );
  }
}

class _StablePageTextFields extends StatelessWidget {
  const _StablePageTextFields({
    super.key,
    required this.pageId,
    required this.readOnly,
    required this.showNotes,
    required this.titleController,
    required this.textController,
    required this.titleFocusNode,
    required this.textFocusNode,
    required this.onTitleChanged,
    required this.onTextChanged,
  });

  final String pageId;
  final bool readOnly;
  final bool showNotes;
  final TextEditingController titleController;
  final TextEditingController textController;
  final FocusNode titleFocusNode;
  final FocusNode textFocusNode;
  final ValueChanged<String> onTitleChanged;
  final ValueChanged<String> onTextChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: titleController,
          focusNode: titleFocusNode,
          readOnly: readOnly,
          decoration: InputDecoration(
            labelText: ProjectNotebookL10n.pageTitle.resolve(context),
            border: const OutlineInputBorder(),
          ),
          onChanged: onTitleChanged,
        ),
        if (showNotes) ...[
          const SizedBox(height: AppSpacing.md),
          ConstrainedBox(
            constraints: const BoxConstraints(minHeight: _kNotesMinHeight),
            child: TextField(
              controller: textController,
              focusNode: textFocusNode,
              readOnly: readOnly,
              minLines: 12,
              maxLines: 24,
              textAlignVertical: TextAlignVertical.top,
              decoration: InputDecoration(
                alignLabelWithHint: true,
                labelText: ProjectNotebookL10n.notes.resolve(context),
                border: const OutlineInputBorder(),
                contentPadding: const EdgeInsets.all(AppSpacing.md),
              ),
              style: AppTextStyles.body(context),
              onChanged: onTextChanged,
            ),
          ),
        ],
      ],
    );
  }
}

class _EditorFooter extends StatelessWidget {
  const _EditorFooter({required this.state});

  final ProjectNotebookState state;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final notebook = state.notebook;
    final pageCount = state.document?.pages.length ?? 0;

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: palette.mutedSurface,
        borderRadius: AppRadius.mdAll,
      ),
      child: Wrap(
        spacing: AppSpacing.lg,
        runSpacing: AppSpacing.xs,
        children: [
          if (notebook?.updatedAt != null)
            Text(
              '${ProjectNotebookL10n.lastEdited.resolve(context)}: '
              '${MaterialLocalizations.of(context).formatMediumDate(notebook!.updatedAt!.toLocal())}',
              style: AppTextStyles.label(context).copyWith(
                color: palette.textSecondary,
                fontSize: 12,
              ),
            ),
          if (notebook?.createdAt != null)
            Text(
              '${ProjectNotebookL10n.created.resolve(context)}: '
              '${MaterialLocalizations.of(context).formatMediumDate(notebook!.createdAt!.toLocal())}',
              style: AppTextStyles.label(context).copyWith(
                color: palette.textSecondary,
                fontSize: 12,
              ),
            ),
          Text(
            '${ProjectNotebookL10n.totalPages.resolve(context)}: $pageCount',
            style: AppTextStyles.label(context).copyWith(
              color: palette.textSecondary,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

class _PrivacyCallout extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: palette.mint.withValues(alpha: 0.08),
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: palette.mint.withValues(alpha: 0.25)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.lock_outline, size: 16, color: palette.mint),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  ProjectNotebookL10n.privateToYou.resolve(context),
                  style: AppTextStyles.label(context).copyWith(
                    color: palette.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  ProjectNotebookL10n.privacyMessage.resolve(context),
                  style: AppTextStyles.label(context).copyWith(
                    color: palette.textSecondary,
                    fontSize: 12,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DrawingToolbar extends StatelessWidget {
  const _DrawingToolbar({
    required this.readOnly,
    required this.drawingTool,
    required this.selectedColor,
    required this.selectedWidth,
    required this.canvasKey,
    required this.onDrawingToolChanged,
    required this.onColorChanged,
    required this.onWidthChanged,
  });

  final bool readOnly;
  final NotebookDrawingTool drawingTool;
  final String selectedColor;
  final double selectedWidth;
  final GlobalKey<NotebookDrawingCanvasState> canvasKey;
  final ValueChanged<NotebookDrawingTool> onDrawingToolChanged;
  final ValueChanged<String> onColorChanged;
  final ValueChanged<double> onWidthChanged;

  @override
  Widget build(BuildContext context) {
    final canvasState = canvasKey.currentState;
    return Wrap(
      spacing: AppSpacing.xs,
      runSpacing: AppSpacing.xs,
      children: [
        _ToolButton(
          tooltip: ProjectNotebookL10n.pen.resolve(context),
          selected: drawingTool == NotebookDrawingTool.pen,
          icon: Icons.edit_outlined,
          onPressed: readOnly
              ? null
              : () => onDrawingToolChanged(NotebookDrawingTool.pen),
        ),
        _ToolButton(
          tooltip: ProjectNotebookL10n.eraser.resolve(context),
          selected: drawingTool == NotebookDrawingTool.eraser,
          icon: Icons.auto_fix_off_outlined,
          onPressed: readOnly
              ? null
              : () => onDrawingToolChanged(NotebookDrawingTool.eraser),
        ),
        _ToolButton(
          tooltip: ProjectNotebookL10n.undo.resolve(context),
          selected: false,
          icon: Icons.undo_rounded,
          enabled: !readOnly && (canvasState?.canUndo ?? false),
          onPressed: readOnly || !(canvasState?.canUndo ?? false)
              ? null
              : canvasState?.undo,
        ),
        _ToolButton(
          tooltip: ProjectNotebookL10n.redo.resolve(context),
          selected: false,
          icon: Icons.redo_rounded,
          enabled: !readOnly && (canvasState?.canRedo ?? false),
          onPressed: readOnly || !(canvasState?.canRedo ?? false)
              ? null
              : canvasState?.redo,
        ),
        for (final color in notebookSupportedColors)
          _ColorButton(
            color: color,
            selected: selectedColor == color,
            onPressed: readOnly ? null : () => onColorChanged(color),
          ),
        PopupMenuButton<double>(
          tooltip: ProjectNotebookL10n.strokeSize.resolve(context),
          enabled: !readOnly,
          onSelected: onWidthChanged,
          itemBuilder: (context) => [
            for (final width in notebookStrokeWidths)
              PopupMenuItem(value: width, child: Text('${width.toInt()}px')),
          ],
          child: Chip(label: Text('${selectedWidth.toInt()}px')),
        ),
        TextButton(
          onPressed: readOnly
              ? null
              : () => _confirmClearDrawing(context, canvasKey),
          child: Text(ProjectNotebookL10n.clearDrawing.resolve(context)),
        ),
      ],
    );
  }
}

class _ToolButton extends StatelessWidget {
  const _ToolButton({
    required this.tooltip,
    required this.selected,
    required this.icon,
    required this.onPressed,
    this.enabled = true,
  });

  final String tooltip;
  final bool selected;
  final IconData icon;
  final VoidCallback? onPressed;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return IconButton(
      tooltip: tooltip,
      onPressed: enabled ? onPressed : null,
      style: ButtonStyle(
        minimumSize: const WidgetStatePropertyAll(Size(48, 48)),
        backgroundColor: WidgetStatePropertyAll(
          selected ? palette.mint.withValues(alpha: 0.15) : Colors.transparent,
        ),
        side: selected
            ? WidgetStatePropertyAll(BorderSide(color: palette.mint, width: 2))
            : null,
      ),
      icon: Icon(icon),
    );
  }
}

class _ColorButton extends StatelessWidget {
  const _ColorButton({
    required this.color,
    required this.selected,
    required this.onPressed,
  });

  final String color;
  final bool selected;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final parsed = int.parse(color.replaceAll('#', ''), radix: 16);
    return IconButton(
      tooltip: color,
      onPressed: onPressed,
      style: ButtonStyle(
        minimumSize: const WidgetStatePropertyAll(Size(48, 48)),
      ),
      icon: Container(
        width: 24,
        height: 24,
        decoration: BoxDecoration(
          color: Color(0xFF000000 | parsed),
          shape: BoxShape.circle,
          border: selected
              ? Border.all(color: palette.mint, width: 2)
              : Border.all(color: palette.borderSubtle),
        ),
      ),
    );
  }
}

Future<void> _confirmDeletePage(
  BuildContext context,
  ProjectNotebookController controller,
  String pageId,
) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(ProjectNotebookL10n.deletePageTitle.resolve(context)),
      content: Text(ProjectNotebookL10n.deletePageBody.resolve(context)),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(ProjectNotebookL10n.cancel.resolve(context)),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: Text(ProjectNotebookL10n.delete.resolve(context)),
        ),
      ],
    ),
  );
  if (confirmed == true) {
    controller.deletePage(pageId);
  }
}

Future<void> _confirmClearDrawing(
  BuildContext context,
  GlobalKey<NotebookDrawingCanvasState> canvasKey,
) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(ProjectNotebookL10n.clearDrawingTitle.resolve(context)),
      content: Text(ProjectNotebookL10n.clearDrawingBody.resolve(context)),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(ProjectNotebookL10n.cancel.resolve(context)),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: Text(ProjectNotebookL10n.clear.resolve(context)),
        ),
      ],
    ),
  );
  if (confirmed == true) {
    await canvasKey.currentState?.clearDrawing();
  }
}
