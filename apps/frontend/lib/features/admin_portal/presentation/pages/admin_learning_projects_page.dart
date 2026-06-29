import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/config/api_config.dart';
import '../../../../core/errors/api_exception.dart';
import '../../data/admin_learning_projects_api.dart';
import '../../data/models/admin_learning_projects_models.dart';
import '../l10n/admin_l10n.dart';
import '../theme/admin_decoration_set.dart';
import '../theme/admin_palette.dart';
import '../widgets/admin_empty_state.dart';
import '../widgets/admin_kpi_card.dart' show AdminTypography;
import '../widgets/admin_monitoring_filters.dart';
import '../widgets/admin_monitoring_utils.dart';

class _LearningProjectFilters {
  const _LearningProjectFilters({
    required this.page,
    required this.search,
    required this.status,
    required this.categoryId,
    required this.difficulty,
    required this.timeRange,
    this.customDateFrom,
    this.customDateTo,
  });

  final int page;
  final String search;
  final String status;
  final String categoryId;
  final String difficulty;
  final String timeRange;
  final String? customDateFrom;
  final String? customDateTo;

  static const limit = 20;

  _LearningProjectFilters copyWith({
    int? page,
    String? search,
    String? status,
    String? categoryId,
    String? difficulty,
    String? timeRange,
    String? customDateFrom,
    String? customDateTo,
    bool clearCustomDates = false,
  }) {
    return _LearningProjectFilters(
      page: page ?? this.page,
      search: search ?? this.search,
      status: status ?? this.status,
      categoryId: categoryId ?? this.categoryId,
      difficulty: difficulty ?? this.difficulty,
      timeRange: timeRange ?? this.timeRange,
      customDateFrom:
          clearCustomDates ? null : (customDateFrom ?? this.customDateFrom),
      customDateTo:
          clearCustomDates ? null : (customDateTo ?? this.customDateTo),
    );
  }

  bool get hasActiveFilters =>
      search.isNotEmpty ||
      status != 'ALL' ||
      categoryId != 'ALL' ||
      difficulty != 'ALL' ||
      timeRange != kTimeRangeAll ||
      (customDateFrom != null && customDateFrom!.isNotEmpty) ||
      (customDateTo != null && customDateTo!.isNotEmpty);
}

class _LearningProjectFiltersNotifier
    extends Notifier<_LearningProjectFilters> {
  @override
  _LearningProjectFilters build() => const _LearningProjectFilters(
        page: 1,
        search: '',
        status: 'ALL',
        categoryId: 'ALL',
        difficulty: 'ALL',
        timeRange: kTimeRangeAll,
      );

  void setPage(int page) => state = state.copyWith(page: page);
  void setSearch(String search) =>
      state = state.copyWith(page: 1, search: search);
  void setStatus(String status) =>
      state = state.copyWith(page: 1, status: status);
  void setCategoryId(String categoryId) =>
      state = state.copyWith(page: 1, categoryId: categoryId);
  void setDifficulty(String difficulty) =>
      state = state.copyWith(page: 1, difficulty: difficulty);
  void setTimeRange(String timeRange) => state = state.copyWith(
        page: 1,
        timeRange: timeRange,
        clearCustomDates: timeRange != kTimeRangeCustom,
      );
  void setCustomDateFrom(String? value) =>
      state = state.copyWith(page: 1, customDateFrom: value);
  void setCustomDateTo(String? value) =>
      state = state.copyWith(page: 1, customDateTo: value);
  void reset() => state = build();
}

final _learningProjectFiltersProvider =
    NotifierProvider<_LearningProjectFiltersNotifier, _LearningProjectFilters>(
  _LearningProjectFiltersNotifier.new,
);

final adminLearningProjectsListProvider =
    FutureProvider.autoDispose((ref) async {
  final filters = ref.watch(_learningProjectFiltersProvider);
  final dateRange = resolveDateRange(
    timeRange: filters.timeRange,
    customDateFrom: filters.customDateFrom,
    customDateTo: filters.customDateTo,
  );
  if (dateRange.error != null) {
    throw ApiException(message: dateRange.error!);
  }

  final api = ref.watch(adminLearningProjectsApiProvider);
  return api.fetchProjects(
    page: filters.page,
    limit: _LearningProjectFilters.limit,
    search: filters.search,
    status: filters.status,
    categoryId: filters.categoryId,
    difficulty: filters.difficulty,
    dateFrom: dateRange.dateFrom,
    dateTo: dateRange.dateTo,
  );
});

Color _statusAccent(AdminPalette palette, String status) {
  switch (status) {
    case 'PENDING_REVIEW':
      return palette.amber;
    case 'PUBLISHED':
      return palette.green;
    case 'CHANGES_REQUESTED':
      return palette.purple;
    case 'REJECTED':
      return palette.red;
    case 'HIDDEN':
      return palette.amber;
    case 'ARCHIVED':
    case 'DRAFT':
      return palette.textMuted;
    default:
      return palette.primaryTeal;
  }
}

class _ProjectStatusBadge extends StatelessWidget {
  const _ProjectStatusBadge({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final accent = _statusAccent(palette, status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: palette.isDark ? 0.2 : 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: accent.withValues(alpha: 0.45)),
      ),
      child: Text(
        humanizeEnum(status),
        style: AdminTypography.kpiHelper(palette).copyWith(
          fontWeight: FontWeight.w700,
          fontSize: 11,
          color: accent,
        ),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }
}

class AdminLearningProjectsPage extends ConsumerStatefulWidget {
  const AdminLearningProjectsPage({super.key});

  @override
  ConsumerState<AdminLearningProjectsPage> createState() =>
      _AdminLearningProjectsPageState();
}

class _AdminLearningProjectsPageState
    extends ConsumerState<AdminLearningProjectsPage> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _refresh() => ref.invalidate(adminLearningProjectsListProvider);

  void _applySearch() {
    ref
        .read(_learningProjectFiltersProvider.notifier)
        .setSearch(_searchController.text.trim());
  }

  Future<void> _showDetails(String projectId) async {
    await showDialog<void>(
      context: context,
      builder: (context) => _ProjectDetailDialog(
        projectId: projectId,
        onActionCompleted: _refresh,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    final filters = ref.watch(_learningProjectFiltersProvider);
    final projectsAsync = ref.watch(adminLearningProjectsListProvider);
    final compact = MediaQuery.sizeOf(context).width < 1000;
    final dateRangeError = resolveDateRange(
      timeRange: filters.timeRange,
      customDateFrom: filters.customDateFrom,
      customDateTo: filters.customDateTo,
    ).error;

    return ColoredBox(
      color: palette.pageBackground,
      child: SingleChildScrollView(
        padding: const EdgeInsetsDirectional.fromSTEB(20, 16, 20, 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l.navLearningProjects, style: AdminTypography.pageTitle(palette)),
            const SizedBox(height: 4),
            Text(
              l.t(
                'Review learner-submitted projects, approve quality content, and moderate the Learning Hub.',
                'راجع مشاريع المتعلمين، وافق على المحتوى الجيد، واعتدل في مركز التعلم.',
              ),
              style: AdminTypography.pageSubtitle(palette),
            ),
            const SizedBox(height: 20),
            projectsAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 48),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (error, _) => AdminMonitoringErrorPanel(
                title: l.t(
                  'Could not load learning projects.',
                  'تعذر تحميل مشاريع التعلم.',
                ),
                message: error is ApiException
                    ? error.displayMessage
                    : error.toString(),
                onRetry: _refresh,
              ),
              data: (data) => Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _SummaryRow(summary: data.summary, palette: palette),
                  const SizedBox(height: 16),
                  _FiltersPanel(
                    compact: compact,
                    searchController: _searchController,
                    filters: filters,
                    filterOptions: data.filterOptions,
                    dateRangeError: dateRangeError,
                    onSearch: _applySearch,
                    onStatusChanged: (value) => ref
                        .read(_learningProjectFiltersProvider.notifier)
                        .setStatus(value),
                    onCategoryChanged: (value) => ref
                        .read(_learningProjectFiltersProvider.notifier)
                        .setCategoryId(value),
                    onDifficultyChanged: (value) => ref
                        .read(_learningProjectFiltersProvider.notifier)
                        .setDifficulty(value),
                    onTimeRangeChanged: (value) => ref
                        .read(_learningProjectFiltersProvider.notifier)
                        .setTimeRange(value),
                    onCustomDateFromChanged: (value) => ref
                        .read(_learningProjectFiltersProvider.notifier)
                        .setCustomDateFrom(value),
                    onCustomDateToChanged: (value) => ref
                        .read(_learningProjectFiltersProvider.notifier)
                        .setCustomDateTo(value),
                    onReset: () {
                      _searchController.clear();
                      ref.read(_learningProjectFiltersProvider.notifier).reset();
                    },
                    onRefresh: _refresh,
                  ),
                  const SizedBox(height: 16),
                  if (data.items.isEmpty)
                    AdminEmptyState(
                      icon: Icons.school_outlined,
                      title: filters.hasActiveFilters
                          ? l.t(
                              'No projects match these filters.',
                              'لا توجد مشاريع تطابق هذه الفلاتر.',
                            )
                          : l.t(
                              'No learning projects yet.',
                              'لا توجد مشاريع تعلم بعد.',
                            ),
                      subtitle: filters.hasActiveFilters
                          ? l.t(
                              'Try adjusting filters or reset to see all projects.',
                              'جرّب تعديل الفلاتر أو إعادة التعيين لعرض كل المشاريع.',
                            )
                          : l.t(
                              'Learner submissions will appear here for review.',
                              'ستظهر مشاركات المتعلمين هنا للمراجعة.',
                            ),
                    )
                  else ...[
                    _ProjectsList(
                      items: data.items,
                      compact: compact,
                      onDetails: _showDetails,
                    ),
                    const SizedBox(height: 12),
                    _PaginationRow(
                      page: data.pagination.page,
                      totalPages: data.pagination.totalPages,
                      total: data.pagination.total,
                      onPrevious: data.pagination.page > 1
                          ? () => ref
                              .read(_learningProjectFiltersProvider.notifier)
                              .setPage(data.pagination.page - 1)
                          : null,
                      onNext: data.pagination.page < data.pagination.totalPages
                          ? () => ref
                              .read(_learningProjectFiltersProvider.notifier)
                              .setPage(data.pagination.page + 1)
                          : null,
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.summary, required this.palette});

  final AdminLearningProjectsSummary summary;
  final AdminPalette palette;

  @override
  Widget build(BuildContext context) {
    final stats = [
      ('Total', summary.total, Icons.folder_outlined, palette.blue),
      ('Pending review', summary.pendingReview, Icons.hourglass_top_outlined,
          palette.amber),
      ('Published', summary.published, Icons.check_circle_outline, palette.green),
      ('Changes requested', summary.changesRequested,
          Icons.edit_note_outlined, palette.purple),
      ('Rejected / hidden', summary.rejectedHidden, Icons.block_outlined,
          palette.red),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 1100
            ? 5
            : constraints.maxWidth >= 720
                ? 3
                : constraints.maxWidth >= 480
                    ? 2
                    : 1;
        final itemWidth =
            (constraints.maxWidth - (columns - 1) * 12) / columns;
        return Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            for (final stat in stats)
              SizedBox(
                width: itemWidth,
                child: _SummaryCard(
                  label: stat.$1,
                  value: stat.$2.toString(),
                  icon: stat.$3,
                  accent: stat.$4,
                  palette: palette,
                ),
              ),
          ],
        );
      },
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.accent,
    required this.palette,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color accent;
  final AdminPalette palette;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: 88),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: palette.cardBorder),
      ),
      child: Container(
        decoration: BoxDecoration(
          border: Border(
            left: BorderSide(color: accent, width: 4),
          ),
        ),
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Icon(icon, color: accent, size: 22),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    value,
                    style: AdminTypography.pageTitle(palette).copyWith(
                      fontSize: 22,
                    ),
                  ),
                  Text(label, style: AdminTypography.kpiHelper(palette)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FiltersPanel extends StatelessWidget {
  const _FiltersPanel({
    required this.compact,
    required this.searchController,
    required this.filters,
    required this.filterOptions,
    required this.dateRangeError,
    required this.onSearch,
    required this.onStatusChanged,
    required this.onCategoryChanged,
    required this.onDifficultyChanged,
    required this.onTimeRangeChanged,
    required this.onCustomDateFromChanged,
    required this.onCustomDateToChanged,
    required this.onReset,
    required this.onRefresh,
  });

  final bool compact;
  final TextEditingController searchController;
  final _LearningProjectFilters filters;
  final AdminLearningProjectsFilterOptions filterOptions;
  final String? dateRangeError;
  final VoidCallback onSearch;
  final ValueChanged<String> onStatusChanged;
  final ValueChanged<String> onCategoryChanged;
  final ValueChanged<String> onDifficultyChanged;
  final ValueChanged<String> onTimeRangeChanged;
  final ValueChanged<String?> onCustomDateFromChanged;
  final ValueChanged<String?> onCustomDateToChanged;
  final VoidCallback onReset;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final statusValue = safeDropdownValue(
      filters.status,
      ['ALL', ...filterOptions.statuses],
    )!;
    final categoryValue = safeDropdownValue(
      filters.categoryId,
      ['ALL', ...filterOptions.categories.map((c) => c.id)],
    )!;
    final difficultyValue = safeDropdownValue(
      filters.difficulty,
      ['ALL', ...filterOptions.difficulties],
    )!;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: palette.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            spacing: 10,
            runSpacing: 10,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              SizedBox(
                width: compact ? double.infinity : 280,
                child: TextField(
                  controller: searchController,
                  decoration: InputDecoration(
                    hintText: 'Search title, author, category...',
                    prefixIcon: const Icon(Icons.search, size: 20),
                    isDense: true,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  onSubmitted: (_) => onSearch(),
                ),
              ),
              AdminCompactFilterDropdown(
                label: 'Status',
                value: statusValue,
                entries: [
                  const DropdownMenuEntry(value: 'ALL', label: 'All statuses'),
                  for (final status in filterOptions.statuses)
                    DropdownMenuEntry(
                      value: status,
                      label: humanizeEnum(status),
                    ),
                ],
                onSelected: onStatusChanged,
              ),
              AdminCompactFilterDropdown(
                label: 'Category',
                value: categoryValue,
                width: 200,
                entries: [
                  const DropdownMenuEntry(value: 'ALL', label: 'All categories'),
                  for (final category in filterOptions.categories)
                    DropdownMenuEntry(
                      value: category.id,
                      label: category.nameEn,
                    ),
                ],
                onSelected: onCategoryChanged,
              ),
              AdminCompactFilterDropdown(
                label: 'Difficulty',
                value: difficultyValue,
                entries: [
                  const DropdownMenuEntry(
                    value: 'ALL',
                    label: 'All difficulties',
                  ),
                  for (final difficulty in filterOptions.difficulties)
                    DropdownMenuEntry(
                      value: difficulty,
                      label: humanizeEnum(difficulty),
                    ),
                ],
                onSelected: onDifficultyChanged,
              ),
              AdminCompactFilterDropdown(
                label: 'Date range',
                value: filters.timeRange,
                entries: const [
                  DropdownMenuEntry(value: kTimeRangeAll, label: 'All time'),
                  DropdownMenuEntry(value: kTimeRangeToday, label: 'Today'),
                  DropdownMenuEntry(value: kTimeRangeLast7, label: 'Last 7 days'),
                  DropdownMenuEntry(value: kTimeRangeLast30, label: 'Last 30 days'),
                  DropdownMenuEntry(value: kTimeRangeCustom, label: 'Custom'),
                ],
                onSelected: onTimeRangeChanged,
              ),
              OutlinedButton.icon(
                onPressed: onSearch,
                icon: const Icon(Icons.search, size: 18),
                label: const Text('Search'),
              ),
              OutlinedButton.icon(
                onPressed: onReset,
                icon: const Icon(Icons.filter_alt_off_outlined, size: 18),
                label: const Text('Reset'),
              ),
              OutlinedButton.icon(
                onPressed: onRefresh,
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Refresh'),
              ),
            ],
          ),
          if (filters.timeRange == kTimeRangeCustom) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                AdminCompactDateField(
                  label: 'From',
                  value: filters.customDateFrom,
                  width: 180,
                  onChanged: onCustomDateFromChanged,
                ),
                AdminCompactDateField(
                  label: 'To',
                  value: filters.customDateTo,
                  width: 180,
                  onChanged: onCustomDateToChanged,
                ),
              ],
            ),
          ],
          if (dateRangeError != null) ...[
            const SizedBox(height: 8),
            Text(
              dateRangeError!,
              style: AdminTypography.kpiHelper(palette).copyWith(
                color: palette.red,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ProjectsList extends StatelessWidget {
  const _ProjectsList({
    required this.items,
    required this.compact,
    required this.onDetails,
  });

  final List<AdminLearningProjectListItem> items;
  final bool compact;
  final ValueChanged<String> onDetails;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    return Column(
      children: [
        for (final item in items)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Container(
              decoration: BoxDecoration(
                color: palette.cardBackground,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: palette.cardBorder),
              ),
              child: Container(
                decoration: BoxDecoration(
                  border: Border(
                    left: BorderSide(
                      color: _statusAccent(palette, item.status),
                      width: 3,
                    ),
                  ),
                ),
                padding: const EdgeInsets.all(12),
                child: compact
                    ? _ProjectRowCompact(item: item, onDetails: onDetails)
                    : _ProjectRowWide(item: item, onDetails: onDetails),
              ),
            ),
          ),
      ],
    );
  }
}

class _ProjectRowWide extends StatelessWidget {
  const _ProjectRowWide({required this.item, required this.onDetails});

  final AdminLearningProjectListItem item;
  final ValueChanged<String> onDetails;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final imageUrl = item.coverImageUrl;
    final submitted = formatAdminDateTime(item.submittedAt ?? item.createdAt);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        _ProjectThumbnail(imageUrl: imageUrl),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                item.title,
                style: AdminTypography.sectionTitle(palette),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),
              Text(
                '${displayPersonLabel(item.author.displayName, item.author.email)} · ${item.category.nameEn} · ${humanizeEnum(item.difficulty)}',
                style: AdminTypography.pageSubtitle(palette),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),
              Text(
                '${item.componentsCount} components · ${item.stepsCount} steps · Submitted $submitted',
                style: AdminTypography.kpiHelper(palette),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        _ProjectTrailingActions(item: item, onDetails: onDetails),
      ],
    );
  }
}

class _ProjectRowCompact extends StatelessWidget {
  const _ProjectRowCompact({required this.item, required this.onDetails});

  final AdminLearningProjectListItem item;
  final ValueChanged<String> onDetails;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _ProjectThumbnail(imageUrl: item.coverImageUrl),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                item.title,
                style: AdminTypography.sectionTitle(palette),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Align(
          alignment: AlignmentDirectional.centerEnd,
          child: _ProjectTrailingActions(
            item: item,
            onDetails: onDetails,
            allowWrap: true,
          ),
        ),
      ],
    );
  }
}

class _ProjectThumbnail extends StatelessWidget {
  const _ProjectThumbnail({this.imageUrl});

  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final resolved = imageUrl != null && imageUrl!.isNotEmpty
        ? ApiConfig.resolveMediaUrl(imageUrl!)
        : null;

    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: Container(
        width: 56,
        height: 56,
        color: palette.cardBackground,
        child: resolved == null
            ? Icon(Icons.image_outlined, color: palette.textMuted)
            : Image.network(
                resolved,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Icon(
                  Icons.broken_image_outlined,
                  color: palette.textMuted,
                ),
              ),
      ),
    );
  }
}

class _ProjectTrailingActions extends StatelessWidget {
  const _ProjectTrailingActions({
    required this.item,
    required this.onDetails,
    this.allowWrap = false,
  });

  final AdminLearningProjectListItem item;
  final ValueChanged<String> onDetails;
  final bool allowWrap;

  @override
  Widget build(BuildContext context) {
    final badge = _ProjectStatusBadge(status: item.status);
    final reviewButton = OutlinedButton(
      onPressed: () => onDetails(item.id),
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, 40),
        padding: const EdgeInsets.symmetric(horizontal: 16),
      ),
      child: const Text('Review'),
    );

    if (allowWrap) {
      return Wrap(
        spacing: 12,
        runSpacing: 8,
        crossAxisAlignment: WrapCrossAlignment.center,
        alignment: WrapAlignment.end,
        children: [badge, reviewButton],
      );
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        badge,
        const SizedBox(width: 12),
        reviewButton,
      ],
    );
  }
}

class _PaginationRow extends StatelessWidget {
  const _PaginationRow({
    required this.page,
    required this.totalPages,
    required this.total,
    required this.onPrevious,
    required this.onNext,
  });

  final int page;
  final int totalPages;
  final int total;
  final VoidCallback? onPrevious;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Row(
      children: [
        Text(
          'Page $page of $totalPages · $total total',
          style: AdminTypography.kpiHelper(palette),
        ),
        const Spacer(),
        OutlinedButton(onPressed: onPrevious, child: const Text('Previous')),
        const SizedBox(width: 8),
        OutlinedButton(onPressed: onNext, child: const Text('Next')),
      ],
    );
  }
}

class _ProjectDetailDialog extends ConsumerStatefulWidget {
  const _ProjectDetailDialog({
    required this.projectId,
    required this.onActionCompleted,
  });

  final String projectId;
  final VoidCallback onActionCompleted;

  @override
  ConsumerState<_ProjectDetailDialog> createState() =>
      _ProjectDetailDialogState();
}

class _ProjectDetailDialogState extends ConsumerState<_ProjectDetailDialog> {
  late final Future<AdminLearningProjectDetail> _detailFuture;

  @override
  void initState() {
    super.initState();
    _detailFuture = ref
        .read(adminLearningProjectsApiProvider)
        .fetchProjectDetail(widget.projectId);
  }

  Future<void> _reloadDetail() async {
    setState(() {
      _detailFuture = ref
          .read(adminLearningProjectsApiProvider)
          .fetchProjectDetail(widget.projectId);
    });
    await _detailFuture;
  }

  Future<String?> _promptReason(String title) async {
    final controller = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: controller,
          maxLines: 4,
          decoration: const InputDecoration(
            hintText: 'Enter a reason (required)',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              final value = controller.text.trim();
              if (value.length < 3) return;
              Navigator.of(context).pop(value);
            },
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
    controller.dispose();
    return result;
  }

  Future<void> _runAction(String action, AdminLearningProjectDetail detail) async {
    final api = ref.read(adminLearningProjectsApiProvider);
    try {
      switch (action) {
        case 'approve':
          final confirmed = await showDialog<bool>(
            context: context,
            builder: (context) => AlertDialog(
              title: const Text('Approve project'),
              content: Text('Publish "${detail.title}" to the Learning Hub?'),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(false),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: () => Navigator.of(context).pop(true),
                  child: const Text('Approve'),
                ),
              ],
            ),
          );
          if (confirmed != true || !mounted) return;
          await api.approveProject(detail.id);
        case 'request-changes':
          final reason = await _promptReason('Request changes');
          if (reason == null || !mounted) return;
          await api.requestChanges(id: detail.id, reason: reason);
        case 'reject':
          final reason = await _promptReason('Reject project');
          if (reason == null || !mounted) return;
          await api.rejectProject(id: detail.id, reason: reason);
        case 'hide':
          final reason = await _promptReason('Hide / unpublish project');
          if (reason == null || !mounted) return;
          await api.hideProject(id: detail.id, reason: reason);
        case 'restore':
          await api.restoreProject(detail.id);
        case 'archive':
          final reason = await _promptReason('Archive project');
          if (reason == null || !mounted) return;
          await api.archiveProject(id: detail.id, reason: reason);
      }
      if (!mounted) return;
      widget.onActionCompleted();
      await _reloadDetail();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Moderation action completed.')),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.displayMessage)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    return Dialog(
      insetPadding: const EdgeInsets.all(16),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: 920,
          maxHeight: MediaQuery.sizeOf(context).height * 0.9,
        ),
        child: FutureBuilder<AdminLearningProjectDetail>(
          future: _detailFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Padding(
                padding: EdgeInsets.all(48),
                child: Center(child: CircularProgressIndicator()),
              );
            }
            if (snapshot.hasError) {
              return Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      snapshot.error.toString(),
                      style: AdminTypography.pageSubtitle(palette),
                    ),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: const Text('Close'),
                    ),
                  ],
                ),
              );
            }

            final detail = snapshot.data!;
            final actions = detail.allowedActions;
            final cover = detail.coverImageUrl ??
                (detail.images.isNotEmpty ? detail.images.first.imageUrl : null);

            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 8, 0),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          detail.title,
                          style: AdminTypography.pageTitle(palette),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.of(context).pop(),
                        icon: const Icon(Icons.close),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            _ProjectStatusBadge(status: detail.status),
                            Chip(
                              label: Text(detail.category.nameEn),
                              visualDensity: VisualDensity.compact,
                            ),
                            Chip(
                              label: Text(humanizeEnum(detail.difficulty)),
                              visualDensity: VisualDensity.compact,
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        AdminDetailSection(
                          title: 'Author',
                          children: [
                            AdminDetailRow(
                              label: 'Name',
                              value: displayPersonLabel(
                                detail.author.displayName,
                                detail.author.email,
                              ),
                            ),
                            AdminDetailRow(
                              label: 'Email',
                              value: detail.author.email,
                            ),
                            if (detail.author.primaryRole != null)
                              AdminDetailRow(
                                label: 'Role',
                                value: humanizeEnum(detail.author.primaryRole!),
                              ),
                          ],
                        ),
                        AdminDetailSection(
                          title: 'Project overview',
                          children: [
                            AdminDetailRow(
                              label: 'Description',
                              value: detail.description,
                            ),
                            if (detail.estimatedDurationMinutes != null)
                              AdminDetailRow(
                                label: 'Estimated time',
                                value:
                                    '${detail.estimatedDurationMinutes} minutes',
                              ),
                            AdminDetailRow(
                              label: 'Submitted',
                              value: formatAdminDateTime(
                                    detail.submittedAt ?? detail.createdAt,
                                  ) ??
                                  '—',
                            ),
                          ],
                        ),
                        AdminDetailSection(
                          title: 'Images',
                          children: [
                            if (cover == null)
                              const AdminDetailRow(
                                label: 'Cover',
                                value: 'No image provided',
                                muted: true,
                              )
                            else
                              ClipRRect(
                                borderRadius: BorderRadius.circular(10),
                                child: Image.network(
                                  ApiConfig.resolveMediaUrl(cover),
                                  height: 180,
                                  width: double.infinity,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) => const SizedBox(
                                    height: 120,
                                    child: Center(
                                      child: Text('Image unavailable'),
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                        AdminDetailSection(
                          title: 'Required components',
                          children: detail.requiredComponents.isEmpty
                              ? const [
                                  AdminDetailRow(
                                    label: 'Components',
                                    value: 'No components listed',
                                    muted: true,
                                  ),
                                ]
                              : [
                                  for (final component
                                      in detail.requiredComponents)
                                    AdminDetailRow(
                                      label: component.name,
                                      value:
                                          '${component.quantity} ${component.unit}${component.isRequired ? '' : ' (optional)'}${component.notes != null ? ' · ${component.notes}' : ''}',
                                    ),
                                ],
                        ),
                        AdminDetailSection(
                          title: 'Steps',
                          children: detail.steps.isEmpty
                              ? const [
                                  AdminDetailRow(
                                    label: 'Steps',
                                    value: 'No steps provided',
                                    muted: true,
                                  ),
                                ]
                              : [
                                  for (final step in detail.steps)
                                    AdminDetailRow(
                                      label:
                                          'Step ${step.stepNumber}: ${step.title}',
                                      value: step.description,
                                    ),
                                ],
                        ),
                        AdminDetailSection(
                          title: 'Links',
                          children: detail.links.isEmpty
                              ? const [
                                  AdminDetailRow(
                                    label: 'Links',
                                    value: 'No links provided',
                                    muted: true,
                                  ),
                                ]
                              : [
                                  for (final link in detail.links)
                                    AdminDetailRow(
                                      label: link.title ?? link.linkType,
                                      value: link.url,
                                    ),
                                ],
                        ),
                        AdminDetailSection(
                          title: 'Moderation history',
                          children: [
                            AdminDetailRow(
                              label: 'Current status',
                              value: humanizeEnum(detail.status),
                            ),
                            if (detail.changesRequestedReason != null)
                              AdminDetailRow(
                                label: 'Changes requested',
                                value: detail.changesRequestedReason!,
                              ),
                            if (detail.rejectionReason != null)
                              AdminDetailRow(
                                label: 'Rejection reason',
                                value: detail.rejectionReason!,
                              ),
                            if (detail.hiddenReason != null)
                              AdminDetailRow(
                                label: 'Hidden reason',
                                value: detail.hiddenReason!,
                              ),
                            if (detail.archivedReason != null)
                              AdminDetailRow(
                                label: 'Archive reason',
                                value: detail.archivedReason!,
                              ),
                            if (detail.reviewedBy.displayName.isNotEmpty)
                              AdminDetailRow(
                                label: 'Reviewed by',
                                value: displayPersonLabel(
                                  detail.reviewedBy.displayName,
                                  detail.reviewedBy.email,
                                ),
                              ),
                            if (detail.reviewedAt != null)
                              AdminDetailRow(
                                label: 'Reviewed at',
                                value:
                                    formatAdminDateTime(detail.reviewedAt) ??
                                        '—',
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    alignment: WrapAlignment.end,
                    children: [
                      if (actions.canApprove)
                        FilledButton(
                          onPressed: () => _runAction('approve', detail),
                          child: const Text('Approve'),
                        ),
                      if (actions.canRequestChanges)
                        OutlinedButton(
                          onPressed: () =>
                              _runAction('request-changes', detail),
                          child: const Text('Request changes'),
                        ),
                      if (actions.canReject)
                        OutlinedButton(
                          onPressed: () => _runAction('reject', detail),
                          child: const Text('Reject'),
                        ),
                      if (actions.canHide)
                        OutlinedButton(
                          onPressed: () => _runAction('hide', detail),
                          child: const Text('Hide / unpublish'),
                        ),
                      if (actions.canRestore)
                        OutlinedButton(
                          onPressed: () => _runAction('restore', detail),
                          child: const Text('Restore / republish'),
                        ),
                      if (actions.canArchive)
                        OutlinedButton(
                          onPressed: () => _runAction('archive', detail),
                          child: const Text('Archive project'),
                        ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
