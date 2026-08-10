import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../l10n/l10n.dart';
import '../../../../shared/widgets/app_feedback.dart';
import '../../../auth/application/auth_controller.dart';
import '../../application/learning_hub_providers.dart';
import '../../domain/models/learning_project.dart';
import '../theme/learning_ui_palette.dart';

enum ProjectEngagementDensity { full, compact }

class ProjectEngagementStrip extends ConsumerStatefulWidget {
  const ProjectEngagementStrip({
    super.key,
    required this.project,
    this.recommendationImpressionId,
    this.density = ProjectEngagementDensity.full,
  });

  final LearningProject project;
  final String? recommendationImpressionId;
  final ProjectEngagementDensity density;

  @override
  ConsumerState<ProjectEngagementStrip> createState() =>
      _ProjectEngagementStripState();
}

class _ProjectEngagementStripState
    extends ConsumerState<ProjectEngagementStrip> {
  late int _likesCount;
  late bool _isLiked;
  late bool _isSaved;
  late int _followersCount;
  late bool _isFollowing;
  _EngagementAction? _updatingAction;

  @override
  void initState() {
    super.initState();
    _syncFromProject();
  }

  @override
  void didUpdateWidget(covariant ProjectEngagementStrip oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.project.id != widget.project.id ||
        oldWidget.project.likesCount != widget.project.likesCount ||
        oldWidget.project.isLiked != widget.project.isLiked ||
        oldWidget.project.isSaved != widget.project.isSaved ||
        oldWidget.project.followersCount != widget.project.followersCount ||
        oldWidget.project.isFollowing != widget.project.isFollowing) {
      _syncFromProject();
    }
  }

  void _syncFromProject() {
    _likesCount = widget.project.likesCount;
    _isLiked = widget.project.isLiked;
    _isSaved = widget.project.isSaved;
    _followersCount = widget.project.followersCount;
    _isFollowing = widget.project.isFollowing;
  }

  bool _requireLearner(String action) {
    final authState = ref.read(authControllerProvider);
    if (authState.status != AuthStatus.authenticated) {
      final from = Uri.encodeQueryComponent('/learning/${widget.project.id}');
      context.go('/login?from=$from');
      return false;
    }

    if (authState.user?.hasRole('LEARNER') != true) {
      showInfoSnackBar(
        context,
        LocalizedText(
          en: 'Use a learner account to $action projects.',
          ar: 'استخدم حساب متعلم للتفاعل مع المشاريع.',
        ).resolve(context),
      );
      return false;
    }

    return true;
  }

  Future<void> _toggleLike() async {
    if (_updatingAction != null || !_requireLearner('like')) {
      return;
    }

    final previousLikes = _likesCount;
    final previousLiked = _isLiked;
    final shouldLike = !_isLiked;

    setState(() {
      _updatingAction = _EngagementAction.like;
      _isLiked = shouldLike;
      _likesCount = shouldLike
          ? _likesCount + 1
          : (_likesCount > 0 ? _likesCount - 1 : 0);
    });

    try {
      final result = shouldLike
          ? await ref
                .read(learningHubRepositoryProvider)
                .likeProject(
                  widget.project.id,
                  recommendationImpressionId: widget.recommendationImpressionId,
                )
          : await ref
                .read(learningHubRepositoryProvider)
                .unlikeProject(
                  widget.project.id,
                  recommendationImpressionId: widget.recommendationImpressionId,
                );

      if (!mounted) {
        return;
      }

      invalidateLearningHubEngagement(ref, widget.project.id);
      setState(() {
        _likesCount = result.likesCount;
        _isLiked = result.isLiked;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _likesCount = previousLikes;
        _isLiked = previousLiked;
      });
      showErrorSnackBar(context, error);
    } finally {
      if (mounted) {
        setState(() {
          _updatingAction = null;
        });
      }
    }
  }

  Future<void> _toggleSave() async {
    if (_updatingAction != null || !_requireLearner('save')) {
      return;
    }

    final previousSaved = _isSaved;
    final shouldSave = !_isSaved;

    setState(() {
      _updatingAction = _EngagementAction.save;
      _isSaved = shouldSave;
    });

    try {
      final result = shouldSave
          ? await ref
                .read(learningHubRepositoryProvider)
                .saveProject(
                  widget.project.id,
                  recommendationImpressionId: widget.recommendationImpressionId,
                )
          : await ref
                .read(learningHubRepositoryProvider)
                .unsaveProject(
                  widget.project.id,
                  recommendationImpressionId: widget.recommendationImpressionId,
                );

      if (!mounted) {
        return;
      }

      invalidateLearningHubEngagement(ref, widget.project.id);
      setState(() {
        _isSaved = result.isSaved;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _isSaved = previousSaved;
      });
      showErrorSnackBar(context, error);
    } finally {
      if (mounted) {
        setState(() {
          _updatingAction = null;
        });
      }
    }
  }

  Future<void> _toggleFollow() async {
    if (_updatingAction != null || !_requireLearner('follow')) {
      return;
    }

    final previousCount = _followersCount;
    final previousFollowing = _isFollowing;
    final shouldFollow = !_isFollowing;

    setState(() {
      _updatingAction = _EngagementAction.follow;
      _isFollowing = shouldFollow;
      _followersCount = shouldFollow
          ? _followersCount + 1
          : (_followersCount > 0 ? _followersCount - 1 : 0);
    });

    try {
      final result = shouldFollow
          ? await ref
                .read(learningHubRepositoryProvider)
                .followProject(
                  widget.project.id,
                  recommendationImpressionId: widget.recommendationImpressionId,
                )
          : await ref
                .read(learningHubRepositoryProvider)
                .unfollowProject(
                  widget.project.id,
                  recommendationImpressionId: widget.recommendationImpressionId,
                );

      if (!mounted) {
        return;
      }

      invalidateLearningHubEngagement(ref, widget.project.id);
      setState(() {
        _followersCount = result.followersCount;
        _isFollowing = result.isFollowing;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _followersCount = previousCount;
        _isFollowing = previousFollowing;
      });
      showErrorSnackBar(context, error);
    } finally {
      if (mounted) {
        setState(() {
          _updatingAction = null;
        });
      }
    }
  }

  String _likesLabel(BuildContext context, {required bool compact}) {
    if (compact) {
      return '$_likesCount';
    }
    return LocalizedText(
      en: _likesCount == 1 ? '1 like' : '$_likesCount likes',
      ar: '$_likesCount إعجاب',
    ).resolve(context);
  }

  String _saveLabel(BuildContext context, {required bool compact}) {
    final l10n = context.l10n;
    if (compact) {
      return '';
    }
    return _isSaved ? l10n.saved : l10n.save;
  }

  String _followersLabel(BuildContext context, {required bool compact}) {
    if (compact) {
      return '$_followersCount';
    }
    return LocalizedText(
      en: _followersCount == 1
          ? '1 follower'
          : '$_followersCount followers',
      ar: '$_followersCount متابع',
    ).resolve(context);
  }

  @override
  Widget build(BuildContext context) {
    final compact = widget.density == ProjectEngagementDensity.compact;
    final l10n = context.l10n;
    final pills = [
      _EngagementPill(
        icon: _isLiked ? Icons.favorite_rounded : Icons.favorite_border,
        label: _likesLabel(context, compact: compact),
        selected: _isLiked,
        isLoading: _updatingAction == _EngagementAction.like,
        compact: compact,
        tooltip: _isLiked
            ? LocalizedText(
                en: 'Unlike project',
                ar: 'إزالة الإعجاب',
              ).resolve(context)
            : LocalizedText(
                en: 'Like project',
                ar: 'الإعجاب بالمشروع',
              ).resolve(context),
        semanticLabel: LocalizedText(
          en: _likesCount == 1 ? '1 like' : '$_likesCount likes',
          ar: '$_likesCount إعجاب',
        ).resolve(context),
        onTap: _toggleLike,
      ),
      _EngagementPill(
        icon: _isSaved ? Icons.bookmark_rounded : Icons.bookmark_border,
        label: _saveLabel(context, compact: compact),
        selected: _isSaved,
        isLoading: _updatingAction == _EngagementAction.save,
        compact: compact,
        tooltip: _isSaved
            ? LocalizedText(
                en: 'Remove saved project',
                ar: 'إزالة من المحفوظات',
              ).resolve(context)
            : LocalizedText(
                en: 'Save project',
                ar: 'حفظ المشروع',
              ).resolve(context),
        semanticLabel: _isSaved ? l10n.saved : l10n.save,
        onTap: _toggleSave,
      ),
      _EngagementPill(
        icon: _isFollowing
            ? Icons.notifications_active_rounded
            : Icons.notifications_none_rounded,
        label: _followersLabel(context, compact: compact),
        selected: _isFollowing,
        isLoading: _updatingAction == _EngagementAction.follow,
        compact: compact,
        tooltip: _isFollowing
            ? LocalizedText(
                en: 'Unfollow project',
                ar: 'إلغاء متابعة المشروع',
              ).resolve(context)
            : LocalizedText(
                en: 'Follow project',
                ar: 'متابعة المشروع',
              ).resolve(context),
        semanticLabel: LocalizedText(
          en: _followersCount == 1
              ? '1 follower'
              : '$_followersCount followers',
          ar: '$_followersCount متابع',
        ).resolve(context),
        onTap: _toggleFollow,
      ),
    ];

    // Wrap keeps all actions inside the card width on mobile instead of
    // forcing a single overflowing horizontal row of labeled pills.
    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.xs,
      children: pills,
    );
  }
}

enum _EngagementAction { like, save, follow }

class _EngagementPill extends StatelessWidget {
  const _EngagementPill({
    required this.icon,
    required this.label,
    required this.selected,
    required this.isLoading,
    required this.compact,
    required this.tooltip,
    required this.semanticLabel,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final bool isLoading;
  final bool compact;
  final String tooltip;
  final String semanticLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final textTheme = Theme.of(context).textTheme;
    final background = selected ? palette.limeSoft : palette.mutedChip;
    final foreground = selected ? palette.lime : palette.textSecondary;
    final showLabel = label.trim().isNotEmpty;

    return Semantics(
      button: true,
      label: semanticLabel,
      child: Tooltip(
        message: tooltip,
        child: InkWell(
          borderRadius: AppRadius.pillAll,
          onTap: isLoading ? null : onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 160),
            constraints: BoxConstraints(
              minHeight: compact ? 32 : 36,
              minWidth: compact ? 32 : 0,
            ),
            padding: EdgeInsetsDirectional.symmetric(
              horizontal: compact
                  ? (showLabel ? AppSpacing.sm : AppSpacing.xs + 2)
                  : AppSpacing.md,
              vertical: compact ? AppSpacing.xs : AppSpacing.sm,
            ),
            decoration: BoxDecoration(
              color: background,
              borderRadius: AppRadius.pillAll,
              border: Border.all(
                color: selected
                    ? palette.lime.withValues(alpha: 0.34)
                    : palette.borderSubtle,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (isLoading)
                  SizedBox(
                    width: compact ? 14 : 16,
                    height: compact ? 14 : 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: foreground,
                    ),
                  )
                else
                  Icon(icon, size: compact ? 16 : 18, color: foreground),
                if (showLabel) ...[
                  SizedBox(width: compact ? 4 : AppSpacing.xs),
                  Text(
                    label,
                    style:
                        (compact ? textTheme.labelSmall : textTheme.labelMedium)
                            ?.copyWith(
                      color: foreground,
                      fontWeight: FontWeight.w700,
                    ),
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
