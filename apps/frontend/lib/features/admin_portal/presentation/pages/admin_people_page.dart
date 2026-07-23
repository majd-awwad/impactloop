import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_dialog_detail.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/supplier_verification_status_presentation.dart';
import '../../data/admin_people_api.dart';
import '../theme/admin_decoration_set.dart';
import '../widgets/admin_empty_state.dart';
import '../widgets/admin_kpi_card.dart' show AdminKpiCard, AdminTypography;

class _PeopleFilters {
  const _PeopleFilters({
    required this.tab,
    required this.search,
    required this.status,
    required this.page,
  });

  final String tab;
  final String search;
  final String status;
  final int page;

  _PeopleFilters copyWith({
    String? tab,
    String? search,
    String? status,
    int? page,
  }) {
    return _PeopleFilters(
      tab: tab ?? this.tab,
      search: search ?? this.search,
      status: status ?? this.status,
      page: page ?? this.page,
    );
  }
}

class _PeopleFiltersNotifier extends Notifier<_PeopleFilters> {
  @override
  _PeopleFilters build() =>
      const _PeopleFilters(tab: 'ALL', search: '', status: 'ALL', page: 1);

  void setTab(String tab) => state = state.copyWith(tab: tab, page: 1);
  void setSearch(String search) =>
      state = state.copyWith(search: search, page: 1);
  void setStatus(String status) =>
      state = state.copyWith(status: status, page: 1);
  void setPage(int page) => state = state.copyWith(page: page);
  void reset() => state = build();
}

final _peopleFiltersProvider =
    NotifierProvider<_PeopleFiltersNotifier, _PeopleFilters>(
      _PeopleFiltersNotifier.new,
    );

final adminPeopleSummaryProvider = FutureProvider.autoDispose((ref) {
  return ref.watch(adminPeopleApiProvider).fetchSummary();
});

final adminPeopleListProvider = FutureProvider.autoDispose((ref) async {
  final filters = ref.watch(_peopleFiltersProvider);
  return ref
      .watch(adminPeopleApiProvider)
      .fetchPeople(
        tab: filters.tab,
        search: filters.search,
        status: filters.status == 'ALL' ? null : filters.status,
        page: filters.page,
      );
});

String _formatStatus(String status) =>
    status.replaceAll('_', ' ').toLowerCase();

String _formatRole(String? role) =>
    role?.replaceAll('_', ' ').toLowerCase() ?? 'unknown';

AppStatusTone _peopleAccountStatusTone(String status) {
  switch (status.trim().toUpperCase()) {
    case 'ACTIVE':
      return AppStatusTone.success;
    case 'SUSPENDED':
      return AppStatusTone.danger;
    case 'DISABLED':
      return AppStatusTone.danger;
    case 'PENDING_VERIFICATION':
      return AppStatusTone.warning;
    default:
      return AppStatusTone.neutral;
  }
}

AppStatusTone _roleTone(String? role) {
  switch (role?.trim().toUpperCase()) {
    case 'LEARNER':
      return AppStatusTone.info;
    case 'SUPPLIER':
      return AppStatusTone.success;
    case 'DRIVER':
      return AppStatusTone.info;
    case 'MODERATOR':
      return AppStatusTone.neutral;
    case 'ADMIN':
      return AppStatusTone.warning;
    default:
      return AppStatusTone.neutral;
  }
}

AppStatusTone _driverStatusTone(String status) {
  switch (status.trim().toUpperCase()) {
    case 'ACTIVE':
      return AppStatusTone.success;
    case 'INACTIVE':
      return AppStatusTone.neutral;
    case 'SUSPENDED':
      return AppStatusTone.warning;
    default:
      return AppStatusTone.info;
  }
}

String _suspensionPreviewLine(String? reason) {
  final trimmed = reason?.trim();
  if (trimmed == null || trimmed.isEmpty) {
    return 'Suspended: reason not recorded';
  }
  final preview = trimmed.length > 80
      ? '${trimmed.substring(0, 80)}…'
      : trimmed;
  return 'Suspended: $preview';
}

String? _formatSuspendedBy(dynamic raw) {
  if (raw is! Map) return null;
  final name = raw['displayName'] as String? ?? '';
  final email = raw['email'] as String? ?? '';
  if (name.isEmpty && email.isEmpty) return null;
  if (name.isEmpty) return email;
  if (email.isEmpty) return name;
  return '$name ($email)';
}

String _suspensionReasonText(dynamic raw) {
  final reason = raw?.toString().trim();
  if (reason == null || reason.isEmpty) {
    return 'Reason not recorded for this older suspension.';
  }
  return reason;
}

const _peopleTabs = <(String, String)>[
  ('ALL', 'All users'),
  ('LEARNERS', 'Learners'),
  ('SUPPLIERS', 'Suppliers'),
  ('DRIVERS', 'Drivers'),
  ('MODERATORS', 'Moderators'),
  ('ADMINS', 'Admins'),
];

String? _formatDetailDate(dynamic value) {
  if (value == null) return null;
  final parsed = DateTime.tryParse(value.toString());
  if (parsed == null) return value.toString();
  return DateFormat.yMMMd().add_jm().format(parsed);
}

String? _formatRelativeLogin(String? value) {
  if (value == null || value.trim().isEmpty) return null;
  final parsed = DateTime.tryParse(value);
  if (parsed == null) return null;
  final diff = DateTime.now().difference(parsed);
  if (diff.inMinutes < 1) return 'Just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays < 7) return '${diff.inDays}d ago';
  return DateFormat.yMMMd().format(parsed);
}

int _detailMetric(Map<String, dynamic> detail, String key) =>
    (detail[key] as num?)?.toInt() ?? 0;

const _validPeopleTabs = {
  'ALL',
  'LEARNERS',
  'SUPPLIERS',
  'DRIVERS',
  'MODERATORS',
  'ADMINS',
};

const _roleToPeopleTab = {
  'LEARNER': 'LEARNERS',
  'SUPPLIER': 'SUPPLIERS',
  'DRIVER': 'DRIVERS',
  'MODERATOR': 'MODERATORS',
  'ADMIN': 'ADMINS',
};

const double _actionsColumnWidth = 150;

String _capitalizeFirst(String value) {
  if (value.isEmpty) return value;
  return value[0].toUpperCase() + value.substring(1);
}

class AdminPeoplePage extends ConsumerStatefulWidget {
  const AdminPeoplePage({super.key, this.initialRole, this.initialTab});

  final String? initialRole;
  final String? initialTab;

  @override
  ConsumerState<AdminPeoplePage> createState() => _AdminPeoplePageState();
}

class _AdminPeoplePageState extends ConsumerState<AdminPeoplePage> {
  final _searchController = TextEditingController();
  var _appliedInitialTab = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _applyInitialTabIfNeeded(),
    );
  }

  @override
  void didUpdateWidget(AdminPeoplePage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialRole != widget.initialRole ||
        oldWidget.initialTab != widget.initialTab) {
      _appliedInitialTab = false;
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => _applyInitialTabIfNeeded(),
      );
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  String? _resolveInitialTab() {
    final role = widget.initialRole?.trim().toUpperCase();
    if (role != null && role.isNotEmpty) {
      return _roleToPeopleTab[role];
    }
    final tab = widget.initialTab?.trim().toUpperCase();
    if (tab != null && _validPeopleTabs.contains(tab)) {
      return tab;
    }
    return null;
  }

  void _applyInitialTabIfNeeded() {
    if (!mounted || _appliedInitialTab) return;
    final hasQuery =
        (widget.initialRole?.trim().isNotEmpty ?? false) ||
        (widget.initialTab?.trim().isNotEmpty ?? false);
    if (!hasQuery) return;
    _appliedInitialTab = true;
    final tab = _resolveInitialTab();
    if (tab == null) return;
    ref.read(_peopleFiltersProvider.notifier).setTab(tab);
  }

  void _refresh() {
    ref.invalidate(adminPeopleSummaryProvider);
    ref.invalidate(adminPeopleListProvider);
  }

  Future<void> _runAction(
    Future<void> Function() action, {
    String successMessage = 'Action completed successfully.',
  }) async {
    try {
      await action();
      if (!mounted) return;
      _refresh();
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(successMessage)));
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.displayMessage)));
    }
  }

  Future<void> _showDetails(AdminPeopleListItem item) async {
    try {
      final detail = await ref
          .read(adminPeopleApiProvider)
          .fetchPersonDetail(item.userId);
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (context) => _PersonDetailDialog(detail: detail),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.displayMessage)));
    }
  }

  Future<void> _confirmSuspend(AdminPeopleListItem item) async {
    final reasonController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AppDialogShell(
        title: const Text('Suspend account'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Suspend ${item.displayName}?'),
            const SizedBox(height: AppSpacing.sm),
            const Text(
              'This will prevent the user from performing important actions, but their existing data and history will remain.',
            ),
            const SizedBox(height: AppSpacing.md - AppSpacing.xs),
            TextField(
              controller: reasonController,
              decoration: const InputDecoration(
                labelText: 'Reason (required)',
                border: OutlineInputBorder(),
              ),
              maxLines: 3,
            ),
          ],
        ),
        footer: AppDialogFooter.decision(
          secondaryAction: TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          primaryAction: FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            style: AppStatusButtonStyle.filled(
              dialogContext,
              AppStatusTone.warning,
            ),
            child: const Text('Suspend account'),
          ),
        ),
      ),
    );

    if (confirmed != true) {
      reasonController.dispose();
      return;
    }

    final reason = reasonController.text.trim();
    reasonController.dispose();
    if (reason.length < 3) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'A suspension reason of at least 3 characters is required.',
          ),
        ),
      );
      return;
    }

    await _runAction(
      () => ref
          .read(adminPeopleApiProvider)
          .suspendPerson(userId: item.userId, reason: reason),
      successMessage: 'Account suspended.',
    );
  }

  Future<void> _confirmReactivate(AdminPeopleListItem item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AppDialogShell(
        title: const Text('Reactivate account'),
        content: Text(
          'Restore access for ${item.displayName}? Their existing data and history were kept while suspended.',
        ),
        footer: AppDialogFooter.decision(
          secondaryAction: TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          primaryAction: FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            style: AppStatusButtonStyle.filled(
              dialogContext,
              AppStatusTone.primary,
            ),
            child: const Text('Reactivate account'),
          ),
        ),
      ),
    );

    if (confirmed != true) return;

    await _runAction(
      () => ref
          .read(adminPeopleApiProvider)
          .reactivatePerson(userId: item.userId),
      successMessage: 'Account reactivated.',
    );
  }

  void _applySearch() {
    ref
        .read(_peopleFiltersProvider.notifier)
        .setSearch(_searchController.text.trim());
  }

  void _resetFilters() {
    _searchController.clear();
    ref.read(_peopleFiltersProvider.notifier).reset();
    context.go('/admin/users');
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final colors = AppThemeColors.of(context);
    final filters = ref.watch(_peopleFiltersProvider);
    final summaryAsync = ref.watch(adminPeopleSummaryProvider);
    final peopleAsync = ref.watch(adminPeopleListProvider);

    return ColoredBox(
      color: colors.pageBackground,
      child: SingleChildScrollView(
        padding: const EdgeInsetsDirectional.fromSTEB(
          AppSpacing.lg - AppSpacing.xs,
          AppSpacing.md,
          AppSpacing.lg - AppSpacing.xs,
          AppSpacing.lg + AppSpacing.xs,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _UsersPageHeader(
              onInvite: () => context.push('/admin/invitations'),
            ),
            const SizedBox(height: AppSpacing.md + AppSpacing.xs),
            summaryAsync.when(
              loading: () => const LinearProgressIndicator(),
              error: (_, _) => const SizedBox.shrink(),
              data: (summary) => _UsersKpiGrid(summary: summary),
            ),
            const SizedBox(height: AppSpacing.md + AppSpacing.xs),
            _RoleFilterTabs(
              selectedTab: filters.tab,
              onTabSelected: (tab) =>
                  ref.read(_peopleFiltersProvider.notifier).setTab(tab),
            ),
            const SizedBox(height: AppSpacing.sm + 2),
            _UsersFilterPanel(
              searchController: _searchController,
              statusFilter: filters.status,
              onStatusChanged: (value) =>
                  ref.read(_peopleFiltersProvider.notifier).setStatus(value),
              onSearch: _applySearch,
              onReset: _resetFilters,
            ),
            if (filters.tab == 'ADMINS') ...[
              const SizedBox(height: AppSpacing.md),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppSpacing.md - AppSpacing.xs),
                decoration: BoxDecoration(
                  color: palette.bannerBackground,
                  borderRadius: AppRadius.lgAll,
                  border: Border.all(color: palette.bannerBorder),
                ),
                child: Text(
                  'Admin accounts are view-only here. Pending admin invitations can be revoked from Invitations.',
                  style: AdminTypography.kpiHelper(palette),
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.md),
            peopleAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => AdminEmptyState(
                icon: Icons.people_outline,
                title: 'Could not load people',
                subtitle: error.toString(),
              ),
              data: (result) {
                if (result.items.isEmpty) {
                  return const AdminEmptyState(
                    icon: Icons.people_outline,
                    title: 'No accounts found',
                    subtitle: 'Try adjusting your filters or search.',
                  );
                }

                final pagination = result.pagination;
                final canGoPrevious = pagination.page > 1;
                final canGoNext = pagination.rangeEnd < pagination.total;

                return _UsersList(
                  items: result.items,
                  pagination: pagination,
                  onDetails: _showDetails,
                  onSuspend: _confirmSuspend,
                  onReactivate: _confirmReactivate,
                  onPreviousPage: canGoPrevious
                      ? () => ref
                            .read(_peopleFiltersProvider.notifier)
                            .setPage(pagination.page - 1)
                      : null,
                  onNextPage: canGoNext
                      ? () => ref
                            .read(_peopleFiltersProvider.notifier)
                            .setPage(pagination.page + 1)
                      : null,
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _UsersPageHeader extends StatelessWidget {
  const _UsersPageHeader({required this.onInvite});

  final VoidCallback onInvite;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final width = MediaQuery.sizeOf(context).width;
    final compact = width < 720;

    final titleBlock = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Users',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.w800,
            color: palette.textPrimary,
            height: 1.2,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          'Review and manage platform accounts. Admin accounts are read-only in this MVP.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: palette.textSecondary,
            height: 1.35,
          ),
        ),
      ],
    );

    final inviteButton = FilledButton.icon(
      onPressed: onInvite,
      icon: const Icon(Icons.person_add_outlined, size: 18),
      label: const Text('Invite user'),
      style: AppStatusButtonStyle.filled(
        context,
        AppStatusTone.primary,
        visualDensity: VisualDensity.compact,
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
      ),
    );

    if (compact) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          titleBlock,
          const SizedBox(height: AppSpacing.md),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: inviteButton,
          ),
        ],
      );
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: titleBlock),
        inviteButton,
      ],
    );
  }
}

class _UsersKpiGrid extends StatelessWidget {
  const _UsersKpiGrid({required this.summary});

  final AdminPeopleSummary summary;

  String _shareHint(int part, int total) {
    if (total <= 0) return 'No accounts yet';
    final pct = ((part / total) * 100).round();
    return '$pct% of platform users';
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final width = MediaQuery.sizeOf(context).width;
    final columns = width >= 1500
        ? 8
        : width >= 1100
        ? 4
        : width >= 560
        ? 2
        : 1;
    const spacing = AppSpacing.sm + 2;

    final cards = <AdminKpiCard>[
      AdminKpiCard(
        label: 'Total users',
        value: '${summary.total}',
        helper: summary.newThisMonth > 0
            ? '+${summary.newThisMonth} this month'
            : 'No new signups this month',
        icon: Icons.people_outline,
        accent: palette.blue,
      ),
      AdminKpiCard(
        label: 'Learners',
        value: '${summary.learners}',
        helper: _shareHint(summary.learners, summary.total),
        icon: Icons.school_outlined,
        accent: palette.primaryTeal,
      ),
      AdminKpiCard(
        label: 'Suppliers',
        value: '${summary.suppliers}',
        helper: summary.suppliers > 0
            ? '${summary.verifiedSuppliers} verified'
            : 'No suppliers yet',
        icon: Icons.storefront_outlined,
        accent: palette.green,
      ),
      AdminKpiCard(
        label: 'Drivers',
        value: '${summary.drivers}',
        helper: _shareHint(summary.drivers, summary.total),
        icon: Icons.local_shipping_outlined,
        accent: palette.brightTeal,
      ),
      AdminKpiCard(
        label: 'Moderators',
        value: '${summary.moderators}',
        helper: _shareHint(summary.moderators, summary.total),
        icon: Icons.shield_outlined,
        accent: palette.purple,
      ),
      AdminKpiCard(
        label: 'Admins',
        value: '${summary.admins}',
        helper: _shareHint(summary.admins, summary.total),
        icon: Icons.admin_panel_settings_outlined,
        accent: palette.amber,
      ),
      AdminKpiCard(
        label: 'Suspended',
        value: '${summary.suspended}',
        helper: summary.suspended > 0
            ? 'Currently suspended'
            : 'None suspended',
        icon: Icons.block_outlined,
        accent: palette.red,
      ),
      AdminKpiCard(
        label: 'Active users',
        value: '${summary.activeUsers}',
        helper: 'Currently active',
        icon: Icons.verified_user_outlined,
        accent: palette.green,
      ),
    ];

    final rows = <Widget>[];
    for (var i = 0; i < cards.length; i += columns) {
      final rowCards = cards.skip(i).take(columns).toList();
      rows.add(
        Padding(
          padding: EdgeInsets.only(
            bottom: i + columns < cards.length ? spacing : 0,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var j = 0; j < columns; j++) ...[
                if (j > 0) const SizedBox(width: spacing),
                Expanded(
                  child: j < rowCards.length
                      ? rowCards[j]
                      : const SizedBox.shrink(),
                ),
              ],
            ],
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: rows,
    );
  }
}

class _RoleFilterTabs extends StatelessWidget {
  const _RoleFilterTabs({
    required this.selectedTab,
    required this.onTabSelected,
  });

  final String selectedTab;
  final ValueChanged<String> onTabSelected;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final primaryStyle = AppStatusStyle.of(context, AppStatusTone.primary);

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: _peopleTabs.map((tab) {
          final isSelected = selectedTab == tab.$1;
          return Padding(
            padding: const EdgeInsetsDirectional.only(end: AppSpacing.sm),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () => onTabSelected(tab.$1),
                borderRadius: AppRadius.pillAll,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  padding: const EdgeInsetsDirectional.symmetric(
                    horizontal: AppSpacing.md - AppSpacing.xs,
                    vertical: AppSpacing.sm,
                  ),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? primaryStyle.selectedBackground
                        : colors.surfaceMuted,
                    borderRadius: AppRadius.pillAll,
                    border: Border.all(
                      color: isSelected
                          ? primaryStyle.selectedBorder
                          : colors.borderSubtle,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (isSelected) ...[
                        Icon(
                          Icons.check_circle,
                          size: 16,
                          color: primaryStyle.foreground,
                        ),
                        const SizedBox(width: AppSpacing.xs + 2),
                      ],
                      Text(
                        tab.$2,
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: isSelected
                              ? primaryStyle.foreground
                              : colors.textSecondary,
                          fontWeight: isSelected
                              ? FontWeight.w700
                              : FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _UsersFilterPanel extends StatelessWidget {
  const _UsersFilterPanel({
    required this.searchController,
    required this.statusFilter,
    required this.onStatusChanged,
    required this.onSearch,
    required this.onReset,
  });

  final TextEditingController searchController;
  final String statusFilter;
  final ValueChanged<String> onStatusChanged;
  final VoidCallback onSearch;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final palette = context.adminPalette;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md - AppSpacing.xs,
        vertical: AppSpacing.sm + 2,
      ),
      decoration: BoxDecoration(
        color: colors.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.borderSubtle),
        boxShadow: [
          BoxShadow(
            color: colors.shadow.withValues(
              alpha: palette.isDark ? 0.16 : 0.05,
            ),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final compact = constraints.maxWidth < 760;

          final searchField = TextField(
            controller: searchController,
            textInputAction: TextInputAction.search,
            onSubmitted: (_) => onSearch(),
            decoration: InputDecoration(
              hintText: 'Search by name or email...',
              prefixIcon: const Icon(Icons.search),
              filled: true,
              fillColor: colors.surfaceMuted,
              border: OutlineInputBorder(
                borderRadius: AppRadius.mdAll,
                borderSide: BorderSide(color: colors.borderSubtle),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: AppRadius.mdAll,
                borderSide: BorderSide(color: colors.borderSubtle),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: AppRadius.mdAll,
                borderSide: BorderSide(color: colors.primary),
              ),
              isDense: true,
              contentPadding: const EdgeInsetsDirectional.symmetric(
                horizontal: AppSpacing.md - AppSpacing.xs,
                vertical: AppSpacing.md - AppSpacing.xs,
              ),
            ),
          );

          final statusDropdown = SizedBox(
            width: compact ? double.infinity : 200,
            child: DropdownMenu<String>(
              key: ValueKey('status-$statusFilter'),
              label: const Text('Status'),
              initialSelection: statusFilter,
              expandedInsets: EdgeInsets.zero,
              dropdownMenuEntries: const [
                DropdownMenuEntry(value: 'ALL', label: 'All statuses'),
                DropdownMenuEntry(value: 'ACTIVE', label: 'Active'),
                DropdownMenuEntry(value: 'SUSPENDED', label: 'Suspended'),
                DropdownMenuEntry(
                  value: 'PENDING_VERIFICATION',
                  label: 'Pending verification',
                ),
                DropdownMenuEntry(value: 'DISABLED', label: 'Disabled'),
              ],
              onSelected: (value) {
                if (value != null) onStatusChanged(value);
              },
            ),
          );

          final searchButton = FilledButton.icon(
            onPressed: onSearch,
            icon: const Icon(Icons.search, size: 18),
            label: const Text('Search'),
            style: AppStatusButtonStyle.filled(
              context,
              AppStatusTone.primary,
              visualDensity: VisualDensity.compact,
              padding: const EdgeInsetsDirectional.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.sm,
              ),
            ),
          );

          final resetButton = OutlinedButton.icon(
            onPressed: onReset,
            icon: const Icon(Icons.refresh, size: 18),
            label: const Text('Reset'),
          );

          if (compact) {
            return Wrap(
              spacing: AppSpacing.md - AppSpacing.xs,
              runSpacing: AppSpacing.md - AppSpacing.xs,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                SizedBox(width: double.infinity, child: searchField),
                statusDropdown,
                searchButton,
                resetButton,
              ],
            );
          }

          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: searchField),
              const SizedBox(width: AppSpacing.md - AppSpacing.xs),
              statusDropdown,
              const SizedBox(width: AppSpacing.md - AppSpacing.xs),
              searchButton,
              const SizedBox(width: AppSpacing.sm),
              resetButton,
            ],
          );
        },
      ),
    );
  }
}

class _UsersList extends StatelessWidget {
  const _UsersList({
    required this.items,
    required this.pagination,
    required this.onDetails,
    required this.onSuspend,
    required this.onReactivate,
    this.onPreviousPage,
    this.onNextPage,
  });

  final List<AdminPeopleListItem> items;
  final AdminPeoplePagination pagination;
  final Future<void> Function(AdminPeopleListItem item) onDetails;
  final Future<void> Function(AdminPeopleListItem item) onSuspend;
  final Future<void> Function(AdminPeopleListItem item) onReactivate;
  final VoidCallback? onPreviousPage;
  final VoidCallback? onNextPage;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final palette = context.adminPalette;
    final compact = MediaQuery.sizeOf(context).width < 900;
    final totalLabel =
        '${pagination.total} user${pagination.total == 1 ? '' : 's'}';
    final rangeLabel = pagination.total == 0
        ? '0 results'
        : '${pagination.rangeStart}–${pagination.rangeEnd} of ${pagination.total}';

    final listHeader = Padding(
      padding: const EdgeInsetsDirectional.fromSTEB(
        AppSpacing.md,
        AppSpacing.md - AppSpacing.xs,
        AppSpacing.md,
        AppSpacing.sm,
      ),
      child: Row(
        children: [
          Text(
            totalLabel,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: palette.textPrimary,
            ),
          ),
          const Spacer(),
          Text(
            rangeLabel,
            style: Theme.of(
              context,
            ).textTheme.labelMedium?.copyWith(color: colors.textMuted),
          ),
          const SizedBox(width: AppSpacing.sm),
          _PaginationArrow(
            icon: Icons.chevron_left,
            tooltip: 'Previous page',
            onPressed: onPreviousPage,
          ),
          const SizedBox(width: AppSpacing.xs),
          _PaginationArrow(
            icon: Icons.chevron_right,
            tooltip: 'Next page',
            onPressed: onNextPage,
          ),
        ],
      ),
    );

    if (compact) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            decoration: BoxDecoration(
              color: colors.cardSurface,
              borderRadius: AppRadius.lgAll,
              border: Border.all(color: colors.borderSubtle),
            ),
            child: listHeader,
          ),
          const SizedBox(height: AppSpacing.sm),
          for (var i = 0; i < items.length; i++)
            Padding(
              padding: EdgeInsets.only(
                bottom: i < items.length - 1
                    ? AppSpacing.md - AppSpacing.xs
                    : 0,
              ),
              child: _UserRow(
                item: items[i],
                compact: true,
                onDetails: () => onDetails(items[i]),
                onSuspend: items[i].canSuspend
                    ? () => onSuspend(items[i])
                    : null,
                onReactivate: items[i].canReactivate
                    ? () => onReactivate(items[i])
                    : null,
              ),
            ),
        ],
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: colors.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.borderSubtle),
        boxShadow: [
          BoxShadow(
            color: colors.shadow.withValues(
              alpha: palette.isDark ? 0.16 : 0.05,
            ),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          listHeader,
          Divider(height: 1, color: colors.borderSubtle),
          const _UsersColumnHeaderRow(),
          Divider(height: 1, color: colors.borderSubtle),
          for (var i = 0; i < items.length; i++)
            _UserRow(
              item: items[i],
              compact: false,
              showDivider: i < items.length - 1,
              onDetails: () => onDetails(items[i]),
              onSuspend: items[i].canSuspend ? () => onSuspend(items[i]) : null,
              onReactivate: items[i].canReactivate
                  ? () => onReactivate(items[i])
                  : null,
            ),
        ],
      ),
    );
  }
}

class _PaginationArrow extends StatelessWidget {
  const _PaginationArrow({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onPressed,
        borderRadius: AppRadius.smAll,
        child: Container(
          width: 28,
          height: 28,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: AppRadius.smAll,
            border: Border.all(color: colors.borderSubtle),
            color: colors.surfaceMuted,
          ),
          child: Icon(
            icon,
            size: 18,
            color: onPressed != null
                ? colors.textPrimary
                : colors.textMuted.withValues(alpha: 0.4),
          ),
        ),
      ),
    );
  }
}

class _UsersColumnHeaderRow extends StatelessWidget {
  const _UsersColumnHeaderRow();

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final labelStyle = Theme.of(context).textTheme.labelSmall?.copyWith(
      color: colors.textMuted,
      fontWeight: FontWeight.w700,
      letterSpacing: 0.2,
    );

    Widget label(String text) => Text(text, style: labelStyle);

    return Padding(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(flex: 4, child: label('USER')),
          const SizedBox(width: AppSpacing.md - AppSpacing.xs),
          Expanded(flex: 2, child: label('ROLE & STATUS')),
          const SizedBox(width: AppSpacing.md - AppSpacing.xs),
          Expanded(flex: 3, child: label('ACTIVITY')),
          const SizedBox(width: AppSpacing.md - AppSpacing.xs),
          Expanded(flex: 2, child: label('VERIFICATION / LAST ACTIVE')),
          const SizedBox(width: AppSpacing.sm),
          SizedBox(
            width: _actionsColumnWidth,
            child: Text('ACTIONS', textAlign: TextAlign.end, style: labelStyle),
          ),
        ],
      ),
    );
  }
}

class _UserRow extends StatefulWidget {
  const _UserRow({
    required this.item,
    required this.compact,
    required this.onDetails,
    this.onSuspend,
    this.onReactivate,
    this.showDivider = false,
  });

  final AdminPeopleListItem item;
  final bool compact;
  final bool showDivider;
  final VoidCallback onDetails;
  final VoidCallback? onSuspend;
  final VoidCallback? onReactivate;

  @override
  State<_UserRow> createState() => _UserRowState();
}

class _UserRowState extends State<_UserRow> {
  var _hovered = false;

  AdminPeopleListItem get item => widget.item;
  bool get compact => widget.compact;
  bool get showDivider => widget.showDivider;
  VoidCallback get onDetails => widget.onDetails;
  VoidCallback? get onSuspend => widget.onSuspend;
  VoidCallback? get onReactivate => widget.onReactivate;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final joined = DateFormat.yMMMd().format(item.createdAt);

    final identity = _UserIdentityBlock(
      item: item,
      joinedLabel: 'Joined $joined',
    );
    final badges = _UserBadgeCluster(item: item);
    final metrics = _UserMetricCluster(item: item);
    final extraInfo = _UserExtraInfo(item: item);
    final actions = _UserActionArea(
      onDetails: onDetails,
      onSuspend: onSuspend,
      onReactivate: onReactivate,
      compact: compact,
    );

    final content = compact
        ? Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _UserAvatar(displayName: item.displayName),
                  const SizedBox(width: AppSpacing.sm + 2),
                  Expanded(child: identity),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              badges,
              const SizedBox(height: AppSpacing.sm),
              metrics,
              const SizedBox(height: AppSpacing.xs),
              extraInfo,
              const SizedBox(height: AppSpacing.sm + 2),
              actions,
            ],
          )
        : Padding(
            padding: const EdgeInsetsDirectional.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.sm,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  flex: 4,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      _UserAvatar(displayName: item.displayName),
                      const SizedBox(width: AppSpacing.sm + 2),
                      Expanded(child: identity),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.md - AppSpacing.xs),
                Expanded(flex: 2, child: badges),
                const SizedBox(width: AppSpacing.md - AppSpacing.xs),
                Expanded(flex: 3, child: metrics),
                const SizedBox(width: AppSpacing.md - AppSpacing.xs),
                Expanded(flex: 2, child: extraInfo),
                const SizedBox(width: AppSpacing.sm),
                SizedBox(width: _actionsColumnWidth, child: actions),
              ],
            ),
          );

    final row = Container(
      decoration: BoxDecoration(
        color: _hovered && !compact
            ? colors.surfaceMuted.withValues(alpha: 0.5)
            : colors.cardSurface,
        borderRadius: compact ? AppRadius.lgAll : null,
        border: compact
            ? Border.all(color: colors.borderSubtle)
            : (showDivider
                  ? Border(
                      bottom: BorderSide(color: colors.borderSubtle, width: 1),
                    )
                  : null),
      ),
      child: content,
    );

    if (compact) return row;

    return MouseRegion(
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: row,
    );
  }
}

class _UserAvatar extends StatelessWidget {
  const _UserAvatar({required this.displayName});

  final String displayName;

  String get _initials {
    final parts = displayName.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) {
      return parts.first[0].toUpperCase();
    }
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final primaryStyle = AppStatusStyle.of(context, AppStatusTone.primary);

    return CircleAvatar(
      radius: 20,
      backgroundColor: primaryStyle.background,
      child: Text(
        _initials,
        style: Theme.of(context).textTheme.labelLarge?.copyWith(
          color: primaryStyle.foreground,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

String? _formatPeopleLocationLabel(AdminPeopleListItem item) {
  final label = item.locationLabel?.trim();
  if (label != null && label.isNotEmpty) {
    return label;
  }

  final city = item.locationCity?.trim();
  final area = item.locationArea?.trim();
  if (city != null && city.isNotEmpty && area != null && area.isNotEmpty) {
    return '$city · $area';
  }
  if (city != null && city.isNotEmpty) {
    return city;
  }
  if (area != null && area.isNotEmpty) {
    return area;
  }
  return null;
}

class _UserIdentityBlock extends StatelessWidget {
  const _UserIdentityBlock({required this.item, required this.joinedLabel});

  final AdminPeopleListItem item;
  final String joinedLabel;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final locationLabel = _formatPeopleLocationLabel(item);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                item.displayName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: colors.textPrimary,
                ),
              ),
            ),
            if (item.isProtectedAdmin) ...[
              const SizedBox(width: AppSpacing.sm),
              const AppStatusBadge(
                label: 'Protected',
                tone: AppStatusTone.warning,
              ),
            ],
          ],
        ),
        const SizedBox(height: 2),
        Text(
          item.email,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: colors.textSecondary),
        ),
        if (locationLabel != null) ...[
          const SizedBox(height: 2),
          Row(
            children: [
              Icon(
                Icons.location_on_outlined,
                size: 14,
                color: colors.textMuted,
              ),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Text(
                  locationLabel,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.labelSmall?.copyWith(color: colors.textMuted),
                ),
              ),
            ],
          ),
        ],
        const SizedBox(height: 2),
        Text(
          joinedLabel,
          style: Theme.of(
            context,
          ).textTheme.labelSmall?.copyWith(color: colors.textMuted),
        ),
      ],
    );
  }
}

class _UserBadgeCluster extends StatelessWidget {
  const _UserBadgeCluster({required this.item});

  final AdminPeopleListItem item;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Wrap(
          spacing: AppSpacing.xs,
          runSpacing: AppSpacing.xs,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            if (item.primaryRole != null)
              AppStatusBadge(
                label: _formatRole(item.primaryRole),
                tone: _roleTone(item.primaryRole),
              ),
            AppStatusBadge(
              label: _formatStatus(item.accountStatus),
              tone: _peopleAccountStatusTone(item.accountStatus),
            ),
          ],
        ),
        if (item.accountStatus == 'SUSPENDED') ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            _suspensionPreviewLine(item.suspensionReasonPreview),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: colors.danger,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ],
    );
  }
}

class _UserExtraInfo extends StatelessWidget {
  const _UserExtraInfo({required this.item});

  final AdminPeopleListItem item;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final lastActive = _formatRelativeLogin(item.lastLoginAt);
    final hasVerification =
        item.verificationStatus != null &&
        item.verificationStatus!.trim().isNotEmpty;
    final hasDriverStatus =
        item.driverStatus != null && item.driverStatus!.trim().isNotEmpty;

    final dashStyle = Theme.of(
      context,
    ).textTheme.labelSmall?.copyWith(color: colors.textMuted);

    final Widget statusLine;
    if (hasVerification) {
      statusLine = AppStatusBadge(
        label: _capitalizeFirst(_formatStatus(item.verificationStatus!)),
        tone: supplierVerificationStatusTone(item.verificationStatus!),
      );
    } else if (hasDriverStatus) {
      statusLine = AppStatusBadge(
        label: '${_capitalizeFirst(_formatStatus(item.driverStatus!))} driver',
        tone: _driverStatusTone(item.driverStatus!),
      );
    } else {
      statusLine = Text('—', style: dashStyle);
    }

    final Widget loginLine = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.schedule, size: 13, color: colors.textMuted),
        const SizedBox(width: 3),
        Text(lastActive ?? 'Never signed in', style: dashStyle),
      ],
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        statusLine,
        const SizedBox(height: AppSpacing.xs),
        loginLine,
      ],
    );
  }
}

class _UserMetricCluster extends StatelessWidget {
  const _UserMetricCluster({required this.item});

  final AdminPeopleListItem item;

  static bool _hasRole(AdminPeopleListItem item, String role) =>
      item.roles.contains(role);

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final chips = <Widget>[];
    final hasSupplier = _hasRole(item, 'SUPPLIER');
    final hasLearner = _hasRole(item, 'LEARNER');
    final hasDriver = _hasRole(item, 'DRIVER');

    if (hasLearner) {
      if (item.reservationsAsRequesterCount > 0) {
        chips.add(
          _MetricChip(
            icon: Icons.shopping_bag_outlined,
            count: item.reservationsAsRequesterCount,
            label: 'reservations',
            tone: AppStatusTone.info,
          ),
        );
      }
      if (item.submittedLearningProjectsCount > 0) {
        chips.add(
          _MetricChip(
            icon: Icons.lightbulb_outline,
            count: item.submittedLearningProjectsCount,
            label: 'projects',
            tone: AppStatusTone.primary,
          ),
        );
      }
      if (item.projectBuildsCount > 0) {
        chips.add(
          _MetricChip(
            icon: Icons.build_outlined,
            count: item.projectBuildsCount,
            label: 'builds',
            tone: AppStatusTone.success,
          ),
        );
      }
    }

    if (hasSupplier) {
      chips.add(
        _MetricChip(
          icon: Icons.inventory_2_outlined,
          count: item.materialsCount,
          label: 'materials',
          tone: AppStatusTone.success,
        ),
      );
      chips.add(
        _MetricChip(
          icon: Icons.receipt_long_outlined,
          count: item.reservationsAsOwnerCount,
          label: 'reservations',
          tone: AppStatusTone.primary,
        ),
      );
    }

    if (hasDriver) {
      chips.add(
        _MetricChip(
          icon: Icons.local_shipping_outlined,
          count: item.assignedDeliveriesCount,
          label: 'deliveries',
          tone: AppStatusTone.info,
        ),
      );
    }

    if (item.verifiedStrikeCount > 0) {
      chips.add(
        _MetricChip(
          icon: Icons.shield_outlined,
          count: item.verifiedStrikeCount,
          label: item.verifiedStrikeCount == 1 ? 'strike' : 'strikes',
          tone: AppStatusTone.warning,
        ),
      );
    }

    if (chips.isEmpty) {
      return Tooltip(
        message: 'No recorded activity',
        child: Text(
          '—',
          style: Theme.of(
            context,
          ).textTheme.labelSmall?.copyWith(color: colors.textMuted),
        ),
      );
    }

    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.xs,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: chips,
    );
  }
}

class _MetricChip extends StatelessWidget {
  const _MetricChip({
    required this.icon,
    required this.count,
    required this.label,
    this.tone = AppStatusTone.neutral,
  });

  final IconData icon;
  final int count;
  final String label;
  final AppStatusTone tone;

  @override
  Widget build(BuildContext context) {
    final style = AppStatusStyle.of(context, tone);
    final colors = AppThemeColors.of(context);

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: style.foreground),
        const SizedBox(width: 3),
        Text(
          '$count',
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
            color: colors.textPrimary,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(width: 3),
        Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: colors.textMuted,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

class _UserActionArea extends StatelessWidget {
  const _UserActionArea({
    required this.onDetails,
    required this.compact,
    this.onSuspend,
    this.onReactivate,
  });

  final VoidCallback onDetails;
  final VoidCallback? onSuspend;
  final VoidCallback? onReactivate;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final hasOverflow = onSuspend != null || onReactivate != null;

    final detailsButton = OutlinedButton.icon(
      onPressed: onDetails,
      icon: const Icon(Icons.visibility_outlined, size: 16),
      label: const Text('View details'),
      style: AppStatusButtonStyle.outlined(context, AppStatusTone.primary)
          .merge(
            OutlinedButton.styleFrom(
              visualDensity: VisualDensity.compact,
              textStyle: Theme.of(
                context,
              ).textTheme.labelSmall?.copyWith(fontWeight: FontWeight.w600),
              padding: const EdgeInsetsDirectional.symmetric(
                horizontal: AppSpacing.sm + 2,
                vertical: AppSpacing.xs,
              ),
            ),
          ),
    );

    final overflowButton = hasOverflow
        ? PopupMenuButton<VoidCallback>(
            tooltip: 'More actions',
            icon: Icon(
              Icons.more_vert,
              size: 18,
              color: AppThemeColors.of(context).textMuted,
            ),
            padding: EdgeInsets.zero,
            onSelected: (action) => action(),
            itemBuilder: (menuContext) => [
              if (onSuspend != null)
                PopupMenuItem<VoidCallback>(
                  value: onSuspend,
                  child: _OverflowMenuLabel(
                    icon: Icons.pause_circle_outline,
                    label: 'Suspend account',
                    tone: AppStatusTone.warning,
                  ),
                ),
              if (onReactivate != null)
                PopupMenuItem<VoidCallback>(
                  value: onReactivate,
                  child: _OverflowMenuLabel(
                    icon: Icons.play_circle_outline,
                    label: 'Reactivate account',
                    tone: AppStatusTone.success,
                  ),
                ),
            ],
          )
        : null;

    if (compact) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          Expanded(child: detailsButton),
          ?overflowButton,
        ],
      );
    }

    return Row(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [detailsButton, ?overflowButton],
    );
  }
}

class _OverflowMenuLabel extends StatelessWidget {
  const _OverflowMenuLabel({
    required this.icon,
    required this.label,
    required this.tone,
  });

  final IconData icon;
  final String label;
  final AppStatusTone tone;

  @override
  Widget build(BuildContext context) {
    final style = AppStatusStyle.of(context, tone);

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 18, color: style.foreground),
        const SizedBox(width: AppSpacing.sm),
        Text(
          label,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: style.foreground,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class _PersonDetailDialog extends StatelessWidget {
  const _PersonDetailDialog({required this.detail});

  final Map<String, dynamic> detail;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final roles = (detail['roles'] as List<dynamic>? ?? [])
        .map((role) => role.toString())
        .toList();
    final accountStatus = detail['accountStatus'] as String? ?? '';
    final isSuspended = accountStatus == 'SUSPENDED';
    final displayName = detail['displayName'] as String? ?? 'Account details';
    final locationLabel = detail['locationLabel'] as String?;
    final hasActivityMetrics =
        _detailMetric(detail, 'materialsCount') > 0 ||
        _detailMetric(detail, 'reservationsAsRequesterCount') > 0 ||
        _detailMetric(detail, 'reservationsAsOwnerCount') > 0 ||
        _detailMetric(detail, 'submittedLearningProjectsCount') > 0 ||
        _detailMetric(detail, 'projectBuildsCount') > 0 ||
        _detailMetric(detail, 'assignedDeliveriesCount') > 0 ||
        _detailMetric(detail, 'verifiedStrikeCount') > 0 ||
        _detailMetric(detail, 'pendingNoShowReportsCount') > 0 ||
        roles.any((role) => ['LEARNER', 'SUPPLIER', 'DRIVER'].contains(role));

    return AppDialogShell(
      title: AppDialogTitleBlock(
        title: displayName,
        icon: Icons.person_outline,
        badges: [
          AppStatusBadge(
            label: _formatStatus(accountStatus),
            tone: _peopleAccountStatusTone(accountStatus),
          ),
        ],
      ),
      maxWidth: 560,
      content: SizedBox(
        width: 520,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AppDialogSection(
              title: 'Account information',
              icon: Icons.badge_outlined,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _DetailRow('Email', detail['email']),
                  _DetailRow('Roles', roles.map(_formatRole).join(', ')),
                  _DetailRow('Phone', detail['phone']),
                  _DetailRow('Created', _formatDetailDate(detail['createdAt'])),
                  _DetailRow(
                    'Last login',
                    _formatDetailDate(detail['lastLoginAt']),
                  ),
                  if (locationLabel != null && locationLabel.trim().isNotEmpty)
                    _DetailRow('Location', locationLabel),
                  if (isSuspended) ...[
                    const SizedBox(height: AppSpacing.md - AppSpacing.xs),
                    Text(
                      'Suspension',
                      style: AdminTypography.sectionTitle(palette),
                    ),
                    const SizedBox(height: AppSpacing.sm - 2),
                    _DetailRow('Status', 'Suspended'),
                    _AlwaysShowDetailRow(
                      'Reason',
                      _suspensionReasonText(detail['suspensionReason']),
                    ),
                    _DetailRow(
                      'Suspended by',
                      _formatSuspendedBy(detail['suspendedBy']),
                    ),
                    _DetailRow(
                      'Suspended at',
                      _formatDetailDate(detail['suspendedAt']),
                    ),
                    if (detail['reactivatedAt'] != null) ...[
                      _DetailRow(
                        'Last reactivated at',
                        _formatDetailDate(detail['reactivatedAt']),
                      ),
                      _DetailRow(
                        'Reactivated by',
                        _formatSuspendedBy(detail['reactivatedBy']),
                      ),
                    ],
                    Padding(
                      padding: const EdgeInsets.only(top: AppSpacing.xs),
                      child: Text(
                        'Suspension blocks important actions but does not delete this account or its data.',
                        style: AdminTypography.kpiHelper(palette),
                      ),
                    ),
                  ],
                  if (detail['isProtectedAdmin'] == true)
                    Padding(
                      padding: const EdgeInsets.only(
                        top: AppSpacing.md - AppSpacing.xs,
                      ),
                      child: Text(
                        'This admin account is protected. Status and role changes are not available in People Management.',
                        style: AdminTypography.kpiHelper(
                          palette,
                        ).copyWith(color: palette.amber),
                      ),
                    ),
                ],
              ),
            ),
            if (hasActivityMetrics) ...[
              const SizedBox(height: AppSpacing.md),
              AppDialogSection(
                title: 'Activity metrics',
                icon: Icons.insights_outlined,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (roles.contains('LEARNER')) ...[
                      _DetailRow(
                        'Requested reservations',
                        '${_detailMetric(detail, 'reservationsAsRequesterCount')}',
                      ),
                      _DetailRow(
                        'Submitted projects',
                        '${_detailMetric(detail, 'submittedLearningProjectsCount')}',
                      ),
                      _DetailRow(
                        'Project builds',
                        '${_detailMetric(detail, 'projectBuildsCount')}',
                      ),
                    ],
                    if (roles.contains('SUPPLIER')) ...[
                      _DetailRow(
                        'Materials',
                        '${_detailMetric(detail, 'materialsCount')}',
                      ),
                      _DetailRow(
                        'Supplier reservations',
                        '${_detailMetric(detail, 'reservationsAsOwnerCount')}',
                      ),
                    ],
                    if (roles.contains('DRIVER'))
                      _DetailRow(
                        'Assigned deliveries',
                        '${_detailMetric(detail, 'assignedDeliveriesCount')}',
                      ),
                    if (_detailMetric(detail, 'verifiedStrikeCount') > 0)
                      _DetailRow(
                        'Verified strikes',
                        '${_detailMetric(detail, 'verifiedStrikeCount')}',
                      ),
                    if (_detailMetric(detail, 'pendingNoShowReportsCount') > 0)
                      _DetailRow(
                        'Pending no-show reports',
                        '${_detailMetric(detail, 'pendingNoShowReportsCount')}',
                      ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _AlwaysShowDetailRow extends StatelessWidget {
  const _AlwaysShowDetailRow(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
    child: AppDialogInfoRow(label: label, value: value),
  );
}

class _DetailRow extends StatelessWidget {
  const _DetailRow(this.label, this.value);

  final String label;
  final dynamic value;

  @override
  Widget build(BuildContext context) {
    final text = value?.toString();
    if (text == null || text.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: AppDialogInfoRow(label: label, value: text),
    );
  }
}
