import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/errors/api_exception.dart';
import '../../data/admin_invitations_providers.dart';
import '../../data/models/admin_invitations_models.dart';
import '../l10n/admin_l10n.dart';
import '../theme/admin_decoration_set.dart';
import '../widgets/admin_kpi_card.dart' show AdminTypography;

String _invitationSendSnackMessage(AdminInvitationCreateResult result) {
  if (result.sendStatus == 'FAILED') {
    final error = result.sendError?.trim();
    if (error != null && error.isNotEmpty) {
      return 'Invitation created but email sending failed: $error';
    }
    return 'Invitation created but email sending failed.';
  }

  if (result.emailProvider == 'mock') {
    return 'Mock provider is enabled. No real email was sent.';
  }

  return 'Email invitation sent successfully.';
}

AdminInvitationItem? _parseExistingInvitation(ApiException error) {
  final raw = error.details?['existingInvitation'];
  if (raw is Map<String, dynamic>) {
    return AdminInvitationItem.fromJson(raw);
  }
  return null;
}

Future<void> _copyInvitationLink(
  BuildContext context,
  WidgetRef ref, {
  required String invitationId,
  String? directUrl,
}) async {
  final messenger = ScaffoldMessenger.of(context);

  try {
    final url = (directUrl != null && directUrl.trim().isNotEmpty)
        ? directUrl.trim()
        : await ref.read(adminInvitationsRepositoryProvider).issueInvitationLink(
              invitationId,
            );

    if (url.isEmpty) {
      messenger.showSnackBar(
        const SnackBar(content: Text('Could not copy invitation link.')),
      );
      return;
    }

    await Clipboard.setData(ClipboardData(text: url));

    if (!context.mounted) return;
    messenger.showSnackBar(
      const SnackBar(content: Text('Invitation link copied.')),
    );
  } catch (error) {
    if (!context.mounted) return;
    messenger.showSnackBar(
      SnackBar(
        content: Text(
          error is ApiException ? error.message : 'Could not copy invitation link.',
        ),
      ),
    );
  }
}

class AdminInvitationsPage extends ConsumerStatefulWidget {
  const AdminInvitationsPage({super.key, this.initialStatus});

  final String? initialStatus;

  @override
  ConsumerState<AdminInvitationsPage> createState() => _AdminInvitationsPageState();
}

class _AdminInvitationsPageState extends ConsumerState<AdminInvitationsPage> {
  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    final asyncInvitations = ref.watch(adminInvitationsProvider);

    return asyncInvitations.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(error.toString(), style: AdminTypography.pageSubtitle(palette)),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () => ref.invalidate(adminInvitationsProvider),
              child: Text(l.t('Retry', 'إعادة المحاولة')),
            ),
          ],
        ),
      ),
      data: (invitations) => _InvitationsBody(
        invitations: invitations,
        initialStatus: widget.initialStatus,
      ),
    );
  }
}

class _InvitationsBody extends ConsumerStatefulWidget {
  const _InvitationsBody({
    required this.invitations,
    this.initialStatus,
  });

  final List<AdminInvitationItem> invitations;
  final String? initialStatus;

  @override
  ConsumerState<_InvitationsBody> createState() => _InvitationsBodyState();
}

class _InvitationsBodyState extends ConsumerState<_InvitationsBody> {
  final _searchController = TextEditingController();
  String _roleFilter = 'ALL';
  String _statusFilter = 'ALL';
  var _appliedInitialStatus = false;

  static const _validInvitationStatusFilters = {
    'PENDING',
    'ACCEPTED',
    'REVOKED',
    'EXPIRED',
    'SENT',
    'FAILED',
    'USED',
  };

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _applyInitialStatusIfNeeded());
  }

  @override
  void didUpdateWidget(_InvitationsBody oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialStatus != widget.initialStatus) {
      _appliedInitialStatus = false;
      WidgetsBinding.instance.addPostFrameCallback((_) => _applyInitialStatusIfNeeded());
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _applyInitialStatusIfNeeded() {
    if (!mounted || _appliedInitialStatus) return;
    final raw = widget.initialStatus?.trim().toUpperCase();
    if (raw == null || raw.isEmpty) return;
    _appliedInitialStatus = true;
    if (!_validInvitationStatusFilters.contains(raw)) return;
    setState(() => _statusFilter = raw);
  }

  bool _matchesActiveFilter(AdminInvitationItem item) {
    return item.status != 'USED' &&
        item.status != 'REVOKED' &&
        item.status != 'EXPIRED' &&
        item.expiresAt.isAfter(DateTime.now());
  }

  int _count(String status) =>
      widget.invitations.where((item) => item.status == status).length;

  List<AdminInvitationItem> get _filteredInvitations {
    final query = _searchController.text.trim().toLowerCase();

    return widget.invitations.where((item) {
      if (query.isNotEmpty &&
          !item.recipientEmail.toLowerCase().contains(query)) {
        return false;
      }

      if (_roleFilter != 'ALL' && item.role != _roleFilter) {
        return false;
      }

      if (_statusFilter != 'ALL') {
        if (_statusFilter == 'PENDING') {
          if (!_matchesActiveFilter(item)) return false;
        } else if (_statusFilter == 'ACCEPTED') {
          if (item.status != 'USED') return false;
        } else if (item.status != _statusFilter) {
          return false;
        }
      }

      return true;
    }).toList(growable: false);
  }

  Future<void> _openCreateDialog(BuildContext context) async {
    await showDialog<void>(
      context: context,
      builder: (context) => _CreateInvitationDialog(
        onCreated: () => ref.invalidate(adminInvitationsProvider),
        onDuplicate: (existing) => _openDetailsDialog(context, existing),
      ),
    );
  }

  Future<void> _openDetailsDialog(
    BuildContext context,
    AdminInvitationItem item,
  ) async {
    await showDialog<void>(
      context: context,
      builder: (context) => _InvitationDetailDialog(item: item),
    );
  }

  void _resetFilters() {
    _searchController.clear();
    setState(() {
      _roleFilter = 'ALL';
      _statusFilter = 'ALL';
    });
    context.go('/admin/invitations');
  }

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    final invitations = _filteredInvitations;

    return ListView(
      padding: const EdgeInsetsDirectional.only(bottom: 24),
      children: [
        Wrap(
          alignment: WrapAlignment.spaceBetween,
          runSpacing: 10,
          crossAxisAlignment: WrapCrossAlignment.start,
          children: [
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 720),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l.t('Invitations', 'الدعوات'),
                    style: AdminTypography.pageTitle(palette),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    l.t(
                      'Send secure email invitation links for drivers, moderators, and admins.',
                      'أرسل روابط دعوة آمنة عبر البريد الإلكتروني للسائقين والمشرفين والمسؤولين.',
                    ),
                    style: AdminTypography.pageSubtitle(palette),
                  ),
                ],
              ),
            ),
            FilledButton.icon(
              onPressed: () => _openCreateDialog(context),
              style:
                  FilledButton.styleFrom(backgroundColor: palette.primaryTeal),
              icon: const Icon(Icons.mail_outline),
              label: Text(l.t('Send Invitation', 'إرسال دعوة')),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            _SummaryChip(
              label: l.t('Sent', 'مُرسلة'),
              count: _count('SENT'),
              color: palette.green,
            ),
            _SummaryChip(
              label: l.t('Failed', 'فشلت'),
              count: _count('FAILED'),
              color: palette.red,
            ),
            _SummaryChip(
              label: l.t('Used', 'مستخدمة'),
              count: _count('USED'),
              color: palette.blue,
            ),
            _SummaryChip(
              label: l.t('Expired', 'منتهية'),
              count: _count('EXPIRED'),
              color: palette.amber,
            ),
            _SummaryChip(
              label: l.t('Revoked', 'ملغاة'),
              count: _count('REVOKED'),
              color: palette.textMuted,
            ),
          ],
        ),
        const SizedBox(height: 16),
        _FiltersBar(
          searchController: _searchController,
          roleFilter: _roleFilter,
          statusFilter: _statusFilter,
          onRoleChanged: (value) => setState(() => _roleFilter = value),
          onStatusChanged: (value) => setState(() => _statusFilter = value),
          onSearchChanged: () => setState(() {}),
          onReset: _resetFilters,
        ),
        const SizedBox(height: 12),
        _InvitationsList(
          invitations: invitations,
          onOpenDetails: (item) => _openDetailsDialog(context, item),
        ),
      ],
    );
  }
}

class _FiltersBar extends StatelessWidget {
  const _FiltersBar({
    required this.searchController,
    required this.roleFilter,
    required this.statusFilter,
    required this.onRoleChanged,
    required this.onStatusChanged,
    required this.onSearchChanged,
    required this.onReset,
  });

  final TextEditingController searchController;
  final String roleFilter;
  final String statusFilter;
  final ValueChanged<String> onRoleChanged;
  final ValueChanged<String> onStatusChanged;
  final VoidCallback onSearchChanged;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;

    return Container(
      padding: const EdgeInsetsDirectional.fromSTEB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: palette.cardBorder),
      ),
      child: Wrap(
        spacing: 10,
        runSpacing: 10,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          SizedBox(
            width: 320,
            child: TextField(
              controller: searchController,
              onChanged: (_) => onSearchChanged(),
              decoration: InputDecoration(
                isDense: true,
                labelText: l.t('Search by email', 'بحث بالبريد'),
                prefixIcon: const Icon(Icons.search),
                border: const OutlineInputBorder(),
              ),
            ),
          ),
          SizedBox(
            width: 210,
            child: DropdownButtonFormField<String>(
              key: ValueKey('role-filter-$roleFilter'),
              initialValue: roleFilter,
              decoration: InputDecoration(
                isDense: true,
                labelText: l.t('Role', 'الدور'),
                border: const OutlineInputBorder(),
              ),
              items: const [
                DropdownMenuItem(value: 'ALL', child: Text('All')),
                DropdownMenuItem(value: 'DRIVER', child: Text('Driver')),
                DropdownMenuItem(value: 'MODERATOR', child: Text('Moderator')),
                DropdownMenuItem(value: 'ADMIN', child: Text('Admin')),
              ],
              onChanged: (value) {
                if (value != null) onRoleChanged(value);
              },
            ),
          ),
          SizedBox(
            width: 210,
            child: DropdownButtonFormField<String>(
              key: ValueKey('status-filter-$statusFilter'),
              initialValue: statusFilter,
              decoration: InputDecoration(
                isDense: true,
                labelText: l.t('Status', 'الحالة'),
                border: const OutlineInputBorder(),
              ),
              items: const [
                DropdownMenuItem(value: 'ALL', child: Text('All')),
                DropdownMenuItem(value: 'PENDING', child: Text('Pending')),
                DropdownMenuItem(value: 'SENT', child: Text('Sent')),
                DropdownMenuItem(value: 'FAILED', child: Text('Failed')),
                DropdownMenuItem(value: 'ACCEPTED', child: Text('Accepted')),
                DropdownMenuItem(value: 'USED', child: Text('Used')),
                DropdownMenuItem(value: 'EXPIRED', child: Text('Expired')),
                DropdownMenuItem(value: 'REVOKED', child: Text('Revoked')),
              ],
              onChanged: (value) {
                if (value != null) onStatusChanged(value);
              },
            ),
          ),
          OutlinedButton.icon(
            onPressed: onReset,
            icon: const Icon(Icons.refresh, size: 18),
            label: Text(l.t('Reset', 'إعادة تعيين')),
          ),
        ],
      ),
    );
  }
}

class _InvitationsList extends ConsumerWidget {
  const _InvitationsList({
    required this.invitations,
    required this.onOpenDetails,
  });

  final List<AdminInvitationItem> invitations;
  final ValueChanged<AdminInvitationItem> onOpenDetails;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    final dateFormat = DateFormat.yMMMd().add_jm();

    if (invitations.isEmpty) {
      return Container(
        padding: const EdgeInsetsDirectional.fromSTEB(18, 18, 18, 18),
        decoration: BoxDecoration(
          color: palette.cardBackground,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: palette.cardBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              l.t('No invitations yet', 'لا توجد دعوات بعد'),
              style: AdminTypography.sectionTitle(palette),
            ),
            const SizedBox(height: 6),
            Text(
              l.t(
                'Send your first invitation to onboard a driver, moderator, or admin.',
                'أرسل أول دعوة لإضافة سائق أو مشرف أو مسؤول.',
              ),
              style: AdminTypography.pageSubtitle(palette),
            ),
            const SizedBox(height: 12),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: FilledButton.icon(
                onPressed: () => showDialog<void>(
                  context: context,
                  builder: (context) => _CreateInvitationDialog(
                    onCreated: () => ref.invalidate(adminInvitationsProvider),
                    onDuplicate: (existing) => onOpenDetails(existing),
                  ),
                ),
                style: FilledButton.styleFrom(
                  backgroundColor: palette.primaryTeal,
                ),
                icon: const Icon(Icons.mail_outline),
                label: Text(l.t('Send Invitation', 'إرسال دعوة')),
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: palette.cardBorder),
      ),
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: invitations.length,
        separatorBuilder: (_, separatorIndex) => Divider(
          height: 1,
          color: palette.cardBorder,
        ),
        itemBuilder: (context, index) {
          final item = invitations[index];
          final canAct = item.status != 'USED' && item.status != 'REVOKED';
          final createdBy = item.createdBy?.label;

          return Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(14, 12, 14, 12),
            child: Wrap(
              runSpacing: 8,
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 520),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.recipientEmail,
                        style: AdminTypography.kpiLabel(palette),
                      ),
                      const SizedBox(height: 2),
                      Wrap(
                        spacing: 8,
                        runSpacing: 6,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          _StatusBadge(status: item.status),
                          _RoleBadge(role: item.role),
                          Text(
                            '${l.t('Created', 'أُنشئت')}: ${dateFormat.format(item.createdAt.toLocal())}',
                            style: AdminTypography.kpiHelper(palette),
                          ),
                          Text(
                            '${l.t('Expires', 'تنتهي')}: ${dateFormat.format(item.expiresAt.toLocal())}',
                            style: AdminTypography.kpiHelper(palette),
                          ),
                          if (createdBy != null && createdBy.isNotEmpty)
                            Text(
                              '${l.t('Created by', 'أنشأها')}: $createdBy',
                              style: AdminTypography.kpiHelper(palette),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                Wrap(
                  spacing: 6,
                  runSpacing: 2,
                  children: [
                    TextButton(
                      onPressed: () => onOpenDetails(item),
                      child: Text(l.t('Details', 'التفاصيل')),
                    ),
                    if (item.isActivePending)
                      TextButton(
                        onPressed: () => _copyInvitationLink(
                          context,
                          ref,
                          invitationId: item.id,
                        ),
                        child: Text(l.t('Copy link', 'نسخ الرابط')),
                      ),
                    if (item.status == 'FAILED' &&
                        item.sendError != null &&
                        item.sendError!.trim().isNotEmpty)
                      TextButton(
                        onPressed: () => showDialog<void>(
                          context: context,
                          builder: (context) => AlertDialog(
                            title: Text(l.t(
                              'Email error',
                              'خطأ البريد الإلكتروني',
                            )),
                            content: SelectableText(item.sendError!),
                            actions: [
                              TextButton(
                                onPressed: () => Navigator.of(context).pop(),
                                child: Text(l.t('Close', 'إغلاق')),
                              ),
                            ],
                          ),
                        ),
                        child: Text(l.t('View error', 'عرض الخطأ')),
                      ),
                    if (canAct)
                      TextButton(
                        onPressed: () => _resend(context, ref, item.id),
                        child: Text(l.t('Resend', 'إعادة إرسال')),
                      ),
                    if (canAct)
                      TextButton(
                        onPressed: () => _revoke(context, ref, item.id),
                        child: Text(l.t('Revoke', 'إلغاء')),
                      ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Future<void> _resend(
    BuildContext context,
    WidgetRef ref,
    String id,
  ) async {
    final repository = ref.read(adminInvitationsRepositoryProvider);
    final messenger = ScaffoldMessenger.of(context);

    try {
      final result = await repository.resendInvitation(id);
      ref.invalidate(adminInvitationsProvider);

      if (!context.mounted) return;

      messenger.showSnackBar(
        SnackBar(
          content: Text(_invitationSendSnackMessage(result)),
          action: result.inviteLink.isNotEmpty
              ? SnackBarAction(
                  label: 'Copy link',
                  onPressed: () => _copyInvitationLink(
                    context,
                    ref,
                    invitationId: id,
                    directUrl: result.inviteLink,
                  ),
                )
              : null,
        ),
      );
    } catch (error) {
      if (!context.mounted) return;
      messenger.showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  Future<void> _revoke(
    BuildContext context,
    WidgetRef ref,
    String id,
  ) async {
    final repository = ref.read(adminInvitationsRepositoryProvider);
    final messenger = ScaffoldMessenger.of(context);

    try {
      await repository.revokeInvitation(id);
      ref.invalidate(adminInvitationsProvider);
      if (!context.mounted) return;
      messenger.showSnackBar(
        const SnackBar(content: Text('Invitation revoked.')),
      );
    } catch (error) {
      if (!context.mounted) return;
      messenger.showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }
}

class _SummaryChip extends StatelessWidget {
  const _SummaryChip({
    required this.label,
    required this.count,
    required this.color,
  });

  final String label;
  final int count;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: palette.cardBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 8),
          Text('$count', style: AdminTypography.kpiValue(palette).copyWith(fontSize: 18)),
          const SizedBox(width: 6),
          Text(label, style: AdminTypography.kpiHelper(palette)),
        ],
      ),
    );
  }
}

// NOTE: `_InvitationsTable` replaced by `_InvitationsList` to avoid unbounded
// width layout crashes on Flutter Web.

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final color = switch (status) {
      'SENT' => palette.green,
      'FAILED' => palette.red,
      'USED' => palette.blue,
      'EXPIRED' => palette.amber,
      'REVOKED' => palette.textMuted,
      _ => palette.primaryTeal,
    };

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        status,
        style: AdminTypography.kpiHelper(palette).copyWith(
          color: color,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _RoleBadge extends StatelessWidget {
  const _RoleBadge({required this.role});

  final String role;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: palette.blue.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        role,
        style: AdminTypography.kpiHelper(palette).copyWith(
          color: palette.blue,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _InvitationDetailDialog extends ConsumerStatefulWidget {
  const _InvitationDetailDialog({required this.item});

  final AdminInvitationItem item;

  @override
  ConsumerState<_InvitationDetailDialog> createState() =>
      _InvitationDetailDialogState();
}

class _InvitationDetailDialogState extends ConsumerState<_InvitationDetailDialog> {
  String? _invitationUrl;
  bool _loadingLink = false;

  String? _formatDate(DateTime? value) {
    if (value == null) return null;
    return DateFormat.yMMMd().add_jm().format(value.toLocal());
  }

  Future<void> _loadAndCopyLink() async {
    setState(() => _loadingLink = true);
    try {
      final url = await ref
          .read(adminInvitationsRepositoryProvider)
          .issueInvitationLink(widget.item.id);
      if (!mounted) return;
      setState(() {
        _invitationUrl = url;
        _loadingLink = false;
      });
      await Clipboard.setData(ClipboardData(text: url));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Invitation link copied.')),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _loadingLink = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            error is ApiException
                ? error.message
                : 'Could not copy invitation link.',
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    final item = widget.item;
    final createdBy = item.createdBy?.label;

    return AlertDialog(
      title: Text(l.t('Invitation details', 'تفاصيل الدعوة')),
      content: SizedBox(
        width: 520,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _DetailRow(l.t('Email', 'البريد'), item.recipientEmail),
              _DetailRow(l.t('Role', 'الدور'), item.role),
              _DetailRow(l.t('Status', 'الحالة'), item.status),
              _DetailRow(
                l.t('Created at', 'تاريخ الإنشاء'),
                _formatDate(item.createdAt),
              ),
              _DetailRow(
                l.t('Expires at', 'تاريخ الانتهاء'),
                _formatDate(item.expiresAt),
              ),
              if (createdBy != null && createdBy.isNotEmpty)
                _DetailRow(l.t('Created by', 'أنشأها'), createdBy),
              if (item.acceptedAt != null)
                _DetailRow(
                  l.t('Accepted at', 'تاريخ القبول'),
                  _formatDate(item.acceptedAt),
                ),
              if (item.revokedAt != null)
                _DetailRow(
                  l.t('Revoked at', 'تاريخ الإلغاء'),
                  _formatDate(item.revokedAt),
                ),
              const SizedBox(height: 12),
              if (item.isActivePending) ...[
                if (_invitationUrl != null) ...[
                  Text(
                    l.t('Invitation link', 'رابط الدعوة'),
                    style: AdminTypography.kpiLabel(palette),
                  ),
                  const SizedBox(height: 6),
                  SelectableText(
                    _invitationUrl!,
                    style: AdminTypography.kpiHelper(palette),
                  ),
                  const SizedBox(height: 8),
                ],
                FilledButton.icon(
                  onPressed: _loadingLink ? null : _loadAndCopyLink,
                  icon: _loadingLink
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.link, size: 18),
                  label: Text(l.t('Copy link', 'نسخ الرابط')),
                ),
              ] else
                Text(
                  l.t(
                    'This invitation is no longer active.',
                    'هذه الدعوة لم تعد نشطة.',
                  ),
                  style: AdminTypography.kpiHelper(palette).copyWith(
                    color: palette.amber,
                    fontWeight: FontWeight.w600,
                  ),
                ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(l.t('Close', 'إغلاق')),
        ),
      ],
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow(this.label, this.value);

  final String label;
  final String? value;

  @override
  Widget build(BuildContext context) {
    if (value == null || value!.trim().isEmpty) return const SizedBox.shrink();
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

class _CreateInvitationDialog extends ConsumerStatefulWidget {
  const _CreateInvitationDialog({
    required this.onCreated,
    this.onDuplicate,
  });

  final VoidCallback onCreated;
  final ValueChanged<AdminInvitationItem>? onDuplicate;

  @override
  ConsumerState<_CreateInvitationDialog> createState() =>
      _CreateInvitationDialogState();
}

class _CreateInvitationDialogState extends ConsumerState<_CreateInvitationDialog> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _noteController = TextEditingController();
  String _role = 'DRIVER';
  int _expiresInMinutes = 60;
  bool _submitting = false;
  String? _sendError;

  @override
  void dispose() {
    _emailController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_submitting) return;
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _submitting = true;
      _sendError = null;
    });

    try {
      final result = await ref.read(adminInvitationsRepositoryProvider).createInvitation(
            AdminInvitationCreateRequest(
              role: _role,
              recipientEmail: _emailController.text.trim(),
              expiresInMinutes: _expiresInMinutes,
              note: _noteController.text.trim(),
            ),
          );

      widget.onCreated();

      if (!mounted) return;

      Navigator.of(context).pop();

      final messenger = ScaffoldMessenger.of(context);
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            result.sendStatus == 'FAILED'
                ? _invitationSendSnackMessage(result)
                : 'Invitation sent successfully.',
          ),
        ),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _submitting = false);

      if (error is ApiException &&
          error.code == 'DUPLICATE_PENDING_INVITATION') {
        final existing = _parseExistingInvitation(error);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              error.message.isNotEmpty
                  ? error.message
                  : 'An active pending invitation already exists for this email and role.',
            ),
            action: existing != null && widget.onDuplicate != null
                ? SnackBarAction(
                    label: 'View',
                    onPressed: () {
                      Navigator.of(context).pop();
                      widget.onDuplicate!(existing);
                    },
                  )
                : null,
          ),
        );
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            error is ApiException ? error.message : error.toString(),
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);

    return AlertDialog(
      title: Text(l.t('Send Email Invitation', 'إرسال دعوة بالبريد')),
      content: SizedBox(
        width: 480,
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: _emailController,
                decoration: InputDecoration(
                  labelText: l.t('Email', 'البريد'),
                  hintText: 'driver@example.com',
                ),
                keyboardType: TextInputType.emailAddress,
                validator: (value) {
                  final email = value?.trim() ?? '';
                  if (email.isEmpty) return 'Email is required';
                  if (!email.contains('@')) return 'Enter a valid email';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                key: ValueKey('role-$_role'),
                initialValue: _role,
                decoration: InputDecoration(labelText: l.t('Role', 'الدور')),
                items: const [
                  DropdownMenuItem(value: 'DRIVER', child: Text('Driver')),
                  DropdownMenuItem(value: 'MODERATOR', child: Text('Moderator')),
                  DropdownMenuItem(value: 'ADMIN', child: Text('Admin')),
                ],
                onChanged: _submitting ? null : (value) => setState(() => _role = value!),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<int>(
                key: ValueKey('expires-$_expiresInMinutes'),
                initialValue: _expiresInMinutes,
                decoration: InputDecoration(
                  labelText: l.t('Expires in', 'تنتهي خلال'),
                ),
                items: const [
                  DropdownMenuItem(value: 30, child: Text('30 minutes')),
                  DropdownMenuItem(value: 60, child: Text('1 hour')),
                  DropdownMenuItem(value: 1440, child: Text('24 hours')),
                ],
                onChanged: _submitting
                    ? null
                    : (value) => setState(() => _expiresInMinutes = value!),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _noteController,
                decoration: InputDecoration(
                  labelText: l.t('Optional note', 'ملاحظة اختيارية'),
                ),
                maxLines: 2,
              ),
              if (_sendError != null) ...[
                const SizedBox(height: 12),
                Text(_sendError!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.of(context).pop(),
          child: Text(l.t('Close', 'إغلاق')),
        ),
        FilledButton(
          onPressed: _submitting ? null : _submit,
          child: _submitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text(l.t('Send invitation', 'إرسال الدعوة')),
        ),
      ],
    );
  }
}
