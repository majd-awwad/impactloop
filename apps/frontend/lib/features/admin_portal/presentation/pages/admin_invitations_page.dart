import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
import '../../../../shared/widgets/invitation_status_presentation.dart';
import '../../data/admin_invitations_providers.dart';
import '../../data/models/admin_invitations_models.dart';
import '../l10n/admin_l10n.dart';
import '../theme/admin_decoration_set.dart';
import '../widgets/admin_kpi_card.dart';

const double _invitationActionsColumnWidth = 232;

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

String _formatInvitationStatus(String value) {
  return value
      .trim()
      .toLowerCase()
      .split('_')
      .where((part) => part.isNotEmpty)
      .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
      .join(' ');
}

String _formatInvitationRole(String role) {
  final trimmed = role.trim();
  if (trimmed.isEmpty) return trimmed;
  final lower = trimmed.toLowerCase();
  return '${lower[0].toUpperCase()}${lower.substring(1)}';
}

AppStatusTone _invitationRoleTone(String role) {
  switch (role.trim().toUpperCase()) {
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

bool _canActOnInvitation(AdminInvitationItem item) =>
    item.status != 'USED' && item.status != 'REVOKED';

bool _hasSendError(AdminInvitationItem item) =>
    item.status == 'FAILED' && (item.sendError?.trim().isNotEmpty ?? false);

typedef _ExpiryInfo = ({String label, AppStatusTone tone});

_ExpiryInfo _expiryInfo(DateTime createdAt, DateTime expiresAt) {
  final now = DateTime.now();
  final expiresLocal = expiresAt.toLocal();
  final remaining = expiresLocal.difference(now);

  if (remaining.isNegative) {
    final elapsed = now.difference(expiresLocal);
    if (elapsed.inDays >= 1) {
      final days = elapsed.inDays;
      return (
        label: 'Expired $days day${days == 1 ? '' : 's'} ago',
        tone: AppStatusTone.danger,
      );
    }
    if (elapsed.inHours >= 1) {
      final hours = elapsed.inHours;
      return (
        label: 'Expired $hours hour${hours == 1 ? '' : 's'} ago',
        tone: AppStatusTone.danger,
      );
    }
    return (label: 'Expired today', tone: AppStatusTone.danger);
  }

  final totalDuration = expiresLocal.difference(createdAt.toLocal());
  final thresholdMinutes = totalDuration.inMinutes > 0
      ? (totalDuration.inMinutes * 0.2).clamp(5.0, 180.0).round()
      : 15;
  final nearExpiry = remaining.inMinutes <= thresholdMinutes;

  String label;
  if (remaining.inDays >= 1) {
    final days = remaining.inDays;
    label = 'Expires in $days day${days == 1 ? '' : 's'}';
  } else if (remaining.inHours >= 1) {
    final hours = remaining.inHours;
    label = 'Expires in $hours hour${hours == 1 ? '' : 's'}';
  } else {
    final minutes = remaining.inMinutes;
    label = minutes >= 1 ? 'Expires in $minutes min' : 'Expires soon';
  }

  return (
    label: label,
    tone: nearExpiry ? AppStatusTone.warning : AppStatusTone.neutral,
  );
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
        : await ref
              .read(adminInvitationsRepositoryProvider)
              .issueInvitationLink(invitationId);

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
          error is ApiException
              ? AdminL10n.of(context).localizedError(error)
              : 'Could not copy invitation link.',
        ),
      ),
    );
  }
}

Future<AdminInvitationCreateResult?> _resendInvitation(
  BuildContext context,
  WidgetRef ref,
  String id,
) async {
  final repository = ref.read(adminInvitationsRepositoryProvider);
  final messenger = ScaffoldMessenger.of(context);

  try {
    final result = await repository.resendInvitation(id);
    ref.invalidate(adminInvitationsProvider);

    if (!context.mounted) return result;

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
    return result;
  } catch (error) {
    ref.invalidate(adminInvitationsProvider);
    if (!context.mounted) return null;
    if (error is ApiException && error.code == 'EMAIL_DELIVERY_FAILED') {
      messenger.showSnackBar(
        const SnackBar(
          content: Text(
            'Invitation was saved, but the email could not be delivered. Update the mail configuration, then resend it from the invitations list.',
          ),
        ),
      );
      return null;
    }
    messenger.showSnackBar(
      SnackBar(content: Text(AdminL10n.of(context).localizedError(error))),
    );
    return null;
  }
}

Future<AdminInvitationItem?> _revokeInvitation(
  BuildContext context,
  WidgetRef ref,
  String id,
) async {
  final repository = ref.read(adminInvitationsRepositoryProvider);
  final messenger = ScaffoldMessenger.of(context);

  try {
    final result = await repository.revokeInvitation(id);
    ref.invalidate(adminInvitationsProvider);
    if (!context.mounted) return result;
    messenger.showSnackBar(
      const SnackBar(content: Text('Invitation revoked.')),
    );
    return result;
  } catch (error) {
    if (!context.mounted) return null;
    messenger.showSnackBar(
      SnackBar(content: Text(AdminL10n.of(context).localizedError(error))),
    );
    return null;
  }
}

class AdminInvitationsPage extends ConsumerStatefulWidget {
  const AdminInvitationsPage({super.key, this.initialStatus});

  final String? initialStatus;

  @override
  ConsumerState<AdminInvitationsPage> createState() =>
      _AdminInvitationsPageState();
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
            Text(
              AdminL10n.of(context).localizedError(error),
              style: AdminTypography.pageSubtitle(palette),
            ),
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
  const _InvitationsBody({required this.invitations, this.initialStatus});

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
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _applyInitialStatusIfNeeded(),
    );
  }

  @override
  void didUpdateWidget(_InvitationsBody oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialStatus != widget.initialStatus) {
      _appliedInitialStatus = false;
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => _applyInitialStatusIfNeeded(),
      );
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

  bool get _hasActiveFilters =>
      _searchController.text.trim().isNotEmpty ||
      _roleFilter != 'ALL' ||
      _statusFilter != 'ALL';

  List<AdminInvitationItem> get _filteredInvitations {
    final query = _searchController.text.trim().toLowerCase();

    return widget.invitations
        .where((item) {
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
        })
        .toList(growable: false);
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
    final invitations = _filteredInvitations;

    return ListView(
      padding: const EdgeInsetsDirectional.only(bottom: 24),
      children: [
        _InvitationsPageHeader(
          onSendInvitation: () => _openCreateDialog(context),
        ),
        const SizedBox(height: AppSpacing.md + AppSpacing.xs),
        _InvitationsKpiRow(invitations: widget.invitations),
        const SizedBox(height: AppSpacing.md + AppSpacing.xs),
        _FiltersPanel(
          searchController: _searchController,
          roleFilter: _roleFilter,
          statusFilter: _statusFilter,
          onRoleChanged: (value) => setState(() => _roleFilter = value),
          onStatusChanged: (value) => setState(() => _statusFilter = value),
          onSearchChanged: () => setState(() {}),
          onReset: _resetFilters,
        ),
        const SizedBox(height: AppSpacing.md),
        _InvitationsResultsContainer(
          invitations: invitations,
          hasActiveFilters: _hasActiveFilters,
          onOpenDetails: (item) => _openDetailsDialog(context, item),
          onSendInvitation: () => _openCreateDialog(context),
        ),
      ],
    );
  }
}

class _InvitationsPageHeader extends StatelessWidget {
  const _InvitationsPageHeader({required this.onSendInvitation});

  final VoidCallback onSendInvitation;

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    final compact = MediaQuery.sizeOf(context).width < 720;

    final titleBlock = Column(
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
    );

    final sendButton = FilledButton.icon(
      onPressed: onSendInvitation,
      style: AppStatusButtonStyle.filled(context, AppStatusTone.primary),
      icon: const Icon(Icons.mail_outline, size: 18),
      label: Text(l.t('Send Invitation', 'إرسال دعوة')),
    );

    if (compact) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          titleBlock,
          const SizedBox(height: AppSpacing.md),
          Align(alignment: AlignmentDirectional.centerStart, child: sendButton),
        ],
      );
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: titleBlock),
        sendButton,
      ],
    );
  }
}

class _InvitationsKpiRow extends StatelessWidget {
  const _InvitationsKpiRow({required this.invitations});

  final List<AdminInvitationItem> invitations;

  int _count(String status) =>
      invitations.where((item) => item.status == status).length;

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    final width = MediaQuery.sizeOf(context).width;
    final columns = width >= 1180
        ? 5
        : width >= 760
        ? 3
        : width >= 480
        ? 2
        : 1;
    const spacing = AppSpacing.sm + 2;

    final cards = <AdminKpiCard>[
      AdminKpiCard(
        label: l.t('Sent', 'مُرسلة'),
        value: '${_count('SENT')}',
        helper: l.t('Awaiting acceptance', 'في انتظار القبول'),
        icon: Icons.forward_to_inbox_outlined,
        accent: palette.blue,
      ),
      AdminKpiCard(
        label: l.t('Failed', 'فشلت'),
        value: '${_count('FAILED')}',
        helper: l.t('Delivery failed', 'فشل التسليم'),
        icon: Icons.error_outline,
        accent: palette.red,
      ),
      AdminKpiCard(
        label: l.t('Used', 'مستخدمة'),
        value: '${_count('USED')}',
        helper: l.t('Invitation accepted', 'تم قبول الدعوة'),
        icon: Icons.task_alt_outlined,
        accent: palette.green,
      ),
      AdminKpiCard(
        label: l.t('Expired', 'منتهية'),
        value: '${_count('EXPIRED')}',
        helper: l.t('No longer valid', 'لم تعد صالحة'),
        icon: Icons.timer_off_outlined,
        accent: palette.textMuted,
      ),
      AdminKpiCard(
        label: l.t('Revoked', 'ملغاة'),
        value: '${_count('REVOKED')}',
        helper: l.t('Cancelled by admin', 'ألغاها المسؤول'),
        icon: Icons.block_outlined,
        accent: palette.red,
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
              for (var j = 0; j < rowCards.length; j++) ...[
                if (j > 0) const SizedBox(width: spacing),
                Expanded(child: rowCards[j]),
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

class _FiltersPanel extends StatelessWidget {
  const _FiltersPanel({
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
            onChanged: (_) => onSearchChanged(),
            decoration: InputDecoration(
              isDense: true,
              hintText: l.t('Search by email', 'بحث بالبريد'),
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
              contentPadding: const EdgeInsetsDirectional.symmetric(
                horizontal: AppSpacing.md - AppSpacing.xs,
                vertical: AppSpacing.md - AppSpacing.xs,
              ),
            ),
          );

          final roleDropdown = SizedBox(
            width: compact ? double.infinity : 190,
            child: DropdownMenu<String>(
              key: ValueKey('role-filter-$roleFilter'),
              label: Text(l.t('Role', 'الدور')),
              initialSelection: roleFilter,
              expandedInsets: EdgeInsets.zero,
              dropdownMenuEntries: [
                DropdownMenuEntry(value: 'ALL', label: l.t('All', 'الكل')),
                DropdownMenuEntry(
                  value: 'DRIVER',
                  label: l.t('Driver', 'سائق'),
                ),
                DropdownMenuEntry(
                  value: 'MODERATOR',
                  label: l.t('Moderator', 'مشرف'),
                ),
                DropdownMenuEntry(value: 'ADMIN', label: l.t('Admin', 'مسؤول')),
              ],
              onSelected: (value) {
                if (value != null) onRoleChanged(value);
              },
            ),
          );

          final statusDropdown = SizedBox(
            width: compact ? double.infinity : 200,
            child: DropdownMenu<String>(
              key: ValueKey('status-filter-$statusFilter'),
              label: Text(l.t('Status', 'الحالة')),
              initialSelection: statusFilter,
              expandedInsets: EdgeInsets.zero,
              dropdownMenuEntries: [
                DropdownMenuEntry(value: 'ALL', label: l.t('All', 'الكل')),
                DropdownMenuEntry(
                  value: 'PENDING',
                  label: l.t('Pending', 'معلّقة'),
                ),
                DropdownMenuEntry(value: 'SENT', label: l.t('Sent', 'مُرسلة')),
                DropdownMenuEntry(
                  value: 'FAILED',
                  label: l.t('Failed', 'فشلت'),
                ),
                DropdownMenuEntry(
                  value: 'ACCEPTED',
                  label: l.t('Accepted', 'مقبولة'),
                ),
                DropdownMenuEntry(value: 'USED', label: l.t('Used', 'مستخدمة')),
                DropdownMenuEntry(
                  value: 'EXPIRED',
                  label: l.t('Expired', 'منتهية'),
                ),
                DropdownMenuEntry(
                  value: 'REVOKED',
                  label: l.t('Revoked', 'ملغاة'),
                ),
              ],
              onSelected: (value) {
                if (value != null) onStatusChanged(value);
              },
            ),
          );

          final resetButton = OutlinedButton.icon(
            onPressed: onReset,
            icon: const Icon(Icons.restart_alt, size: 18),
            label: Text(l.t('Reset', 'إعادة تعيين')),
          );

          if (compact) {
            return Wrap(
              spacing: AppSpacing.md - AppSpacing.xs,
              runSpacing: AppSpacing.md - AppSpacing.xs,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                SizedBox(width: double.infinity, child: searchField),
                roleDropdown,
                statusDropdown,
                resetButton,
              ],
            );
          }

          return Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(child: searchField),
              const SizedBox(width: AppSpacing.md - AppSpacing.xs),
              roleDropdown,
              const SizedBox(width: AppSpacing.md - AppSpacing.xs),
              statusDropdown,
              const SizedBox(width: AppSpacing.md - AppSpacing.xs),
              resetButton,
            ],
          );
        },
      ),
    );
  }
}

class _InvitationsResultsContainer extends ConsumerWidget {
  const _InvitationsResultsContainer({
    required this.invitations,
    required this.hasActiveFilters,
    required this.onOpenDetails,
    required this.onSendInvitation,
  });

  final List<AdminInvitationItem> invitations;
  final bool hasActiveFilters;
  final ValueChanged<AdminInvitationItem> onOpenDetails;
  final VoidCallback onSendInvitation;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AdminL10n.of(context);
    final colors = AppThemeColors.of(context);
    final palette = context.adminPalette;
    final compact = MediaQuery.sizeOf(context).width < 900;

    if (invitations.isEmpty) {
      return _buildEmptyState(context, l, colors, palette);
    }

    final totalLabel = invitations.length == 1
        ? '1 ${l.t('invitation', 'دعوة')}'
        : '${invitations.length} ${l.t('invitations', 'دعوات')}';

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
          for (var i = 0; i < invitations.length; i++)
            Padding(
              padding: EdgeInsets.only(
                bottom: i < invitations.length - 1 ? AppSpacing.sm + 2 : 0,
              ),
              child: _InvitationRow(
                item: invitations[i],
                compact: true,
                onDetails: () => onOpenDetails(invitations[i]),
                onCopyLink: invitations[i].isActivePending
                    ? () => _copyInvitationLink(
                        context,
                        ref,
                        invitationId: invitations[i].id,
                      )
                    : null,
                onResend: _canActOnInvitation(invitations[i])
                    ? () => _resend(context, ref, invitations[i].id)
                    : null,
                onRevoke: _canActOnInvitation(invitations[i])
                    ? () => _revoke(context, ref, invitations[i].id)
                    : null,
                onViewError: _hasSendError(invitations[i])
                    ? () => _showSendError(context, l, invitations[i])
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
          const _InvitationsColumnHeaderRow(),
          Divider(height: 1, color: colors.borderSubtle),
          for (var i = 0; i < invitations.length; i++)
            _InvitationRow(
              item: invitations[i],
              compact: false,
              showDivider: i < invitations.length - 1,
              onDetails: () => onOpenDetails(invitations[i]),
              onCopyLink: invitations[i].isActivePending
                  ? () => _copyInvitationLink(
                      context,
                      ref,
                      invitationId: invitations[i].id,
                    )
                  : null,
              onResend: _canActOnInvitation(invitations[i])
                  ? () => _resend(context, ref, invitations[i].id)
                  : null,
              onRevoke: _canActOnInvitation(invitations[i])
                  ? () => _revoke(context, ref, invitations[i].id)
                  : null,
              onViewError: _hasSendError(invitations[i])
                  ? () => _showSendError(context, l, invitations[i])
                  : null,
            ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(
    BuildContext context,
    AdminL10n l,
    AppThemeColors colors,
    dynamic palette,
  ) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg - AppSpacing.xs),
      decoration: BoxDecoration(
        color: colors.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: colors.surfaceMuted,
              borderRadius: AppRadius.mdAll,
              border: Border.all(color: colors.borderSubtle),
            ),
            child: Icon(Icons.mail_outline, color: colors.textMuted, size: 22),
          ),
          const SizedBox(height: AppSpacing.md - AppSpacing.xs),
          Text(
            hasActiveFilters
                ? l.t('No invitations found', 'لا توجد دعوات مطابقة')
                : l.t('No invitations yet', 'لا توجد دعوات بعد'),
            style: AdminTypography.sectionTitle(palette),
          ),
          const SizedBox(height: 6),
          Text(
            hasActiveFilters
                ? l.t(
                    'Try adjusting your search or filters.',
                    'حاول تعديل البحث أو عوامل التصفية.',
                  )
                : l.t(
                    'Send your first invitation to onboard a driver, moderator, or admin.',
                    'أرسل أول دعوة لإضافة سائق أو مشرف أو مسؤول.',
                  ),
            style: AdminTypography.pageSubtitle(palette),
          ),
          if (!hasActiveFilters) ...[
            const SizedBox(height: AppSpacing.md - AppSpacing.xs),
            FilledButton.icon(
              onPressed: onSendInvitation,
              style: AppStatusButtonStyle.filled(
                context,
                AppStatusTone.primary,
              ),
              icon: const Icon(Icons.mail_outline, size: 18),
              label: Text(l.t('Send Invitation', 'إرسال دعوة')),
            ),
          ],
        ],
      ),
    );
  }

  Future<AdminInvitationCreateResult?> _resend(
    BuildContext context,
    WidgetRef ref,
    String id,
  ) => _resendInvitation(context, ref, id);

  Future<AdminInvitationItem?> _revoke(
    BuildContext context,
    WidgetRef ref,
    String id,
  ) => _revokeInvitation(context, ref, id);

  Future<void> _showSendError(
    BuildContext context,
    AdminL10n l,
    AdminInvitationItem item,
  ) {
    return showDialog<void>(
      context: context,
      builder: (context) => AppDialogShell(
        title: Text(l.t('Email error', 'خطأ البريد الإلكتروني')),
        content: SelectableText(item.sendError ?? ''),
      ),
    );
  }
}

class _InvitationsColumnHeaderRow extends StatelessWidget {
  const _InvitationsColumnHeaderRow();

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
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
          Expanded(flex: 30, child: label(l.t('INVITATION', 'الدعوة'))),
          const SizedBox(width: AppSpacing.md - AppSpacing.xs),
          Expanded(
            flex: 20,
            child: label(l.t('ROLE & STATUS', 'الدور والحالة')),
          ),
          const SizedBox(width: AppSpacing.md - AppSpacing.xs),
          Expanded(flex: 17, child: label(l.t('CREATED', 'أُنشئت'))),
          const SizedBox(width: AppSpacing.md - AppSpacing.xs),
          Expanded(flex: 19, child: label(l.t('EXPIRES', 'تنتهي'))),
          const SizedBox(width: AppSpacing.md - AppSpacing.xs),
          Expanded(flex: 22, child: label(l.t('CREATED BY', 'أنشأها'))),
          const SizedBox(width: AppSpacing.sm),
          SizedBox(
            width: _invitationActionsColumnWidth,
            child: Text(
              l.t('ACTIONS', 'الإجراءات'),
              textAlign: TextAlign.end,
              style: labelStyle,
            ),
          ),
        ],
      ),
    );
  }
}

class _InvitationRow extends StatefulWidget {
  const _InvitationRow({
    required this.item,
    required this.compact,
    required this.onDetails,
    this.onCopyLink,
    this.onResend,
    this.onRevoke,
    this.onViewError,
    this.showDivider = false,
  });

  final AdminInvitationItem item;
  final bool compact;
  final bool showDivider;
  final VoidCallback onDetails;
  final VoidCallback? onCopyLink;
  final VoidCallback? onResend;
  final VoidCallback? onRevoke;
  final VoidCallback? onViewError;

  @override
  State<_InvitationRow> createState() => _InvitationRowState();
}

class _InvitationRowState extends State<_InvitationRow> {
  var _hovered = false;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final item = widget.item;

    final identity = _InvitationIdentityCell(item: item);
    final roleStatus = _InvitationRoleStatusCell(item: item);
    final created = _InvitationDateCell(dateTime: item.createdAt);
    final expires = _InvitationExpiryCell(item: item);
    final createdBy = _InvitationCreatedByCell(item: item);
    final actions = _InvitationActionsCell(
      compact: widget.compact,
      onDetails: widget.onDetails,
      onCopyLink: widget.onCopyLink,
      onResend: widget.onResend,
      onRevoke: widget.onRevoke,
      onViewError: widget.onViewError,
    );

    final content = widget.compact
        ? Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              identity,
              const SizedBox(height: AppSpacing.sm),
              roleStatus,
              const SizedBox(height: AppSpacing.sm),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: created),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(child: expires),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              createdBy,
              const SizedBox(height: AppSpacing.sm + 2),
              actions,
            ],
          )
        : Padding(
            padding: const EdgeInsetsDirectional.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.md - 2,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(flex: 30, child: identity),
                const SizedBox(width: AppSpacing.md - AppSpacing.xs),
                Expanded(flex: 20, child: roleStatus),
                const SizedBox(width: AppSpacing.md - AppSpacing.xs),
                Expanded(flex: 17, child: created),
                const SizedBox(width: AppSpacing.md - AppSpacing.xs),
                Expanded(flex: 19, child: expires),
                const SizedBox(width: AppSpacing.md - AppSpacing.xs),
                Expanded(flex: 22, child: createdBy),
                const SizedBox(width: AppSpacing.sm),
                SizedBox(width: _invitationActionsColumnWidth, child: actions),
              ],
            ),
          );

    final row = Container(
      decoration: BoxDecoration(
        color: _hovered && !widget.compact
            ? colors.surfaceMuted.withValues(alpha: 0.5)
            : colors.cardSurface,
        borderRadius: widget.compact ? AppRadius.lgAll : null,
        border: widget.compact
            ? Border.all(color: colors.borderSubtle)
            : (widget.showDivider
                  ? Border(
                      bottom: BorderSide(color: colors.borderSubtle, width: 1),
                    )
                  : null),
      ),
      child: content,
    );

    if (widget.compact) return row;

    return MouseRegion(
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: row,
    );
  }
}

class _InvitationIdentityCell extends StatelessWidget {
  const _InvitationIdentityCell({required this.item});

  final AdminInvitationItem item;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          width: 38,
          height: 38,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: colors.primarySoft,
            borderRadius: AppRadius.mdAll,
            border: Border.all(color: colors.borderSubtle),
          ),
          child: Icon(Icons.mail_outline, size: 18, color: colors.primary),
        ),
        const SizedBox(width: AppSpacing.sm + 2),
        Expanded(
          child: Text(
            item.recipientEmail,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: colors.textPrimary,
            ),
          ),
        ),
      ],
    );
  }
}

class _InvitationRoleStatusCell extends StatelessWidget {
  const _InvitationRoleStatusCell({required this.item});

  final AdminInvitationItem item;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.xs + 2,
      runSpacing: AppSpacing.xs,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        AppStatusBadge(
          label: _formatInvitationRole(item.role),
          tone: _invitationRoleTone(item.role),
        ),
        AppStatusBadge(
          label: _formatInvitationStatus(item.status),
          tone: invitationStatusTone(item.status),
        ),
      ],
    );
  }
}

class _InvitationDateCell extends StatelessWidget {
  const _InvitationDateCell({required this.dateTime});

  final DateTime dateTime;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final local = dateTime.toLocal();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          DateFormat.yMMMd().format(local),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
            color: colors.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          DateFormat.jm().format(local),
          style: Theme.of(
            context,
          ).textTheme.labelSmall?.copyWith(color: colors.textMuted),
        ),
      ],
    );
  }
}

class _InvitationExpiryCell extends StatelessWidget {
  const _InvitationExpiryCell({required this.item});

  final AdminInvitationItem item;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final info = _expiryInfo(item.createdAt, item.expiresAt);
    final toneColor = AppStatusStyle.of(context, info.tone).foreground;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          DateFormat.yMMMd().add_jm().format(item.expiresAt.toLocal()),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
            color: colors.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          info.label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: info.tone == AppStatusTone.neutral
                ? colors.textMuted
                : toneColor,
            fontWeight: info.tone == AppStatusTone.neutral
                ? FontWeight.w500
                : FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

class _InvitationCreatedByCell extends StatelessWidget {
  const _InvitationCreatedByCell({required this.item});

  final AdminInvitationItem item;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final creator = item.createdBy;
    final hasName = creator != null && creator.displayName.trim().isNotEmpty;
    final hasEmail = creator != null && creator.email.trim().isNotEmpty;

    if (!hasName && !hasEmail) {
      return Text(
        '—',
        style: Theme.of(
          context,
        ).textTheme.labelSmall?.copyWith(color: colors.textMuted),
      );
    }

    final name = hasName ? creator.displayName : creator.email;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          name,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
            color: colors.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        if (hasName && hasEmail) ...[
          const SizedBox(height: 2),
          Text(
            creator.email,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(
              context,
            ).textTheme.labelSmall?.copyWith(color: colors.textMuted),
          ),
        ],
      ],
    );
  }
}

class _InvitationActionsCell extends StatelessWidget {
  const _InvitationActionsCell({
    required this.compact,
    required this.onDetails,
    this.onCopyLink,
    this.onResend,
    this.onRevoke,
    this.onViewError,
  });

  final bool compact;
  final VoidCallback onDetails;
  final VoidCallback? onCopyLink;
  final VoidCallback? onResend;
  final VoidCallback? onRevoke;
  final VoidCallback? onViewError;

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final hasOverflow =
        onCopyLink != null ||
        onResend != null ||
        onRevoke != null ||
        onViewError != null;

    final detailsButton = OutlinedButton.icon(
      onPressed: onDetails,
      icon: const Icon(Icons.visibility_outlined, size: 16),
      label: Text(l.t('View details', 'عرض التفاصيل')),
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
            tooltip: l.t('More actions', 'إجراءات أخرى'),
            icon: Icon(
              Icons.more_vert,
              size: 18,
              color: AppThemeColors.of(context).textMuted,
            ),
            padding: EdgeInsets.zero,
            onSelected: (action) => action(),
            itemBuilder: (menuContext) => [
              if (onCopyLink != null)
                PopupMenuItem<VoidCallback>(
                  value: onCopyLink,
                  child: _OverflowMenuLabel(
                    icon: Icons.link,
                    label: l.t('Copy link', 'نسخ الرابط'),
                    tone: AppStatusTone.primary,
                  ),
                ),
              if (onResend != null)
                PopupMenuItem<VoidCallback>(
                  value: onResend,
                  child: _OverflowMenuLabel(
                    icon: Icons.send_outlined,
                    label: l.t('Resend', 'إعادة إرسال'),
                    tone: AppStatusTone.warning,
                  ),
                ),
              if (onViewError != null)
                PopupMenuItem<VoidCallback>(
                  value: onViewError,
                  child: _OverflowMenuLabel(
                    icon: Icons.error_outline,
                    label: l.t('View email error', 'عرض خطأ البريد'),
                    tone: AppStatusTone.danger,
                  ),
                ),
              if (onRevoke != null)
                PopupMenuItem<VoidCallback>(
                  value: onRevoke,
                  child: _OverflowMenuLabel(
                    icon: Icons.block_outlined,
                    label: l.t('Revoke', 'إلغاء'),
                    tone: AppStatusTone.danger,
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

class _InvitationDetailDialog extends ConsumerStatefulWidget {
  const _InvitationDetailDialog({required this.item});

  final AdminInvitationItem item;

  @override
  ConsumerState<_InvitationDetailDialog> createState() =>
      _InvitationDetailDialogState();
}

class _InvitationDetailDialogState
    extends ConsumerState<_InvitationDetailDialog> {
  late AdminInvitationItem _item;
  bool _loadingLink = false;
  bool _resending = false;
  bool _revoking = false;

  bool get _busy => _loadingLink || _resending || _revoking;

  @override
  void initState() {
    super.initState();
    _item = widget.item;
  }

  Future<void> _copyLink() async {
    setState(() => _loadingLink = true);
    await _copyInvitationLink(context, ref, invitationId: _item.id);
    if (!mounted) return;
    setState(() => _loadingLink = false);
  }

  Future<void> _resend() async {
    setState(() => _resending = true);
    final result = await _resendInvitation(context, ref, _item.id);
    if (!mounted) return;
    setState(() {
      _resending = false;
      if (result != null) _item = result;
    });
  }

  Future<void> _revoke() async {
    setState(() => _revoking = true);
    final result = await _revokeInvitation(context, ref, _item.id);
    if (!mounted) return;
    setState(() {
      _revoking = false;
      if (result != null) _item = result;
    });
  }

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final dateFormat = DateFormat.yMMMd().add_jm();
    final item = _item;
    final canManage = _canActOnInvitation(item);
    final expiry = _expiryInfo(item.createdAt, item.expiresAt);

    return AppDialogShell(
      title: _InvitationDialogHeader(item: item),
      maxWidth: 820,
      maxHeightFactor: 0.86,
      borderRadius: AppRadius.xlAll,
      closeEnabled: !_busy,
      content: SizedBox(
        width: 764,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _InvitationMetaStrip(
              item: item,
              dateFormat: dateFormat,
              expiry: expiry,
              l: l,
            ),
            const SizedBox(height: AppSpacing.md),
            _InvitationValidityBanner(item: item, expiry: expiry, l: l),
            const SizedBox(height: AppSpacing.md),
            LayoutBuilder(
              builder: (context, constraints) {
                final lifecycle = _InvitationLifecycleCard(
                  item: item,
                  dateFormat: dateFormat,
                  l: l,
                );
                final audit = _InvitationAuditCard(item: item, l: l);

                if (constraints.maxWidth < 620) {
                  return Column(
                    children: [
                      lifecycle,
                      const SizedBox(height: AppSpacing.md),
                      audit,
                    ],
                  );
                }

                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: lifecycle),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(child: audit),
                  ],
                );
              },
            ),
          ],
        ),
      ),
      footer: _InvitationDialogFooter(
        onClose: _busy ? null : () => Navigator.of(context).maybePop(),
        actions: [
          if (item.isActivePending)
            FilledButton.icon(
              onPressed: _busy ? null : _copyLink,
              style: AppStatusButtonStyle.filled(
                context,
                AppStatusTone.primary,
              ),
              icon: _loadingLink
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.link, size: 18),
              label: Text(l.t('Copy link', 'نسخ الرابط')),
            ),
          if (canManage)
            OutlinedButton.icon(
              onPressed: _busy ? null : _resend,
              style: AppStatusButtonStyle.outlined(
                context,
                AppStatusTone.warning,
              ),
              icon: _resending
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.send_outlined, size: 18),
              label: Text(l.t('Resend', 'إعادة إرسال')),
            ),
          if (canManage)
            OutlinedButton.icon(
              onPressed: _busy ? null : _revoke,
              style: AppStatusButtonStyle.outlined(
                context,
                AppStatusTone.danger,
              ),
              icon: _revoking
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.block_outlined, size: 18),
              label: Text(l.t('Revoke', 'إلغاء')),
            ),
        ],
      ),
    );
  }
}

/// Header identity block: icon tile, title, invite email, and status badge
/// grouped together instead of a floating badge under the title.
class _InvitationDialogHeader extends StatelessWidget {
  const _InvitationDialogHeader({required this.item});

  final AdminInvitationItem item;

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final colors = AppThemeColors.of(context);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: colors.primarySoft,
            borderRadius: AppRadius.mdAll,
          ),
          child: Icon(Icons.mail_outline, color: colors.primary),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(l.t('Invitation details', 'تفاصيل الدعوة')),
              const SizedBox(height: AppSpacing.xs),
              Text(
                item.recipientEmail,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: colors.textSecondary,
                  fontWeight: FontWeight.w500,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: AppSpacing.sm),
              AppStatusBadge(
                label: _formatInvitationStatus(item.status),
                tone: invitationStatusTone(item.status),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Equal-width Role / Created / Expires strip with subtle dividers.
class _InvitationMetaStrip extends StatelessWidget {
  const _InvitationMetaStrip({
    required this.item,
    required this.dateFormat,
    required this.expiry,
    required this.l,
  });

  final AdminInvitationItem item;
  final DateFormat dateFormat;
  final _ExpiryInfo expiry;
  final AdminL10n l;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final columns = [
      _MetaColumn(
        icon: Icons.badge_outlined,
        label: l.t('Role', 'الدور'),
        value: _formatInvitationRole(item.role),
      ),
      _MetaColumn(
        icon: Icons.calendar_today_outlined,
        label: l.t('Created', 'أُنشئت'),
        value: dateFormat.format(item.createdAt.toLocal()),
      ),
      _MetaColumn(
        icon: Icons.hourglass_bottom_outlined,
        label: item.status == 'EXPIRED'
            ? l.t('Expired', 'انتهت')
            : l.t('Expires', 'تنتهي'),
        value: dateFormat.format(item.expiresAt.toLocal()),
        caption: expiry.label,
      ),
    ];

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.md - 2,
      ),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          if (constraints.maxWidth < 520) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var i = 0; i < columns.length; i++) ...[
                  if (i > 0) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Divider(height: 1, color: colors.borderSubtle),
                    const SizedBox(height: AppSpacing.sm),
                  ],
                  columns[i],
                ],
              ],
            );
          }

          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var i = 0; i < columns.length; i++) ...[
                if (i > 0)
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.md,
                    ),
                    child: SizedBox(
                      height: 36,
                      child: VerticalDivider(
                        width: 1,
                        thickness: 1,
                        color: colors.borderSubtle,
                      ),
                    ),
                  ),
                Expanded(child: columns[i]),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _MetaColumn extends StatelessWidget {
  const _MetaColumn({
    required this.icon,
    required this.label,
    required this.value,
    this.caption,
  });

  final IconData icon;
  final String label;
  final String value;
  final String? caption;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 26,
              height: 26,
              decoration: BoxDecoration(
                color: colors.surfaceMuted,
                borderRadius: AppRadius.smAll,
              ),
              child: Icon(icon, size: 14, color: colors.textMuted),
            ),
            const SizedBox(width: AppSpacing.sm),
            Text(
              label,
              style: Theme.of(
                context,
              ).textTheme.labelSmall?.copyWith(color: colors.textMuted),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          value,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: colors.textPrimary,
            fontWeight: FontWeight.w700,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        if (caption != null && caption!.trim().isNotEmpty) ...[
          const SizedBox(height: 2),
          Text(
            caption!,
            style: Theme.of(
              context,
            ).textTheme.labelSmall?.copyWith(color: colors.textMuted),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ],
    );
  }
}

/// Compact status-aware validity explanation. Never invents a state that
/// contradicts the invitation's real status/date.
class _InvitationValidityBanner extends StatelessWidget {
  const _InvitationValidityBanner({
    required this.item,
    required this.expiry,
    required this.l,
  });

  final AdminInvitationItem item;
  final _ExpiryInfo expiry;
  final AdminL10n l;

  @override
  Widget build(BuildContext context) {
    late AppStatusTone tone;
    late IconData icon;
    late String title;
    String? subtitle;

    switch (item.status) {
      case 'USED':
        tone = AppStatusTone.success;
        icon = Icons.check_circle_outline;
        title = l.t('Invitation was accepted', 'تم قبول الدعوة');
        break;
      case 'REVOKED':
        tone = AppStatusTone.danger;
        icon = Icons.block_outlined;
        title = l.t('Invitation was revoked', 'تم إلغاء الدعوة');
        break;
      case 'EXPIRED':
        tone = AppStatusTone.neutral;
        icon = Icons.event_busy_outlined;
        title = l.t('Invitation link has expired', 'انتهت صلاحية رابط الدعوة');
        break;
      case 'FAILED':
        tone = AppStatusTone.danger;
        icon = Icons.error_outline;
        title = l.t('Invitation delivery failed', 'فشل إرسال الدعوة');
        subtitle = (item.sendError?.trim().isNotEmpty ?? false)
            ? item.sendError!.trim()
            : l.t(
                'The invitation link is still valid and can be shared manually.',
                'رابط الدعوة لا يزال صالحاً ويمكن مشاركته يدوياً.',
              );
        break;
      default:
        if (expiry.tone == AppStatusTone.danger) {
          tone = AppStatusTone.neutral;
          icon = Icons.event_busy_outlined;
          title = l.t(
            'Invitation link has expired',
            'انتهت صلاحية رابط الدعوة',
          );
        } else if (expiry.tone == AppStatusTone.warning) {
          tone = AppStatusTone.warning;
          icon = Icons.schedule_outlined;
          title = l.t('Invitation expires soon', 'الدعوة على وشك الانتهاء');
          subtitle = expiry.label;
        } else {
          tone = AppStatusTone.success;
          icon = Icons.verified_outlined;
          title = l.t('Invitation link is active', 'رابط الدعوة نشط');
          subtitle = expiry.label;
        }
    }

    final style = AppStatusStyle.of(context, tone);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm + AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: style.background,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: style.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: style.foreground),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: style.foreground,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (subtitle != null && subtitle.trim().isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: style.foreground.withValues(alpha: 0.9),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _InvitationLifecycleCard extends StatelessWidget {
  const _InvitationLifecycleCard({
    required this.item,
    required this.dateFormat,
    required this.l,
  });

  final AdminInvitationItem item;
  final DateFormat dateFormat;
  final AdminL10n l;

  String _fmt(DateTime value) => dateFormat.format(value.toLocal());

  @override
  Widget build(BuildContext context) {
    return AppDialogSection(
      title: l.t('Invitation lifecycle', 'دورة حياة الدعوة'),
      icon: Icons.timeline_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppDialogInfoRow(
            icon: Icons.flag_outlined,
            label: l.t('Current status', 'الحالة الحالية'),
            value: _formatInvitationStatus(item.status),
          ),
          const SizedBox(height: AppSpacing.md),
          AppDialogInfoRow(
            icon: Icons.add_circle_outline,
            label: l.t('Created', 'تاريخ الإنشاء'),
            value: _fmt(item.createdAt),
          ),
          if (item.sentAt != null) ...[
            const SizedBox(height: AppSpacing.md),
            AppDialogInfoRow(
              icon: Icons.outgoing_mail,
              label: l.t('Sent', 'تاريخ الإرسال'),
              value: _fmt(item.sentAt!),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          AppDialogInfoRow(
            icon: Icons.hourglass_bottom_outlined,
            label: item.status == 'EXPIRED'
                ? l.t('Expired', 'تاريخ الانتهاء')
                : l.t('Expires', 'تاريخ الانتهاء'),
            value: _fmt(item.expiresAt),
          ),
          if (item.acceptedAt != null) ...[
            const SizedBox(height: AppSpacing.md),
            AppDialogInfoRow(
              icon: Icons.check_circle_outline,
              label: l.t('Accepted', 'تاريخ القبول'),
              value: _fmt(item.acceptedAt!),
            ),
          ],
          if (item.revokedAt != null) ...[
            const SizedBox(height: AppSpacing.md),
            AppDialogInfoRow(
              icon: Icons.block_outlined,
              label: l.t('Revoked', 'تاريخ الإلغاء'),
              value: _fmt(item.revokedAt!),
            ),
          ],
        ],
      ),
    );
  }
}

class _InvitationAuditCard extends StatelessWidget {
  const _InvitationAuditCard({required this.item, required this.l});

  final AdminInvitationItem item;
  final AdminL10n l;

  static const _emptyValue = '—';

  @override
  Widget build(BuildContext context) {
    final creatorName = item.createdBy?.displayName.trim();
    final creatorEmail = item.createdBy?.email.trim();

    return AppDialogSection(
      title: l.t('Audit & security', 'التدقيق والأمان'),
      icon: Icons.shield_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppDialogInfoRow(
            icon: Icons.person_outline,
            label: l.t('Created by', 'أنشأها'),
            value: (creatorName != null && creatorName.isNotEmpty)
                ? creatorName
                : _emptyValue,
          ),
          const SizedBox(height: AppSpacing.md),
          AppDialogInfoRow(
            icon: Icons.mail_outline,
            label: l.t('Creator email', 'بريد المُنشئ'),
            value: (creatorEmail != null && creatorEmail.isNotEmpty)
                ? creatorEmail
                : _emptyValue,
          ),
          const SizedBox(height: AppSpacing.md),
          AppDialogInfoRow(
            icon: Icons.badge_outlined,
            label: l.t('Intended role', 'الدور المستهدف'),
            value: _formatInvitationRole(item.role),
          ),
          const SizedBox(height: AppSpacing.md),
          AppDialogNote(
            title: l.t('Security', 'الأمان'),
            note: l.t(
              'Invitation links grant access to a protected role. Share only with the intended recipient.',
              'روابط الدعوة تمنح الوصول إلى دور محمي. شاركها فقط مع المستلم المقصود.',
            ),
          ),
        ],
      ),
    );
  }
}

/// Fixed footer with a neutral Close action on one side and status-aware
/// actions on the other, wrapping cleanly on narrow widths.
class _InvitationDialogFooter extends StatelessWidget {
  const _InvitationDialogFooter({required this.onClose, required this.actions});

  final VoidCallback? onClose;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final closeButton = OutlinedButton(
      onPressed: onClose,
      style: AppStatusButtonStyle.outlined(context, AppStatusTone.neutral),
      child: Text(l.t('Close', 'إغلاق')),
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 480) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (actions.isNotEmpty) ...[
                Wrap(
                  alignment: WrapAlignment.end,
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: actions,
                ),
                const SizedBox(height: AppSpacing.sm),
              ],
              closeButton,
            ],
          );
        }

        return Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            closeButton,
            const SizedBox(width: AppSpacing.sm),
            Flexible(
              child: Wrap(
                alignment: WrapAlignment.end,
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: actions,
              ),
            ),
          ],
        );
      },
    );
  }
}

class _CreateInvitationDialog extends ConsumerStatefulWidget {
  const _CreateInvitationDialog({required this.onCreated, this.onDuplicate});

  final VoidCallback onCreated;
  final ValueChanged<AdminInvitationItem>? onDuplicate;

  @override
  ConsumerState<_CreateInvitationDialog> createState() =>
      _CreateInvitationDialogState();
}

class _CreateInvitationDialogState
    extends ConsumerState<_CreateInvitationDialog> {
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
      final result = await ref
          .read(adminInvitationsRepositoryProvider)
          .createInvitation(
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

      if (error is ApiException && error.code == 'EMAIL_DELIVERY_FAILED') {
        widget.onCreated();
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Invitation was saved, but the email could not be delivered. Update the mail configuration, then resend it from the invitations list.',
            ),
          ),
        );
        return;
      }

      if (error is ApiException &&
          error.code == 'DUPLICATE_PENDING_INVITATION') {
        final existing = _parseExistingInvitation(error);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(AdminL10n.of(context).localizedError(error)),
            action: existing != null && widget.onDuplicate != null
                ? SnackBarAction(
                    label: AdminL10n.of(context).view,
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
        SnackBar(content: Text(AdminL10n.of(context).localizedError(error))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);

    return AppDialogShell(
      title: Text(l.t('Send Email Invitation', 'إرسال دعوة بالبريد')),
      maxWidth: 520,
      closeEnabled: !_submitting,
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
                  DropdownMenuItem(
                    value: 'MODERATOR',
                    child: Text('Moderator'),
                  ),
                  DropdownMenuItem(value: 'ADMIN', child: Text('Admin')),
                ],
                onChanged: _submitting
                    ? null
                    : (value) => setState(() => _role = value!),
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
                Text(
                  _sendError!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
            ],
          ),
        ),
      ),
      footer: AppDialogFooter.form(
        primaryAction: FilledButton(
          onPressed: _submitting ? null : _submit,
          child: _submitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Text(l.t('Send invitation', 'إرسال الدعوة')),
        ),
      ),
    );
  }
}
