import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/landing_public_providers.dart';
import 'landing_stat_format.dart';

enum LandingStatKind {
  availableMaterials,
  publishedProjects,
  reusedMaterials,
}

class LandingLiveCount extends ConsumerWidget {
  const LandingLiveCount({super.key, required this.kind, this.style});

  final LandingStatKind kind;
  final TextStyle? style;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncContent = ref.watch(landingPublicContentProvider);
    final stats = asyncContent.asData?.value.stats;
    final value = switch (kind) {
      LandingStatKind.availableMaterials => stats?.availableMaterialsCount,
      LandingStatKind.publishedProjects => stats?.publishedProjectsCount,
      LandingStatKind.reusedMaterials => stats?.reusedMaterialsCount,
    };

    return Text(
      formatLandingCount(
        asyncContent.hasError || asyncContent.isLoading ? null : value,
      ),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: style,
    );
  }
}
