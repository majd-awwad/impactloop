import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_radius.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../l10n/l10n.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../../learning_hub/presentation/theme/learning_ui_palette.dart';
import '../../profile/presentation/l10n/learner_profile_l10n.dart';
import '../../profile/presentation/widgets/profile_family_page_widgets.dart';
import '../data/public_user_profile_models.dart';

class PublicUserProfileIdentity extends StatelessWidget {
  const PublicUserProfileIdentity({super.key, required this.profile});

  final PublicUserProfile profile;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final compact = MediaQuery.sizeOf(context).width < 430;
    final displayName = profile.displayName.trim();
    final roleLabel = _roleLabel(context);
    final metaLabel = _metaLabel(context);

    return Container(
      key: const ValueKey('public-user-profile-hero'),
      padding: EdgeInsetsDirectional.all(
        compact ? AppSpacing.md : AppSpacing.lg,
      ),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          UserAvatar(
            displayName: displayName,
            profileImageUrl: profile.avatarUrl,
            radius: compact ? 32 : 36,
            backgroundColor: palette.mutedChip,
            foregroundColor: palette.textPrimary,
          ),
          SizedBox(width: compact ? AppSpacing.md : AppSpacing.lg),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (displayName.isNotEmpty)
                  Text(
                    displayName,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.title(context).copyWith(
                      color: palette.textPrimary,
                      fontWeight: FontWeight.w800,
                      height: 1.2,
                    ),
                  ),
                if (roleLabel != null) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    roleLabel,
                    style: AppTextStyles.label(context).copyWith(
                      color: palette.textSecondary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
                if (metaLabel != null) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    metaLabel,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.body(
                      context,
                    ).copyWith(color: palette.textSecondary, height: 1.35),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  String? _roleLabel(BuildContext context) {
    if (profile.publicRoles.contains('LEARNER')) {
      return context.l10n.publicRoleLearner;
    }
    if (profile.publicRoles.contains('SUPPLIER')) {
      return context.l10n.publicRoleSupplier;
    }
    return null;
  }

  String? _metaLabel(BuildContext context) {
    final l10n = LearnerProfileL10n.of(context);
    final parts = <String>[
      if (profile.learnerType != null)
        l10n.learnerTypeLabel(profile.learnerType!),
      if (profile.skillLevel != null) l10n.skillLevelLabel(profile.skillLevel!),
    ];
    if (parts.isEmpty) {
      return null;
    }
    return parts.join(' • ');
  }
}

class PublicUserProfileAbout extends StatefulWidget {
  const PublicUserProfileAbout({super.key, required this.bio});

  final String bio;

  @override
  State<PublicUserProfileAbout> createState() => _PublicUserProfileAboutState();
}

class _PublicUserProfileAboutState extends State<PublicUserProfileAbout> {
  static const _collapsedBioLines = 4;
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final l10n = LearnerProfileL10n.of(context);
    final direction = profileFamilyContentDirection(
      widget.bio,
      Directionality.of(context),
    );
    final style = AppTextStyles.body(
      context,
    ).copyWith(color: palette.textPrimary, height: 1.5);

    return Column(
      key: const ValueKey('public-user-profile-about'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          context.l10n.publicUserAbout,
          style: AppTextStyles.label(
            context,
          ).copyWith(color: palette.textSecondary, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: AppSpacing.sm),
        LayoutBuilder(
          builder: (context, constraints) {
            final painter = TextPainter(
              text: TextSpan(text: widget.bio, style: style),
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
                    widget.bio,
                    textAlign: TextAlign.start,
                    maxLines: _expanded ? null : _collapsedBioLines,
                    overflow: _expanded
                        ? TextOverflow.visible
                        : TextOverflow.ellipsis,
                    style: style,
                  ),
                ),
                if (overflows || _expanded) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: TextButton(
                      onPressed: () => setState(() => _expanded = !_expanded),
                      style: TextButton.styleFrom(
                        visualDensity: VisualDensity.compact,
                        padding: EdgeInsets.zero,
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: Text(
                        _expanded ? l10n.showLessBio : l10n.showMoreBio,
                      ),
                    ),
                  ),
                ],
              ],
            );
          },
        ),
      ],
    );
  }
}

class PublicUserProfileInterests extends StatefulWidget {
  const PublicUserProfileInterests({super.key, required this.interests});

  final List<String> interests;

  @override
  State<PublicUserProfileInterests> createState() =>
      _PublicUserProfileInterestsState();
}

class _PublicUserProfileInterestsState
    extends State<PublicUserProfileInterests> {
  static const _collapsedInterestCount = 4;
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final l10n = LearnerProfileL10n.of(context);
    final interests = widget.interests;
    final visible = _expanded
        ? interests
        : interests.take(_collapsedInterestCount).toList(growable: false);
    final hiddenCount = interests.length - visible.length;

    return Column(
      key: const ValueKey('public-user-profile-interests'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          context.l10n.publicUserInterests,
          style: AppTextStyles.label(
            context,
          ).copyWith(color: palette.textSecondary, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          alignment: WrapAlignment.start,
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            for (final interest in visible)
              ProfileFamilyIntrinsicChip(label: l10n.interestLabel(interest)),
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
    );
  }
}

class PublicUserProfileStats extends StatelessWidget {
  const PublicUserProfileStats({super.key, required this.profile});

  final PublicUserProfile profile;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final items = <({String value, String label})>[
      (
        value: profile.publishedProjectsCount.toString(),
        label: context.l10n.publicUserPublishedProjects,
      ),
      if (profile.publishedProjectsLikesCount > 0)
        (
          value: profile.publishedProjectsLikesCount.toString(),
          label: context.l10n.publicUserPublishedProjectsLikes,
        ),
    ];

    return Container(
      key: const ValueKey('public-user-profile-stats'),
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm + 2,
      ),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Row(
        children: [
          for (var index = 0; index < items.length; index++) ...[
            if (index > 0)
              Container(
                width: 1,
                height: 36,
                margin: const EdgeInsetsDirectional.symmetric(
                  horizontal: AppSpacing.sm,
                ),
                color: palette.borderSubtle,
              ),
            Expanded(
              child: Column(
                children: [
                  Text(
                    items[index].value,
                    style: AppTextStyles.title(context).copyWith(
                      color: palette.textPrimary,
                      fontWeight: FontWeight.w800,
                      fontSize: 20,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    items[index].label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: palette.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class PublicUserSupplierLinkCard extends StatelessWidget {
  const PublicUserSupplierLinkCard({super.key, required this.supplier});

  final PublicUserSupplierSummary supplier;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    return Container(
      key: const ValueKey('public-user-supplier-activity'),
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final identity = Row(
            children: [
              UserAvatar(
                displayName: supplier.displayName,
                profileImageUrl: supplier.avatarUrl,
                radius: 22,
                backgroundColor: palette.mutedChip,
                foregroundColor: palette.textPrimary,
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      context.l10n.publicUserSupplierActivity,
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: palette.textSecondary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      supplier.displayName,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.title(
                        context,
                      ).copyWith(fontSize: 16),
                    ),
                    if (supplier.isVerified) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Row(
                        children: [
                          Icon(
                            Icons.verified_rounded,
                            size: 15,
                            color: palette.lime,
                          ),
                          const SizedBox(width: AppSpacing.xs),
                          Flexible(
                            child: Text(
                              context.l10n.supplierVerified,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.labelSmall
                                  ?.copyWith(
                                    color: palette.textSecondary,
                                    fontWeight: FontWeight.w700,
                                  ),
                            ),
                          ),
                        ],
                      ),
                    ],
                    Text(
                      context.l10n.publicUserAvailableMaterials(
                        supplier.availableMaterialsCount,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: palette.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
          final profileButton = OutlinedButton(
            onPressed: () => context.push('/suppliers/${supplier.id}'),
            child: Text(context.l10n.publicUserViewSupplierProfile),
          );

          if (constraints.maxWidth < 620) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                identity,
                const SizedBox(height: AppSpacing.md),
                profileButton,
              ],
            );
          }
          return Row(
            children: [
              Expanded(child: identity),
              const SizedBox(width: AppSpacing.md),
              profileButton,
            ],
          );
        },
      ),
    );
  }
}
