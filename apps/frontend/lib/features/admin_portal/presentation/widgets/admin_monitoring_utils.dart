import 'package:intl/intl.dart';

const kTimeRangeAll = 'ALL';
const kTimeRangeToday = 'TODAY';
const kTimeRangeLast7 = 'LAST_7';
const kTimeRangeLast30 = 'LAST_30';
const kTimeRangeCustom = 'CUSTOM';

class ResolvedDateRange {
  const ResolvedDateRange({this.dateFrom, this.dateTo, this.error});

  final String? dateFrom;
  final String? dateTo;
  final String? error;
}

String formatIsoDate(DateTime date) {
  final month = date.month.toString().padLeft(2, '0');
  final day = date.day.toString().padLeft(2, '0');
  return '${date.year}-$month-$day';
}

ResolvedDateRange resolveDateRange({
  required String timeRange,
  String? customDateFrom,
  String? customDateTo,
}) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);

  switch (timeRange) {
    case kTimeRangeToday:
      final iso = formatIsoDate(today);
      return ResolvedDateRange(dateFrom: iso, dateTo: iso);
    case kTimeRangeLast7:
      return ResolvedDateRange(
        dateFrom: formatIsoDate(today.subtract(const Duration(days: 6))),
        dateTo: formatIsoDate(today),
      );
    case kTimeRangeLast30:
      return ResolvedDateRange(
        dateFrom: formatIsoDate(today.subtract(const Duration(days: 29))),
        dateTo: formatIsoDate(today),
      );
    case kTimeRangeCustom:
      final from = customDateFrom?.trim();
      final to = customDateTo?.trim();
      if (from == null || from.isEmpty || to == null || to.isEmpty) {
        return const ResolvedDateRange(
          error: 'Select both From and To dates.',
        );
      }
      if (from.compareTo(to) > 0) {
        return const ResolvedDateRange(
          error: 'From date must be on or before To date.',
        );
      }
      return ResolvedDateRange(dateFrom: from, dateTo: to);
    case kTimeRangeAll:
    default:
      return const ResolvedDateRange();
  }
}

String? formatAdminDateTime(String? raw) {
  if (raw == null || raw.isEmpty) return null;
  final parsed = DateTime.tryParse(raw);
  if (parsed == null) return raw;
  return DateFormat.yMMMd().add_jm().format(parsed.toLocal());
}

String humanizeEnum(String value) =>
    value.replaceAll('_', ' ').toLowerCase();

String displayPersonLabel(String name, String email) {
  final trimmedName = name.trim();
  if (trimmedName.isNotEmpty) return trimmedName;
  final trimmedEmail = email.trim();
  if (trimmedEmail.isNotEmpty) return trimmedEmail;
  return 'Unknown';
}

String? safeDropdownValue(String selected, Iterable<String> allowed) {
  if (selected == 'ALL') return 'ALL';
  return allowed.contains(selected) ? selected : 'ALL';
}
