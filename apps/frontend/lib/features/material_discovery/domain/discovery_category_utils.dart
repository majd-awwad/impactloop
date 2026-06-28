import '../../materials/data/models/category.dart';

final _internalCategoryPattern = RegExp(
  r'\[|\]|test-admin|admin-approvals|\btest\b|\badmin\b|\bapprovals\b',
  caseSensitive: false,
);

bool isPublicDiscoveryCategoryName(String name) {
  final normalized = name.trim();
  if (normalized.isEmpty) {
    return false;
  }

  return !_internalCategoryPattern.hasMatch(normalized);
}

String normalizeDiscoveryCategoryLabel(String name) =>
    name.trim().toLowerCase().replaceAll(RegExp(r'\s+'), ' ');

List<MaterialCategory> filterPublicDiscoveryCategories(
  List<MaterialCategory> categories,
) {
  final seen = <String>{};
  final filtered = <MaterialCategory>[];

  for (final category in categories) {
    if (!isPublicDiscoveryCategoryName(category.nameEn)) {
      continue;
    }

    final key = normalizeDiscoveryCategoryLabel(category.nameEn);
    if (seen.contains(key)) {
      continue;
    }

    seen.add(key);
    filtered.add(category);
  }

  return filtered;
}

const discoveryVisibleCategoryCount = 8;
