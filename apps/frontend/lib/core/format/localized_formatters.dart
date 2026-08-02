import 'package:intl/intl.dart';
import 'package:intl/date_symbol_data_local.dart';

import '../../l10n/app_localizations.dart';

class LocalizedFormatters {
  const LocalizedFormatters(this.l10n);

  final AppLocalizations l10n;

  String get localeName => l10n.localeName;

  String number(num value, {int? decimalDigits}) {
    final formatter = NumberFormat.decimalPatternDigits(
      locale: localeName,
      decimalDigits: decimalDigits,
    );
    return westernDigits(formatter.format(value));
  }

  String nis(num value, {int decimalDigits = 0}) =>
      l10n.currencyNis(number(value, decimalDigits: decimalDigits));

  String distanceKilometers(num value, {int decimalDigits = 1}) =>
      l10n.distanceKilometers(number(value, decimalDigits: decimalDigits));

  String quantity(num value, String unit, {int decimalDigits = 0}) =>
      l10n.quantityWithUnit(number(value, decimalDigits: decimalDigits), unit);

  String date(DateTime value) {
    _ensureDateLocaleData();
    return westernDigits(DateFormat.yMMMd(localeName).format(value.toLocal()));
  }

  String dateTime(DateTime value) {
    _ensureDateLocaleData();
    return westernDigits(
      DateFormat.yMMMd(localeName).add_jm().format(value.toLocal()),
    );
  }

  String time(DateTime value) {
    _ensureDateLocaleData();
    return westernDigits(DateFormat.jm(localeName).format(value.toLocal()));
  }

  String dateTimeRange(DateTime start, DateTime end) {
    final localStart = start.toLocal();
    final localEnd = end.toLocal();
    final sameDay =
        localStart.year == localEnd.year &&
        localStart.month == localEnd.month &&
        localStart.day == localEnd.day;

    if (sameDay) {
      return '${date(localStart)}، ${time(localStart)} – ${time(localEnd)}';
    }
    return '${dateTime(localStart)} – ${dateTime(localEnd)}';
  }

  String relativeTime(DateTime value, {DateTime? now}) {
    final difference = (now ?? DateTime.now()).difference(value.toLocal());
    if (difference.inMinutes < 1) return l10n.justNow;
    if (difference.inHours < 1) return l10n.minutesAgo(difference.inMinutes);
    if (difference.inDays < 1) return l10n.hoursAgo(difference.inHours);
    if (difference.inDays < 7) return l10n.daysAgo(difference.inDays);
    return date(value);
  }
}

bool _dateLocaleDataInitialized = false;

void _ensureDateLocaleData() {
  if (_dateLocaleDataInitialized) return;
  initializeDateFormatting();
  _dateLocaleDataInitialized = true;
}

String westernDigits(String value) {
  const easternArabic = '٠١٢٣٤٥٦٧٨٩';
  const easternPersian = '۰۱۲۳۴۵۶۷۸۹';
  var result = value;
  for (var index = 0; index < 10; index++) {
    result = result
        .replaceAll(easternArabic[index], '$index')
        .replaceAll(easternPersian[index], '$index');
  }
  return result;
}
