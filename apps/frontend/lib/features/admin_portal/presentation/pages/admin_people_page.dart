import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/errors/api_exception.dart';
import '../../data/admin_people_api.dart';
import '../theme/admin_decoration_set.dart';
import '../theme/admin_palette.dart';
import '../widgets/admin_empty_state.dart';
import '../widgets/admin_kpi_card.dart' show AdminTypography;

class _PeopleFilters {
  const _PeopleFilters({
    required this.tab,
    required this.search,
    required this.status,
  });

  final String tab;
  final String search;
  final String status;

  _PeopleFilters copyWith({String? tab, String? search, String? status}) {
    return _PeopleFilters(
      tab: tab ?? this.tab,
      search: search ?? this.search,
      status: status ?? this.status,
    );
  }
}

class _PeopleFiltersNotifier extends Notifier<_PeopleFilters> {
  @override
  _PeopleFilters build() =>
      const _PeopleFilters(tab: 'ALL', search: '', status: 'ALL');

  void setTab(String tab) => state = state.copyWith(tab: tab);
  void setSearch(String search) => state = state.copyWith(search: search);
  void setStatus(String status) => state = state.copyWith(status: status);
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
  return ref.watch(adminPeopleApiProvider).fetchPeople(
        tab: filters.tab,
        search: filters.search,
        status: filters.status == 'ALL' ? null : filters.status,
      );
});

String _formatStatus(String status) => status.replaceAll('_', ' ').toLowerCase();

String _formatRole(String? role) =>
    role?.replaceAll('_', ' ').toLowerCase() ?? 'unknown';

String _suspensionPreviewLine(String? reason) {
  final trimmed = reason?.trim();
  if (trimmed == null || trimmed.isEmpty) {
    return 'Suspended: reason not recorded';
  }
  final preview = trimmed.length > 80 ? '${trimmed.substring(0, 80)}…' : trimmed;
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

Color _statusColor(AdminPalette palette, String status) {
  switch (status) {
    case 'ACTIVE':
      return palette.green;
    case 'SUSPENDED':
      return palette.amber;
    case 'DISABLED':
      return palette.red;
    default:
      return palette.textMuted;
  }
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

const _validPeopleTabs = {
  'ALL',
  'LEARNERS',
  'SUPPLIERS',
  'DRIVERS',
  'MODERATORS',
  'ADMINS',
};

class AdminPeoplePage extends ConsumerStatefulWidget {
  const AdminPeoplePage({super.key, this.initialTab});

  final String? initialTab;

  @override
  ConsumerState<AdminPeoplePage> createState() => _AdminPeoplePageState();
}

class _AdminPeoplePageState extends ConsumerState<AdminPeoplePage> {
  final _searchController = TextEditingController();
  var _appliedInitialTab = false;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _applyInitialTabIfNeeded() {
    if (_appliedInitialTab) return;
    final tab = widget.initialTab?.trim().toUpperCase();
    if (tab == null || tab.isEmpty || !_validPeopleTabs.contains(tab)) {
      return;
    }
    _appliedInitialTab = true;
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
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(successMessage)),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.displayMessage)),
      );
    }
  }

  Future<void> _showDetails(AdminPeopleListItem item) async {
    try {
      final detail =
          await ref.read(adminPeopleApiProvider).fetchPersonDetail(item.userId);
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (context) => _PersonDetailDialog(detail: detail),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.displayMessage)),
      );
    }
  }

  Future<void> _confirmSuspend(AdminPeopleListItem item) async {
    final reasonController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Suspend account'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Suspend ${item.displayName}?'),
            const SizedBox(height: 8),
            const Text(
              'This will prevent the user from performing important actions, but their existing data and history will remain.',
            ),
            const SizedBox(height: 12),
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
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            style: FilledButton.styleFrom(
              backgroundColor: context.adminPalette.amber,
            ),
            child: const Text('Suspend account'),
          ),
        ],
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
        const SnackBar(content: Text('A suspension reason of at least 3 characters is required.')),
      );
      return;
    }

    await _runAction(
      () => ref.read(adminPeopleApiProvider).suspendPerson(
            userId: item.userId,
            reason: reason,
          ),
      successMessage: 'Account suspended.',
    );
  }

  Future<void> _confirmReactivate(AdminPeopleListItem item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Reactivate account'),
        content: Text(
          'Restore access for ${item.displayName}? Their existing data and history were kept while suspended.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Reactivate account'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    await _runAction(
      () => ref.read(adminPeopleApiProvider).reactivatePerson(userId: item.userId),
      successMessage: 'Account reactivated.',
    );
  }

  @override
  Widget build(BuildContext context) {
    _applyInitialTabIfNeeded();
    final palette = context.adminPalette;
    final filters = ref.watch(_peopleFiltersProvider);
    final summaryAsync = ref.watch(adminPeopleSummaryProvider);
    final peopleAsync = ref.watch(adminPeopleListProvider);
    final pageTint = palette.isDark
        ? palette.pageBackground
        : palette.primaryTeal.withValues(alpha: 0.04);

    return ColoredBox(
      color: pageTint,
      child: SingleChildScrollView(
        padding: const EdgeInsetsDirectional.fromSTEB(20, 16, 20, 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('People', style: AdminTypography.pageTitle(palette)),
            const SizedBox(height: 4),
            Text(
              'Review platform accounts. Admin accounts are read-only in this MVP.',
              style: AdminTypography.pageSubtitle(palette),
            ),
            const SizedBox(height: 20),
            summaryAsync.when(
              loading: () => const LinearProgressIndicator(),
              error: (_, _) => const SizedBox.shrink(),
              data: (summary) => Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  _SummaryCard(
                    label: 'Total users',
                    value: summary.total,
                    icon: Icons.people_outline,
                    accent: palette.primaryTeal,
                  ),
                  _SummaryCard(
                    label: 'Learners',
                    value: summary.learners,
                    icon: Icons.school_outlined,
                    accent: palette.brightTeal,
                  ),
                  _SummaryCard(
                    label: 'Suppliers',
                    value: summary.suppliers,
                    icon: Icons.storefront_outlined,
                    accent: palette.green,
                  ),
                  _SummaryCard(
                    label: 'Drivers',
                    value: summary.drivers,
                    icon: Icons.local_shipping_outlined,
                    accent: palette.blue,
                  ),
                  _SummaryCard(
                    label: 'Moderators',
                    value: summary.moderators,
                    icon: Icons.shield_outlined,
                    accent: palette.purple,
                  ),
                  _SummaryCard(
                    label: 'Admins',
                    value: summary.admins,
                    icon: Icons.admin_panel_settings_outlined,
                    accent: palette.amber,
                  ),
                  _SummaryCard(
                    label: 'Suspended',
                    value: summary.suspended,
                    icon: Icons.pause_circle_outline,
                    accent: palette.red,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: _peopleTabs
                    .map(
                      (tab) => Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: FilterChip(
                          label: Text(tab.$2),
                          selected: filters.tab == tab.$1,
                          onSelected: (_) => ref
                              .read(_peopleFiltersProvider.notifier)
                              .setTab(tab.$1),
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: palette.cardBackground,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: palette.cardBorder),
              ),
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final compact = constraints.maxWidth < 760;
                  final searchField = TextField(
                    controller: _searchController,
                    decoration: const InputDecoration(
                      labelText: 'Search name or email',
                      prefixIcon: Icon(Icons.search),
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                    onSubmitted: (value) => ref
                        .read(_peopleFiltersProvider.notifier)
                        .setSearch(value.trim()),
                  );
                  final statusFilter = SizedBox(
                    width: compact ? double.infinity : 200,
                    child: DropdownMenu<String>(
                      key: ValueKey('status-${filters.status}'),
                      label: const Text('Status'),
                      initialSelection: filters.status,
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
                        if (value != null) {
                          ref.read(_peopleFiltersProvider.notifier).setStatus(value);
                        }
                      },
                    ),
                  );
                  final searchButton = OutlinedButton.icon(
                    onPressed: () {
                      ref
                          .read(_peopleFiltersProvider.notifier)
                          .setSearch(_searchController.text.trim());
                    },
                    icon: const Icon(Icons.search, size: 18),
                    label: const Text('Search'),
                  );
                  final resetButton = OutlinedButton.icon(
                    onPressed: () {
                      _searchController.clear();
                      ref.read(_peopleFiltersProvider.notifier).reset();
                    },
                    icon: const Icon(Icons.refresh, size: 18),
                    label: const Text('Reset'),
                  );

                  if (compact) {
                    return Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        SizedBox(width: double.infinity, child: searchField),
                        statusFilter,
                        searchButton,
                        resetButton,
                      ],
                    );
                  }

                  return Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(child: searchField),
                      const SizedBox(width: 12),
                      statusFilter,
                      const SizedBox(width: 12),
                      searchButton,
                      const SizedBox(width: 8),
                      resetButton,
                    ],
                  );
                },
              ),
            ),
            const SizedBox(height: 16),
            if (filters.tab == 'ADMINS')
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: palette.bannerBackground,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: palette.bannerBorder),
                ),
                child: Text(
                  'Admin accounts are view-only here. Pending admin invitations can be revoked from Invitations.',
                  style: AdminTypography.kpiHelper(palette),
                ),
              ),
            peopleAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => AdminEmptyState(
                icon: Icons.people_outline,
                title: 'Could not load people',
                subtitle: error.toString(),
              ),
              data: (items) {
                if (items.isEmpty) {
                  return const AdminEmptyState(
                    icon: Icons.people_outline,
                    title: 'No accounts found',
                    subtitle: 'Try adjusting your filters or search.',
                  );
                }

                return Column(
                  children: items
                      .map(
                        (item) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _PersonCard(
                            item: item,
                            onDetails: () => _showDetails(item),
                            onSuspend: item.canSuspend
                                ? () => _confirmSuspend(item)
                                : null,
                            onReactivate: item.canReactivate
                                ? () => _confirmReactivate(item)
                                : null,
                          ),
                        ),
                      )
                      .toList(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.accent,
  });

  final String label;
  final int value;
  final IconData icon;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Container(
      width: 160,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: palette.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: accent, size: 22),
          const SizedBox(height: 8),
          Text(
            '$value',
            style: AdminTypography.pageTitle(palette).copyWith(fontSize: 22),
          ),
          Text(label, style: AdminTypography.kpiHelper(palette)),
        ],
      ),
    );
  }
}

class _PersonCard extends StatelessWidget {
  const _PersonCard({
    required this.item,
    required this.onDetails,
    this.onSuspend,
    this.onReactivate,
  });

  final AdminPeopleListItem item;
  final VoidCallback onDetails;
  final VoidCallback? onSuspend;
  final VoidCallback? onReactivate;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final statusColor = _statusColor(palette, item.accountStatus);
    final created = DateFormat.yMMMd().format(item.createdAt);

    return Container(
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: palette.cardBorder),
      ),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          border: Border(left: BorderSide(color: statusColor, width: 4)),
        ),
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.displayName, style: AdminTypography.sectionTitle(palette)),
                      Text(item.email, style: AdminTypography.pageSubtitle(palette)),
                      Text(
                        'Joined $created',
                        style: AdminTypography.kpiHelper(palette),
                      ),
                    ],
                  ),
                ),
                if (item.isProtectedAdmin)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: palette.amber.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      'Protected admin',
                      style: AdminTypography.kpiHelper(palette).copyWith(
                        color: palette.amber,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            if (item.accountStatus == 'SUSPENDED') ...[
              Text(
                _suspensionPreviewLine(item.suspensionReasonPreview),
                style: AdminTypography.kpiHelper(palette).copyWith(
                  color: palette.amber,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
            ],
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                _Badge(
                  label: _formatStatus(item.accountStatus),
                  color: statusColor,
                ),
                if (item.primaryRole != null)
                  _Badge(
                    label: _formatRole(item.primaryRole),
                    color: palette.primaryTeal,
                  ),
                for (final role in item.roles.where((role) => role != item.primaryRole))
                  _Badge(label: _formatRole(role), color: palette.textSecondary),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                OutlinedButton.icon(
                  onPressed: onDetails,
                  icon: const Icon(Icons.visibility_outlined, size: 18),
                  label: const Text('View details'),
                ),
                if (onSuspend != null)
                  OutlinedButton.icon(
                    onPressed: onSuspend,
                    icon: Icon(Icons.pause_circle_outline, size: 18, color: palette.amber),
                    label: Text(
                      'Suspend account',
                      style: TextStyle(color: palette.amber),
                    ),
                  ),
                if (onReactivate != null)
                  FilledButton.icon(
                    onPressed: onReactivate,
                    icon: const Icon(Icons.play_circle_outline, size: 18),
                    label: const Text('Reactivate account'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Text(
        label,
        style: AdminTypography.kpiHelper(palette).copyWith(
          color: color,
          fontWeight: FontWeight.w600,
        ),
      ),
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

    return AlertDialog(
      title: Text(detail['displayName'] as String? ?? 'Account details'),
      content: SizedBox(
        width: 520,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _DetailRow('Email', detail['email']),
              _DetailRow('Status', _formatStatus(accountStatus)),
              _DetailRow('Roles', roles.map(_formatRole).join(', ')),
              _DetailRow('Phone', detail['phone']),
              _DetailRow('Created', _formatDetailDate(detail['createdAt'])),
              _DetailRow('Last login', _formatDetailDate(detail['lastLoginAt'])),
              if (isSuspended) ...[
                const SizedBox(height: 12),
                Text('Suspension', style: AdminTypography.sectionTitle(palette)),
                const SizedBox(height: 6),
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
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    'Suspension blocks important actions but does not delete this account or its data.',
                    style: AdminTypography.kpiHelper(palette),
                  ),
                ),
              ],
              if (detail['isProtectedAdmin'] == true)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(
                    'This admin account is protected. Status and role changes are not available in People Management.',
                    style: AdminTypography.kpiHelper(palette).copyWith(color: palette.amber),
                  ),
                ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Close'),
        ),
      ],
    );
  }
}

class _AlwaysShowDetailRow extends StatelessWidget {
  const _AlwaysShowDetailRow(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: RichText(
        text: TextSpan(
          style: AdminTypography.pageSubtitle(palette),
          children: [
            TextSpan(
              text: '$label: ',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            TextSpan(text: value),
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow(this.label, this.value);

  final String label;
  final dynamic value;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final text = value?.toString();
    if (text == null || text.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: RichText(
        text: TextSpan(
          style: AdminTypography.pageSubtitle(palette),
          children: [
            TextSpan(
              text: '$label: ',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            TextSpan(text: text),
          ],
        ),
      ),
    );
  }
}
