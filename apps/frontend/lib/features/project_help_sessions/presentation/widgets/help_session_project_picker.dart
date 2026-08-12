import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/config/api_config.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_empty_state_card.dart';
import '../../../../shared/widgets/user_avatar.dart';
import '../../application/project_help_sessions_providers.dart';
import '../../data/models/project_help_session_models.dart';

Future<ProjectHelpSessionProjectOption?> showHelpSessionProjectPicker(
  BuildContext context,
) {
  return showDialog<ProjectHelpSessionProjectOption>(
    context: context,
    builder: (context) => const _HelpSessionProjectPickerDialog(),
  );
}

class _HelpSessionProjectPickerDialog extends ConsumerStatefulWidget {
  const _HelpSessionProjectPickerDialog();

  @override
  ConsumerState<_HelpSessionProjectPickerDialog> createState() =>
      _HelpSessionProjectPickerDialogState();
}

class _HelpSessionProjectPickerDialogState
    extends ConsumerState<_HelpSessionProjectPickerDialog> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  String? _query;

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _search(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (!mounted) return;
      final trimmed = value.trim();
      setState(() => _query = trimmed.isEmpty ? null : trimmed);
    });
  }

  @override
  Widget build(BuildContext context) {
    final options = ref.watch(projectHelpSessionProjectOptionsProvider(_query));
    return Dialog(
      insetPadding: const EdgeInsets.all(AppSpacing.md),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 760, maxHeight: 680),
        child: Padding(
          padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      context.l10n.phsChooseProject,
                      style: AppTextStyles.title(context),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    tooltip: MaterialLocalizations.of(
                      context,
                    ).closeButtonTooltip,
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              TextField(
                controller: _searchController,
                onChanged: _search,
                decoration: InputDecoration(
                  hintText: context.l10n.phsSearchEligibleProjects,
                  prefixIcon: const Icon(Icons.search),
                  border: const OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Expanded(
                child: options.when(
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (_, _) => AppEmptyStateCard(
                    icon: Icons.error_outline,
                    title: context.l10n.publicUserProfileUnavailable,
                    subtitle: context.l10n.publicUserProfileUnavailableBody,
                    actions: [
                      OutlinedButton(
                        onPressed: () => ref.invalidate(
                          projectHelpSessionProjectOptionsProvider(_query),
                        ),
                        child: Text(context.l10n.tryAgain),
                      ),
                    ],
                  ),
                  data: (result) => result.items.isEmpty
                      ? AppEmptyStateCard(
                          icon: Icons.search_off_outlined,
                          title: context.l10n.publicUserNoPublishedProjects,
                          subtitle: context.l10n.phsSearchEligibleProjects,
                        )
                      : ListView.separated(
                          itemCount: result.items.length,
                          separatorBuilder: (_, _) =>
                              const SizedBox(height: AppSpacing.sm),
                          itemBuilder: (context, index) => _ProjectOptionTile(
                            option: result.items[index],
                            onSelected: () =>
                                Navigator.of(context).pop(result.items[index]),
                          ),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProjectOptionTile extends StatelessWidget {
  const _ProjectOptionTile({required this.option, required this.onSelected});

  final ProjectHelpSessionProjectOption option;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) {
    final imageUrl = option.coverImageUrl?.trim();
    return Material(
      color: Theme.of(context).colorScheme.surface,
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.mdAll,
        side: BorderSide(color: Theme.of(context).dividerColor),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onSelected,
        child: Padding(
          padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: AppRadius.smAll,
                child: SizedBox(
                  width: 86,
                  height: 64,
                  child: imageUrl == null || imageUrl.isEmpty
                      ? const ColoredBox(
                          color: Color(0xFFEAF4EF),
                          child: Icon(Icons.school_outlined),
                        )
                      : Image.network(
                          ApiConfig.resolveMediaUrl(imageUrl),
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => const ColoredBox(
                            color: Color(0xFFEAF4EF),
                            child: Icon(Icons.school_outlined),
                          ),
                        ),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      option.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    InkWell(
                      borderRadius: AppRadius.pillAll,
                      onTap: () => context.push('/users/${option.creator.id}'),
                      child: Padding(
                        padding: const EdgeInsetsDirectional.symmetric(
                          vertical: AppSpacing.xs,
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            UserAvatar(
                              displayName: option.creator.displayName,
                              profileImageUrl: option.creator.avatarUrl,
                              radius: 11,
                            ),
                            const SizedBox(width: AppSpacing.xs),
                            Flexible(
                              child: Text(
                                context.l10n.phsByCreator(
                                  option.creator.displayName,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              const Icon(Icons.chevron_right_rounded),
            ],
          ),
        ),
      ),
    );
  }
}
