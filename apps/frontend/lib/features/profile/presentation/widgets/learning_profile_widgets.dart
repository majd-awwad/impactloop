import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../shared/widgets/user_avatar.dart';
import '../../../auth/data/models/user.dart';
import '../l10n/learner_profile_l10n.dart';
import 'profile_family_page_widgets.dart';

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
  const LearningProfileContent({super.key, required this.user});

  final User user;

  @override
  Widget build(BuildContext context) {
    final data = user.learnerProfile == null
        ? null
        : LearningProfileViewData.fromProfile(user.learnerProfile!);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LearningProfileSummaryCard(user: user, data: data),
        const SizedBox(height: AppSpacing.md),
        if (data == null)
          const LearningProfileEmptyDetailsSurface()
        else
          LayoutBuilder(
            builder: (context, constraints) {
              final details = <Widget>[
                Expanded(child: LearningProfileInterestsSurface(data: data)),
                const SizedBox(width: AppSpacing.md),
                Expanded(child: LearningProfileBioSurface(data: data)),
              ];
              if (constraints.maxWidth >= profileFamilyWideBreakpoint) {
                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: details,
                );
              }
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  LearningProfileInterestsSurface(data: data),
                  const SizedBox(height: AppSpacing.md),
                  LearningProfileBioSurface(data: data),
                ],
              );
            },
          ),
      ],
    );
  }
}

class LearningProfileSummaryCard extends StatelessWidget {
  const LearningProfileSummaryCard({
    super.key,
    required this.user,
    required this.data,
  });

  final User user;
  final LearningProfileViewData? data;

  @override
  Widget build(BuildContext context) {
    final l10n = LearnerProfileL10n.of(context);
    final colors = AppThemeColors.of(context);
    final displayName = user.displayName.trim().isEmpty
        ? l10n.accountFallback
        : user.displayName.trim();
    final date = MaterialLocalizations.of(
      context,
    ).formatMediumDate(user.createdAt.toLocal());
    final compact = MediaQuery.sizeOf(context).width < 390;
    final scale = MediaQuery.textScalerOf(context).scale(1);

    return ProfileFamilyIntroductionSurface(
      padding: EdgeInsetsDirectional.all(
        compact ? AppSpacing.md : AppSpacing.lg,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          LayoutBuilder(
            builder: (context, constraints) {
              final stackIdentity = constraints.maxWidth < 270 || scale >= 1.3;
              final avatar = Semantics(
                image: true,
                label: l10n.avatarLabel(displayName),
                child: ExcludeSemantics(
                  child: UserAvatar(
                    displayName: displayName,
                    profileImageUrl: user.profileImageUrl,
                    radius: compact ? 32 : 36,
                    backgroundColor: colors.primarySoft,
                    foregroundColor: colors.primary,
                    initialTextStyle: AppTextStyles.title(context).copyWith(
                      color: colors.primary,
                      fontSize: 25,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              );
              final identity = Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ProfileFamilyDirectionalText(
                    displayName,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.title(context).copyWith(
                      color: colors.textPrimary,
                      fontSize: compact ? 23 : 25,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    l10n.learnerProfileDescription,
                    style: AppTextStyles.body(context).copyWith(
                      color: colors.textSecondary,
                      fontSize: 13.5,
                      height: 1.45,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      ExcludeSemantics(
                        child: Icon(
                          Icons.calendar_today_outlined,
                          size: 17,
                          color: colors.textSecondary,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Flexible(
                        child: Text(
                          l10n.memberSince(date),
                          style: AppTextStyles.label(context).copyWith(
                            color: colors.textSecondary,
                            fontSize: 12.5,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              );

              if (stackIdentity) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    avatar,
                    const SizedBox(height: AppSpacing.md),
                    identity,
                  ],
                );
              }
              return Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  avatar,
                  const SizedBox(width: AppSpacing.md),
                  Expanded(child: identity),
                ],
              );
            },
          ),
          const SizedBox(height: AppSpacing.md),
          LayoutBuilder(
            builder: (context, constraints) {
              final tiles = <Widget>[
                LearningProfileSummaryTile(
                  icon: Icons.person_outline_rounded,
                  tone: ProfileFamilyTone.mint,
                  label: l10n.learnerType,
                  value: data?.learnerType == null
                      ? l10n.notAdded
                      : l10n.learnerTypeLabel(data!.learnerType!),
                  isMissing: data?.learnerType == null,
                ),
                LearningProfileSummaryTile(
                  icon: Icons.signal_cellular_alt_rounded,
                  tone: ProfileFamilyTone.blue,
                  label: l10n.skillLevel,
                  value: data?.skillLevel == null
                      ? l10n.notAdded
                      : l10n.skillLevelLabel(data!.skillLevel!),
                  isMissing: data?.skillLevel == null,
                ),
              ];
              final stackValues = constraints.maxWidth < 280 || scale >= 1.3;
              if (!stackValues) {
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
    required this.tone,
    required this.label,
    required this.value,
    required this.isMissing,
  });

  final IconData icon;
  final ProfileFamilyTone tone;
  final String label;
  final String value;
  final bool isMissing;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final style = ProfileFamilyToneStyle.of(context, tone);
    final iconWidget = ProfileFamilyIconContainer(
      icon: isMissing ? Icons.add_rounded : icon,
      tone: isMissing ? ProfileFamilyTone.neutral : tone,
      size: 40,
      iconSize: 20,
    );
    final copy = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: AppTextStyles.label(
            context,
          ).copyWith(color: colors.textSecondary, fontSize: 12.5),
        ),
        const SizedBox(height: AppSpacing.xs),
        ProfileFamilyDirectionalText(
          value,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: AppTextStyles.label(context).copyWith(
            color: isMissing ? colors.textSecondary : colors.textPrimary,
            fontSize: 13.5,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );

    return Semantics(
      label: '$label: $value',
      child: ExcludeSemantics(
        child: Container(
          constraints: const BoxConstraints(minHeight: 76),
          padding: const EdgeInsetsDirectional.all(AppSpacing.sm + 4),
          decoration: BoxDecoration(
            color: style.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: style.border),
          ),
          child: LayoutBuilder(
            builder: (context, constraints) {
              if (constraints.maxWidth < 170) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    iconWidget,
                    const SizedBox(height: AppSpacing.sm),
                    copy,
                  ],
                );
              }
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  iconWidget,
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(child: copy),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

class LearningProfileInterestsSurface extends StatefulWidget {
  const LearningProfileInterestsSurface({super.key, required this.data});

  final LearningProfileViewData data;

  @override
  State<LearningProfileInterestsSurface> createState() =>
      _LearningProfileInterestsSurfaceState();
}

class _LearningProfileInterestsSurfaceState
    extends State<LearningProfileInterestsSurface> {
  static const _collapsedInterestCount = 4;
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final l10n = LearnerProfileL10n.of(context);
    final interests = widget.data.interests;
    final visible = _expanded
        ? interests
        : interests.take(_collapsedInterestCount).toList(growable: false);
    final hiddenCount = interests.length - visible.length;

    return ProfileFamilySurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ProfileFamilySectionHeading(
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
            Wrap(
              alignment: WrapAlignment.start,
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                for (final interest in visible)
                  ProfileFamilyIntrinsicChip(
                    label: l10n.interestLabel(interest),
                  ),
                if (!_expanded && hiddenCount > 0)
                  ProfileFamilyIntrinsicChip(
                    label: l10n.moreInterests(hiddenCount),
                    semanticLabel: l10n.hiddenInterestsSemantics(hiddenCount),
                    expanded: false,
                    onPressed: () => setState(() => _expanded = true),
                    tone: ProfileFamilyTone.blue,
                  ),
                if (_expanded && interests.length > _collapsedInterestCount)
                  ProfileFamilyIntrinsicChip(
                    label: l10n.showFewerInterests,
                    semanticLabel: l10n.showFewerInterestsSemantics,
                    expanded: true,
                    onPressed: () => setState(() => _expanded = false),
                    tone: ProfileFamilyTone.neutral,
                  ),
              ],
            ),
        ],
      ),
    );
  }
}

class LearningProfileBioSurface extends StatefulWidget {
  const LearningProfileBioSurface({super.key, required this.data});

  final LearningProfileViewData data;

  @override
  State<LearningProfileBioSurface> createState() =>
      _LearningProfileBioSurfaceState();
}

class _LearningProfileBioSurfaceState extends State<LearningProfileBioSurface> {
  static const _collapsedBioLines = 4;
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final l10n = LearnerProfileL10n.of(context);
    final colors = AppThemeColors.of(context);
    final bio = widget.data.bio;

    return ProfileFamilySurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ProfileFamilySectionHeading(
            icon: Icons.notes_rounded,
            title: l10n.about,
          ),
          const SizedBox(height: AppSpacing.md),
          if (bio == null)
            _EmptyLearningValue(
              icon: Icons.notes_rounded,
              label: l10n.optionalNotAdded,
            )
          else
            LayoutBuilder(
              builder: (context, constraints) {
                final direction = profileFamilyContentDirection(
                  bio,
                  Directionality.of(context),
                );
                final style = AppTextStyles.body(
                  context,
                ).copyWith(color: colors.textSecondary, height: 1.58);
                final painter = TextPainter(
                  text: TextSpan(text: bio, style: style),
                  maxLines: _collapsedBioLines,
                  textDirection: direction,
                  textScaler: MediaQuery.textScalerOf(context),
                )..layout(maxWidth: constraints.maxWidth);
                final overflows = painter.didExceedMaxLines;

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Directionality(
                      textDirection: direction,
                      child: Text(
                        bio,
                        textAlign: TextAlign.start,
                        maxLines: _expanded ? null : _collapsedBioLines,
                        overflow: _expanded
                            ? TextOverflow.visible
                            : TextOverflow.ellipsis,
                        style: style,
                      ),
                    ),
                    if (overflows || _expanded) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: Semantics(
                          button: true,
                          expanded: _expanded,
                          label: _expanded
                              ? l10n.showLessBio
                              : l10n.showMoreBio,
                          child: ExcludeSemantics(
                            child: TextButton.icon(
                              onPressed: () =>
                                  setState(() => _expanded = !_expanded),
                              icon: Icon(
                                _expanded
                                    ? Icons.expand_less_rounded
                                    : Icons.expand_more_rounded,
                              ),
                              label: Text(
                                _expanded ? l10n.showLessBio : l10n.showMoreBio,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ],
                );
              },
            ),
        ],
      ),
    );
  }
}

class LearningProfileEmptyDetailsSurface extends StatelessWidget {
  const LearningProfileEmptyDetailsSurface({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = LearnerProfileL10n.of(context);

    return ProfileFamilySurface(
      tone: ProfileFamilyTone.neutral,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ProfileFamilySectionHeading(
            icon: Icons.school_outlined,
            title: l10n.noLearningProfileTitle,
          ),
          const SizedBox(height: AppSpacing.md),
          _EmptyLearningValue(
            icon: Icons.add_circle_outline_rounded,
            label: l10n.noLearningProfileBody,
          ),
        ],
      ),
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
        ExcludeSemantics(child: Icon(icon, color: colors.textMuted, size: 18)),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            label,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: colors.textSecondary, height: 1.5),
          ),
        ),
      ],
    );
  }
}
