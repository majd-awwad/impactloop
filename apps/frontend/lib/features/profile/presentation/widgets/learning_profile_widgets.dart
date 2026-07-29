import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../shared/widgets/app_empty_state_card.dart';
import '../../../../shared/widgets/app_section_card.dart';
import '../../../auth/data/models/user.dart';
import '../l10n/learner_profile_l10n.dart';
import 'profile_visual_components.dart';

class LearningProfileViewData {
  const LearningProfileViewData({
    required this.learnerType,
    required this.skillLevel,
    required this.interests,
    required this.bio,
  });

  final String? learnerType;
  final String? skillLevel;
  final List<String> interests;
  final String? bio;

  factory LearningProfileViewData.fromProfile(LearnerProfile profile) {
    final interests = <String>[];
    final seen = <String>{};

    for (final value in profile.interests) {
      final trimmed = value.trim();
      if (trimmed.isEmpty || !seen.add(trimmed.toLowerCase())) {
        continue;
      }
      interests.add(trimmed);
    }

    return LearningProfileViewData(
      learnerType: _nonEmpty(profile.learnerType),
      skillLevel: _nonEmpty(profile.skillLevel),
      interests: List.unmodifiable(interests),
      bio: _nonEmpty(profile.bio),
    );
  }

  static String? _nonEmpty(String? value) {
    final trimmed = value?.trim() ?? '';
    return trimmed.isEmpty ? null : trimmed;
  }
}

class LearningProfileContent extends StatelessWidget {
  const LearningProfileContent({super.key, required this.profile});

  final LearnerProfile? profile;

  @override
  Widget build(BuildContext context) {
    final l10n = LearnerProfileL10n.of(context);
    if (profile == null) {
      return AppEmptyStateCard(
        icon: Icons.school_outlined,
        title: l10n.noLearningProfileTitle,
        subtitle: l10n.noLearningProfileBody,
        compact: true,
      );
    }

    final data = LearningProfileViewData.fromProfile(profile!);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LearningProfileSummaryCard(data: data),
        const SizedBox(height: AppSpacing.md),
        LearningProfileDetailsSurface(data: data),
      ],
    );
  }
}

class LearningProfileSummaryCard extends StatelessWidget {
  const LearningProfileSummaryCard({super.key, required this.data});

  final LearningProfileViewData data;

  @override
  Widget build(BuildContext context) {
    final l10n = LearnerProfileL10n.of(context);
    final scale = MediaQuery.textScalerOf(context).scale(1);

    return AppSectionCard(
      emphasized: true,
      borderRadius: AppRadius.xlAll,
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ProfileSurfaceHeader(
            icon: Icons.school_outlined,
            title: l10n.learningSummaryTitle,
            subtitle: l10n.learningProfileIntro,
          ),
          const SizedBox(height: AppSpacing.md),
          LayoutBuilder(
            builder: (context, constraints) {
              final tiles = [
                LearningProfileSummaryTile(
                  icon: Icons.person_outline_rounded,
                  label: l10n.learnerType,
                  value: data.learnerType == null
                      ? l10n.notAdded
                      : l10n.learnerTypeLabel(data.learnerType!),
                  isMissing: data.learnerType == null,
                ),
                LearningProfileSummaryTile(
                  icon: Icons.signal_cellular_alt_rounded,
                  label: l10n.skillLevel,
                  value: data.skillLevel == null
                      ? l10n.notAdded
                      : l10n.skillLevelLabel(data.skillLevel!),
                  isMissing: data.skillLevel == null,
                ),
              ];
              if (constraints.maxWidth >= 360 && scale <= 1.3) {
                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: tiles.first),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(child: tiles.last),
                  ],
                );
              }
              return Column(
                children: [
                  tiles.first,
                  const SizedBox(height: AppSpacing.sm),
                  tiles.last,
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class LearningProfileSummaryTile extends StatelessWidget {
  const LearningProfileSummaryTile({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    required this.isMissing,
  });

  final IconData icon;
  final String label;
  final String value;
  final bool isMissing;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Semantics(
      label: '$label: $value',
      child: ExcludeSemantics(
        child: Container(
          width: double.infinity,
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: colors.surfaceMuted,
            borderRadius: AppRadius.mdAll,
            border: Border.all(color: colors.borderSubtle),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                isMissing ? Icons.add_circle_outline_rounded : icon,
                color: isMissing ? colors.textMuted : colors.primary,
                size: 20,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: AppTextStyles.label(context).copyWith(
                        color: colors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      value,
                      style: AppTextStyles.label(context).copyWith(
                        color: isMissing
                            ? colors.textSecondary
                            : colors.textPrimary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class LearningProfileDetailsSurface extends StatefulWidget {
  const LearningProfileDetailsSurface({super.key, required this.data});

  final LearningProfileViewData data;

  @override
  State<LearningProfileDetailsSurface> createState() =>
      _LearningProfileDetailsSurfaceState();
}

class _LearningProfileDetailsSurfaceState
    extends State<LearningProfileDetailsSurface> {
  static const _collapsedInterestCount = 8;
  static const _collapsedBioLines = 4;
  bool _interestsExpanded = false;
  bool _bioExpanded = false;

  @override
  Widget build(BuildContext context) {
    final l10n = LearnerProfileL10n.of(context);
    final interests = widget.data.interests;
    final visibleInterests = _interestsExpanded
        ? interests
        : interests.take(_collapsedInterestCount).toList(growable: false);
    final remaining = interests.length - visibleInterests.length;

    return AppSectionCard(
      showShadow: false,
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ProfileSurfaceHeader(
            icon: Icons.interests_outlined,
            title: l10n.interests,
          ),
          const SizedBox(height: AppSpacing.md),
          if (interests.isEmpty)
            _EmptyLearningValue(
              icon: Icons.interests_outlined,
              label: l10n.noInterestsAdded,
            )
          else
            LayoutBuilder(
              builder: (context, constraints) {
                return Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: [
                    for (final interest in visibleInterests)
                      ProfileInterestChip(
                        label: l10n.interestLabel(interest),
                        maxWidth: constraints.maxWidth,
                      ),
                  ],
                );
              },
            ),
          if (remaining > 0 || _interestsExpanded) ...[
            const SizedBox(height: AppSpacing.sm),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: Semantics(
                button: true,
                expanded: _interestsExpanded,
                child: TextButton.icon(
                  onPressed: () => setState(
                    () => _interestsExpanded = !_interestsExpanded,
                  ),
                  icon: Icon(
                    _interestsExpanded
                        ? Icons.expand_less_rounded
                        : Icons.expand_more_rounded,
                  ),
                  label: Text(
                    _interestsExpanded
                        ? l10n.showFewerInterests
                        : l10n.showMoreInterests(remaining),
                  ),
                ),
              ),
            ),
          ],
          const Padding(
            padding: EdgeInsetsDirectional.symmetric(vertical: AppSpacing.md),
            child: Divider(height: 1),
          ),
          ProfileSurfaceHeader(icon: Icons.notes_rounded, title: l10n.about),
          const SizedBox(height: AppSpacing.md),
          _buildBio(context),
        ],
      ),
    );
  }

  Widget _buildBio(BuildContext context) {
    final l10n = LearnerProfileL10n.of(context);
    final colors = AppThemeColors.of(context);
    final bio = widget.data.bio;
    if (bio == null) {
      return _EmptyLearningValue(
        icon: Icons.notes_rounded,
        label: l10n.optionalNotAdded,
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final style = AppTextStyles.body(
          context,
        ).copyWith(color: colors.textSecondary, height: 1.55);
        final painter = TextPainter(
          text: TextSpan(text: bio, style: style),
          maxLines: _collapsedBioLines,
          textDirection: Directionality.of(context),
          textScaler: MediaQuery.textScalerOf(context),
        )..layout(maxWidth: constraints.maxWidth);
        final overflows = painter.didExceedMaxLines;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              bio,
              maxLines: _bioExpanded ? null : _collapsedBioLines,
              overflow: _bioExpanded
                  ? TextOverflow.visible
                  : TextOverflow.ellipsis,
              style: style,
            ),
            if (overflows || _bioExpanded) ...[
              const SizedBox(height: AppSpacing.sm),
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: Semantics(
                  button: true,
                  expanded: _bioExpanded,
                  child: TextButton.icon(
                    onPressed: () => setState(() => _bioExpanded = !_bioExpanded),
                    icon: Icon(
                      _bioExpanded
                          ? Icons.expand_less_rounded
                          : Icons.expand_more_rounded,
                    ),
                    label: Text(
                      _bioExpanded ? l10n.showLessBio : l10n.showMoreBio,
                    ),
                  ),
                ),
              ),
            ],
          ],
        );
      },
    );
  }
}

class _EmptyLearningValue extends StatelessWidget {
  const _EmptyLearningValue({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: colors.textMuted, size: 18),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            label,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: colors.textSecondary),
          ),
        ),
      ],
    );
  }
}
