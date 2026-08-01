import 'dart:math';

String createMaterialViewOperationKey(
  String materialId, {
  Random? random,
  DateTime? now,
}) {
  // Keep each bound well below the JavaScript bitwise limit. Using `1 << 32`
  // evaluates to zero on Flutter web, and even a literal 2^32 boundary is easy
  // to regress back into the same platform-specific failure.
  final generator = random ?? Random.secure();
  final randomValue = [
    generator.nextInt(0x10000),
    generator.nextInt(0x10000),
  ].map((value) => value.toRadixString(16).padLeft(4, '0')).join();
  final timestamp = (now ?? DateTime.now()).microsecondsSinceEpoch;
  return 'material-view-$materialId-$timestamp-$randomValue';
}
