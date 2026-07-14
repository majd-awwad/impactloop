import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../core/config/api_config.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/widgets/app_dialog_detail.dart';
import '../../../../shared/widgets/app_dialog_footer.dart';
import '../../../../shared/widgets/app_dialog_shell.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/supplier_verification_status_presentation.dart';
import '../../data/admin_supplier_verifications_api.dart';
import '../../data/models/admin_supplier_verifications_models.dart';
import '../l10n/admin_l10n.dart';
import '../theme/admin_decoration_set.dart';
import '../widgets/admin_empty_state.dart';
import '../widgets/admin_kpi_card.dart' show AdminTypography;

class AdminSupplierVerificationPage extends ConsumerWidget {
  const AdminSupplierVerificationPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    final asyncData = ref.watch(adminSupplierVerificationsProvider);

    return asyncData.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              error.toString(),
              style: AdminTypography.pageSubtitle(palette),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () =>
                  ref.invalidate(adminSupplierVerificationsProvider),
              child: Text(l.t('Retry', 'إعادة المحاولة')),
            ),
          ],
        ),
      ),
      data: (response) => _VerificationBody(response: response),
    );
  }
}

class _VerificationBody extends ConsumerStatefulWidget {
  const _VerificationBody({required this.response});

  final AdminSupplierVerificationListResponse response;

  @override
  ConsumerState<_VerificationBody> createState() => _VerificationBodyState();
}

class _VerificationBodyState extends ConsumerState<_VerificationBody> {
  final _searchController = TextEditingController();
  final _cityController = TextEditingController();
  String _statusFilter = 'ALL';
  String _typeFilter = 'ALL';

  @override
  void initState() {
    super.initState();
    final filters = ref.read(adminSupplierVerificationFiltersProvider);
    _searchController.text = filters.search;
    _cityController.text = filters.city;
    _statusFilter = filters.status;
    _typeFilter = filters.supplierType;
  }

  @override
  void dispose() {
    _searchController.dispose();
    _cityController.dispose();
    super.dispose();
  }

  void _applyFilters() {
    ref
        .read(adminSupplierVerificationFiltersProvider.notifier)
        .updateFilters(
          AdminSupplierVerificationFilters(
            search: _searchController.text,
            status: _statusFilter,
            supplierType: _typeFilter,
            city: _cityController.text,
            page: 1,
          ),
        );
  }

  void _resetFilters() {
    setState(() {
      _searchController.clear();
      _cityController.clear();
      _statusFilter = 'ALL';
      _typeFilter = 'ALL';
    });
    ref
        .read(adminSupplierVerificationFiltersProvider.notifier)
        .updateFilters(const AdminSupplierVerificationFilters());
  }

  Future<void> _openDetails(AdminSupplierVerificationListItem item) async {
    await showDialog<void>(
      context: context,
      builder: (context) => _VerificationDetailsDialog(
        supplierProfileId: item.supplierProfileId,
        onActionCompleted: () {
          ref.invalidate(adminSupplierVerificationsProvider);
        },
      ),
    );
  }

  Future<void> _runQuickAction({
    required AdminSupplierVerificationListItem item,
    required String action,
  }) async {
    try {
      if (action == 'approve') {
        final confirmed = await _confirmApprove(context);
        if (!confirmed || !mounted) return;

        final api = ref.read(adminSupplierVerificationsApiProvider);
        await api.approveVerification(id: item.supplierProfileId);
        if (!mounted) return;
        ref.invalidate(adminSupplierVerificationsProvider);
        await ref.read(adminSupplierVerificationsProvider.future);
        _showSnack('Supplier verification approved.');
        return;
      }

      final note = await _promptAdminNote(
        context,
        title: action == 'reject' ? 'Reject verification' : 'Request changes',
        required: true,
        tone: action == 'reject' ? AppStatusTone.danger : AppStatusTone.warning,
      );
      if (note == null || !mounted) return;

      final api = ref.read(adminSupplierVerificationsApiProvider);
      if (action == 'reject') {
        await api.rejectVerification(
          id: item.supplierProfileId,
          adminNote: note,
        );
        if (!mounted) return;
        _showSnack('Supplier verification rejected.');
      } else {
        await api.requestChanges(id: item.supplierProfileId, adminNote: note);
        if (!mounted) return;
        _showSnack('Changes requested from supplier.');
      }

      ref.invalidate(adminSupplierVerificationsProvider);
      await ref.read(adminSupplierVerificationsProvider.future);
    } on ApiException catch (error) {
      if (!mounted) return;
      _showSnack(error.displayMessage, isError: true);
    } catch (error) {
      if (!mounted) return;
      _showSnack(error.toString(), isError: true);
    }
  }

  void _showSnack(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Theme.of(context).colorScheme.error : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    final items = widget.response.items;
    final summary = widget.response.summary;

    return ListView(
      padding: const EdgeInsetsDirectional.only(bottom: 24),
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              l.navSupplierVerification,
              style: AdminTypography.pageTitle(palette),
            ),
            const SizedBox(height: 6),
            Text(
              l.t(
                'Review official supplier accounts before they publish as verified organizations.',
                'راجع حسابات الموردين الرسمية قبل نشرها كمؤسسات موثّقة.',
              ),
              style: AdminTypography.pageSubtitle(palette),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            _SummaryChip(
              label: l.t('Pending', 'قيد الانتظار'),
              count: summary.pending,
              color: AppStatusStyle.of(
                context,
                supplierVerificationStatusTone('PENDING'),
              ).foreground,
            ),
            _SummaryChip(
              label: l.t('Approved', 'موافق عليه'),
              count: summary.approved,
              color: AppStatusStyle.of(
                context,
                supplierVerificationStatusTone('APPROVED'),
              ).foreground,
            ),
            _SummaryChip(
              label: l.t('Rejected', 'مرفوض'),
              count: summary.rejected,
              color: AppStatusStyle.of(
                context,
                supplierVerificationStatusTone('REJECTED'),
              ).foreground,
            ),
            _SummaryChip(
              label: l.t('Changes requested', 'طلب تعديلات'),
              count: summary.changesRequested,
              color: AppStatusStyle.of(
                context,
                supplierVerificationStatusTone('CHANGES_REQUESTED'),
              ).foreground,
            ),
          ],
        ),
        const SizedBox(height: 16),
        _FiltersBar(
          searchController: _searchController,
          cityController: _cityController,
          statusFilter: _statusFilter,
          typeFilter: _typeFilter,
          onStatusChanged: (value) => setState(() => _statusFilter = value),
          onTypeChanged: (value) => setState(() => _typeFilter = value),
          onApply: _applyFilters,
          onReset: _resetFilters,
        ),
        const SizedBox(height: 12),
        if (items.isEmpty)
          AdminEmptyState(
            icon: Icons.verified_user_outlined,
            title: l.t(
              'No supplier verification requests yet',
              'لا توجد طلبات تحقق من الموردين بعد',
            ),
            subtitle: l.t(
              'Official supplier submissions will appear here for review.',
              'ستظهر طلبات الموردين الرسمية هنا للمراجعة.',
            ),
          )
        else
          ...items.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _VerificationCard(
                item: item,
                onViewDetails: () => _openDetails(item),
                onApprove: () => _runQuickAction(item: item, action: 'approve'),
                onReject: () => _runQuickAction(item: item, action: 'reject'),
                onRequestChanges: () =>
                    _runQuickAction(item: item, action: 'request-changes'),
              ),
            ),
          ),
      ],
    );
  }
}

class _FiltersBar extends StatelessWidget {
  const _FiltersBar({
    required this.searchController,
    required this.cityController,
    required this.statusFilter,
    required this.typeFilter,
    required this.onStatusChanged,
    required this.onTypeChanged,
    required this.onApply,
    required this.onReset,
  });

  final TextEditingController searchController;
  final TextEditingController cityController;
  final String statusFilter;
  final String typeFilter;
  final ValueChanged<String> onStatusChanged;
  final ValueChanged<String> onTypeChanged;
  final VoidCallback onApply;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    final compact = MediaQuery.sizeOf(context).width < 720;

    Widget field(Widget child) {
      if (compact) {
        return SizedBox(width: double.infinity, child: child);
      }
      return child;
    }

    return Container(
      padding: const EdgeInsetsDirectional.fromSTEB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: palette.cardBorder),
      ),
      child: compact
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                field(_searchField(l)),
                const SizedBox(height: 10),
                field(_cityField(l)),
                const SizedBox(height: 10),
                field(_statusField()),
                const SizedBox(height: 10),
                field(_typeField(l)),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(child: _applyButton(l)),
                    const SizedBox(width: 10),
                    Expanded(child: _resetButton(l)),
                  ],
                ),
              ],
            )
          : Wrap(
              spacing: 10,
              runSpacing: 10,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                SizedBox(width: 280, child: _searchField(l)),
                SizedBox(width: 180, child: _cityField(l)),
                SizedBox(width: 200, child: _statusField()),
                SizedBox(width: 220, child: _typeField(l)),
                _applyButton(l),
                _resetButton(l),
              ],
            ),
    );
  }

  Widget _searchField(AdminL10n l) => TextField(
    controller: searchController,
    decoration: InputDecoration(
      isDense: true,
      labelText: l.t(
        'Search supplier, owner, or email',
        'بحث بالمورد أو المالك أو البريد',
      ),
      prefixIcon: const Icon(Icons.search),
      border: const OutlineInputBorder(),
    ),
  );

  Widget _cityField(AdminL10n l) => TextField(
    controller: cityController,
    decoration: InputDecoration(
      isDense: true,
      labelText: l.t('City', 'المدينة'),
      prefixIcon: const Icon(Icons.location_city_outlined),
      border: const OutlineInputBorder(),
    ),
  );

  Widget _statusField() => DropdownButtonFormField<String>(
    key: ValueKey('verification-status-$statusFilter'),
    initialValue: statusFilter,
    isExpanded: true,
    decoration: const InputDecoration(
      isDense: true,
      labelText: 'Status',
      border: OutlineInputBorder(),
    ),
    items: const [
      DropdownMenuItem(value: 'ALL', child: Text('All')),
      DropdownMenuItem(value: 'PENDING', child: Text('Pending')),
      DropdownMenuItem(value: 'APPROVED', child: Text('Approved')),
      DropdownMenuItem(value: 'REJECTED', child: Text('Rejected')),
      DropdownMenuItem(
        value: 'CHANGES_REQUESTED',
        child: Text('Changes requested'),
      ),
    ],
    onChanged: (value) {
      if (value != null) onStatusChanged(value);
    },
  );

  Widget _typeField(AdminL10n l) => DropdownButtonFormField<String>(
    key: ValueKey('verification-type-$typeFilter'),
    initialValue: typeFilter,
    isExpanded: true,
    decoration: InputDecoration(
      isDense: true,
      labelText: l.t('Supplier type', 'نوع المورد'),
      border: const OutlineInputBorder(),
    ),
    items: const [
      DropdownMenuItem(value: 'ALL', child: Text('All')),
      DropdownMenuItem(value: 'WORKSHOP', child: Text('Workshop')),
      DropdownMenuItem(value: 'FACTORY', child: Text('Factory')),
      DropdownMenuItem(
        value: 'EDUCATIONAL_INSTITUTION',
        child: Text('Educational institution'),
      ),
    ],
    onChanged: (value) {
      if (value != null) onTypeChanged(value);
    },
  );

  Widget _applyButton(AdminL10n l) => FilledButton.icon(
    onPressed: onApply,
    icon: const Icon(Icons.filter_alt_outlined),
    label: Text(l.t('Apply filters', 'تطبيق الفلاتر')),
  );

  Widget _resetButton(AdminL10n l) => OutlinedButton.icon(
    onPressed: onReset,
    icon: const Icon(Icons.restart_alt_outlined),
    label: Text(l.t('Reset filters', 'إعادة تعيين الفلاتر')),
  );
}

class _VerificationCard extends StatelessWidget {
  const _VerificationCard({
    required this.item,
    required this.onViewDetails,
    required this.onApprove,
    required this.onReject,
    required this.onRequestChanges,
  });

  final AdminSupplierVerificationListItem item;
  final VoidCallback onViewDetails;
  final VoidCallback onApprove;
  final VoidCallback onReject;
  final VoidCallback onRequestChanges;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final dateFormat = DateFormat.yMMMd();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: palette.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  item.organizationName,
                  style: AdminTypography.pageTitle(
                    palette,
                  ).copyWith(fontSize: 18),
                ),
              ),
              _StatusBadge(status: item.verificationStatus),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '${_formatSupplierType(item.supplierType)} · ${_locationLabel(item.city, item.area)}',
            style: AdminTypography.pageSubtitle(palette),
          ),
          const SizedBox(height: 4),
          Text(
            '${item.ownerName} · ${item.ownerEmail}',
            style: AdminTypography.kpiHelper(palette),
          ),
          const SizedBox(height: 4),
          Text(
            item.submittedAt == null
                ? 'Submitted: —'
                : 'Submitted: ${dateFormat.format(item.submittedAt!)}',
            style: AdminTypography.kpiHelper(palette),
          ),
          const SizedBox(height: 12),
          _ActionButtons(
            onView: onViewDetails,
            onApprove: onApprove,
            onReject: onReject,
            onRequestChanges: onRequestChanges,
            compact: true,
          ),
        ],
      ),
    );
  }
}

class _ActionButtons extends StatelessWidget {
  const _ActionButtons({
    required this.onView,
    required this.onApprove,
    required this.onReject,
    required this.onRequestChanges,
    this.compact = false,
  });

  final VoidCallback onView;
  final VoidCallback onApprove;
  final VoidCallback onReject;
  final VoidCallback onRequestChanges;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final children = [
      TextButton(onPressed: onView, child: const Text('View')),
      TextButton(
        onPressed: onApprove,
        style: AppStatusButtonStyle.text(context, AppStatusTone.success),
        child: const Text('Approve'),
      ),
      TextButton(
        onPressed: onReject,
        style: AppStatusButtonStyle.text(context, AppStatusTone.danger),
        child: const Text('Reject'),
      ),
      TextButton(
        onPressed: onRequestChanges,
        style: AppStatusButtonStyle.text(context, AppStatusTone.warning),
        child: Text(compact ? 'Changes' : 'Request changes'),
      ),
    ];

    if (compact) {
      return Wrap(spacing: 4, runSpacing: 4, children: children);
    }

    return Row(mainAxisSize: MainAxisSize.min, children: children);
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) => AppStatusBadge(
    label: _formatStatusLabel(status),
    tone: supplierVerificationStatusTone(status),
  );
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
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: 14,
        vertical: 10,
      ),
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
          Text(
            '$count',
            style: AdminTypography.kpiValue(palette).copyWith(fontSize: 18),
          ),
          const SizedBox(width: 6),
          Text(label, style: AdminTypography.kpiHelper(palette)),
        ],
      ),
    );
  }
}

class _VerificationDetailsDialog extends ConsumerStatefulWidget {
  const _VerificationDetailsDialog({
    required this.supplierProfileId,
    required this.onActionCompleted,
  });

  final String supplierProfileId;
  final VoidCallback onActionCompleted;

  @override
  ConsumerState<_VerificationDetailsDialog> createState() =>
      _VerificationDetailsDialogState();
}

class _VerificationDetailsDialogState
    extends ConsumerState<_VerificationDetailsDialog> {
  late Future<AdminSupplierVerificationDetail> _detailFuture;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _loadDetail();
  }

  void _loadDetail() {
    setState(() {
      _detailFuture = ref
          .read(adminSupplierVerificationsApiProvider)
          .fetchVerificationDetail(widget.supplierProfileId);
    });
  }

  Future<void> _runAction(
    Future<void> Function() action,
    String success,
  ) async {
    if (_isSubmitting) return;

    setState(() => _isSubmitting = true);
    try {
      await action();
      if (!mounted) return;
      widget.onActionCompleted();
      ref.invalidate(adminSupplierVerificationsProvider);
      await ref.read(adminSupplierVerificationsProvider.future);
      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(success)));
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.displayMessage),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString()),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  }

  Future<void> _approve() async {
    final confirmed = await _confirmApprove(context);
    if (!confirmed || !mounted) return;

    final optionalNote = await _promptAdminNote(
      context,
      title: 'Approval note (optional)',
      required: false,
      tone: AppStatusTone.success,
    );
    if (!mounted) return;

    final api = ref.read(adminSupplierVerificationsApiProvider);
    await _runAction(
      () => api.approveVerification(
        id: widget.supplierProfileId,
        adminNote: optionalNote,
      ),
      'Supplier verification approved.',
    );
  }

  Future<void> _reject() async {
    final note = await _promptAdminNote(
      context,
      title: 'Rejection reason',
      required: true,
      tone: AppStatusTone.danger,
    );
    if (note == null || !mounted) return;

    final api = ref.read(adminSupplierVerificationsApiProvider);
    await _runAction(
      () =>
          api.rejectVerification(id: widget.supplierProfileId, adminNote: note),
      'Supplier verification rejected.',
    );
  }

  Future<void> _requestChanges() async {
    final note = await _promptAdminNote(
      context,
      title: 'Changes requested',
      required: true,
      tone: AppStatusTone.warning,
    );
    if (note == null || !mounted) return;

    final api = ref.read(adminSupplierVerificationsApiProvider);
    await _runAction(
      () => api.requestChanges(id: widget.supplierProfileId, adminNote: note),
      'Changes requested from supplier.',
    );
  }

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat.yMMMd().add_jm();

    return AppDialogShell(
      title: FutureBuilder<AdminSupplierVerificationDetail>(
        future: _detailFuture,
        builder: (context, snapshot) => snapshot.hasData
            ? _VerificationHeader(detail: snapshot.data!)
            : const Text('Supplier verification details'),
      ),
      maxWidth: 880,
      maxHeightFactor: 0.9,
      closeEnabled: !_isSubmitting,
      content: SizedBox(
        width: 840,
        child: FutureBuilder<AdminSupplierVerificationDetail>(
          future: _detailFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const SizedBox(
                height: 180,
                child: Center(child: CircularProgressIndicator()),
              );
            }

            if (snapshot.hasError) {
              return Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(snapshot.error.toString()),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: () => setState(_loadDetail),
                    child: const Text('Retry'),
                  ),
                ],
              );
            }

            final detail = snapshot.data!;
            final organizationCard = _VerificationSectionCard(
              title: 'Organization',
              icon: Icons.storefront_outlined,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    detail.organizationName,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: AppThemeColors.of(context).textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  AppStatusBadge(
                    label: _formatSupplierType(detail.supplierType),
                    tone: AppStatusTone.neutral,
                  ),
                  if (detail.description?.trim().isNotEmpty ?? false) ...[
                    const SizedBox(height: AppSpacing.md),
                    _DetailNote(
                      title: 'Description',
                      note: detail.description!,
                    ),
                  ],
                ],
              ),
            );
            final contactCard = _VerificationSectionCard(
              title: 'Owner & contact',
              icon: Icons.person_outline,
              child: Column(
                children: [
                  _DetailInfoRow(
                    icon: Icons.person_outline,
                    label: 'Owner',
                    value: detail.owner.displayName,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _DetailInfoRow(
                    icon: Icons.mail_outline,
                    label: 'Email',
                    value: detail.owner.email,
                  ),
                  if (detail.owner.phone?.trim().isNotEmpty ?? false) ...[
                    const SizedBox(height: AppSpacing.md),
                    _DetailInfoRow(
                      icon: Icons.phone_outlined,
                      label: 'Phone',
                      value: detail.owner.phone,
                    ),
                  ],
                ],
              ),
            );
            final locationCard = _VerificationSectionCard(
              title: 'Location',
              icon: Icons.location_on_outlined,
              child: _DetailInfoRow(
                icon: Icons.place_outlined,
                label: 'Business location',
                value: _locationLabel(
                  detail.location.city,
                  detail.location.area,
                  detail.location.addressLine,
                ),
              ),
            );
            final historyCard = _VerificationSectionCard(
              title: 'Verification history',
              icon: Icons.verified_user_outlined,
              child: _VerificationHistory(
                detail: detail,
                dateFormat: dateFormat,
              ),
            );

            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _VerificationMetaStrip(detail: detail, dateFormat: dateFormat),
                const SizedBox(height: AppSpacing.md),
                LayoutBuilder(
                  builder: (context, constraints) {
                    final left = Column(
                      children: [
                        organizationCard,
                        const SizedBox(height: AppSpacing.md),
                        contactCard,
                        if (detail.verificationDocumentUrl?.isNotEmpty ??
                            false) ...[
                          const SizedBox(height: AppSpacing.md),
                          _VerificationDocumentCard(
                            documentUrl: detail.verificationDocumentUrl!,
                            documentName: detail.verificationDocumentName,
                          ),
                        ],
                      ],
                    );
                    final right = Column(
                      children: [
                        locationCard,
                        const SizedBox(height: AppSpacing.md),
                        historyCard,
                      ],
                    );

                    if (constraints.maxWidth < 700) {
                      return Column(
                        children: [
                          left,
                          const SizedBox(height: AppSpacing.md),
                          right,
                        ],
                      );
                    }
                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(child: left),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(child: right),
                      ],
                    );
                  },
                ),
                const SizedBox(height: AppSpacing.md),
              ],
            );
          },
        ),
      ),
      footer: AppDialogFooter.actions(
        actions: [
          OutlinedButton(
            onPressed: _isSubmitting ? null : _requestChanges,
            style: AppStatusButtonStyle.outlined(
              context,
              AppStatusTone.warning,
            ),
            child: const Text('Request changes'),
          ),
          OutlinedButton(
            onPressed: _isSubmitting ? null : _reject,
            style: AppStatusButtonStyle.outlined(context, AppStatusTone.danger),
            child: const Text('Reject'),
          ),
          FilledButton(
            onPressed: _isSubmitting ? null : _approve,
            style: AppStatusButtonStyle.filled(context, AppStatusTone.success),
            child: _isSubmitting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Approve'),
          ),
        ],
      ),
    );
  }
}

class _VerificationHeader extends StatelessWidget {
  const _VerificationHeader({required this.detail});

  final AdminSupplierVerificationDetail detail;

  @override
  Widget build(BuildContext context) => AppDialogTitleBlock(
    icon: Icons.storefront_outlined,
    title: detail.organizationName,
    badges: [
      AppStatusBadge(
        label: _formatStatusLabel(detail.verificationStatus),
        tone: supplierVerificationStatusTone(detail.verificationStatus),
      ),
      AppStatusBadge(
        label: _formatSupplierType(detail.supplierType),
        tone: AppStatusTone.neutral,
      ),
    ],
  );
}

class _VerificationMetaStrip extends StatelessWidget {
  const _VerificationMetaStrip({
    required this.detail,
    required this.dateFormat,
  });

  final AdminSupplierVerificationDetail detail;
  final DateFormat dateFormat;

  @override
  Widget build(BuildContext context) => AppDialogMetaStrip(
    items: [
      _MetaItem(
        icon: Icons.person_outline,
        label: 'Owner',
        value: detail.owner.displayName,
      ),
      _MetaItem(
        icon: Icons.mail_outline,
        label: 'Email',
        value: detail.owner.email,
      ),
      if (detail.submittedAt != null)
        _MetaItem(
          icon: Icons.calendar_today_outlined,
          label: 'Submitted',
          value: dateFormat.format(detail.submittedAt!),
        ),
      if (detail.reviewedAt != null)
        _MetaItem(
          icon: Icons.task_alt_outlined,
          label: 'Reviewed',
          value: dateFormat.format(detail.reviewedAt!),
        ),
    ],
  );
}

class _MetaItem extends StatelessWidget {
  const _MetaItem({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) =>
      AppDialogMetaItem(icon: icon, label: label, value: value);
}

class _VerificationSectionCard extends StatelessWidget {
  const _VerificationSectionCard({
    required this.title,
    required this.icon,
    required this.child,
  });

  final String title;
  final IconData icon;
  final Widget child;

  @override
  Widget build(BuildContext context) =>
      AppDialogSection(title: title, icon: icon, child: child);
}

class _DetailInfoRow extends StatelessWidget {
  const _DetailInfoRow({required this.label, required this.value, this.icon});

  final String label;
  final String? value;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => AppDialogInfoRow(
    label: label,
    value: value?.trim().isNotEmpty ?? false ? value! : 'Not provided',
    icon: icon,
  );
}

class _DetailNote extends StatelessWidget {
  const _DetailNote({required this.title, required this.note});

  final String title;
  final String note;

  @override
  Widget build(BuildContext context) => AppDialogNote(title: title, note: note);
}

class _VerificationHistory extends StatelessWidget {
  const _VerificationHistory({required this.detail, required this.dateFormat});

  final AdminSupplierVerificationDetail detail;
  final DateFormat dateFormat;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _DetailInfoRow(
          label: 'Current status',
          value: _formatStatusLabel(detail.verificationStatus),
        ),
        const SizedBox(height: AppSpacing.sm),
        AppStatusBadge(
          label: _formatStatusLabel(detail.verificationStatus),
          tone: supplierVerificationStatusTone(detail.verificationStatus),
        ),
        if (detail.submittedAt != null) ...[
          const SizedBox(height: AppSpacing.md),
          _DetailInfoRow(
            label: 'Submitted',
            value: dateFormat.format(detail.submittedAt!),
          ),
        ],
        if (detail.reviewedAt != null) ...[
          const SizedBox(height: AppSpacing.md),
          _DetailInfoRow(
            label: 'Reviewed',
            value: dateFormat.format(detail.reviewedAt!),
          ),
        ],
        if (detail.reviewedByName?.trim().isNotEmpty ?? false) ...[
          const SizedBox(height: AppSpacing.md),
          _DetailInfoRow(
            label: 'Reviewer',
            value: detail.reviewedByEmail?.trim().isNotEmpty ?? false
                ? '${detail.reviewedByName} · ${detail.reviewedByEmail}'
                : detail.reviewedByName,
          ),
        ],
        if (detail.adminNote?.trim().isNotEmpty ?? false) ...[
          const SizedBox(height: AppSpacing.md),
          _DetailNote(title: 'Review note', note: detail.adminNote!),
        ],
      ],
    );
  }
}

Future<bool> _confirmApprove(BuildContext context) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (context) => AppDialogShell(
      title: const Text('Approve supplier verification?'),
      content: const Text(
        'This will mark the organization as verified and notify the supplier owner.',
      ),
      footer: AppDialogFooter.decision(
        secondaryAction: TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Cancel'),
        ),
        primaryAction: FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          style: AppStatusButtonStyle.filled(context, AppStatusTone.success),
          child: const Text('Approve'),
        ),
      ),
    ),
  );

  return result ?? false;
}

Future<String?> _promptAdminNote(
  BuildContext context, {
  required String title,
  required bool required,
  required AppStatusTone tone,
}) {
  return showDialog<String?>(
    context: context,
    builder: (dialogContext) =>
        _AdminNoteDialog(title: title, required: required, tone: tone),
  );
}

class _AdminNoteDialog extends StatefulWidget {
  const _AdminNoteDialog({
    required this.title,
    required this.required,
    required this.tone,
  });

  final String title;
  final bool required;
  final AppStatusTone tone;

  @override
  State<_AdminNoteDialog> createState() => _AdminNoteDialogState();
}

class _AdminNoteDialogState extends State<_AdminNoteDialog> {
  final _controller = TextEditingController();
  String? _errorText;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final value = _controller.text.trim();
    if (widget.required && value.length < 3) {
      setState(() {
        _errorText = 'Reason must be at least 3 characters.';
      });
      return;
    }

    Navigator.of(context).pop(value.isEmpty ? null : value);
  }

  @override
  Widget build(BuildContext context) {
    return AppDialogShell(
      title: Text(widget.title),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _controller,
            maxLines: 4,
            autofocus: true,
            decoration: InputDecoration(
              labelText: widget.required
                  ? 'Reason (required)'
                  : 'Note (optional)',
              border: const OutlineInputBorder(),
              errorText: _errorText,
            ),
            onChanged: (_) {
              if (_errorText != null) {
                setState(() => _errorText = null);
              }
            },
          ),
        ],
      ),
      footer: AppDialogFooter.form(
        primaryAction: FilledButton(
          onPressed: _submit,
          style: AppStatusButtonStyle.filled(context, widget.tone),
          child: const Text('Confirm'),
        ),
      ),
    );
  }
}

String _formatSupplierType(String value) {
  return switch (value.toUpperCase()) {
    'WORKSHOP' => 'Workshop',
    'FACTORY' => 'Factory',
    'EDUCATIONAL_INSTITUTION' => 'Educational institution',
    _ => value,
  };
}

String _formatStatusLabel(String value) {
  return switch (value.toUpperCase()) {
    'APPROVED' => 'Approved',
    'REJECTED' => 'Rejected',
    'CHANGES_REQUESTED' => 'Changes requested',
    'PENDING' => 'Pending',
    _ => value,
  };
}

String _locationLabel(String? city, String? area, [String? addressLine]) {
  final parts = <String>[
    if (city != null && city.isNotEmpty) city,
    if (area != null && area.isNotEmpty) area,
    if (addressLine != null && addressLine.isNotEmpty) addressLine,
  ];
  return parts.isEmpty ? '—' : parts.join(', ');
}

class _VerificationDocumentCard extends StatefulWidget {
  const _VerificationDocumentCard({
    required this.documentUrl,
    this.documentName,
  });

  final String documentUrl;
  final String? documentName;

  @override
  State<_VerificationDocumentCard> createState() =>
      _VerificationDocumentCardState();
}

class _VerificationDocumentCardState extends State<_VerificationDocumentCard> {
  bool _imagePreviewFailed = false;

  bool get _isImage {
    final lower = widget.documentUrl.toLowerCase();
    return lower.endsWith('.png') ||
        lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg');
  }

  bool get _isPdf => widget.documentUrl.toLowerCase().endsWith('.pdf');

  String get _resolvedUrl => ApiConfig.resolveMediaUrl(widget.documentUrl);

  bool get _canTryImagePreview {
    if (!_isImage || _imagePreviewFailed) {
      return false;
    }

    final uri = Uri.tryParse(_resolvedUrl);
    if (uri == null || !uri.hasScheme || !uri.hasAuthority) {
      return false;
    }

    return uri.path.contains('/uploads/supplier-verification/');
  }

  String get _displayName {
    if (widget.documentName != null && widget.documentName!.trim().isNotEmpty) {
      return widget.documentName!.trim();
    }
    return widget.documentUrl.split('/').last;
  }

  String get _typeLabel {
    if (_isPdf) {
      return 'PDF document';
    }
    if (_isImage) {
      return 'Image document';
    }
    return 'Document file';
  }

  IconData get _typeIcon {
    if (_isPdf) {
      return Icons.picture_as_pdf_outlined;
    }
    if (_isImage) {
      return Icons.image_outlined;
    }
    return Icons.insert_drive_file_outlined;
  }

  void _openDocument() {
    ApiConfig.openExternalDocument(widget.documentUrl);
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return _VerificationSectionCard(
      title: 'Verification document',
      icon: Icons.file_present_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_canTryImagePreview)
            ClipRRect(
              borderRadius: AppRadius.mdAll,
              child: Image.network(
                _resolvedUrl,
                height: 140,
                width: double.infinity,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) {
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (mounted && !_imagePreviewFailed) {
                      setState(() => _imagePreviewFailed = true);
                    }
                  });
                  return _DocumentTypePreview(
                    icon: _typeIcon,
                    label: _typeLabel,
                  );
                },
              ),
            )
          else
            _DocumentTypePreview(icon: _typeIcon, label: _typeLabel),
          const SizedBox(height: AppSpacing.sm),
          Text(
            _displayName,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: colors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              OutlinedButton.icon(
                onPressed: _openDocument,
                icon: Icon(
                  _isPdf ? Icons.open_in_new : Icons.open_in_full_outlined,
                ),
                label: Text(_isPdf ? 'Open PDF' : 'Open full image'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DocumentTypePreview extends StatelessWidget {
  const _DocumentTypePreview({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Container(
      height: 120,
      width: double.infinity,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: colors.surfaceMuted,
        borderRadius: AppRadius.mdAll,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 40, color: colors.primary),
          const SizedBox(height: AppSpacing.sm),
          Text(
            label,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: colors.textSecondary),
          ),
        ],
      ),
    );
  }
}
