import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/widgets/app_mobile_bottom_nav_bar.dart';
import '../../../../app/widgets/entry_nav_bar.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/app_back_action.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../application/learner_home_provider.dart';
import '../../domain/learner_home_models.dart';
import '../learner_home_localization.dart';
import '../widgets/empty_activity_card.dart';
import '../widgets/home_continue_project_card.dart';
import '../widgets/home_material_recommendation_grid.dart';
import '../widgets/home_section_header.dart';
import '../widgets/learning_spotlight_section.dart';

class LearnerHomeRecommendationsPage extends ConsumerStatefulWidget {
  const LearnerHomeRecommendationsPage({super.key, required this.sectionKey});

  final LearnerHomeSectionKey sectionKey;

  @override
  ConsumerState<LearnerHomeRecommendationsPage> createState() =>
      _LearnerHomeRecommendationsPageState();
}

class _LearnerHomeRecommendationsPageState
    extends ConsumerState<LearnerHomeRecommendationsPage> {
  static const _pageSizeOptions = [10, 20, 30, 40, 50];

  int _pageSize = 20;
  int _offset = 0;
  bool _loading = true;
  bool _loadingMore = false;
  Object? _error;
  LearnerHomeSectionDetails? _section;
  final List<LearnerHomeItem> _items = [];

  @override
  void initState() {
    super.initState();
    _loadSection(reset: true);
  }

  Future<void> _loadSection({required bool reset}) async {
    if (reset) {
      setState(() {
        _loading = true;
        _error = null;
        _offset = 0;
        _items.clear();
      });
    } else {
      setState(() => _loadingMore = true);
    }

    try {
      final section = await ref
          .read(learnerHomeApiProvider)
          .fetchSectionDetails(
            widget.sectionKey,
            limit: _pageSize,
            offset: reset ? 0 : _offset,
          );

      if (!mounted) {
        return;
      }

      setState(() {
        _section = section;
        if (reset) {
          _items
            ..clear()
            ..addAll(section.items);
        } else {
          _items.addAll(section.items);
        }
        _offset = section.nextOffset ?? _items.length;
        _loading = false;
        _loadingMore = false;
        _error = null;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = error;
        _loading = false;
        _loadingMore = false;
      });
    }
  }

  Future<void> _changePageSize(int pageSize) async {
    if (pageSize == _pageSize) {
      return;
    }

    setState(() => _pageSize = pageSize);
    await _loadSection(reset: true);
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Scaffold(
      backgroundColor: palette.pageBackground,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(
                AppSpacing.md,
                AppSpacing.sm,
                AppSpacing.md,
                0,
              ),
              child: Align(
                alignment: AlignmentDirectional.centerStart,
                child: const AppBackAction(fallbackLocation: '/home'),
              ),
            ),
            const EntryNavBar(
              showSignIn: false,
              showCreateAccount: false,
              homeRoute: '/home',
            ),
            Expanded(child: _buildBody(context)),
          ],
        ),
      ),
    );
  }

  bool get _supportsPageSize =>
      widget.sectionKey == LearnerHomeSectionKey.suggestedMaterials;

  Widget _buildBody(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: appMobileAwareScrollPadding(context),
          child: EmptyActivityCard(
            icon: Icons.cloud_off_outlined,
            title: context.l10n.recommendationsLoadError,
            description: context.l10n.recommendationsLoadErrorSubtitle,
            actionLabel: context.l10n.retry,
            onAction: () => _loadSection(reset: true),
          ),
        ),
      );
    }

    final section = _section;
    if (section == null) {
      return const SizedBox.shrink();
    }

    final localizedCopy = learnerHomeSectionCopy(section.key, context.l10n);
    final displaySection = LearnerHomeSectionDetails(
      key: section.key,
      title: localizedCopy.title,
      subtitle: localizedCopy.subtitle,
      emptyState: localizedCopy.empty,
      items: _items,
      nextOffset: section.nextOffset,
      hasMore: section.hasMore,
    );

    return SingleChildScrollView(
      padding: appMobileAwareScrollPadding(context),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1280),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              HomeSectionHeader(
                title: displaySection.title,
                subtitle: displaySection.subtitle.isNotEmpty
                    ? displaySection.subtitle
                    : displaySection.emptyState,
                compactInlineAction: _supportsPageSize,
                action: _supportsPageSize
                    ? _RecommendationsCountControl(
                        pageSize: _pageSize,
                        options: _pageSizeOptions,
                        onChanged: _changePageSize,
                      )
                    : null,
              ),
              const SizedBox(height: AppSpacing.lg),
              _SectionItemsView(section: displaySection),
              if (displaySection.hasMore) ...[
                const SizedBox(height: AppSpacing.lg),
                Center(
                  child: _loadingMore
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : OutlinedButton(
                          onPressed: () => _loadSection(reset: false),
                          style: AppStatusButtonStyle.outlined(
                            context,
                            AppStatusTone.neutral,
                          ),
                          child: Text(context.l10n.loadMore),
                        ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _RecommendationsCountControl extends StatelessWidget {
  const _RecommendationsCountControl({
    required this.pageSize,
    required this.options,
    required this.onChanged,
  });

  final int pageSize;
  final List<int> options;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: palette.panelSurface,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            context.l10n.showUpTo,
            style: AppTextStyles.label(context).copyWith(
              color: palette.textSecondary,
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          DropdownButtonHideUnderline(
            child: DropdownButton<int>(
              value: pageSize,
              isDense: true,
              borderRadius: AppRadius.mdAll,
              style: AppTextStyles.label(context).copyWith(
                color: palette.textPrimary,
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
              ),
              dropdownColor: palette.cardSurface,
              items: options
                  .map(
                    (value) => DropdownMenuItem<int>(
                      value: value,
                      child: Text('$value'),
                    ),
                  )
                  .toList(growable: false),
              onChanged: (value) {
                if (value != null) {
                  onChanged(value);
                }
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionItemsView extends StatelessWidget {
  const _SectionItemsView({required this.section});

  final LearnerHomeSectionDetails section;

  @override
  Widget build(BuildContext context) {
    if (section.items.isEmpty) {
      return EmptyActivityCard(
        icon: _emptyIcon(section.key),
        title: section.title,
        description: section.emptyState,
        actionLabel: context.l10n.backToHome,
        onAction: () => context.go('/home'),
      );
    }

    return switch (section.key) {
      LearnerHomeSectionKey.suggestedMaterials ||
      LearnerHomeSectionKey.materialsForSavedProjects ||
      LearnerHomeSectionKey.freeMaterialsNearYou =>
        HomeMaterialRecommendationGrid(items: _materialItems(section.items)),
      LearnerHomeSectionKey.suggestedProjects ||
      LearnerHomeSectionKey.savedProjects ||
      LearnerHomeSectionKey.popularProjects => _ProjectRecommendationsList(
        items: _projectItems(section.items),
      ),
      LearnerHomeSectionKey.continueProjects => _ContinueProjectsList(
        items: _continueItems(section.items),
      ),
    };
  }

  List<LearnerHomeMaterialRecommendation> _materialItems(
    List<LearnerHomeItem> items,
  ) {
    return items.whereType<LearnerHomeMaterialRecommendation>().toList(
      growable: false,
    );
  }

  List<LearnerHomeProjectRecommendation> _projectItems(
    List<LearnerHomeItem> items,
  ) {
    return items.whereType<LearnerHomeProjectRecommendation>().toList(
      growable: false,
    );
  }

  List<LearnerHomeContinueProjectRecommendation> _continueItems(
    List<LearnerHomeItem> items,
  ) {
    return items.whereType<LearnerHomeContinueProjectRecommendation>().toList(
      growable: false,
    );
  }

  IconData _emptyIcon(LearnerHomeSectionKey key) {
    return switch (key) {
      LearnerHomeSectionKey.suggestedMaterials ||
      LearnerHomeSectionKey.materialsForSavedProjects ||
      LearnerHomeSectionKey.freeMaterialsNearYou => Icons.inventory_2_outlined,
      LearnerHomeSectionKey.continueProjects => Icons.build_outlined,
      _ => Icons.school_outlined,
    };
  }
}

class _ProjectRecommendationsList extends StatelessWidget {
  const _ProjectRecommendationsList({required this.items});

  final List<LearnerHomeProjectRecommendation> items;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = constraints.maxWidth >= 760;
        final columns = wide ? 2 : 1;
        final itemWidth = columns == 2
            ? (constraints.maxWidth - AppSpacing.md) / 2
            : constraints.maxWidth;

        return Wrap(
          spacing: AppSpacing.md,
          runSpacing: AppSpacing.md,
          children: items.map((item) {
            return SizedBox(
              width: itemWidth,
              child: HomeLearningProjectCard(
                project: item.project,
                reason: localizedLearnerHomeReason(item, context.l10n),
              ),
            );
          }).toList(),
        );
      },
    );
  }
}

class _ContinueProjectsList extends StatelessWidget {
  const _ContinueProjectsList({required this.items});

  final List<LearnerHomeContinueProjectRecommendation> items;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (final item in items) ...[
          HomeContinueProjectCard(item: item),
          if (item != items.last) const SizedBox(height: AppSpacing.sm),
        ],
      ],
    );
  }
}
