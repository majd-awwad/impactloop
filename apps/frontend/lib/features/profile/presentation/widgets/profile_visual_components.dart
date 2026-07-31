import 'package:flutter/material.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/user_avatar.dart';
import '../../../auth/data/models/user.dart';

class ProfileIdentityHeroCard extends StatelessWidget {
  const ProfileIdentityHeroCard({
    super.key,
    required this.user,
    required this.fallbackName,
    required this.roleLabel,
    required this.statusLabel,
    required this.statusTone,
    this.metadata = const <Widget>[],
    this.footer,
    this.compact = false,
    this.avatarSemanticLabel,
  });

  final User user;
  final String fallbackName;
  final String roleLabel;
  final String statusLabel;
  final AppStatusTone statusTone;
  final List<Widget> metadata;
  final Widget? footer;
  final bool compact;
  final String? avatarSemanticLabel;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final displayName = user.displayName.trim().isEmpty
        ? fallbackName
        : user.displayName.trim();
    final scale = MediaQuery.textScalerOf(context).scale(1);

    return Container(
      width: double.infinity,
      padding: EdgeInsetsDirectional.all(
        compact ? AppSpacing.md : AppSpacing.lg,
      ),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: AlignmentDirectional.topStart,
          end: AlignmentDirectional.bottomEnd,
          colors: [
            colors.cardSurface,
            Color.lerp(colors.cardSurface, colors.primarySoft, 0.72)!,
          ],
        ),
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: colors.borderSubtle),
        boxShadow: [
          BoxShadow(
            color: colors.shadow.withValues(alpha: 0.11),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final stackIdentity = constraints.maxWidth < 280 && scale > 1.3;
          final avatar = Semantics(
            label: avatarSemanticLabel,
            image: avatarSemanticLabel != null,
            child: ExcludeSemantics(
              child: UserAvatar(
                displayName: displayName,
                profileImageUrl: user.profileImageUrl,
                radius: compact ? 28 : 34,
                backgroundColor: colors.primarySoft,
                foregroundColor: colors.primary,
                initialTextStyle: AppTextStyles.title(context).copyWith(
                  color: colors.primary,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          );
          final identity = Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                displayName,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.title(context).copyWith(
                  color: colors.textPrimary,
                  fontSize: compact ? 19 : 21,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  AppStatusBadge(
                    label: roleLabel,
                    tone: AppStatusTone.primary,
                  ),
                  AppStatusBadge(label: statusLabel, tone: statusTone),
                ],
              ),
              if (metadata.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.md),
                ..._withGaps(metadata),
              ],
            ],
          );

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (stackIdentity) ...[
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: avatar,
                ),
                const SizedBox(height: AppSpacing.md),
                identity,
              ] else
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    avatar,
                    const SizedBox(width: AppSpacing.md),
                    Expanded(child: identity),
                  ],
                ),
              if (footer != null) ...[
                const SizedBox(height: AppSpacing.md),
                footer!,
              ],
            ],
          );
        },
      ),
    );
  }

  static List<Widget> _withGaps(List<Widget> widgets) {
    return [
      for (var index = 0; index < widgets.length; index++) ...[
        if (index > 0) const SizedBox(height: AppSpacing.xs),
        widgets[index],
      ],
    ];
  }
}

class ProfileSurfaceHeader extends StatelessWidget {
  const ProfileSurfaceHeader({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.trailing,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: colors.primarySoft,
            borderRadius: AppRadius.mdAll,
          ),
          child: Icon(icon, color: colors.primary, size: 20),
        ),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.title(context).copyWith(
                  color: colors.textPrimary,
                  fontSize: 18,
                ),
              ),
              if (subtitle != null) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  subtitle!,
                  style: AppTextStyles.body(context).copyWith(
                    color: colors.textSecondary,
                    height: 1.4,
                  ),
                ),
              ],
            ],
          ),
        ),
        if (trailing != null) ...[
          const SizedBox(width: AppSpacing.sm),
          trailing!,
        ],
      ],
    );
  }
}

class ProfileDestinationRow extends StatelessWidget {
  const ProfileDestinationRow({
    super.key,
    required this.icon,
    required this.title,
    required this.onTap,
    this.subtitle,
    this.trailing,
    this.busy = false,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final Widget? trailing;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Semantics(
      button: true,
      enabled: onTap != null,
      label: title,
      child: InkWell(
        onTap: onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 56),
          child: Padding(
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            child: Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: colors.primarySoft,
                    borderRadius: AppRadius.mdAll,
                  ),
                  child: Icon(icon, color: colors.primary, size: 20),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.label(context).copyWith(
                          color: colors.textPrimary,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      if (subtitle != null) ...[
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          subtitle!,
                          style: AppTextStyles.body(context).copyWith(
                            color: colors.textSecondary,
                            height: 1.35,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                if (busy)
                  const SizedBox.square(
                    dimension: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                else ...[
                  if (trailing != null) ...[
                    trailing!,
                    const SizedBox(width: AppSpacing.xs),
                  ],
                  Icon(
                    Icons.chevron_right_rounded,
                    color: colors.textMuted,
                    textDirection: Directionality.of(context),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class ProfileInterestChip extends StatelessWidget {
  const ProfileInterestChip({
    super.key,
    required this.label,
    this.maxWidth,
  });

  final String label;
  final double? maxWidth;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return Semantics(
      label: label,
      child: Container(
        constraints: BoxConstraints(minHeight: 40, maxWidth: maxWidth ?? 260),
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
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          textAlign: TextAlign.center,
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
