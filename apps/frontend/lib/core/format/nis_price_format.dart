/// Formats NIS amounts consistently: 10, 6.5, 11.05 (no trailing zeros).
String formatNisAmount(double value) {
  final rounded = (value * 100).roundToDouble() / 100;
  if ((rounded - rounded.roundToDouble()).abs() < 1e-9) {
    return rounded.round().toString();
  }

  return rounded.toStringAsFixed(2);
}
