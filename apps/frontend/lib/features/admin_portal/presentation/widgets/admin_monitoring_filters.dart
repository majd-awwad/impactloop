import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../shared/widgets/app_dialog_detail.dart';
import '../l10n/admin_l10n.dart';
import '../theme/admin_decoration_set.dart';
import 'admin_kpi_card.dart' show AdminTypography;
import 'admin_monitoring_utils.dart';

class AdminStatusBadge extends StatelessWidget {
  const AdminStatusBadge({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final label = humanizeEnum(status);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: palette.primaryTeal.withValues(
          alpha: palette.isDark ? 0.18 : 0.1,
        ),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: palette.cardBorder),
      ),
      child: Text(
        label,
        style: AdminTypography.kpiHelper(
          palette,
        ).copyWith(fontWeight: FontWeight.w700, fontSize: 11),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }
}

class AdminDetailSection extends StatelessWidget {
  const AdminDetailSection({
    super.key,
    required this.title,
    required this.children,
  });

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: AppSpacing.md),
    child: AppDialogSection(
      title: title,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: children,
      ),
    ),
  );
}

class AdminDetailRow extends StatelessWidget {
  const AdminDetailRow({
    super.key,
    required this.label,
    required this.value,
    this.muted = false,
  });

  final String label;
  final String value;
  final bool muted;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
    child: AppDialogInfoRow(label: label, value: value, muted: muted),
  );
}

class AdminCompactFilterDropdown extends StatelessWidget {
  const AdminCompactFilterDropdown({
    super.key,
    required this.label,
    required this.value,
    required this.entries,
    required this.onSelected,
    this.enabled = true,
    this.width = 180,
  });

  final String label;
  final String value;
  final List<DropdownMenuEntry<String>> entries;
  final ValueChanged<String> onSelected;
  final bool enabled;
  final double width;

  @override
  Widget build(BuildContext context) {
    if (entries.isEmpty) {
      return SizedBox(
        width: width,
        child: InputDecorator(
          decoration: InputDecoration(
            labelText: label,
            border: const OutlineInputBorder(),
            isDense: true,
          ),
          child: Text(
            'No options',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ),
      );
    }

    final safeValue = entries.any((entry) => entry.value == value)
        ? value
        : entries.first.value;

    return SizedBox(
      width: width,
      child: DropdownMenu<String>(
        key: ValueKey('$label-$safeValue'),
        enabled: enabled,
        label: Text(label),
        initialSelection: safeValue,
        width: width,
        menuHeight: 280,
        dropdownMenuEntries: entries,
        inputDecorationTheme: const InputDecorationTheme(
          isDense: true,
          border: OutlineInputBorder(),
        ),
        onSelected: (selected) {
          if (selected != null) onSelected(selected);
        },
      ),
    );
  }
}

class AdminCompactDateField extends StatelessWidget {
  const AdminCompactDateField({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
    this.width,
  });

  final String label;
  final String? value;
  final ValueChanged<String?> onChanged;
  final double? width;

  @override
  Widget build(BuildContext context) {
    final display = value == null || value!.isEmpty
        ? 'Select date'
        : DateFormat.yMMMd().format(DateTime.parse(value!));

    final field = InkWell(
      onTap: () async {
        final initial = value != null && value!.isNotEmpty
            ? DateTime.tryParse(value!)
            : null;
        final picked = await showDatePicker(
          context: context,
          initialDate: initial ?? DateTime.now(),
          firstDate: DateTime(2020),
          lastDate: DateTime.now().add(const Duration(days: 1)),
        );
        if (picked != null) onChanged(formatIsoDate(picked));
      },
      borderRadius: BorderRadius.circular(4),
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
          isDense: true,
          suffixIcon: value != null && value!.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear, size: 18),
                  onPressed: () => onChanged(null),
                  tooltip: 'Clear',
                )
              : const Icon(Icons.calendar_today_outlined, size: 18),
        ),
        child: Text(
          display,
          style: Theme.of(context).textTheme.bodySmall,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
    );

    if (width == null) return field;
    return SizedBox(width: width, child: field);
  }
}

class AdminMonitoringErrorPanel extends StatelessWidget {
  const AdminMonitoringErrorPanel({
    super.key,
    required this.title,
    required this.message,
    required this.onRetry,
  });

  final String title;
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: palette.cardBackground,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: palette.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AdminTypography.sectionTitle(palette)),
          const SizedBox(height: 8),
          Text(message, style: AdminTypography.pageSubtitle(palette)),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: onRetry,
            child: Text(AdminL10n.of(context).retry),
          ),
        ],
      ),
    );
  }
}
