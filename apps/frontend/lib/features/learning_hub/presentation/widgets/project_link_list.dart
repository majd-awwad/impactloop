import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/config/api_config.dart';
import '../../presentation/theme/learning_ui_palette.dart';
import '../../domain/models/learning_project.dart';

class ProjectLinkList extends StatelessWidget {
  const ProjectLinkList({super.key, required this.links});

  final List<ProjectLinkItem> links;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.xlAll,
        border: Border.all(color: palette.borderSubtle),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow,
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: palette.darkSurfaceSoft,
                  borderRadius: AppRadius.pillAll,
                ),
                child: Icon(Icons.open_in_new, color: palette.lime),
              ),
              const Spacer(),
              Text(
                const LocalizedText(
                  en: 'Helpful links',
                  ar: 'روابط مفيدة',
                ).resolve(context),
                style: AppTextStyles.display(
                  context,
                ).copyWith(color: palette.textPrimary),
                textAlign: TextAlign.start,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          for (var index = 0; index < links.length; index++) ...[
            _LinkTile(item: links[index]),
            if (index != links.length - 1)
              const SizedBox(height: AppSpacing.md),
          ],
        ],
      ),
    );
  }
}

class _LinkTile extends StatelessWidget {
  const _LinkTile({required this.item});

  final ProjectLinkItem item;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final uri = _safeExternalUri(item.url);
    final canOpen = uri != null;
    final titleColor = canOpen
        ? palette.textPrimary
        : palette.textSecondary.withValues(alpha: 0.66);
    final subtitleColor = canOpen
        ? palette.textSecondary
        : palette.textSecondary.withValues(alpha: 0.58);

    return Tooltip(
      message: canOpen
          ? const LocalizedText(
              en: 'Open link',
              ar: 'فتح الرابط',
            ).resolve(context)
          : const LocalizedText(
              en: 'This link is not available',
              ar: 'هذا الرابط غير متاح',
            ).resolve(context),
      child: Material(
        color: Colors.transparent,
        borderRadius: AppRadius.lgAll,
        child: InkWell(
          onTap: canOpen ? () => _openLink(context, uri) : null,
          borderRadius: AppRadius.lgAll,
          child: Container(
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: palette.darkSurfaceSoft,
              borderRadius: AppRadius.lgAll,
              border: Border.all(color: palette.borderSubtle),
            ),
            child: Row(
              children: [
                Icon(
                  canOpen ? Icons.link_rounded : Icons.link_off_rounded,
                  color: canOpen
                      ? palette.lime
                      : palette.textSecondary.withValues(alpha: 0.62),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.label.resolve(context),
                        style: AppTextStyles.title(
                          context,
                        ).copyWith(fontSize: 18, color: titleColor),
                        textAlign: TextAlign.start,
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        item.urlLabel.resolve(context),
                        style: AppTextStyles.subtitle(
                          context,
                        ).copyWith(color: subtitleColor),
                        textAlign: TextAlign.start,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Icon(
                  canOpen
                      ? Icons.open_in_new_rounded
                      : Icons.info_outline_rounded,
                  color: canOpen
                      ? palette.textSecondary
                      : palette.textSecondary.withValues(alpha: 0.58),
                  size: 20,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static Uri? _safeExternalUri(String? rawUrl) {
    final trimmed = rawUrl?.trim();
    if (trimmed == null || trimmed.isEmpty) {
      return null;
    }

    final uri = Uri.tryParse(trimmed);
    if (uri == null || !uri.hasScheme || uri.host.trim().isEmpty) {
      return null;
    }

    final scheme = uri.scheme.toLowerCase();
    if (scheme != 'http' && scheme != 'https') {
      return null;
    }

    return uri;
  }

  Future<void> _openLink(BuildContext context, Uri uri) async {
    if (kIsWeb) {
      ApiConfig.openExternalDocument(uri.toString());
      return;
    }

    final messenger = ScaffoldMessenger.of(context);
    final failureMessage = const LocalizedText(
      en: 'Could not open this link.',
      ar: 'تعذر فتح هذا الرابط.',
    ).resolve(context);

    try {
      if (await launchUrl(uri)) {
        return;
      }

      if (await launchUrl(uri, mode: LaunchMode.externalApplication)) {
        return;
      }
    } catch (_) {
      // Fall through to the same user-facing failure state.
    }

    if (!context.mounted) {
      return;
    }

    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(failureMessage),
        ),
      );
  }
}
