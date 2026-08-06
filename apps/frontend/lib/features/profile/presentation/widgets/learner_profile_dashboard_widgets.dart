import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../core/config/api_config.dart';
import '../../../../shared/widgets/account_status_presentation.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/user_avatar.dart';
import '../../../auth/data/models/user.dart';
import '../../../project_help_sessions/application/project_help_sessions_providers.dart';
import '../../data/models/learner_profile_summary.dart';
import '../l10n/learner_profile_l10n.dart';
import 'learner_profile_hub_widgets.dart';

typedef ProfileDashboardRouteOpener =
    Future<void> Function(String route, {required bool refreshOnReturn});

class LearnerProfileDashboard extends StatelessWidget {
  const LearnerProfileDashboard({
    super.key,
    required this.user,
    required this.summary,
    required this.isInitialLoading,
    required this.isRefreshing,
    required this.hasSummaryError,
    required this.onRetry,
    required this.onOpenRoute,
  });

  final User user;
  final LearnerProfileSummary? summary;
  final bool isInitialLoading;
  final bool isRefreshing;
  final bool hasSummaryError;
  final Future<void> Function() onRetry;
  final ProfileDashboardRouteOpener onOpenRoute;

  void _open(String route, {bool refreshOnReturn = true}) {
    unawaited(onOpenRoute(route, refreshOnReturn: refreshOnReturn));
  }

  @override
  Widget build(BuildContext context) {
    final verification = resolveAccountVerificationNotice(user);

    return FocusTraversalGroup(
      policy: OrderedTraversalPolicy(),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final wide = constraints.maxWidth >= 860;
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              LearnerIdentityDashboardHero(
                user: user,
                onEdit: () => _open('/profile/edit'),
              ),
              if (verification != null) ...[
                const SizedBox(height: AppSpacing.sm),
                CompactAccountVerificationNotice(
                  state: verification,
                  onAction: () => _open(
                    verification.kind ==
                            AccountVerificationNoticeKind.emailUnverified
                        ? '/profile/account'
                        : '/profile/edit',
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.md),
              if (isRefreshing && summary != null)
                ClipRRect(
                  borderRadius: AppRadius.pillAll,
                  child: const LinearProgressIndicator(minHeight: 3),
                ),
              if (isRefreshing && summary != null)
                const SizedBox(height: AppSpacing.sm),
              if (summary == null && isInitialLoading)
                const LearnerDashboardSkeleton()
              else if (summary == null && hasSummaryError)
                DashboardSummaryError(onRetry: onRetry)
              else if (summary != null) ...[
                if (hasSummaryError) ...[
                  const DashboardRefreshFailureNotice(),
                  const SizedBox(height: AppSpacing.sm),
                ],
                if (wide)
                  _WideSummaryLayout(
                    user: user,
                    summary: summary!,
                    onOpen: _open,
                  )
                else
                  _MobileSummaryLayout(
                    user: user,
                    summary: summary!,
                    onOpen: _open,
                  ),
              ],
              if (summary == null) ...[
                const SizedBox(height: AppSpacing.md),
                LearningIdentityPreviewCard(
                  profile: user.learnerProfile,
                  onTap: () => _open('/profile/learning'),
                ),
                const SizedBox(height: AppSpacing.md),
                DashboardQuickActions(onOpen: _open),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _MobileSummaryLayout extends StatelessWidget {
  const _MobileSummaryLayout({
    required this.user,
    required this.summary,
    required this.onOpen,
  });

  final User user;
  final LearnerProfileSummary summary;
  final void Function(String route, {bool refreshOnReturn}) onOpen;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ProfileCompletionDashboardCard(
          completion: summary.profileCompletion,
          onOpen: onOpen,
        ),
        const SizedBox(height: AppSpacing.md),
        JourneySummarySection(journey: summary.journey, onOpen: onOpen),
        if (summary.continueProject != null) ...[
          const SizedBox(height: AppSpacing.md),
          ContinueProjectDashboardCard(
            project: summary.continueProject!,
            onTap: () => onOpen(
              '/learning/${summary.continueProject!.projectId}/build',
              refreshOnReturn: true,
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.md),
        LearningIdentityPreviewCard(
          profile: user.learnerProfile,
          onTap: () => onOpen('/profile/learning', refreshOnReturn: true),
        ),
        const SizedBox(height: AppSpacing.md),
        DashboardQuickActions(onOpen: onOpen),
      ],
    );
  }
}

class _WideSummaryLayout extends StatelessWidget {
  const _WideSummaryLayout({
    required this.user,
    required this.summary,
    required this.onOpen,
  });

  final User user;
  final LearnerProfileSummary summary;
  final void Function(String route, {bool refreshOnReturn}) onOpen;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 350,
              child: ProfileCompletionDashboardCard(
                completion: summary.profileCompletion,
                onOpen: onOpen,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: JourneySummarySection(
                journey: summary.journey,
                onOpen: onOpen,
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              flex: 3,
              child: summary.continueProject == null
                  ? LearningIdentityPreviewCard(
                      profile: user.learnerProfile,
                      onTap: () =>
                          onOpen('/profile/learning', refreshOnReturn: true),
                    )
                  : ContinueProjectDashboardCard(
                      project: summary.continueProject!,
                      forceHorizontal: true,
                      onTap: () => onOpen(
                        '/learning/${summary.continueProject!.projectId}/build',
                        refreshOnReturn: true,
                      ),
                    ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              flex: 2,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (summary.continueProject != null) ...[
                    LearningIdentityPreviewCard(
                      profile: user.learnerProfile,
                      onTap: () =>
                          onOpen('/profile/learning', refreshOnReturn: true),
                    ),
                    const SizedBox(height: AppSpacing.md),
                  ],
                  DashboardQuickActions(onOpen: onOpen),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class LearnerIdentityDashboardHero extends StatelessWidget {
  const LearnerIdentityDashboardHero({
    super.key,
    required this.user,
    required this.onEdit,
  });

  final User user;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l10n = LearnerProfileL10n.of(context);
    final displayName = user.displayName.trim().isEmpty
        ? l10n.accountFallback
        : user.displayName.trim();
    final memberSince = user.createdAt.millisecondsSinceEpoch == 0
        ? null
        : l10n.memberSince(
            MaterialLocalizations.of(
              context,
            ).formatMediumDate(user.createdAt.toLocal()),
          );

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: AlignmentDirectional.topStart,
          end: AlignmentDirectional.bottomEnd,
          colors: [
            colors.cardSurface,
            Color.lerp(colors.cardSurface, colors.primarySoft, 0.82)!,
          ],
        ),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: colors.primary.withValues(alpha: 0.12)),
        boxShadow: [
          BoxShadow(
            color: colors.shadow.withValues(alpha: 0.1),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(27),
        child: Stack(
          children: [
            PositionedDirectional(
              end: -42,
              top: -60,
              child: _HeroOrb(
                size: 160,
                color: colors.accentMint.withValues(alpha: 0.13),
              ),
            ),
            PositionedDirectional(
              start: 78,
              bottom: -65,
              child: _HeroOrb(
                size: 132,
                color: colors.primary.withValues(alpha: 0.07),
              ),
            ),
            Padding(
              padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final scale = MediaQuery.textScalerOf(context).scale(1);
                  final stack = constraints.maxWidth < 310 && scale > 1.15;
                  final avatar = Semantics(
                    image: true,
                    label: l10n.avatarLabel(displayName),
                    child: ExcludeSemantics(
                      child: UserAvatar(
                        displayName: displayName,
                        profileImageUrl: user.profileImageUrl,
                        radius: constraints.maxWidth < 340 ? 38 : 44,
                        backgroundColor: colors.primarySoft,
                        foregroundColor: colors.primary,
                        initialTextStyle: AppTextStyles.display(context)
                            .copyWith(
                              color: colors.primary,
                              fontSize: 34,
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                    ),
                  );
                  final identity = _HeroIdentity(
                    user: user,
                    displayName: displayName,
                    memberSince: memberSince,
                  );

                  if (stack) {
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            avatar,
                            const Spacer(),
                            _HeroEditButton(onPressed: onEdit),
                          ],
                        ),
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
                      const SizedBox(width: AppSpacing.sm),
                      _HeroEditButton(onPressed: onEdit),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeroIdentity extends StatelessWidget {
  const _HeroIdentity({
    required this.user,
    required this.displayName,
    required this.memberSince,
  });

  final User user;
  final String displayName;
  final String? memberSince;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l10n = LearnerProfileL10n.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          displayName,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: AppTextStyles.title(context).copyWith(
            color: colors.textPrimary,
            fontSize: 25,
            fontWeight: FontWeight.w800,
            height: 1.12,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Directionality(
          textDirection: TextDirection.ltr,
          child: Text(
            user.email,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.left,
            style: AppTextStyles.body(
              context,
            ).copyWith(color: colors.textSecondary, fontSize: 13.5),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.xs,
          children: [
            AppStatusBadge(
              label: l10n.roleLabel(user.activeRole),
              tone: AppStatusTone.primary,
            ),
            AppStatusBadge(
              label: l10n.accountStatusLabel(user.accountStatus),
              tone: accountStatusTone(user.accountStatus),
            ),
          ],
        ),
        if (memberSince != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.calendar_today_outlined,
                size: 15,
                color: colors.textMuted,
              ),
              const SizedBox(width: AppSpacing.xs),
              Flexible(
                child: Text(
                  memberSince!,
                  style: AppTextStyles.label(context).copyWith(
                    color: colors.textSecondary,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _HeroEditButton extends StatelessWidget {
  const _HeroEditButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l10n = LearnerProfileL10n.of(context);
    return Semantics(
      button: true,
      label: l10n.editProfile,
      child: Tooltip(
        message: l10n.editProfile,
        child: OutlinedButton(
          onPressed: onPressed,
          style: OutlinedButton.styleFrom(
            foregroundColor: colors.primary,
            minimumSize: const Size(48, 48),
            padding: const EdgeInsetsDirectional.symmetric(
              horizontal: AppSpacing.sm,
            ),
            side: BorderSide(color: colors.primary.withValues(alpha: 0.25)),
            shape: RoundedRectangleBorder(borderRadius: AppRadius.lgAll),
          ),
          child: const Icon(Icons.edit_rounded, size: 21),
        ),
      ),
    );
  }
}

class _HeroOrb extends StatelessWidget {
  const _HeroOrb({required this.size, required this.color});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(shape: BoxShape.circle, color: color),
      ),
    );
  }
}

class CompactAccountVerificationNotice extends StatelessWidget {
  const CompactAccountVerificationNotice({
    super.key,
    required this.state,
    required this.onAction,
  });

  final AccountVerificationNoticeState state;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l10n = LearnerProfileL10n.of(context);
    final (title, action) = switch (state.kind) {
      AccountVerificationNoticeKind.emailUnverified => (
        l10n.emailNotVerifiedTitle,
        l10n.reviewAccountAction,
      ),
      AccountVerificationNoticeKind.phoneMissing => (
        l10n.phoneMissingTitle,
        l10n.addPhoneAction,
      ),
      AccountVerificationNoticeKind.phoneUnverified => (
        l10n.phoneNotVerifiedTitle,
        l10n.reviewPhoneAction,
      ),
    };

    return Semantics(
      container: true,
      child: Container(
        padding: const EdgeInsetsDirectional.fromSTEB(
          AppSpacing.md,
          AppSpacing.sm,
          AppSpacing.sm,
          AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: colors.warningSoft.withValues(alpha: 0.7),
          borderRadius: AppRadius.lgAll,
          border: Border.all(color: colors.warningBorder),
        ),
        child: Row(
          children: [
            Icon(
              Icons.info_outline_rounded,
              color: colors.warningText,
              size: 20,
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                title,
                style: AppTextStyles.label(context).copyWith(
                  color: colors.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            TextButton(
              onPressed: onAction,
              style: TextButton.styleFrom(
                foregroundColor: colors.warningText,
                minimumSize: const Size(48, 48),
              ),
              child: Text(action),
            ),
          ],
        ),
      ),
    );
  }
}

class ProfileCompletionDashboardCard extends StatelessWidget {
  const ProfileCompletionDashboardCard({
    super.key,
    required this.completion,
    required this.onOpen,
  });

  final LearnerProfileCompletionSummary completion;
  final void Function(String route, {bool refreshOnReturn}) onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l10n = LearnerProfileL10n.of(context);
    final action = resolveLearnerProfileCompletionAction(
      completion.missingSteps,
    );
    final complete = completion.percentage == 100;
    final ring = _CompletionRing(completion: completion);
    final copy = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          complete ? l10n.profileComplete : l10n.profileCompletion,
          style: AppTextStyles.title(context).copyWith(
            color: colors.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          complete ? l10n.profileCompleteBody : l10n.profileCompletionBody,
          style: AppTextStyles.body(
            context,
          ).copyWith(color: colors.textSecondary, fontSize: 13.5, height: 1.35),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          l10n.completionSteps(
            completion.completedSteps,
            completion.totalSteps,
          ),
          style: AppTextStyles.label(context).copyWith(
            color: colors.primary,
            fontSize: 12.5,
            fontWeight: FontWeight.w700,
          ),
        ),
        if (!complete && action != null) ...[
          const SizedBox(height: AppSpacing.xs),
          TextButton.icon(
            onPressed: () => onOpen(action.route, refreshOnReturn: true),
            style: TextButton.styleFrom(
              foregroundColor: colors.primary,
              minimumSize: const Size(48, 48),
              padding: EdgeInsets.zero,
              alignment: AlignmentDirectional.centerStart,
            ),
            iconAlignment: IconAlignment.end,
            icon: const Icon(Icons.arrow_forward_rounded, size: 18),
            label: Text(l10n.completionAction(action.step)),
          ),
        ],
      ],
    );

    return _DashboardSurface(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final scale = MediaQuery.textScalerOf(context).scale(1);
          if (constraints.maxWidth < 320 || scale > 1.25) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Align(alignment: AlignmentDirectional.centerStart, child: ring),
                const SizedBox(height: AppSpacing.md),
                copy,
              ],
            );
          }
          return Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              ring,
              const SizedBox(width: AppSpacing.md),
              Expanded(child: copy),
            ],
          );
        },
      ),
    );
  }
}

class _CompletionRing extends StatelessWidget {
  const _CompletionRing({required this.completion});

  final LearnerProfileCompletionSummary completion;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l10n = LearnerProfileL10n.of(context);
    final value = (completion.percentage / 100).clamp(0.0, 1.0);
    return Semantics(
      label: l10n.completionSemantics(
        completion.percentage,
        completion.completedSteps,
        completion.totalSteps,
      ),
      value: '${completion.percentage}%',
      child: ExcludeSemantics(
        child: SizedBox.square(
          dimension: 88,
          child: CustomPaint(
            painter: _ProgressRingPainter(
              value: value,
              trackColor: colors.primarySoft,
              progressColor: colors.primary,
            ),
            child: Center(
              child: Directionality(
                textDirection: TextDirection.ltr,
                child: Text(
                  '${completion.percentage}%',
                  style: AppTextStyles.title(context).copyWith(
                    color: colors.primary,
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ProgressRingPainter extends CustomPainter {
  const _ProgressRingPainter({
    required this.value,
    required this.trackColor,
    required this.progressColor,
  });

  final double value;
  final Color trackColor;
  final Color progressColor;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = (size.shortestSide - 8) / 2;
    final track = Paint()
      ..color = trackColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 7;
    final progress = Paint()
      ..color = progressColor
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 7;
    canvas.drawCircle(center, radius, track);
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -1.5708,
      6.28318 * value,
      false,
      progress,
    );
  }

  @override
  bool shouldRepaint(covariant _ProgressRingPainter oldDelegate) {
    return value != oldDelegate.value ||
        trackColor != oldDelegate.trackColor ||
        progressColor != oldDelegate.progressColor;
  }
}

class JourneySummarySection extends StatelessWidget {
  const JourneySummarySection({
    super.key,
    required this.journey,
    required this.onOpen,
  });

  final LearnerJourneySummary journey;
  final void Function(String route, {bool refreshOnReturn}) onOpen;

  @override
  Widget build(BuildContext context) {
    final l10n = LearnerProfileL10n.of(context);
    final metrics = [
      _JourneyMetricData(
        label: l10n.activeReservations,
        count: journey.activeReservationsCount,
        icon: Icons.pending_actions_rounded,
        route: '/learner/reservations',
        tone: _MetricTone.primary,
      ),
      _JourneyMetricData(
        label: l10n.completedBuilds,
        count: journey.completedBuildsCount,
        icon: Icons.task_alt_rounded,
        route: '/learner/portfolio',
        tone: _MetricTone.mint,
      ),
      _JourneyMetricData(
        label: l10n.savedProjects,
        count: journey.savedProjectsCount,
        icon: Icons.bookmark_rounded,
        route: '/home/recommendations/saved_projects',
        tone: _MetricTone.blue,
      ),
      _JourneyMetricData(
        label: l10n.likedMaterials,
        count: journey.likedMaterialsCount,
        icon: Icons.favorite_rounded,
        route: '/materials/liked',
        tone: _MetricTone.amber,
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _SectionHeading(icon: Icons.eco_rounded, title: l10n.yourJourney),
        const SizedBox(height: AppSpacing.sm),
        for (var row = 0; row < 2; row++) ...[
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: _JourneyMetricCard(
                    metric: metrics[row * 2],
                    onTap: () => onOpen(
                      metrics[row * 2].route,
                      refreshOnReturn:
                          metrics[row * 2].route != '/materials/liked',
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: _JourneyMetricCard(
                    metric: metrics[row * 2 + 1],
                    onTap: () => onOpen(
                      metrics[row * 2 + 1].route,
                      refreshOnReturn:
                          metrics[row * 2 + 1].route != '/materials/liked',
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (row == 0) const SizedBox(height: AppSpacing.sm),
        ],
      ],
    );
  }
}

enum _MetricTone { primary, mint, blue, amber }

class _JourneyMetricData {
  const _JourneyMetricData({
    required this.label,
    required this.count,
    required this.icon,
    required this.route,
    required this.tone,
  });

  final String label;
  final int count;
  final IconData icon;
  final String route;
  final _MetricTone tone;
}

class _JourneyMetricCard extends StatelessWidget {
  const _JourneyMetricCard({required this.metric, required this.onTap});

  final _JourneyMetricData metric;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l10n = LearnerProfileL10n.of(context);
    final count = MaterialLocalizations.of(context).formatDecimal(metric.count);
    final (surface, accent) = switch (metric.tone) {
      _MetricTone.primary => (colors.primarySoft, colors.primary),
      _MetricTone.mint => (
        Color.lerp(colors.cardSurface, colors.accentMint, 0.22)!,
        colors.success,
      ),
      _MetricTone.blue => (
        Color.lerp(colors.cardSurface, colors.accentBlue, 0.12)!,
        colors.info,
      ),
      _MetricTone.amber => (
        Color.lerp(colors.cardSurface, colors.accentAmber, 0.14)!,
        colors.accentAmber,
      ),
    };

    return Semantics(
      button: true,
      label: l10n.metricSemantics(metric.label, count),
      child: Material(
        color: surface,
        borderRadius: BorderRadius.circular(19),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(19),
          child: Container(
            constraints: const BoxConstraints(minHeight: 108),
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(19),
              border: Border.all(color: accent.withValues(alpha: 0.16)),
            ),
            child: ExcludeSemantics(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: colors.cardSurface.withValues(alpha: 0.76),
                          borderRadius: AppRadius.mdAll,
                        ),
                        child: Icon(metric.icon, color: accent, size: 21),
                      ),
                      const Spacer(),
                      Text(
                        count,
                        style: AppTextStyles.title(context).copyWith(
                          color: colors.textPrimary,
                          fontSize: 26,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    metric.label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTextStyles.label(context).copyWith(
                      color: colors.textSecondary,
                      fontSize: 13,
                      height: 1.2,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class ContinueProjectDashboardCard extends StatelessWidget {
  const ContinueProjectDashboardCard({
    super.key,
    required this.project,
    required this.onTap,
    this.forceHorizontal = false,
  });

  final LearnerContinueProjectSummary project;
  final VoidCallback onTap;
  final bool forceHorizontal;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l10n = LearnerProfileL10n.of(context);
    final progress = (project.progress.percentage / 100).clamp(0.0, 1.0);
    final lastActivity = l10n.lastActivity(
      MaterialLocalizations.of(
        context,
      ).formatMediumDate(project.lastActivityAt.toLocal()),
    );

    final image = _ContinueProjectImage(project: project);
    final content = Padding(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            l10n.continueProject,
            style: AppTextStyles.label(context).copyWith(
              color: colors.primary,
              fontSize: 12.5,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            project.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.title(context).copyWith(
              color: colors.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.w800,
              height: 1.2,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: Text(
                  l10n.buildProgress(
                    project.progress.completedSteps,
                    project.progress.totalSteps,
                  ),
                  style: AppTextStyles.label(
                    context,
                  ).copyWith(color: colors.textSecondary, fontSize: 12.5),
                ),
              ),
              Directionality(
                textDirection: TextDirection.ltr,
                child: Text(
                  '${project.progress.percentage}%',
                  style: AppTextStyles.label(context).copyWith(
                    color: colors.primary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          ClipRRect(
            borderRadius: AppRadius.pillAll,
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 8,
              color: colors.primary,
              backgroundColor: colors.primarySoft,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Icon(Icons.schedule_rounded, size: 15, color: colors.textMuted),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Text(
                  lastActivity,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.label(
                    context,
                  ).copyWith(color: colors.textMuted, fontSize: 12),
                ),
              ),
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: colors.primary,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.arrow_forward_rounded,
                  color: colors.textOnPrimary,
                  size: 19,
                ),
              ),
            ],
          ),
        ],
      ),
    );

    return Semantics(
      button: true,
      label: l10n.continueProjectSemantics(
        project.title,
        project.progress.percentage,
        project.progress.completedSteps,
        project.progress.totalSteps,
      ),
      child: Material(
        color: colors.cardSurface,
        borderRadius: AppRadius.xlAll,
        child: InkWell(
          onTap: onTap,
          borderRadius: AppRadius.xlAll,
          child: Container(
            decoration: BoxDecoration(
              borderRadius: AppRadius.xlAll,
              border: Border.all(color: colors.primary.withValues(alpha: 0.18)),
              boxShadow: [
                BoxShadow(
                  color: colors.shadow.withValues(alpha: 0.07),
                  blurRadius: 18,
                  offset: const Offset(0, 7),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: AppRadius.xlAll,
              child: ExcludeSemantics(
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final scale = MediaQuery.textScalerOf(context).scale(1);
                    final horizontal =
                        forceHorizontal ||
                        (constraints.maxWidth >= 360 && scale <= 1.2);
                    if (horizontal) {
                      return IntrinsicHeight(
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            SizedBox(width: 132, child: image),
                            Expanded(child: content),
                          ],
                        ),
                      );
                    }
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        SizedBox(height: 136, child: image),
                        content,
                      ],
                    );
                  },
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ContinueProjectImage extends StatelessWidget {
  const _ContinueProjectImage({required this.project});

  final LearnerContinueProjectSummary project;

  @override
  Widget build(BuildContext context) {
    final imageUrl = project.imageUrl?.trim() ?? '';
    if (imageUrl.isEmpty) {
      return const _ContinueImageFallback();
    }
    return Image.network(
      ApiConfig.resolveMediaUrl(imageUrl),
      fit: BoxFit.cover,
      errorBuilder: (_, _, _) => const _ContinueImageFallback(),
    );
  }
}

class _ContinueImageFallback extends StatelessWidget {
  const _ContinueImageFallback();

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: AlignmentDirectional.topStart,
          end: AlignmentDirectional.bottomEnd,
          colors: [
            colors.primarySoft,
            colors.accentMint.withValues(alpha: 0.42),
          ],
        ),
      ),
      child: Center(
        child: Container(
          width: 58,
          height: 58,
          decoration: BoxDecoration(
            color: colors.cardSurface.withValues(alpha: 0.78),
            shape: BoxShape.circle,
          ),
          child: Icon(Icons.handyman_rounded, color: colors.primary, size: 28),
        ),
      ),
    );
  }
}

class LearningIdentityPreviewCard extends StatelessWidget {
  const LearningIdentityPreviewCard({
    super.key,
    required this.profile,
    required this.onTap,
  });

  final LearnerProfile? profile;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l10n = LearnerProfileL10n.of(context);
    final type = profile?.learnerType.trim() ?? '';
    final level = profile?.skillLevel.trim() ?? '';
    final bio = profile?.bio?.trim() ?? '';
    final interests = _cleanInterests(profile?.interests ?? const []);
    final visible = interests.take(4).toList(growable: false);
    final remaining = interests.length - visible.length;
    final hasDetails =
        type.isNotEmpty ||
        level.isNotEmpty ||
        bio.isNotEmpty ||
        visible.isNotEmpty;

    return Semantics(
      button: true,
      label: l10n.openLearningProfile,
      child: Material(
        color: colors.cardSurface,
        borderRadius: AppRadius.xlAll,
        child: InkWell(
          onTap: onTap,
          borderRadius: AppRadius.xlAll,
          child: Container(
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            decoration: BoxDecoration(
              borderRadius: AppRadius.xlAll,
              border: Border.all(color: colors.borderSubtle),
            ),
            child: ExcludeSemantics(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          color: colors.primarySoft,
                          borderRadius: AppRadius.mdAll,
                        ),
                        child: Icon(
                          Icons.school_outlined,
                          color: colors.primary,
                          size: 22,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          l10n.learningIdentity,
                          style: AppTextStyles.title(context).copyWith(
                            color: colors.textPrimary,
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      Icon(
                        Icons.chevron_right_rounded,
                        color: colors.textMuted,
                        textDirection: Directionality.of(context),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),
                  if (!hasDetails)
                    Text(
                      l10n.noLearningDetails,
                      style: AppTextStyles.body(
                        context,
                      ).copyWith(color: colors.textSecondary),
                    )
                  else ...[
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.sm,
                      children: [
                        if (type.isNotEmpty)
                          _LearningValuePill(
                            icon: Icons.person_outline_rounded,
                            label: l10n.learnerTypeLabel(type),
                          ),
                        if (level.isNotEmpty)
                          _LearningValuePill(
                            icon: Icons.signal_cellular_alt_rounded,
                            label: l10n.skillLevelLabel(level),
                          ),
                      ],
                    ),
                    if (visible.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Wrap(
                        spacing: AppSpacing.sm,
                        runSpacing: AppSpacing.sm,
                        children: [
                          for (final interest in visible)
                            _DashboardInterestChip(
                              label: l10n.interestLabel(interest),
                            ),
                          if (remaining > 0)
                            _DashboardInterestChip(
                              label: l10n.moreInterests(remaining),
                            ),
                        ],
                      ),
                    ],
                    if (bio.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        bio,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.body(
                          context,
                        ).copyWith(color: colors.textSecondary, height: 1.4),
                      ),
                    ],
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  static List<String> _cleanInterests(List<String> raw) {
    final values = <String>[];
    final seen = <String>{};
    for (final value in raw) {
      final clean = value.trim();
      if (clean.isNotEmpty && seen.add(clean.toLowerCase())) {
        values.add(clean);
      }
    }
    return values;
  }
}

class _LearningValuePill extends StatelessWidget {
  const _LearningValuePill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Container(
      constraints: const BoxConstraints(minHeight: 38),
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: colors.surfaceMuted,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 17, color: colors.primary),
          const SizedBox(width: AppSpacing.xs),
          Flexible(
            child: Text(
              label,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.label(
                context,
              ).copyWith(color: colors.textPrimary, fontSize: 12.5),
            ),
          ),
        ],
      ),
    );
  }
}

class _DashboardInterestChip extends StatelessWidget {
  const _DashboardInterestChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Container(
      constraints: const BoxConstraints(minHeight: 36, maxWidth: 210),
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: colors.primarySoft.withValues(alpha: 0.72),
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: colors.primary.withValues(alpha: 0.16)),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: AppTextStyles.label(context).copyWith(
          color: colors.primary,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class DashboardQuickActions extends StatelessWidget {
  const DashboardQuickActions({super.key, required this.onOpen});

  final void Function(String route, {bool refreshOnReturn}) onOpen;

  @override
  Widget build(BuildContext context) {
    final l10n = LearnerProfileL10n.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _SectionHeading(icon: Icons.bolt_rounded, title: l10n.quickActions),
        const SizedBox(height: AppSpacing.sm),
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: _QuickActionTile(
                  icon: Icons.handyman_outlined,
                  label: l10n.myBuilds,
                  semanticLabel: l10n.openMyBuilds,
                  onTap: () => onOpen(
                    '/learner/builds',
                    refreshOnReturn: true,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _QuickActionTile(
                  icon: Icons.collections_bookmark_outlined,
                  label: l10n.portfolio,
                  semanticLabel: l10n.openPortfolio,
                  onTap: () => onOpen(
                    '/learner/portfolio',
                    refreshOnReturn: true,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: _QuickActionTile(
                  icon: Icons.request_quote_outlined,
                  label: l10n.materialRequests,
                  semanticLabel: l10n.openMaterialRequests,
                  onTap: () => onOpen(
                    '/learner/material-requests',
                    refreshOnReturn: true,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _QuickActionTile(
                  icon: Icons.location_on_outlined,
                  label: l10n.savedLocations,
                  semanticLabel: l10n.openSavedLocations,
                  onTap: () =>
                      onOpen('/profile/locations', refreshOnReturn: true),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: _QuickActionTile(
                  icon: Icons.manage_accounts_outlined,
                  label: l10n.accountSettingsDestination,
                  semanticLabel: l10n.openAccountSettings,
                  onTap: () =>
                      onOpen('/profile/account', refreshOnReturn: true),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _QuickActionTile(
                  icon: Icons.support_agent_outlined,
                  label: l10n.helpSessions,
                  semanticLabel: l10n.openHelpSessions,
                  onTap: () => onOpen(
                    '/learner/help-sessions',
                    refreshOnReturn: true,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        AuthorHelpSessionsQuickActionRow(onOpen: onOpen),
      ],
    );
  }
}

class AuthorHelpSessionsQuickActionRow extends ConsumerWidget {
  const AuthorHelpSessionsQuickActionRow({super.key, required this.onOpen});

  final void Function(String route, {bool refreshOnReturn}) onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final visibleAsync = ref.watch(authorHelpSessionsEntryVisibleProvider);
    return visibleAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, _) => const SizedBox.shrink(),
      data: (visible) {
        if (!visible) {
          return const SizedBox.shrink();
        }
        final l10n = LearnerProfileL10n.of(context);
        return IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: _QuickActionTile(
                  icon: Icons.forum_outlined,
                  label: l10n.authorHelpSessions,
                  semanticLabel: l10n.openAuthorHelpSessions,
                  onTap: () => onOpen(
                    creatorHelpSessionsRoute,
                    refreshOnReturn: true,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _QuickActionTile extends StatelessWidget {
  const _QuickActionTile({
    required this.icon,
    required this.label,
    required this.semanticLabel,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String semanticLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Semantics(
      button: true,
      label: semanticLabel,
      child: Material(
        color: colors.cardSurface,
        borderRadius: AppRadius.lgAll,
        child: InkWell(
          onTap: onTap,
          borderRadius: AppRadius.lgAll,
          child: Container(
            constraints: const BoxConstraints(minHeight: 76),
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            decoration: BoxDecoration(
              borderRadius: AppRadius.lgAll,
              border: Border.all(color: colors.primary.withValues(alpha: 0.18)),
            ),
            child: ExcludeSemantics(
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: colors.primarySoft,
                      borderRadius: AppRadius.mdAll,
                    ),
                    child: Icon(icon, color: colors.primary, size: 21),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      label,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTextStyles.label(context).copyWith(
                        color: colors.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  Icon(
                    Icons.chevron_right_rounded,
                    color: colors.textMuted,
                    size: 20,
                    textDirection: Directionality.of(context),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class DashboardSummaryError extends StatelessWidget {
  const DashboardSummaryError({super.key, required this.onRetry});

  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l10n = LearnerProfileL10n.of(context);
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.cardSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: colors.dangerSoft,
              borderRadius: AppRadius.mdAll,
            ),
            child: Icon(Icons.cloud_off_outlined, color: colors.danger),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.dashboardLoadFailed,
                  style: AppTextStyles.title(
                    context,
                  ).copyWith(color: colors.textPrimary, fontSize: 17),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  l10n.dashboardLoadFailedBody,
                  style: AppTextStyles.body(
                    context,
                  ).copyWith(color: colors.textSecondary, fontSize: 13.5),
                ),
                const SizedBox(height: AppSpacing.xs),
                TextButton.icon(
                  onPressed: onRetry,
                  style: TextButton.styleFrom(
                    foregroundColor: colors.primary,
                    minimumSize: const Size(48, 48),
                    padding: EdgeInsets.zero,
                  ),
                  icon: const Icon(Icons.refresh_rounded, size: 19),
                  label: Text(l10n.retry),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class DashboardRefreshFailureNotice extends StatelessWidget {
  const DashboardRefreshFailureNotice({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l10n = LearnerProfileL10n.of(context);
    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: colors.warningSoft,
        borderRadius: AppRadius.lgAll,
      ),
      child: Row(
        children: [
          Icon(Icons.sync_problem_rounded, color: colors.warningText, size: 19),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              l10n.refreshFailed,
              style: AppTextStyles.label(
                context,
              ).copyWith(color: colors.textPrimary, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

class LearnerDashboardSkeleton extends StatefulWidget {
  const LearnerDashboardSkeleton({super.key});

  @override
  State<LearnerDashboardSkeleton> createState() =>
      _LearnerDashboardSkeletonState();
}

class _LearnerDashboardSkeletonState extends State<LearnerDashboardSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
      lowerBound: 0.46,
      upperBound: 0.82,
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final l10n = LearnerProfileL10n.of(context);
    return Semantics(
      label: l10n.dashboardLoading,
      child: ExcludeSemantics(
        child: FadeTransition(
          opacity: _controller,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _SkeletonBlock(height: 154, color: colors.surfaceMuted),
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  Expanded(
                    child: _SkeletonBlock(
                      height: 112,
                      color: colors.primarySoft,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: _SkeletonBlock(
                      height: 112,
                      color: colors.surfaceMuted,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  Expanded(
                    child: _SkeletonBlock(
                      height: 112,
                      color: colors.surfaceMuted,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: _SkeletonBlock(
                      height: 112,
                      color: colors.primarySoft,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              _SkeletonBlock(height: 198, color: colors.surfaceMuted),
            ],
          ),
        ),
      ),
    );
  }
}

class _SkeletonBlock extends StatelessWidget {
  const _SkeletonBlock({required this.height, required this.color});

  final double height;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: BoxDecoration(color: color, borderRadius: AppRadius.xlAll),
    );
  }
}

class _DashboardSurface extends StatelessWidget {
  const _DashboardSurface({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.cardSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: colors.borderSubtle),
        boxShadow: [
          BoxShadow(
            color: colors.shadow.withValues(alpha: 0.06),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _SectionHeading extends StatelessWidget {
  const _SectionHeading({required this.icon, required this.title});

  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Row(
      children: [
        Icon(icon, color: colors.primary, size: 21),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            title,
            style: AppTextStyles.title(context).copyWith(
              color: colors.textPrimary,
              fontSize: 19,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ],
    );
  }
}
