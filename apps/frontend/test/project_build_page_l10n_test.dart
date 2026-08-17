import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/learning_hub/presentation/l10n/project_build_page_l10n.dart';

void main() {
  group('PREPARE Arabic count helpers', () {
    test('materials remaining uses Arabic plural forms', () {
      expect(
        ProjectBuildPageL10n.materialsRemainingToStart(0).ar,
        'لا توجد مواد تحتاج إكمال',
      );
      expect(
        ProjectBuildPageL10n.materialsRemainingToStart(1).ar,
        'مادة واحدة تحتاج إكمال',
      );
      expect(
        ProjectBuildPageL10n.materialsRemainingToStart(2).ar,
        'مادتان تحتاجان إكمال',
      );
      expect(
        ProjectBuildPageL10n.materialsRemainingToStart(3).ar,
        '3 مواد تحتاج إكمال',
      );
      expect(
        ProjectBuildPageL10n.materialsRemainingToStart(10).ar,
        '10 مواد تحتاج إكمال',
      );
      expect(
        ProjectBuildPageL10n.materialsRemainingToStart(11).ar,
        '11 مادة تحتاج إكمال',
      );
      expect(
        ProjectBuildPageL10n.materialsRemainingToStart(12).ar,
        '12 مادة تحتاج إكمال',
      );
      expect(
        ProjectBuildPageL10n.materialsRemainingToStart(13).ar,
        '13 مادة تحتاج إكمال',
      );
    });

    test('show-more materials uses Arabic plural forms', () {
      expect(ProjectBuildPageL10n.showMoreMaterials(0).ar, 'عرض المواد الأخرى');
      expect(ProjectBuildPageL10n.showMoreMaterials(1).ar, 'عرض مادة أخرى');
      expect(ProjectBuildPageL10n.showMoreMaterials(2).ar, 'عرض مادتين أخريين');
      expect(ProjectBuildPageL10n.showMoreMaterials(3).ar, 'عرض 3 مواد أخرى');
      expect(ProjectBuildPageL10n.showMoreMaterials(10).ar, 'عرض 10 مواد أخرى');
      expect(ProjectBuildPageL10n.showMoreMaterials(11).ar, 'عرض 11 مادة أخرى');
      expect(ProjectBuildPageL10n.showMoreMaterials(12).ar, 'عرض 12 مادة أخرى');
      expect(ProjectBuildPageL10n.showMoreMaterials(13).ar, 'عرض 13 مادة أخرى');
    });

    test('ready group heading stays a single countable label', () {
      for (final count in [0, 1, 2, 3, 10, 11, 12, 13]) {
        expect(ProjectBuildPageL10n.readyGroup(count).ar, 'جاهزة · $count');
      }
    });

    test('mix summary keeps the three counts readable', () {
      expect(
        ProjectBuildPageL10n.prepareMixSummary(
          needsChoice: 3,
          inProgress: 2,
          ready: 1,
        ).ar,
        '3 تحتاج اختيار · 2 قيد التجهيز · 1 جاهزة',
      );
    });
  });
}
