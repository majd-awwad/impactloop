import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/navigation_extensions.dart';
import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/config/api_config.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../data/models/project_help_session_models.dart';
import '../l10n/project_help_sessions_l10n.dart';
import 'help_session_status_utils.dart';

class AuthorHelpSessionListCard extends StatelessWidget {
  const AuthorHelpSessionListCard({super.key, required this.session});

  final ProjectHelpSession session;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final scheduled = session.selectedStartsAt;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => context.push(creatorHelpSessionDetailRoute(session.id)),
        borderRadius: AppRadius.lgAll,
        child: Container(
          padding: const EdgeInsetsDirectional.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: palette.panelSurface,
            borderRadius: AppRadius.lgAll,
            border: Border.all(color: palette.borderSubtle),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Cover(imageUrl: session.project.coverImageUrl),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.xs,
                      children: [
                        AppStatusBadge(
                          label: ProjectHelpSessionsL10n.authorStatusLabel(
                            session.status,
                          ).resolve(context),
                          tone: helpSessionStatusTone(session.status),
                        ),
                        AppStatusBadge(
                          label: ProjectHelpSessionsL10n.durationLabel(
                            session.durationMinutes,
                          ).resolve(context),
                          tone: AppStatusTone.neutral,
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      session.project.title,
                      style: AppTextStyles.title(context)
                          .copyWith(color: palette.textPrimary),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      session.learner.displayName,
                      style: AppTextStyles.body(context)
                          .copyWith(color: palette.textSecondary),
                    ),
                    if (session.projectStep != null) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        '#${session.projectStep!.stepNumber} ${session.projectStep!.title}',
                        style: AppTextStyles.label(context)
                            .copyWith(color: palette.textMuted),
                      ),
                    ],
                    if (scheduled != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        formatHelpSessionDateTime(
                          context,
                          scheduled,
                          session.learnerTimeZone,
                        ),
                        style: AppTextStyles.label(context)
                            .copyWith(color: palette.textSecondary),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Icon(
                Directionality.of(context) == TextDirection.rtl
                    ? Icons.chevron_left
                    : Icons.chevron_right,
                color: palette.textMuted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Cover extends StatelessWidget {
  const _Cover({this.imageUrl});

  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final hasImage = imageUrl != null && imageUrl!.trim().isNotEmpty;
    return ClipRRect(
      borderRadius: AppRadius.mdAll,
      child: Container(
        width: 64,
        height: 64,
        color: palette.mutedSurface,
        child: !hasImage
            ? Icon(Icons.school_outlined, color: palette.textMuted)
            : Image.network(
                ApiConfig.resolveMediaUrl(imageUrl!),
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) =>
                    Icon(Icons.school_outlined, color: palette.textMuted),
              ),
      ),
    );
  }
}
