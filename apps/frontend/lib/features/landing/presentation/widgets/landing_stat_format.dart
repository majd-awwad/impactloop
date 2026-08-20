String formatLandingCount(int? value) {
  if (value == null) {
    return '—';
  }

  if (value < 1000) {
    return '$value';
  }

  if (value < 1000000) {
    final tenths = (value / 100).round() / 10;
    if (tenths % 1 == 0) {
      return '${tenths.toInt()}k';
    }
    return '${tenths}k';
  }

  final millions = (value / 100000).round() / 10;
  if (millions % 1 == 0) {
    return '${millions.toInt()}m';
  }
  return '${millions}m';
}
