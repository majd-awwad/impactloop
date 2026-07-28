import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../shared/widgets/app_empty_state_card.dart';
import '../../../../shared/widgets/app_primary_button.dart';
import '../../../../shared/widgets/app_section_card.dart';
import '../../../auth/data/models/user.dart';
import '../l10n/learner_profile_l10n.dart';

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
  const LearningProfileContent({
    super.key,
    required this.profile,
    required this.onEdit,
  });

  final LearnerProfile? profile;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final l10n = LearnerProfileL10n.of(context);
    final data = profile == null
        ? null
        : LearningProfileViewData.fromProfile(profile!);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LearningProfileIntroCard(
          actionLabel: data == null
              ? l10n.setUpLearningProfile
              : l10n.editLearningProfile,
          onEdit: onEdit,
        ),
        const SizedBox(height: AppSpacing.md),
        if (data == null)
          AppEmptyStateCard(
            icon: Icons.school_outlined,
            title: l10n.noLearningProfileTitle,
            subtitle: l10n.noLearningProfileBody,
            compact: true,
          )
        else ...[
          LearningProfileDetailsCard(data: data),
          const SizedBox(height: AppSpacing.md),
          LearningProfileInterestsCard(interests: data.interests),
          const SizedBox(height: AppSpacing.md),
          LearningProfileBioCard(bio: data.bio),
        ],
      ],
    );
  }
}

class LearningProfileIntroCard extends StatelessWidget {
  const LearningProfileIntroCard({
    super.key,
    required this.actionLabel,
    required this.onEdit,
  });

  final String actionLabel;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l10n = LearnerProfileL10n.of(context);

    return AppSectionCard(
      emphasized: true,
      borderRadius: AppRadius.xlAll,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: colors.primarySoft,
                  borderRadius: AppRadius.mdAll,
                ),
                child: Icon(
                  Icons.school_outlined,
                  color: colors.primary,
                  size: 25,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.learnerProfile,
                      style: AppTextStyles.title(
                        context,
                      ).copyWith(color: colors.textPrimary, fontSize: 20),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      l10n.learningProfileIntro,
                      style: AppTextStyles.body(
                        context,
                      ).copyWith(color: colors.textSecondary, height: 1.45),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          AppPrimaryButton(label: actionLabel, onPressed: onEdit),
        ],
      ),
    );
  }
}

class LearningProfileDetailsCard extends StatelessWidget {
  const LearningProfileDetailsCard({super.key, required this.data});

  final LearningProfileViewData data;

  @override
  Widget build(BuildContext context) {
    final l10n = LearnerProfileL10n.of(context);

    return _LearningProfileSection(
      title: l10n.learningDetails,
      icon: Icons.tune_rounded,
      child: Column(
        children: [
          LearningProfileValueRow(
            label: l10n.learnerType,
            value: data.learnerType == null
                ? l10n.notAdded
                : l10n.learnerTypeLabel(data.learnerType!),
            isMissing: data.learnerType == null,
          ),
          const Divider(height: AppSpacing.lg),
          LearningProfileValueRow(
            label: l10n.skillLevel,
            value: data.skillLevel == null
                ? l10n.notAdded
                : l10n.skillLevelLabel(data.skillLevel!),
            isMissing: data.skillLevel == null,
          ),
        ],
      ),
    );
  }
}

class LearningProfileValueRow extends StatelessWidget {
  const LearningProfileValueRow({
    super.key,
    required this.label,
    required this.value,
    required this.isMissing,
  });

  final String label;
  final String value;
  final bool isMissing;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final scale = MediaQuery.textScalerOf(context).scale(1);

    final labelWidget = Text(
      label,
      style: AppTextStyles.label(
        context,
      ).copyWith(color: colors.textSecondary, fontWeight: FontWeight.w600),
    );
    final valueWidget = Text(
      value,
      textAlign: TextAlign.start,
      style: AppTextStyles.label(context).copyWith(
        color: isMissing ? colors.textMuted : colors.textPrimary,
        fontWeight: isMissing ? FontWeight.w600 : FontWeight.w800,
      ),
    );

    return Semantics(
      label: '$label: $value',
      child: ExcludeSemantics(
        child: LayoutBuilder(
          builder: (context, constraints) {
            if (constraints.maxWidth < 360 || scale > 1.3) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  labelWidget,
                  const SizedBox(height: AppSpacing.xs),
                  valueWidget,
                ],
              );
            }

            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: labelWidget),
                const SizedBox(width: AppSpacing.md),
                Flexible(child: valueWidget),
              ],
            );
          },
        ),
      ),
    );
  }
}

class LearningProfileInterestsCard extends StatefulWidget {
  const LearningProfileInterestsCard({super.key, required this.interests});

  final List<String> interests;

  @override
  State<LearningProfileInterestsCard> createState() =>
      _LearningProfileInterestsCardState();
}

class _LearningProfileInterestsCardState
    extends State<LearningProfileInterestsCard> {
  static const _collapsedCount = 12;
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final l10n = LearnerProfileL10n.of(context);
    final visible = _expanded
        ? widget.interests
        : widget.interests.take(_collapsedCount).toList(growable: false);
    final remaining = widget.interests.length - visible.length;

    return _LearningProfileSection(
      title: l10n.interests,
      icon: Icons.interests_outlined,
      child: widget.interests.isEmpty
          ? _EmptyLearningValue(label: l10n.noInterestsAdded)
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: [
                    for (final interest in visible)
                      LearningProfileInterestChip(
                        label: l10n.interestLabel(interest),
                      ),
                  ],
                ),
                if (remaining > 0 || _expanded) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: TextButton(
                      onPressed: () => setState(() => _expanded = !_expanded),
                      child: Text(
                        _expanded ? l10n.showLess : l10n.showMore(remaining),
                      ),
                    ),
                  ),
                ],
              ],
            ),
    );
  }
}

class LearningProfileInterestChip extends StatelessWidget {
  const LearningProfileInterestChip({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Semantics(
      label: label,
      child: Container(
        constraints: const BoxConstraints(minHeight: 40),
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: colors.primarySoft,
          borderRadius: AppRadius.pillAll,
          border: Border.all(color: colors.primary.withValues(alpha: 0.24)),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: AppTextStyles.label(context).copyWith(
            color: colors.primary,
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

class LearningProfileBioCard extends StatefulWidget {
  const LearningProfileBioCard({super.key, required this.bio});

  final String? bio;

  @override
  State<LearningProfileBioCard> createState() => _LearningProfileBioCardState();
}

class _LearningProfileBioCardState extends State<LearningProfileBioCard> {
  static const _collapsedLines = 6;
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final l10n = LearnerProfileL10n.of(context);
    final colors = AppThemeColors.of(context);
    final bio = widget.bio;

    return _LearningProfileSection(
      title: l10n.about,
      icon: Icons.notes_rounded,
      child: bio == null
          ? _EmptyLearningValue(label: l10n.optionalNotAdded)
          : LayoutBuilder(
              builder: (context, constraints) {
                final style = AppTextStyles.body(
                  context,
                ).copyWith(color: colors.textSecondary, height: 1.55);
                final painter = TextPainter(
                  text: TextSpan(text: bio, style: style),
                  maxLines: _collapsedLines,
                  textDirection: Directionality.of(context),
                  textScaler: MediaQuery.textScalerOf(context),
                )..layout(maxWidth: constraints.maxWidth);
                final overflows = painter.didExceedMaxLines;

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      bio,
                      maxLines: _expanded ? null : _collapsedLines,
                      overflow: _expanded
                          ? TextOverflow.visible
                          : TextOverflow.ellipsis,
                      style: style,
                    ),
                    if (overflows || _expanded) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: TextButton(
                          onPressed: () =>
                              setState(() => _expanded = !_expanded),
                          child: Text(
                            _expanded ? l10n.showLess : l10n.showMoreContent,
                          ),
                        ),
                      ),
                    ],
                  ],
                );
              },
            ),
    );
  }
}

class _LearningProfileSection extends StatelessWidget {
  const _LearningProfileSection({
    required this.title,
    required this.icon,
    required this.child,
  });

  final String title;
  final IconData icon;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return AppSectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(icon, color: colors.primary, size: 21),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  title,
                  style: AppTextStyles.title(
                    context,
                  ).copyWith(color: colors.textPrimary, fontSize: 17),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          child,
        ],
      ),
    );
  }
}

class _EmptyLearningValue extends StatelessWidget {
  const _EmptyLearningValue({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Text(
      label,
      style: AppTextStyles.body(
        context,
      ).copyWith(color: colors.textMuted, fontStyle: FontStyle.italic),
    );
  }
}
